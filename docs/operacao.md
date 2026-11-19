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

Esperado: nenhum erro. Avisos de estilo (por exemplo, `operation-4xx-response` ou falta de `license`) podem aparecer; licença e contato estão no plano de abertura pública. Para tornar isso parte do CI, adicione `@redocly/cli` como dependência de desenvolvimento (decisão do mantenedor).

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
git clone --depth 1 --branch dados-2026.11.1 https://github.com/ciencia-social/cbo-qbq-dados .dados
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
