import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { carregarFicha } from "@/site/ficha";
import { PaginaFicha } from "@/site/ficha-view";
import { carregarTermo } from "@/site/competencias";
import { PaginaTermo } from "@/site/competencias-view";

async function status404(promessa: Promise<unknown>) {
  try {
    await promessa;
    return false;
  } catch (erro) {
    return String((erro as { digest?: string }).digest ?? "").includes("404");
  }
}

describe("I9 404 nas páginas", () => {
  it("a ficha de 212499 chama notFound()", async () => {
    const { default: Page } = await import("../../app/ocupacoes/[codigo]/page");
    expect(await status404(Page({ params: Promise.resolve({ codigo: "212499" }), searchParams: Promise.resolve({}) }))).toBe(true);
    expect(await status404(Page({ params: Promise.resolve({ codigo: "21" }), searchParams: Promise.resolve({}) }))).toBe(true);
  });

  it("o termo e o vocabulário inexistentes chamam notFound()", async () => {
    const { default: Termo } = await import("../../app/competencias/[vocabulario]/[nivel]/[codigo]/page");
    expect(await status404(Termo({ params: Promise.resolve({ vocabulario: "habilidades", nivel: "habilidades", codigo: "99.99.99" }), searchParams: Promise.resolve({}) }))).toBe(true);
    const { default: Indice } = await import("../../app/competencias/[vocabulario]/page");
    expect(await status404(Indice({ params: Promise.resolve({ vocabulario: "inexistente" }) }))).toBe(true);
  });

  it("a página de ausência mostra a família 2124 com link de página, sem caminho da API", () => {
    const ficha = carregarFicha("212499", { transversais: "incluir", dimensao: "habilidades", todas: false });
    expect(ficha.tipo).toBe("ausente");
    const html = renderToStaticMarkup(<PaginaFicha ficha={ficha} />);
    expect(html).toContain('href="/ocupacoes?prefixo=2124"');
    expect(html).toContain("2124");
    expect(html).not.toContain("/api/v1");
    expect(html).toContain('href="/ocupacoes/212405"');
  });

  it("o termo ausente aponta o mesmo código em outro nível e o índice", () => {
    const ficha = carregarTermo("habilidades", "dominios", "01.03.05");
    expect(ficha.tipo).toBe("ausente");
    const html = renderToStaticMarkup(<PaginaTermo ficha={ficha} />);
    expect(html).toContain('href="/competencias/habilidades/habilidades/01.03.05"');
    expect(html).toContain('href="/competencias/habilidades"');
    expect(html).not.toContain("/api/v1");
  });
});
