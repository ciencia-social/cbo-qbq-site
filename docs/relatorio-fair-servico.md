> Escrito em 18 de novembro de 2026, para o mantenedor.  
> Situação: histórico (avaliação de 18 de novembro de 2026; a execução segue em `docs/plano-fair-servico.md`).

# Relatório — FAIR no serviço: site, API e MCP

Documento explicativo, escrito para decisão. Ele trata do que falta para `cbo.ciencia.social` ser a camada FAIR do dataset, e não apenas uma interface bonita sobre ele. A execução está em [plano-fair-servico.md](plano-fair-servico.md), escrito para o agente de código. O identificador persistente de que tudo aqui depende é criado no outro repositório — ver `cbo-qbq-dados/docs/relatorio-doi-fair.md`.

## 1. Por que um serviço muda o jogo FAIR

Um repositório no GitHub com um DOI resolve *Findable* e *Accessible* para quem já sabe que o dataset existe e sabe manejar git. Um serviço com API resolve outra coisa: torna o dado encontrável e utilizável **por máquina**, que é o ponto cego da maioria dos datasets publicados em repositório.

Mas há uma inversão que costuma passar despercebida: ao servir o dado por uma interface própria, o serviço se torna o lugar onde a maioria dos usuários o encontra — e, se ele não disser de onde o dado vem, quem o compilou, sob que licença e em que versão, ele **remove** proveniência que o repositório tinha. Um modelo de linguagem consultando o MCP não tem como citar o que não lhe foi dito. É por isso que a adequação FAIR do site é, em boa medida, um trabalho de fazer o serviço repetir em toda camada o que o repositório já sabe.

## 2. O que já está certo

Vale começar pelo que não precisa mudar, porque é bastante.

O acesso é **aberto por protocolo aberto**: HTTPS, sem chave, com CORS liberado para qualquer origem e métodos de leitura — isto é, A1 e A1.1 atendidos, inclusive para notebooks e páginas de terceiros.

A **descrição formal da API** existe: documento OpenAPI 3.1 servido em `/api/v1/openapi.json`, gerado das próprias rotas, o que o mantém em dia por construção.

A **versão do dado viaja com a resposta**: cada resposta carrega `x-versao-dados` no cabeçalho e `meta.versao_dados` no envelope, e `/api/v1/versao` devolve ainda as versões por camada, a licença, a citação sugerida e as ressalvas conhecidas do dataset. Isso é mais do que a maioria das APIs públicas de dados oferece.

Há ainda um `llms.txt` e um `llms-full.txt` com instruções de uso para modelos, incluindo as regras que evitam alucinação (não citar código sem tê-lo obtido da API, não misturar as duas taxonomias de conhecimento, tratar ausência como informação).

## 3. As cinco lacunas

**Identidade e citação.** A citação que a API devolve hoje aponta para o repositório por URL e não tem autoria nem DOI. Depois que o DOI existir, ele precisa aparecer em `/api/v1/versao`, no `llms.txt`, na página "Sobre" e no bloco de metadados estruturados. Enquanto isso não acontece, todo uso do serviço é uma citação perdida.

**Metadados estruturados para buscadores de dados.** O Google Dataset Search, o Zenodo e qualquer agregador de dados leem um bloco JSON-LD no padrão `schema.org/Dataset` embutido na página. Sem ele, o site é encontrável por busca de texto como qualquer página, mas é invisível como *dataset*. É a diferença entre aparecer numa busca por "CBO 2124-05" e aparecer numa busca por conjuntos de dados sobre classificação ocupacional brasileira. O bloco declara identificador (o DOI), autoria (com ORCID), licença, versão, cobertura temporal, distribuições disponíveis (API, CSV, SQLite) e a origem oficial — tudo que o repositório já sabe.

**Sinalização legível por máquina nas respostas (*signposting*).** É uma convenção simples: além do corpo, a resposta HTTP traz cabeçalhos `Link` dizendo "cite assim" (`rel="cite-as"`, apontando para o DOI), "a descrição formal está aqui" (`rel="describedby"`, o OpenAPI ou o JSON-LD), "a licença é esta" (`rel="license"`) e "o autor é este" (`rel="author"`, o ORCID). Clientes automáticos — rastreadores, gerenciadores de referência, agentes — descobrem a citação sem precisar entender o formato do corpo. É barato de implementar e é exatamente o que separa um serviço "aberto" de um serviço "FAIR".

**Descoberta.** Não há `robots.txt` nem `sitemap.xml`. As 2.694 páginas de ocupação existem, mas um buscador só chega a elas navegando. Um sitemap gerado das próprias rotas resolve, e é o caminho pelo qual a maior parte do tráfego de pesquisa costuma entrar.

**Higiene do repositório do serviço.** O `cbo-qbq-site` não tem `LICENSE`, não tem `CITATION.cff` e o `package.json` não declara licença nem repositório. Para quem encontra o código, não há como saber o que pode fazer com ele. E o software que serve um dataset citável deve, ele próprio, dizer qual dataset cita — é o que o bloco `references` do `CITATION.cff` existe para fazer.

## 4. Uma distinção que vale explicitar: dois objetos, duas licenças

Há dois objetos distintos em jogo, e misturá-los confunde quem quer usar.

O **dado** — compilação da CBO e do QBQ — é CC BY 4.0, com DOI próprio, e a obrigação de quem usa é atribuir. O **software** — este site, a API e o servidor MCP — é outra obra, que merece licença própria (MIT, coerente com o pipeline do outro repositório) e que, se vier a ser citada, é citada como software.

A consequência prática: a API deve declarar as duas licenças separadamente, não uma licença genérica do serviço. Quem consome `/api/v1/ocupacoes/212405` está recebendo dado CC BY; quem clona o repositório do site está recebendo código MIT.

## 5. O caso específico do MCP

O servidor MCP é a superfície mais nova e a que mais precisa de atribuição explícita, porque do outro lado há um modelo de linguagem montando uma resposta para alguém — e o que ele não souber dizer sobre a origem, não dirá.

Três mudanças de natureza diferente se aplicam ali. Nas **instruções do servidor**, acrescentar como citar o dado quando o resultado for usado em texto final. Na **ferramenta de versão**, devolver DOI, autoria e licença junto com as versões por camada. E, no **retorno de cada ferramenta**, manter a versão do dado — que já existe — como o rastro mínimo que permite ao modelo dizer de que publicação veio o número que está informando.

## 6. O que não recomendo fazer agora

Vale dizer onde eu **não** mexeria, para o esforço não se dispersar.

Não recomendo criar URIs persistentes por termo de vocabulário — uma URI resolvível para cada habilidade, cada atividade, cada nível. É o passo seguinte de interoperabilidade (I2), tem custo alto de desenho e só se paga quando houver um segundo sistema consumindo esses termos como entidades. O JSON-LD do dataset, no nível do conjunto, já entrega a maior parte do ganho.

Também não recomendo adotar DCAT ou perfis de catálogo governamental nesta rodada. São padrões para catálogos de dados — fazem sentido se o dataset for agregado a um portal, não para um serviço único.

E não recomendo versionar a API por conteúdo (`/v2` a cada publicação de dados). O desenho atual — versão fixada, informada em cabeçalho e em `/versao` — é o correto, e trocar de rota a cada publicação quebraria consumidores sem ganho.
