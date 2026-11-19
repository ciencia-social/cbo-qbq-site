/** Release fixada. As camadas mantêm a publicação em que foram geradas (D016). */
export const VERSAO_DADOS = "dados-2026.11.2";

/** Prefixo público da API. Pedidos a /v1 recebem redirecionamento permanente. */
export const PREFIXO_API = "/api/v1";

export function api(caminho: string) {
  return `${PREFIXO_API}${caminho}`;
}
export const VERSAO_SCHEMA = "schema-v0.3.0";
export const GERADOR = "3";

export const VERSAO_CAMADAS = {
  cbo_espinha: "dados-2026.11",
  cbo_perfil: "dados-2026.11.1",
  qbq: "dados-2026.08",
} as const;

export const REPOSITORIO_DADOS = "https://github.com/ciencia-social/cbo-qbq-dados";
export const TAG_DADOS = "dados-2026.11.2";

/** Anexos que o workflow de release de cbo-qbq-dados publica (docs/versionamento.md). */
export const ANEXOS_RELEASE = ["qbq.sqlite.gz", "qbq.sql.gz", "MANIFEST.sha256"] as const;

export const CITACAO =
  "cbo-qbq-dados — CBO e QBQ como dados abertos (github.com/ciencia-social/cbo-qbq-dados), a partir de dados oficiais do MTE.";

export const LICENCA = {
  nome: "CC BY 4.0",
  url: "https://creativecommons.org/licenses/by/4.0/deed.pt-br",
  citacao: CITACAO,
};
