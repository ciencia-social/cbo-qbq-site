/**
 * JSON-LD schema.org/Dataset da página inicial e de /sobre (S4).
 * Gerado das constantes de src/versao.ts e das contagens do banco; nada escrito à mão.
 */
import { estatisticas } from "@/consulta/derivado";
import { formato as formatar } from "@/ui/formato";
import {
  ANEXOS_RELEASE,
  AUTOR,
  CITACAO_DADOS,
  DOI_DADOS,
  doiUrl,
  FONTES_OFICIAIS,
  LICENCAS,
  PREFIXO_API,
  REPOSITORIO_DADOS,
  SITE,
  TAG_DADOS,
  VERSAO_DADOS,
} from "@/versao";

export function jsonLdDataset() {
  const n = estatisticas().dados as Record<string, number>;
  return {
    "@context": "https://schema.org/",
    "@type": "Dataset",
    name: "CBO e QBQ como dados abertos",
    description: `Classificação Brasileira de Ocupações (${formatar(n.ocupacoes_cbo)} ocupações, ${formatar(n.sinonimos)} sinônimos e ${formatar(n.atividades)} atividades) e Quadro Brasileiro de Qualificações (${formatar(n.ocupacoes_qbq)} ocupações e cerca de ${formatar(Math.round((n.conhecimentos + n.habilidades + n.atitudes) / 1000))} mil itens de competência), compiladas das publicações oficiais do Ministério do Trabalho e Emprego com a proveniência de cada registro.`,
    url: SITE,
    identifier: [doiUrl(DOI_DADOS.conceito), doiUrl(DOI_DADOS.versao)],
    version: VERSAO_DADOS,
    license: LICENCAS.dados.url,
    isAccessibleForFree: true,
    inLanguage: "pt-BR",
    keywords: ["Classificação Brasileira de Ocupações", "CBO", "Quadro Brasileiro de Qualificações", "QBQ", "ocupações", "qualificação profissional", "Brasil"],
    creator: { "@type": "Person", name: AUTOR.nome, identifier: AUTOR.orcid },
    publisher: { "@type": "Organization", name: "ciencia.social", url: SITE },
    isBasedOn: [...FONTES_OFICIAIS],
    sameAs: REPOSITORIO_DADOS,
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}${PREFIXO_API}`, name: "API REST aberta" },
      ...(ANEXOS_RELEASE.includes("qbq.sqlite.gz")
        ? [{ "@type": "DataDownload", encodingFormat: "application/vnd.sqlite3", contentUrl: `${REPOSITORIO_DADOS}/releases/download/${TAG_DADOS}/qbq.sqlite.gz`, name: "Banco SQLite (gzip)" }]
        : []),
      { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${REPOSITORIO_DADOS}/tree/${TAG_DADOS}/derivados/csv`, name: "Tabelas CSV" },
    ],
    citation: CITACAO_DADOS,
    measurementTechnique: "Extração reprodutível dos arquivos oficiais do Ministério do Trabalho e Emprego, com proveniência por registro e verificação por checksum.",
  };
}

/** Texto para <script type="application/ld+json">, com < escapado para não fechar a tag. */
export function scriptJsonLd(dados: object) {
  return JSON.stringify(dados).replace(/</g, "\\u003c");
}
