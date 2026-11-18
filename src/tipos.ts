export type Aviso = {
  codigo?: string;
  mensagem: string;
  link?: string;
};

export type Fonte = {
  arquivo: string;
  aba?: string;
  linha?: number;
};

export type Saida = {
  dados: unknown;
  total?: number;
  limite?: number;
  deslocamento?: number;
  avisos?: Aviso[];
  derivado?: boolean;
  metodo?: string;
  cru?: boolean;
};

export type Faixa = { min: number; max: number };

export const SITUACOES_QBQ = [
  "classificada",
  "nao_classificada",
  "sem_nivel_sem_justificativa",
  "ausente_no_qbq",
] as const;

export const DIVERGENCIAS = ["so_cbo", "so_qbq", "titulo_divergente"] as const;

export const NIVEL_URL: Record<string, string> = {
  "grandes-grupos": "grande_grupo",
  "subgrupos-principais": "subgrupo_principal",
  subgrupos: "subgrupo",
  familias: "familia",
};

export const URL_DO_NIVEL: Record<string, string> = Object.fromEntries(
  Object.entries(NIVEL_URL).map(([url, nivel]) => [nivel, url]),
);

export const NIVEL_POR_TAMANHO: Record<number, string> = {
  1: "grande_grupo",
  2: "subgrupo_principal",
  3: "subgrupo",
  4: "familia",
};

export const FOLHA: Record<string, string> = {
  "conhecimentos-i": "conhecimentos",
  "conhecimentos-ii": "elementos",
  habilidades: "habilidades",
  atitudes: "atitudes",
};

export const NIVEIS_VOCAB: Record<string, string[]> = {
  "conhecimentos-i": ["dominios", "areas", "campos", "conhecimentos"],
  "conhecimentos-ii": ["areas", "campos", "conhecimentos", "elementos"],
  habilidades: ["dominios", "categorias", "habilidades"],
  atitudes: ["categorias", "atitudes"],
};

export const VOCABULARIOS = Object.keys(NIVEIS_VOCAB);

export const METODO_SIMILARIDADE =
  "Índice de Jaccard entre os códigos distintos da dimensão, com baldes (segmento 90 ou 99) excluídos, porque neles o código não é o conteúdo. Habilidades é o vocabulário comum a todas as ocupações. Conhecimentos só são comparados dentro da mesma taxonomia.";

export const METODO_GRAUS =
  "Para termos em comum, a diferença é a subtração simples de importância, frequência e profundidade, na ordem dos códigos pedidos. Sem pesos e sem índice sintético.";

export const METODO_DISTINGUE =
  "Para cada termo, presença no grupo (proporção das ocupações classificadas do grupo que o exigem) contra a presença entre as ocupações classificadas a que o vocabulário se aplica. A ordenação é a diferença de presença. Contam ocupações distintas, sem baldes.";

export const METODO_NIVEIS =
  "Média e mediana usam só ocupações com nível na dimensão pedida. Quem não tem nível entra na contagem à parte, nunca como zero.";

export const ARQUIVO_QBQ = "fontes/qbq/qbq-2025-03.xlsx";
