import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { quadro, tempos } from "@/site/ilustracao";
import { Ilustracao } from "@/site/ilustracao-view";
import { carregarInicio } from "@/site/inicio";
import { PaginaInicio } from "@/site/inicio-view";

describe("início", () => {
  const vista = carregarInicio();

  it("confere os números do conjunto e a cobertura", () => {
    expect(vista.numeros).toMatchObject({
      ocupacoes: "2.698",
      detalheOcupacoes: "2.694 na CBO e 4 só no QBQ",
      atividades: "174.296",
      areas: "20.723",
      competencias: "258.963",
      sinonimos: "7.778",
      grandesGrupos: 10,
    });
    expect(vista.cobertura).toEqual({ total: 64, soCbo: 25, soQbq: 4, titulo: 35, semNivel: 55 });
    expect(vista.grupos).toHaveLength(10);
    expect(vista.grupos.find((grupo) => grupo.codigo === "3")?.titulo).toBe("TÉCNICOS DE NIVEL MÉDIO");
    expect(vista.vocabularios.map((item) => item.slug)).toEqual(["habilidades", "conhecimentos-i", "conhecimentos-ii", "atitudes"]);
    expect(vista.vocabularios.map((item) => item.niveis)).toEqual([
      "3 domínios, 12 categorias e 87 habilidades, com 96 definições oficiais",
      "2 domínios, 22 áreas, 211 campos e 1.446 conhecimentos",
      "9 áreas, 86 campos, 448 conhecimentos e 1.417 elementos",
      "4 categorias e 22 atitudes",
    ]);
    expect(vista.exemplo).toContain('"codigo": "212405"');
    expect(vista.exemplo).toContain('"qualificacao": 5');
  });

  it("monta os três diálogos com os números do banco", () => {
    const [sinonimo, transicao, validacao] = vista.dialogos;
    expect(sinonimo.cardCod).toBe("3171-05");
    expect(sinonimo.ok).toBe("→ 1 ocupação, casou em sinônimo");
    expect(sinonimo.cardTitulo).toBe("Desenvolvedor web (técnico)");
    expect(transicao.ok).toBe("→ similaridade 0,913");
    expect(transicao.cardLinhas).toEqual(["PROGRAMAÇÃO DE OPERAÇÕES: 2 → 5", "ANÁLISE DE OPERAÇÕES: 3 → 5"]);
    expect(transicao.bot).toContain("as 42 do analista de desenvolvimento");
    expect(validacao.ok).toBe("→ existe: false");
    expect(validacao.cardCod).toBe("2124");
    expect(validacao.bot).toContain("família 2124, com 6 ocupações");
    expect(validacao.cardLinhas[1]).toBe("2124-10, 2124-15, 2124-20, 2124-25 e 2124-30");
  });

  it("marca os passos da ilustração e mostra a primeira conversa completa sem movimento", () => {
    const dialogo = vista.dialogos[0];
    const tm = tempos(dialogo);
    expect(quadro(dialogo, tm.tool).toolStatus).toBe("→ consultando");
    expect(quadro(dialogo, tm.tool - 1).showTool).toBe(false);
    expect(quadro(dialogo, tm.toolOk).toolStatus).toBe(dialogo.ok);
    expect(quadro(dialogo, tm.bot).showBot).toBe(true);
    expect(quadro(dialogo, tm.card).showCard).toBe(true);
    expect(quadro(dialogo, tm.fecho).showFecho).toBe(true);
    expect(quadro(dialogo, tm.u - 1).user.length).toBe((tm.u - 1) * 2);
    const html = renderToStaticMarkup(<PaginaInicio vista={vista} />);
    expect(html).toContain("2.698");
    expect(html).toContain("174.296");
    expect(html).toContain("258.963");
    expect(html).toContain("7.778");
    expect(html).toContain("TÉCNICOS DE NIVEL MÉDIO");
    expect(html).toContain("Preliminar");
    expect(html).toContain("Conversa 1 de 3: sinônimo");
    expect(html).not.toMatch(/Fonte:/);
    expect(html).not.toMatch(/D0\d\d/);
    const reduzido = renderToStaticMarkup(<Ilustracao dialogos={vista.dialogos} />);
    expect(reduzido).toContain("aria-hidden");
    const completo = quadro(dialogo, tm.fim);
    expect(completo.showCard).toBe(true);
    expect(completo.showFecho).toBe(true);
    expect(completo.typingBot).toBe(false);
  });
});
