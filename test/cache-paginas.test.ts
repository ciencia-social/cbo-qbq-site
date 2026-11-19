import { describe, expect, it } from "vitest";
import config, { CACHE_PAGINAS, PAGINAS_EM_CACHE } from "../next.config";

describe("I12 cache das páginas na CDN", () => {
  it("ficha, competências e documentação mandam Vercel-CDN-Cache-Control de um dia", async () => {
    const regras = await config.headers!();
    for (const pagina of ["/ocupacoes/:codigo", "/competencias/:caminho*", "/docs/:caminho*"]) {
      const regra = regras.find((item) => item.source === pagina);
      expect(regra, pagina).toBeDefined();
      expect(regra!.headers).toContainEqual({ key: "Vercel-CDN-Cache-Control", value: CACHE_PAGINAS });
    }
    expect(CACHE_PAGINAS).toContain("max-age=86400");
  });

  it("a API e o MCP ficam fora: têm o próprio Cache-Control", () => {
    expect(PAGINAS_EM_CACHE.some((pagina) => pagina.startsWith("/api") || pagina.startsWith("/mcp"))).toBe(false);
  });
});
