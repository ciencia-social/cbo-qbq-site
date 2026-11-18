"use client";

import { useState } from "react";
import { Button, TextInput } from "@/ui/componentes";
import { PREFIXO_API } from "@/versao";

export function TestarRota({
  caminho,
  parametros,
  exemplos,
}: {
  caminho: string;
  parametros: { nome: string; onde: "query" | "path"; descricao: string }[];
  exemplos: Record<string, string>;
}) {
  const [valores, setValores] = useState<Record<string, string>>(exemplos);
  const [saida, setSaida] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  async function executar() {
    let path = caminho;
    const query = new URLSearchParams();
    for (const parametro of parametros) {
      const valor = valores[parametro.nome]?.trim();
      if (!valor) continue;
      if (parametro.onde === "path") path = path.replace(`:${parametro.nome}`, encodeURIComponent(valor));
      else query.set(parametro.nome, valor);
    }
    if (path.includes(":")) {
      setSaida("Preencha os parâmetros do caminho antes de executar.");
      setStatus(null);
      return;
    }
    const url = `${PREFIXO_API}${path === "/" ? "" : path}${query.size ? `?${query}` : ""}`;
    const resposta = await fetch(url);
    setStatus(resposta.status);
    const texto = await resposta.text();
    setSaida(texto.length > 8000 ? `${texto.slice(0, 8000)}\n…` : texto);
  }
  return (
    <div style={{ padding: "var(--space-5)", background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
        {parametros.map((parametro) => (
          <TextInput
            key={`${parametro.onde}-${parametro.nome}`}
            label={`${parametro.nome} (${parametro.onde === "path" ? "caminho" : "consulta"})`}
            name={parametro.nome}
            value={valores[parametro.nome] ?? ""}
            onChange={(evento) => setValores((atual) => ({ ...atual, [parametro.nome]: evento.target.value }))}
          />
        ))}
        <Button variant="primary" type="button" icon="play" onClick={() => void executar()}>
          Executar
        </Button>
      </div>
      {status != null ? <p className="cs-meta-text" style={{ margin: 0 }}>HTTP {status}</p> : null}
      {saida ? (
        <pre className="cs-code__pre" tabIndex={0} style={{ maxHeight: "22rem", whiteSpace: "pre-wrap" }}>
          {saida}
        </pre>
      ) : null}
    </div>
  );
}
