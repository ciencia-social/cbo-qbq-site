import { Callout, DataTable, Disclosure, Icon, ReportHeader, Toc } from "@/ui/componentes";
import { formato } from "@/ui/formato";
import type { VistaSobre } from "@/site/sobre";

const DECLARACAO_IA = "[DESCREVER EM QUE ETAPAS DO PROJETO A IA FOI USADA, COM QUAL FERRAMENTA E COMO O RESULTADO FOI CONFERIDO]";

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

          <h2 id="citar">Licença e como citar</h2>
          <p>O conteúdo provém de atos oficiais, que não são objeto de proteção autoral (art. 8º, IV, da Lei 9.610/1998). A compilação estruturada é licenciada sob {vista.licenca}; o código, sob MIT.</p>
          <Callout kind="nota" label="Atribuição sugerida">
            <p style={{ margin: 0 }}>{vista.citacao} Versão {vista.versao}.</p>
          </Callout>

          <h2 id="ia">Uso de IA</h2>
          <Callout kind="ia" label="Declaração de uso de IA">
            <p style={{ margin: 0 }}>{DECLARACAO_IA}</p>
          </Callout>
        </div>
        <aside style={{ flex: "1 1 12rem", maxWidth: "16rem", minWidth: 0, paddingTop: "var(--space-2)" }}>
          <Toc
            title="Sumário"
            items={[
              { href: "#versoes", label: "Versões por camada" },
              { href: "#cobertura", label: "Cobertura entre as camadas" },
              { href: "#decisoes", label: "Decisões de modelagem" },
              { href: "#citar", label: "Licença e como citar" },
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
