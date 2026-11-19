# Como contribuir

O projeto é mantido por uma pessoa, como parte de uma pesquisa de iniciação científica. Issues e pull requests são bem-vindos, sem garantia de prazo de resposta.

## Onde vai cada coisa

- **Erro no dado** (título, nível, competência, contagem diferente da fonte oficial): vai para o [`cbo-qbq-dados`](https://github.com/ciencia-social/cbo-qbq-dados/issues). Este repositório só serve o dado; não o corrige.
- **Erro na API, no MCP ou no site**: issue aqui, com os modelos de "Erro na API" ou "Erro no MCP".
- **Falha de segurança**: relato privado, conforme o [`SECURITY.md`](SECURITY.md).

## Rodar

Requer Node 22.13 ou mais novo.

```bash
npm install
npm run dados     # gera data/cbo-qbq.sqlite a partir do cbo-qbq-dados
npm run dev       # site, API e MCP em http://localhost:3000
npm run mcp       # servidor MCP por stdio
```

O banco sai de uma de três origens, nesta ordem: a pasta em `CBO_QBQ_DADOS`, a pasta irmã `../cbo-qbq-dados`, ou um clone da tag fixada em `src/versao.ts` (`TAG_DADOS`) em `.dados/`.

## Testar

```bash
npm run typecheck
npm test
```

Os dois rodam no CI a cada push e pull request, com o banco construído a partir da tag (`EXIGIR_TAG=1`).

**Nenhum valor do gabarito pode mudar.** Os números de `test/aceite.test.ts` vêm da seção 9 de `docs/plano-api-mcp-cbo-qbq.md` e foram tirados do dado. Se um teste do gabarito falhar, o erro está no código, não no número. Ele só muda numa troca de versão dos dados, com a mudança conferida contra o `cbo-qbq-dados`.

## Commits

Mensagens em português, no formato `tipo(escopo): descrição`, por exemplo `fix(api): limita o tamanho de q` ou `feat(mcp): adiciona resources`. Tipos usados: `feat`, `fix`, `perf`, `docs`, `test`, `chore`, `ci`.

## Contratos

Mudança no formato das respostas da API, nos nomes das rotas ou nas tools do MCP quebra quem já usa o serviço. Diga no pull request se a mudança altera algum desses contratos.

## Metadados de citação

`CITATION.cff` e `.zenodo.json` andam juntos. O Zenodo lê só o `.zenodo.json` quando ele existe, e o GitHub lê só o `CITATION.cff` para o botão "Cite this repository". Título, autores, ORCID e licença têm de ser iguais nos dois; `test/metadados.test.ts` confere. Nenhum dos dois tem campo de versão: ela vem da tag da release.

A citação do conjunto de dados (`CITACAO_DADOS` em `src/versao.ts`) é idêntica à atribuição de `dados/LICENSE.md` do `cbo-qbq-dados`. É a única string de citação no código; páginas, API, MCP e `llms.txt` leem dela.
