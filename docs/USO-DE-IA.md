# Uso de IA

## Declaração

<DECLARACAO_IA>

O mesmo texto aparece na página `/sobre` do site. A fonte única é a constante `DECLARACAO_IA` em `src/versao.ts`; ao mudar um, mude o outro.

## Documentos que registram o uso

Estes documentos foram escritos como instrução para agentes de código e mostram o processo, etapa por etapa:

- [`design/PROMPT.md`](../design/PROMPT.md): instrução para construir o site.
- [`design/HANDOFF.md`](../design/HANDOFF.md): especificação do site a partir das telas desenhadas.
- [`docs/plano-api-mcp-cbo-qbq.md`](plano-api-mcp-cbo-qbq.md): especificação da API REST e das tools do MCP.
- [`docs/tarefas-mcp.md`](tarefas-mcp.md): correções do servidor MCP depois da primeira revisão.
- [`docs/plano-fair-servico.md`](plano-fair-servico.md): tarefas para tornar o serviço a camada FAIR do conjunto de dados.

## Como os resultados foram conferidos

Os números que o serviço devolve são conferidos contra o gabarito da seção 9 de [`docs/plano-api-mcp-cbo-qbq.md`](plano-api-mcp-cbo-qbq.md). O gabarito foi tirado do dado, não do código, e está fixo nos testes de aceite em [`test/aceite.test.ts`](../test/aceite.test.ts): contagens de cada nível da CBO, de itens do QBQ, de divergências entre as fontes e respostas de ocupações conhecidas. Nenhum valor do gabarito pode mudar para um teste passar. Os testes rodam no CI a cada push (`.github/workflows/ci.yml`), com o banco construído a partir da tag fixada do `cbo-qbq-dados`.

## Roteiro para o mantenedor

Perguntas para redigir a declaração acima (apague esta seção depois de escrevê-la):

1. Em que etapas a IA foi usada (especificação, código, testes, textos, design)?
2. Com que ferramentas (nome e, se possível, versão ou período)?
3. O que ficou só com o mantenedor (decisões de modelagem, revisão, conferência dos números)?
4. Como os resultados foram conferidos (gabarito de testes contra o dado, revisão manual, comparação com as fontes oficiais)?
