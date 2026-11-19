import { Callout, CodeBlock, DataTable, Disclosure, Icon, ReportHeader, Toc } from "@/ui/componentes";
import { formato } from "@/ui/formato";
import type { VistaSobre } from "@/site/sobre";

export function PaginaSobre({ vista }: { vista: VistaSobre }) {
  return (
    <main className="cs-page">
      <ReportHeader
        eyebrow="Sobre os dados"
        status="preliminar"
        title="De onde vêm os dados, de que data e como citar"
        subtitle="A CBO e o QBQ são publicados pelo Ministério do Trabalho e Emprego em planilhas, arquivos CSV e PDF. Este projeto os arquiva, estrutura e publica com a proveniência de cada registro."
        meta={[
          { label: "Versão do conjunto", value: `${vista.versao} · ${vista.schema}` },
          { label: "Licença", value: `Dados ${vista.licenca} · código MIT` },
          { label: "Repositório", value: vista.repositorio.replace("https://", "") },
        ]}
      />
      <div className="x-stack-sm" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8)", alignItems: "flex-start" }}>
        <div className="cs-prose" style={{ flex: "999 1 32rem", minWidth: 0, maxWidth: "none" }}>
          <h2 id="versoes">Versões por camada</h2>
          <p>Cada camada registra a publicação em que foi gerada. Por isso a versão do conjunto e a de cada camada podem diferir.</p>
          <DataTable
            kind="Tabela"
            number="1"
            title="Versão de cada camada"
            columns={[
              { key: "nome", label: "Camada" },
              { key: "versao", label: "Versão" },
            ]}
            rows={vista.camadas}
          />
          <DataTable
            title="Arquivos oficiais arquivados"
            columns={[
              { key: "arquivo", label: "Arquivo" },
              { key: "capturado_em", label: "Capturado em" },
            ]}
            rows={vista.arquivos.map((arquivo) => ({ arquivo: arquivo.arquivo, capturado_em: arquivo.capturado_em ?? "s/d" }))}
          />

          <h2 id="cobertura">Cobertura entre as camadas</h2>
          <p>
            As duas fontes usam a mesma chave, mas vêm de capturas diferentes. Nenhuma das camadas é ajustada para caber na outra: {formato(vista.divergencia.so_cbo)} códigos existem só na CBO, {formato(vista.divergencia.so_qbq)} só no QBQ e {formato(vista.divergencia.titulo_divergente)} têm título diferente.
          </p>
          <DataTable
            kind="Tabela"
            number="2"
            title="Situação das ocupações no QBQ"
            columns={[
              { key: "rotulo", label: "Situação no QBQ" },
              { key: "total", label: "Ocupações", numeric: true },
            ]}
            rows={vista.situacoes}
          />
          {vista.exemplo.cbo && vista.exemplo.qbq ? (
            <p>
              Um exemplo é a {vista.exemplo.codigo_formatado}, “{vista.exemplo.cbo.titulo}” na CBO e “{vista.exemplo.qbq.titulo}” no QBQ. A ficha mostra os dois títulos.
            </p>
          ) : null}
          <Callout kind="limite" label="Texto literal NULL">
            <p style={{ margin: 0 }}>
              {formato(vista.nulas)} ocupações do QBQ trazem o texto NULL nos campos de síntese, como na planilha oficial. O literal permanece, sem ser trocado por um texto vazio.
            </p>
          </Callout>

          <h2 id="decisoes">Decisões de modelagem</h2>
          <p>Toda escolha que afeta a leitura dos dados está registrada, com contexto e decisão. O texto completo de cada uma também está na API.</p>
          <ol style={{ listStyle: "none", padding: 0 }}>
            {vista.decisoes.map((item) => (
              <li key={item.id} style={{ margin: 0, padding: "var(--space-2) 0", borderTop: "1px solid var(--line)" }}>
                <a href={item.link} style={{ font: "400 14px/24px var(--font-mono)" }}>{item.id}</a>
                <span style={{ marginLeft: "var(--space-3)", font: "400 16px/24px var(--font-serif)" }}>{item.titulo}</span>
                <Disclosure summary="Texto completo">
                  <p style={{ margin: 0 }}>{item.contexto}</p>
                  <p style={{ margin: "var(--space-3) 0 0" }}>{item.decisao}</p>
                </Disclosure>
              </li>
            ))}
          </ol>

          <h2 id="citar">Como citar</h2>
          <p>
            Quem usa os dados numa pesquisa cita o conjunto de dados. Quem usa a API, o servidor MCP ou o código cita também o software. As duas citações creditam a origem: a CBO e o QBQ são publicações oficiais do Ministério do Trabalho e Emprego.
          </p>
          <Callout kind="nota" label="Conjunto de dados">
            <p style={{ margin: 0 }}>{vista.citacao.dados}</p>
          </Callout>
          <CodeBlock lang="bibtex" title="BibTeX do conjunto de dados" code={vista.citacao.bibtex_dados} />
          <p>
            O DOI de versão, <a href={vista.doi.versao_url}>{vista.doi.versao}</a>, aponta para exatamente esta versão ({vista.versao}) e é o que se usa para dizer o que foi consultado. O DOI de conceito, <a href={vista.doi.conceito_url}>{vista.doi.conceito}</a>, aponta sempre para a versão mais recente.
          </p>
          <Callout kind="nota" label="Software">
            <p style={{ margin: 0 }}>{vista.citacao.software}</p>
          </Callout>
          <CodeBlock lang="bibtex" title="BibTeX do software" code={vista.citacao.bibtex_software} />
          <p>
            {vista.doiSoftware ? (
              <>O DOI de conceito do software é <a href={vista.doiSoftware.url}>{vista.doiSoftware.doi}</a>.</>
            ) : (
              <>O software ainda não tem DOI; até lá, a citação aponta para o <a href={vista.repositorioServico}>repositório</a>.</>
            )}
          </p>

          <h2 id="licencas">Licenças</h2>
          <p>
            O conteúdo provém de atos oficiais, que não são objeto de proteção autoral (art. 8º, IV, da Lei 9.610/1998). A compilação estruturada dos dados é licenciada sob <a href={vista.licencas.dados.url}>{vista.licencas.dados.nome}</a>. O código do site, da API e do MCP é licenciado sob <a href={vista.licencas.codigo.url}>{vista.licencas.codigo.nome}</a>.
          </p>

          <h2 id="servico">Sobre este serviço</h2>
          <p>
            Este serviço é uma iniciativa de pesquisa, sem vínculo com o Ministério do Trabalho e Emprego. Os dados vêm de publicações oficiais do ministério e são servidos sem alteração de conteúdo; as divergências entre as fontes e os cálculos derivados não são posição oficial. Para fins oficiais, consulte as publicações do ministério:{" "}
            {vista.fontesOficiais.map((url, indice) => (
              <span key={url}>
                {indice ? " e " : ""}
                <a href={url}>{indice ? "QBQ" : "CBO"}</a>
              </span>
            ))}
            .
          </p>

          <h2 id="privacidade">Privacidade</h2>
          <p>
            O site usa o Google Analytics para contar visitas e ver quais páginas são acessadas. A ferramenta grava cookies próprios no navegador e envia ao Google dados de navegação, como a página visitada, a origem do acesso e o tipo de dispositivo; o Google Signals e a personalização de anúncios estão desligados. Além disso, o site guarda no navegador a preferência de tema (<code>localStorage</code>, chave <code>cs-tema</code>). A API e o servidor MCP não guardam o conteúdo das consultas. A hospedagem (Vercel) registra endereço IP e dados técnicos de acesso por razão de segurança, conforme a política dela.
          </p>

          <h2 id="ia">Uso de IA</h2>
          <Callout kind="ia" label="Declaração de uso de IA">
            <p style={{ margin: 0 }}>{vista.declaracaoIa}</p>
          </Callout>
        </div>
        <aside style={{ flex: "1 1 12rem", maxWidth: "16rem", minWidth: 0, paddingTop: "var(--space-2)" }}>
          <Toc
            title="Sumário"
            items={[
              { href: "#versoes", label: "Versões por camada" },
              { href: "#cobertura", label: "Cobertura entre as camadas" },
              { href: "#decisoes", label: "Decisões de modelagem" },
              { href: "#citar", label: "Como citar" },
              { href: "#licencas", label: "Licenças" },
              { href: "#servico", label: "Sobre este serviço" },
              { href: "#privacidade", label: "Privacidade" },
              { href: "#ia", label: "Uso de IA" },
            ]}
          />
          <div style={{ marginTop: "var(--space-6)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--line)" }}>
            <a className="x-go" href={vista.repositorio}><Icon name="download" /> Baixar os dados</a>
          </div>
        </aside>
      </div>
    </main>
  );
}
