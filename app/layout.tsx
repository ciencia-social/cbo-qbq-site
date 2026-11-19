import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import { analyticsAtivo } from "@/site/analytics";
import { AvisoAnalytics } from "@/ui/aviso-analytics";
import { Barra } from "@/ui/barra";
import { SiteFooter } from "@/ui/componentes";
import { SCRIPT_TEMA } from "@/ui/tema";
import { LICENCA, REPOSITORIO_DADOS, VERSAO_DADOS, VERSAO_SCHEMA } from "@/versao";
import "@/ui/tokens.css";
import "../design/ds/bundle.css";
import "../design/telas/site.css";
import "@/ui/tema.css";

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--fonte-serif",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--fonte-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--fonte-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cbo.ciencia.social"),
  title: { default: "CBO e QBQ", template: "%s · CBO e QBQ" },
  description:
    "Classificação Brasileira de Ocupações e Quadro Brasileiro de Qualificações, a partir de publicações oficiais do Ministério do Trabalho e Emprego.",
  openGraph: {
    locale: "pt_BR",
    siteName: "CBO e QBQ",
    title: "CBO e QBQ",
    description:
      "Classificação Brasileira de Ocupações e Quadro Brasileiro de Qualificações, a partir de publicações oficiais do Ministério do Trabalho e Emprego.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" className={`${serif.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <Barra />
        {children}
        <SiteFooter
          columns={[
            {
              title: "Pesquisa",
              items: [
                "Projeto ciencia.social",
                "Fontes: CBO 2002 e QBQ, Ministério do Trabalho e Emprego",
                { label: "Sobre os dados", href: "/sobre" },
              ],
            },
            {
              title: "Artefato",
              items: [
                `Dados ${VERSAO_DADOS} · ${VERSAO_SCHEMA}`,
                `Dados sob ${LICENCA.nome}, código sob MIT`,
                { label: "Repositório no GitHub", href: REPOSITORIO_DADOS },
              ],
            },
            {
              title: "Para máquinas",
              items: [
                { label: "API REST", href: "/docs" },
                { label: "Servidor MCP", href: "/docs/mcp" },
                { label: "llms.txt", href: "/llms.txt" },
                { label: "llms-full.txt", href: "/llms-full.txt" },
                { label: "OpenAPI 3.1", href: "/api/v1/openapi.json" },
              ],
            },
          ]}
        />
        {analyticsAtivo() && <AvisoAnalytics />}
      </body>
    </html>
  );
}
