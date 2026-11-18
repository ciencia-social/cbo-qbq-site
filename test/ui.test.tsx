import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge, CodeBlock, DataTable, Figure, NetworkBar, secaoAtual } from "@/ui/componentes";
import { formato, tresCasas } from "@/ui/formato";
import { realcar } from "@/ui/realce";
import { SCRIPT_TEMA } from "@/ui/tema";

describe("interface", () => {
  it("formata número no padrão brasileiro", () => {
    expect(formato(2698)).toBe("2.698");
    expect(formato(4.5)).toBe("4,5");
    expect(formato(0.913)).toBe("0,9");
    expect(tresCasas(0.913)).toBe("0,913");
    expect(formato(null)).toBe("s/d");
  });

  it("realça json com as classes do design system", () => {
    const tokens = realcar('{"codigo": "212405"}', "json");
    expect(tokens.some((token) => token.c === "key" && token.t.includes("codigo"))).toBe(true);
    expect(tokens.some((token) => token.c === "str" && token.t.includes("212405"))).toBe(true);
  });

  it("marca a seção atual e prepara o tema sem flash", () => {
    expect(secaoAtual("/ocupacoes/212405", "/ocupacoes")).toBe(true);
    expect(secaoAtual("/docs/mcp", "/docs")).toBe(false);
    expect(secaoAtual("/docs/ocupacoes", "/docs")).toBe(true);
    const html = renderToStaticMarkup(<NetworkBar atual="/sobre" />);
    expect(html).toContain('href="/sobre" aria-current="page"');
    expect(html).toContain("Tema claro");
    expect(html).toContain("Tema escuro");
    expect(html).toContain('data-quando="claro"');
    expect(SCRIPT_TEMA).toContain('salvo==="light"||salvo==="dark"?salvo:"dark"');
    expect(SCRIPT_TEMA).toContain('setAttribute("data-theme","light")');
  });

  it("não imprime Fonte: nos componentes de dado", () => {
    const figura = renderToStaticMarkup(
      <Figure title="Similaridade" variant="card">
        <p>0,913</p>
      </Figure>,
    );
    const tabela = renderToStaticMarkup(
      <DataTable columns={[{ key: "n", label: "Total", numeric: true }]} rows={[{ n: 2698 }]} title="Contagem" />,
    );
    const codigo = renderToStaticMarkup(<CodeBlock code='{"a": 1}' lang="json" title="Exemplo" />);
    const selo = renderToStaticMarkup(<Badge status="ilustrativo">Derivado, não oficial</Badge>);
    expect(figura).not.toContain("Fonte:");
    expect(tabela).not.toContain("Fonte:");
    expect(tabela).toContain("2.698");
    expect(codigo).toContain("cs-tk-key");
    expect(codigo).toContain("Copiar");
    expect(selo).toContain("Derivado, não oficial");
  });
});
