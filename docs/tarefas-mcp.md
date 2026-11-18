# Tarefas: correções do servidor MCP

Revisão feita em 18 de novembro de 2026 contra o servidor publicado em `https://cbo.ciencia.social/mcp` (`dados-2026.11.1`). Os dados e o protocolo estão corretos: todos os números do gabarito da seção 9 de `docs/plano-api-mcp-cbo-qbq.md` conferem. As tarefas abaixo tratam de como as respostas chegam ao modelo, de mensagens de erro e de tamanho de resposta.

As tools estão em `src/mcp/executar.ts` (lista de nomes, descrições e schemas no fim do arquivo, função `embrulho` para a saída) e são registradas em `src/mcp/servidor.ts`. A lógica de consulta fica em `src/consulta/*` e é compartilhada com a API REST: mude a consulta só quando a tarefa pedir, e rode a suíte inteira depois.

## Como trabalhar

1. Leia este arquivo inteiro e me mostre um plano curto antes de mudar código, dizendo o que muda em cada arquivo e se alguma tarefa altera a API REST.
2. Uma tarefa por commit, na ordem abaixo, com a mensagem começando pelo identificador (`fix(mcp): T1 ...`).
3. Cada tarefa tem casos de aceite. Escreva-os como testes em `test/mcp.test.ts`. Para T1, T2 e T9, teste pelo servidor de verdade, com o cliente do SDK ligado por `InMemoryTransport` a `criarServidor()`, e não só por `executarTool`, porque o que importa é o que o cliente recebe.
4. Rode `npm test` ao fim de cada tarefa. Nenhum valor do gabarito pode mudar.
5. Não adicione dependências sem me perguntar.

---

## T1. Pôr os dados também no conteúdo de texto (prioridade alta)

**Problema.** Os dados só vão em `structuredContent`. O bloco `content[0].text` traz uma frase genérica, às vezes fixa e igual para qualquer chamada. Clientes que só leem o texto (vários editores e versões antigas de clientes MCP) entregam ao modelo uma resposta sem dados. A especificação do MCP (2025-06-18) pede que quem devolve conteúdo estruturado também devolva o JSON serializado num bloco de texto.

**Como reproduzir.**
- `qbq_competencias {"codigo":"212405"}` → texto "Competências do QBQ, ordenadas por importância. Ocupação sem nível devolve a justificativa, não uma lista vazia.", sem nenhuma competência.
- `codigo_decodificar {"codigos":["212499"]}` → texto "0 válidos, 1 inválidos.", sem o ancestral 2124 nem as ocupações dele.
- `qbq_buscar_termos`, `cbo_resumir_grupo` e `dados_sobre` também devolvem frase fixa.

**Esperado.** `content` passa a ter dois blocos de texto: o primeiro com um resumo de uma a três linhas específico do resultado (o que foi achado, quantos, o que foi truncado); o segundo com o mesmo objeto de `structuredContent` serializado em JSON. `structuredContent` continua igual. Os resumos fixos de hoje viram resumos calculados a partir do resultado.

**Aceite.**
- Para cada uma das 15 tools, com um caso válido, `JSON.parse(content[1].text)` é igual a `structuredContent`.
- O resumo de `codigo_decodificar ["212499"]` menciona a família 2124.
- O resumo de `qbq_competencias "212405"` menciona os totais 62, 46 e 4.

## T2. Descrever as tools e cada parâmetro (prioridade alta)

**Problema.** Nenhum parâmetro tem `description`, e as descrições das tools são de uma linha. O modelo não sabe, por exemplo, quais valores `nivel` aceita em `qbq_ocupacoes_por_competencia`, o que é `prefixo`, nem quando usar uma tool em vez de outra. Em `ocupacao_similares`, `ocupacao_comparar` e `cbo_resumir_grupo`, `dimensao` é texto livre, embora só cinco valores sejam aceitos.

**Esperado.**
- Toda propriedade de todo `inputSchema` tem `.describe(...)` em português, com formato e exemplo. Exemplos: `codigo`: "Código CBO de 6 dígitos, com ou sem hífen: 212405 ou 2124-05"; `prefixo`: "Código de 1 a 4 dígitos que restringe a um ramo da CBO, como 2 ou 2124".
- `dimensao` vira enum nas três tools: `habilidades`, `atitudes`, `conhecimentos`, `conhecimentos-i`, `conhecimentos-ii`, conforme o que cada uma aceita hoje. `nivel` em `qbq_vocabulario` e `qbq_ocupacoes_por_competencia` fica como texto, mas a descrição lista os níveis de cada vocabulário: conhecimentos-i (`dominios`, `areas`, `campos`, `conhecimentos`), conhecimentos-ii (`areas`, `campos`, `conhecimentos`, `elementos`), habilidades (`dominios`, `categorias`, `habilidades`), atitudes (`categorias`, `atitudes`).
- A descrição de cada tool segue a seção 6 do plano: para que serve, quando usar, o que devolve e qual tool chamar em seguida. Mantenha as ressalvas que já existem (sigla de área não comparável, numeração com lacunas, duas taxonomias, cálculo derivado). Duas a quatro frases por tool.
- Cada tool ganha `title` legível ("Buscar ocupação", "Ficha da ocupação" etc.).

**Aceite.**
- `tools/list` não tem propriedade de entrada sem `description`.
- `dimensao` tem `enum` nas três tools.
- Toda tool tem `title`.

## T3. Reduzir o tamanho das respostas (prioridade média)

**Problema.** Algumas respostas passam do orçamento de contexto da seção 6.1 do plano:

| Chamada | Tamanho |
|---|---|
| `qbq_competencias {"codigo":"212405"}` | cerca de 35 KB |
| `ocupacao_obter` com os três `incluir` | cerca de 32 KB |
| `ocupacao_comparar` de duas ocupações | cerca de 15 KB, porque `em_comum` não tem limite |

O peso vem de repetir `caminho` e `fonte` completos em cada item.

**Esperado.**
- Em `qbq_competencias` e em `principais_competencias` de `ocupacao_obter`, cada item traz por padrão: `codigo`, `nivel_vocabulario`, `termo`, `descricao_item` (só quando houver), `graus`, `balde` e `fonte.linha`. `caminho` e o conceito completo só com `incluir_conceitos: true` ou com um novo parâmetro `detalhe: "completo"`.
- `ocupacao_comparar` ganha `limite` (padrão 20, máximo 50) para `em_comum` e para cada lista de `exclusivos`, ordenando `em_comum` pela maior diferença de importância. Informar o total antes do corte.
- Toda lista cortada traz em `avisos` quanto foi mostrado e como pedir o restante, como `ocupacao_buscar` já faz. Hoje `qbq_competencias` devolve `truncado: true` sem esse aviso.

**Aceite.**
- `qbq_competencias {"codigo":"212405"}` fica abaixo de 15 KB.
- `ocupacao_comparar` de duas ocupações fica abaixo de 8 KB e informa o total de termos em comum (42 para 212420 e 212405 em habilidades).
- Toda resposta com `truncado: true` tem aviso de como pedir o resto.

## T4. Rotular o sentido da diferença em `ocupacao_comparar` (prioridade média)

**Problema.** Para `{"codigos":["212420","212405"]}`, `diferenca.importancia` de COMPREENSÃO ORAL é 1: 212420 tem 5 e 212405 tem 4, logo o cálculo é primeiro menos segundo. Nada na resposta diz isso. Para a pergunta "o que falta para ir de A a B", o sinal sai invertido. Além disso, `graus` lista as ocupações em ordem de código, não na ordem pedida.

**Esperado.** Tratar o primeiro código como origem e os demais como destino. Cada diferença passa a ser `destino − origem`, num objeto rotulado: `{"de": "212420", "para": "212405", "importancia": -1, "frequencia": -1, "profundidade": null}`. `graus` mantém a ordem pedida. O texto de `metodo` e a descrição da tool explicam isso.

**Aceite.**
- Para `["212420","212405"]` em habilidades, PROGRAMAÇÃO DE OPERAÇÕES (02.02.02) tem diferença de importância +3 (de 2 para 5) e ANÁLISE DE OPERAÇÕES (02.02.01) tem +2 (de 3 para 5).
- Invertendo a ordem dos códigos, o sinal inverte.

## T5. `total` de `qbq_buscar_termos` precisa contar tudo o que foi achado (prioridade média)

**Problema.** `qbq_buscar_termos {"consulta":"direito ambiental","buscar_em":["vocabulario","conceito","descricao_item"]}` devolve `total: 0` no topo e `total_termos: 0`, mas `descricoes_item` tem várias ocorrências (Juiz de direito, Juiz federal…). O modelo lê o total e conclui que não há nada.

**Esperado.** O `total` do topo soma termos e descrições de item. Acrescentar `total_descricoes_item`. O resumo do texto (T1) diz quantos termos e quantas ocorrências em descrições de item foram achados. Quando só houver ocorrência em balde, o aviso explica que o assunto aparece como texto livre dentro de itens "outros", e não como termo do vocabulário.

**Aceite.** "direito ambiental" devolve `total > 0` e `total_descricoes_item > 0`.

## T6. Mensagem de erro de `cbo_navegar` com código de ocupação (prioridade média)

**Problema.** `cbo_navegar {"codigo":"212405"}` responde "A entrada "212405" não é um código CBO. O formato tem 1, 2, 3, 4 ou 6 dígitos…". O código existe e tem 6 dígitos; a tool é que só navega níveis de 1 a 4 dígitos.

**Esperado.** Com 6 dígitos válidos, devolver erro (ou resultado, como preferir; explique a escolha no plano) dizendo que a tool percorre grande grupo, subgrupo principal, subgrupo e família, e que para a ocupação deve-se usar `ocupacao_obter`, citando a família da ocupação (2124) para quem quiser navegar.

**Aceite.** A resposta para "212405" contém "ocupacao_obter" e "2124", e não contém "não é um código CBO".

## T7. Mensagens de erro de vocabulário (prioridade média)

**Problema.**
- `qbq_ocupacoes_por_competencia {"vocabulario":"habilidades","nivel":"habilidades","codigo":"99.99.99"}` responde "Valores aceitos para codigo: dominios, categorias, habilidades". Esses são valores de `nivel`, não de `codigo`.
- `qbq_vocabulario {"vocabulario":"habilidades","nivel":"xx","codigo":"01.01.01"}` diz só que o termo não existe em `habilidades/xx`, sem listar os níveis aceitos.

**Esperado.**
- Nível inválido: o erro lista os níveis daquele vocabulário.
- Código inexistente num nível válido: o erro diz que o código não existe naquele nível, informa em que outros níveis ele existe (se existir) e sugere `qbq_buscar_termos`.
- Nenhuma mensagem chama de "valores aceitos para codigo" uma lista de níveis.

**Aceite.** Os dois casos acima produzem as mensagens descritas.

## T8. Avisos e links pensados para o MCP (prioridade baixa)

**Problema.**
- `ocupacao_buscar {"consulta":"xyzqwe"}` devolve dois avisos quase iguais, e um deles manda o modelo a `/api/v1/atividades`, uma rota REST, em vez de `cbo_buscar_atividades`.
- Avisos e mensagens de erro usam caminhos relativos da API (`/api/v1/decisoes/D015`, "Veja /api/v1/cbo/familias/2124"), que dentro do MCP não levam a lugar nenhum.

**Esperado.**
- No MCP, avisos sem duplicata. Onde houver uma tool equivalente, citar a tool em vez da rota.
- `link` sempre absoluto (`https://cbo.ciencia.social/api/v1/...`), para que o modelo possa citar a fonte.
- Na API REST, os avisos continuam como estão, salvo o link absoluto, se você achar melhor nos dois lados (diga no plano).

**Aceite.**
- A busca vazia tem um aviso só, e ele cita `cbo_buscar_atividades`.
- Nenhum `link` em resposta do MCP começa com `/`.

## T9. Detalhes de protocolo do modo HTTP sem sessão (prioridade baixa)

**Problema.** O servidor não guarda sessão, mas `GET /mcp` com `accept: text/event-stream` abre um fluxo e responde 200, e `DELETE /mcp` responde 200. Num servidor sem sessão e sem notificações do servidor para o cliente, a especificação permite responder 405 nos dois casos. Isso evita que clientes fiquem esperando um fluxo que nunca manda nada. `capabilities.tools.listChanged` vem `true`, mas a lista nunca muda.

**Esperado.**
- `GET /mcp` com `text/event-stream` → 405 com `Allow: POST`.
- `GET /mcp` com `text/html` continua redirecionando para `/docs/mcp`.
- `DELETE /mcp` → 405.
- `listChanged: false`.

**Aceite.**
- Testes de rota para os três casos.
- Claude Code (`claude mcp add --transport http cbo-qbq https://cbo.ciencia.social/mcp`) continua conectando e listando as 15 tools depois do deploy de preview.

## T10. `fonte` com forma única (prioridade baixa, depende do repositório de dados)

**Problema.** `fonte.arquivo` aparece em três formas:
- `cbo2002-ocupacao.csv` em ocupações e sinônimos;
- `fontes/qbq/qbq-2025-03.xlsx` e `fontes/cbo/...` em perfis e QBQ;
- `qbq/qbq-2025-03.xlsx` em `dados_sobre {"topico":"fontes"}`.

Itens de competência não trazem `aba`. É a pendência 10.1.3 do plano.

**Esperado.** Normalizar na montagem da resposta, sem alterar `cbo-qbq-dados`, para a forma `fontes/<camada>/<arquivo>`, e incluir a `aba` nos itens de competência (Conhecimento I, Conhecimento II, Habilidade, Atitude, conforme a tabela de origem). Se a normalização exigir mudar o banco gerado por `scripts/construir-banco.ts`, descreva no plano antes.

**Aceite.**
- Toda `fonte.arquivo` em respostas da API e do MCP começa com `fontes/`.
- Itens de `qbq_competencias` trazem `aba`.

---

## Fora do escopo desta rodada

- Resources e prompts do MCP (etapa 4 do plano).
- A tool opcional `sql_consultar`.
- O modo local por stdio além do que os testes já cobrem.
