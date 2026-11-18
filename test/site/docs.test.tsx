import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { carregarRota, slugRota } from "@/site/docs";
import { PaginaRota } from "@/site/docs-view";
import { listarRotas } from "@/site/docs";
import { carregarMcp, CLIENTES } from "@/site/mcp";
import { PaginaMcp } from "@/site/mcp-view";

describe("documentação", () => {
  it("descreve a ficha a partir do registro e aponta a tool", () => {
    expect(slugRota("/ocupacoes/:codigo")).toBe("ocupacoes/_codigo");
    const rota = carregarRota("ocupacoes/_codigo");
    expect(rota.tipo).toBe("ok");
    if (rota.tipo !== "ok") return;
    expect(rota.id).toBe("R21");
    expect(rota.tool).toBe("ocupacao_obter");
    expect(rota.chaves).toEqual(expect.arrayContaining(["codigo", "cbo", "qbq", "contagens"]));
    const html = renderToStaticMarkup(<PaginaRota rota={rota} irmas={listarRotas()} />);
    expect(html).toContain("Campos da resposta");
    expect(html).toContain("Erros que ensinam o caminho de volta");
    expect(html).toContain("Avisos");
    expect(rota.curl).toBe("curl https://cbo.ciencia.social/api/v1/ocupacoes/212405");
    expect(html).toContain("https://cbo.ciencia.social/api/v1/ocupacoes/212405");
    expect(html).toContain("/api/v1/problemas/");
    expect(html).not.toContain("/api/v1/erros/");
    expect(html).toContain("ocupacao_obter");
    const sem = carregarRota("escalas");
    expect(sem.tipo).toBe("ok");
    if (sem.tipo === "ok") expect(sem.tool).toBeUndefined();
  });

  it("lista as 15 tools e deixa o comando local entre colchetes", () => {
    const mcp = carregarMcp();
    expect(mcp.total).toBe(15);
    expect(mcp.instrucoes[0]).toMatch(/Nunca cite código CBO/);
    expect(CLIENTES.find((item) => item.id === "local")?.codigo).toContain("[COMANDO]");
    const html = renderToStaticMarkup(<PaginaMcp />);
    expect(html).toContain("Preliminar");
    expect(html).toContain("ocupacao_obter");
    expect(html).toContain("cbo.ciencia.social/mcp");
  });
});
