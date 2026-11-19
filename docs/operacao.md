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
