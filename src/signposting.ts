/**
 * Cabeçalho Link do perfil Signposting (S3): cite-as, describedby, license e author.
 * Nas rotas de dado e nas páginas, cite-as aponta para o DOI de versão dos dados e a licença é CC BY.
 * No índice da API, no OpenAPI e no MCP, aponta para o software: o DOI de conceito quando existir,
 * o repositório até lá, e a licença MIT.
 */
import { AUTOR, DOI_DADOS, DOI_SOFTWARE_CONCEITO, doiUrl, LICENCAS, PREFIXO_API, REPOSITORIO_SERVICO, SITE } from "./versao";

export type AlvoSignposting = "dados" | "software";

export function linkSignposting(alvo: AlvoSignposting): string {
  const citarComo = alvo === "dados" ? doiUrl(DOI_DADOS.versao) : DOI_SOFTWARE_CONCEITO ? doiUrl(DOI_SOFTWARE_CONCEITO) : REPOSITORIO_SERVICO;
  const licenca = alvo === "dados" ? LICENCAS.dados.url : LICENCAS.codigo.url;
  return [
    `<${citarComo}> ; rel="cite-as"`,
    `<${SITE}${PREFIXO_API}/openapi.json> ; rel="describedby" ; type="application/json"`,
    `<${licenca}> ; rel="license"`,
    `<${AUTOR.orcid}> ; rel="author"`,
  ].join(", ");
}

/** O índice da API e o documento OpenAPI descrevem o software; as demais rotas servem dado. */
export function alvoDaRota(caminhoRelativo: string): AlvoSignposting {
  return caminhoRelativo === "" || caminhoRelativo === "/" || caminhoRelativo === "/openapi.json" ? "software" : "dados";
}
