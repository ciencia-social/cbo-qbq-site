# Mudanças

A versão do software segue o versionamento semântico (`v0.1.0`, `v0.2.0`…) e é independente da versão dos dados. Cada entrada diz qual versão do [`cbo-qbq-dados`](https://github.com/ciencia-social/cbo-qbq-dados) a release serve.

## v0.1.0 · dados-2026.11.2 · (não publicado)

Serve `dados-2026.11.2` (DOI 10.5281/zenodo.24353525).

Primeira versão pública.

- **API REST** em `/api/v1`, somente leitura: ocupações, sinônimos, atividades e hierarquia da CBO; competências, vocabulários e conceitos do QBQ; cobertura e divergências entre as duas fontes; busca textual; decisões de modelagem, fontes oficiais, versão e downloads. Documento OpenAPI 3.1 em `/api/v1/openapi.json`. Listas em CSV com `formato=csv`. ETag, cache de um dia e limite de taxa.
- **Servidor MCP** em `/mcp` (HTTP) e por stdio, com 15 tools, resources e prompts.
- **Site** com ficha por ocupação, navegação por competências, documentação da API e do MCP e a página "Sobre os dados".
- **Gabarito**: testes de aceite com os números da seção 9 de `docs/plano-api-mcp-cbo-qbq.md`, tirados do dado.
- **Identidade e citação**: citação do conjunto de dados e do software em `/api/v1/versao`, em `/sobre`, na ficha, no MCP e no `llms.txt`; `CITATION.cff` e `.zenodo.json`; versão do serviço em `X-Versao-Servico` e no `serverInfo` do MCP.
- **FAIR**: cabeçalhos `Link` (Signposting) na API, no MCP e nas páginas; JSON-LD `schema.org/Dataset`; `robots.txt` e `sitemap.xml` com todas as fichas; licença, contato e DOIs no OpenAPI; o gerador do banco confere a versão contra o `VERSAO.json` do repositório de dados.
- **Abertura do repositório**: licença MIT, avisos de terceiros, política de segurança, guia de contribuição, cabeçalhos de segurança nas páginas.
