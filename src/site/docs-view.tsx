import { TextInput } from "@/ui/componentes";
import { TestarRota } from "@/site/testar";
import { listarRotas, type VistaRota } from "@/site/docs";

const h2 = { margin: "0 0 var(--space-4)", font: "500 28px/34px var(--font-serif)" } as const;

export function PaginaDocs({ q }: { q?: string }) {
  const grupos = listarRotas(q);
  return (
    <main className="cs-page">
      <header style={{ marginTop: "var(--space-6)", borderTop: "2px solid var(--ink)", paddingTop: "var(--space-5)" }}>
        <p className="cs-meta-text">API REST · /api/v1</p>
        <h1 style={{ margin: "var(--space-3) 0 0", font: "500 40px/46px var(--font-serif)" }}>Documentação</h1>
        <p style={{ margin: "var(--space-3) 0 0", maxWidth: "46rem", font: "400 19px/30px var(--font-serif)", color: "var(--ink-2)" }}>
          Cada página descreve uma rota do registro: método, caminho, parâmetros e as chaves de uma resposta de exemplo. Erros usam <span className="x-inline">/api/v1/problemas/…</span>.
        </p>
      </header>
      <form role="search" action="/docs" method="get" style={{ marginTop: "var(--space-5)", maxWidth: "28rem" }}>
        <TextInput block label="Buscar na documentação" type="search" name="q" icon="search" placeholder="Buscar rota ou campo" defaultValue={q} />
      </form>
      <div style={{ marginTop: "var(--space-6)", display: "grid", gap: "var(--space-6)" }}>
        {grupos.map((grupo) => (
          <section key={grupo.titulo} aria-labelledby={`g-${grupo.titulo}`}>
            <h2 id={`g-${grupo.titulo}`} style={{ margin: "0 0 var(--space-2)", font: "600 16px/22px var(--font-sans)" }}>{grupo.titulo}</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {grupo.itens.map((item) => (
                <li key={item.caminho} style={{ borderTop: "1px solid var(--line)" }}>
                  <a className="x-row-link" href={item.href} style={{ display: "grid", gridTemplateColumns: "4rem minmax(0, 1fr)", gap: "var(--space-3)", padding: "var(--space-3) 0" }}>
                    <span className="x-id">{item.id}</span>
                    <span>
                      <span style={{ font: "500 14px/20px var(--font-mono)" }}>{item.caminho === "/" ? "/api/v1" : item.caminho}</span>
                      <span style={{ display: "block", color: "var(--ink-2)" }}>{item.resumo}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

export function PaginaRota({ rota, irmas }: { rota: VistaRota; irmas: ReturnType<typeof listarRotas> }) {
  if (rota.tipo === "ausente") {
    return (
      <main className="cs-page">
        <header className="cs-rhead" style={{ marginTop: "var(--space-6)" }}>
          <h1 className="cs-rhead__title">Rota não encontrada</h1>
          <p className="cs-rhead__sub"><a className="x-a" href="/docs">Voltar à documentação</a></p>
        </header>
      </main>
    );
  }
  return (
    <main className="cs-page">
      <div className="x-stack-sm" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-7)", alignItems: "flex-start", marginTop: "var(--space-6)" }}>
        <nav aria-label="Documentação da API" style={{ flex: "1 1 14rem", maxWidth: "17rem", minWidth: 0, borderTop: "2px solid var(--ink)", paddingTop: "var(--space-4)" }}>
          <p className="cs-meta-text" style={{ margin: "0 0 var(--space-3)" }}><a className="x-a" href="/docs">API REST · v1</a></p>
          {irmas.map((grupo) => (
            <div key={grupo.titulo} style={{ marginBottom: "var(--space-4)" }}>
              <p style={{ margin: "0 0 var(--space-1)", font: "600 13px/18px var(--font-sans)" }}>{grupo.titulo}</p>
              {grupo.itens.map((item) => (
                <a key={item.caminho} href={item.href} aria-current={item.caminho === rota.caminho ? "page" : undefined} style={{ display: "block", padding: "4px 0", fontSize: "13px", lineHeight: "18px" }}>
                  {item.id} {item.caminho === "/" ? "/api/v1" : item.caminho}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-7)" }}>
          <header style={{ borderTop: "2px solid var(--ink)", paddingTop: "var(--space-4)" }}>
            <p style={{ margin: "0 0 var(--space-4)", fontSize: "13px", lineHeight: "18px", color: "var(--ink-3)" }}>
              <a className="x-a" href="/docs">Documentação</a> → {rota.grupo} → {rota.id}
            </p>
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
              <span className="x-method">GET</span>
              <code style={{ font: "500 20px/28px var(--font-mono)", overflowWrap: "anywhere" }}>{rota.caminhoPublico}</code>
              <span className="cs-badge">{rota.id}</span>
            </div>
            <h1 style={{ margin: "var(--space-4) 0 0", font: "500 40px/46px var(--font-serif)" }}>{rota.resumo}</h1>
            <dl style={{ margin: "var(--space-5) 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))", gap: "var(--space-4)", borderTop: "1px solid var(--line)", paddingTop: "var(--space-4)" }}>
              <div>
                <dt className="cs-meta-text">URL base</dt>
                <dd style={{ margin: "var(--space-1) 0 0", font: "400 14px/20px var(--font-mono)" }}>https://cbo.ciencia.social/api/v1</dd>
              </div>
              <div>
                <dt className="cs-meta-text">Autenticação</dt>
                <dd style={{ margin: "var(--space-1) 0 0" }}>Nenhuma.</dd>
              </div>
              <div>
                <dt className="cs-meta-text">Tool MCP equivalente</dt>
                <dd style={{ margin: "var(--space-1) 0 0" }}>
                  {rota.tool ? <a className="x-a" href="/docs/mcp" style={{ font: "400 14px/20px var(--font-mono)" }}>{rota.tool}</a> : "Esta rota não tem tool MCP equivalente."}
                </dd>
              </div>
            </dl>
          </header>
          <section id="parametros" aria-labelledby="h-param">
            <h2 id="h-param" style={h2}>Parâmetros</h2>
            {rota.parametros.length ? (
              <table className="cs-table">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">Onde</th>
                    <th scope="col">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {rota.parametros.map((parametro) => (
                    <tr key={`${parametro.onde}-${parametro.nome}`}>
                      <td><code className="x-id">{parametro.nome}</code></td>
                      <td>{parametro.onde === "path" ? "caminho" : "consulta"}</td>
                      <td>{parametro.descricao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ margin: 0, color: "var(--ink-2)" }}>Esta rota não tem parâmetros.</p>
            )}
          </section>
          <section id="resposta" aria-labelledby="h-resposta">
            <h2 id="h-resposta" style={h2}>Resposta de exemplo</h2>
            {rota.erro ? (
              <p>O exemplo respondeu {rota.erro.status}: {rota.erro.titulo}. {rota.erro.detalhe} {rota.erro.dica}</p>
            ) : (
              <p>Chaves de <span className="x-inline">dados</span>: {rota.chaves.length ? rota.chaves.join(", ") : "resposta sem objeto."}</p>
            )}
            {rota.avisos.length ? (
              <ul>
                {rota.avisos.map((aviso) => (
                  <li key={`${aviso.codigo ?? ""}-${aviso.mensagem}`}>{aviso.codigo ? `${aviso.codigo}: ` : ""}{aviso.mensagem}</li>
                ))}
              </ul>
            ) : null}
            <p style={{ color: "var(--ink-3)", fontSize: "14px" }}>Problemas seguem <span className="x-inline">/api/v1/problemas/…</span>, com título, detalhe e, quando cabe, uma dica.</p>
          </section>
          <section id="testar" aria-labelledby="h-testar">
            <h2 id="h-testar" style={h2}>Testar a rota</h2>
            <TestarRota caminho={rota.caminho} parametros={rota.parametros} exemplos={{ ...rota.exemplos, ...(rota.consultaExemplo ? Object.fromEntries(new URLSearchParams(rota.consultaExemplo)) : {}) }} />
          </section>
        </div>
      </div>
    </main>
  );
}
