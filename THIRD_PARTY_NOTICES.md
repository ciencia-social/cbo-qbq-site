# Avisos de terceiros

O código deste repositório está sob a licença MIT (`LICENSE`). Este arquivo lista o que vem de terceiros ou segue regra própria.

## Ícones Lucide 0.460.0

Licença ISC. Os ícones aparecem em `src/ui/icones.ts` e `design/ds/bundle.js`. O aviso original está também em `design/ds/LICENSE-lucide.txt`.

```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

## Fontes IBM Plex Sans, IBM Plex Mono e Source Serif 4

Licença SIL Open Font License 1.1 (https://openfontlicense.org). As fontes não estão neste repositório: o `next/font` as baixa no build (`app/layout.tsx`) e o site as serve do próprio domínio, o que a licença permite.

- IBM Plex Sans e IBM Plex Mono: direitos da IBM Corp., com o nome de fonte reservado "Plex".
- Source Serif 4: direitos da Adobe, com o nome de fonte reservado "Source".

## Design system ciencia.social

O código do design system (`design/ds/`, `src/ui/`: CSS, JavaScript e componentes) está sob a licença MIT, como o resto do repositório. O nome ciencia.social e a identidade visual (logotipo, combinação de cores e tipografia como marca) não são licenciados para reuso: quem reutilizar o código deve trocar o nome e a marca.

## Dados servidos

O site, a API e o MCP servem os dados do [`cbo-qbq-dados`](https://github.com/ciencia-social/cbo-qbq-dados), sem alterar o conteúdo. O conteúdo provém de atos oficiais do Estado brasileiro (Classificação Brasileira de Ocupações e Quadro Brasileiro de Qualificações, Ministério do Trabalho e Emprego), que não são objeto de proteção autoral nos termos do art. 8º, IV, da Lei 9.610/1998. A compilação estruturada está sob a licença Creative Commons Atribuição 4.0 (CC BY 4.0). Quem usar os dados deve citar o conjunto de dados pela forma indicada no `README.md` (seção "Como citar") e em `/sobre`.

## Dependências npm

As dependências não são redistribuídas neste repositório: o npm as instala a partir do `package-lock.json`. O resumo das licenças das dependências de produção está em [`docs/licencas-dependencias.md`](docs/licencas-dependencias.md), gerado por `node --experimental-strip-types scripts/licencas.ts`. Fora das licenças permissivas aparecem `caniuse-lite` (CC BY 4.0, usado só no build) e os binários opcionais do `sharp` (libvips, LGPL-3.0-or-later), instalados pelo npm conforme a plataforma. Nenhuma delas obriga a mudar a licença deste código.
