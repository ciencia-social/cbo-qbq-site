# Plano de recursos da API REST e de tools do servidor MCP — CBO e QBQ

Documento de especificação funcional para o repositório que servirá os dados do `cbo-qbq-dados` por API REST e por servidor MCP, nos moldes do bncc.dev. Ele define **o que** expor (recursos, parâmetros, formas de resposta, tools, erros e casos de teste) e não **como** construir a aplicação (stack, hospedagem, estrutura de pastas ficam a cargo do agente de código).

Base de dados de referência: `dados-2026.11.1` · `schema-v0.3.0`. Todo número citado aqui foi conferido em `derivados/qbq.sqlite` e nos JSON de `dados/` dessa versão; a seção 9 reúne os que servem de gabarito de teste.

## 1. Para quem e para responder o quê

As tools e os recursos foram derivados das perguntas abaixo, não das tabelas. Cada pergunta aponta para o recurso (R..) e a tool que a responde.

| Quem | Pergunta típica | Recurso | Tool MCP |
|---|---|---|---|
| Qualquer pessoa | "Qual é o código CBO de programador?" (nome de mercado → código oficial) | R20, R31 | `ocupacao_buscar` |
| Qualquer pessoa | "O que faz e o que exige a ocupação 2124-05?" | R21, R23, R24 | `ocupacao_obter`, `cbo_atividades`, `qbq_competencias` |
| Pesquisador(a) com RAIS, CAGED ou PNAD | "Esta lista de códigos CBO é válida? A que família e grande grupo pertence cada um?" | R17 | `codigo_decodificar` |
| Pesquisador(a) | "Como se distribuem os níveis de qualificação no grande grupo 2?" | R18, R61 | `cbo_resumir_grupo` |
| Pesquisador(a) | "Quais ocupações exigem BANCO DE DADOS com importância ≥ 4?" | R43 | `qbq_ocupacoes_por_competencia` |
| RH e recrutamento | "Em que ocupação se encaixa uma vaga cuja tarefa é 'elaborar planejamento de testes'?" | R32 | `cbo_buscar_atividades` |
| Orientação de carreira | "Que ocupações têm perfil parecido com a minha? O que me falta para migrar de A para B?" | R25, R26 | `ocupacao_similares`, `ocupacao_comparar` |
| Educação profissional | "O que significa a habilidade 'aprendizado ativo' no QBQ?" | R42, R44 | `qbq_vocabulario` |
| Quem desenvolve | Campo de autocompletar ocupação em formulário | R27 | — |
| Agente de IA | "Este código existe ou eu o inventei?" | R17 | `codigo_decodificar` |
| Qualquer pessoa | "Por que esta ocupação não tem nível no QBQ? Por que os títulos diferem?" | R46, R50 | `cobertura_consultar` |
| Qualquer pessoa | "De onde vêm estes dados, de que data, como citar?" | R02, R03 | `dados_sobre` |

## 2. Princípios que a API herda do dataset

1. **Nada é inventado nem reconciliado.** Quando CBO e QBQ divergem sob o mesmo código, a resposta traz os dois valores lado a lado, rotulados por camada. A API não escolhe título "correto" (D015).
2. **Ausência é dado.** Ocupação sem nível QBQ, sem perfil ou sem sinônimo responde com campo explícito de situação e, quando existe, a justificativa oficial — nunca com lista vazia sem explicação.
3. **Proveniência em cada registro.** Todo registro carrega `fonte` (arquivo, aba, linha) e toda resposta carrega `versao_dados`.
4. **Oficial e derivado não se misturam.** Similaridade, rankings, médias e "o que distingue um grupo" são cálculos deste projeto, não da fonte oficial. Vivem em rotas e tools identificadas, com `"derivado": true` e o método descrito na resposta.
5. **Código é string.** `"010105"` com zero à esquerda. A entrada aceita variações (seção 4.3); a saída é sempre canônica.
6. **As duas taxonomias de conhecimento nunca são fundidas** (D004). Toda resposta que cita um conhecimento diz de qual taxonomia ele é.
7. **Texto oficial intocado.** Caixa, grafia e erros de digitação da fonte são preservados (D002, D013). A busca é que ignora caixa e acento, não o dado.
8. **Determinismo.** Mesma versão de dados, mesma consulta, mesma resposta. Sem busca semântica por embeddings na v1.

## 3. O que os dados impõem (fatos conferidos)

O agente de código precisa conhecer estes fatos antes de desenhar tipos, chaves e consultas. Todos foram verificados em `dados-2026.11.1`.

| # | Fato | Consequência para API e MCP |
|---|---|---|
| F1 | O universo de códigos de ocupação é a **união** das camadas: 2.698 códigos (2.694 na CBO + 4 só no QBQ). | `/ocupacoes` cobre os 2.698. Uma ocupação pode ter `cbo: null` (4 casos) ou `qbq: null` (25 casos). |
| F2 | Situação no QBQ dos 2.698: `classificada` 2.618 · `nao_classificada` 52 (com justificativa oficial) · `sem_nivel_sem_justificativa` 3 (D010: 113005, 113010, 113015) · `ausente_no_qbq` 25. | Campo enumerado `situacao_qbq` em toda ocupação, e filtro por ele. |
| F3 | Divergências entre camadas: 25 `so_cbo`, 4 `so_qbq`, 35 `titulo_divergente`. | `titulo_cbo` e `titulo_qbq` são campos distintos; `divergencia` aparece no registro. |
| F4 | A hierarquia da CBO é posicional (prefixo do código). | Filtros por `grande_grupo`, `subgrupo_principal`, `subgrupo`, `familia` são prefixos; um filtro genérico `prefixo` cobre todos. |
| F5 | Grandes grupos 7 e 8 têm o **mesmo título** ("TRABALHADORES DA PRODUÇÃO DE BENS E SERVIÇOS INDUSTRIAIS"). | Nunca identificar nível superior por título; sempre exibir o código junto. |
| F6 | No perfil da CBO a sigla da área (A–O, Y, Z) **não é taxonomia**: é ordenação dentro da ocupação. `Y` tem vários nomes; `Z` aparece com duas grafias ("COMPETÊNCIAS" em 2.662 ocupações, "COMPETENCIAS" em 4). | Não oferecer "área A" como filtro entre ocupações. O filtro `transversais` usa a sigla (`Y`, `Z`), não o nome. |
| F7 | `numero` da atividade tem lacunas e repetições (D017). | É identificador da fonte, não posição. Ordenar pela ordem do arquivo; não renumerar. |
| F8 | Perfil ocupacional: 2.669 ocupações têm atividades; média de 65 por ocupação, máximo de 181. | Respostas de atividades precisam de agrupamento por área e, no MCP, de modo resumido. |
| F9 | "Perfil ocupacional" nomeia **duas coisas**: na CBO, áreas e atividades; no QBQ, o campo de texto `perfil_ocupacional`. | Na API a rota da CBO chama-se `/atividades`; o texto do QBQ mantém o nome `perfil_ocupacional`. |
| F10 | Chave de termo de vocabulário é **(vocabulário, nível, código)**. O código sozinho colide entre níveis: em conhecimentos-i, `1` (domínio e área) e `23.01.00` (campo e conhecimento); em conhecimentos-ii, `05.04.02.00`, `07.03.03.00`, `07.03.04.00`, `07.03.05.00` (conhecimento e elemento). Além disso, 8 códigos existem nas duas taxonomias de conhecimento, onde nomeiam termos diferentes (D004). | O nível entra na URL e na entrada das tools. `pai` refere-se sempre ao nível imediatamente acima. |
| F11 | Códigos de vocabulário são strings opacas, sem padrão uniforme (`1`, `01.01.00`, `01.03.01.00`, e dois malformados na fonte: `.99.00` e `.99.0001`). | Não validar por regex nem inferir hierarquia por prefixo; navegar por `pai`. |
| F12 | Itens de balde "outros" (segmento `90` ou `99`, D009): **70.335 dos 147.041 itens de conhecimento (47,8%)** e 3.252 dos 104.712 de habilidade. Neles o conteúdo real está em `descricao` da linha, não no código. | A busca por competência precisa cobrir a descrição inline, não só o vocabulário. Respostas trazem `termo` (rótulo do vocabulário) e `descricao_item` (texto da linha, quando há). |
| F13 | O par (ocupação, código do item) **não é único**: 10.266 pares repetidos em conhecimentos e 569 em habilidades, por causa dos baldes. | Identidade do item é `fonte.linha`. Contagens "por termo" devem contar ocupações distintas. |
| F14 | Todo item de conhecimento tem correspondente no nível folha do vocabulário (`conhecimentos` na taxonomia I, `elementos` na II). | Consulta transversal por nó intermediário (campo, área) precisa agregar descendentes. |
| F15 | Só a dimensão `habilidades` tem conceitos oficiais: 96 definições (3 domínios, 9 categorias, 84 habilidades). Baldes não têm conceito (D012). | `conceito` é `null` com motivo explícito para conhecimentos, atitudes e baldes. |
| F16 | Em 700 ocupações os níveis de conhecimento, habilidade e atitude diferem do nível de qualificação. | Expor os quatro níveis; filtros por cada um. |
| F17 | Distribuição do nível de qualificação: 1→96, 2→869, 3→560, 4→291, 5→82, 6→316, 7→356, 8→48, sem nível→55. | Gabarito para `/estatisticas/niveis`. |
| F18 | Itens CHA por ocupação: média de 56 conhecimentos (máx. 129), 40 habilidades (máx. 71), 2,75 atitudes (máx. 5). | Padrões de `limite` e ordenação por importância no MCP. |
| F19 | 4 sinônimos apontam para duas ocupações cada (ex.: "capoteiro" → 765240 e 991310). Nenhum título de ocupação CBO se repete. | Busca por sinônimo pode devolver mais de um código legítimo. |
| F20 | O SQLite derivado não tem `fonte`, `linha`, `vigencia.desde/ate`, índices nem FTS. | A API deve ser alimentada pelos JSON canônicos de `dados/` (ou por um banco próprio gerado a partir deles), fixados em uma release, com a versão registrada. |

## 4. Convenções da API REST

### 4.1 Geral

- Prefixo `/v1`. Somente leitura: `GET`, `HEAD`, `OPTIONS`. Sem cadastro e sem chave. CORS aberto.
- JSON UTF-8. Nomes de campo em português, `snake_case`, iguais aos do dataset sempre que o campo existir lá.
- Cabeçalhos: `X-Versao-Dados`, `ETag` (derivado de versão de dados + rota + parâmetros), `Cache-Control: public` com validade longa, já que o conteúdo só muda por release.
- Especificação OpenAPI 3.1 em `/v1/openapi.json`, gerada do mesmo código que serve as rotas.
- Limite de taxa por IP com `429` e `Retry-After`; sem autenticação para elevar o limite na v1.

### 4.2 Envelope

```json
{
  "dados": {},
  "meta": {
    "versao_dados": "dados-2026.11.1",
    "versao_schema": "schema-v0.3.0",
    "total": 17, "limite": 20, "deslocamento": 0,
    "derivado": false,
    "avisos": [
      {"codigo": "D015", "mensagem": "Título difere entre CBO e QBQ; nenhuma camada é corrigida.", "link": "/v1/decisoes/D015"}
    ]
  },
  "links": {"proprio": "…", "proxima": null, "anterior": null}
}
```

`avisos` é o canal para tudo o que a pessoa precisa saber para não interpretar errado: divergência entre camadas, entrada normalizada, ocupação sem perfil, taxonomias incomparáveis. Cada aviso referencia a decisão registrada quando houver.

### 4.3 Entrada

- **Códigos CBO**: aceitar `212405`, `2124-05` e `2124 05`. Aceitar número sem zero à esquerda (`10105`) somente se a forma com zero existir, e sinalizar em `avisos` que houve normalização. A saída traz `codigo` (`"212405"`) e `codigo_formatado` (`"2124-05"`).
- **Paginação**: `limite` (padrão 20, máximo 100) e `deslocamento`.
- **Seleção**: `campos=codigo,titulo` (subconjunto de campos) e `incluir=sinonimos,caminho` (embutir sub-recursos).
- **Ordenação**: `ordenar=campo` ou `ordenar=-campo`.
- **Busca textual** (`q`): ignora caixa e acento; todos os termos precisam casar; o último termo casa por prefixo. Cada resultado informa `casou_em` (`titulo`, `sinonimo`, `sintese`, `atividade`, `area`, `termo`, `descricao_item`, `conceito`) e `trecho`. Ordem de relevância: título exato, título por prefixo, sinônimo, demais campos.
- **Escalas**: níveis 1–8 e graus 1–5; valor fora da escala é erro `400`, não lista vazia.
- **Formato tabular**: `formato=csv` nas rotas de lista (prioridade secundária, para quem trabalha em planilha ou R).

### 4.4 Erros

Formato `application/problem+json` com `tipo`, `titulo`, `status`, `detalhe`, `dica` e `sugestoes`. O erro deve ensinar o caminho de volta, porque resposta vazia convida a pessoa (ou o modelo) a inventar.

| Situação | Status | O que a resposta diz |
|---|---|---|
| Código malformado (`21240`, `ABC`) | 400 | Formato esperado por nível (1, 2, 3, 4 ou 6 dígitos). |
| Código bem formado e inexistente (`212499`) | 404 | Até onde o código existe (ex.: família `2124` existe) e quais ocupações há nela. |
| Código existe só em uma camada | 200 | Registro com `cbo: null` ou `qbq: null` e aviso D015. Não é erro. |
| Termo de vocabulário ambíguo sem nível | 400 | Os níveis em que o código existe (F10). |
| Parâmetro com valor inválido | 400 | Lista dos valores aceitos. |

## 5. Recursos REST

Colunas: rota, parâmetros específicos (além dos comuns da seção 4.3), conteúdo e origem nos dados.

### 5.1 Metadados e proveniência

| ID | Rota | Parâmetros | Retorna | Origem |
|---|---|---|---|---|
| R01 | `GET /v1` | — | Índice navegável: grupos de recursos, versão, links para OpenAPI, MCP e repositório de dados. | — |
| R02 | `GET /v1/versao` | — | `versao_dados` do conjunto, `versao_schema`, `versao_dados` por camada (espinha CBO, perfil CBO, QBQ diferem — D016), contagens por conjunto, licença e citação sugerida. | cabeçalhos dos JSON, `CHANGELOG.md`, `dados/LICENSE.md` |
| R03 | `GET /v1/fontes` | — | Arquivos oficiais arquivados: caminho, origem, data de captura, SHA-256. | `fontes/README.md` |
| R04 | `GET /v1/decisoes` · `GET /v1/decisoes/{id}` | `q` | Registro de decisões D001–D018: contexto e decisão. Destino dos links de `avisos`. | `DECISOES.md` |
| R05 | `GET /v1/escalas` | — | Escalas oficiais: níveis 1–8 (conhecimento, habilidade, atitude, qualificação) e graus 1–5 (profundidade, frequência, importância), com a dimensão a que cada grau se aplica. Descritores textuais de cada ponto da escala **só se existirem no dataset** (hoje não existem — ver seção 10). | aba Layout, `schema/definicoes.json` |
| R06 | `GET /v1/openapi.json` | — | Especificação OpenAPI 3.1. | gerada |
| R07 | `GET /v1/downloads` | — | Links para os anexos da release (`qbq.sqlite.gz`, `qbq.sql.gz`, CSVs) e para o `MANIFEST.sha256`. A API não re-hospeda os arquivos. | release do `cbo-qbq-dados` |

Fora do prefixo `/v1`, na raiz do site: `llms.txt` e `llms-full.txt` com as regras de uso para agentes, como no bncc.dev.

### 5.2 Classificação CBO

| ID | Rota | Parâmetros | Retorna | Origem |
|---|---|---|---|---|
| R10 | `GET /v1/cbo/grandes-grupos` | — | Os 10 grandes grupos, com `total_ocupacoes`. | `cbo_grande_grupo` |
| R11 | `GET /v1/cbo/subgrupos-principais` | `pai`, `q` | Os 49 subgrupos principais. | `cbo_subgrupo_principal` |
| R12 | `GET /v1/cbo/subgrupos` | `pai`, `q` | Os 195 subgrupos. | `cbo_subgrupo` |
| R13 | `GET /v1/cbo/familias` | `pai`, `prefixo`, `q` | As 626 famílias. | `cbo_familia` |
| R14 | `GET /v1/cbo/{nivel}/{codigo}` | `incluir=filhos,caminho` | Um nó: `codigo`, `titulo`, `nivel`, `pai`, `caminho` (ancestrais até o grande grupo), `filhos`, `total_ocupacoes`, `fonte`. `{nivel}` ∈ `grandes-grupos`, `subgrupos-principais`, `subgrupos`, `familias`. | tabelas acima |
| R15 | `GET /v1/cbo/{nivel}/{codigo}/ocupacoes` | os de R20 | Ocupações sob o nó. Atalho para `R20?prefixo=`. | `cbo_ocupacao` |
| R16 | `GET /v1/cbo/arvore` | `raiz` (código de 1–4 dígitos; ausente = topo), `profundidade` (1–4, padrão 1) | Subárvore aninhada a partir da raiz, sem ocupações quando a profundidade não as alcança. | tabelas acima |
| R17 | `GET /v1/codigos/{codigo}` · `GET /v1/codigos?codigos=a,b,c` | lista de até 200 códigos | Decodificação e validação de **qualquer** código de 1 a 6 dígitos: `existe`, `nivel`, `titulo`, `caminho` completo, `entrada` original e `codigo` normalizado; para ocupação, `situacao_qbq` e presença em cada camada. Inexistente não gera 404 na forma em lote: volta `existe: false` com o ancestral mais profundo que existe. | todas as `cbo_*`, `qbq_ocupacao` |
| R18 | `GET /v1/cbo/{nivel}/{codigo}/resumo` | `dimensao` (`conhecimentos-i`, `conhecimentos-ii`, `habilidades`, `atitudes`), `limite` | **Derivado.** Retrato agregado do grupo: total de ocupações, distribuição por `situacao_qbq`, distribuição dos níveis de qualificação, termos mais presentes e termos que distinguem o grupo do conjunto (método na seção 5.8). | junção CBO × QBQ |

### 5.3 Ocupações (recurso central)

| ID | Rota | Parâmetros | Retorna | Origem |
|---|---|---|---|---|
| R20 | `GET /v1/ocupacoes` | `q`, `prefixo`, `grande_grupo`, `subgrupo_principal`, `subgrupo`, `familia`, `nivel_qualificacao` (valor ou `min..max`), `nivel_conhecimento`, `nivel_habilidade`, `nivel_atitude`, `situacao_qbq`, `taxonomia_conhecimento`, `tem_atividades`, `tem_sinonimos`, `divergencia` (`so_cbo`, `so_qbq`, `titulo_divergente`), `buscar_em` (padrão `titulo,sinonimo`; aceita `sintese`) | Lista resumida: `codigo`, `codigo_formatado`, `titulo_cbo`, `titulo_qbq`, `familia`, `nivel_qualificacao`, `situacao_qbq`, e, quando há `q`, `casou_em` e `trecho`. | `cbo_ocupacao`, `qbq_ocupacao`, `cbo_sinonimo` |
| R21 | `GET /v1/ocupacoes/{codigo}` | `incluir=sinonimos,atividades,competencias,perfil_ocupacional` | Ficha integrada das duas camadas (forma abaixo). Por padrão traz sinônimos e contagens, e deixa atividades, competências e o texto longo `perfil_ocupacional` para os sub-recursos. | JSON canônicos das duas camadas |
| R22 | `GET /v1/ocupacoes/{codigo}/sinonimos` | — | Denominações alternativas com `fonte` de cada uma. | `dados/cbo/ocupacoes` |
| R23 | `GET /v1/ocupacoes/{codigo}/atividades` | `area` (sigla), `transversais` (`incluir`, `excluir`, `somente` — siglas `Y` e `Z`), `q` | Perfil ocupacional da CBO: áreas (`sigla`, `nome`) com suas atividades (`numero`, `descricao`), na ordem da fonte. Ocupação sem perfil devolve `areas: []` com `motivo` (F8). | `dados/cbo/perfis` |
| R24 | `GET /v1/ocupacoes/{codigo}/competencias` | `dimensao` (`conhecimentos`, `habilidades`, `atitudes`; padrão todas), `importancia_min`, `frequencia_min`, `profundidade_min`, `ramo` (código de nó do vocabulário, com `nivel_ramo`), `excluir_baldes`, `ordenar` (padrão `-importancia`) | Itens CHA resolvidos: `codigo`, `nivel_vocabulario`, `termo`, `descricao_item` (quando há), `caminho` no vocabulário, graus, `balde`, `conceito` (habilidades) e `fonte.linha`. Traz também `taxonomia_conhecimento` e os quatro níveis da ocupação. | `dados/qbq/competencias`, vocabulários, conceitos |
| R25 | `GET /v1/ocupacoes/{codigo}/similares` | `dimensao` (padrão `habilidades`), `limite`, `escopo` (`todas`, `mesma_familia`, `mesmo_grande_grupo`, `fora_da_familia`), `nivel_qualificacao` | **Derivado.** Ocupações com conjunto de competências mais parecido: `similaridade` (Jaccard), totais de termos em comum e exclusivos de cada lado. | cálculo (5.8) |
| R26 | `GET /v1/ocupacoes/comparar?codigos=a,b` | 2 a 5 códigos; `dimensao`; `importancia_min` | **Derivado.** Lado a lado: títulos, caminho, níveis; por dimensão, termos em comum (com os graus de cada ocupação e a diferença), exclusivos de cada uma e similaridade. Atividades não são comparadas estruturalmente (texto livre) — apenas contadas. | cálculo (5.8) |
| R27 | `GET /v1/ocupacoes/sugerir?q=` | `limite` (padrão 8) | Autocompletar por prefixo sobre títulos e sinônimos: `codigo`, `rotulo`, `casou_em`. Resposta mínima, para uso em formulário. | `cbo_ocupacao`, `cbo_sinonimo` |

Forma da ficha integrada (R21), com os valores reais de `212405`:

```json
{
  "codigo": "212405",
  "codigo_formatado": "2124-05",
  "situacao_qbq": "classificada",
  "divergencia": null,
  "caminho": [
    {"nivel": "grande_grupo", "codigo": "2", "titulo": "PROFISSIONAIS DAS CIÊNCIAS E DAS ARTES"},
    {"nivel": "subgrupo_principal", "codigo": "21", "titulo": "PROFISSIONAIS DAS CIÊNCIAS EXATAS, FÍSICAS E DA ENGENHARIA"},
    {"nivel": "subgrupo", "codigo": "212", "titulo": "PROFISSIONAIS DA INFORMÁTICA"},
    {"nivel": "familia", "codigo": "2124", "titulo": "Analistas de tecnologia da informação"}
  ],
  "cbo": {
    "titulo": "Analista de desenvolvimento de sistemas",
    "familia": "2124",
    "sinonimos": ["Analista de desenvolvimento de software", "Analista de sistemas", "…"],
    "vigencia": {"status": "vigente", "desde": "dados-2026.11", "ate": null},
    "fonte": {"arquivo": "cbo2002-ocupacao.csv", "linha": 244}
  },
  "qbq": {
    "titulo": "Analista de desenvolvimento de sistemas",
    "sintese": "Planeja, projeta e desenvolve sistemas computacionais de informação, …",
    "niveis": {"conhecimento": 5, "habilidade": 5, "atitude": 5, "qualificacao": 5},
    "taxonomia_conhecimento": "conhecimentos-i",
    "vigencia": {"status": "vigente", "desde": "dados-2026.08", "ate": null},
    "fonte": {"arquivo": "fontes/qbq/qbq-2025-03.xlsx", "aba": "Ocupação", "linha": 1916}
  },
  "contagens": {"sinonimos": 10, "areas": 10, "atividades": 79, "conhecimentos": 62, "habilidades": 46, "atitudes": 4},
  "links": {
    "atividades": "/v1/ocupacoes/212405/atividades",
    "competencias": "/v1/ocupacoes/212405/competencias",
    "similares": "/v1/ocupacoes/212405/similares",
    "familia": "/v1/cbo/familias/2124"
  }
}
```

Valores de `situacao_qbq`: `classificada`, `nao_classificada` (acompanha `justificativa`), `sem_nivel_sem_justificativa`, `ausente_no_qbq`.

### 5.4 Busca transversal

| ID | Rota | Parâmetros | Retorna | Origem |
|---|---|---|---|---|
| R30 | `GET /v1/busca?q=` | `tipos` (`ocupacao`, `sinonimo`, `familia`, `atividade`, `termo`, `conceito`; padrão todos), `limite` por tipo | Busca unificada, agrupada por tipo, cada resultado com `tipo`, identificador, `rotulo`, `casou_em`, `trecho` e link para o recurso. Porta de entrada para quem não sabe em que camada está o que procura. | todas |
| R31 | `GET /v1/sinonimos?q=` | filtros de hierarquia | Do nome de mercado ao código oficial: `sinonimo`, `codigo`, `titulo_cbo`, `nivel_qualificacao`. Um sinônimo pode devolver mais de uma ocupação (F19). | `cbo_sinonimo` |
| R32 | `GET /v1/atividades?q=` | `buscar_em` (`atividade`, `area`; padrão ambos), `transversais`, filtros de hierarquia, `nivel_qualificacao`, `agrupar_por=ocupacao` | Ocupações por tarefa real: `ocupacao`, `titulo`, `sigla`, `area`, `numero`, `descricao`, `nivel_qualificacao`. Com `agrupar_por=ocupacao`, uma linha por ocupação com `total_casadas` e as atividades casadas. | `cbo_atividade`, `cbo_area` |

### 5.5 QBQ: vocabulários, conceitos e consulta transversal

| ID | Rota | Parâmetros | Retorna | Origem |
|---|---|---|---|---|
| R40 | `GET /v1/qbq/vocabularios` | — | Os quatro vocabulários (`conhecimentos-i`, `conhecimentos-ii`, `habilidades`, `atitudes`): níveis hierárquicos, totais por nível, a que ocupações se aplica (I ⇔ níveis 1–5, II ⇔ 6–8), se tem conceitos. | `qbq_vocabulario_*` |
| R41 | `GET /v1/qbq/vocabularios/{vocabulario}` | `nivel`, `pai` (com `nivel_pai`), `q`, `formato=plano` ou `arvore`, `profundidade`, `excluir_baldes` | Termos do vocabulário em lista ou árvore. | `qbq_vocabulario_*` |
| R42 | `GET /v1/qbq/vocabularios/{vocabulario}/{nivel}/{codigo}` | `incluir=filhos,uso` | Um termo: `descricao`, `caminho`, `filhos`, `balde`, `conceito` (`termo` e `conceito` do PDF, ou `null` com motivo), `divergencia_de_grafia` (D013) e, com `incluir=uso`, estatística **derivada** de uso: ocupações que o exigem e médias dos graus. | vocabulários, `qbq_conceito` |
| R43 | `GET /v1/qbq/vocabularios/{vocabulario}/{nivel}/{codigo}/ocupacoes` | `importancia_min`, `frequencia_min`, `profundidade_min`, `incluir_descendentes` (padrão `true` para nó não folha), filtros de hierarquia CBO, `nivel_qualificacao`, `ordenar` | Consulta transversal: ocupações que exigem o termo, com os graus. Para nó intermediário, agrega os descendentes e informa quantos itens casaram por ocupação (F14). | `qbq_conhecimento`, `qbq_habilidade`, `qbq_atitude` |
| R44 | `GET /v1/qbq/conceitos` | `dimensao` (hoje só `habilidades`), `nivel`, `q` | As 96 definições oficiais: `codigo`, `nivel`, `termo`, `conceito`, `fonte`. | `qbq_conceito` |
| R45 | `GET /v1/qbq/itens?q=` | `dimensao`, `taxonomia`, `somente_baldes`, filtros de hierarquia CBO, graus mínimos | Busca no texto dos itens CHA, **incluindo a descrição inline dos baldes** (F12): `ocupacao`, `titulo`, `dimensao`, `codigo`, `termo`, `descricao_item`, graus. É a única forma de achar "DIREITO AMBIENTAL" quando ele só existe como texto de um balde. | tabelas CHA |
| R46 | `GET /v1/qbq/nao-classificadas` | `q`, filtros de hierarquia | As 52 ocupações sem nível QBQ, com a `justificativa` oficial. | `qbq_nao_classificada` |
| R47 | `GET /v1/qbq/niveis` | `agrupar_por` (ver R61) | Os níveis 1–8 com total de ocupações em cada um e link para `R20?nivel_qualificacao=n`. | `qbq_ocupacao` |

### 5.6 Cruzamento entre as camadas

| ID | Rota | Parâmetros | Retorna | Origem |
|---|---|---|---|---|
| R50 | `GET /v1/cobertura` | `situacao`, filtros de hierarquia | As 64 divergências: `codigo`, `situacao`, `titulo_cbo`, `titulo_qbq`. | `cobertura_qbq_cbo` |
| R51 | `GET /v1/cobertura/resumo` | `agrupar_por=grande_grupo` | Contagem por situação e por grande grupo, incluindo as quatro categorias de `situacao_qbq` (F2), com link para a leitura narrativa em `docs/cobertura-qbq-cbo.md`. | junção |

### 5.7 Estatísticas (derivadas)

| ID | Rota | Parâmetros | Retorna | Origem |
|---|---|---|---|---|
| R60 | `GET /v1/estatisticas` | — | Contagens gerais de cada conjunto (as da tabela do README), para painéis e conferência. | todas |
| R61 | `GET /v1/estatisticas/niveis` | `agrupar_por` (`grande_grupo`, `subgrupo_principal`, `subgrupo`, `familia`), `prefixo`, `dimensao_nivel` (`qualificacao`, `conhecimento`, `habilidade`, `atitude`) | Distribuição dos níveis 1–8 por grupo: contagem por nível, total classificado, total sem nível, média e mediana. | junção |
| R62 | `GET /v1/estatisticas/competencias` | `vocabulario`, `nivel`, `prefixo` (grupo CBO), `nivel_qualificacao`, `ordenar` (`-ocupacoes`, `-importancia_media`), `excluir_baldes` | Termos mais exigidos: número de ocupações distintas, importância e frequência médias. | tabelas CHA |

### 5.8 Definição dos cálculos derivados

Estes métodos seguem `docs/consultas.sql` do repositório de dados e devem aparecer, resumidos, no campo `metodo` de cada resposta derivada.

- **Similaridade entre ocupações** (R25, R26): índice de Jaccard entre os conjuntos de códigos distintos de uma dimensão, com baldes excluídos (neles o código não é o conteúdo — F12). Padrão `habilidades`, único vocabulário comum a todas as ocupações. Para `conhecimentos`, só se comparam ocupações da mesma taxonomia; entre taxonomias diferentes o valor é `null` com aviso D004. `atitudes` fica disponível, mas com aviso de baixa resolução (22 termos, 2,75 por ocupação em média).
- **Diferença de graus** (R26): para termos em comum, diferença simples de importância, frequência e profundidade. Sem pesos nem índice sintético.
- **O que distingue um grupo** (R18): para cada termo, `presenca_grupo` (proporção das ocupações classificadas do grupo que o exigem) contra `presenca_geral`, e `importancia_media_grupo` contra `importancia_media_geral`. Ordenação padrão pela diferença de presença. Contar ocupações distintas (F13).
- **Agregados de nível** (R61): só ocupações com nível; as sem nível entram em contagem separada, nunca como zero.

## 6. Servidor MCP

### 6.1 Convenções

- Mesmo núcleo de consulta da API: toda tool tem equivalente REST (seção 7) e devolve os mesmos campos.
- Dois modos com as mesmas tools: local por `stdio`, com dados embutidos e sem rede, e hospedado por HTTP (streamable), sem chave.
- Todas as tools são somente leitura e idempotentes; declarar isso nas anotações.
- Saída estruturada (JSON) acompanhada de texto curto. Toda saída traz `versao_dados`, `fonte` nos registros e `avisos`.
- **Orçamento de contexto**: `limite` padrão entre 10 e 20, máximo 50; textos longos (`perfil_ocupacional`, lista completa de atividades ou de competências) só sob pedido; quando a resposta é truncada, informar `total` e como pedir o restante.
- **Erros que orientam**: código inexistente devolve até onde ele existe e alternativas próximas; filtro inválido devolve os valores aceitos. Nunca `null` seco.
- Nomes com prefixo da camada (`cbo_`, `qbq_`) ou do objeto (`ocupacao_`, `codigo_`, `dados_`), para que a origem do dado fique visível ao modelo e para evitar colisão com outros servidores.
- Texto de `instructions` do servidor, a ser enviado na inicialização: (a) nunca citar código CBO, título, nível ou competência sem tê-lo obtido de uma tool nesta conversa; (b) CBO e QBQ são fontes distintas — dizer de qual vem cada afirmação, e relatar divergência em vez de escolher; (c) nível e graus são escalas ordinais oficiais (1–8 e 1–5); (d) similaridade, rankings e resumos são cálculos derivados, não dado oficial; (e) ausência de nível ou de perfil é informação a relatar com a justificativa, não lacuna a preencher.

### 6.2 Tools do núcleo

#### `ocupacao_buscar`

Encontra ocupações por texto livre. É a porta de entrada: do nome de mercado, cargo ou título de vaga ao código oficial.

| Entrada | Tipo | Padrão | Descrição |
|---|---|---|---|
| `consulta` | string | — | Texto a buscar. Vazio só com algum filtro. |
| `buscar_em` | lista | `["titulo","sinonimo"]` | Aceita também `"sintese"`. |
| `prefixo` | string | — | Código CBO de 1 a 4 dígitos para restringir a um ramo. |
| `nivel_qualificacao_min`, `nivel_qualificacao_max` | inteiro 1–8 | — | Faixa de nível QBQ. |
| `situacao_qbq` | enum | — | Um dos quatro valores de F2. |
| `limite` | inteiro | 10 | Máximo 50. |

Saída: `total` e lista com `codigo`, `codigo_formatado`, `titulo_cbo`, `titulo_qbq` (só quando difere), `familia` (código e título), `nivel_qualificacao`, `situacao_qbq`, `casou_em`, `trecho`. Sem resultado: sugestão de busca por atividade (`cbo_buscar_atividades`) e de termos mais curtos. Equivale a R20 e R31.

#### `ocupacao_obter`

Ficha integrada de uma ocupação nas duas camadas. Usar quando o código já é conhecido.

| Entrada | Tipo | Padrão | Descrição |
|---|---|---|---|
| `codigo` | string | — | Código de 6 dígitos, com ou sem hífen. |
| `incluir` | lista | `["sinonimos"]` | Aceita `"perfil_ocupacional"` (texto longo do QBQ), `"resumo_atividades"` (só nomes das áreas) e `"principais_competencias"` (até 10 itens de maior importância por dimensão). |

Saída: a forma de R21 — caminho hierárquico, bloco `cbo`, bloco `qbq` (ou `null`), `situacao_qbq` com `justificativa` quando houver, `divergencia`, `contagens`. Sempre indica as tools seguintes para aprofundar. Equivale a R21.

#### `cbo_atividades`

O que a ocupação faz, segundo a CBO: grandes áreas de competência e atividades.

| Entrada | Tipo | Padrão | Descrição |
|---|---|---|---|
| `codigo` | string | — | Código da ocupação. |
| `area` | string | — | Sigla de uma área, para detalhar só ela. |
| `transversais` | enum | `"incluir"` | `"excluir"` ou `"somente"` as áreas `Y` e `Z`. |
| `modo` | enum | `"completo"` | `"resumo"` devolve apenas áreas e número de atividades em cada uma. |

Saída: `areas[]` com `sigla`, `nome`, `atividades[]` (`numero`, `descricao`), totais e `fonte`. A descrição da tool deve dizer que a sigla não é comparável entre ocupações (F6) e que a numeração tem lacunas (F7). Ocupação sem perfil devolve o motivo. Equivale a R23.

#### `qbq_competencias`

O que a ocupação exige, segundo o QBQ: conhecimentos, habilidades e atitudes com seus graus.

| Entrada | Tipo | Padrão | Descrição |
|---|---|---|---|
| `codigo` | string | — | Código da ocupação. |
| `dimensao` | enum | todas | `"conhecimentos"`, `"habilidades"` ou `"atitudes"`. |
| `importancia_min` | inteiro 1–5 | — | Só itens com importância a partir deste grau. |
| `incluir_conceitos` | booleano | `false` | Traz a definição oficial de cada habilidade. |
| `limite` | inteiro | 20 por dimensão | Ordenado por importância decrescente. |

Saída: os quatro níveis da ocupação, `taxonomia_conhecimento`, e por dimensão `total` e itens com `codigo`, `nivel_vocabulario`, `termo`, `descricao_item`, `caminho`, graus (profundidade só em conhecimentos; frequência em conhecimentos e habilidades; importância em todos), `balde`, `conceito`. Ocupação não classificada devolve a justificativa oficial em vez de lista vazia. Equivale a R24.

#### `cbo_navegar`

Percorre a classificação de cima para baixo.

| Entrada | Tipo | Padrão | Descrição |
|---|---|---|---|
| `codigo` | string | — | Ausente: lista os 10 grandes grupos. Com 1 a 4 dígitos: o nó e seus filhos diretos. |
| `profundidade` | inteiro 1–2 | 1 | Dois níveis de filhos de uma vez. |

Saída: nó (`codigo`, `titulo`, `nivel`), `caminho`, `filhos[]` com `total_ocupacoes` em cada um. Em família, os filhos são as ocupações, com `nivel_qualificacao`. Equivale a R14 e R16.

#### `codigo_decodificar`

Valida e explica códigos CBO de qualquer nível, um ou vários. Usar antes de citar um código e para conferir listas vindas de bases como RAIS e CAGED.

| Entrada | Tipo | Padrão | Descrição |
|---|---|---|---|
| `codigos` | lista de strings | — | 1 a 100 códigos, de 1 a 6 dígitos, com ou sem hífen. |

Saída por código: `entrada`, `codigo` normalizado, `existe`, `nivel`, `titulo`, `caminho`, e para ocupação `na_cbo`, `no_qbq`, `situacao_qbq`. Para inexistente: `existe: false`, o ancestral mais profundo que existe e os filhos dele. Resumo final com totais de válidos e inválidos. Equivale a R17.

#### `qbq_vocabulario`

Navega os vocabulários controlados do QBQ e devolve a definição oficial de um termo.

| Entrada | Tipo | Padrão | Descrição |
|---|---|---|---|
| `vocabulario` | enum | — | `"conhecimentos-i"`, `"conhecimentos-ii"`, `"habilidades"`, `"atitudes"`. Ausente: descreve os quatro. |
| `nivel` | string | — | Nível do termo (ex.: `"campos"`). Obrigatório quando o código é ambíguo (F10). |
| `codigo` | string | — | Ausente: lista o topo do vocabulário. Presente: o termo e seus filhos. |
| `incluir_uso` | booleano | `false` | Acrescenta em quantas ocupações o termo é exigido (derivado). |

Saída: termo (`codigo`, `nivel`, `descricao`), `caminho`, `filhos[]`, `balde`, `conceito` ou o motivo de não haver. Equivale a R40, R41 e R42.

#### `dados_sobre`

Proveniência, versão e limites do dataset. Usar quando a pergunta for sobre origem, data, confiabilidade, licença ou citação.

Entrada: `topico` opcional (`"versao"`, `"fontes"`, `"cobertura"`, `"decisoes"`, `"licenca"`); com `"decisoes"`, aceita `id` (ex.: `"D015"`). Saída: versão do conjunto e de cada camada, fontes com data de captura e checksum, contagens, licença CC BY 4.0 e citação sugerida, lista das ressalvas que mais afetam interpretação (F2, F3, F12, F15). Equivale a R02, R03 e R04.

### 6.3 Tools de exploração ampliada

#### `cbo_buscar_atividades`

Acha ocupações pelo que se faz nelas — busca no texto das atividades e dos nomes de área.

Entrada: `consulta` (obrigatória), `prefixo`, `nivel_qualificacao_min`, `nivel_qualificacao_max`, `transversais` (padrão `"excluir"`, para que "comunicar-se" e competências pessoais não dominem o resultado), `limite` (padrão 10). Saída: uma entrada por ocupação, com `total_casadas` e até três atividades casadas (`sigla`, `area`, `descricao`), mais `nivel_qualificacao`. Equivale a R32.

#### `qbq_buscar_termos`

Acha termos de competência por texto, nos vocabulários, nos conceitos e nas descrições inline dos baldes.

Entrada: `consulta` (obrigatória), `vocabularios` (padrão todos), `buscar_em` (padrão `["vocabulario","conceito"]`; aceita `"descricao_item"`), `limite`. Saída: termos com `vocabulario`, `nivel`, `codigo`, `descricao`, `caminho`, `tem_conceito`, `total_ocupacoes`; quando a busca alcança descrições inline, grupo separado com `descricao_item` e as ocupações em que aparece. A descrição da tool deve avisar que o mesmo assunto pode existir nas duas taxonomias de conhecimento com códigos diferentes, e que os resultados de uma não valem para a outra. Equivale a R41, R44 e R45.

#### `qbq_ocupacoes_por_competencia`

Consulta transversal: quais ocupações exigem um termo, e em que grau.

Entrada: `vocabulario`, `nivel`, `codigo` (obrigatórios; obter com `qbq_buscar_termos`), `importancia_min`, `frequencia_min`, `profundidade_min`, `prefixo` (ramo da CBO), `nivel_qualificacao_min`, `nivel_qualificacao_max`, `limite` (padrão 20). Saída: `total` de ocupações distintas, distribuição por grande grupo e por nível de qualificação, e lista de ocupações com os graus. Nó intermediário agrega descendentes e diz quantos itens casaram. Equivale a R43.

#### `ocupacao_comparar`

Compara de duas a cinco ocupações. Serve para transição de carreira ("o que falta para ir de A a B") e para distinguir ocupações vizinhas.

Entrada: `codigos` (2 a 5), `dimensao` (padrão `"habilidades"`), `importancia_min`. Saída: quadro de títulos, caminho e níveis; por dimensão, termos em comum com os graus de cada ocupação, termos exclusivos de cada uma e a similaridade; contagem de atividades. Marca `derivado: true` e traz `metodo`. Entre taxonomias de conhecimento diferentes, explica por que não compara (D004). Equivale a R26.

#### `ocupacao_similares`

Ocupações com perfil de competências parecido.

Entrada: `codigo`, `dimensao` (padrão `"habilidades"`), `escopo` (`"todas"`, `"mesma_familia"`, `"mesmo_grande_grupo"`, `"fora_da_familia"`), `limite` (padrão 10). Saída: lista com `codigo`, `titulo`, `familia`, `nivel_qualificacao`, `similaridade`, `em_comum`, `so_na_origem`, `so_na_outra`. Marca `derivado: true` e traz `metodo`. Equivale a R25.

#### `cbo_resumir_grupo`

Retrato agregado de um grande grupo, subgrupo principal, subgrupo ou família — ou do conjunto inteiro, sem código.

Entrada: `codigo` (1 a 4 dígitos; ausente = todo o dataset), `dimensao` para os termos (padrão `"habilidades"`), `limite` de termos (padrão 10). Saída: total de ocupações, distribuição por `situacao_qbq`, distribuição dos níveis de qualificação com média e mediana, termos mais presentes e termos que distinguem o grupo do conjunto. Marca `derivado: true`. Equivale a R18, R61 e R62.

#### `cobertura_consultar`

Onde CBO e QBQ não coincidem, e por quê.

Entrada: `codigo` (opcional — situação de uma ocupação) ou `situacao` (`"so_cbo"`, `"so_qbq"`, `"titulo_divergente"`, `"nao_classificada"`, `"sem_nivel_sem_justificativa"`), `prefixo`, `limite`. Sem argumentos: o resumo com as contagens. Saída: registros com os dois títulos, a situação e, para não classificadas, a justificativa oficial; sempre com referência a D010 e D015. Equivale a R46, R50 e R51.

### 6.4 Tool opcional

#### `sql_consultar`

Consulta SQL somente leitura sobre o SQLite derivado, para análises que as demais tools não cobrem. Entrada: `sql` (uma instrução `SELECT`), `limite` (padrão 100, máximo 1.000). Requisitos: conexão em modo leitura, rejeição de qualquer instrução que não seja consulta, tempo máximo de execução, e descrição da tool com o esquema das tabelas e as armadilhas F10–F13. Recomendação: oferecer primeiro no modo local; no hospedado, só depois de medir custo e abuso. Sem equivalente REST.

### 6.5 Resources e prompts do MCP

Resources (leitura direta por URI, para clientes que os suportam):

| URI | Conteúdo |
|---|---|
| `cboqbq://sobre` | O mesmo de `dados_sobre`. |
| `cboqbq://modelo-de-dados` | `docs/modelo-de-dados.md` e a seção "Como os dados se encaixam" do README. |
| `cboqbq://decisoes` | `DECISOES.md`. |
| `cboqbq://ocupacao/{codigo}` | Ficha integrada (R21). |
| `cboqbq://cbo/{codigo}` | Nó da classificação com filhos (R14). |
| `cboqbq://vocabulario/{vocabulario}` | Árvore do vocabulário (R41). |

Prompts (roteiros prontos que encadeiam tools):

| Prompt | Argumentos | Encadeamento |
|---|---|---|
| `classificar_vaga` | texto da vaga | `ocupacao_buscar` pelo título → `cbo_buscar_atividades` pelas tarefas → `ocupacao_obter` dos candidatos → resposta com até três códigos, evidência de cada um e o que os separa. |
| `perfil_de_ocupacao` | código ou nome | `ocupacao_buscar` → `ocupacao_obter` → `cbo_atividades` (resumo) → `qbq_competencias` (importância ≥ 4) → ficha em linguagem simples, com fonte. |
| `transicao_de_carreira` | origem, destino | `ocupacao_comparar` → `qbq_vocabulario` para definir as habilidades que faltam → lacunas ordenadas por importância. |
| `panorama_de_grupo` | código de 1 a 4 dígitos | `cbo_navegar` → `cbo_resumir_grupo` → leitura dos níveis e das competências distintivas, com a ressalva de que é cálculo derivado. |

## 7. Equivalência entre tools, recursos e dados

| Tool MCP | Recursos REST | Tabelas e arquivos |
|---|---|---|
| `ocupacao_buscar` | R20, R31 | `cbo_ocupacao`, `cbo_sinonimo`, `qbq_ocupacao` |
| `ocupacao_obter` | R21, R22 | `dados/cbo/ocupacoes`, `dados/qbq/ocupacoes`, `cobertura_qbq_cbo`, `qbq_nao_classificada` |
| `cbo_atividades` | R23 | `dados/cbo/perfis` (`cbo_area`, `cbo_atividade`) |
| `qbq_competencias` | R24 | `dados/qbq/competencias`, `qbq_vocabulario_*`, `qbq_conceito` |
| `cbo_navegar` | R10–R16 | `cbo_grande_grupo`, `cbo_subgrupo_principal`, `cbo_subgrupo`, `cbo_familia`, `cbo_ocupacao` |
| `codigo_decodificar` | R17 | todas as `cbo_*`, `qbq_ocupacao` |
| `qbq_vocabulario` | R40–R42 | `qbq_vocabulario_*`, `qbq_conceito` |
| `dados_sobre` | R02–R04 | `fontes/README.md`, `DECISOES.md`, `CHANGELOG.md`, `verificacao.json` |
| `cbo_buscar_atividades` | R32 | `cbo_atividade`, `cbo_area` |
| `qbq_buscar_termos` | R41, R44, R45 | `qbq_vocabulario_*`, `qbq_conceito`, descrições inline das tabelas CHA |
| `qbq_ocupacoes_por_competencia` | R43 | `qbq_conhecimento`, `qbq_habilidade`, `qbq_atitude` |
| `ocupacao_comparar` | R26 | tabelas CHA, `qbq_ocupacao` |
| `ocupacao_similares` | R25 | tabelas CHA |
| `cbo_resumir_grupo` | R18, R61, R62 | junção CBO × QBQ |
| `cobertura_consultar` | R46, R50, R51 | `cobertura_qbq_cbo`, `qbq_nao_classificada` |
| `sql_consultar` | — | SQLite derivado |

## 8. Ordem de entrega sugerida

| Etapa | REST | MCP | O que passa a ser possível |
|---|---|---|---|
| 1. Núcleo | R01–R03, R10–R17, R20–R24, R27, R31, R40–R42, R44, R46, R50 | `ocupacao_buscar`, `ocupacao_obter`, `cbo_atividades`, `qbq_competencias`, `cbo_navegar`, `codigo_decodificar`, `qbq_vocabulario`, `dados_sobre` | Achar, validar e ler qualquer ocupação e qualquer termo, com fonte. |
| 2. Exploração | R30, R32, R43, R45, R47, R51, R04, R05 | `cbo_buscar_atividades`, `qbq_buscar_termos`, `qbq_ocupacoes_por_competencia`, `cobertura_consultar` | Consultas transversais: por tarefa, por competência, por divergência. |
| 3. Análise derivada | R18, R25, R26, R60–R62 | `ocupacao_comparar`, `ocupacao_similares`, `cbo_resumir_grupo` | Comparação, similaridade e panoramas agregados. |
| 4. Opcional | R07, `formato=csv` | `sql_consultar`, resources, prompts | Uso em massa e análises livres. |

## 9. Critérios de aceite (gabarito em `dados-2026.11.1`)

Cada item é um teste automatizável contra a API e contra a tool equivalente. Os valores foram lidos do dataset.

1. `R60` devolve 10 grandes grupos, 49 subgrupos principais, 195 subgrupos, 626 famílias, 2.694 ocupações CBO, 7.778 sinônimos, 20.723 áreas, 174.296 atividades, 2.673 ocupações QBQ, 147.041 itens de conhecimento, 104.712 de habilidade, 7.210 de atitude, 96 conceitos, 52 não classificadas, 64 divergências.
2. `R20` sem filtros tem `total` 2.698; por `situacao_qbq`: 2.618, 52, 3 e 25 (F2).
3. `R21` para `212405` devolve exatamente o caminho `2 → 21 → 212 → 2124`, níveis 5/5/5/5, taxonomia `conhecimentos-i` e contagens 10 sinônimos, 10 áreas, 79 atividades, 62 conhecimentos, 46 habilidades, 4 atitudes.
4. `2124-05`, `2124 05` e `212405` devolvem o mesmo registro; `10105` devolve `010105` com aviso de normalização.
5. `R15` para a família `2124` devolve 6 ocupações (`212405`, `212410`, `212415`, `212420`, `212425`, `212430`).
6. `R31?q=programador` devolve 17 sinônimos.
7. `R31?q=capoteiro` devolve duas ocupações: `765240` e `991310`.
8. `R17` para `212499` devolve `existe: false`, com a família `2124` como ancestral existente.
9. `R21` para `010105` devolve `situacao_qbq: "nao_classificada"` com `justificativa` preenchida; para `113005`, `"sem_nivel_sem_justificativa"` com aviso D010; para `516140` (Pedicure), `cbo: null` e divergência `so_qbq`.
10. `R50` devolve 25 `so_cbo`, 4 `so_qbq` e 35 `titulo_divergente`; `114210` aparece com os dois títulos ("Dirigente de entidade patronal" na CBO, "Dirigentes de entidades patronais" no QBQ).
11. `R61?agrupar_por=` ausente devolve a distribuição de F17.
12. `R40` devolve conhecimentos-i com 2 domínios, 22 áreas, 211 campos e 1.446 conhecimentos; conhecimentos-ii com 9 áreas, 86 campos, 448 conhecimentos e 1.417 elementos; habilidades com 3 domínios, 12 categorias e 87 habilidades; atitudes com 4 categorias e 22 atitudes.
13. `R42` para `conhecimentos-i` sem nível e código `23.01.00` devolve erro 400 listando os níveis `campos` e `conhecimentos`; com nível, devolve o termo certo.
14. `R43` para `conhecimentos-i/conhecimentos/01.01.02` (BANCO DE DADOS) com `importancia_min=4` devolve 29 ocupações distintas.
15. `R42` para `habilidades/habilidades/01.01.01` devolve o conceito oficial ("Capacidade desenvolvida de ouvir e compreender informações e ideias apresentadas por meio de palavras faladas e frases."); para `habilidades/habilidades/01.90.01` devolve `conceito: null` com motivo D012.
16. `R24` para `212405`, dimensão `habilidades`, marca como balde os itens `01.90.01` (duas ocorrências), `02.90.01` e `03.90.01`, cada um com `descricao_item`.
17. `R25` para `212405`, dimensão `habilidades`, escopo `todas`: os cinco primeiros são `212415` (0,955), `212420` (0,913), `212410` (0,911), `212310` (0,891) e `212315` (0,870), sobre 42 habilidades distintas não balde da origem.
18. `R23` para uma ocupação sem perfil (ex.: `010105`) devolve `areas: []` com motivo, não 404.
19. Toda resposta traz `meta.versao_dados`; todo registro de ocupação, sinônimo, atividade e item CHA traz `fonte`.
20. Para cada tool da seção 6, a chamada equivalente à rota REST da seção 7 devolve os mesmos valores.

## 10. Pendências a montante e decisões em aberto

### 10.1 A resolver no `cbo-qbq-dados` antes ou junto da API

1. **Texto literal `"NULL"` em `sintese` e `perfil_ocupacional`.** 54 ocupações do QBQ trazem a string `"NULL"` nesses dois campos nos JSON canônicos (e uma, `010105`, traz nulo de fato). A planilha oficial tem o texto `NULL` nessas células (conferido na linha 2635 da aba `Ocupação`, código `010110`); o pipeline converte os níveis para nulo, mas mantém o texto. Efeito: há 2.618 ocupações com síntese real, e não 2.621 como diz o README. A API não deve corrigir isso em silêncio: cabe decidir no repositório de dados (normalizar para nulo com decisão registrada, ou manter e documentar). Até lá, filtros como `tem_sintese` e a busca em `sintese` dariam falso positivo.
2. **Descritores das escalas.** O significado de cada nível 1–8 e de cada grau 1–5 não está no dataset como dado estruturado. Sem isso, R05 expõe só os intervalos. Se a fonte oficial publica os descritores, é uma camada nova a extrair.
3. **`fonte.arquivo` sem padrão único.** As ocupações da CBO registram `cbo2002-ocupacao.csv`; o perfil e o QBQ registram o caminho completo (`fontes/cbo/…`, `fontes/qbq/…`). A API precisa de uma forma só para montar links de proveniência.
4. **SQLite sem proveniência, vigência detalhada, índices e FTS** (F20). Ou a API gera o próprio banco a partir de `dados/`, ou o derivado ganha essas colunas.
5. **Nível do `pai` nos vocabulários.** Como o código colide entre níveis (F10), convém que o dado diga explicitamente o nível do pai, em vez de deixá-lo implícito.

### 10.2 Escolhas que assumi e que você pode mudar

1. Nomes de campos, rotas e tools em português, espelhando o dataset.
2. Prefixos das tools por camada e objeto (`cbo_`, `qbq_`, `ocupacao_`, `codigo_`, `dados_`), em vez de um prefixo único como o `bncc_` do bncc.dev.
3. Análises derivadas (similaridade, comparação, resumo de grupo) entram na etapa 3, marcadas como derivadas. A alternativa é deixá-las fora da API e só documentar as consultas SQL.
4. `sql_consultar` fica opcional e, de início, só no modo local.
5. O nível do termo faz parte da URL dos vocabulários (`/{vocabulario}/{nivel}/{codigo}`), por causa das colisões de código.
6. Sem busca semântica na v1; só busca lexical determinística.
