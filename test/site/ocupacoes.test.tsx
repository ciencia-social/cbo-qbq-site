import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { obterOcupacao } from "@/consulta/ocupacao";
import { carregarFicha } from "@/site/ficha";
import { PaginaFicha } from "@/site/ficha-view";
import { carregarOcupacoes } from "@/site/ocupacoes";
import { PaginaOcupacoes } from "@/site/ocupacoes-view";

const hoje = new Date("2026-11-18T12:00:00Z");

function htmlFicha(entrada: string, extra?: Parameters<typeof carregarFicha>[1]) {
  const ficha = carregarFicha(entrada, extra ?? { transversais: "incluir", dimensao: "habilidades", todas: false }, hoje);
  return { ficha, html: ficha.tipo === "redirect" ? "" : renderToStaticMarkup(<PaginaFicha ficha={ficha} />) };
}

describe("ocupações", () => {
  it("abre a família 2124 com 6 ocupações e o título oficial do grande grupo 3", () => {
    const vista = carregarOcupacoes({ prefixo: "2124" });
    expect(vista.no?.titulo).toBe("Analistas de tecnologia da informação");
    expect(vista.no?.caminho).toBe("2 → 21 → 212 → 2124");
    expect(vista.ocupacoes).toHaveLength(6);
    const html = renderToStaticMarkup(<PaginaOcupacoes vista={carregarOcupacoes({})} />);
    expect(html).toContain("TÉCNICOS DE NIVEL MÉDIO");
    expect(html).not.toMatch(/Fonte:/);
    expect(html).not.toMatch(/D0\d\d/);
  });

  it("programador devolve 17 sinônimos", () => {
    const vista = carregarOcupacoes({ q: "programador" });
    expect(vista.busca?.sinonimos).toBe(17);
    const html = renderToStaticMarkup(<PaginaOcupacoes vista={vista} />);
    expect(html).toContain("17 sinônimos e 2 títulos oficiais");
    expect(html).toContain("Buscar");
  });

  it("212405 bate o gabarito e não mistura as camadas", () => {
    const { ficha, html } = htmlFicha("212405");
    expect(ficha.tipo).toBe("ok");
    if (ficha.tipo !== "ok") return;
    expect(ficha.caminho.map((passo) => passo.codigo)).toEqual(["2", "21", "212", "2124"]);
    expect(ficha.qbq?.niveis).toEqual({ conhecimento: 5, habilidade: 5, atitude: 5, qualificacao: 5 });
    expect(ficha.contagens).toEqual({ sinonimos: 10, areas: 10, atividades: 79, conhecimentos: 62, habilidades: 46, atitudes: 4 });
    expect(ficha.similares.map((item) => [item.codigo, item.valor])).toEqual([
      ["212415", 0.955],
      ["212420", 0.913],
      ["212410", 0.911],
      ["212310", 0.891],
      ["212315", 0.87],
    ]);
    expect(html).toContain("0,955");
    expect(html).toContain("0,870");
    expect(html).toContain("Derivado, não oficial");
    expect(html).toContain("18 de novembro de 2026");
    expect(html).not.toMatch(/Fonte:/);
    expect(html).not.toMatch(/D0\d\d/);
    expect(carregarFicha("2124-05", { transversais: "incluir", dimensao: "habilidades", todas: false }).tipo).toBe("redirect");
    expect(carregarFicha("2124 05", { transversais: "incluir", dimensao: "habilidades", todas: false }).tipo).toBe("redirect");
  });

  it("explica ausência, divergência e código inexistente", () => {
    const militar = htmlFicha("010105");
    expect(militar.ficha.tipo).toBe("ok");
    if (militar.ficha.tipo === "ok") {
      expect(militar.ficha.situacao).toBe("nao_classificada");
      expect(militar.ficha.justificativa).toBeTruthy();
      expect(militar.html).toContain(militar.ficha.justificativa ?? "");
    }
    const sem = htmlFicha("113005");
    expect(sem.html).toContain("sem justificativa");
    const soQbq = htmlFicha("516140");
    expect(soQbq.ficha.tipo).toBe("ok");
    if (soQbq.ficha.tipo === "ok") {
      expect(soQbq.ficha.cbo).toBeNull();
      expect(soQbq.html).toContain("não está na CBO");
      expect(soQbq.html).toContain(soQbq.ficha.qbq?.titulo ?? "");
    }
    const divergente = obterOcupacao("114210").dados as { cbo: { titulo: string }; qbq: { titulo: string } };
    const pagina = htmlFicha("114210");
    expect(pagina.html).toContain(divergente.cbo.titulo);
    expect(pagina.html).toContain(divergente.qbq.titulo);
    expect(pagina.html).toContain("Título diverge");
    const ausente = carregarFicha("212499", { transversais: "incluir", dimensao: "habilidades", todas: false });
    expect(ausente.tipo).toBe("ausente");
    if (ausente.tipo === "ausente") {
      expect(ausente.dica).toMatch(/2124/);
      expect(ausente.sugestoes.length).toBeGreaterThan(0);
      const html = renderToStaticMarkup(<PaginaFicha ficha={ausente} />);
      expect(html).toContain("212405");
    }
    const ruim = carregarFicha("21240", { transversais: "incluir", dimensao: "habilidades", todas: false });
    expect(ruim.tipo).toBe("malformado");
  });
});
