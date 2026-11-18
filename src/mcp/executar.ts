import { z } from "zod";
import { arvore, decodificar } from "@/consulta/cbo";
import { cobertura, coberturaResumo, resumoGrupo } from "@/consulta/derivado";
import { buscarAtividades } from "@/consulta/busca";
import { sobre } from "@/consulta/meta";
import {
  atividades,
  comparar,
  competencias,
  listarOcupacoes,
  obterOcupacao,
  similares,
} from "@/consulta/ocupacao";
import { buscarTermos, listarTermos, naoClassificadas, obterTermo, ocupacoesDoTermo, vocabularios } from "@/consulta/qbq";
import { Problema } from "@/http/erros";
import { faixaDeParams } from "@/http/parametros";
import type { Saida } from "@/tipos";
import { VERSAO_DADOS } from "@/versao";

export const INSTRUCOES = [
  "Nunca cite código CBO, título, nível ou competência sem tê-lo obtido de uma tool nesta conversa.",
  "CBO e QBQ são fontes distintas: diga de qual vem cada afirmação e relate divergência em vez de escolher um lado.",
  "Nível (1–8) e graus (1–5) são escalas ordinais oficiais.",
  "Similaridade, rankings e resumos são cálculos derivados, não dado oficial.",
  "Ausência de nível ou de perfil é informação a relatar com a justificativa, não lacuna a preencher.",
].join(" ");

const somenteLeitura = { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false };

export type ResultadoTool = { texto: string; dados: Record<string, unknown> };

function embrulho(saida: Saida, texto: string): ResultadoTool {
  const total = saida.total;
  const limite = saida.limite;
  const avisos = [...(saida.avisos ?? [])];
  if (total != null && limite != null && total > limite) {
    avisos.push({
      mensagem: `Mostrando ${limite} de ${total}. Aumente limite (máximo 50) ou peça o restante.`,
    });
  }
  return {
    texto,
    dados: {
      versao_dados: VERSAO_DADOS,
      avisos,
      derivado: saida.derivado === true,
      ...(saida.metodo ? { metodo: saida.metodo } : {}),
      ...(total != null ? { total } : {}),
      resultado: saida.dados,
    },
  };
}

function textoLista(prefixo: string, itens: { codigo?: string; titulo_cbo?: string | null; titulo?: string | null }[]) {
  const linhas = itens.slice(0, 5).map((item) => `${item.codigo ?? ""} ${item.titulo_cbo ?? item.titulo ?? ""}`.trim());
  return [prefixo, ...linhas].filter(Boolean).join("\n");
}

export function executarTool(nome: string, args: Record<string, unknown>): ResultadoTool {
  switch (nome) {
    case "ocupacao_buscar": {
      const consulta = String(args.consulta ?? "");
      const limite = Number(args.limite ?? 10);
      const saida = listarOcupacoes({
        q: consulta || undefined,
        buscarEm: (args.buscar_em as ("titulo" | "sinonimo" | "sintese")[]) ?? ["titulo", "sinonimo"],
        prefixo: args.prefixo ? String(args.prefixo) : undefined,
        nivelQualificacao: faixaDeParams(args.nivel_qualificacao_min as number | undefined, args.nivel_qualificacao_max as number | undefined, "nivel_qualificacao", 1, 8),
        situacaoQbq: args.situacao_qbq ? String(args.situacao_qbq) : undefined,
        limite,
        deslocamento: 0,
      });
      if ((saida.total ?? 0) === 0) {
        saida.avisos = [...(saida.avisos ?? []), { mensagem: "Sem resultado. Tente um termo mais curto ou use cbo_buscar_atividades para buscar pela tarefa." }];
      }
      const itens = saida.dados as { codigo: string; titulo_cbo: string | null }[];
      return embrulho(saida, textoLista(`${saida.total} ocupações.`, itens));
    }
    case "ocupacao_obter": {
      const incluir = (args.incluir as string[]) ?? ["sinonimos"];
      const saida = obterOcupacao(String(args.codigo), {
        perfil: incluir.includes("perfil_ocupacional"),
        atividades: incluir.includes("resumo_atividades") ? "resumo" : incluir.includes("atividades"),
        competencias: incluir.includes("principais_competencias") ? "principais" : incluir.includes("competencias"),
      });
      const ficha = saida.dados as { codigo: string; cbo: { titulo?: string } | null; qbq: { titulo?: string } | null; situacao_qbq: string };
      return embrulho(saida, `${ficha.codigo}: CBO ${ficha.cbo?.titulo ?? "ausente"}; QBQ ${ficha.qbq?.titulo ?? "ausente"}; situação ${ficha.situacao_qbq}.`);
    }
    case "cbo_atividades": {
      const saida = atividades(String(args.codigo), {
        area: args.area ? String(args.area) : undefined,
        transversais: (args.transversais as "incluir" | "excluir" | "somente") ?? "incluir",
        modo: (args.modo as "completo" | "resumo") ?? "completo",
      });
      const dados = saida.dados as { total_atividades?: number; motivo?: string };
      return embrulho(saida, dados.motivo ?? `${dados.total_atividades} atividades. A sigla da área não se compara entre ocupações.`);
    }
    case "qbq_competencias": {
      const saida = competencias(String(args.codigo), {
        dimensao: args.dimensao as "conhecimentos" | "habilidades" | "atitudes" | undefined,
        importanciaMin: args.importancia_min as number | undefined,
        incluirConceitos: Boolean(args.incluir_conceitos),
        limite: Number(args.limite ?? 20),
      });
      return embrulho(saida, "Competências do QBQ, ordenadas por importância. Ocupação sem nível devolve a justificativa, não uma lista vazia.");
    }
    case "cbo_navegar": {
      const saida = arvore(args.codigo ? String(args.codigo) : undefined, Number(args.profundidade ?? 1));
      return embrulho(saida, args.codigo ? `Nó ${args.codigo} e filhos.` : "Dez grandes grupos.");
    }
    case "codigo_decodificar": {
      const codigos = (args.codigos as string[]) ?? [];
      if (codigos.length > 100) throw new Problema(400, "/v1/problemas/parametro-invalido", "Parâmetro inválido", "A tool aceita até 100 códigos.");
      const saida = decodificar(codigos, "lote");
      const dados = saida.dados as { validos?: number; invalidos?: number };
      return embrulho(saida, `${dados.validos ?? 0} válidos, ${dados.invalidos ?? 0} inválidos.`);
    }
    case "qbq_vocabulario": {
      if (!args.vocabulario) return embrulho(vocabularios(), "Quatro vocabulários. Conhecimentos I e II não se misturam.");
      if (!args.codigo) {
        const saida = listarTermos(String(args.vocabulario), { nivel: args.nivel ? String(args.nivel) : undefined, formato: "plano", limite: 50, deslocamento: 0 });
        return embrulho(saida, `Termos de ${args.vocabulario}.`);
      }
      const saida = obterTermo(String(args.vocabulario), args.nivel ? String(args.nivel) : undefined, String(args.codigo), Boolean(args.incluir_uso));
      return embrulho(saida, `Termo ${args.codigo}.`);
    }
    case "dados_sobre":
      return embrulho(sobre(args.topico ? String(args.topico) : undefined, args.id ? String(args.id) : undefined), `Dataset ${VERSAO_DADOS}.`);
    case "cbo_buscar_atividades": {
      const saida = buscarAtividades({
        q: String(args.consulta ?? ""),
        prefixo: args.prefixo ? String(args.prefixo) : undefined,
        nivelQualificacao: faixaDeParams(args.nivel_qualificacao_min as number | undefined, args.nivel_qualificacao_max as number | undefined, "nivel_qualificacao", 1, 8),
        transversais: (args.transversais as "incluir" | "excluir" | "somente") ?? "excluir",
        agrupar: true,
        limite: Number(args.limite ?? 10),
        deslocamento: 0,
        maxCasadas: 3,
      });
      return embrulho(saida, "Ocupações pela tarefa. Áreas Y e Z ficam de fora no padrão, para não dominar o resultado.");
    }
    case "qbq_buscar_termos": {
      const saida = buscarTermos({
        q: String(args.consulta ?? ""),
        vocabularios: args.vocabularios as string[] | undefined,
        buscarEm: (args.buscar_em as string[]) ?? ["vocabulario", "conceito"],
        limite: Number(args.limite ?? 10),
      });
      return embrulho(saida, "Termos encontrados. Um assunto pode existir nas duas taxonomias de conhecimento com códigos diferentes.");
    }
    case "qbq_ocupacoes_por_competencia": {
      const saida = ocupacoesDoTermo(String(args.vocabulario), String(args.nivel), String(args.codigo), {
        importanciaMin: args.importancia_min as number | undefined,
        frequenciaMin: args.frequencia_min as number | undefined,
        profundidadeMin: args.profundidade_min as number | undefined,
        prefixo: args.prefixo ? String(args.prefixo) : undefined,
        nivelQualificacao: faixaDeParams(args.nivel_qualificacao_min as number | undefined, args.nivel_qualificacao_max as number | undefined, "nivel_qualificacao", 1, 8),
        limite: Number(args.limite ?? 20),
        deslocamento: 0,
      });
      return embrulho(saida, `${saida.total} ocupações exigem o termo.`);
    }
    case "ocupacao_comparar": {
      const saida = comparar((args.codigos as string[]) ?? [], String(args.dimensao ?? "habilidades"), args.importancia_min as number | undefined);
      return embrulho(saida, "Comparação derivada. Entre taxonomias de conhecimento diferentes, a similaridade não é calculada.");
    }
    case "ocupacao_similares": {
      const saida = similares(String(args.codigo), String(args.dimensao ?? "habilidades"), String(args.escopo ?? "todas"), Number(args.limite ?? 10));
      return embrulho(saida, "Ocupações parecidas por Jaccard, sem baldes. É cálculo derivado.");
    }
    case "cbo_resumir_grupo": {
      const saida = resumoGrupo(args.codigo ? String(args.codigo) : undefined, String(args.dimensao ?? "habilidades"), Number(args.limite ?? 10));
      return embrulho(saida, "Retrato derivado do grupo: níveis e termos que o distinguem do conjunto.");
    }
    case "cobertura_consultar": {
      if (!args.codigo && !args.situacao && !args.prefixo) return embrulho(coberturaResumo(), "Resumo das divergências entre CBO e QBQ.");
      if (args.situacao === "nao_classificada" || args.situacao === "sem_nivel_sem_justificativa") {
        const saida = args.situacao === "nao_classificada"
          ? naoClassificadas(undefined, args.prefixo ? String(args.prefixo) : undefined, Number(args.limite ?? 20), 0)
          : listarOcupacoes({ situacaoQbq: "sem_nivel_sem_justificativa", buscarEm: ["titulo"], limite: Number(args.limite ?? 20), deslocamento: 0, prefixo: args.prefixo ? String(args.prefixo) : undefined });
        return embrulho(saida, "Ocupações sem nível no QBQ.");
      }
      if (args.codigo) {
        const saida = obterOcupacao(String(args.codigo));
        return embrulho(saida, "Situação da ocupação nas duas camadas.");
      }
      const saida = cobertura(args.situacao ? String(args.situacao) : undefined, args.prefixo ? String(args.prefixo) : undefined, undefined, Number(args.limite ?? 20), 0);
      return embrulho(saida, "Divergências entre CBO e QBQ. Ver D010 e D015.");
    }
    default:
      throw new Problema(400, "/v1/problemas/parametro-invalido", "Tool desconhecida", `Não há tool ${nome}.`);
  }
}

export const definicoes = [
  ["ocupacao_buscar", "Encontra ocupações pelo nome de mercado, cargo ou título.", { consulta: z.string().optional(), buscar_em: z.array(z.enum(["titulo", "sinonimo", "sintese"])).optional(), prefixo: z.string().optional(), nivel_qualificacao_min: z.number().int().min(1).max(8).optional(), nivel_qualificacao_max: z.number().int().min(1).max(8).optional(), situacao_qbq: z.enum(["classificada", "nao_classificada", "sem_nivel_sem_justificativa", "ausente_no_qbq"]).optional(), limite: z.number().int().min(1).max(50).optional() }],
  ["ocupacao_obter", "Ficha integrada de uma ocupação nas duas camadas.", { codigo: z.string(), incluir: z.array(z.enum(["sinonimos", "perfil_ocupacional", "resumo_atividades", "principais_competencias"])).optional() }],
  ["cbo_atividades", "O que a ocupação faz segundo a CBO. A sigla da área não é comparável entre ocupações e a numeração tem lacunas.", { codigo: z.string(), area: z.string().optional(), transversais: z.enum(["incluir", "excluir", "somente"]).optional(), modo: z.enum(["completo", "resumo"]).optional() }],
  ["qbq_competencias", "O que a ocupação exige segundo o QBQ. Ocupação não classificada devolve a justificativa oficial.", { codigo: z.string(), dimensao: z.enum(["conhecimentos", "habilidades", "atitudes"]).optional(), importancia_min: z.number().int().min(1).max(5).optional(), incluir_conceitos: z.boolean().optional(), limite: z.number().int().min(1).max(50).optional() }],
  ["cbo_navegar", "Percorre a classificação de cima para baixo.", { codigo: z.string().optional(), profundidade: z.number().int().min(1).max(2).optional() }],
  ["codigo_decodificar", "Valida e explica códigos CBO de qualquer nível, um ou vários.", { codigos: z.array(z.string()).min(1).max(100) }],
  ["qbq_vocabulario", "Navega os vocabulários do QBQ e devolve a definição oficial quando existe.", { vocabulario: z.enum(["conhecimentos-i", "conhecimentos-ii", "habilidades", "atitudes"]).optional(), nivel: z.string().optional(), codigo: z.string().optional(), incluir_uso: z.boolean().optional() }],
  ["dados_sobre", "Proveniência, versão, licença e limites do dataset.", { topico: z.enum(["versao", "fontes", "cobertura", "decisoes", "licenca"]).optional(), id: z.string().optional() }],
  ["cbo_buscar_atividades", "Acha ocupações pelo que se faz nelas. Por padrão exclui as áreas transversais Y e Z.", { consulta: z.string(), prefixo: z.string().optional(), nivel_qualificacao_min: z.number().int().optional(), nivel_qualificacao_max: z.number().int().optional(), transversais: z.enum(["incluir", "excluir", "somente"]).optional(), limite: z.number().int().min(1).max(50).optional() }],
  ["qbq_buscar_termos", "Acha termos de competência. O mesmo assunto pode existir nas duas taxonomias de conhecimento.", { consulta: z.string(), vocabularios: z.array(z.string()).optional(), buscar_em: z.array(z.enum(["vocabulario", "conceito", "descricao_item"])).optional(), limite: z.number().int().min(1).max(50).optional() }],
  ["qbq_ocupacoes_por_competencia", "Quais ocupações exigem um termo, e em que grau. Nó intermediário agrega descendentes.", { vocabulario: z.string(), nivel: z.string(), codigo: z.string(), importancia_min: z.number().int().optional(), frequencia_min: z.number().int().optional(), profundidade_min: z.number().int().optional(), prefixo: z.string().optional(), nivel_qualificacao_min: z.number().int().optional(), nivel_qualificacao_max: z.number().int().optional(), limite: z.number().int().min(1).max(50).optional() }],
  ["ocupacao_comparar", "Compara de duas a cinco ocupações. Cálculo derivado.", { codigos: z.array(z.string()).min(2).max(5), dimensao: z.string().optional(), importancia_min: z.number().int().optional() }],
  ["ocupacao_similares", "Ocupações com perfil de competências parecido. Cálculo derivado.", { codigo: z.string(), dimensao: z.string().optional(), escopo: z.enum(["todas", "mesma_familia", "mesmo_grande_grupo", "fora_da_familia"]).optional(), limite: z.number().int().min(1).max(50).optional() }],
  ["cbo_resumir_grupo", "Retrato agregado de um grupo ou do conjunto. Cálculo derivado.", { codigo: z.string().optional(), dimensao: z.string().optional(), limite: z.number().int().min(1).max(50).optional() }],
  ["cobertura_consultar", "Onde CBO e QBQ não coincidem, e por quê.", { codigo: z.string().optional(), situacao: z.enum(["so_cbo", "so_qbq", "titulo_divergente", "nao_classificada", "sem_nivel_sem_justificativa"]).optional(), prefixo: z.string().optional(), limite: z.number().int().min(1).max(50).optional() }],
] as const;

export { somenteLeitura };
