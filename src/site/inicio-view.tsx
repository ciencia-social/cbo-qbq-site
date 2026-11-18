import { Badge, Button, Callout, CodeBlock, Icon, SegmentedControl, StatTile, TextInput } from "@/ui/componentes";
import { BotaoCopiar } from "@/ui/cliente";
import { formato } from "@/ui/formato";
import { Ilustracao } from "@/site/ilustracao-view";
import type { VistaInicio } from "@/site/inicio";

const h2 = { margin: "0 0 var(--space-6)", font: "500 40px/46px var(--font-serif)", letterSpacing: "-.01em" } as const;
const INSTRUCAO =
  "Use apenas os dados de cbo.ciencia.social para citar códigos CBO, títulos, níveis e competências do QBQ. Não cite nada que não tenha obtido de uma consulta nesta conversa, diga de qual fonte vem cada afirmação e relate divergências entre CBO e QBQ em vez de escolher uma.";

const EXEMPLOS: Record<string, { lang: string; title: string; code: string }> = {
  curl: { lang: "bash", title: "Terminal", code: "curl https://cbo.ciencia.social/api/v1/ocupacoes/212405" },
  python: {
    lang: "python",
    title: "Python",
    code: `import requests\n\nr = requests.get("https://cbo.ciencia.social/api/v1/ocupacoes/212405")\nprint(r.json()["dados"]["codigo_formatado"], r.json()["dados"]["cbo"]["titulo"])\nprint("Nível QBQ:", r.json()["dados"]["qbq"]["niveis"]["qualificacao"])`,
  },
  js: {
    lang: "js",
    title: "JavaScript",
    code: `const r = await fetch("https://cbo.ciencia.social/api/v1/ocupacoes/212405");\nconst { dados, meta } = await r.json();\nconsole.log(dados.codigo_formatado, dados.cbo.titulo);\nconsole.log(meta.versao_dados);`,
  },
};

const PUBLICOS = [
  { icon: "search", quem: "Qualquer pessoa", pergunta: "Qual é o código CBO de programador?", texto: "Do nome usado no mercado ao código oficial, com o que a ocupação faz e o que ela exige.", link: "Buscar ocupações", href: "/ocupacoes" },
  { icon: "hash", quem: "Pesquisa com RAIS, CAGED, PNAD", pergunta: "Esta lista de códigos é válida? A que família pertence cada um?", texto: "Decodifique até 200 códigos de uma vez, em qualquer nível da classificação.", link: "Ver /api/v1/codigos", href: "/docs/codigos" },
  { icon: "git-compare", quem: "RH e orientação de carreira", pergunta: "O que me falta para migrar de uma ocupação para outra?", texto: "Compare habilidades e graus entre ocupações e encontre perfis parecidos.", link: "Ver um exemplo", href: "/ocupacoes/212405?comparar=212420" },
  { icon: "graduation-cap", quem: "Educação profissional", pergunta: "O que significa a habilidade aprendizado ativo no QBQ?", texto: "Os vocabulários controlados e as definições oficiais, com as ocupações que exigem cada termo.", link: "Explorar competências", href: "/competencias" },
];

const FERRAMENTAS = [
  { nome: "ocupacao_buscar", desc: "Do nome de mercado ao código oficial" },
  { nome: "ocupacao_obter", desc: "Ficha integrada nas duas camadas" },
  { nome: "codigo_decodificar", desc: "Valida códigos antes de citá-los" },
  { nome: "cbo_atividades", desc: "O que a ocupação faz, segundo a CBO" },
  { nome: "qbq_competencias", desc: "O que a ocupação exige, segundo o QBQ" },
  { nome: "ocupacao_comparar", desc: "Lacunas entre duas a cinco ocupações" },
];

export function PaginaInicio({ vista, exemplo = "curl" }: { vista: VistaInicio; exemplo?: string }) {
  const lang = EXEMPLOS[exemplo] ? exemplo : "curl";
  const snippet = EXEMPLOS[lang];
  const repetidos = vista.grupos.filter((grupo, indice, todos) => todos.some((outro, outroIndice) => outroIndice !== indice && outro.titulo === grupo.titulo));
  return (
    <main className="cs-page">
      <section className="cs-rhead" style={{ paddingBottom: "var(--space-7)" }}>
        <div className="cs-rhead__eyebrow" style={{ marginBottom: "var(--space-6)" }}>
          <span className="cs-meta-text">Dados abertos · {vista.versao}</span>
          <Badge status="preliminar">Preliminar</Badge>
        </div>
        <div className="x-stack-sm" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-7)", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 32rem", minWidth: 0 }}>
            <h1 className="cs-rhead__title" style={{ fontSize: "52px", lineHeight: "58px" }}>
              A CBO e o QBQ em dados abertos, rastreáveis e consultáveis
            </h1>
            <p className="cs-rhead__sub">
              A Classificação Brasileira de Ocupações e o Quadro Brasileiro de Qualificações reunidos pela mesma chave, o código da ocupação. Para navegar, consultar por API e conectar a assistentes de IA.
            </p>
            <form role="search" action="/ocupacoes" method="get" style={{ marginTop: "var(--space-6)", display: "flex", gap: "var(--space-3)", alignItems: "flex-end", flexWrap: "nowrap" }}>
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <TextInput block label="Busque uma ocupação pelo nome de mercado, pelo título oficial ou pelo código" type="search" name="q" icon="search" placeholder="programador, enfermeira, 2124-05" />
              </div>
              <Button variant="primary" type="submit" icon="search">
                Buscar
              </Button>
            </form>
            <p style={{ margin: "var(--space-3) 0 0", fontSize: "14px", lineHeight: "20px", color: "var(--ink-3)" }}>
              Exemplos: <a className="x-a" href="/ocupacoes?q=programador">programador</a> · <a className="x-a" href="/ocupacoes/212405">2124-05</a> · <a className="x-a" href="/ocupacoes?q=capoteiro">capoteiro</a> · <a className="x-a" href="/competencias/habilidades/habilidades/01.03.05">raciocínio crítico</a>
            </p>
            <div style={{ marginTop: "var(--space-6)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Button href="/docs/mcp" icon="plug">Conectar ao seu assistente</Button>
              <Button href="/docs" icon="braces">Usar a API</Button>
            </div>
          </div>
          <Ilustracao dialogos={vista.dialogos} />
        </div>
      </section>

      <section aria-labelledby="h-numeros" style={{ paddingBlock: "var(--space-6) var(--space-7)", borderTop: "1px solid var(--line)" }}>
        <h2 id="h-numeros" className="cs-meta-text" style={{ margin: "0 0 var(--space-4)" }}>O que há no conjunto</h2>
        <div className="cs-grid">
          <div className="cs-col-3"><StatTile label="Ocupações" value={vista.numeros.ocupacoes} delta={vista.numeros.detalheOcupacoes} /></div>
          <div className="cs-col-3"><StatTile label="Atividades do perfil ocupacional" value={vista.numeros.atividades} delta={`em ${vista.numeros.areas} grandes áreas de competência`} /></div>
          <div className="cs-col-3"><StatTile label="Itens de competência" value={vista.numeros.competencias} delta="conhecimentos, habilidades e atitudes com grau" /></div>
          <div className="cs-col-3"><StatTile label="Sinônimos" value={vista.numeros.sinonimos} delta="do nome de mercado ao código oficial" /></div>
        </div>
      </section>

      <section aria-labelledby="h-publicos" style={{ paddingBlock: "var(--space-7)", borderTop: "2px solid var(--ink)" }}>
        <p className="cs-meta-text" style={{ margin: "0 0 var(--space-3)" }}>Para quem é</p>
        <h2 id="h-publicos" style={h2}>Perguntas que o site, a API e o MCP respondem</h2>
        <div className="cs-grid">
          {PUBLICOS.map((item) => (
            <article key={item.quem} className="cs-col-3" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", padding: "var(--space-5)", background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span className="x-ico"><Icon name={item.icon} size={20} /></span>
                <span className="cs-meta-text">{item.quem}</span>
              </div>
              <h3 style={{ margin: 0, font: "500 21px/28px var(--font-serif)" }}>{item.pergunta}</h3>
              <p style={{ margin: 0, fontSize: "15px", lineHeight: "22px", color: "var(--ink-2)" }}>{item.texto}</p>
              <a className="x-go" href={item.href} style={{ marginTop: "auto" }}>{item.link} <Icon name="arrow-right" /></a>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="h-navegar" style={{ paddingBlock: "var(--space-7)", borderTop: "2px solid var(--ink)" }}>
        <div className="x-stack-sm" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-7)" }}>
          <div style={{ flex: "3 1 36rem", minWidth: 0 }}>
            <p className="cs-meta-text" style={{ margin: "0 0 var(--space-3)" }}>Navegar a CBO</p>
            <h2 id="h-navegar" style={{ margin: "0 0 var(--space-5)", font: "500 28px/34px var(--font-serif)" }}>
              {vista.numeros.grandesGrupos === 10 ? "Dez" : vista.numeros.grandesGrupos} grandes grupos, {vista.numeros.ocupacoes} ocupações
            </h2>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--ink)" }}>
              {vista.grupos.map((grupo) => (
                <li key={grupo.codigo} style={{ borderBottom: "1px solid var(--line)" }}>
                  <a href={`/ocupacoes?prefixo=${grupo.codigo}`} className="x-row-link" style={{ display: "grid", gridTemplateColumns: "2.5rem minmax(0, 1fr) 6rem 1rem", gap: "var(--space-3)", alignItems: "baseline", padding: "var(--space-3) 0" }}>
                    <span className="x-id" style={{ fontSize: "16px", color: "var(--ink)" }}>{grupo.codigo}</span>
                    <span style={{ fontSize: "14px", lineHeight: "20px", letterSpacing: ".01em" }}>{grupo.titulo}</span>
                    <span className="x-id" style={{ textAlign: "right", fontSize: "13px", color: "var(--ink-3)" }}>{grupo.total} ocup.</span>
                    <span style={{ color: "var(--ink-3)" }}><Icon name="chevron-right" /></span>
                  </a>
                </li>
              ))}
            </ol>
            {repetidos.length > 1 ? (
              <p style={{ margin: "var(--space-3) 0 0", fontSize: "13px", lineHeight: "18px", color: "var(--ink-3)" }}>
                Os grandes grupos {repetidos.map((grupo) => grupo.codigo).join(" e ")} têm o mesmo título; o código é o que os distingue.
              </p>
            ) : null}
          </div>
          <div style={{ flex: "2 1 24rem", minWidth: 0 }}>
            <p className="cs-meta-text" style={{ margin: "0 0 var(--space-3)" }}>Explorar o QBQ</p>
            <h2 style={{ margin: "0 0 var(--space-5)", font: "500 28px/34px var(--font-serif)" }}>Quatro vocabulários controlados</h2>
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              {vista.vocabularios.map((vocab) => (
                <a key={vocab.slug} href={`/competencias/${vocab.slug}`} className="cs-artifact" style={{ padding: "var(--space-4) var(--space-5)", flexDirection: "row", gap: "var(--space-4)", alignItems: "flex-start" }}>
                  <span className="x-ico"><Icon name={vocab.icon} size={20} /></span>
                  <span style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", minWidth: 0, flex: 1 }}>
                    <span className="cs-artifact__type">
                      <span className="cs-meta-text">{vocab.slug}</span>
                      <span style={{ font: "400 13px/18px var(--font-sans)", color: "var(--ink-3)" }}>{vocab.escopo}</span>
                    </span>
                    <span className="cs-artifact__title" style={{ fontSize: "19px", lineHeight: "26px", margin: 0 }}>{vocab.nome}</span>
                    <span className="cs-artifact__desc" style={{ fontSize: "14px", lineHeight: "20px" }}>{vocab.niveis}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="h-dev" style={{ paddingBlock: "var(--space-7)", borderTop: "2px solid var(--ink)" }}>
        <p className="cs-meta-text" style={{ margin: "0 0 var(--space-3)" }}>Para quem desenvolve</p>
        <h2 id="h-dev" style={{ ...h2, maxWidth: "44rem" }}>Uma API REST e um servidor MCP, sem cadastro e sem chave</h2>
        <p style={{ margin: "0 0 var(--space-6)", font: "400 19px/30px var(--font-serif)", color: "var(--ink-2)", maxWidth: "44rem" }}>
          Os dois usam o mesmo núcleo de consulta e devolvem os mesmos campos. Toda resposta informa a versão dos dados.
        </p>
        <div className="x-stack-sm" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)" }}>
          <div style={{ flex: "1 1 32rem", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, font: "600 16px/22px var(--font-sans)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <Icon name="braces" size={20} /> API REST em <span className="x-inline">cbo.ciencia.social/api/v1</span>
              </h3>
              <SegmentedControl
                legend="Linguagem do exemplo"
                name="exemplo"
                value={lang}
                options={[
                  { value: "curl", label: "curl", href: "/" },
                  { value: "python", label: "Python", href: "/?exemplo=python" },
                  { value: "js", label: "JavaScript", href: "/?exemplo=js" },
                ]}
              />
            </div>
            <CodeBlock lang={snippet.lang} title={snippet.title} meta="GET /api/v1/ocupacoes/212405" code={snippet.code} />
            <CodeBlock lang="json" title="Resposta, trecho" meta="200 · application/json" code={vista.exemplo} maxHeight="22rem" />
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Button variant="primary" href="/docs" icon="book-open">Ler a documentação da API</Button>
              <Button href="/api/v1/openapi.json" icon="file-json">Especificação OpenAPI 3.1</Button>
            </div>
          </div>
          <div style={{ flex: "1 1 28rem", minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <h3 style={{ margin: 0, font: "600 16px/22px var(--font-sans)", display: "flex", alignItems: "center", gap: "var(--space-2)", minHeight: "44px" }}>
              <Icon name="plug" size={20} /> Servidor MCP em <span className="x-inline">cbo.ciencia.social/mcp</span>
            </h3>
            <p style={{ margin: 0, fontSize: "15px", lineHeight: "22px", color: "var(--ink-2)" }}>
              Conecte Claude, Cursor, VS Code ou outro cliente compatível. O assistente passa a consultar os dados em vez de responder de memória.
            </p>
            <CodeBlock lang="bash" title="Claude Code" meta="terminal" code={"claude mcp add --transport http cbo-qbq \\\n  https://cbo.ciencia.social/mcp"} />
            <div style={{ padding: "var(--space-4) var(--space-5)", background: "var(--surface-raised)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
              <p className="cs-meta-text" style={{ margin: "0 0 var(--space-3)" }}>15 tools, entre elas</p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-2)" }}>
                {FERRAMENTAS.map((tool) => (
                  <li key={tool.nome} style={{ display: "grid", gridTemplateColumns: "minmax(0, 13rem) minmax(0, 1fr)", gap: "var(--space-3)", fontSize: "14px", lineHeight: "20px" }}>
                    <code className="x-id" style={{ fontSize: "13px", color: "var(--code-key)" }}>{tool.nome}</code>
                    <span style={{ color: "var(--ink-2)" }}>{tool.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Callout kind="nota" label="Instrução para colar no assistente">
              <p>{INSTRUCAO}</p>
              <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", alignItems: "center" }}>
                <BotaoCopiar code={INSTRUCAO} />
                <a className="x-go" href="/docs/mcp">Ver o guia completo do MCP <Icon name="arrow-right" /></a>
              </div>
            </Callout>
          </div>
        </div>
      </section>

      <section aria-labelledby="h-modelo" style={{ paddingBlock: "var(--space-7)", borderTop: "2px solid var(--ink)" }}>
        <p className="cs-meta-text" style={{ margin: "0 0 var(--space-3)" }}>Como os dados se encaixam</p>
        <h2 id="h-modelo" style={{ margin: "0 0 var(--space-6)", font: "500 28px/34px var(--font-serif)" }}>
          A ocupação no centro, a CBO descreve o trabalho e o QBQ gradua o que ele exige
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))", gap: "var(--space-4)", alignItems: "stretch" }}>
          <div style={{ padding: "var(--space-5)", background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span className="cs-meta-text" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}><Icon name="list-tree" />CBO · onde se situa</span>
            <p style={{ margin: 0, font: "400 16px/25px var(--font-serif)" }}>
              Grande grupo → subgrupo principal → subgrupo → família. A hierarquia é o próprio código: <span className="x-inline">2</span> <span className="x-inline">21</span> <span className="x-inline">212</span> <span className="x-inline">2124</span>.
            </p>
          </div>
          <div style={{ padding: "var(--space-5)", background: "var(--accent-wash)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span className="cs-meta-text" style={{ color: "var(--accent)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}><Icon name="briefcase" />Ocupação</span>
            <p style={{ margin: 0, font: "500 21px/28px var(--font-serif)" }}>2124-05 · Analista de desenvolvimento de sistemas</p>
            <p style={{ margin: 0, fontSize: "14px", lineHeight: "20px", color: "var(--ink-2)" }}>O código de seis dígitos é a chave que liga as duas fontes.</p>
          </div>
          <div style={{ padding: "var(--space-5)", background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span className="cs-meta-text" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}><Icon name="list" />CBO · o que é e faz</span>
            <p style={{ margin: 0, font: "400 16px/25px var(--font-serif)" }}>Sinônimos, como o mercado a chama, e o perfil ocupacional: grandes áreas de competência e as atividades de cada uma.</p>
          </div>
          <div style={{ padding: "var(--space-5)", background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span className="cs-meta-text" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}><Icon name="graduation-cap" />QBQ · o que exige</span>
            <p style={{ margin: 0, font: "400 16px/25px var(--font-serif)" }}>Nível de 1 a 8 e competências (conhecimentos, habilidades, atitudes) com grau de 1 a 5, nomeadas por vocabulário controlado.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="h-principios" style={{ paddingBlock: "var(--space-7)", borderTop: "2px solid var(--ink)" }}>
        <p className="cs-meta-text" style={{ margin: "0 0 var(--space-3)" }}>Princípios</p>
        <h2 id="h-principios" style={{ margin: "0 0 var(--space-6)", font: "500 28px/34px var(--font-serif)" }}>O que este site não faz com os dados</h2>
        <div className="cs-grid">
          {[
            ["shield-check", "Não inventa nem reconcilia", "Quando CBO e QBQ divergem sob o mesmo código, os dois valores aparecem lado a lado, identificados por fonte."],
            ["eye", "Não esconde ausências", "Ocupação sem nível ou sem perfil aparece com a situação explícita e, quando existe, a justificativa oficial."],
            ["link", "Não perde a origem", "Cada registro guarda o arquivo e a linha da publicação oficial de onde veio."],
            ["layers", "Não mistura oficial e derivado", "Similaridade, rankings e médias são cálculos deste projeto e vêm sempre marcados como derivados."],
          ].map(([icon, titulo, texto]) => (
            <div key={titulo} className="cs-col-3" style={{ borderTop: "1px solid var(--line)", paddingTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <span style={{ color: "var(--ink-2)" }}><Icon name={icon} size={20} /></span>
              <h3 style={{ margin: 0, font: "600 16px/22px var(--font-sans)" }}>{titulo}</h3>
              <p style={{ margin: 0, fontSize: "15px", lineHeight: "22px", color: "var(--ink-2)" }}>{texto}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "var(--space-6)", maxWidth: "48rem" }}>
          <Callout kind="limite" label="Limite dos dados">
            <p>
              As duas camadas divergem em {formato(vista.cobertura.total)} ocupações: {formato(vista.cobertura.soCbo)} existem só na CBO, {formato(vista.cobertura.soQbq)} só no QBQ e {formato(vista.cobertura.titulo)} têm título diferente sob o mesmo código. Outras {formato(vista.cobertura.semNivel)} não têm nível de qualificação no QBQ.
            </p>
            <p style={{ margin: 0 }}><a className="x-go" href="/sobre">Ver a cobertura entre as camadas <Icon name="arrow-right" /></a></p>
          </Callout>
        </div>
      </section>
    </main>
  );
}
