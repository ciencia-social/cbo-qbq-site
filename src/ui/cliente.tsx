"use client";

import { useState } from "react";
import { Icon } from "@/ui/icone";

export function BotaoTema() {
  function alternar() {
    const html = document.documentElement;
    const atual = html.getAttribute("data-theme") === "light" ? "light" : "dark";
    const proximo = atual === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", proximo);
    try {
      localStorage.setItem("cs-tema", proximo);
    } catch {
      /* armazenamento bloqueado */
    }
    document.dispatchEvent(new CustomEvent("cs-tema", { detail: proximo }));
  }
  return (
    <button type="button" className="cs-theme" data-cs-theme-toggle="" onClick={alternar}>
      <Icon name="sun" data-quando="claro" />
      <Icon name="moon" data-quando="escuro" />
      <span data-quando="claro">Tema claro</span>
      <span data-quando="escuro">Tema escuro</span>
    </button>
  );
}

export function BotaoCopiar({ code }: { code: string }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    const ok = () => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    };
    try {
      void navigator.clipboard.writeText(code).then(ok, () => {});
    } catch {
      /* sem área de transferência */
    }
  }
  return (
    <button type="button" className="cs-code__copy" onClick={copiar} aria-live="polite">
      <Icon name={copiado ? "check" : "copy"} size={14} />
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}
