> Escrito em 18 de novembro de 2026, para o agente de código.  
> Situação: em andamento (S1 e S10 substituídas por P1, P6, P7 e P8 do plano de abertura pública).

# Plano de ação — FAIR no serviço: site, API e MCP

Documento de execução, escrito para o agente de código. O contexto está em [relatorio-fair-servico.md](relatorio-fair-servico.md). Este plano **depende** do plano do repositório de dados: o DOI precisa existir antes da S1. Onde aparece `10.5281/zenodo.XXXXXXX`, use o DOI de versão; onde aparece `10.5281/zenodo.YYYYYYY`, o DOI de conceito.

## Antes de começar

**Estado de partida verificado.** Next.js com App Router; API em `app/v1/[[...caminho]]/route.ts` e `app/api/v1/[[...caminho]]/route.ts`; rotas declaradas em `src/http/rotas.ts` (incluindo `/versao`, `/fontes`, `/decisoes`, `/escalas`, `/openapi.json`); cabeçalhos e envelope em `src/http/dispatcher.ts`, que já envia CORS liberado e `x-versao-dados`; constantes de versão, licença e citação em `src/versao.ts`; `public/llms.txt` e `public/llms-full.txt`; servidor MCP em `src/mcp/servidor.ts` com `instructions`; testes de aceite em `test/aceite.test.ts`. Não existem `app/robots.ts`, `app/sitemap.ts`, `LICENSE` nem `CITATION.cff`.

**Princípio que governa todas as tarefas.** O serviço não inventa metadado: tudo que ele declara sobre o dado vem do repositório de dados. Preferir ler de `VERSAO.json` (criado pelo plano do outro repositório, tarefa T4) a repetir constantes à mão. Onde a leitura não for possível no momento da execução, concentrar o valor em `src/versao.ts` e deixar comentado de onde ele veio.

## S1 — Identidade do dataset em `src/versao.ts`

Acrescentar as constantes que faltam e corrigir a citação, que hoje não tem autoria nem DOI.

```ts
export const DOI_CONCEITO = "10.5281/zenodo.YYYYYYY";
export const DOI_VERSAO = "10.5281/zenodo.XXXXXXX";

export const AUTOR = {
  nome: "Wil Fernandes",
  orcid: "https://orcid.org/0009-0008-3477-5521",
} as const;

export const SITE = "https://cbo.ciencia.social";

export const LICENCAS = {
  dados: { nome: "CC BY 4.0", spdx: "CC-BY-4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  codigo: { nome: "MIT", spdx: "MIT", url: "https://opensource.org/licenses/MIT" },
} as const;

export const CITACAO = {
  texto: "Fernandes, W. (2026). cbo-qbq-dados: CBO e QBQ como dados abertos (Versão dados-2026.11.2) [Conjunto de dados]. Zenodo. https://doi.org/10.5281/zenodo.XXXXXXX",
  doi: DOI_VERSAO,
  bibtex: "@dataset{...}",
} as const;
```

A string de `CITACAO.texto` deve ser **idêntica, palavra por palavra**, à atribuição sugerida em `dados/LICENSE.md` do repositório de dados. Essa igualdade é verificável e é o aceite cruzado entre os dois planos.

Manter `LICENCA` (singular) exportada enquanto houver consumidor, ou atualizar os pontos de uso — `src/site/sobre.ts` e `src/consulta/meta.ts` leem essa constante hoje.

## S2 — `/api/v1/versao` com identidade completa

Em `src/consulta/meta.ts`, estender `versao()` para devolver, além do que já devolve:

```json
{
  "doi": { "conceito": "10.5281/zenodo.YYYYYYY", "versao": "10.5281/zenodo.XXXXXXX" },
  "citacao": { "texto": "...", "bibtex": "...", "doi_url": "https://doi.org/10.5281/zenodo.XXXXXXX" },
  "autor": { "nome": "...", "orcid": "https://orcid.org/0009-0008-3477-5521" },
  "licencas": {
    "dados": { "nome": "CC BY 4.0", "spdx": "CC-BY-4.0", "url": "https://creativecommons.org/licenses/by/4.0/" },
    "codigo": { "nome": "MIT", "spdx": "MIT", "url": "https://opensource.org/licenses/MIT" }
  },
  "fontes_oficiais": [
    "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads",
    "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/quadro-brasileiro-de-qualificacoes-qbq"
  ],
  "repositorio_dados": "https://github.com/ciencia-social/cbo-qbq-dados",
  "repositorio_servico": "https://github.com/ciencia-social/cbo-qbq-site"
}
```

O campo `licenca` atual (singular, com `nome`, `url`, `citacao`) deve continuar existindo por compatibilidade com consumidores já escritos; marque-o como obsoleto na descrição da rota e aponte para `licencas`.

**Aceite.** `GET /api/v1/versao` devolve `doi.conceito` e `doi.versao` não vazios; `citacao.texto` contém o DOI; o teste de aceite existente continua verde.

## S3 — Signposting nos cabeçalhos HTTP

Em `src/http/dispatcher.ts`, acrescentar a toda resposta de sucesso da API os cabeçalhos `Link` do perfil Signposting, separados por vírgula:

```
Link: <https://doi.org/10.5281/zenodo.XXXXXXX> ; rel="cite-as",
      <https://cbo.ciencia.social/api/v1/openapi.json> ; rel="describedby" ; type="application/json",
      <https://creativecommons.org/licenses/by/4.0/> ; rel="license",
      <https://orcid.org/0009-0008-3477-5521> ; rel="author"
```

Acrescentar `Link` à lista de `Access-Control-Expose-Headers`, sem o que o cabeçalho fica invisível para clientes no navegador.

As mesmas quatro relações devem sair nas páginas HTML do site. No App Router isso se faz pela configuração de cabeçalhos em `next.config.ts`, aplicada às rotas de página.

**Aceite.** `curl -sI https://cbo.ciencia.social/api/v1/ocupacoes/212405 | grep -i '^link'` mostra as quatro relações; o mesmo vale para `curl -sI https://cbo.ciencia.social/ocupacoes/212405`.

## S4 — JSON-LD `schema.org/Dataset` na página inicial e em "Sobre"

Embutir um `<script type="application/ld+json">` com a descrição do dataset. É o que faz o site aparecer no Google Dataset Search. O bloco deve ser gerado de `src/versao.ts` e das contagens reais do banco, nunca escrito à mão.

```json
{
  "@context": "https://schema.org/",
  "@type": "Dataset",
  "name": "CBO e QBQ como dados abertos",
  "description": "<descrição em uma a três frases, com as contagens reais>",
  "url": "https://cbo.ciencia.social",
  "identifier": ["https://doi.org/10.5281/zenodo.YYYYYYY"],
  "version": "dados-2026.11.2",
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "isAccessibleForFree": true,
  "inLanguage": "pt-BR",
  "keywords": ["Classificação Brasileira de Ocupações", "CBO", "Quadro Brasileiro de Qualificações", "QBQ", "ocupações", "qualificação profissional", "Brasil"],
  "creator": { "@type": "Person", "name": "Wil Fernandes", "identifier": "https://orcid.org/0009-0008-3477-5521" },
  "publisher": { "@type": "Organization", "name": "ciencia.social", "url": "https://cbo.ciencia.social" },
  "isBasedOn": [
    "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads",
    "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/quadro-brasileiro-de-qualificacoes-qbq"
  ],
  "sameAs": "https://github.com/ciencia-social/cbo-qbq-dados",
  "distribution": [
    { "@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": "https://cbo.ciencia.social/api/v1", "name": "API REST aberta" },
    { "@type": "DataDownload", "encodingFormat": "application/vnd.sqlite3", "contentUrl": "<URL do anexo qbq.sqlite.gz da release>", "name": "Banco SQLite" },
    { "@type": "DataDownload", "encodingFormat": "text/csv", "contentUrl": "https://github.com/ciencia-social/cbo-qbq-dados/tree/main/derivados/csv", "name": "Tabelas CSV" }
  ],
  "citation": "<CITACAO.texto>",
  "measurementTechnique": "Extração reprodutível dos arquivos oficiais do Ministério do Trabalho e Emprego, com proveniência por registro e verificação por checksum."
}
```

**Aceite.** O bloco passa no validador de dados estruturados do Google sem erro; `curl -s https://cbo.ciencia.social | grep -c 'application/ld+json'` devolve 1; o campo `version` coincide com `VERSAO_DADOS`.

## S5 — `robots.txt` e `sitemap.xml`

Criar `app/robots.ts` liberando tudo e apontando o sitemap, e `app/sitemap.ts` gerando as entradas das páginas estáticas (início, sobre, docs, docs/mcp, competências e seus níveis) e de **todas** as ocupações, lidas do banco — são 2.694 URLs, dentro do limite de 50 mil por arquivo.

**Aceite.** `/robots.txt` e `/sitemap.xml` respondem 200; o sitemap tem uma entrada por ocupação existente no banco; nenhuma URL do sitemap devolve 404 (verificar por amostragem de 20 URLs sorteadas).

## S6 — `llms.txt` e `llms-full.txt`

Acrescentar ao bloco de rodapé, onde hoje há "Dados" e "Licença dos dados compilados", as linhas de identidade: DOI de conceito e de versão, citação em uma linha, autoria com ORCID, licença do dado (CC BY 4.0) e licença do código (MIT), separadas.

Acrescentar também uma instrução de uso, no mesmo tom das existentes: quando o resultado for usado em texto final, publicação ou relatório, citar o dataset pela forma indicada — é a regra que faz a atribuição acontecer do outro lado da conversa.

Os dois arquivos devem ser gerados ou conferidos a partir das constantes de `src/versao.ts`, para não ficarem para trás na próxima publicação. Se forem estáticos, acrescentar um teste que falhe quando a versão declarada no arquivo divergir de `VERSAO_DADOS`.

**Aceite.** Um teste em `test/` falha se `public/llms.txt` não contiver `VERSAO_DADOS` e `DOI_CONCEITO`.

## S7 — OpenAPI com licença, contato e identificador

Em `src/http/rotas.ts`, no bloco que monta o documento OpenAPI 3.1, preencher `info.license` (CC BY 4.0, com `identifier` SPDX), `info.contact`, `info.version` com a versão de dados, `info.termsOfService` apontando para a página "Sobre", `externalDocs` apontando para o repositório de dados e uma extensão `x-doi` com os dois identificadores.

**Aceite.** `GET /api/v1/openapi.json` valida como OpenAPI 3.1 e traz `info.license.identifier` igual a `CC-BY-4.0`.

## S8 — Atribuição no MCP

Três mudanças em `src/mcp/servidor.ts` e no que ele expõe.

Nas `instructions` do servidor, acrescentar um parágrafo curto: de onde vêm os dados, qual a licença e como citar quando o resultado for para texto final — com a string exata de `CITACAO.texto`.

Na ferramenta que devolve versão e metadados, acrescentar `doi`, `autor`, `licencas` e `citacao`, espelhando `/api/v1/versao`.

No retorno das demais ferramentas, manter a versão do dado que já viaja hoje. Não acrescentar o bloco de citação a cada resposta: infla o contexto do modelo sem ganho, e a instrução do servidor já cobre o caso.

**Aceite.** Um cliente MCP que chama a ferramenta de versão recebe DOI e citação; as instruções do servidor contêm a palavra "citar" e o DOI.

## S9 — Página "Sobre" com bloco de citação

Em `src/site/sobre.ts` e `sobre-view.tsx`, acrescentar uma seção **Como citar** com a citação em prosa, o BibTeX em bloco copiável, os dois DOIs com a explicação de um para cada uso, e as duas licenças separadas — dado e código. É a página para a qual o `termsOfService` do OpenAPI e o `rel="license"` apontam.

**Aceite.** A página mostra DOI, citação, BibTeX e as duas licenças; o texto da citação é idêntico ao de `/api/v1/versao`.

## S10 — Higiene do repositório do serviço

Criar `LICENSE` (MIT, titular `Wilmar Fernandes da Silva Junior` — nome legal, como no repositório de dados). Criar `CITATION.cff` do tipo `software`, com o ORCID, apontando `repository-code` e, no bloco `references`, o dataset com seu DOI — é assim que o software declara o dado que serve. No `package.json`, preencher `license`, `description`, `repository`, `homepage` e `author`.

**Aceite.** `cffconvert --validate` passa; o GitHub mostra "Cite this repository" no repositório do site; `npm pkg get license repository homepage` devolve valores não vazios.

## S11 — Testes de aceite

Acrescentar a `test/aceite.test.ts` (ou a um arquivo irmão `test/fair.test.ts`) as verificações que impedem regressão silenciosa: `/api/v1/versao` traz os dois DOIs e a citação; a resposta de uma rota qualquer traz os quatro `Link`; o JSON-LD da página inicial tem `identifier`, `license`, `creator.identifier` e `version` coerente com `VERSAO_DADOS`; `public/llms.txt` cita a versão e o DOI correntes; `/sitemap.xml` tem uma entrada por ocupação.

## S12 — Sincronização com o repositório de dados

Depois que `VERSAO.json` existir no `cbo-qbq-dados` (tarefa T4 do outro plano), alterar `scripts/construir-banco.ts` para ler dali `versao_dados`, `versao_schema`, `camadas` e `doi`, em vez de depender das constantes escritas à mão em `src/versao.ts`. As constantes passam a ser derivadas, e a próxima publicação de dados exige mudar um lugar só.

**Aceite.** Trocar a versão em `VERSAO.json` e reconstruir o banco muda o que a API informa, sem edição manual de `src/versao.ts`.

## Ordem de execução

S1 e S2 primeiro, porque tudo depende das constantes. Depois S3 a S9 em qualquer ordem — são independentes entre si. S10 pode ser feita a qualquer momento, inclusive antes do DOI existir, com exceção do bloco `references` do `CITATION.cff`. S11 por último dentro desta rodada. S12 só depois de o outro plano concluir a T4.

Não altere o desenho de versionamento da API nem os nomes das rotas: a versão do dado viaja em cabeçalho e em `/versao`, e é assim que deve continuar. Não acrescente bloco de citação ao corpo de toda resposta — o lugar disso é o cabeçalho `Link` e a rota `/versao`.
