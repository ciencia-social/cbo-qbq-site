# Segurança

## Escopo

Este repositório cobre o site, a API REST (`/api/v1`) e o servidor MCP (`/mcp`) de https://cbo.ciencia.social. O serviço é somente leitura, não tem login nem cookies e não guarda o conteúdo das consultas.

O dado em si (CBO e QBQ) é tratado no [`cbo-qbq-dados`](https://github.com/ciencia-social/cbo-qbq-dados).

## Como relatar

Use o relato privado do GitHub: na aba **Security** deste repositório, **Report a vulnerability**. Não abra issue pública para falha de segurança.

Diga o que acontece, como reproduzir (rota, parâmetros, cliente MCP) e o impacto que você vê.

## O que esperar

O projeto é mantido por uma pessoa, como parte de uma pesquisa de iniciação científica. A intenção é confirmar o recebimento em até 7 dias e dizer o que será feito, mas não há garantia de prazo. Quando a correção for publicada, o relato pode ser divulgado, com crédito a quem relatou, se a pessoa quiser.

## O que não é vulnerabilidade

- Dado diferente da fonte oficial, título errado ou contagem que não bate: abra uma issue no [`cbo-qbq-dados`](https://github.com/ciencia-social/cbo-qbq-dados/issues).
- Divergência entre CBO e QBQ: é dado, mostrado de propósito (decisão D015 do repositório de dados).
- Resposta 429 por excesso de pedidos: é o limite de taxa funcionando.

## Exceções conhecidas de dependências

Estado em 19 de novembro de 2026, depois de atualizar `zod` para a versão 4 e `vitest` para a versão 5. O `npm audit --omit=dev` acusa:

| Pacote | Gravidade | Onde age | Decisão |
|---|---|---|---|
| `postcss` (dentro de `next` 15) | alta | Só no build, ao processar o CSS do próprio repositório | Adiada. Os ataques pedem CSS ou source map controlados por terceiros, e o build só processa os arquivos deste repositório. A correção exige `next` 16, uma versão maior, que vai numa atualização própria. |
| `next` 15 | moderada | Pela dependência de `postcss` acima | A mesma. |

O Dependabot (`.github/dependabot.yml`) abre as atualizações semanalmente.

## Política de conteúdo das páginas

As páginas mandam `Content-Security-Policy` com `script-src 'self' 'unsafe-inline'`. O `'unsafe-inline'` é necessário porque o Next injeta em cada página dezenas de scripts embutidos com o payload de renderização, diferentes a cada página. Um nonce resolveria isso, mas não funciona com as páginas guardadas na CDN por um dia: o HTML guardado levaria um nonce diferente do cabeçalho de cada resposta. Os outros controles valem: nenhum script de outra origem, nenhum embutimento do site por terceiros (`frame-ancestors 'none'`), nenhum `<base>` nem envio de formulário para fora. O detalhe está em `next.config.ts`.
