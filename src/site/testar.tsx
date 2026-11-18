"use client";

import { useState } from "react";
import { Button, CodeBlock, Select, TextInput } from "@/ui/componentes";
import { PREFIXO_API } from "@/versao";

function opcoesIncluir(descricao: string) {
  const tokens = descricao.split(/[,.]/).map((parte) => parte.trim()).filter((parte) => /^[a-z_]+$/.test(parte));
  if (tokens.includes("sinonimos") && tokens.includes("atividades")) {
    return ["sinonimos", "sinonimos,atividades", "sinonimos,competencias", "perfil_ocupacional"];
  }
  return tokens;
}

export function TestarRota({
  caminho,
  parametros,
  exemplos,
  curlInicial,
  jsonInicial,
  atalhos,
}: {
  caminho: string;
  parametros: { nome: string; onde: "query" | "path"; descricao: string }[];
  exemplos: Record<string, string>;
  curlInicial: string;
  jsonInicial: string;
  atalhos: boolean;
}) {
  const [valores, setValores] = useState<Record<string, string>>({ ...exemplos });
  const [curl, setCurl] = useState(curlInicial);
  const [json, setJson] = useState(jsonInicial);
  const [estado, setEstado] = useState("exemplo");

  async function executar(proximos: Record<string, string>) {
    let path = caminho === "/" ? "" : caminho;
    const query = new URLSearchParams();
    for (const parametro of parametros) {
      const valor = proximos[parametro.nome]?.trim();
      if (!valor) continue;
      if (parametro.onde === "path") path = path.replaceAll(`:${parametro.nome}`, encodeURIComponent(valor));
      else query.set(parametro.nome, valor);
    }
    if (path.includes(":")) {
      setEstado("Preencha os trechos do caminho.");
      return;
    }
    const busca = query.toString();
    const url = `${PREFIXO_API}${path}${busca ? `?${busca}` : ""}`;
    setCurl(`curl https://cbo.ciencia.social${url}`);
    setEstado("Consultando…");
    try {
      const resposta = await fetch(url);
      const bruto = await resposta.text();
      let texto = bruto;
      try {
        texto = JSON.stringify(JSON.parse(bruto), null, 2);
      } catch {
        texto = bruto;
      }
      if (texto.length > 8000) texto = `${texto.slice(0, 8000)}\n…`;
      setJson(texto);
      setEstado(`${resposta.status} · ${resposta.ok ? "OK" : resposta.statusText}`);
    } catch {
      setEstado("Não foi possível consultar a rota.");
    }
  }

  function definir(nome: string, valor: string) {
    setValores((atual) => ({ ...atual, [nome]: valor }));
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "end" }}>
        {parametros
          .filter((parametro) => parametro.nome !== "campos")
          .map((parametro) =>
            parametro.nome === "incluir" ? (
              <Select
                key={parametro.nome}
                label="incluir"
                value={valores.incluir ?? ""}
                onChange={(evento) => definir("incluir", evento.target.value)}
                options={[{ value: "", label: "—" }, ...opcoesIncluir(parametro.descricao).map((valor) => ({ value: valor, label: valor }))]}
              />
            ) : (
              <TextInput
                key={`${parametro.onde}-${parametro.nome}`}
                label={parametro.nome}
                value={valores[parametro.nome] ?? ""}
                onChange={(evento) => definir(parametro.nome, evento.target.value)}
              />
            ),
          )}
        <Button type="button" variant="primary" onClick={() => void executar(valores)}>Executar</Button>
      </div>
      {atalhos ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {["212405", "212499", "21240"].map((codigo) => (
            <Button
              key={codigo}
              type="button"
              variant="link"
              onClick={() => {
                const proximos = { ...valores, codigo };
                setValores(proximos);
                void executar(proximos);
              }}
            >
              {codigo}
            </Button>
          ))}
        </div>
      ) : null}
      <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "14px", lineHeight: "20px" }}>
        A resposta traz <span className="x-inline">X-Versao-Dados</span>, <span className="x-inline">ETag</span> e <span className="x-inline">Cache-Control: public, max-age=86400, stale-while-revalidate=604800</span>.
      </p>
      <CodeBlock code={curl} lang="bash" title="curl" meta={estado} />
      <CodeBlock code={json} lang="json" title="JSON" meta="application/json" />
    </div>
  );
}
