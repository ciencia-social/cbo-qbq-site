/**
 * S12: o VERSAO.json do cbo-qbq-dados é a fonte da identidade da versão.
 * O gerador confere src/versao.ts contra ele e tira dali as contagens esperadas.
 *
 * O DOI não pode ser derivado da tag: o Zenodo só o cunha depois da release, então o
 * VERSAO.json da tag o traz vazio, e o commit de acerto o preenche só na main do repositório
 * de dados. Por isso DOI_DADOS continua em src/versao.ts e só é conferido quando o arquivo o traz.
 */
import fs from "node:fs";
import path from "node:path";

export type VersaoJson = {
  versao_dados: string;
  versao_schema: string;
  camadas: Record<string, string>;
  doi?: { conceito?: string; versao?: string };
  contagens?: Record<string, number>;
};

export type Constantes = {
  versaoDados: string;
  versaoSchema: string;
  camadas: Record<string, string>;
  doi: { conceito: string; versao: string };
};

/** Chaves de contagens do VERSAO.json → chaves conferidas pelo gerador. */
export const CONTAGENS_VERSAO_JSON: Record<string, string> = {
  cbo_grandes_grupos: "cbo_no grande_grupo",
  cbo_subgrupos_principais: "cbo_no subgrupo_principal",
  cbo_subgrupos: "cbo_no subgrupo",
  cbo_familias: "cbo_no familia",
  cbo_ocupacoes: "ocupacao com titulo_cbo",
  cbo_sinonimos: "sinonimo",
  cbo_atividades: "atividade",
  qbq_ocupacoes: "ocupacao com titulo_qbq",
  qbq_com_competencias: "classificada",
  qbq_nao_classificadas: "nao_classificada",
  qbq_conceitos: "conceito",
};

export function lerVersaoJson(raiz: string): VersaoJson | null {
  const arquivo = path.join(raiz, "VERSAO.json");
  if (!fs.existsSync(arquivo)) return null;
  return JSON.parse(fs.readFileSync(arquivo, "utf8")) as VersaoJson;
}

/** Diferenças entre o VERSAO.json e as constantes, em frases prontas para a mensagem de erro. */
export function divergenciasVersao(doc: VersaoJson, constantes: Constantes): string[] {
  const erros: string[] = [];
  if (doc.versao_dados !== constantes.versaoDados) erros.push(`versao_dados ${doc.versao_dados} (src/versao.ts: VERSAO_DADOS = ${constantes.versaoDados})`);
  if (doc.versao_schema !== constantes.versaoSchema) erros.push(`versao_schema ${doc.versao_schema} (src/versao.ts: VERSAO_SCHEMA = ${constantes.versaoSchema})`);
  for (const [camada, versao] of Object.entries(doc.camadas ?? {})) {
    if (constantes.camadas[camada] !== versao) erros.push(`camadas.${camada} ${versao} (src/versao.ts: VERSAO_CAMADAS.${camada} = ${constantes.camadas[camada] ?? "ausente"})`);
  }
  for (const chave of ["conceito", "versao"] as const) {
    const doi = doc.doi?.[chave];
    if (doi && doi !== constantes.doi[chave]) erros.push(`doi.${chave} ${doi} (src/versao.ts: DOI_DADOS.${chave} = ${constantes.doi[chave]})`);
  }
  return erros;
}

/** Contagens esperadas: as do VERSAO.json sobrepõem as fixas, nas chaves que ele traz. */
export function contagensEsperadas(fixas: Record<string, number>, doc: VersaoJson | null): Record<string, number> {
  const esperadas = { ...fixas };
  for (const [chave, valor] of Object.entries(doc?.contagens ?? {})) {
    const destino = CONTAGENS_VERSAO_JSON[chave];
    if (destino) esperadas[destino] = valor;
  }
  return esperadas;
}
