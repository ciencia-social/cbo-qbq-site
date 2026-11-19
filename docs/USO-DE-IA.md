# Declaração e protocolo de uso de Inteligência Artificial Generativa

Este documento cumpre o **art. 9º, I, "c" da Portaria CNPq nº 2.664/2026** (Política de Integridade na Atividade Científica, DOU de 11/3/2026), que obriga a declarar a ferramenta de IA generativa utilizada e a finalidade, em qualquer fase da pesquisa. Observa também o **Guia de Boas Práticas Científicas da USP** (3ª ed., 2026), que recomenda a declaração.

Cobre os dois repositórios do projeto: o conjunto de dados [`cbo-qbq-dados`](https://github.com/ciencia-social/cbo-qbq-dados) e o serviço [`cbo-qbq-site`](https://github.com/ciencia-social/cbo-qbq-site), que publica a API REST, o servidor MCP e o site de https://cbo.ciencia.social.

## 1. Finalidade

IA generativa foi usada como apoio nos dois repositórios. Toda saída foi revisada pelo mantenedor antes de entrar no repositório.

- **No** `cbo-qbq-dados`, só o Claude Science: busca das publicações oficiais do Ministério do Trabalho e Emprego (MTE), pipeline de extração e validação (`pipeline/`), documentação (`docs/`, `README.md`) e revisão dos dados extraídos.
- **No** `cbo-qbq-site`: plano de implementação da API e do servidor MCP segundo os princípios FAIR, design system do ciencia.social e telas do site, código e testes, consultas que levantam o gabarito dos testes, textos e documentação e avaliações do projeto.

**Não** foi usada para decidir o escopo da pesquisa nem a arquitetura do serviço, para tomar as decisões de modelagem dos dados (D001–D020, em `DECISOES.md` do `cbo-qbq-dados`) nem para alterar o conteúdo da CBO e do QBQ. O conteúdo vem das publicações oficiais do MTE e é servido sem alteração.

## 2. Tarefas delegadas, na taxonomia GAIDeT

Segundo a GAIDeT (Generative AI Delegation Taxonomy), foram delegadas à IA, sob supervisão humana, tarefas destas categorias:

- **Literature Review:** busca das publicações oficiais do MTE que servem de fonte à CBO e ao QBQ (Claude Science).
- **Methodology:** plano de implementação da API e do servidor MCP segundo os princípios FAIR (Claude Science), especificações e planos de tarefa (`docs/plano-api-mcp-cbo-qbq.md`, `design/HANDOFF.md`, `docs/tarefas-mcp.md`, `docs/plano-fair-servico.md`).
- **Software Development and Automation:** pipeline de extração e validação do `cbo-qbq-dados`; código da API REST, do servidor MCP e do site; testes automatizados e as consultas SQL que levantam o gabarito; design system e telas do site (`design/`).
- **Data Management:** revisão dos dados extraídos e metadados de citação e de proveniência (`CITATION.cff`, `.zenodo.json`, `VERSAO.json`).
- **Writing and Editing:** documentação dos dois repositórios, textos das páginas e README.

Não foram delegadas tarefas de **Conceptualization**, **Ethics Review** nem **Supervision**. Ficaram exclusivamente com o mantenedor: o escopo e as decisões de arquitetura e de produto, a aprovação ou rejeição de cada proposta da IA, a modelagem dos dados e a revisão final.

A IA **não é autora** deste trabalho. A responsabilidade integral pelo conteúdo final, inclusive por eventuais imprecisões, é de quem assina a pesquisa (art. 9º, I, "f").

## 3. Ferramentas

| Ferramenta                | Provedor  | Modelos                                      | Uso                                                                                                                                          |
| ------------------------- | --------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Science            | Anthropic | Fable 5.2 e Claude Opus 5.5                  | Todo o uso no `cbo-qbq-dados` (fontes oficiais, pipeline, documentação, revisão dos dados); plano da API e do MCP segundo os princípios FAIR |
| Claude Design (no Claude) | Anthropic | Claude Opus 5.5                              | Design system do ciencia.social e telas do site (`design/telas/`)                                                                            |
| Cursor                    | SpaceXAI  | Claude Opus 5.5 (Anthropic) e Grok 4.7 (xAI) | Código do site, da API e das correções do MCP (18 commits com coautoria registrada no git)                                                   |
| Claude Code               | SpaceXAI  | Claude Opus 5.5                              | Código, testes, documentação e preparação para abrir o repositório                                                                           |

**Período.** As ferramentas foram usadas de forma cíclica ao longo de todo o desenvolvimento, alternando entre si conforme a etapa, e não em fases separadas. Por isso o período é declarado para o projeto como um todo, pelo histórico do git: o `cbo-qbq-dados` de agosto a novembro de 2026 e o `cbo-qbq-site` em novembro de 2026. O histórico registra quando cada mudança foi consolidada, não cada interação com as ferramentas.

Modelos comerciais mudam sem aviso, e repetir uma instrução pode produzir resultado diferente. Por isso o processo fica registrado nos documentos de instrução, listados na seção 6, e no histórico do git.

## 4. Insumos enviados às ferramentas

O código dos repositórios, os documentos de especificação e o conteúdo público da CBO e do QBQ, publicado pelo MTE.

Nenhum dado pessoal foi enviado às ferramentas: a CBO e o QBQ descrevem ocupações, não pessoas, e o serviço não guarda o conteúdo das consultas. Nenhuma credencial (chaves de acesso, senhas, tokens e afins) foi enviada às ferramentas.

## 5. Como os resultados foram conferidos

### No cbo-qbq-dados

**Reprodutibilidade.** Os dados em `dados/` e `derivados/` são gerados pelo pipeline a partir dos arquivos oficiais arquivados em `fontes/`, e o CI confere que o que está no repositório é exatamente o que o pipeline produz. Cada release é reconstruída da fonte arquivada e revalidada antes de publicar.

**Contratos.** `pipeline/validar_schema.py` e `pipeline/validar.py` conferem o resultado contra o schema e contra regras de consistência. O pipeline não corrige a fonte: as normalizações são mínimas e documentadas em `DECISOES.md`, e as inconsistências encontradas viram registro, não correção invisível (`docs/metodologia.md`).

**Limite.** A conferência caractere a caractere entre `dados/` e `fontes/` (`verificar.py`) ainda está pendente, segundo `docs/metodologia.md`. Até ela existir, a fidelidade do texto extraído depende dos contratos acima e da revisão do mantenedor. A revisão humana foi feita via consultas SQL nas bases derivadas geradas para avaliar a coerência dos resultados em comparação aos dados das fontes oficiais, por amostragem. Como o desenvolvimento das pipelines foi faseado, cada fase teve uma etapa de revisão própria.

### No cbo-qbq-site

**Gabarito contra o dado.** Os números que o serviço devolve são conferidos contra o gabarito da seção 9 de [`docs/plano-api-mcp-cbo-qbq.md`](plano-api-mcp-cbo-qbq.md), fixo nos testes de aceite em [`test/aceite.test.ts`](../test/aceite.test.ts): contagens de cada nível da CBO, de itens do QBQ, de divergências entre as fontes e respostas de ocupações conhecidas. A IA escreveu as consultas SQL que levantam esses números a partir dos dados e, com base nelas, o gabarito. O mantenedor revisou as consultas rodando-as numa instância local do SQLite. O gabarito vem do dado, não do código do serviço, e nenhum valor dele pode mudar para um teste passar.

**Testes automatizados.** Rodam no CI a cada push (`.github/workflows/ci.yml`), com o banco construído a partir da tag fixada do `cbo-qbq-dados`. O gerador do banco recusa a construção se as contagens divergirem das esperadas ou do `VERSAO.json` do repositório de dados.

**Revisão humana.** O mantenedor revisou cada mudança por inteiro antes de aprová-la e consolidá-la em commits, e conferiu o site em produção.

## 6. Documentos que registram o uso

Estes documentos foram escritos como instrução para agentes de código e mostram o processo, etapa por etapa:

- [`design/PROMPT.md`](../design/PROMPT.md): instrução para construir o site.
- [`design/HANDOFF.md`](../design/HANDOFF.md): especificação do site a partir das telas desenhadas.
- [`docs/plano-api-mcp-cbo-qbq.md`](plano-api-mcp-cbo-qbq.md): especificação da API REST e das tools do MCP.
- [`docs/tarefas-mcp.md`](tarefas-mcp.md): correções do servidor MCP depois da primeira revisão.
- [`docs/plano-fair-servico.md`](plano-fair-servico.md): tarefas para tornar o serviço a camada FAIR do conjunto de dados.

## 7. Texto curto para a página /sobre

A constante `DECLARACAO_IA` em `src/versao.ts` traz este texto, que aparece em https://cbo.ciencia.social/sobre. Ao mudar um, mude o outro.

> Em conformidade com o art. 9º, I, "c", da Portaria CNPq nº 2.664/2026, declaro o uso de ferramentas de IA generativa neste projeto. No conjunto de dados cbo-qbq-dados, o Claude Science apoiou a busca das fontes oficiais, o pipeline de extração e validação, a documentação e a revisão dos dados. Neste serviço, o Claude Science, o Claude Design, o Cursor e o Claude Code apoiaram o planejamento, o design das telas, o código e os testes, os textos e as avaliações do projeto. Revisei cada resultado por inteiro antes de publicá-lo. Os dados são regenerados das publicações oficiais e validados automaticamente, e os números que o serviço devolve são conferidos por testes contra os dados. O escopo, as decisões de arquitetura e a modelagem dos dados não foram delegados à IA. A IA não é autora deste trabalho, e a responsabilidade pelo conteúdo é minha. Detalhes em docs/USO-DE-IA.md, no repositório.

## 8. Modelo de declaração para o relatório e para artigos

> **Declaração de uso de Inteligência Artificial Generativa.** Em conformidade com o art. 9º, I, "c", da Portaria CNPq nº 2.664/2026 e com o Guia de Boas Práticas Científicas da USP (3ª ed.), declaro o uso de ferramentas de IA generativa nesta pesquisa. Segundo a taxonomia GAIDeT, foram delegadas à IA, sob supervisão humana, tarefas de Literature Review, Methodology, Software Development and Automation, Data Management e Writing and Editing. No conjunto de dados cbo-qbq-dados, o Claude Science (Anthropic; modelos Fable 5.2 e Claude Opus 5.5) apoiou a busca das publicações oficiais do MTE, o pipeline de extração e validação, a documentação e a revisão dos dados. No serviço cbo-qbq-site (API REST, servidor MCP e site de https://cbo.ciencia.social), apoiaram o plano de implementação, o design das telas, o código e os testes, os textos e as avaliações do projeto o Claude Science, o Claude Design (Claude Opus 5.5), o Cursor (Claude Opus 5.5 e Grok 4.7) e o Claude Code (Claude Opus 5.5). As ferramentas foram usadas de forma cíclica ao longo de todo o desenvolvimento, de agosto a novembro de 2026. As instruções dadas às ferramentas estão registradas nos documentos dos repositórios (commit [hash]). Apenas código, especificações e o conteúdo público da CBO e do QBQ foram enviados às ferramentas; nenhum dado pessoal nem credencial foi processado por IA. Todas as saídas foram revisadas integralmente por [nome]. Os dados são regenerados das publicações oficiais arquivadas e validados por contratos automáticos, e os números que o serviço devolve são conferidos por testes automatizados contra os dados, com as consultas que levantam o gabarito revisadas pelo autor. O escopo, as decisões de arquitetura e a modelagem dos dados não foram delegados à IA. A responsabilidade integral pelo conteúdo final, inclusive por eventuais imprecisões, é do(a) autor(a). A IA não é autora deste trabalho.

Preencha os colchetes com o histórico do git e com os registros das ferramentas.

## 9. Antes de publicar

Registre no plano de trabalho da IC, com ciência do orientador, o uso de IA generativa na construção do conjunto de dados e do serviço. A declaração posterior não substitui o combinado prévio.
