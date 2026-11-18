import { Badge, BarChart, Button, Callout, Disclosure, Figure, Icon, SegmentedControl, TextInput, Toc } from "@/ui/componentes";
import { tresCasas } from "@/ui/formato";
import { rotuloSituacao } from "@/site/ocupacoes";
import type { FichaOk, FichaVista } from "@/site/ficha";

const h2 = { margin: "0 0 var(--space-5)", font: "500 28px/34px var(--font-serif)" } as const;

function Grau({ valor, forte = false }: { valor: number | null | undefined; forte?: boolean }) {
  const cheio = valor ?? 0;
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <span className="x-grade" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((passo) => (
          <i key={passo} className={passo <= cheio ? "on" : ""} />
        ))}
      </span>{" "}
      <span style={{ marginLeft: 6, fontWeight: forte ? 600 : undefined }}>{valor ?? "s/d"}</span>
    </span>
  );
}

function hrefDaFicha(ficha: FichaOk, extra: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  const valores = {
    transversais: ficha.transversais === "incluir" ? undefined : ficha.transversais,
    dimensao: ficha.dimensao === "habilidades" ? undefined : ficha.dimensao,
    ...extra,
  };
  for (const [chave, valor] of Object.entries(valores)) if (valor) params.set(chave, valor);
  const consulta = params.toString();
  return consulta ? `/ocupacoes/${ficha.codigo}?${consulta}` : `/ocupacoes/${ficha.codigo}`;
}

function vocabulario(ficha: FichaOk) {
  if (ficha.dimensao === "conhecimentos") return ficha.qbq?.taxonomia_conhecimento ?? undefined;
  return ficha.dimensao;
}

function notaTaxonomia(taxonomia: string | null | undefined) {
  if (taxonomia === "conhecimentos-i") return "a das ocupações de nível 1 a 5";
  if (taxonomia === "conhecimentos-ii") return "a das ocupações de nível 6 a 8";
  return null;
}

function seloDivergencia(ficha: FichaOk) {
  if (ficha.divergencia === "titulo_divergente") return "Título diverge entre CBO e QBQ";
  if (!ficha.cbo) return "Só no QBQ";
  if (!ficha.qbq) return "Só na CBO";
  return "Título igual nas duas camadas";
}

function CamadaAusente({ nome, porque }: { nome: string; porque: string }) {
  return (
    <div className="cs-col-6" style={{ padding: "var(--space-5)", background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
      <p className="cs-meta-text" style={{ margin: 0 }}>{nome}</p>
      <p style={{ margin: "var(--space-3) 0 0", font: "400 17px/27px var(--font-serif)" }}>{porque}</p>
    </div>
  );
}

function FichaPronta({ ficha }: { ficha: FichaOk }) {
  const taxonomia = notaTaxonomia(ficha.qbq?.taxonomia_conhecimento);
  const nivel = ficha.qbq?.niveis.qualificacao;
  const rotuloDimensao = ficha.dimensao === "conhecimentos" ? "conhecimentos" : ficha.dimensao;
  const vocab = vocabulario(ficha);
  return (
    <main className="cs-page">
      <nav aria-label="Caminho na CBO" style={{ marginTop: "var(--space-5)", fontSize: "13px", lineHeight: "18px", color: "var(--ink-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {ficha.caminho.map((passo, indice) => (
          <span key={passo.codigo} style={{ display: "inline-flex", gap: "var(--space-2)" }}>
            {indice > 0 ? <span aria-hidden="true">→</span> : null}
            <a className="x-a" href={`/ocupacoes?prefixo=${passo.codigo}`}>
              {passo.codigo} · {passo.titulo}
            </a>
          </span>
        ))}
      </nav>
      <header className="cs-rhead" style={{ marginTop: "var(--space-4)", paddingBottom: "var(--space-6)" }}>
        <div className="cs-rhead__eyebrow" style={{ marginBottom: "var(--space-5)" }}>
          <span className="cs-meta-text">Ocupação · CBO {ficha.formatado}</span>
          <span className="cs-badge cs-badge--consolidado">QBQ: {rotuloSituacao(ficha.situacao)}</span>
          <span className="cs-badge">{seloDivergencia(ficha)}</span>
        </div>
        <h1 className="cs-rhead__title">{ficha.titulo}</h1>
        {ficha.lead ? <p className="cs-rhead__sub">{ficha.lead}</p> : null}
        {ficha.qbq?.sintese ? (
          <p style={{ margin: "var(--space-2) 0 0", fontSize: "13px", lineHeight: "18px", color: "var(--ink-3)" }}>
            {ficha.qbq.sintese === "NULL" ? "A síntese do QBQ está registrada como o literal NULL." : "Início da síntese do QBQ."}{" "}
            <a className="x-go" href="#perfil-qbq" style={{ fontSize: "13px" }}>
              Ler a síntese e o perfil completos <Icon name="arrow-right" />
            </a>
          </p>
        ) : null}
        <dl className="cs-rhead__meta">
          <div>
            <dt>Nível de qualificação</dt>
            <dd style={{ font: "600 32px/38px var(--font-sans)" }}>
              {nivel ?? "s/d"} {nivel != null ? <span style={{ font: "400 14px/20px var(--font-sans)", color: "var(--ink-3)" }}>de 8</span> : null}
            </dd>
          </div>
          <div>
            <dt>Conhecimento · habilidade · atitude</dt>
            <dd style={{ font: "600 32px/38px var(--font-sans)" }}>
              {ficha.qbq ? `${ficha.qbq.niveis.conhecimento ?? "s/d"} · ${ficha.qbq.niveis.habilidade ?? "s/d"} · ${ficha.qbq.niveis.atitude ?? "s/d"}` : "s/d"}
            </dd>
          </div>
          <div>
            <dt>Taxonomia de conhecimento</dt>
            <dd>
              {ficha.qbq?.taxonomia_conhecimento ? <span className="x-inline">{ficha.qbq.taxonomia_conhecimento}</span> : "s/d"}
              {taxonomia ? <><br /><span style={{ color: "var(--ink-3)", fontSize: "13px" }}>{taxonomia}</span></> : null}
            </dd>
          </div>
          <div>
            <dt>Contagens</dt>
            <dd>
              {ficha.contagens.sinonimos} sinônimos · {ficha.contagens.areas} áreas · {ficha.contagens.atividades} atividades
              <br />
              {ficha.contagens.conhecimentos} conhecimentos · {ficha.contagens.habilidades} habilidades · {ficha.contagens.atitudes} atitudes
            </dd>
          </div>
        </dl>
        {ficha.justificativa ? (
          <p style={{ margin: "var(--space-4) 0 0", maxWidth: "46rem", font: "400 17px/27px var(--font-serif)" }}>{ficha.justificativa}</p>
        ) : ficha.situacao === "sem_nivel_sem_justificativa" ? (
          <p style={{ margin: "var(--space-4) 0 0", maxWidth: "46rem", font: "400 17px/27px var(--font-serif)" }}>
            Esta ocupação não tem nível de qualificação e a publicação não traz justificativa.
          </p>
        ) : null}
      </header>
      <div className="x-stack-sm" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-7)", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 13rem", maxWidth: "16rem", minWidth: 0 }}>
          <Toc
            title="Nesta ficha"
            items={[
              { href: "#camadas", label: "As duas fontes" },
              { href: "#atividades", label: "O que faz" },
              { href: "#competencias", label: "O que exige" },
              { href: "#similares", label: "Ocupações parecidas" },
              { href: "#citar", label: "Como citar" },
            ]}
          />
          <div style={{ marginTop: "var(--space-6)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--line)", display: "grid", gap: "var(--space-2)" }}>
            <p className="cs-meta-text" style={{ margin: 0 }}>Pela API</p>
            <code className="x-id" style={{ fontSize: "12px", overflowWrap: "anywhere" }}>GET /api/v1/ocupacoes/{ficha.codigo}</code>
            <a className="x-go" href={`/api/v1/ocupacoes/${ficha.codigo}`}>
              <Icon name="file-json" /> Ver em JSON
            </a>
          </div>
        </div>
        <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
          <section id="camadas" aria-labelledby="h-camadas">
            <h2 id="h-camadas" style={h2}>As duas fontes, lado a lado</h2>
            <div className="cs-grid">
              {ficha.cbo ? (
                <div className="cs-col-6" style={{ padding: "var(--space-5)", background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <span className="cs-meta-text">CBO 2002</span>
                    <span className="cs-badge">vigente desde {ficha.cbo.vigencia.desde}</span>
                  </div>
                  <p style={{ margin: 0, font: "500 21px/28px var(--font-serif)" }}>{ficha.cbo.titulo}</p>
                  <div>
                    <p className="cs-field__label" style={{ margin: "0 0 var(--space-2)" }}>Sinônimos, como o mercado a chama</p>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                      {ficha.cbo.sinonimos.map((sinonimo) => (
                        <li key={sinonimo.titulo} className="cs-badge" style={{ fontWeight: 400, color: "var(--ink)" }}>{sinonimo.titulo}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <CamadaAusente nome="CBO 2002" porque="Esta ocupação não está na CBO. O código existe só no QBQ, e o título abaixo é o do QBQ." />
              )}
              {ficha.qbq ? (
                <div id="perfil-qbq" className="cs-col-6" style={{ padding: "var(--space-5)", background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <span className="cs-meta-text">QBQ</span>
                    <span className="cs-badge">vigente desde {ficha.qbq.vigencia.desde}</span>
                  </div>
                  <p style={{ margin: 0, font: "500 21px/28px var(--font-serif)" }}>{ficha.qbq.titulo}</p>
                  {ficha.qbq.sintese ? <p style={{ margin: 0, font: "400 15px/23px var(--font-serif)", color: "var(--ink-2)" }}>{ficha.qbq.sintese}</p> : null}
                  {ficha.qbq.perfil_ocupacional ? (
                    <Disclosure summary="Perfil ocupacional do QBQ (texto completo)">
                      <p style={{ margin: 0 }}>{ficha.qbq.perfil_ocupacional}</p>
                    </Disclosure>
                  ) : null}
                </div>
              ) : (
                <CamadaAusente nome="QBQ" porque={ficha.justificativa ?? "Esta ocupação não está no QBQ. O bloco da CBO permanece, sem nível de qualificação inventado."} />
              )}
            </div>
          </section>

          <section id="atividades" aria-labelledby="h-atividades">
            <p className="cs-meta-text" style={{ margin: "0 0 var(--space-2)" }}>CBO · perfil ocupacional</p>
            <div className="x-stack-sm" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
              <h2 id="h-atividades" style={{ margin: 0, font: "500 28px/34px var(--font-serif)" }}>
                {ficha.semPerfil ? "O que faz" : `O que faz: ${ficha.contagens.atividades} atividades em ${ficha.contagens.areas} áreas`}
              </h2>
              <SegmentedControl
                legend="Áreas transversais (Y e Z)"
                name="transversais"
                value={ficha.transversais}
                options={[
                  { value: "incluir", label: "Incluir", href: hrefDaFicha(ficha, { transversais: undefined }) },
                  { value: "excluir", label: "Excluir", href: hrefDaFicha(ficha, { transversais: "excluir" }) },
                  { value: "somente", label: "Somente", href: hrefDaFicha(ficha, { transversais: "somente" }) },
                ]}
              />
            </div>
            {ficha.semPerfil ? (
              <p style={{ margin: 0, font: "400 17px/27px var(--font-serif)", color: "var(--ink-2)", maxWidth: "44rem" }}>{ficha.semPerfil}</p>
            ) : (
              <>
                <p style={{ margin: "0 0 var(--space-5)", fontSize: "14px", lineHeight: "20px", color: "var(--ink-2)", maxWidth: "46rem" }}>
                  A sigla ordena as áreas dentro desta ocupação e não é comparável entre ocupações. A numeração das atividades é a da fonte, com lacunas.
                </p>
                <div style={{ display: "grid", gap: "var(--space-2)" }}>
                  {ficha.areas.map((area) => (
                    <div key={area.sigla} style={{ borderTop: "1px solid var(--line)", paddingTop: "var(--space-3)" }}>
                      <Disclosure summary={`${area.sigla} · ${area.nome}`} open={area.aberto}>
                        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(18rem, 1fr))", gap: "var(--space-2) var(--space-5)" }}>
                          {area.itens.map((item, indice) => (
                            <li key={`${item.numero}-${indice}`} style={{ display: "flex", gap: "var(--space-3)", fontSize: "15px", lineHeight: "22px" }}>
                              <span className="x-id" style={{ fontSize: "12px", color: "var(--ink-3)", minWidth: "2ch", textAlign: "right" }}>{item.numero}</span>
                              <span>{item.descricao}</span>
                            </li>
                          ))}
                        </ol>
                      </Disclosure>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section id="competencias" aria-labelledby="h-competencias">
            <p className="cs-meta-text" style={{ margin: "0 0 var(--space-2)" }}>QBQ · competências</p>
            <div className="x-stack-sm" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
              <h2 id="h-competencias" style={{ margin: 0, font: "500 28px/34px var(--font-serif)" }}>O que exige de quem a exerce</h2>
              <SegmentedControl
                legend="Dimensão"
                name="dimensao"
                value={ficha.dimensao}
                options={[
                  { value: "habilidades", label: `Habilidades · ${ficha.contagens.habilidades}`, href: hrefDaFicha(ficha, { dimensao: undefined, todas: undefined }) },
                  { value: "conhecimentos", label: `Conhecimentos · ${ficha.contagens.conhecimentos}`, href: hrefDaFicha(ficha, { dimensao: "conhecimentos", todas: undefined }) },
                  { value: "atitudes", label: `Atitudes · ${ficha.contagens.atitudes}`, href: hrefDaFicha(ficha, { dimensao: "atitudes", todas: undefined }) },
                ]}
              />
            </div>
            {ficha.totalDimensao === 0 ? (
              <p style={{ margin: 0, font: "400 17px/27px var(--font-serif)", color: "var(--ink-2)" }}>
                {ficha.justificativa ?? "Não há itens desta dimensão para esta ocupação."}
              </p>
            ) : (
              <div className="cs-table-scroll">
                <table className="cs-table">
                  <caption>
                    {rotuloDimensao[0].toUpperCase()}
                    {rotuloDimensao.slice(1)} por importância · {ficha.competencias.length} de {ficha.totalDimensao}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Código</th>
                      <th scope="col">Termo</th>
                      {ficha.dimensao === "conhecimentos" ? <th scope="col">Profundidade</th> : null}
                      {ficha.dimensao !== "atitudes" ? <th scope="col">Frequência</th> : null}
                      <th scope="col">Importância</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ficha.competencias.map((item) => {
                      const href = vocab ? `/competencias/${vocab}/${item.nivel_vocabulario}/${encodeURIComponent(item.codigo)}` : undefined;
                      const nota = item.balde ? item.descricao_item : item.conceito?.conceito;
                      return (
                        <tr key={`${item.nivel_vocabulario}-${item.codigo}`}>
                          <td><span className="x-id" style={{ fontSize: "13px" }}>{item.codigo}</span></td>
                          <td style={{ maxWidth: "38rem" }}>
                            {href ? <a className="x-row-link" href={href} style={{ fontWeight: 500 }}>{item.termo}</a> : <span style={{ fontWeight: 500 }}>{item.termo}</span>}
                            {item.balde ? <span className="cs-badge" style={{ marginLeft: "var(--space-2)" }}>balde “outros”</span> : null}
                            {nota ? <span style={{ display: "block", marginTop: 2, fontSize: "13px", lineHeight: "18px", color: "var(--ink-2)" }}>{nota}</span> : null}
                          </td>
                          {ficha.dimensao === "conhecimentos" ? <td><Grau valor={item.graus.profundidade} /></td> : null}
                          {ficha.dimensao !== "atitudes" ? <td><Grau valor={item.graus.frequencia} /></td> : null}
                          <td><Grau valor={item.graus.importancia} forte /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {ficha.totalDimensao > ficha.competencias.length ? (
              <p style={{ marginTop: "var(--space-4)" }}>
                <a className="x-go" href={hrefDaFicha(ficha, { todas: "1" })}>
                  <Icon name="list" /> Ver todas as {ficha.totalDimensao} {rotuloDimensao}
                </a>
              </p>
            ) : null}
          </section>

          <section id="similares" aria-labelledby="h-similares">
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
              <p className="cs-meta-text" style={{ margin: 0 }}>Cálculo derivado</p>
              <Badge status="ilustrativo">Derivado, não oficial</Badge>
            </div>
            <h2 id="h-similares" style={h2}>Ocupações com perfil de habilidades parecido</h2>
            {ficha.similares.length ? (
              <Figure kind="Figura" number="1" title={`Similaridade de habilidades com ${ficha.formatado}`} subtitle={`Índice de Jaccard entre os conjuntos de habilidades distintas, sem baldes. Origem com ${ficha.termosOrigem} habilidades.`} variant="card">
                <BarChart
                  items={ficha.similares.map((item) => ({ label: `${item.formatado} ${item.titulo}`, value: item.valor }))}
                  max={1}
                  format={tresCasas}
                  ariaLabel={`Similaridade de habilidades das ocupações mais próximas de ${ficha.formatado}`}
                />
                <div style={{ marginTop: "var(--space-4)" }}>
                  <Disclosure summary="Ver dados em tabela">
                    <table className="cs-table">
                      <thead>
                        <tr>
                          <th scope="col">Código</th>
                          <th scope="col">Ocupação</th>
                          <th scope="col" className="cs-num">Nível</th>
                          <th scope="col" className="cs-num">Jaccard</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ficha.similares.map((item) => (
                          <tr key={item.codigo}>
                            <td className="x-id"><a className="x-row-link" href={`/ocupacoes/${item.codigo}`}>{item.formatado}</a></td>
                            <td>{item.titulo}</td>
                            <td className="cs-num">{item.nivel}</td>
                            <td className="cs-num">{item.rotulo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Disclosure>
                </div>
              </Figure>
            ) : (
              <p style={{ margin: 0, color: "var(--ink-2)" }}>Não há ocupação com habilidades em comum para calcular a similaridade.</p>
            )}
            <form action={`/ocupacoes/${ficha.codigo}`} method="get" style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)", flexWrap: "wrap", alignItems: "flex-end" }}>
              <TextInput label="Comparar com outra ocupação" name="comparar" icon="git-compare" placeholder="212425" />
              <Button variant="primary" type="submit" icon="git-compare">Comparar</Button>
              {ficha.codigo === "212405" ? <a className="x-go" href={`/ocupacoes/${ficha.codigo}?comparar=212425`}>Comparar {ficha.formatado} com 2124-25</a> : null}
            </form>
            {ficha.comparacao ? (
              <div style={{ marginTop: "var(--space-4)" }}>
                <p className="cs-meta-text" style={{ margin: "0 0 var(--space-2)" }}>Cálculo derivado</p>
                <p style={{ margin: 0 }}>
                  Similaridade de habilidades com {ficha.comparacao.outro}: {ficha.comparacao.similaridade}. Os termos abaixo estão nas duas ocupações e mudam de importância.
                </p>
                <ul>
                  {ficha.comparacao.comuns.map((item) => (
                    <li key={item.termo}>
                      {item.termo}: {item.outra} → {item.nesta}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section id="citar" aria-labelledby="h-citar">
            <h2 id="h-citar" style={h2}>Como citar esta ficha</h2>
            <Callout kind="nota" label="Citação sugerida">
              <p style={{ margin: 0 }}>{ficha.citacao}</p>
            </Callout>
          </section>
        </div>
      </div>
    </main>
  );
}

export function PaginaFicha({ ficha }: { ficha: FichaVista }) {
  if (ficha.tipo === "redirect") return null;
  if (ficha.tipo === "malformado") {
    return (
      <main className="cs-page">
        <header className="cs-rhead" style={{ marginTop: "var(--space-6)" }}>
          <h1 className="cs-rhead__title">Código malformado</h1>
          <p className="cs-rhead__sub">{ficha.detalhe}</p>
          {ficha.dica ? <p>{ficha.dica}</p> : null}
        </header>
      </main>
    );
  }
  if (ficha.tipo === "ausente") {
    return (
      <main className="cs-page">
        <header className="cs-rhead" style={{ marginTop: "var(--space-6)" }}>
          <p className="cs-meta-text">Código não encontrado</p>
          <h1 className="cs-rhead__title">{ficha.entrada} não existe</h1>
          <p className="cs-rhead__sub">{ficha.detalhe}</p>
          {ficha.dica ? <p>{ficha.dica}</p> : null}
        </header>
        {ficha.sugestoes.length ? (
          <ul className="x-tree" style={{ listStyle: "none", padding: 0 }}>
            {ficha.sugestoes.map((item) => (
              <li key={item.codigo}>
                <a href={item.href}>
                  <span className="x-id">{item.codigo}</span>
                  <span>{item.titulo}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    );
  }
  return <FichaPronta ficha={ficha} />;
}
