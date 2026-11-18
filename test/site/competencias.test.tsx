import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { carregarTermo } from "@/site/competencias";
import { PaginaTermo } from "@/site/competencias-view";

describe("competências", () => {
  it("01.03.05 reúne o gabarito de uso e a grafia oficial", () => {
    const ficha = carregarTermo("habilidades", "habilidades", "01.03.05");
    expect(ficha.tipo).toBe("ok");
    if (ficha.tipo !== "ok") return;
    expect(ficha.uso.ocupacoes).toBe(770);
    expect(ficha.uso.importancia_media).toBe(4.51);
    expect(ficha.comCinco).toBe(495);
    expect(ficha.percentualExigem).toBe(29);
    expect(ficha.percentualCinco).toBe(64);
    expect(ficha.distribuicao.por_nivel_qualificacao).toMatchObject({ "3": 1, "4": 13, "5": 74, "6": 289, "7": 346, "8": 47 });
    expect(ficha.distribuicao.por_grande_grupo).toMatchObject({ "1": 134, "2": 605, "3": 25, "4": 1, "5": 5 });
    const html = renderToStaticMarkup(<PaginaTermo ficha={ficha} />);
    expect(html).toContain("RACIOCÍNIO CRÍTICO");
    expect(html).toContain("RACIOCÍONIO CIENTÍFICO");
    expect(html).toContain("4,5");
    expect(html).toContain("Derivado, não oficial");
    expect(html).toContain("balde");
    expect(html).not.toMatch(/Fonte:/);
    expect(html).not.toMatch(/D0\d\d/);
  });

  it("conhecimentos-i 01.01.02 com importância mínima 4 devolve 29 ocupações", () => {
    const ficha = carregarTermo("conhecimentos-i", "conhecimentos", "01.01.02", { importanciaMin: 4 });
    expect(ficha.tipo).toBe("ok");
    if (ficha.tipo !== "ok") return;
    expect(ficha.totalLista).toBe(29);
  });
});
