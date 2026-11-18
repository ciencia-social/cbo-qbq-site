import { todos } from "@/dados/banco";
import { normalizarArquivo, type Fonte } from "@/tipos";

export type NoCbo = {
  nivel: string;
  codigo: string;
  titulo: string;
  pai: string | null;
  fonte_arquivo: string | null;
  fonte_linha: number | null;
  titulo_busca: string;
  ordem: number;
};

export type OcupacaoLista = {
  codigo: string;
  codigo_formatado: string;
  titulo_cbo: string | null;
  titulo_qbq: string | null;
  familia: string;
  situacao_qbq: string;
  divergencia: string | null;
  nivel_conhecimento: number | null;
  nivel_habilidade: number | null;
  nivel_atitude: number | null;
  nivel_qualificacao: number | null;
  taxonomia_conhecimento: string | null;
  n_sinonimos: number;
  n_areas: number;
  n_atividades: number;
  n_conhecimentos: number;
  n_habilidades: number;
  n_atitudes: number;
  titulo_cbo_busca: string | null;
  titulo_qbq_busca: string | null;
  sintese_busca: string | null;
  fonte_cbo_arquivo: string | null;
  fonte_cbo_linha: number | null;
  fonte_qbq_arquivo: string | null;
  fonte_qbq_aba: string | null;
  fonte_qbq_linha: number | null;
};

export type SinonimoRow = {
  ocupacao: string;
  sinonimo: string;
  fonte_arquivo: string | null;
  fonte_linha: number | null;
  busca: string;
  ordem: number;
};

export type TermoRow = {
  vocabulario: string;
  nivel: string;
  codigo: string;
  descricao: string;
  pai: string | null;
  nivel_pai: string | null;
  balde: number;
  busca: string;
  fonte_arquivo: string | null;
  ordem: number;
};

export type ConceitoRow = {
  vocabulario: string;
  nivel: string;
  codigo: string;
  termo: string;
  conceito: string;
  fonte_arquivo: string;
  busca_termo: string;
  busca_conceito: string;
};

type Memoria = {
  nos: Map<string, NoCbo>;
  nosPorNivel: Map<string, NoCbo[]>;
  ocupacoes: OcupacaoLista[];
  ocupacao: Map<string, OcupacaoLista>;
  sinonimos: SinonimoRow[];
  sinonimosPor: Map<string, SinonimoRow[]>;
  termos: Map<string, TermoRow>;
  termosPorCodigo: Map<string, TermoRow[]>;
  filhos: Map<string, TermoRow[]>;
  conceitos: Map<string, ConceitoRow>;
  divergencias: Map<string, { termo_pdf: string | null; termo_planilha: string | null }>;
};

let memoria: Memoria | undefined;

function chave(a: string, b: string, c?: string) {
  return c == undefined ? `${a}|${b}` : `${a}|${b}|${c}`;
}

function carregar(): Memoria {
  if (memoria) return memoria;
  const nos = new Map<string, NoCbo>();
  const nosPorNivel = new Map<string, NoCbo[]>();
  for (const no of todos<NoCbo>("SELECT * FROM cbo_no ORDER BY ordem")) {
    nos.set(chave(no.nivel, no.codigo), no);
    const lista = nosPorNivel.get(no.nivel) ?? [];
    lista.push(no);
    nosPorNivel.set(no.nivel, lista);
  }
  const ocupacoes = todos<OcupacaoLista>(
    `SELECT codigo, codigo_formatado, titulo_cbo, titulo_qbq, familia, situacao_qbq, divergencia,
            nivel_conhecimento, nivel_habilidade, nivel_atitude, nivel_qualificacao, taxonomia_conhecimento,
            n_sinonimos, n_areas, n_atividades, n_conhecimentos, n_habilidades, n_atitudes,
            titulo_cbo_busca, titulo_qbq_busca, sintese_busca,
            fonte_cbo_arquivo, fonte_cbo_linha, fonte_qbq_arquivo, fonte_qbq_aba, fonte_qbq_linha
     FROM ocupacao ORDER BY codigo`,
  );
  const ocupacao = new Map(ocupacoes.map((item) => [item.codigo, item]));
  const sinonimos = todos<SinonimoRow>("SELECT * FROM sinonimo ORDER BY ordem");
  const sinonimosPor = new Map<string, SinonimoRow[]>();
  for (const sinonimo of sinonimos) {
    const lista = sinonimosPor.get(sinonimo.ocupacao) ?? [];
    lista.push(sinonimo);
    sinonimosPor.set(sinonimo.ocupacao, lista);
  }
  const termos = new Map<string, TermoRow>();
  const termosPorCodigo = new Map<string, TermoRow[]>();
  const filhos = new Map<string, TermoRow[]>();
  for (const termo of todos<TermoRow>("SELECT * FROM termo ORDER BY ordem")) {
    termos.set(chave(termo.vocabulario, termo.nivel, termo.codigo), termo);
    const porCodigo = termosPorCodigo.get(chave(termo.vocabulario, termo.codigo)) ?? [];
    porCodigo.push(termo);
    termosPorCodigo.set(chave(termo.vocabulario, termo.codigo), porCodigo);
    if (termo.pai && termo.nivel_pai) {
      const pai = chave(termo.vocabulario, termo.nivel_pai, termo.pai);
      const lista = filhos.get(pai) ?? [];
      lista.push(termo);
      filhos.set(pai, lista);
    }
  }
  const conceitos = new Map<string, ConceitoRow>();
  for (const conceito of todos<ConceitoRow>("SELECT * FROM conceito")) {
    conceitos.set(chave(conceito.nivel, conceito.codigo), conceito);
  }
  const divergencias = new Map<string, { termo_pdf: string | null; termo_planilha: string | null }>();
  for (const div of todos<{ nivel: string; codigo: string; termo_pdf: string | null; termo_planilha: string | null }>(
    "SELECT nivel, codigo, termo_pdf, termo_planilha FROM divergencia_grafia",
  )) {
    divergencias.set(chave(div.nivel, div.codigo), div);
  }
  memoria = { nos, nosPorNivel, ocupacoes, ocupacao, sinonimos, sinonimosPor, termos, termosPorCodigo, filhos, conceitos, divergencias };
  return memoria;
}

export function noCbo(nivel: string, codigo: string) {
  return carregar().nos.get(`${nivel}|${codigo}`);
}

export function nosDoNivel(nivel: string) {
  return carregar().nosPorNivel.get(nivel) ?? [];
}

export function ocupacoes() {
  return carregar().ocupacoes;
}

export function ocupacaoPorCodigo(codigo: string) {
  return carregar().ocupacao.get(codigo);
}

export function sinonimos() {
  return carregar().sinonimos;
}

export function sinonimosDa(codigo: string) {
  return carregar().sinonimosPor.get(codigo) ?? [];
}

export function termo(vocabulario: string, nivel: string, codigo: string) {
  return carregar().termos.get(`${vocabulario}|${nivel}|${codigo}`);
}

export function termosDoCodigo(vocabulario: string, codigo: string) {
  return carregar().termosPorCodigo.get(`${vocabulario}|${codigo}`) ?? [];
}

export function filhosDe(vocabulario: string, nivel: string, codigo: string) {
  return carregar().filhos.get(`${vocabulario}|${nivel}|${codigo}`) ?? [];
}

export function todosTermos() {
  return [...carregar().termos.values()];
}

export function conceitoDe(nivel: string, codigo: string) {
  return carregar().conceitos.get(`${nivel}|${codigo}`);
}

export function todosConceitos() {
  return [...carregar().conceitos.values()];
}

export function divergenciaDe(nivel: string, codigo: string) {
  return carregar().divergencias.get(`${nivel}|${codigo}`);
}

export function fonteCbo(ocupacao: OcupacaoLista): Fonte | null {
  if (!ocupacao.fonte_cbo_arquivo || ocupacao.fonte_cbo_linha == null) return null;
  return { arquivo: normalizarArquivo(ocupacao.fonte_cbo_arquivo), linha: ocupacao.fonte_cbo_linha };
}

export function fonteQbq(ocupacao: OcupacaoLista): Fonte | null {
  if (!ocupacao.fonte_qbq_arquivo || ocupacao.fonte_qbq_linha == null) return null;
  return {
    arquivo: normalizarArquivo(ocupacao.fonte_qbq_arquivo),
    aba: ocupacao.fonte_qbq_aba ?? undefined,
    linha: ocupacao.fonte_qbq_linha,
  };
}
