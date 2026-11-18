import { Badge, Callout, Icon, SegmentedControl, Toc } from "@/ui/componentes";
import { AbasCliente } from "@/site/mcp-abas";
import { carregarMcp } from "@/site/mcp";

const h2 = { margin: "0 0 var(--space-4)", font: "500 28px/34px var(--font-serif)" } as const;

export function PaginaMcp({ grupo }: { grupo?: string }) {
  const vista = carregarMcp(grupo);
  return (
    <main className="cs-page">
      <section className="cs-rhead" style={{ paddingBottom: "var(--space-6)" }}>
        <div className="cs-rhead__eyebrow" style={{ marginBottom: "var(--space-5)" }}>
          <span className="cs-meta-text">Model Context Protocol · cbo.ciencia.social/mcp</span>
          <Badge status="preliminar">Preliminar</Badge>
        </div>
        <h1 className="cs-rhead__title" style={{ fontSize: "48px", lineHeight: "54px", maxWidth: "46rem" }}>Conecte um assistente à fonte oficial</h1>
        <p className="cs-rhead__sub" style={{ maxWidth: "46rem" }}>
          Com o servidor MCP, o assistente consulta códigos, títulos, níveis e competências em vez de responder de memória. Somente leitura, sem cadastro e sem chave.
        </p>
      </section>
      <div className="x-stack-sm" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-7)", alignItems: "flex-start" }}>
        <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          <section id="conectar" aria-labelledby="h-conectar">
            <h2 id="h-conectar" style={h2}>Conectar</h2>
            <AbasCliente />
          </section>
          <section id="instrucoes" aria-labelledby="h-instr">
            <h2 id="h-instr" style={h2}>O que o servidor diz ao modelo</h2>
            <p style={{ margin: "0 0 var(--space-4)", font: "400 17px/27px var(--font-serif)", color: "var(--ink-2)", maxWidth: "44rem" }}>
              Na inicialização, o servidor envia estas instruções. Elas valem para qualquer cliente.
            </p>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "var(--space-3)", maxWidth: "48rem" }}>
              {vista.instrucoes.map((texto, indice) => (
                <li key={texto} style={{ display: "grid", gridTemplateColumns: "2rem minmax(0, 1fr)", gap: "var(--space-3)", padding: "var(--space-3) 0", borderTop: "1px solid var(--line)" }}>
                  <span className="x-id" style={{ color: "var(--ink-3)" }}>{indice + 1}</span>
                  <span style={{ font: "400 17px/26px var(--font-serif)" }}>{texto}</span>
                </li>
              ))}
            </ol>
          </section>
          <section id="tools" aria-labelledby="h-tools">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
              <h2 id="h-tools" style={{ margin: 0, font: "500 28px/34px var(--font-serif)" }}>Tools</h2>
              <SegmentedControl
                legend="Grupo"
                name="grupo"
                value={vista.grupo}
                options={[
                  { value: "todas", label: `Todas · ${vista.total}`, href: "/docs/mcp" },
                  { value: "nucleo", label: "Núcleo", href: "/docs/mcp?grupo=nucleo" },
                  { value: "exploracao", label: "Exploração", href: "/docs/mcp?grupo=exploracao" },
                  { value: "derivado", label: "Derivadas", href: "/docs/mcp?grupo=derivado" },
                ]}
              />
            </div>
            <p style={{ margin: "0 0 var(--space-4)", fontSize: "14px", lineHeight: "20px", color: "var(--ink-2)", maxWidth: "46rem" }}>
              Todas são somente leitura. Cada uma aponta para a rota REST que devolve os mesmos campos, quando essa rota existe.
            </p>
            <div className="cs-table-scroll">
              <table className="cs-table">
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">Para quê</th>
                    <th scope="col">REST</th>
                    <th scope="col">Natureza</th>
                  </tr>
                </thead>
                <tbody>
                  {vista.tools.map((tool) => (
                    <tr key={tool.nome}>
                      <td><code className="x-id" style={{ color: "var(--code-key)", whiteSpace: "nowrap" }}>{tool.nome}</code></td>
                      <td>
                        {tool.descricao}
                        <span style={{ display: "block", marginTop: 2, color: "var(--ink-3)", fontSize: "13px" }}>{tool.argumentos.join(", ")}</span>
                      </td>
                      <td style={{ font: "400 13px/18px var(--font-mono)" }}>{tool.rotas}</td>
                      <td><span className={tool.natureza === "derivado" ? "cs-badge cs-badge--ilustrativo" : "cs-badge"}>{tool.natureza}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <aside style={{ flex: "1 1 18rem", maxWidth: "22rem", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <Toc title="Nesta página" items={[{ href: "#conectar", label: "Conectar" }, { href: "#instrucoes", label: "Instruções do servidor" }, { href: "#tools", label: "Tools" }]} />
          <div style={{ padding: "var(--space-5)", background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", display: "grid", gap: "var(--space-3)" }}>
            <p className="cs-meta-text" style={{ margin: 0 }}>Dois modos, as mesmas tools</p>
            <p style={{ margin: 0, fontSize: "14px", lineHeight: "20px", display: "flex", gap: "var(--space-2)" }}><Icon name="globe" /><span><strong>Hospedado:</strong> HTTP em <span className="x-inline">cbo.ciencia.social/mcp</span>.</span></p>
            <p style={{ margin: 0, fontSize: "14px", lineHeight: "20px", display: "flex", gap: "var(--space-2)" }}><Icon name="server" /><span><strong>Local:</strong> stdio, com os dados embutidos. O comando fica entre colchetes até o pacote existir.</span></p>
          </div>
          <Callout kind="nota" label="Orçamento de contexto">
            <p style={{ margin: 0 }}>As respostas vêm resumidas: limite padrão de 10 a 20 itens, máximo de 50. Textos longos só sob pedido, e toda resposta truncada diz o total e como pedir o restante.</p>
          </Callout>
        </aside>
      </div>
    </main>
  );
}
