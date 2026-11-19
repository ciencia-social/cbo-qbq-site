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
import { exigirTetoConsulta, faixaDeParams, TETO } from "@/http/parametros";
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

const ORIGEM = "https://cbo.ciencia.social";
const ROTAS: [RegExp, string][] = [
  [/\/api\/v1\/atividades\b[^)\s]*/g, "cbo_buscar_atividades"],
  [/\/api\/v1\/decisoes\/[A-Za-z0-9]+/g, "dados_sobre"],
  [/\/api\/v1\/ocupacoes\/\d+\/atividades\b[^)\s]*/g, "cbo_atividades"],
  [/\/api\/v1\/ocupacoes\/\d+\/competencias\b[^)\s]*/g, "qbq_competencias"],
  [/\/api\/v1\/ocupacoes\/\d+\/similares\b[^)\s]*/g, "ocupacao_similares"],
  [/\/api\/v1\/ocupacoes\/\d+\b[^)\s]*/g, "ocupacao_obter"],
  [/\/api\/v1\/cbo\/[a-z0-9-]+\/\d+\b[^)\s]*/g, "cbo_navegar"],
  [/\/api\/v1\/cbo\/grandes-grupos\b[^)\s]*/g, "cbo_navegar"],
  [/\/api\/v1\/qbq\/vocabularios\/\S+/g, "qbq_vocabulario"],
  [/\/api\/v1\/cobertura\S*/g, "cobertura_consultar"],
  [/\/api\/v1\/sinonimos\S*/g, "ocupacao_buscar"],
  [/\/api\/v1\/codigos\S*/g, "codigo_decodificar"],
];

export function textoMcp(texto: string) {
  let saida = texto;
  for (const [padrao, tool] of ROTAS) saida = saida.replace(padrao, tool);
  return saida.replace(/\/api\/v1\/[^\s)"']+/g, (caminho) => `${ORIGEM}${caminho}`);
}

function preparar(valor: unknown, chave?: string): unknown {
  if (typeof valor === "string") {
    const prosa = chave === "mensagem" || chave === "detalhe" || chave === "dica" || chave === "texto";
    if (prosa) return textoMcp(valor);
    if (valor.startsWith("/")) return `${ORIGEM}${valor}`;
    return valor;
  }
  if (Array.isArray(valor)) return valor.map((item) => preparar(item));
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor as Record<string, unknown>).map(([nome, item]) => [nome, preparar(item, nome)]));
  }
  return valor;
}

/** Envelope do MCP: versão, avisos, derivado e resultado, com links absolutos. Serve às tools e aos resources. */
export function embrulho(saida: Saida, texto: string): ResultadoTool {
  const total = saida.total;
  const limite = saida.limite;
  const avisos = [...(saida.avisos ?? [])];
  const cortado = (total != null && limite != null && total > limite) || temTruncado(saida.dados);
  if (cortado && !avisos.some((aviso) => aviso.mensagem.includes("restante"))) {
    const quanto = total != null && limite != null && total > limite ? `Mostrando ${limite} de ${total}. ` : "";
    avisos.push({
      mensagem: `${quanto}A lista foi cortada. Aumente limite (máximo 50) ou peça o restante.`,
    });
  }
  const pronto = preparar({
    texto,
    dados: {
      versao_dados: VERSAO_DADOS,
      avisos,
      derivado: saida.derivado === true,
      ...(saida.metodo ? { metodo: saida.metodo } : {}),
      ...(total != null ? { total } : {}),
      resultado: saida.dados,
    },
  }) as ResultadoTool;
  const vistos = new Set<string>();
  const lista = pronto.dados.avisos as { mensagem: string }[];
  pronto.dados.avisos = lista.filter((aviso) => {
    if (vistos.has(aviso.mensagem)) return false;
    vistos.add(aviso.mensagem);
    return true;
  });
  return pronto;
}

function textoLista(prefixo: string, itens: { codigo?: string; titulo_cbo?: string | null; titulo?: string | null }[]) {
  const linhas = itens.slice(0, 5).map((item) => `${item.codigo ?? ""} ${item.titulo_cbo ?? item.titulo ?? ""}`.trim());
  return [prefixo, ...linhas].filter(Boolean).join("\n");
}

function ordenarGraus(dados: unknown) {
  const corpo = dados as {
    ocupacoes?: { codigo: string; caminho?: { codigo: string }[] | string[] }[];
    em_comum?: { graus: Record<string, Record<string, unknown>> }[];
    exclusivos?: Record<string, { graus: Record<string, Record<string, unknown>> }[]>;
  };
  for (const ocupacao of corpo.ocupacoes ?? []) {
    const caminho = ocupacao.caminho;
    if (caminho?.length && typeof caminho[0] === "object") {
      ocupacao.caminho = (caminho as { codigo: string }[]).map((passo) => passo.codigo);
    }
  }
  const ordem = corpo.ocupacoes?.map((item) => item.codigo) ?? [];
  const converter = (item: { graus: Record<string, Record<string, unknown>> }) => {
    (item as { graus: unknown }).graus = ordem.filter((codigo) => item.graus[codigo]).map((codigo) => ({ codigo, ...item.graus[codigo] }));
  };
  for (const item of corpo.em_comum ?? []) converter(item);
  for (const lista of Object.values(corpo.exclusivos ?? {})) for (const item of lista) converter(item);
}

function enxugarGraus(dados: unknown) {
  const corpo = dados as { em_comum?: { graus?: Record<string, Record<string, unknown>> }[]; exclusivos?: Record<string, { graus?: Record<string, Record<string, unknown>> }[]> };
  const listas = [...(corpo.em_comum ?? []), ...Object.values(corpo.exclusivos ?? {}).flat()];
  for (const item of listas) {
    for (const grau of Object.values(item.graus ?? {})) {
      for (const chave of Object.keys(grau)) if (grau[chave] == null) delete grau[chave];
    }
  }
}

/** Padrão de itens por dimensão em qbq_competencias. Com 15, a ficha de 212405 fica perto de 11 KB (I10). */
const LIMITE_COMPETENCIAS = 15;

/**
 * No modo resumido, o arquivo de origem é o mesmo em todos os itens de uma dimensão.
 * Ele sobe uma vez para o bloco (bloco.fonte.arquivo); cada item mantém fonte.aba e fonte.linha.
 */
function arquivoNoBloco(dados: unknown) {
  const corpo = dados as Record<string, { itens?: { fonte?: { arquivo?: string } | null }[]; fonte?: unknown } | undefined>;
  for (const dimensao of ["conhecimentos", "habilidades", "atitudes"]) {
    const bloco = corpo[dimensao];
    if (!bloco?.itens?.length) continue;
    const arquivos = new Set(bloco.itens.map((item) => item.fonte?.arquivo).filter(Boolean));
    if (arquivos.size !== 1) continue;
    const [arquivo] = arquivos;
    corpo[dimensao] = { ...bloco, fonte: { arquivo } };
    for (const item of bloco.itens) if (item.fonte) delete item.fonte.arquivo;
  }
}

function temTruncado(valor: unknown): boolean {
  if (!valor || typeof valor !== "object") return false;
  if (Array.isArray(valor)) return valor.some(temTruncado);
  const registro = valor as Record<string, unknown>;
  if (registro.truncado === true) return true;
  return Object.values(registro).some(temTruncado);
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
  if (typeof args.consulta === "string") exigirTetoConsulta(args.consulta, "consulta");
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
        saida.avisos = [{ mensagem: "Sem resultado. Tente um termo mais curto ou use cbo_buscar_atividades para buscar pela tarefa." }];
      }
      const itens = saida.dados as { codigo: string; titulo_cbo: string | null }[];
      return embrulho(saida, textoLista(`${saida.total} ocupações.${corte(saida)}`, itens));
    }
    case "ocupacao_obter": {
      const incluir = (args.incluir as string[]) ?? ["sinonimos"];
      const principais = incluir.includes("principais_competencias");
      const saida = obterOcupacao(String(args.codigo), {
        perfil: incluir.includes("perfil_ocupacional"),
        atividades: incluir.includes("resumo_atividades") ? "resumo" : incluir.includes("atividades"),
        competencias: principais ? "principais" : incluir.includes("competencias"),
        ...(principais ? { detalhe: args.detalhe === "completo" ? "completo" as const : "resumido" as const } : {}),
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
      const completo = args.detalhe === "completo" || Boolean(args.incluir_conceitos);
      const saida = competencias(String(args.codigo), {
        dimensao: args.dimensao as "conhecimentos" | "habilidades" | "atitudes" | undefined,
        importanciaMin: args.importancia_min as number | undefined,
        incluirConceitos: completo,
        detalhe: completo ? "completo" : "resumido",
        limite: Number(args.limite ?? LIMITE_COMPETENCIAS),
      });
      if (!completo) arquivoNoBloco(saida.dados);
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
      const pedido = Number(args.limite ?? 20);
      const limite = Math.min(50, Math.max(1, Number.isFinite(pedido) ? pedido : 20));
      const codigos = (args.codigos as string[]) ?? [];
      const saida = comparar(codigos, String(args.dimensao ?? "habilidades"), args.importancia_min as number | undefined, limite);
      enxugarGraus(saida.dados);
      ordenarGraus(saida.dados);
      const dados = saida.dados as {
        comparavel: boolean;
        ocupacoes: { codigo: string }[];
        em_comum: unknown[];
        total_em_comum?: number;
        similaridade: { similaridade: number | null }[];
      };
      const similaridade = dados.similaridade[0]?.similaridade;
      const emComum = dados.total_em_comum ?? dados.em_comum.length;
      const texto = dados.comparavel
        ? `${dados.ocupacoes.map((item) => item.codigo).join(" e ")}: ${emComum} termos em comum${similaridade != null ? `, similaridade ${similaridade}` : ""}. Cálculo derivado.`
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

const codigoCurto = () => z.string().max(TETO.codigo, `No máximo ${TETO.codigo} caracteres.`);
const textoConsulta = () => z.string().max(TETO.consultaCaracteres, `No máximo ${TETO.consultaCaracteres} caracteres e ${TETO.consultaTermos} termos.`);
const codigoOcupacao = () => codigoCurto().describe("Código CBO de 6 dígitos, com ou sem hífen: 212405 ou 2124-05.");
const prefixoCbo = () => codigoCurto().optional().describe("Código de 1 a 4 dígitos que restringe a um ramo da CBO, como 2 ou 2124.");
const limiteItens = (padrao: number) => z.number().int().min(1).max(50).optional().describe(`Quantos itens devolver. Padrão ${padrao}, máximo 50. Exemplo: ${padrao}.`);
const nivelQualificacao = (lado: "mínimo" | "máximo") =>
  z.number().int().min(1).max(8).optional().describe(`Nível de qualificação do QBQ, de 1 a 8, no extremo ${lado} da faixa. Exemplo: ${lado === "mínimo" ? 1 : 8}.`);
const grauMinimo = (nome: string) => z.number().int().min(1).max(5).optional().describe(`Só itens com ${nome} a partir deste grau, de 1 a 5. Exemplo: 4.`);
const REGRA_CONSULTA = "Cada palavra casa inteira; a última casa por prefixo se tiver 3 letras ou mais.";
const NIVEL_TERMO = "Nível do termo no vocabulário. conhecimentos-i: dominios, areas, campos, conhecimentos. conhecimentos-ii: areas, campos, conhecimentos, elementos. habilidades: dominios, categorias, habilidades. atitudes: categorias, atitudes. Exemplo: habilidades.";

function dimensaoComparavel() {
  return z.enum(["habilidades", "atitudes", "conhecimentos", "conhecimentos-i", "conhecimentos-ii"]).optional().describe("Dimensão do perfil. Aceita habilidades, atitudes, conhecimentos, conhecimentos-i ou conhecimentos-ii. Padrão: habilidades. Exemplo: habilidades.");
}

export type Definicao = {
  nome: string;
  title: string;
  descricao: string;
  schema: z.ZodRawShape;
};

export const definicoes: Definicao[] = [
  {
    nome: "ocupacao_buscar",
    title: "Buscar ocupação",
    descricao: "Encontra ocupações por texto livre, do nome de mercado, cargo ou título de vaga ao código oficial. É a porta de entrada quando o código ainda não é conhecido. Devolve o total e uma lista com código, títulos, família, nível e situação no QBQ. Sem resultado, o próximo passo é cbo_buscar_atividades.",
    schema: {
      consulta: textoConsulta().optional().describe(`Texto a buscar no título, no sinônimo ou na síntese. ${REGRA_CONSULTA} Exemplo: programador.`),
      buscar_em: z.array(z.enum(["titulo", "sinonimo", "sintese"])).optional().describe("Onde casar o texto. Aceita titulo, sinonimo e sintese. Padrão: titulo e sinonimo. Exemplo: [\"titulo\", \"sinonimo\"]."),
      prefixo: prefixoCbo(),
      nivel_qualificacao_min: nivelQualificacao("mínimo"),
      nivel_qualificacao_max: nivelQualificacao("máximo"),
      situacao_qbq: z.enum(["classificada", "nao_classificada", "sem_nivel_sem_justificativa", "ausente_no_qbq"]).optional().describe("Situação da ocupação no QBQ. Exemplo: classificada."),
      limite: limiteItens(10),
    },
  },
  {
    nome: "ocupacao_obter",
    title: "Ficha da ocupação",
    descricao: "Ficha integrada de uma ocupação nas duas camadas, para quando o código já é conhecido. Devolve o caminho hierárquico, os blocos CBO e QBQ, a situação e as contagens. Use incluir para pedir o perfil, o resumo das atividades ou as principais competências. Para o detalhe, siga para cbo_atividades ou qbq_competencias.",
    schema: {
      codigo: codigoOcupacao(),
      incluir: z.array(z.enum(["sinonimos", "perfil_ocupacional", "resumo_atividades", "principais_competencias"])).optional().describe("Blocos extras da ficha. perfil_ocupacional é texto longo; resumo_atividades traz só as áreas; principais_competencias traz os itens de maior importância. Padrão: sinonimos. Exemplo: [\"sinonimos\"]."),
      detalhe: z.enum(["resumido", "completo"]).optional().describe("completo devolve caminho e conceito das principais competências. Padrão: resumido. Exemplo: completo."),
    },
  },
  {
    nome: "cbo_atividades",
    title: "Atividades da ocupação",
    descricao: "O que a ocupação faz segundo a CBO: grandes áreas e as atividades de cada uma. A sigla da área ordena o perfil dentro da ocupação e não é comparável entre ocupações. A numeração das atividades é a da fonte, com lacunas e repetições. Ocupação sem perfil devolve o motivo, não uma lista vazia.",
    schema: {
      codigo: codigoOcupacao(),
      area: codigoCurto().optional().describe("Sigla de uma área, para detalhar só ela. A sigla não se compara entre ocupações. Exemplo: A."),
      transversais: z.enum(["incluir", "excluir", "somente"]).optional().describe("O que fazer com as áreas transversais Y e Z. Padrão: incluir. Exemplo: excluir."),
      modo: z.enum(["completo", "resumo"]).optional().describe("completo lista as atividades; resumo devolve só as áreas e a contagem. Padrão: completo. Exemplo: resumo."),
    },
  },
  {
    nome: "qbq_competencias",
    title: "Competências da ocupação",
    descricao: "O que a ocupação exige segundo o QBQ: conhecimentos, habilidades e atitudes, com seus graus. Devolve os níveis da ocupação, a taxonomia de conhecimento e os itens ordenados por importância. Ocupação não classificada devolve a justificativa oficial, não uma lista vazia. Conhecimentos I e II são taxonomias distintas e não se misturam.",
    schema: {
      codigo: codigoOcupacao(),
      dimensao: z.enum(["conhecimentos", "habilidades", "atitudes"]).optional().describe("Qual dimensão devolver. Ausente: as três. Exemplo: habilidades."),
      importancia_min: grauMinimo("importância"),
      incluir_conceitos: z.boolean().optional().describe("Inclui a definição oficial de cada habilidade e o caminho do termo. Padrão: false. Exemplo: true."),
      detalhe: z.enum(["resumido", "completo"]).optional().describe("completo devolve caminho e conceito de cada item. Equivale a incluir_conceitos. No resumido, o arquivo de origem vem uma vez no bloco da dimensão, e cada item traz a aba e a linha. Padrão: resumido. Exemplo: completo."),
      limite: z.number().int().min(1).max(50).optional().describe("Quantos itens devolver por dimensão, os de maior importância. Padrão 15, máximo 50. Exemplo: 15."),
    },
  },
  {
    nome: "cbo_navegar",
    title: "Navegar a classificação",
    descricao: "Percorre a CBO de cima para baixo. Sem código, lista os dez grandes grupos; com 1 a 4 dígitos, devolve o nó e os filhos diretos. Em família, os filhos são as ocupações, com nível de qualificação. Para uma ocupação de 6 dígitos, use ocupacao_obter.",
    schema: {
      codigo: codigoCurto().optional().describe("Código de 1 a 4 dígitos do nó. Ausente: os dez grandes grupos. Exemplo: 2124."),
      profundidade: z.number().int().min(1).max(2).optional().describe("Quantos níveis de filhos devolver de uma vez, 1 ou 2. Padrão: 1. Exemplo: 1."),
    },
  },
  {
    nome: "codigo_decodificar",
    title: "Decodificar código",
    descricao: "Valida e explica códigos CBO de qualquer nível, um ou vários. Use antes de citar um código e para conferir listas vindas de bases como RAIS e CAGED. Devolve existência, nível, título e caminho. Para um código inexistente, devolve o ancestral mais profundo que existe e os filhos dele.",
    schema: {
      codigos: z.array(codigoCurto()).min(1).max(100).describe("De 1 a 100 códigos, de 1 a 6 dígitos, com ou sem hífen. Exemplo: [\"212405\", \"2124-99\"]."),
    },
  },
  {
    nome: "qbq_vocabulario",
    title: "Vocabulário do QBQ",
    descricao: "Navega os vocabulários controlados do QBQ e devolve a definição oficial de um termo quando ela existe. Sem vocabulário, descreve os quatro; sem código, lista os termos; com código, devolve o termo, o caminho e os filhos. Conhecimentos I e II não se misturam: o resultado de uma taxonomia não vale para a outra.",
    schema: {
      vocabulario: z.enum(["conhecimentos-i", "conhecimentos-ii", "habilidades", "atitudes"]).optional().describe("Qual vocabulário. Ausente: descreve os quatro. Exemplo: habilidades."),
      nivel: codigoCurto().optional().describe(NIVEL_TERMO),
      codigo: codigoCurto().optional().describe("Código do termo, como 01.01.01. Ausente: lista o vocabulário. Exemplo: 01.01.01."),
      incluir_uso: z.boolean().optional().describe("Acrescenta em quantas ocupações o termo é exigido. É cálculo derivado. Padrão: false. Exemplo: false."),
    },
  },
  {
    nome: "dados_sobre",
    title: "Sobre os dados",
    descricao: "Proveniência, versão, licença e limites do dataset. Use quando a pergunta for sobre origem, data, confiabilidade, licença ou citação. Devolve a versão de cada camada, as fontes, a licença CC BY 4.0 e as ressalvas que mais afetam a interpretação. Com o tópico decisoes, informe o id, como D015.",
    schema: {
      topico: z.enum(["versao", "fontes", "cobertura", "decisoes", "licenca"]).optional().describe("O que perguntar sobre o dataset. Ausente: a versão. Exemplo: fontes."),
      id: codigoCurto().optional().describe("Identificador de uma decisão, quando o tópico é decisoes. Exemplo: D015."),
    },
  },
  {
    nome: "cbo_buscar_atividades",
    title: "Buscar por atividade",
    descricao: "Acha ocupações pelo que se faz nelas, no texto das atividades e dos nomes de área. Por padrão exclui as áreas transversais Y e Z, para que competências pessoais não dominem o resultado. Devolve uma entrada por ocupação, com o total de atividades casadas e até três exemplos. Use quando ocupacao_buscar não achar o nome.",
    schema: {
      consulta: textoConsulta().describe(`Texto da tarefa a buscar. ${REGRA_CONSULTA} Exemplo: programar.`),
      prefixo: prefixoCbo(),
      nivel_qualificacao_min: nivelQualificacao("mínimo"),
      nivel_qualificacao_max: nivelQualificacao("máximo"),
      transversais: z.enum(["incluir", "excluir", "somente"]).optional().describe("O que fazer com as áreas transversais Y e Z. Padrão: excluir. Exemplo: excluir."),
      limite: limiteItens(10),
    },
  },
  {
    nome: "qbq_buscar_termos",
    title: "Buscar termo",
    descricao: "Acha termos de competência por texto, nos vocabulários, nos conceitos e nas descrições dos baldes. O mesmo assunto pode existir nas duas taxonomias de conhecimento com códigos diferentes, e o resultado de uma não vale para a outra. Devolve os termos e, quando pedido, as ocorrências em descrição de item. O próximo passo é qbq_ocupacoes_por_competencia.",
    schema: {
      consulta: textoConsulta().describe(`Texto do termo ou do assunto. ${REGRA_CONSULTA} Exemplo: banco de dados.`),
      vocabularios: z.array(codigoCurto()).max(TETO.vocabularios, `No máximo ${TETO.vocabularios} vocabulários.`).optional().describe("Quais vocabulários percorrer. Padrão: os quatro. Exemplo: [\"habilidades\"]."),
      buscar_em: z.array(z.enum(["vocabulario", "conceito", "descricao_item"])).optional().describe("Onde casar o texto. Padrão: vocabulario e conceito. descricao_item alcança o texto livre dos baldes. Exemplo: [\"vocabulario\", \"conceito\"]."),
      limite: limiteItens(10),
    },
  },
  {
    nome: "qbq_ocupacoes_por_competencia",
    title: "Ocupações por competência",
    descricao: "Quais ocupações exigem um termo, e em que grau. Obtenha vocabulário, nível e código com qbq_buscar_termos. Um nó intermediário agrega os descendentes e diz quantos itens casaram. Devolve o total de ocupações distintas, a distribuição e a lista com os graus. Use prefixo para restringir a um ramo da CBO.",
    schema: {
      vocabulario: z.enum(["conhecimentos-i", "conhecimentos-ii", "habilidades", "atitudes"]).describe("Vocabulário do termo. Exemplo: conhecimentos-i."),
      nivel: codigoCurto().describe(NIVEL_TERMO),
      codigo: codigoCurto().describe("Código do termo no nível informado, como 01.01.02. Exemplo: 01.01.02."),
      importancia_min: grauMinimo("importância"),
      frequencia_min: grauMinimo("frequência"),
      profundidade_min: grauMinimo("profundidade"),
      prefixo: prefixoCbo(),
      nivel_qualificacao_min: nivelQualificacao("mínimo"),
      nivel_qualificacao_max: nivelQualificacao("máximo"),
      limite: limiteItens(20),
    },
  },
  {
    nome: "ocupacao_comparar",
    title: "Comparar ocupações",
    descricao: "Compara de duas a cinco ocupações, para uma transição de carreira ou para distinguir ocupações vizinhas. O primeiro código é a origem e os demais são destinos; a diferença de graus é destino menos origem. É cálculo derivado, não dado oficial. Entre taxonomias de conhecimento diferentes, a similaridade não é calculada.",
    schema: {
      codigos: z.array(codigoCurto()).min(2).max(5).describe("De 2 a 5 códigos de ocupação, com ou sem hífen. Exemplo: [\"212420\", \"212405\"]."),
      dimensao: dimensaoComparavel(),
      importancia_min: grauMinimo("importância"),
      limite: z.number().int().min(1).max(50).optional().describe("Quantos termos em comum e exclusivos devolver, ordenados pela maior diferença de importância. Padrão 20, máximo 50. Exemplo: 20."),
    },
  },
  {
    nome: "ocupacao_similares",
    title: "Ocupações parecidas",
    descricao: "Ocupações com perfil de competências parecido, pelo índice de Jaccard, sem os baldes. É cálculo derivado, não dado oficial. Habilidades é o vocabulário comum a todas as ocupações; conhecimentos só se comparam dentro da mesma taxonomia. Devolve similaridade, termos em comum e termos exclusivos de cada lado.",
    schema: {
      codigo: codigoOcupacao(),
      dimensao: dimensaoComparavel(),
      escopo: z.enum(["todas", "mesma_familia", "mesmo_grande_grupo", "fora_da_familia"]).optional().describe("Onde procurar as parecidas. Padrão: todas. Exemplo: mesma_familia."),
      limite: limiteItens(10),
    },
  },
  {
    nome: "cbo_resumir_grupo",
    title: "Resumir grupo",
    descricao: "Retrato agregado de um grande grupo, subgrupo principal, subgrupo ou família, ou do conjunto inteiro quando o código falta. Devolve o total de ocupações, a situação no QBQ, a distribuição dos níveis e os termos que distinguem o grupo do conjunto. É cálculo derivado, não dado oficial.",
    schema: {
      codigo: codigoCurto().optional().describe("Código de 1 a 4 dígitos do grupo. Ausente: o conjunto inteiro. Exemplo: 2124."),
      dimensao: dimensaoComparavel(),
      limite: limiteItens(10),
    },
  },
  {
    nome: "cobertura_consultar",
    title: "Consultar cobertura",
    descricao: "Onde CBO e QBQ não coincidem, e por quê. Sem argumentos, devolve as contagens; com código, a situação de uma ocupação; com situacao, a lista daquele tipo. A resposta aponta D010 e D015. Nenhuma camada é corrigida quando as fontes divergem.",
    schema: {
      codigo: codigoCurto().optional().describe("Código de uma ocupação, para ver a situação dela nas duas camadas. Exemplo: 212405."),
      situacao: z.enum(["so_cbo", "so_qbq", "titulo_divergente", "nao_classificada", "sem_nivel_sem_justificativa"]).optional().describe("Qual divergência listar. Exemplo: titulo_divergente."),
      prefixo: prefixoCbo(),
      limite: limiteItens(20),
    },
  },
];

export { somenteLeitura };
