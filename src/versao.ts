import pacote from "../package.json" with { type: "json" };

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

/** Versão do software (semver), lida do package.json. Independe da versão dos dados (P8). */
export const VERSAO_SERVICO: string = pacote.version;

export const SITE = "https://cbo.ciencia.social";
export const REPOSITORIO_SERVICO = "https://github.com/ciencia-social/cbo-qbq-site";

/** Autoria, como no CITATION.cff do cbo-qbq-dados. */
export const AUTOR = {
  nome: "Wil Fernandes",
  nome_citacao: "Fernandes, W.",
  orcid: "https://orcid.org/0009-0008-3477-5521",
} as const;

/** DOIs do conjunto de dados, cunhados pelo Zenodo na release dados-2026.11.2 (VERSAO.json do cbo-qbq-dados). */
export const DOI_DADOS = {
  conceito: "10.5281/zenodo.24353524",
  versao: "10.5281/zenodo.24353525",
} as const;
export const ANO_DADOS = "2026";

/**
 * DOI de conceito do software. Só existe depois da primeira release no Zenodo (P14b).
 * Enquanto for null, a citação do software aponta para o repositório.
 * Marcador para o mantenedor: <DOI_SITE_CONCEITO>.
 */
export const DOI_SOFTWARE_CONCEITO: string | null = null;
export const ANO_SOFTWARE = "2026";

export const LICENCAS = {
  dados: { nome: "CC BY 4.0", spdx: "CC-BY-4.0", url: "https://creativecommons.org/licenses/by/4.0/deed.pt-br" },
  codigo: { nome: "MIT", spdx: "MIT", url: "https://opensource.org/licenses/MIT" },
} as const;

export const FONTES_OFICIAIS = [
  "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads",
  "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/quadro-brasileiro-de-qualificacoes-qbq",
] as const;

const TITULO_DADOS = "cbo-qbq-dados: Classificação Brasileira de Ocupações e Quadro Brasileiro de Qualificações como dados abertos";
const TITULO_SOFTWARE = "cbo-qbq-site: API REST e servidor MCP da CBO e do QBQ";

export const doiUrl = (doi: string) => `https://doi.org/${doi}`;

/**
 * Citação do conjunto de dados. Idêntica, palavra por palavra, à atribuição de dados/LICENSE.md
 * do cbo-qbq-dados (T6 do plano dos dados). É a única string de citação do dado no código (P6).
 */
export const CITACAO_DADOS = `${AUTOR.nome_citacao} (${ANO_DADOS}). ${TITULO_DADOS} (Versão ${VERSAO_DADOS}) [Conjunto de dados]. Zenodo. ${doiUrl(DOI_DADOS.versao)}`;

/** Citação do software. Sem DOI até a primeira release no Zenodo; depois, com o DOI de conceito. */
export const CITACAO_SOFTWARE = `${AUTOR.nome_citacao} (${ANO_SOFTWARE}). ${TITULO_SOFTWARE} (Versão ${VERSAO_SERVICO}) [Software]. ${
  DOI_SOFTWARE_CONCEITO ? `Zenodo. ${doiUrl(DOI_SOFTWARE_CONCEITO)}` : REPOSITORIO_SERVICO
}`;

/** Citação de uma ficha: a do conjunto de dados, mais a ocupação, a página e a data de acesso. */
export function citacaoFicha(codigoFormatado: string, titulo: string, acesso: string) {
  const codigo = codigoFormatado.replace(/\D/g, "");
  return `${CITACAO_DADOS}. Ocupação ${codigoFormatado}: ${titulo}. ${SITE}/ocupacoes/${codigo}. Acesso em: ${acesso}.`;
}

export const BIBTEX_DADOS = `@dataset{fernandes_${ANO_DADOS}_cbo_qbq_dados,
  author    = {Fernandes, Wil},
  title     = {${TITULO_DADOS}},
  year      = {${ANO_DADOS}},
  version   = {${VERSAO_DADOS}},
  publisher = {Zenodo},
  doi       = {${DOI_DADOS.versao}},
  url       = {${doiUrl(DOI_DADOS.versao)}}
}`;

export const BIBTEX_SOFTWARE = `@software{fernandes_${ANO_SOFTWARE}_cbo_qbq_site,
  author    = {Fernandes, Wil},
  title     = {${TITULO_SOFTWARE}},
  year      = {${ANO_SOFTWARE}},
  version   = {${VERSAO_SERVICO}},
${DOI_SOFTWARE_CONCEITO ? `  publisher = {Zenodo},\n  doi       = {${DOI_SOFTWARE_CONCEITO}},\n  url       = {${doiUrl(DOI_SOFTWARE_CONCEITO)}}` : `  url       = {${REPOSITORIO_SERVICO}}`}
}`;

/** Campo antigo de /api/v1/versao, mantido por compatibilidade. Prefira `licencas` e `citacao`. */
export const LICENCA = {
  nome: LICENCAS.dados.nome,
  url: LICENCAS.dados.url,
  citacao: CITACAO_DADOS,
};

/**
 * Declaração de uso de IA (P4), conforme o art. 9º, I, "c", da Portaria CNPq nº 2.664/2026.
 * Aparece em /sobre. É o mesmo texto da seção 7 de docs/USO-DE-IA.md; ao mudar um, mude o outro.
 */
export const DECLARACAO_IA =
  "Em conformidade com o art. 9º, I, \"c\", da Portaria CNPq nº 2.664/2026, declaro o uso de ferramentas de IA generativa neste projeto. No conjunto de dados cbo-qbq-dados, o Claude Science apoiou a busca das fontes oficiais, o pipeline de extração e validação, a documentação e a revisão dos dados. Neste serviço, o Claude Science, o Claude Design, o Cursor e o Claude Code apoiaram o planejamento, o design das telas, o código e os testes, os textos e as avaliações do projeto. Revisei cada resultado por inteiro antes de publicá-lo. Os dados são regenerados das publicações oficiais e validados automaticamente, e os números que o serviço devolve são conferidos por testes contra os dados. O escopo, as decisões de arquitetura e a modelagem dos dados não foram delegados à IA. A IA não é autora deste trabalho, e a responsabilidade pelo conteúdo é minha. Detalhes em docs/USO-DE-IA.md, no repositório.";
