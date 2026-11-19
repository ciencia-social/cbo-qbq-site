# Operação

Passos de configuração em painel (Vercel, GitHub) e conferências que cabem ao mantenedor. O código não executa nada daqui.

## Limite de taxa (I4)

### O que o código faz

`src/http/limite.ts` conta pedidos por IP numa janela de um minuto e responde 429 acima de `LIMITE_TAXA` (padrão 120; `0` desliga). Vale para `/api/v1/*` (corpo `application/problem+json`) e para `/mcp` (corpo JSON-RPC com `error.code = -32000` e `id: null`). As duas respostas trazem `Retry-After`.

O IP vem de `x-real-ip` e, na falta dele, do primeiro endereço de `x-forwarded-for`.

**Esse limitador é por instância.** A contagem fica na memória de cada instância da função. Na Vercel, pedidos do mesmo IP podem cair em instâncias diferentes, e instâncias novas começam do zero. Por isso ele não limita por pessoa e **não substitui o limite na borda**. Ele existe como segunda camada, para conter uma rajada que chegue a uma instância só. O `Map` guarda no máximo 10.000 IPs e descarta as entradas vencidas.

### O que configurar na Vercel (manual)

Em produção, uma rajada recebeu o desafio "Vercel Security Checkpoint" (403 em HTML, cabeçalho `X-Vercel-Mitigated: challenge`). Script e cliente MCP não resolvem desafio de navegador. O objetivo é que `/api/` e `/mcp` recebam 429, nunca o desafio.

No painel do projeto, em **Firewall**:

1. **Descobrir a origem do desafio.** Em *Firewall → Overview*, filtre os eventos com ação *Challenge* e veja a regra que os gerou. As opções são:
   - *Bot Protection* (em *Bot Management*);
   - *Attack Challenge Mode* (botão no topo do Firewall);
   - mitigação automática de DDoS (aparece como *System*).
2. **Isentar a API e o MCP do desafio.** Em *Firewall → Rules → New Rule*:
   - nome: `api-mcp-sem-desafio`;
   - condição: *Request Path* *starts with* `/api/` **OR** *Request Path* *equals* `/mcp`;
   - ação: *Bypass*.
   - Se o desafio vier do *Bot Protection*, ele é desligado para esses caminhos por essa regra. O *Attack Challenge Mode* não aceita exceção por caminho: deixe-o desligado e use a regra do passo 3.
3. **Criar o limite de taxa na borda.** *New Rule*:
   - nome: `api-mcp-limite`;
   - condição: a mesma do passo 2;
   - ação: *Rate Limit*, algoritmo *Fixed Window*, janela de 60 s, chave *IP*, limite de 120 pedidos (o código assume esse valor; ajuste `LIMITE_TAXA` se mudar);
   - ao exceder: *Deny* com resposta **429** (não *Challenge*).
   - Ordene a regra do passo 3 **antes** da do passo 2, para o *Bypass* não pular o limite. Se o painel não deixar combinar as duas, use só a do passo 3 e desligue o *Bot Protection*.
4. **Páginas HTML.** A proteção de navegador pode continuar nas demais rotas. Nada a fazer se ela já estiver ativa.
5. Publique as regras (*Review Changes → Publish*).

### Como conferir (uma vez, de uma máquina só)

```sh
for i in $(seq 1 200); do
  curl -s -o /dev/null -w '%{http_code} %{content_type}\n' https://cbo.ciencia.social/api/v1/versao &
  sleep 0.3
done | sort | uniq -c
```

Esperado: só `200` e `429`, e nenhum `403` com `text/html`.

## Validar o OpenAPI (I6)

O documento sai de `src/http/openapi.ts`, a partir das declarações de parâmetros de `src/http/rotas.ts`. A suíte já confere que todo `{param}` do caminho está declarado, que só os parâmetros declarados são aceitos e que os esquemas publicados descrevem respostas reais. A validação contra a especificação OpenAPI 3.1 usa uma ferramenta externa, que não é dependência do projeto. Para rodar sem instalar:

```sh
curl -s https://cbo.ciencia.social/api/v1/openapi.json -o /tmp/openapi.json   # ou: npm run dev e http://localhost:3000/api/v1/openapi.json
npx --yes @redocly/cli@1.34.3 lint /tmp/openapi.json
# alternativa:
npx --yes @apidevtools/swagger-cli@4.0.4 validate /tmp/openapi.json
```

Esperado: nenhum erro. Avisos de estilo (por exemplo, `operation-4xx-response`) podem aparecer. `info.license` (MIT), `info.contact` e `x-licenca-dados` (CC BY 4.0) já são preenchidos. Para tornar isso parte do CI, adicione `@redocly/cli` como dependência de desenvolvimento (decisão do mantenedor).

## CI (I2)

`.github/workflows/ci.yml` roda em `push` e `pull_request` para `main`: `npm ci`, construção do banco a partir da tag (sem pasta irmã, com `EXIGIR_TAG=1`), `npm run typecheck`, `npm test` e `npx next build`. Não usa segredos.

Conferir (manual): depois do primeiro push com o arquivo, abrir a aba **Actions** do repositório e ver o job `verificar` verde, com os quatro passos executados. Recomendado: em *Settings → Branches*, exigir o status `CI / verificar` antes de mesclar na `main`.

## Proveniência dos dados (I8)

O banco grava em `meta` o commit de `cbo-qbq-dados` de onde saiu (`dados_commit`) e, quando esse commit é o da tag fixada em `src/versao.ts` sem alterações locais, a tag (`dados_tag`). Os dois aparecem em `/api/v1/versao` e em `dados_sobre`.

Fora da tag, `npm run dados` só avisa. Com `EXIGIR_TAG=1`, falha e explica o motivo. O CI já define a variável.

**Manual, na Vercel:** em *Settings → Environment Variables*, criar `EXIGIR_TAG` com valor `1` para *Production* e *Preview*. Na Vercel não há pasta irmã, então o script clona a tag; a variável garante que um cache de build antigo em `.dados` não passe despercebido.

Conferir depois do deploy:

```sh
curl -s https://cbo.ciencia.social/api/v1/versao | jq '.dados | {versao_dados, dados_tag, dados_commit}'
```

Esperado: `dados_tag` igual à tag de `src/versao.ts` e `dados_commit` com 40 caracteres hexadecimais.

Localmente, se a pasta irmã `../cbo-qbq-dados` estiver em outro commit, use um clone da tag:

```sh
git clone --depth 1 --branch dados-2026.11.2 https://github.com/ciencia-social/cbo-qbq-dados .dados
CBO_QBQ_DADOS=$PWD/.dados npm run dados
```

## Região das funções (I11)

`vercel.json` fixa `"regions": ["gru1"]` (São Paulo) para todas as funções: API, MCP e páginas dinâmicas. Antes, elas rodavam em `iad1` (Virgínia) e os pedidos entravam por `gru1`. O banco SQLite vai junto da função, então não há outra dependência de região.

Conferir depois do deploy:

```sh
curl -sI https://cbo.ciencia.social/api/v1/versao | grep -i x-vercel-id
```

Esperado: o valor contém `gru1::gru1` (borda e função em São Paulo). Se aparecer `gru1::iad1`, confira em *Settings → Functions → Function Region* se o painel sobrepõe o arquivo.

## Cache das páginas (I12)

As páginas leem `searchParams` (filtros da ficha, busca, paginação) e por isso são dinâmicas para o Next; `export const revalidate` não teria efeito nelas. Gerar as 2.698 fichas no build foi descartado: o build passaria de cerca de 14 s para cerca de 3 min e a saída teria cerca de 277 MB, e as variantes por consulta continuariam dinâmicas.

O cache fica na CDN da Vercel: `next.config.ts` manda `Vercel-CDN-Cache-Control: max-age=86400, stale-while-revalidate=604800` em `/`, `/ocupacoes`, `/ocupacoes/:codigo`, `/competencias/*`, `/docs/*` e `/sobre`. Esse cabeçalho vale só para a CDN; o navegador recebe o `Cache-Control` do Next e revalida com a CDN. A chave do cache inclui a consulta, e a Vercel começa cada deploy com o cache vazio, então um release novo não serve HTML velho.

Conferir depois do deploy (o primeiro pedido costuma ser `MISS`):

```sh
curl -sI https://cbo.ciencia.social/ocupacoes/212405 | grep -i x-vercel-cache
curl -sI https://cbo.ciencia.social/ocupacoes/212405 | grep -i x-vercel-cache
```

Esperado no segundo: `X-Vercel-Cache: HIT` (ou `STALE`). Se continuar `MISS`, confira se o cabeçalho `Vercel-CDN-Cache-Control` chegou na resposta (`curl -sI ... | grep -i cdn-cache`) e se algum cookie ou `Set-Cookie` está impedindo o cache.

Peso da ficha de 212405: 181 KB de HTML, dos quais 114 KB são o payload RSC, que repete a árvore renderizada, e 63 KB são HTML visível. O perfil de atividades (79 itens em `<details>` fechados) responde por cerca de 30% da marcação. Recolhê-lo de verdade exige buscar as atividades no cliente ao abrir a área; fica como melhoria possível, não feita aqui.

## Downloads e CSV (I14)

`/api/v1/downloads` (R07) monta os links a partir de `TAG_DADOS` e `ANEXOS_RELEASE` em `src/versao.ts`, sem hospedar arquivos. Os nomes dos anexos (`qbq.sqlite.gz`, `qbq.sql.gz`, `MANIFEST.sha256`) vêm de `docs/versionamento.md` do repositório de dados. **Confira (manual)** na página da release que eles existem com esses nomes; se mudarem, ajuste `ANEXOS_RELEASE`:

```sh
for u in $(curl -s https://cbo.ciencia.social/api/v1/downloads | jq -r '.dados.anexos[].url'); do
  printf '%s %s\n' "$(curl -sIL -o /dev/null -w '%{http_code}' "$u")" "$u"
done
```

Esperado: `200` em todos.

CSV abre no R sem aviso:

```r
x <- read.csv("https://cbo.ciencia.social/api/v1/ocupacoes?formato=csv&limite=100", colClasses = c(codigo = "character"))
nrow(x)  # 100
```

Use `colClasses` para manter o zero à esquerda dos códigos.

## Cabeçalhos de segurança (P11)

`next.config.ts` desliga o `X-Powered-By`, manda `X-Content-Type-Options: nosniff` e `Referrer-Policy` em toda resposta, e `X-Frame-Options`, `Permissions-Policy` e `Content-Security-Policy` nas páginas (não em `/api/`, `/v1/` nem `/mcp`). A CSP usa `script-src 'self' 'unsafe-inline'`; o motivo está no comentário de `CSP_PAGINAS` e no `SECURITY.md`.

Conferir depois do deploy:

```sh
curl -sI https://cbo.ciencia.social/ | grep -iE 'content-security|x-frame|x-content-type|referrer|permissions|x-powered'
```

Esperado: os cinco primeiros presentes e nenhum `X-Powered-By`.

**Manual, no preview:** abrir o console do navegador em início, uma ficha (`/ocupacoes/212405`), competências, `/docs`, `/docs/mcp` e `/sobre`, usar a troca de tema e o "Testar" da documentação, e conferir que não aparece violação de CSP.

## Abrir o repositório (P14a)

Ordem, executada pelo mantenedor:

1. Tarefas I3, I4 e I5 do plano de implementação em produção (busca paginada no banco, limite de taxa, tetos de tamanho).
2. Arquivos de abertura no `main`: `LICENSE`, `THIRD_PARTY_NOTICES.md`, `SECURITY.md`, `CONTRIBUTING.md`, `README.md`, `CITATION.cff`, `.zenodo.json`. A declaração de uso de IA (`DECLARACAO_IA` em `src/versao.ts` e `docs/USO-DE-IA.md`) pode entrar no mesmo dia. `test/abertura.test.ts` deve passar.
3. GitHub, em *Settings → Code security*: ligar *Secret scanning* e *Push protection*, *Dependabot alerts* e *Dependabot security updates*, e *Private vulnerability reporting*.
4. GitHub, em *Settings → Rules → Rulesets*: proteger `main`, exigindo pull request e o status `CI / verificar`.
5. GitHub, em *Settings → Actions → General → Workflow permissions*: *Read repository contents and packages permissions*.
6. Vercel: em *Settings → Git*, conferir que a proteção de deploy para pull requests de forks está ligada (*Require approval for fork deployments* ou equivalente). Em *Settings → Environment Variables*, remover qualquer token que tenha sobrado (por exemplo, um token do GitHub da época em que o repositório de dados era privado).
7. GitHub, na página do repositório (*About*): descrição, site `https://cbo.ciencia.social` e tópicos `cbo`, `qbq`, `ocupacoes`, `mcp`, `api`, `dados-abertos`, `brasil`.
8. *Settings → General → Danger Zone → Change visibility → Public*.
9. Conferir: o GitHub mostra a licença MIT e o botão "Cite this repository"; abrir uma issue mostra os modelos "Erro na API" e "Erro no MCP".

Recomendado para os commits futuros: configurar o e-mail `noreply` do GitHub (`git config user.email <id>+<usuario>@users.noreply.github.com`).

## Publicar uma versão (P8)

A versão do software (`package.json`, tag `vX.Y.Z`) é independente da versão dos dados (`TAG_DADOS` em `src/versao.ts`).

1. Atualizar o `CHANGELOG.md`: trocar `(não publicado)` pela data e dizer qual versão de dados a release serve.
2. Atualizar `version` no `package.json` (`npm version X.Y.Z --no-git-tag-version`). O MCP (`serverInfo.version`), o cabeçalho `X-Versao-Servico` e a citação do software leem dali.
3. `npm run typecheck && npm test`, commit e push no `main`, CI verde.
4. Criar a tag e a release no GitHub, com o trecho do `CHANGELOG.md` como notas:

   ```sh
   git tag vX.Y.Z && git push origin vX.Y.Z
   gh release create vX.Y.Z --title vX.Y.Z --notes-file <(awk '/^## vX.Y.Z/{f=1;next}/^## /{f=0}f' CHANGELOG.md)
   ```

5. Esperar o Zenodo arquivar a release (alguns minutos) e conferir o registro (seção seguinte).

## Zenodo e DOI do software (P14b)

Pré-requisito: o repositório já é público.

1. Em https://zenodo.org, entrar com o GitHub. Em *GitHub* (menu da conta), autorizar a organização `ciencia-social` e ligar a chave do `cbo-qbq-site`. A integração só arquiva releases criadas **depois** de ligada.
2. Em *Settings → Linked accounts*, ligar o ORCID à conta do Zenodo.
3. Não criar depósito manual nem reservar DOI: a integração cria o registro dela, com outro número.
4. Publicar a release `v0.1.0` no GitHub (seção anterior).
5. Conferir o registro criado no Zenodo: título, autor com ORCID, licença MIT, tipo *Software*, identificador relacionado ao conjunto de dados (`10.5281/zenodo.24353524`, *References*). Anotar o DOI de versão e o DOI de conceito (o que aparece em *Cite all versions*).
6. Commit de acerto, sem release nova:
   - `src/versao.ts`: `DOI_SOFTWARE_CONCEITO = "10.5281/zenodo.<conceito>"`;
   - `CITATION.cff`: descomentar `identifiers` e pôr o DOI de conceito;
   - `README.md`: trocar o marcador do selo pelo DOI de conceito;
   - em `test/abertura.test.ts`, tirar o `.todo` do teste dos marcadores de DOI.
7. Conferir:

   ```sh
   curl -sIL https://doi.org/10.5281/zenodo.<conceito> | grep -E '^HTTP|^location'
   curl -s https://cbo.ciencia.social/api/v1/versao | jq '.dados.doi_software, .dados.citacao.software'
   ```

   Esperado: a cadeia termina em `200` numa página do Zenodo; `/api/v1/versao` devolve o DOI e a citação com ele.

## Trocar a versão dos dados (S12)

O `cbo-qbq-dados` publica um `VERSAO.json` a partir da `dados-2026.11.2`. O gerador do banco o lê e confere contra `src/versao.ts`; as contagens esperadas vêm dele, não do código.

1. Em `src/versao.ts`, trocar `TAG_DADOS` e `VERSAO_DADOS` pela tag nova.
2. `npm run dados`. Se o `VERSAO.json` da tag disser outra coisa, o script para e lista cada constante a mudar (`VERSAO_SCHEMA`, `VERSAO_CAMADAS.*`, `DOI_DADOS.*`), com o valor esperado.
3. Atualizar `DOI_DADOS` com os DOIs da release nova. Eles não estão no `VERSAO.json` da tag (o Zenodo só os cunha depois da release); estão no `VERSAO.json` da `main` do repositório de dados, depois do commit de acerto.
4. `npm test`. Os números do gabarito em `test/aceite.test.ts` são fixos de propósito: se um mudar, confira a mudança contra o repositório de dados antes de atualizar o teste. Nas referências da I3 (`test/fixtures/busca-antes/`), só `versao_dados` deve mudar.
5. Atualizar a versão nos `public/llms*.txt`, no `README.md` e no `CHANGELOG.md`; `test/fair.test.ts` e `test/abertura.test.ts` acusam o que ficar para trás.

## Robots, sitemap e JSON-LD (S4, S5)

`/robots.txt` libera tudo e aponta `/sitemap.xml`, que lista as páginas fixas, os vocabulários de competências e uma ficha por ocupação do universo (2.698). A página inicial e `/sobre` trazem um bloco JSON-LD `schema.org/Dataset` gerado de `src/versao.ts` e das contagens do banco.

**Manual, depois do deploy:** validar o JSON-LD da página inicial em https://validator.schema.org (ou no teste de resultados avançados do Google) e enviar o sitemap no Google Search Console, se quiser acompanhar a indexação.
