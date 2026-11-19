import type { ReactNode } from "react";
import { Badge, BarChart, Callout, Figure, Icon, SegmentedControl, Select, StatTile, TextInput } from "@/ui/componentes";
import { formato } from "@/ui/formato";
import { hrefTermo, type NoCompetencia, type VistaIndice, type VistaTermo } from "@/site/competencias";

function Itens({ vocabulario, nos }: { vocabulario: string; nos: NoCompetencia[] }) {
  return nos.map((no) => (
    <li key={`${no.nivel}-${no.codigo}`}>
      <a href={hrefTermo(vocabulario, no.nivel, no.codigo)} aria-current={no.atual ? "page" : undefined} style={{ fontWeight: no.aberto || no.atual ? 600 : undefined }}>
        <span className="x-id">{no.codigo}</span>
        <span>{no.descricao}</span>
        {no.balde ? <span className="n">balde</span> : no.totalFilhos > 0 ? <span className="n">{formato(no.totalFilhos)}</span> : null}
      </a>
      {no.filhos ? (
        <ul style={{ listStyle: "none", padding: "0 0 0 var(--space-4)", margin: "0 0 0 var(--space-3)", borderLeft: "1px solid var(--line)" }}>
          <Itens vocabulario={vocabulario} nos={no.filhos} />
        </ul>
      ) : null}
    </li>
  ));
}

function Arvore({ vocabulario, nos }: { vocabulario: string; nos: NoCompetencia[] }) {
  return (
    <ul className="x-tree" style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "1px" }}>
      <Itens vocabulario={vocabulario} nos={nos} />
    </ul>
  );
}

function Moldura({ vocabulario, resumo, arvore, vocabularios, children }: { vocabulario: string; resumo: string; arvore: NoCompetencia[]; vocabularios: { id: string; resumo: string }[]; children: ReactNode }) {
  return (
    <main className="cs-page">
      <header style={{ marginTop: "var(--space-6)", borderTop: "2px solid var(--ink)", paddingTop: "var(--space-5)", paddingBottom: "var(--space-5)" }}>
        <p className="cs-meta-text" style={{ margin: "0 0 var(--space-3)" }}>QBQ · vocabulários controlados e conceitos</p>
        <h1 style={{ margin: 0, font: "500 40px/46px var(--font-serif)", letterSpacing: "-.01em" }}>Competências</h1>
        <p style={{ margin: "var(--space-3) 0 0", font: "400 19px/30px var(--font-serif)", color: "var(--ink-2)", maxWidth: "48rem" }}>
          Os termos com que o QBQ nomeia conhecimentos, habilidades e atitudes, com a definição oficial quando ela existe e as ocupações que exigem cada um.
        </p>
      </header>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "flex-end", justifyContent: "space-between", paddingBlock: "var(--space-3)", borderBlock: "1px solid var(--line)" }}>
        <SegmentedControl
          legend="Vocabulário"
          name="vocab"
          value={vocabulario}
          options={vocabularios.map((item) => ({ value: item.id, label: item.id, href: `/competencias/${item.id}` }))}
        />
        <form role="search" action="/competencias" method="get" style={{ flex: "0 1 28rem", minWidth: 0, display: "flex" }}>
          <input type="hidden" name="vocab" value={vocabulario} />
          <TextInput block label="Buscar termo, conceito ou descrição de item" type="search" name="q" icon="search" placeholder="raciocínio, banco de dados, direito ambiental" />
        </form>
      </div>
      <div className="x-stack-sm" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-7)", marginTop: "var(--space-6)", alignItems: "flex-start" }}>
        <nav aria-label={`Árvore do vocabulário de ${vocabulario}`} style={{ flex: "1 1 20rem", maxWidth: "26rem", minWidth: 0 }}>
          <p className="cs-meta-text" style={{ margin: "0 0 var(--space-3)" }}>{vocabulario} · {resumo}</p>
          <Arvore vocabulario={vocabulario} nos={arvore} />
          <p style={{ margin: "var(--space-4) 0 0", fontSize: "13px", lineHeight: "18px", color: "var(--ink-3)" }}>
            Grafia da fonte preservada, inclusive erros de digitação. Códigos são identificadores opacos: a hierarquia vem do campo pai, não do prefixo.
          </p>
        </nav>
        <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-7)" }}>{children}</div>
      </div>
    </main>
  );
}

function serie(mapa: Record<string, number>) {
  return Object.entries(mapa)
    .filter(([chave]) => chave !== "sem_nivel")
    .sort((a, b) => a[0].localeCompare(b[0], "pt", { numeric: true }))
    .map(([label, value]) => ({ label, value }));
}

function Taxonomias() {
  return (
    <Callout kind="limite" label="Duas taxonomias de conhecimento">
      <p style={{ margin: 0 }}>
        Ocupações de nível 1 a 5 usam conhecimentos-i; as de nível 6 a 8 usam conhecimentos-ii. Oito códigos existem nas duas e nomeiam termos diferentes, por isso os resultados de uma taxonomia não valem para a outra. Habilidades e atitudes têm vocabulário único.
      </p>
    </Callout>
  );
}

export function PaginaIndice({ vista }: { vista: VistaIndice }) {
  return (
    <Moldura vocabulario={vista.vocabulario} resumo={vista.resumo} arvore={vista.arvore} vocabularios={vista.vocabularios}>
      {vista.busca ? (
        <section aria-labelledby="h-busca">
          <h2 id="h-busca" style={{ margin: 0, font: "500 28px/34px var(--font-serif)" }}>
            {vista.busca.totalTermos} termos casam
          </h2>
          <ul style={{ listStyle: "none", margin: "var(--space-4) 0 0", padding: 0, display: "grid", gap: "var(--space-3)" }}>
            {vista.busca.termos.map((termo) => (
              <li key={`${termo.nivel}-${termo.codigo}`}>
                <a className="x-row-link" href={hrefTermo(termo.vocabulario, termo.nivel, termo.codigo)}>
                  <span className="x-id">{termo.codigo}</span> {termo.descricao}
                </a>
              </li>
            ))}
          </ul>
          {vista.busca.descricoes.length ? (
            <div style={{ marginTop: "var(--space-5)" }}>
              <p className="cs-meta-text">Descrições de item</p>
              <ul>
                {vista.busca.descricoes.map((item) => (
                  <li key={`${item.ocupacao}-${item.descricao}`}>
                    <a className="x-a" href={`/ocupacoes/${item.ocupacao}`}>{item.titulo}</a>: {item.descricao}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : (
        <p style={{ margin: 0, font: "400 19px/30px var(--font-serif)", color: "var(--ink-2)", maxWidth: "40rem" }}>
          Escolha um termo na árvore. A hierarquia abre pelo campo pai de cada termo.
        </p>
      )}
      <Taxonomias />
    </Moldura>
  );
}

export function PaginaTermo({ ficha }: { ficha: VistaTermo }) {
  if (ficha.tipo === "ausente") {
    return (
      <main className="cs-page">
        <header className="cs-rhead" style={{ marginTop: "var(--space-6)" }}>
          <p className="cs-meta-text">Termo não encontrado · 404</p>
          <h1 className="cs-rhead__title">Termo não encontrado</h1>
          <p className="cs-rhead__sub">{ficha.detalhe}</p>
        </header>
        {ficha.sugestoes.length ? (
          <ul className="x-tree" style={{ listStyle: "none", padding: 0 }}>
            {ficha.sugestoes.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.rotulo}</a>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    );
  }
  const base = hrefTermo(ficha.vocabulario, ficha.nivel, ficha.codigo);
  const porNivel = serie(ficha.distribuicao.por_nivel_qualificacao);
  const porGrupo = serie(ficha.distribuicao.por_grande_grupo);
  const params = (extra: Record<string, string | undefined>) => {
    const busca = new URLSearchParams();
    const valores = { importancia_min: ficha.importanciaMin ? String(ficha.importanciaMin) : undefined, prefixo: ficha.prefixo, ...extra };
    for (const [chave, valor] of Object.entries(valores)) if (valor) busca.set(chave, valor);
    const texto = busca.toString();
    return texto ? `${base}?${texto}` : base;
  };
  return (
    <Moldura vocabulario={ficha.vocabulario} resumo={ficha.resumo} arvore={ficha.arvore} vocabularios={ficha.vocabularios}>
      <article aria-labelledby="h-termo">
        <p className="cs-meta-text" style={{ margin: "0 0 var(--space-2)" }}>{ficha.vocabulario} · nível {ficha.nivel} · {ficha.codigo}</p>
        <h2 id="h-termo" style={{ margin: 0, font: "500 40px/46px var(--font-serif)", letterSpacing: "-.01em" }}>
          {ficha.descricao}
          {ficha.balde ? <Badge>balde “outros”</Badge> : null}
        </h2>
        <p style={{ margin: "var(--space-2) 0 0", fontSize: "14px", lineHeight: "20px", color: "var(--ink-3)" }}>
          {ficha.caminho.map((passo) => `${passo.codigo} ${passo.descricao}`).join(" → ")}
        </p>
        {ficha.conceito ? (
          <div style={{ marginTop: "var(--space-5)", padding: "var(--space-5)", background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", maxWidth: "48rem" }}>
            <p className="cs-meta-text" style={{ margin: "0 0 var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}><Icon name="book-open" />Conceito oficial</p>
            <p style={{ margin: 0, font: "400 21px/32px var(--font-serif)" }}>{ficha.conceito}</p>
          </div>
        ) : ficha.motivo ? (
          <p style={{ margin: "var(--space-4) 0 0", color: "var(--ink-2)" }}>{ficha.motivo}</p>
        ) : null}
        {ficha.conceitoPai && ficha.pai ? (
          <div style={{ marginTop: "var(--space-3)", maxWidth: "48rem" }}>
            <details className="cs-disclosure">
              <summary>Conceito da categoria {ficha.pai.codigo} {ficha.pai.descricao}</summary>
              <div className="cs-disclosure__body"><p style={{ margin: 0 }}>{ficha.conceitoPai}</p></div>
            </details>
          </div>
        ) : null}
      </article>
      {ficha.uso.ocupacoes > 0 ? (
        <section aria-labelledby="h-uso">
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
            <p className="cs-meta-text" style={{ margin: 0 }}>Uso nas ocupações</p>
            <Badge status="ilustrativo">Derivado, não oficial</Badge>
          </div>
          <h2 id="h-uso" style={{ margin: "0 0 var(--space-5)", font: "500 28px/34px var(--font-serif)" }}>Exigido em {formato(ficha.uso.ocupacoes)} ocupações</h2>
          <div className="cs-grid">
            <div className="cs-col-4"><StatTile label="Ocupações que exigem" value={formato(ficha.uso.ocupacoes)} delta={ficha.percentualExigem != null ? `${ficha.percentualExigem}% das ${formato(ficha.classificadas)} classificadas` : undefined} /></div>
            <div className="cs-col-4"><StatTile label="Importância média" value={formato(ficha.uso.importancia_media)} delta="escala ordinal de 1 a 5" /></div>
            <div className="cs-col-4"><StatTile label="Com importância 5" value={formato(ficha.comCinco)} delta={ficha.percentualCinco != null ? `${ficha.percentualCinco}% das que exigem o termo` : undefined} /></div>
          </div>
          <div className="cs-grid" style={{ marginTop: "var(--space-5)" }}>
            <div className="cs-col-6">
              <Figure kind="Figura" number="1" title="Ocupações por nível de qualificação" subtitle={`Ocupações que exigem o termo, por nível do QBQ`} variant="card" table={<TabelaSimples cabecalhos={["Nível", "Ocupações"]} linhas={porNivel} />}>
                <BarChart items={porNivel} ariaLabel={`Ocupações que exigem ${ficha.descricao} por nível de qualificação`} />
              </Figure>
            </div>
            <div className="cs-col-6">
              <Figure kind="Figura" number="2" title="Ocupações por grande grupo da CBO" subtitle="Ocupações que exigem o termo, por grande grupo" variant="card" table={<TabelaSimples cabecalhos={["Grande grupo", "Ocupações"]} linhas={porGrupo} />}>
                <BarChart items={porGrupo} slot={2} ariaLabel={`Ocupações que exigem ${ficha.descricao} por grande grupo`} />
              </Figure>
            </div>
          </div>
        </section>
      ) : null}
      <section aria-labelledby="h-lista">
        <form action={base} method="get" className="x-stack-sm" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "var(--space-4)", flexWrap: "wrap", borderBottom: "1px solid var(--ink)", paddingBottom: "var(--space-3)" }}>
          <h2 id="h-lista" style={{ margin: 0, font: "500 28px/34px var(--font-serif)" }}>Ocupações que exigem o termo</h2>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <Select label="Importância mínima" name="importancia_min" defaultValue={ficha.importanciaMin ? String(ficha.importanciaMin) : ""} options={[{ value: "", label: "Qualquer" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))]} />
            <Select label="Grande grupo" name="prefixo" defaultValue={ficha.prefixo ?? ""} options={[{ value: "", label: "Todos" }, ...ficha.grupos]} />
            <button className="cs-btn" type="submit">Filtrar</button>
          </div>
        </form>
        <div className="cs-table-scroll">
          <table className="cs-table" style={{ borderTop: 0 }}>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Ocupação (título QBQ)</th>
                <th scope="col" className="cs-num">Nível</th>
                <th scope="col" className="cs-num">Frequência</th>
                <th scope="col" className="cs-num">Importância</th>
              </tr>
            </thead>
            <tbody>
              {ficha.ocupacoes.map((ocupacao) => (
                <tr key={ocupacao.codigo}>
                  <td><span className="x-id" style={{ color: "var(--ink)" }}>{ocupacao.codigo_formatado}</span></td>
                  <td><a className="x-row-link" href={`/ocupacoes/${ocupacao.codigo}`}>{ocupacao.titulo_qbq ?? ocupacao.titulo_cbo ?? "Sem título"}</a></td>
                  <td className="cs-num">{ocupacao.nivel_qualificacao ?? "s/d"}</td>
                  <td className="cs-num">{ocupacao.frequencia ?? "s/d"}</td>
                  <td className="cs-num" style={{ fontWeight: 600 }}>{ocupacao.importancia ?? "s/d"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cs-table__foot">
          Mostrando {formato(ficha.ocupacoes.length)} de {formato(ficha.totalLista)}. Pela API: <span className="x-inline">GET /api/v1/qbq/vocabularios/{ficha.vocabulario}/{ficha.nivel}/{ficha.codigo}/ocupacoes</span>
        </p>
        {!ficha.todas && ficha.totalLista > ficha.ocupacoes.length ? (
          <p style={{ marginTop: "var(--space-4)" }}><a className="x-go" href={params({ todas: "1" })}><Icon name="list" /> Ver as {formato(ficha.totalLista)} ocupações</a></p>
        ) : null}
      </section>
      <Taxonomias />
    </Moldura>
  );
}

function TabelaSimples({ cabecalhos, linhas }: { cabecalhos: [string, string]; linhas: { label: string; value: number }[] }) {
  return (
    <table className="cs-table">
      <thead>
        <tr>
          <th scope="col">{cabecalhos[0]}</th>
          <th scope="col" className="cs-num">{cabecalhos[1]}</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha) => (
          <tr key={linha.label}>
            <td>{linha.label}</td>
            <td className="cs-num">{formato(linha.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
