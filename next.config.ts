import type { NextConfig } from "next";
import { linkSignposting } from "./src/signposting";

/**
 * Cache das páginas na CDN da Vercel (I12). O dado só muda por release, e cada deploy
 * começa com o cache vazio. As páginas leem searchParams, então são dinâmicas para o Next;
 * Vercel-CDN-Cache-Control vale só para a CDN e não é sobrescrito pelo Next.
 * O navegador continua revalidando com a CDN.
 */
export const CACHE_PAGINAS = "max-age=86400, stale-while-revalidate=604800";

export const PAGINAS_EM_CACHE = [
  "/",
  "/ocupacoes",
  "/ocupacoes/:codigo",
  "/competencias",
  "/competencias/:caminho*",
  "/docs",
  "/docs/:caminho*",
  "/sobre",
];

/** Cabeçalhos de segurança de toda resposta: páginas, API e MCP (P11). */
export const CABECALHOS_GERAIS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

/**
 * Política de conteúdo das páginas (P11).
 *
 * script-src usa 'unsafe-inline', não hash nem nonce. O Next injeta em cada página dezenas de
 * scripts embutidos com o payload RSC (`self.__next_f.push(...)`), diferentes a cada página; um hash
 * só de SCRIPT_TEMA bloquearia todos e quebraria a hidratação. O nonce também não serve aqui: as
 * páginas ficam um dia na CDN (I12) e /sobre é estática, então o HTML guardado levaria um nonce
 * diferente do cabeçalho de cada resposta. Os demais controles valem: nenhum script de outra origem,
 * nenhum embutimento por terceiros, nenhum <base> nem envio de formulário para fora.
 */
export const CSP_PAGINAS = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const CABECALHOS_PAGINAS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: CSP_PAGINAS },
  // Signposting (S3): a página cita o conjunto de dados.
  { key: "Link", value: linkSignposting("dados") },
];

/** Tudo, exceto a API (/api/, /v1/) e o MCP. */
export const FONTE_PAGINAS = "/((?!api/|v1/|mcp$|mcp/).*)";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/v1/[[...caminho]]": ["./data/cbo-qbq.sqlite"],
    "/mcp": ["./data/cbo-qbq.sqlite"],
  },
  async headers() {
    return [
      { source: "/:caminho*", headers: CABECALHOS_GERAIS },
      { source: FONTE_PAGINAS, headers: CABECALHOS_PAGINAS },
      ...PAGINAS_EM_CACHE.map((source) => ({
        source,
        headers: [{ key: "Vercel-CDN-Cache-Control", value: CACHE_PAGINAS }],
      })),
    ];
  },
};

export default nextConfig;
