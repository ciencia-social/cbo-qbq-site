# cbo-qbq-site

[![DOI dos dados](https://zenodo.org/badge/DOI/10.5281/zenodo.24353524.svg)](https://doi.org/10.5281/zenodo.24353524)
<!-- Selo do DOI do software, a ativar depois da primeira release no Zenodo (docs/operacao.md, P14b):
[![DOI do software](https://zenodo.org/badge/DOI/<DOI_SITE_CONCEITO>.svg)](https://doi.org/<DOI_SITE_CONCEITO>)
-->

API REST, servidor MCP e site da Classificação Brasileira de Ocupações (CBO) e do Quadro Brasileiro de Qualificações (QBQ), em https://cbo.ciencia.social. O serviço é somente leitura: consulta ocupações, sinônimos, atividades e a hierarquia da CBO, as competências e os níveis do QBQ, e as divergências entre as duas fontes.

Os dados vêm do [`cbo-qbq-dados`](https://github.com/ciencia-social/cbo-qbq-dados), que compila as publicações oficiais do Ministério do Trabalho e Emprego com a proveniência de cada registro. Este repositório não corrige nem reinterpreta o dado: serve o que está lá, numa versão fixada, e diz qual versão em cada resposta.

## Aviso

Este serviço é uma iniciativa de pesquisa, sem vínculo com o Ministério do Trabalho e Emprego. Os dados vêm de publicações oficiais do ministério e são servidos sem alteração de conteúdo; as divergências entre as fontes e os cálculos derivados não são posição oficial. Para fins oficiais, consulte as publicações do ministério: [CBO](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads) e [QBQ](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/quadro-brasileiro-de-qualificacoes-qbq).

## Endereços

| O quê | Onde |
|---|---|
| Site | https://cbo.ciencia.social |
| API REST | https://cbo.ciencia.social/api/v1 |
| OpenAPI 3.1 | https://cbo.ciencia.social/api/v1/openapi.json |
| Servidor MCP (HTTP) | https://cbo.ciencia.social/mcp |
| Regras para agentes | https://cbo.ciencia.social/llms.txt e https://cbo.ciencia.social/llms-full.txt |

O prefixo antigo `/v1` redireciona para `/api/v1`. A API não pede chave; há um limite de pedidos por minuto, e quem passa dele recebe `429` com `Retry-After`.

## Conectar o MCP

No Claude Code:

```bash
claude mcp add --transport http cbo-qbq https://cbo.ciencia.social/mcp
```

Instruções para outros clientes (Claude no navegador, Cursor, VS Code) em https://cbo.ciencia.social/docs/mcp.

## De onde vêm os dados

O serviço serve a versão `dados-2026.11.2` do [`cbo-qbq-dados`](https://github.com/ciencia-social/cbo-qbq-dados), fixada em `src/versao.ts` (`TAG_DADOS`). Toda resposta da API traz a versão em `X-Versao-Dados` e em `meta.versao_dados`; `/api/v1/versao` traz também o commit de onde o banco foi gerado.

CBO e QBQ são fontes distintas e não são reconciliadas. Quando divergem (código só numa delas, título diferente), a resposta mostra os dois lados. Similaridade, rankings e resumos são cálculos derivados, marcados com `derivado=true`.

## Rodar localmente

Requer Node 22.13 ou mais novo.

```bash
npm install
npm run dados     # gera data/cbo-qbq.sqlite
npm test
npm run dev       # site, API e MCP em http://localhost:3000
npm run mcp       # servidor MCP por stdio
```

O banco é gerado a partir de uma de três origens, nesta ordem:

1. a pasta indicada em `CBO_QBQ_DADOS`;
2. a pasta irmã `../cbo-qbq-dados`;
3. um clone da tag `dados-2026.11.2` em `.dados/`, feito pelo próprio script quando as outras duas não existem.

Com `EXIGIR_TAG=1`, o script falha se a árvore usada não for exatamente a da tag; o CI e a Vercel usam essa opção.

No modo stdio (`npm run mcp`), o servidor MCP lê o mesmo banco e conversa pela entrada e saída padrão, para clientes que iniciam o servidor como processo local.

## Como citar

Quem usa os dados cita o conjunto de dados:

> Fernandes, W. (2026). cbo-qbq-dados: Classificação Brasileira de Ocupações e Quadro Brasileiro de Qualificações como dados abertos (Versão dados-2026.11.2) [Conjunto de dados]. Zenodo. https://doi.org/10.5281/zenodo.24353525

Quem usa a API, o MCP ou o código cita também o software:

> Fernandes, W. (2026). cbo-qbq-site: API REST e servidor MCP da CBO e do QBQ (Versão 0.1.0) [Software]. https://github.com/ciencia-social/cbo-qbq-site

As duas citações em BibTeX estão em https://cbo.ciencia.social/api/v1/versao e na página [Sobre](https://cbo.ciencia.social/sobre). O GitHub mostra o botão "Cite this repository" a partir do [`CITATION.cff`](CITATION.cff).

## Licenças

- Código: [MIT](LICENSE).
- Dados: a compilação estruturada do `cbo-qbq-dados` está sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.pt-br); o conteúdo provém de atos oficiais, não protegidos por direito autoral (art. 8º, IV, da Lei 9.610/1998).
- Terceiros (ícones, fontes, dependências) e o design system: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Uso de IA

O projeto foi desenvolvido com o apoio de agentes de código de IA, e os números foram conferidos por testes contra o dado. A declaração completa está em [`docs/USO-DE-IA.md`](docs/USO-DE-IA.md).

## Estado e manutenção

Projeto de iniciação científica, mantido por uma pessoa. O serviço está em produção, sem garantia de disponibilidade nem de prazo de resposta. Os documentos de processo estão indexados em [`docs/README.md`](docs/README.md), e as mudanças, no [`CHANGELOG.md`](CHANGELOG.md).

## Contribuir e segurança

- Como rodar, testar e propor mudanças: [`CONTRIBUTING.md`](CONTRIBUTING.md). Erro no dado vai para o [`cbo-qbq-dados`](https://github.com/ciencia-social/cbo-qbq-dados/issues).
- Falha de segurança: relato privado, conforme o [`SECURITY.md`](SECURITY.md).
