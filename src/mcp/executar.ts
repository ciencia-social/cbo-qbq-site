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
import { api, VERSAO_DADOS } from "@/versao";

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

function corte(saida: Saida): string {
  if (saida.total != null && saida.limite != null && saida.total > saida.limite) {
    return ` Mostrando ${saida.limite} de ${saida.total}.`;
  }
  const dados = saida.dados;
  if (dados && typeof dados === "object" && !Array.isArray(dados) && (dados as { truncado?: boolean }).truncado) {
    return " A lista foi cortada; aumente limite para ver o restante.";
  }
  return "";
}

function juntar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

function resumoNavegar(dados: unknown): string {
  if (Array.isArray(dados)) {
    const nomes = dados.slice(0, 3).map((no: { codigo: string; titulo: string }) => `${no.codigo} ${no.titulo}`);
    return `${dados.length} grandes grupos.\n${nomes.join("; ")}.`;
  }
  const no = dados as { codigo: string; titulo: string; nivel: string; total_ocupacoes: number; filhos?: unknown[] };
  return `${no.codigo} ${no.titulo} (${no.nivel}): ${no.filhos?.length ?? 0} filhos, ${no.total_ocupacoes} ocupações.`;
}

function resumoDecodificar(dados: unknown): string {
  const lote = dados as {
    validos?: number;
    invalidos?: number;
    itens?: { entrada: string; existe?: boolean; ancestral?: { nivel: string; codigo: string; titulo: string } | null }[];
  };
  const linhas = [`${lote.validos ?? 0} válidos, ${lote.invalidos ?? 0} inválidos.`];
  for (const item of lote.itens ?? []) {
    if (item.existe === false && item.ancestral) {
      const nivel = item.ancestral.nivel === "familia" ? "família" : item.ancestral.nivel;
      linhas.push(`${item.entrada} não existe; a ${nivel} ${item.ancestral.codigo} (${item.ancestral.titulo}) é o ancestral.`);
    }
  }
  return linhas.slice(0, 3).join("\n");
}

function resumoSobre(topico: string | undefined, dados: unknown): string {
  if (!topico || topico === "versao") {
    const versao = (dados as { versao_dados?: string }).versao_dados ?? VERSAO_DADOS;
    return `Dataset ${versao}.`;
  }
  if (topico === "fontes" && Array.isArray(dados)) return `${dados.length} fontes oficiais do dataset ${VERSAO_DADOS}.`;
  if (topico === "decisoes") {
    if (Array.isArray(dados)) return `${dados.length} decisões registradas.`;
    const decisao = dados as { id?: string; titulo?: string };
    return decisao.id ? `${decisao.id}: ${decisao.titulo}` : `Decisões do dataset ${VERSAO_DADOS}.`;
  }
  if (topico === "cobertura") return "CBO e QBQ divergem em 64 códigos. Nenhuma camada é corrigida.";
  if (topico === "licenca") return `Licença ${(dados as { nome?: string }).nome ?? ""}. Dataset ${VERSAO_DADOS}.`;
  return `Dataset ${VERSAO_DADOS}.`;
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
      return embrulho(saida, textoLista(`${saida.total} ocupações.${corte(saida)}`, itens));
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
      const dados = saida.dados as { total_atividades?: number; motivo?: string; areas?: unknown[] };
      return embrulho(saida, dados.motivo ?? `${dados.total_atividades} atividades em ${dados.areas?.length ?? 0} áreas. A sigla da área não se compara entre ocupações.`);
    }
    case "qbq_competencias": {
      const saida = competencias(String(args.codigo), {
        dimensao: args.dimensao as "conhecimentos" | "habilidades" | "atitudes" | undefined,
        importanciaMin: args.importancia_min as number | undefined,
        incluirConceitos: Boolean(args.incluir_conceitos),
        limite: Number(args.limite ?? 20),
      });
      const dados = saida.dados as {
        codigo: string;
        motivo?: string;
        conhecimentos?: { total: number };
        habilidades?: { total: number };
        atitudes?: { total: number };
      };
      if (dados.motivo) return embrulho(saida, `${dados.codigo}: sem competências classificadas. ${dados.motivo}`);
      const partes = [
        dados.conhecimentos ? `${dados.conhecimentos.total} conhecimentos` : "",
        dados.habilidades ? `${dados.habilidades.total} habilidades` : "",
        dados.atitudes ? `${dados.atitudes.total} atitudes` : "",
      ].filter(Boolean);
      return embrulho(saida, `${dados.codigo}: ${juntar(partes)}.${corte(saida)}`);
    }
    case "cbo_navegar": {
      const saida = arvore(args.codigo ? String(args.codigo) : undefined, Number(args.profundidade ?? 1));
      return embrulho(saida, resumoNavegar(saida.dados));
    }
    case "codigo_decodificar": {
      const codigos = (args.codigos as string[]) ?? [];
      if (codigos.length > 100) throw new Problema(400, api("/problemas/parametro-invalido"), "Parâmetro inválido", "A tool aceita até 100 códigos.");
      const saida = decodificar(codigos, "lote");
      return embrulho(saida, resumoDecodificar(saida.dados));
    }
    case "qbq_vocabulario": {
      if (!args.vocabulario) {
        const saida = vocabularios();
        const lista = saida.dados as { id: string }[];
        return embrulho(saida, `${lista.length} vocabulários: ${lista.map((item) => item.id).join(", ")}. Conhecimentos I e II não se misturam.`);
      }
      if (!args.codigo) {
        const saida = listarTermos(String(args.vocabulario), { nivel: args.nivel ? String(args.nivel) : undefined, formato: "plano", limite: 50, deslocamento: 0 });
        return embrulho(saida, `${saida.total} termos de ${args.vocabulario}${args.nivel ? `/${String(args.nivel)}` : ""}.${corte(saida)}`);
      }
      const saida = obterTermo(String(args.vocabulario), args.nivel ? String(args.nivel) : undefined, String(args.codigo), Boolean(args.incluir_uso));
      const termo = saida.dados as { codigo: string; nivel: string; descricao: string; filhos?: unknown[] };
      return embrulho(saida, `${termo.codigo} (${termo.nivel}): ${termo.descricao}. ${termo.filhos?.length ?? 0} filhos.`);
    }
    case "dados_sobre": {
      const topico = args.topico ? String(args.topico) : undefined;
      const saida = sobre(topico, args.id ? String(args.id) : undefined);
      return embrulho(saida, resumoSobre(topico, saida.dados));
    }
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
      const itens = saida.dados as { codigo: string; titulo_cbo?: string | null }[];
      return embrulho(saida, textoLista(`${saida.total} ocupações pela tarefa. Áreas Y e Z ficam de fora no padrão.${corte(saida)}`, itens));
    }
    case "qbq_buscar_termos": {
      const saida = buscarTermos({
        q: String(args.consulta ?? ""),
        vocabularios: args.vocabularios as string[] | undefined,
        buscarEm: (args.buscar_em as string[]) ?? ["vocabulario", "conceito"],
        limite: Number(args.limite ?? 10),
      });
      const dados = saida.dados as { total_termos?: number; total_descricoes_item?: number; descricoes_item?: unknown[] };
      const termos = dados.total_termos ?? 0;
      const descricoes = dados.total_descricoes_item ?? dados.descricoes_item?.length;
      const contagem = descricoes == null ? `${termos} termos.` : `${termos} termos e ${descricoes} ocorrências em descrições de item.`;
      return embrulho(saida, `${contagem} Um assunto pode existir nas duas taxonomias de conhecimento com códigos diferentes.${corte(saida)}`);
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
      return embrulho(saida, `${saida.total} ocupações exigem ${args.codigo}.${corte(saida)}`);
    }
    case "ocupacao_comparar": {
      const saida = comparar((args.codigos as string[]) ?? [], String(args.dimensao ?? "habilidades"), args.importancia_min as number | undefined);
      const dados = saida.dados as {
        comparavel: boolean;
        ocupacoes: { codigo: string }[];
        em_comum: unknown[];
        similaridade: { similaridade: number | null }[];
      };
      const similaridade = dados.similaridade[0]?.similaridade;
      const texto = dados.comparavel
        ? `${dados.ocupacoes.map((item) => item.codigo).join(" e ")}: ${dados.em_comum.length} termos em comum${similaridade != null ? `, similaridade ${similaridade}` : ""}. Cálculo derivado.`
        : "Comparação não calculada: as ocupações usam taxonomias de conhecimento diferentes.";
      return embrulho(saida, texto);
    }
    case "ocupacao_similares": {
      const saida = similares(String(args.codigo), String(args.dimensao ?? "habilidades"), String(args.escopo ?? "todas"), Number(args.limite ?? 10));
      const dados = saida.dados as { codigo: string; termos_origem: number; similares: { codigo: string; similaridade: number }[] };
      const primeira = dados.similares[0];
      const texto = primeira
        ? `${dados.codigo}: ${saida.total} ocupações parecidas, sobre ${dados.termos_origem} termos. A mais próxima é ${primeira.codigo} (${primeira.similaridade}). Cálculo derivado.`
        : `${dados.codigo}: nenhuma ocupação parecida. Cálculo derivado.`;
      return embrulho(saida, texto);
    }
    case "cbo_resumir_grupo": {
      const saida = resumoGrupo(args.codigo ? String(args.codigo) : undefined, String(args.dimensao ?? "habilidades"), Number(args.limite ?? 10));
      const dados = saida.dados as { codigo: string | null; titulo: string | null; total_ocupacoes: number; termos_que_distinguem: { termo: string | null }[] };
      const destaque = dados.termos_que_distinguem[0]?.termo;
      return embrulho(saida, `${dados.codigo ?? "conjunto"} ${dados.titulo ?? ""}: ${dados.total_ocupacoes} ocupações.${destaque ? ` O termo que mais distingue é ${destaque}.` : ""} Cálculo derivado.`.replace(/\s+/g, " ").trim());
    }
    case "cobertura_consultar": {
      if (!args.codigo && !args.situacao && !args.prefixo) {
        const saida = coberturaResumo();
        const dados = saida.dados as { por_divergencia: { so_cbo: number; so_qbq: number; titulo_divergente: number } };
        return embrulho(saida, `${dados.por_divergencia.so_cbo} só na CBO, ${dados.por_divergencia.so_qbq} só no QBQ e ${dados.por_divergencia.titulo_divergente} com título divergente.`);
      }
      if (args.situacao === "nao_classificada" || args.situacao === "sem_nivel_sem_justificativa") {
        const saida = args.situacao === "nao_classificada"
          ? naoClassificadas(undefined, args.prefixo ? String(args.prefixo) : undefined, Number(args.limite ?? 20), 0)
          : listarOcupacoes({ situacaoQbq: "sem_nivel_sem_justificativa", buscarEm: ["titulo"], limite: Number(args.limite ?? 20), deslocamento: 0, prefixo: args.prefixo ? String(args.prefixo) : undefined });
        return embrulho(saida, `${saida.total} ocupações sem nível no QBQ.${corte(saida)}`);
      }
      if (args.codigo) {
        const saida = obterOcupacao(String(args.codigo));
        const ficha = saida.dados as { codigo: string; situacao_qbq: string; divergencia?: string | null };
        return embrulho(saida, `${ficha.codigo}: situação ${ficha.situacao_qbq}${ficha.divergencia ? `, divergência ${ficha.divergencia}` : ""}.`);
      }
      const saida = cobertura(args.situacao ? String(args.situacao) : undefined, args.prefixo ? String(args.prefixo) : undefined, undefined, Number(args.limite ?? 20), 0);
      return embrulho(saida, `${saida.total} divergências entre CBO e QBQ. Ver D010 e D015.${corte(saida)}`);
    }
    default:
      throw new Problema(400, api("/problemas/parametro-invalido"), "Tool desconhecida", `Não há tool ${nome}.`);
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
