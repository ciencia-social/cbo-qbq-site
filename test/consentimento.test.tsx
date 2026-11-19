import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CHAVE_CONSENTIMENTO, lerConsentimento } from "@/site/analytics";
import { AvisoAnalytics, PreferenciaAnalytics } from "@/ui/aviso-analytics";

const armazenamento = (valor: string | null) => ({ getItem: (chave: string) => (chave === CHAVE_CONSENTIMENTO ? valor : null) });

describe("consentimento do Google Analytics", () => {
  it("só reconhece aceito e recusado; o resto conta como sem escolha", () => {
    expect(lerConsentimento(armazenamento("aceito"))).toBe("aceito");
    expect(lerConsentimento(armazenamento("recusado"))).toBe("recusado");
    expect(lerConsentimento(armazenamento(null))).toBeNull();
    expect(lerConsentimento(armazenamento("sim"))).toBeNull();
  });

  it("armazenamento bloqueado conta como sem escolha, e o GA não carrega", () => {
    expect(lerConsentimento({ getItem: () => { throw new Error("bloqueado"); } })).toBeNull();
  });

  it("o HTML do servidor não traz o aviso nem o gtag.js; tudo depende do navegador", () => {
    const html = renderToStaticMarkup(
      <>
        <AvisoAnalytics />
        <PreferenciaAnalytics />
      </>,
    );
    expect(html).toBe("");
  });
});
