# Prompt para o agente de código

Cole o texto abaixo no agente (Claude Code ou outro), aberto na raiz deste repositório.

---

Vamos construir o site de cbo.ciencia.social neste repositório. Hoje ele só serve a API REST (`/v1`) e o servidor MCP (`/mcp`), sem interface.

Leia, nesta ordem, antes de escrever código:

1. `design/HANDOFF.md`: a especificação do site, com as decisões já tomadas, as rotas, o conteúdo de cada página e os critérios de aceite.
2. `design/telas/*.dc.html`: as telas desenhadas. Estão no formato de um editor de design (a seção 4 do handoff explica como ler). Use-as como especificação de estrutura, texto e valores de estilo, não como código para copiar.
3. `design/ds/README.md`, `design/ds/tokens.css`, `design/ds/bundle.css` e `design/ds/bundle.js`: o design system ciencia.social. As páginas usam essas classes e variáveis; os componentes devem gerar a mesma marcação de `bundle.js`.
4. `docs/plano-api-mcp-cbo-qbq.md`: o plano da API e do MCP, que define os dados.

Depois, antes de implementar, me mostre um plano curto com:

- a estrutura de pastas e componentes que você vai criar;
- como as páginas vão chamar `src/consulta` (sem fazer fetch para a própria API);
- o que muda para mover a API de `/v1` para `/api/v1`;
- qualquer ponto do handoff que pareça ambíguo ou em conflito com o código existente.

Espere minha aprovação do plano. Então implemente na ordem da seção 9 do handoff, um commit por etapa, rodando `npm test` a cada etapa. Para cada página, escreva testes que conferem os números do gabarito da seção 7 contra o banco. Ao terminar cada etapa, me diga o que ficou pronto e como ver no `npm run dev`.

Regras que não mudam:

- Textos oficiais aparecem exatamente como estão no banco (caixa, grafia, erros de digitação).
- CBO e QBQ nunca são reconciliados; divergência e ausência são mostradas e explicadas.
- Nada de "Fonte:" nem códigos de decisão (D0xx) no conteúdo, exceto em `/sobre` e na documentação dos avisos da API.
- Tema escuro por padrão, com troca e sem flash.
- Não adicione dependências sem me perguntar.
