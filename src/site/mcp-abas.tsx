"use client";

import { useState } from "react";
import { CodeBlock, Icon } from "@/ui/componentes";
import { CLIENTES } from "@/site/mcp-clientes";

export function AbasCliente() {
  const [atual, setAtual] = useState<(typeof CLIENTES)[number]["id"]>("code");
  const cliente = CLIENTES.find((item) => item.id === atual) ?? CLIENTES[0];
  return (
    <div>
      <div className="x-tabs" role="tablist" aria-label="Cliente">
        {CLIENTES.map((item) => (
          <button key={item.id} type="button" role="tab" className="x-tab" aria-selected={item.id === atual} onClick={() => setAtual(item.id)} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ paddingTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <CodeBlock lang={cliente.lang} title={cliente.arquivo} code={cliente.codigo} />
        <p style={{ margin: 0, fontSize: "13px", lineHeight: "18px", color: "var(--ink-3)" }}>{cliente.nota}</p>
      </div>
    </div>
  );
}
