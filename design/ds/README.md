Este sistema vale para todo artefato de pesquisa publicado em um subdomínio de ciencia.social: relatórios, painéis e sites interativos. A primeira aplicação é a Iniciação Científica sobre plataformas de geração de código e o trabalho de pessoas desenvolvedoras no Brasil (2020–2026), FFLCH-USP.

A ideia que guia tudo é o papel de periódico acadêmico visto em uma tela. Fundo de papel, tinta escura, serifa para ler, sem serifa para os dados, fios finos no lugar de sombras. A cor é quase sempre neutra, para que a cor dos dados e o âmbar de um achado tenham significado quando aparecem.

## Regras que valem para todo artefato

1. Comece com `NetworkBar` e termine com `SiteFooter`. É isso que faz um subdomínio ser reconhecido como parte da rede.
2. Declare o estado do conteúdo com `Badge`: Rascunho, Preliminar, Em revisão, Consolidado, Retificado.
3. Todo número traz contexto: `n`, período e fonte. Use `SampleNote`, `StatTile` ou o `source` de `Figure`.
4. Todo gráfico vive em uma `Figure`, com Fonte abaixo e tabela de dados no `table`.
5. Número que não vem de dado real leva `Badge status="ilustrativo"`, sempre visível.
6. Participante aparece apenas por código (`P07`). Nunca nome, empresa ou dado que permita reconhecer alguém (Res. CNS 510/2016, LGPD, TCLE).
7. Declare o uso de IA com `Callout kind="ia"` no trecho em que ela foi usada, seguindo as orientações de CAPES e CNPq.

## Conteúdo e voz

Escreva em português do Brasil, em registro acadêmico claro, para quem lê com atenção mas não conhece a pesquisa. Prefira a afirmação com a sua evidência ao adjetivo.

- **Pessoa e sujeito.** Use construção impessoal ou "a pesquisa". Em textos sobre quem desenvolve, escreva "pessoas desenvolvedoras".
- **Justificativa.** Introduza com "pois", "já que" ou "porque", não com dois-pontos.
- **Pontuação.** Não use travessão nem meia-risca como parêntese; use parênteses ou vírgulas. A meia-risca fica para intervalos (2020–2026) e para a identificação de figura e tabela da ABNT (Figura 1 – Título).
- **Maiúsculas.** Só a primeira palavra de título, botão e rótulo: "Baixar os dados". Sobretítulo em maiúsculas vem de `t-meta`, nunca digitado assim.
- **Números.** Vírgula decimal e ponto de milhar: 1.284 e 11,5%. Sem espaço antes de `%`. Uma casa decimal no máximo, salvo necessidade do método. Dado ausente é `s/d`.
- **Datas.** "novembro de 2026", "2 de novembro de 2026". Ondas da pesquisa pelo ano: "onda 2025".
- **Citações.** Autor-data no corpo, (BRAUN; CLARKE, 2006). Lista final em `References`, conforme a ABNT NBR 6023:2025. Referência só entra depois de conferida na fonte.
- **Tom.** Sem exclamação, sem emoji, sem superlativo, sem chamada de marketing. Diga o limite dos dados com a mesma clareza do achado.

Exemplos de como soa:

> A amostra é de adesão voluntária e não representa o conjunto das pessoas desenvolvedoras do país.

> Baixar os dados · Ver o método · Como citar

## Cor

A superfície e o texto são `surface` e `ink`, que trocam de valor por tema; `papel` e `tinta` são os valores de identidade e não mudam. Trabalhe sempre com os nomes semânticos.

- **Superfícies.** Página em `surface`. Cartão de painel em `surface-raised`. Bloco de apoio em `surface-sunken`.
- **Texto.** `ink` para ler, `ink-2` para subtítulo e legenda, `ink-3` para metadados e Fonte. Os três passam de 4,5:1 sobre as três superfícies, nos dois temas.
- **Verde-oxidado é ação.** `accent` em link, botão primário e opção selecionada, com `on-accent` por cima.
- **Âmbar é destaque.** `ambar` e `ambar-wash` marcam o achado e nada mais, no máximo um por seção. `ambar` puro tem 3,4:1 sobre o papel, portanto serve para marca e preenchimento; para texto use `ambar-texto`.
- **Status tem cor reservada.** `status-ok`, `status-warn` e `status-danger` só aparecem com a palavra ao lado, e nenhum deles vira série de gráfico. "Consolidado" é azul, para sair do eixo vermelho-verde.
- **Foco.** `focus` em 2px sólido, afastado 2px do elemento. Já vem de `bundle.css`.

## Tipografia

Três famílias, com papéis que não se misturam. Todas têm licença aberta (OFL) e são servidas de `fonts/`, sem chamada a serviço externo, o que evita expor leitores a terceiros.

- **Source Serif 4** (`--font-serif`) para o que se lê: títulos e texto longo. Usa eixo óptico, então títulos ficam mais finos e o corpo mais robusto, sem esforço.
- **IBM Plex Sans** (`--font-sans`) para o que se opera e o que se mede: interface, tabelas, gráficos, números de destaque. Um número de destaque nunca é serifado.
- **IBM Plex Mono** (`--font-mono`) para o que se registra: sobretítulo (`t-meta`), nota de amostra, código de participante, identificadores.

Corpo de relatório é `t-body`, 18px em `width-prose`. Em tabela e eixo, algarismos tabulares; em número grande, proporcionais. As fontes cobrem o subconjunto latino, suficiente para o português.

## Espaço, forma e movimento

- **Grade.** Passos de 4px, de `space-1` a `space-9`. Margem de página em `space-6`, ou `space-4` em telefone.
- **Largura.** `width-prose` para ler, `width-report` para relatório com sumário, `width-dash` para painel e site.
- **Fios, não sombras.** `line` separa, `line-strong` delimita controles. Sombra existe uma vez só, `shadow-tooltip`.
- **Cantos.** Quase retos: `radius-sm` em tudo, `radius-md` na ponta de barra de gráfico. Sem pílulas.
- **Controles.** `TextInput`, `Select`, `Button` e `SegmentedControl` têm a mesma altura, `control-height` (44px), que também é o alvo mínimo de toque. Lado a lado, eles se alinham sem ajuste.
- **Blocos.** `Callout` e cartões não usam filete lateral colorido. O bloco se distingue pelo fundo e pelo rótulo em `t-meta`.
- **Movimento.** Nenhuma animação de interface. Interações mudam de estado de imediato. A exceção é a ilustração demonstrativa (uma conversa simulada, por exemplo), que pode se mover desde que tenha botão de pausa e fique parada por inteiro com `prefers-reduced-motion`.

## Dados e gráficos

A forma vem antes da cor: pergunte qual é a tarefa do dado (evolução, comparação, escala de concordância, um número só). Use `LineChart`, `BarChart`, `LikertChart` e `StatTile`. Para outras formas, use qualquer biblioteca com `CS.palette()` e as regras abaixo.

- **Identidade:** `data-1` a `data-8`, sempre nessa ordem e sempre presos à entidade. Um filtro nunca repinta quem continua na tela. Da nona série em diante, agrupe em Outros ou use pequenos múltiplos.
- **Dispersão, mapas e pequenos múltiplos:** até três séries (`data-1` a `data-3`), porque qualquer par de cores pode se encostar. Nesses casos, acrescente rótulo direto ou forma, pois a separação para daltonismo fica no limite mínimo.
- **Grandeza:** `seq-1` a `seq-7`, um matiz, do menor ao maior.
- **Polaridade:** `div-neg-2` a `div-pos-2`, âmbar e petróleo com cinza no meio, nunca vermelho contra verde.
- **Marcas:** linha de 2px, ponto de 8px, barra de até 20px com ponta de 4px e reta na base, grade em `line`.
- **Texto:** nunca na cor da série. A marca colorida fica ao lado do texto em `ink-2`.
- **Eixo:** um só. Barras partem de zero.
- **Acesso:** legenda a partir de duas séries, rótulo direto até quatro, tabela sempre.

`data-1` é um passo saturado do verde-oxidado, porque o valor exato da marca tem pouco croma para identificar uma série. A ordem das oito cores foi escolhida por um validador de separação para daltonismo, nos dois temas, e não deve ser alterada.

## Código

Trecho de código vai em `CodeBlock`, com realce por token e botão de copiar. Linguagens: `json`, `bash`, `python`, `js` e `text`. As cores vêm de `code-key`, `code-string`, `code-number`, `code-keyword`, `code-comment` e `code-punct`, todas acima de 5:1 sobre `surface-sunken` nos dois temas. O realce não troca a fonte: tudo em IBM Plex Mono.

## Logo e iconografia

Os arquivos da logo ainda não estão no sistema. Assine com `Wordmark` e não redesenhe a marca. Quando os SVGs entrarem em `assets/Logos`, eles passam a valer.

Os ícones vêm do Lucide 0.460.0 (licença ISC), embutidos em `bundle.js`: 61 desenhos de traço, sem preenchimento, na cor do texto. Use `Icon` em React ou `CS.icon(nome)` em HTML; `CS.icons` lista os nomes.

- O ícone acompanha a palavra e não a substitui: "Tema escuro" com a lua, "Copiar" com as folhas, "Buscar" com a lupa. Botão só com ícone leva `aria-label`.
- 16px em texto e controles, 20px em cabeçalho de cartão. Traço de 1,75.
- Cor do texto ao lado, ou `accent` quando o ícone faz parte de um link ou ação. Nunca a cor de uma série de dados.
- Um ícone por rótulo. Nada de ícone decorativo em parágrafo, título de relatório ou figura.
- Sem emoji. Setas e sinais tipográficos (`→`, `·`) continuam aceitos em texto.

## Tipos de artefato

Cada tipo tem um modelo pronto, em Modelos.

- **Relatório** (`ModeloRelatorio`): `NetworkBar`, `ReportHeader`, `Toc` e `Prose` em `.cs-report-layout`, `References`, `SiteFooter`. Precisa imprimir bem: `bundle.css` esconde a navegação, abre os `Disclosure` e `CS.theme.init()` força o tema claro.
- **Painel** (`ModeloPainel`): `NetworkBar`, título em `t-h1`, `SampleNote`, `FilterBar`, fileira de `StatTile`, grade `.cs-grid` de `Figure variant="card"`, `SiteFooter`. No máximo um `StatTile hero` por vista.
- **Site interativo** (`ModeloRede`): `NetworkBar`, abertura com as classes `cs-rhead`, conteúdo em `.cs-page`, `SiteFooter`. Para a parte interativa, use os controles de `Controles` e mantenha a Fonte em cada resultado.

## Como usar em um subdomínio

Mantenha uma cópia única e versionada de `tokens.css`, `components/bundle.css`, `components/bundle.js` e `fonts/`, e faça todos os artefatos apontarem para ela. Assim, uma correção chega a todos de uma vez. Em todas as formas abaixo, o tema começa por `CS.theme.init()`. Um artefato pode escolher o tema inicial com `CS.theme.init({ padrao: 'dark' })`; a escolha salva por quem lê continua valendo.

Em HTML e CSS puro, cada componente traz a marcação pronta no próprio README. `bundle.js` não exige React para `CS.theme` e `CS.charts`:

```html
<link rel="stylesheet" href="/ds/v1/tokens.css">
<link rel="stylesheet" href="/ds/v1/bundle.css">
<script src="/ds/v1/bundle.js"></script>
<script>CS.theme.init();</script>
```

Em React 18, carregue os mesmos arquivos e use os componentes de `window.CS`. Eles geram exatamente as classes do HTML puro, portanto os dois caminhos ficam visualmente iguais:

```jsx
const { NetworkBar, Figure, LineChart } = window.CS;
```

Em Quarto ou Observable, aplique `cs-prose` ao corpo do documento e use `CS.palette()` no tema dos gráficos:

```js
const p = CS.palette();
Plot.line(dados, { x: 'onda', y: 'uso', stroke: 'perfil' }).plot({ color: { range: p.categorical } });
```

## Antes de publicar

- O artefato começa com `NetworkBar` e termina com `SiteFooter`.
- O status está visível e correto.
- Cada figura tem Fonte e tabela. Cada número tem `n` e período.
- Nada identifica participante.
- O uso de IA está declarado.
- As referências foram conferidas na fonte.
- Funciona nos dois temas, em telefone, no teclado e impresso.
