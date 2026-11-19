import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/v1/[[...caminho]]": ["./data/cbo-qbq.sqlite"],
    "/mcp": ["./data/cbo-qbq.sqlite"],
  },
  async headers() {
    return PAGINAS_EM_CACHE.map((source) => ({
      source,
      headers: [{ key: "Vercel-CDN-Cache-Control", value: CACHE_PAGINAS }],
    }));
  },
};

export default nextConfig;
