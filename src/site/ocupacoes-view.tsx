import { Button, FilterBar, Icon, SegmentedControl, Select, TextInput } from "@/ui/componentes";
import { rotuloSituacao, type NoArvore, type VistaOcupacoes } from "@/site/ocupacoes";

const estiloTitulo = { margin: 0, font: "500 40px/46px var(--font-serif)", letterSpacing: "-.01em" } as const;
const estiloSecao = { margin: 0, font: "500 28px/34px var(--font-serif)" } as const;

function hrefDe(vista: VistaOcupacoes, extra: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  const valores: Record<string, string | undefined> = {
    q: vista.q || undefined,
    prefixo: vista.prefixo,
    grande_grupo: vista.grandeGrupo || undefined,
    nivel_qualificacao: vista.nivel || undefined,
    situacao_qbq: vista.situacao || undefined,
    buscar_em: vista.buscarEm === "titulo_sinonimo" ? undefined : vista.buscarEm,
    ...extra,
  };
  for (const [chave, valor] of Object.entries(valores)) if (valor) params.set(chave, valor);
  const consulta = params.toString();
  return consulta ? `/ocupacoes?${consulta}` : "/ocupacoes";
}

function Arvore({ nos, atual, vista, profundo = false }: { nos: NoArvore[]; atual?: string; vista: VistaOcupacoes; profundo?: boolean }) {
  return (
    <ul className="x-tree" style={profundo ? { listStyle: "none", margin: 0, padding: "0 0 0 var(--space-4)", borderLeft: "1px solid var(--line)", marginLeft: "var(--space-3)" } : { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "1px" }}>
      {nos.map((no) => (
        <li key={no.codigo}>
          <a href={hrefDe(vista, { prefixo: no.codigo, grande_grupo: no.codigo[0], deslocamento: undefined })} aria-current={atual === no.codigo ? "page" : undefined} style={atual?.startsWith(no.codigo) ? { fontWeight: 600 } : undefined}>
            <span className="x-id">{no.codigo}</span>
            <span>{no.titulo}</span>
            <span className="n">{no.total}</span>
          </a>
          {no.filhos ? <Arvore nos={no.filhos} atual={atual} vista={vista} profundo /> : null}
        </li>
      ))}
    </ul>
  );
}

export function PaginaOcupacoes({ vista }: { vista: VistaOcupacoes }) {
  const opcoesNivel = [{ value: "", label: "Todos" }, ...[1, 2, 3, 4, 5, 6, 7, 8].map((nivel) => ({ value: String(nivel), label: `Nível ${nivel}` }))];
  const opcoesSituacao = [
    { value: "", label: "Todas" },
    { value: "classificada", label: "Classificada" },
    { value: "nao_classificada", label: "Não classificada" },
    { value: "sem_nivel_sem_justificativa", label: "Sem nível e sem justificativa" },
    { value: "ausente_no_qbq", label: "Ausente no QBQ" },
  ];
  return (
    <main className="cs-page">
      <header style={{ marginTop: "var(--space-6)", borderTop: "2px solid var(--ink)", paddingTop: "var(--space-5)", paddingBottom: "var(--space-5)" }}>
        <p className="cs-meta-text" style={{ margin: "0 0 var(--space-3)" }}>
          CBO · classificação · QBQ · níveis
        </p>
        <h1 style={estiloTitulo}>Ocupações</h1>
        <p style={{ margin: "var(--space-3) 0 0", font: "400 19px/30px var(--font-serif)", color: "var(--ink-2)", maxWidth: "46rem" }}>
          Navegue pela hierarquia da CBO ou busque por título, sinônimo ou código. Cada ocupação mostra a situação no QBQ, inclusive quando não há nível.
        </p>
      </header>
      <form role="search" action="/ocupacoes" method="get" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {vista.prefixo ? <input type="hidden" name="prefixo" value={vista.prefixo} /> : null}
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "nowrap", alignItems: "flex-end" }}>
          <TextInput label="Buscar em títulos e sinônimos" type="search" name="q" icon="search" defaultValue={vista.q} block style={{ flex: "1 1 0", minWidth: 0 }} />
          <Button variant="primary" type="submit" icon="search" style={{ flex: "none" }}>
            Buscar
          </Button>
        </div>
        <FilterBar>
          <Select label="Grande grupo" name="grande_grupo" defaultValue={vista.grandeGrupo} options={[{ value: "", label: "Todos" }, ...vista.grupos]} />
          <Select label="Nível de qualificação" name="nivel_qualificacao" defaultValue={vista.nivel} options={opcoesNivel} />
          <Select label="Situação no QBQ" name="situacao_qbq" defaultValue={vista.situacao} options={opcoesSituacao} />
          <SegmentedControl
            legend="Buscar em"
            name="buscar_em"
            defaultValue={vista.buscarEm}
            options={[
              { value: "titulo_sinonimo", label: "Título e sinônimo" },
              { value: "sintese", label: "Também a síntese" },
              { value: "atividade", label: "Atividades" },
            ]}
          />
        </FilterBar>
      </form>
      <div className="x-stack-sm" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-7)", marginTop: "var(--space-6)", alignItems: "flex-start" }}>
        <nav aria-label="Hierarquia da CBO" style={{ flex: "1 1 18rem", maxWidth: "24rem", minWidth: 0 }}>
          <p className="cs-meta-text" style={{ margin: "0 0 var(--space-3)" }}>
            Hierarquia da CBO
          </p>
          <Arvore nos={vista.arvore} atual={vista.prefixo} vista={vista} />
        </nav>
        <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-7)" }}>
          {vista.no ? (
            <section aria-labelledby="h-ramo">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-3)", flexWrap: "wrap", borderBottom: "1px solid var(--ink)", paddingBottom: "var(--space-3)" }}>
                <div>
                  <p className="cs-meta-text" style={{ margin: "0 0 var(--space-1)" }}>
                    {vista.no.caminho}
                  </p>
                  <h2 id="h-ramo" style={estiloSecao}>
                    {vista.no.titulo}
                  </h2>
                </div>
                <span className="x-go">
                  <Icon name="list" /> {vista.no.total} ocupações
                </span>
              </div>
              <div className="cs-table-scroll">
                <table className="cs-table">
                  <thead>
                    <tr>
                      <th scope="col">Código</th>
                      <th scope="col">Ocupação</th>
                      <th scope="col" className="cs-num">Nível QBQ</th>
                      <th scope="col">Situação no QBQ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vista.ocupacoes.map((ocupacao) => (
                      <tr key={ocupacao.codigo}>
                        <td>
                          <span className="x-id" style={{ color: "var(--ink)" }}>
                            {ocupacao.codigoFormatado}
                          </span>
                        </td>
                        <td>
                          <a className="x-row-link" href={`/ocupacoes/${ocupacao.codigo}`} style={{ fontWeight: 500 }}>
                            {ocupacao.titulo}
                          </a>
                        </td>
                        <td className="cs-num">{ocupacao.nivel}</td>
                        <td>
                          <span className="cs-badge">{rotuloSituacao(ocupacao.situacao)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {vista.busca ? (
            <section aria-labelledby="h-resultados">
              <div style={{ borderBottom: "1px solid var(--ink)", paddingBottom: "var(--space-3)" }}>
                <p className="cs-meta-text" style={{ margin: "0 0 var(--space-1)" }}>
                  Busca · {vista.buscarEm === "atividade" ? "atividades" : vista.buscarEm === "sintese" ? "título, sinônimo e síntese" : "título e sinônimo"}
                </p>
                <h2 id="h-resultados" style={estiloSecao}>
                  {vista.vazio
                    ? `Nenhuma ocupação casou com “${vista.q}”`
                    : vista.buscarEm === "titulo_sinonimo" && vista.busca.sinonimos != null
                      ? `${vista.busca.sinonimos} sinônimos${vista.busca.total > vista.busca.sinonimos ? ` e ${vista.busca.total - vista.busca.sinonimos} títulos oficiais` : ""} casam com “${vista.q}”`
                      : `${vista.busca.total} ocupações casam com “${vista.q}”`}
                </h2>
              </div>
              {vista.vazio ? (
                <p style={{ margin: "var(--space-4) 0 0", font: "400 17px/27px var(--font-serif)", color: "var(--ink-2)", maxWidth: "44rem" }}>
                  Nenhum título, sinônimo ou atividade casou. Vale buscar pelo que se faz na ocupação.
                </p>
              ) : (
                <div className="cs-table-scroll" style={{ marginTop: "var(--space-4)" }}>
                  <table className="cs-table">
                    <thead>
                      <tr>
                        <th scope="col">Casou em</th>
                        <th scope="col">Código</th>
                        <th scope="col">Ocupação (título CBO)</th>
                        <th scope="col">Família</th>
                        <th scope="col" className="cs-num">Nível</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vista.busca.linhas.map((linha, indice) => (
                        <tr key={`${linha.codigo}-${indice}`}>
                          <td>
                            <span style={{ fontSize: "12px", color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{linha.casou}</span>
                            <br />
                            <span>{linha.trecho}</span>
                          </td>
                          <td>
                            <span className="x-id" style={{ color: "var(--ink)" }}>
                              {linha.codigoFormatado}
                            </span>
                          </td>
                          <td>
                            <a className="x-row-link" href={`/ocupacoes/${linha.codigo}`}>
                              {linha.titulo}
                            </a>
                          </td>
                          <td>
                            <span className="x-id" style={{ fontSize: "13px" }}>
                              {linha.familia}
                            </span>
                          </td>
                          <td className="cs-num">{linha.nivel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ marginTop: "var(--space-4)" }}>
                <a className="x-go" href={hrefDe(vista, { buscar_em: "atividade", deslocamento: undefined })}>
                  Não achou? Busque pelo que se faz na ocupação <Icon name="arrow-right" />
                </a>
              </p>
              {vista.busca.total > 20 ? (
                <p style={{ display: "flex", gap: "var(--space-4)" }}>
                  {vista.busca.deslocamento > 0 ? (
                    <a className="x-go" href={hrefDe(vista, { deslocamento: String(Math.max(0, vista.busca.deslocamento - 20)) })}>
                      <Icon name="arrow-left" /> Página anterior
                    </a>
                  ) : null}
                  {vista.busca.deslocamento + 20 < vista.busca.total ? (
                    <a className="x-go" href={hrefDe(vista, { deslocamento: String(vista.busca.deslocamento + 20) })}>
                      Próxima página <Icon name="arrow-right" />
                    </a>
                  ) : null}
                </p>
              ) : null}
            </section>
          ) : null}
          {!vista.no && !vista.busca ? (
            <p style={{ margin: 0, font: "400 17px/27px var(--font-serif)", color: "var(--ink-2)", maxWidth: "40rem" }}>
              Escolha um ramo na hierarquia ou busque por um nome. A lista não começa com as 2.698 ocupações de uma vez.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
