import { describe, expect, it } from "vitest";
import config, { CSP_PAGINAS, cspPaginas, FONTE_PAGINAS } from "../next.config";
import { analyticsAtivo, ORIGENS_ANALYTICS } from "@/site/analytics";

describe("P11 cabeçalhos de segurança", () => {
  it("não anuncia o Next em X-Powered-By", () => {
    expect(config.poweredByHeader).toBe(false);
  });

  it("toda rota recebe nosniff e Referrer-Policy", async () => {
    const regras = await config.headers!();
    const geral = regras.find((regra) => regra.source === "/:caminho*");
    expect(geral?.headers).toContainEqual({ key: "X-Content-Type-Options", value: "nosniff" });
    expect(geral?.headers).toContainEqual({ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" });
  });

  it("as páginas recebem CSP, X-Frame-Options e Permissions-Policy; a API e o MCP, não", async () => {
    const regras = await config.headers!();
    const paginas = regras.find((regra) => regra.source === FONTE_PAGINAS);
    const chaves = paginas?.headers.map((cabecalho) => cabecalho.key);
    expect(chaves).toEqual(expect.arrayContaining(["X-Frame-Options", "Permissions-Policy", "Content-Security-Policy"]));
    const casa = (caminho: string) => new RegExp(`^${FONTE_PAGINAS}$`).test(caminho);
    for (const caminho of ["/", "/sobre", "/ocupacoes/212405", "/docs/mcp", "/competencias"]) expect(casa(caminho), caminho).toBe(true);
    for (const caminho of ["/api/v1/versao", "/v1/versao", "/mcp"]) expect(casa(caminho), caminho).toBe(false);
  });

  it("a CSP impede embutir o site e só aceita de fora as origens do Google Analytics", () => {
    expect(CSP_PAGINAS).toContain("frame-ancestors 'none'");
    expect(CSP_PAGINAS).toContain("base-uri 'self'");
    expect(CSP_PAGINAS).toMatch(/script-src 'self'( |;)/);
    const permitidas = new Set([...ORIGENS_ANALYTICS.script, ...ORIGENS_ANALYTICS.conexao, ...ORIGENS_ANALYTICS.imagem]);
    const externas = CSP_PAGINAS.match(/https:\/\/[^\s;]+/g) ?? [];
    expect(externas.length).toBeGreaterThan(0);
    for (const origem of externas) expect(permitidas.has(origem), origem).toBe(true);
    expect(CSP_PAGINAS).toContain(`script-src 'self' 'unsafe-inline' ${ORIGENS_ANALYTICS.script.join(" ")}`);
  });

  it("o Google Analytics só carrega no deploy de produção da Vercel", () => {
    expect(analyticsAtivo("production")).toBe(true);
    expect(analyticsAtivo("preview")).toBe(false);
    expect(analyticsAtivo(undefined)).toBe(false);
  });

  it("só o next dev recebe 'unsafe-eval'", () => {
    expect(CSP_PAGINAS).not.toContain("'unsafe-eval'");
    expect(cspPaginas(false)).not.toContain("'unsafe-eval'");
    expect(cspPaginas(true)).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' ");
  });
});
