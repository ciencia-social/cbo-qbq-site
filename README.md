# CBO e QBQ

API somente leitura da Classificação Brasileira de Ocupações e do Quadro Brasileiro de Qualificações. Os dados vêm de `cbo-qbq-dados` na release `dados-2026.11.1`. A consulta é a API REST em `/api/v1` e o servidor MCP em `/mcp` (HTTP) ou por stdio. O prefixo antigo `/v1` redireciona para `/api/v1`.

CBO e QBQ são fontes distintas. Quando divergem, a resposta mostra os dois lados. Similaridade, rankings e resumos são cálculos derivados.

## Uso local

O banco é gerado a partir do repositório irmão `../cbo-qbq-dados`, de `CBO_QBQ_DADOS`, ou de um clone da tag `dados-2026.11.1`.

```bash
npm install
npm run dados
npm test
npm run dev
npm run mcp
```

- Índice: `GET /api/v1`
- OpenAPI: `GET /api/v1/openapi.json`
- Regras para agentes: `/llms.txt` e `/llms-full.txt`

## Vercel

O build gera `data/cbo-qbq.sqlite` e o runtime é Node, não Edge. Se o repositório de dados for privado, o build precisa de acesso de leitura ao GitHub.
