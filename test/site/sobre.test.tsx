import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { carregarSobre } from "@/site/sobre";
import { PaginaSobre } from "@/site/sobre-view";
import { CITACAO_DADOS, CITACAO_SOFTWARE, DECLARACAO_IA, DOI_DADOS } from "@/versao";

describe("sobre", () => {
  it("reúne versão, cobertura, o literal NULL e as decisões", () => {
    const vista = carregarSobre();
    expect(vista.versao).toBe("dados-2026.11.2");
    expect(vista.schema).toBe("schema-v0.3.0");
    expect(vista.camadas.map((camada) => camada.versao)).toEqual(["dados-2026.11", "dados-2026.11.1", "dados-2026.08"]);
    expect(vista.divergencia).toEqual({ so_cbo: 25, so_qbq: 4, titulo_divergente: 35 });
    expect(vista.situacoes.find((item) => item.id === "classificada")?.total).toBe(2618);
    expect(vista.nulas).toBe(54);
    expect(vista.exemplo.cbo?.titulo).toBeTruthy();
    expect(vista.exemplo.qbq?.titulo).toBeTruthy();
    expect(vista.exemplo.cbo?.titulo).not.toBe(vista.exemplo.qbq?.titulo);
    const html = renderToStaticMarkup(<PaginaSobre vista={vista} />);
    expect(html).toContain("cs-page");
    expect(html).not.toContain("cs-report-layout");
    expect(html).toContain(vista.exemplo.cbo?.titulo ?? "");
    expect(html).toContain(vista.exemplo.qbq?.titulo ?? "");
    expect(html).toContain("NULL");
    expect(html).toContain("54");
    expect(html).toContain("/api/v1/decisoes/D015");
    expect(html).toContain(escapar(DECLARACAO_IA));
    expect(html).toContain("https://github.com/ciencia-social/cbo-qbq-dados");
    expect(html).not.toMatch(/Fonte:/);
  });

  it("mostra a citação, as licenças, a não oficialidade e a privacidade (P6, P12)", () => {
    const html = renderToStaticMarkup(<PaginaSobre vista={carregarSobre()} />);
    for (const titulo of ["Como citar", "Licenças", "Sobre este serviço", "Privacidade", "Uso de IA"]) {
      expect(html).toContain(`>${titulo}</h2>`);
      expect(html).toContain(`>${titulo}</a>`);
    }
    expect(html).toContain(escapar(CITACAO_DADOS));
    expect(html).toContain(escapar(CITACAO_SOFTWARE));
    expect(html).toContain(DOI_DADOS.versao);
    expect(html).toContain(DOI_DADOS.conceito);
    expect(html).toContain("sem vínculo com o Ministério do Trabalho e Emprego");
    expect(html).toContain("cs-tema");
  });
});

function escapar(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
