# Handoff: site de cbo.ciencia.social

Especificação do site que vai na raiz de `cbo.ciencia.social`, ao lado da API REST e do servidor MCP que este repositório já serve. Ela descreve **o que** construir (páginas, conteúdo, comportamento, aparência) a partir das telas desenhadas no canvas de design. O **como** (componentização, testes, detalhes de Next.js) fica a cargo de quem implementa, dentro das decisões listadas abaixo.

Documentos de referência, em ordem de autoridade:

1. Este arquivo.
2. `design/telas/*.dc.html`: as telas desenhadas, com textos, estrutura e valores exatos de espaçamento e tipografia.
3. `design/ds/`: o design system ciencia.social (tokens, CSS dos componentes, código de referência dos componentes e o guia de uso).
4. `docs/plano-api-mcp-cbo-qbq.md`: o plano da API e do MCP. É a especificação dos dados que o site mostra.

## 1. Ponto de partida

O repositório já tem:

- Next.js 15 (App Router), React 19, Node 22, TypeScript, Vitest.
- O núcleo de consulta em `src/consulta/*` (SQLite gerado de `cbo-qbq-dados` por `scripts/construir-banco.ts`).
- A API REST em `app/v1/[[...caminho]]/route.ts`, roteada por `src/http/rotas.ts` e `src/http/dispatcher.ts`, com o registro de rotas (ids R01–R62) que também gera o OpenAPI.
- O servidor MCP em `app/mcp/route.ts` (HTTP) e `src/mcp/stdio.ts`.
- `app/route.ts`, que hoje devolve um JSON na raiz.
- `public/llms.txt` e `public/llms-full.txt`.
- Testes de aceite em `test/aceite.test.ts`.

Não há interface. Este handoff acrescenta o site sem mudar o comportamento da API e do MCP, exceto o prefixo da API (seção 3).

## 2. Decisões já tomadas

1. **Endereços.** Site na raiz. API em `/api/v1`. MCP em `/mcp`.
2. **Tema escuro é o padrão**, com troca para claro. A escolha de quem visita fica em `localStorage` (chave `cs-tema`) e vale nas visitas seguintes. Sem flash do tema errado ao carregar.
3. **O design system ciencia.social é a fonte visual.** Use as classes de `design/ds/bundle.css` e as variáveis de `design/ds/tokens.css`; não invente cores, raios, sombras ou fontes.
4. **Sem "Fonte: ..." no conteúdo das páginas e sem códigos de decisão (D004, D015…) no texto corrido.** A origem dos dados aparece só em `/sobre` e no rodapé. Exceção: a documentação da API mostra os códigos de aviso, porque são valores que a API devolve.
5. **Texto oficial intocado.** Títulos, sinônimos, atividades e termos aparecem com a caixa e a grafia da fonte (maiúsculas, erros de digitação). A busca ignora caixa e acento; a exibição não muda nada.
6. **CBO e QBQ nunca são reconciliados.** Quando divergem, os dois valores aparecem lado a lado, identificados pela camada.
7. **Ausência é dado.** Ocupação sem nível, sem perfil ou ausente de uma camada mostra a situação e, quando existe, a justificativa oficial. Nunca uma lista vazia sem explicação.
8. **Derivado é marcado.** Similaridade, rankings, médias e contagens de uso levam o selo "Derivado, não oficial".
9. **Botão de tema só com ícone** (sol no escuro, lua no claro), com o rótulo "Tema claro" ou "Tema escuro" visível apenas para leitor de tela.
10. **Títulos com a mesma largura do subtítulo** abaixo deles, não limitados em caracteres.
11. **Português do Brasil**, no tom do `design/ds/README.md` (sem exclamação, sem marketing, vírgula decimal, ponto de milhar).

## 3. Mudança de prefixo da API: `/v1` → `/api/v1`

Feita antes do site, em um commit próprio:

- Mover `app/v1/[[...caminho]]` para `app/api/v1/[[...caminho]]`.
- Trocar o prefixo em `src/http/dispatcher.ts`, nos links e no OpenAPI gerado por `src/http/rotas.ts`, nos `tipo` de `Problema` (`/api/v1/problemas/...`), em `next.config.ts` (`outputFileTracingIncludes`), em `public/llms*.txt`, no `README.md` e em `test/aceite.test.ts`.
- Manter `/v1/*` respondendo com redirecionamento permanente (308) para `/api/v1/*`, para não quebrar quem já usa.
- O índice JSON que hoje está em `app/route.ts` passa a viver só em `GET /api/v1`. A raiz vira a home do site.
- Rodar a suíte de aceite: todos os valores do gabarito precisam continuar iguais.

## 4. Como ler as telas (`design/telas`)

Os arquivos `.dc.html` estão no formato do editor de design, não em código de produção. Use-os como especificação:

- `<x-import component-from-global-scope="CS.NetworkBar" …>` é o componente `NetworkBar` do design system, com as props escritas em kebab-case (`artifact-href` = `artifactHref`). O código de referência de cada componente está em `design/ds/bundle.js`; a marcação que ele gera usa só as classes de `bundle.css`.
- `<sc-for list="{{x}}" as="i">` é um laço; `<sc-if value="{{x}}">` é uma condição; `{{x}}` é um valor calculado em `renderVals()`, no `<script>` ao fim de cada arquivo.
- Os dados dentro de `renderVals()` (ocupações, contagens, graus, conceitos) são **reais**, tirados de `dados-2026.11.1`. No site, eles vêm do banco pelo núcleo de consulta, nunca escritos à mão. Servem de gabarito para conferir o resultado.
- Os estilos inline trazem os valores exatos (espaçamento, tamanho e peso de fonte). `site.css` traz as peças que o design system não tem (`x-…`).
- `componentDidMount` em cada tela chama `CS.theme.init({ padrao: 'dark' })`: é a decisão 2.

Não há capturas de tela neste pacote. Para ver as telas renderizadas, peça ao Wil acesso ao canvas ou capturas.

| Tela | Arquivo | Rota |
|---|---|---|
| Início | `Main.dc.html` | `/` |
| Ocupações | `Ocupacoes.dc.html` | `/ocupacoes` |
| Ficha da ocupação | `Ocupacao.dc.html` | `/ocupacoes/[codigo]` |
| Competências | `Competencias.dc.html` | `/competencias` e `/competencias/[vocabulario]/[nivel]/[codigo]` |
| Documentação da API | `Docs.dc.html` | `/docs` e `/docs/[...rota]` |
| Guia do MCP | `Mcp.dc.html` | `/docs/mcp` (não `/mcp`, que é o endpoint do servidor) |
| Sobre os dados | `Sobre.dc.html` | `/sobre` |

O item "MCP" do menu aponta para `/docs/mcp`. Opcional: um `GET /mcp` vindo de navegador (aceita `text/html` e não traz cabeçalhos de cliente MCP) pode redirecionar para `/docs/mcp`, desde que os clientes MCP continuem funcionando.

## 5. Arquitetura recomendada

- **Páginas como Server Components que chamam `src/consulta` diretamente.** Não fazer `fetch` para a própria API. Mesmo núcleo, mesmos números, sem ida e volta HTTP.
- **Client Components só onde há interação:** troca de tema, `SegmentedControl` e abas, botão de copiar do `CodeBlock`, "Testar a rota" da documentação, animação da home, disclosures com estado. Filtros e busca vivem na URL (`searchParams`), para que toda vista tenha endereço próprio e funcione sem JavaScript.
- **Design system portado para TSX**, numa pasta própria (por exemplo `src/ui/`), gerando exatamente a marcação e as classes de `bundle.js`. Importar `design/ds/tokens.css`, `design/ds/bundle.css` e `design/telas/site.css` (ou cópias deles em `app/`) no layout raiz. Não carregar `bundle.js` no navegador: ele depende de React 18 em `window` e o repositório usa React 19.
- **Ícones:** copiar o mapa `ICONS` e o componente `Icon` de `bundle.js` (Lucide 0.460.0, licença ISC em `design/ds/LICENSE-lucide.txt`). Traço de 1,75, 16px em texto e 20px em cabeçalho de cartão.
- **Realce de código:** portar a função `highlight()` de `bundle.js` para TypeScript e renderizar os tokens no servidor, com as classes `cs-tk-*`. Sem biblioteca externa.
- **Fontes:** Source Serif 4 (eixo óptico, normal e itálico), IBM Plex Sans (400, 500, 600 e 400 itálico) e IBM Plex Mono (400, 500), subconjunto latino, servidas pelo próprio site (`next/font` faz isso no build). Ligar às variáveis `--font-serif`, `--font-sans` e `--font-mono`. As regras `@font-face` do topo de `design/ds/tokens.css` apontam para arquivos `fonts/*.woff2` que não estão neste pacote: remova-as na cópia usada pelo site.
- **Tema sem flash:** um script curto no `<head>`, antes da pintura, lê `localStorage['cs-tema']` (padrão `dark`) e aplica `data-theme` em `<html>`. Na impressão, sempre claro (o `bundle.js` mostra como).
- **Metadados:** `<title>` e descrição por página, `lang="pt-BR"`, Open Graph simples. A ficha da ocupação usa o código e o título.

## 6. Estrutura comum a todas as páginas

- **`NetworkBar`** no topo: wordmark "ciencia.social" (link para `https://ciencia.social`), barra, nome "CBO e QBQ" (link para `/`), links Ocupações, Competências, API (`/docs`), MCP (`/docs/mcp`), Sobre, e o botão de tema só com ícone. O link da seção atual leva `aria-current="page"`.
- **`SiteFooter`** no fim, com a nota "Dados abertos da Classificação Brasileira de Ocupações e do Quadro Brasileiro de Qualificações, a partir de publicações oficiais do Ministério do Trabalho e Emprego." e três colunas (Pesquisa, Artefato, Para máquinas), como em `Main.dc.html`. A versão dos dados no rodapé vem de `src/versao.ts`, não escrita à mão.
- **Selo "Preliminar"** no topo da home e do guia do MCP enquanto o site não for lançado.
- Largura de página `.cs-page` (88rem + margens) em todas, inclusive `/sobre`.
- Funciona em 390px de largura: colunas empilham (`x-stack-sm`), tabelas largas rolam dentro de `.cs-table-scroll`, o menu quebra linha.

## 7. Páginas

### 7.1 Início (`/`)

Seções, na ordem de `Main.dc.html`:

1. **Abertura em duas colunas.** À esquerda: sobretítulo, título, subtítulo, busca (campo e botão "Buscar" **sempre na mesma linha**) que leva a `/ocupacoes?q=`, exemplos de busca e dois botões ("Conectar ao seu assistente" → `/docs/mcp`, "Usar a API" → `/docs`). À direita: a ilustração da conversa (7.1.1).
2. **O que há no conjunto:** quatro `StatTile` com valores de `estatisticas()` (R60): ocupações (união das camadas, 2.698), atividades, itens de competência (soma de conhecimentos, habilidades e atitudes) e sinônimos.
3. **Para quem é:** quatro cartões com ícone, público, pergunta, texto e link com seta.
4. **Navegar a CBO** (lista dos 10 grandes grupos com total de ocupações, título oficial em maiúsculas) e **Explorar o QBQ** (os quatro vocabulários, com ícone e totais por nível, de R40).
5. **Para quem desenvolve:** à esquerda, exemplo da API com `SegmentedControl` (curl, Python, JavaScript) e `CodeBlock` colorido, mais a resposta JSON real de `GET /api/v1/ocupacoes/212405` (trecho); à direita, o comando do MCP, a lista de seis tools e a instrução para colar no assistente com botão "Copiar instrução".
6. **Como os dados se encaixam:** quatro blocos com ícone (CBO onde se situa, Ocupação, CBO o que faz, QBQ o que exige).
7. **Princípios** (quatro, com ícone) e o `Callout` "Limite dos dados" com as contagens de divergência e o link para `/sobre`.

#### 7.1.1 Ilustração da conversa

Janela com barra ("Assistente · conectado a cbo.ciencia.social/mcp"), corpo e um campo falso no rodapé. A janela inteira é decorativa (`aria-hidden`); a `<figure>` tem `aria-label` que descreve a ilustração.

- **Três conversas**, com os textos exatos de `Main.dc.html` (`this.conversas`): sinônimo ("programador de internet" → 3171-05), transição (suporte → desenvolvimento, similaridade 0,913, duas habilidades que sobem de importância) e validação ("2124-99 existe?" → não; família 2124 com 6 ocupações). Os números precisam bater com o banco: escreva um teste que confira cada um.
- **Ritmo** (um passo a cada 60ms): a pergunta é digitada a 2 caracteres por passo; 8 passos depois aparece a chamada da tool ("→ consultando"); 14 passos depois, o resultado da tool; 6 passos depois começa a resposta, digitada a 4 caracteres por passo; 4 passos depois, o cartão de resultado; 6 depois, a frase final; 80 passos de pausa e a próxima conversa. Um cursor fino aparece enquanto há digitação.
- **Abaixo da janela, só uma linha fina** dividida em três colunas, uma por conversa: a da conversa atual se preenche conforme o tempo passa, as anteriores ficam cheias, as seguintes vazias. Sem texto. Cada coluna é um botão (com `aria-label` "Conversa 1 de 3: sinônimo" etc.) que pula para aquela conversa.
- **Pausa:** a animação para enquanto o ponteiro está sobre a ilustração e quando ela recebe foco. Com `prefers-reduced-motion: reduce`, nada se move: mostra a primeira conversa completa.
- A animação roda só no navegador e não pode atrasar a primeira pintura.

### 7.2 Ocupações (`/ocupacoes`)

- **Busca** (campo e botão na mesma linha) em títulos e sinônimos, com `FilterBar`: grande grupo, nível de qualificação, situação no QBQ e "Buscar em" (título e sinônimo, também a síntese, atividades). Tudo em `searchParams`; busca por atividade usa `buscarAtividades` (R32).
- **Árvore da CBO** à esquerda, de `listarNivel`/`arvore` (R10–R16), aberta até o prefixo selecionado (`?prefixo=2124`), com total de ocupações por nó. Títulos oficiais como vêm.
- **À direita**, conforme o estado:
  - com prefixo de família: a tabela das ocupações da família (código formatado, título com link, nível QBQ, situação no QBQ);
  - com busca: resultados de `listarOcupacoes`/`buscarSinonimos` (R20, R31), mostrando onde casou (título ou sinônimo e o texto do sinônimo), código, título CBO, família e nível. Um sinônimo pode apontar para mais de uma ocupação. Paginação de 20.
  - sem resultado: mensagem com a sugestão de buscar pelo que se faz na ocupação.
- Gabarito: `programador` devolve 17 sinônimos (critério 6 do plano); a família 2124 tem 6 ocupações.

### 7.3 Ficha da ocupação (`/ocupacoes/[codigo]`)

- Aceita `212405`, `2124-05` e `2124 05`; a forma canônica da URL é `212405` (redirecionar as outras). Código bem formado e inexistente mostra uma página 404 que diz até onde o código existe e lista o que há no ancestral (o mesmo conteúdo do erro da API). Código malformado mostra o formato esperado.
- **Caminho** na CBO (2 → 21 → 212 → 2124) com links para `/ocupacoes?prefixo=…`.
- **Abertura:** sobretítulo com o código, selos de situação no QBQ e de divergência de título, título, início da síntese do QBQ e um `dl` com nível de qualificação, os três níveis (conhecimento, habilidade, atitude), taxonomia de conhecimento e contagens. Fonte de `obterOcupacao` (R21).
- **As duas fontes lado a lado:** cartão CBO (título, sinônimos como selos, vigência) e cartão QBQ (título, síntese, perfil ocupacional completo em `Disclosure`). Quando uma camada falta, o cartão diz isso e por quê.
- **O que faz (CBO):** áreas de competência em `Disclosure` (a primeira aberta), atividades com o número da fonte (com lacunas, sem renumerar), `SegmentedControl` para as áreas transversais Y e Z (incluir, excluir, somente). Ocupação sem perfil: mensagem com o motivo (R23).
- **O que exige (QBQ):** `SegmentedControl` entre habilidades, conhecimentos e atitudes com os totais; tabela por importância decrescente com código, termo (link para a página do termo), definição oficial em linha menor, frequência e importância com a escala de cinco quadrados (`x-grade`), profundidade em conhecimentos, e o selo "balde “outros”" com a descrição da linha. Limite de 20 por dimensão, com link para ver todas (R24).
- **Ocupações parecidas:** selo "Derivado, não oficial", `Figure` com `BarChart` do índice de Jaccard das 5 mais próximas (R25) e a tabela em `Disclosure`; botão para comparar com outra ocupação (R26).
- **Como citar:** `Callout` com a citação sugerida e a data de acesso do dia.
- Gabarito: 212405 tem caminho 2 → 21 → 212 → 2124, níveis 5/5/5/5, 10 sinônimos, 10 áreas, 79 atividades, 62 conhecimentos, 46 habilidades, 4 atitudes; similares 212415 (0,955), 212420 (0,913), 212410 (0,911), 212310 (0,891), 212315 (0,870). Teste também 010105 (não classificada, com justificativa), 113005 (sem nível e sem justificativa), 516140 (só no QBQ) e 114210 (título divergente, os dois títulos visíveis).

### 7.4 Competências (`/competencias`)

- `SegmentedControl` dos quatro vocabulários e busca de termo, conceito ou descrição de item (R41, R44, R45).
- **Árvore do vocabulário** à esquerda, navegada pelo campo `pai` (nunca por prefixo de código), com o nível na URL (`/competencias/habilidades/habilidades/01.03.05`). Os baldes "outros" aparecem marcados.
- **Página do termo** (R42): caminho, conceito oficial em destaque (ou o motivo de não haver, quando for balde ou de outra dimensão), conceito da categoria em `Disclosure`; **uso nas ocupações** com selo derivado: três `StatTile` (ocupações que exigem, importância média, quantas com importância 5), dois `BarChart` (por nível de qualificação e por grande grupo, rótulos "Nível 3", "Grande grupo 2") com tabela em `Disclosure`, e a tabela de ocupações que exigem o termo (R43), com filtros de importância mínima e grande grupo.
- `Callout` sobre as duas taxonomias de conhecimento, que não se comparam.
- Gabarito: 01.03.05 (raciocínio crítico) aparece em 770 ocupações, importância média 4,5, 495 com importância 5. `conhecimentos-i/conhecimentos/01.01.02` com importância mínima 4 devolve 29 ocupações (critério 14 do plano).

### 7.5 Documentação (`/docs` e `/docs/[...rota]`)

- Barra lateral com busca e os grupos de rotas **gerados do registro de `src/http/rotas.ts`** (fonte única com o OpenAPI). Página de entrada `/docs` com introdução, URL base, convenções (entrada de código, paginação, envelope `dados`/`meta`/`links`, avisos, erros em `application/problem+json`, limite de taxa).
- **Uma página por rota**, no formato de `Docs.dc.html`: método e caminho, selo da etapa, título, descrição, `dl` com URL base, autenticação e tool MCP equivalente; tabela de parâmetros; bloco **Testar a rota** (campo do código e demais parâmetros na mesma altura, botão "Executar" que chama `/api/v1` de verdade e mostra a requisição em curl e a resposta em `CodeBlock` JSON colorido, com status e tipo); campos da resposta; erros; avisos (aqui aparecem os códigos de aviso, por serem valores da API); links para a rota anterior e a seguinte; sumário "Nesta página" e links para `openapi.json`, `llms.txt` e o guia do MCP.

### 7.6 Guia do MCP (`/docs/mcp`)

Como em `Mcp.dc.html`: abertura, abas por cliente (Claude Code, Claude, Cursor, VS Code, local por stdio) com `CodeBlock` na linguagem certa; as instruções que o servidor envia ao modelo (as mesmas de `src/mcp/servidor.ts`, lidas de lá); tabela das 15 tools com filtro por grupo, gerada da lista do servidor; exemplo de encadeamento; prompts e resources; barra lateral com os dois modos e o orçamento de contexto. O comando do modo local depende do pacote ainda não publicado: deixe como está no design, entre colchetes, até existir.

### 7.7 Sobre os dados (`/sobre`)

`ReportHeader` e, abaixo, o texto à esquerda e o sumário (`Toc`) com links ao repositório e aos downloads numa coluna à direita (não usar `.cs-report-layout`). Seções: versões por camada (de R02), cobertura entre as camadas (de R51, com o exemplo 114210), aviso sobre o texto literal "NULL" em 54 sínteses, decisões de modelagem (de R04, cada uma com link para o texto completo), licença e como citar, e a declaração de uso de IA, cujo texto o Wil vai escrever (manter o marcador entre colchetes).

## 8. Critérios de aceite

1. Os testes de aceite existentes passam com o prefixo `/api/v1`; `/v1/*` redireciona.
2. Cada página renderiza para os códigos de exemplo da seção 7 sem erro, e os números conferem com o gabarito.
3. Tema escuro na primeira visita, troca persistida, sem flash, impressão em claro.
4. Nenhum "Fonte:" nem código de decisão no conteúdo fora de `/sobre` e da documentação de avisos.
5. Textos oficiais idênticos aos do banco (teste por amostragem: título de grande grupo em maiúsculas, "TÉCNICOS DE NIVEL MÉDIO" sem acento em "NIVEL", "RACIOCÍONIO CIENTÍFICO").
6. Busca e campo "Buscar" na mesma linha; todos os controles com 44px de altura.
7. Acessível pelo teclado, foco visível, contraste do design system, rótulos em todos os campos, botões só de ícone com nome acessível.
8. Funciona em 390px e em 1440px.
9. Números no formato brasileiro (2.698; 0,913; 4,5).

## 9. Ordem de entrega sugerida

1. Prefixo `/api/v1` e redirecionamento.
2. Layout raiz, fontes, tema e o design system em TSX (`NetworkBar`, `SiteFooter`, `Button`, `TextInput`, `Select`, `SegmentedControl`, `FilterBar`, `Badge`, `StatTile`, `Callout`, `Disclosure`, `Toc`, `Figure`, `BarChart`, `DataTable`, `CodeBlock`, `Icon`).
3. Ficha da ocupação e Ocupações.
4. Início (com a ilustração).
5. Competências.
6. Documentação e guia do MCP.
7. Sobre.
