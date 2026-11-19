import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { POST } from "../app/mcp/route";
import robots from "../app/robots";
import { todos } from "@/dados/banco";
import { tratar } from "@/http/dispatcher";
import { executarTool } from "@/mcp/executar";
import { jsonLdDataset, scriptJsonLd } from "@/site/jsonld";
import { entradasSitemap } from "@/site/sitemap";
import { VOCABULARIOS } from "@/tipos";
import { AUTOR, CITACAO_DADOS, DOI_DADOS, LICENCAS, REPOSITORIO_SERVICO, VERSAO_CAMADAS, VERSAO_DADOS, VERSAO_SCHEMA } from "@/versao";
import config from "../next.config";
import { contagensEsperadas, divergenciasVersao, type VersaoJson } from "../scripts/versao-json";

const RAIZ = path.resolve(import.meta.dirname, "..");

async function get(caminho: string) {
  const resposta = await tratar(new Request(`http://localhost${caminho}`));
  return { headers: resposta.headers, corpo: (await resposta.json()) as { dados: Record<string, unknown> } };
}

describe("S2 /api/v1/versao com identidade completa", () => {
  it("traz os dois DOIs, a citação com o DOI, a autoria e as duas licenças", async () => {
    const { corpo } = await get("/api/v1/versao");
    const dados = corpo.dados as {
      doi: { conceito: string; versao: string };
      citacao: { dados: string; doi_url: string; bibtex_dados: string };
      autor: { orcid: string };
      licencas: { dados: { spdx: string }; codigo: { spdx: string } };
      licenca: { nome: string };
      dados_commit: string | null;
      repositorio_servico: string;
    };
    expect(dados.doi).toEqual({ conceito: DOI_DADOS.conceito, versao: DOI_DADOS.versao });
    expect(dados.citacao.dados).toContain(DOI_DADOS.versao);
    expect(dados.citacao.bibtex_dados).toContain(`doi       = {${DOI_DADOS.versao}}`);
    expect(dados.autor.orcid).toBe(AUTOR.orcid);
    expect(dados.licencas.dados.spdx).toBe("CC-BY-4.0");
    expect(dados.licencas.codigo.spdx).toBe("MIT");
    expect(dados.licenca.nome).toBe("CC BY 4.0");
    expect(dados).toHaveProperty("dados_commit");
    expect(dados.repositorio_servico).toBe(REPOSITORIO_SERVICO);
  });
});

describe("S3 Signposting", () => {
  const relacoes = (link: string | null) => [...(link ?? "").matchAll(/rel="([^"]+)"/g)].map((casamento) => casamento[1]);

  it("rota de dado cita o DOI de versão dos dados, com licença CC BY", async () => {
    const { headers } = await get("/api/v1/ocupacoes/212405");
    const link = headers.get("link");
    expect(relacoes(link)).toEqual(["cite-as", "describedby", "license", "author"]);
    expect(link).toContain(`<https://doi.org/${DOI_DADOS.versao}> ; rel="cite-as"`);
    expect(link).toContain(`<${LICENCAS.dados.url}> ; rel="license"`);
    expect(headers.get("access-control-expose-headers")).toContain("Link");
  });

  it("o índice e o OpenAPI citam o software, com licença MIT", async () => {
    for (const caminho of ["/api/v1", "/api/v1/openapi.json"]) {
      const resposta = await tratar(new Request(`http://localhost${caminho}`));
      const link = resposta.headers.get("link");
      expect(relacoes(link), caminho).toEqual(["cite-as", "describedby", "license", "author"]);
      expect(link, caminho).toContain(`<${LICENCAS.codigo.url}> ; rel="license"`);
      expect(link, caminho).not.toContain(DOI_DADOS.versao);
    }
  });

  it("o MCP também manda Link, e as páginas recebem o dos dados", async () => {
    const resposta = await POST(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "teste", version: "0" } } }),
      }),
    );
    expect(relacoes(resposta.headers.get("link"))).toEqual(["cite-as", "describedby", "license", "author"]);
    const corpo = await resposta.json();
    expect(corpo.result.instructions).toContain("cite o conjunto de dados");
    expect(corpo.result.instructions).toContain(DOI_DADOS.versao);

    const regras = await config.headers!();
    const paginas = regras.flatMap((regra) => regra.headers).find((cabecalho) => cabecalho.key === "Link");
    expect(paginas?.value).toContain(`<https://doi.org/${DOI_DADOS.versao}> ; rel="cite-as"`);
  });

  it("erro não leva Link", async () => {
    const resposta = await tratar(new Request("http://localhost/api/v1/ocupacoes/999999"));
    expect(resposta.status).toBe(404);
    expect(resposta.headers.get("link")).toBeNull();
  });
});

describe("S4 JSON-LD Dataset", () => {
  it("tem identificador, licença, autoria e versão coerentes", () => {
    const dados = jsonLdDataset();
    expect(dados["@type"]).toBe("Dataset");
    expect(dados.identifier).toContain(`https://doi.org/${DOI_DADOS.conceito}`);
    expect(dados.license).toBe(LICENCAS.dados.url);
    expect(dados.creator.identifier).toBe(AUTOR.orcid);
    expect(dados.version).toBe(VERSAO_DADOS);
    expect(dados.citation).toBe(CITACAO_DADOS);
    expect(dados.description).toContain("2.694 ocupações");
  });

  it("escapa < para não fechar a tag script", () => {
    expect(scriptJsonLd({ texto: "</script>" })).not.toContain("</script>");
  });
});

describe("S5 robots e sitemap", () => {
  it("robots libera tudo e aponta o sitemap", () => {
    const regras = robots();
    expect(regras.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(regras.sitemap).toBe("https://cbo.ciencia.social/sitemap.xml");
  });

  it("o sitemap tem uma entrada por ocupação do universo, além das páginas fixas", () => {
    const entradas = entradasSitemap().map((entrada) => entrada.url);
    const ocupacoes = entradas.filter((url) => url.includes("/ocupacoes/"));
    expect(ocupacoes).toHaveLength(2698);
    expect(new Set(entradas).size).toBe(entradas.length);
    const total = todos<{ n: number }>("SELECT count(*) n FROM ocupacao")[0].n;
    expect(ocupacoes).toHaveLength(total);
    expect(entradas).toContain("https://cbo.ciencia.social/ocupacoes/212405");
    for (const vocabulario of VOCABULARIOS) expect(entradas).toContain(`https://cbo.ciencia.social/competencias/${vocabulario}`);
  });
});

describe("S6 llms.txt", () => {
  it("cita a versão, o DOI e a citação correntes", () => {
    for (const arquivo of ["public/llms.txt", "public/llms-full.txt"]) {
      const texto = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
      expect(texto, arquivo).toContain(VERSAO_DADOS);
      expect(texto, arquivo).toContain(DOI_DADOS.conceito);
      expect(texto, arquivo).toContain(CITACAO_DADOS);
      const versoes = new Set(texto.match(/dados-\d{4}\.\d{2}(?:\.\d+)?/g));
      expect([...versoes], arquivo).toEqual([VERSAO_DADOS]);
    }
  });
});

describe("S7 OpenAPI", () => {
  it("declara a licença da API, a dos dados, o contato e os DOIs", async () => {
    const resposta = await tratar(new Request("http://localhost/api/v1/openapi.json"));
    const doc = (await resposta.json()) as { info: Record<string, any>; externalDocs: { url: string } };
    expect(doc.info.license).toEqual({ name: "MIT", identifier: "MIT" });
    expect(doc.info["x-licenca-dados"].identifier).toBe("CC-BY-4.0");
    expect(doc.info.contact.url).toBe(`${REPOSITORIO_SERVICO}/issues`);
    expect(doc.info.termsOfService).toBe("https://cbo.ciencia.social/sobre");
    expect(doc.info["x-doi"].dados_conceito).toBe(DOI_DADOS.conceito);
    expect(doc.externalDocs.url).toContain("cbo-qbq-dados");
  });
});

describe("S8 atribuição no MCP", () => {
  it("dados_sobre devolve DOI, autoria, licenças e citação", () => {
    const resultado = executarTool("dados_sobre", {});
    const corpo = (resultado.dados as { resultado: { doi: unknown; autor: unknown; licencas: unknown; citacao: { dados: string } } }).resultado;
    expect(corpo.doi).toEqual({ conceito: DOI_DADOS.conceito, versao: DOI_DADOS.versao });
    expect(corpo.autor).toBeTruthy();
    expect(corpo.licencas).toBeTruthy();
    expect(corpo.citacao?.dados).toBe(CITACAO_DADOS);
  });
});

describe("S12 VERSAO.json", () => {
  const base: VersaoJson = {
    versao_dados: VERSAO_DADOS,
    versao_schema: VERSAO_SCHEMA,
    camadas: { ...VERSAO_CAMADAS },
    doi: { conceito: "", versao: "" },
    contagens: { cbo_ocupacoes: 2694, qbq_conceitos: 96 },
  };
  const constantes = { versaoDados: VERSAO_DADOS, versaoSchema: VERSAO_SCHEMA, camadas: { ...VERSAO_CAMADAS }, doi: { ...DOI_DADOS } };

  it("aceita o VERSAO.json da tag, com DOI ainda vazio", () => {
    expect(divergenciasVersao(base, constantes)).toEqual([]);
  });

  it("aponta cada constante que precisa mudar numa troca de versão", () => {
    const nova = { ...base, versao_dados: "dados-2027.01", camadas: { ...base.camadas, qbq: "dados-2027.01" }, doi: { conceito: DOI_DADOS.conceito, versao: "10.5281/zenodo.1" } };
    const erros = divergenciasVersao(nova, constantes);
    expect(erros).toHaveLength(3);
    expect(erros.join("\n")).toMatch(/VERSAO_DADOS[\s\S]*VERSAO_CAMADAS\.qbq[\s\S]*DOI_DADOS\.versao/);
  });

  it("as contagens do VERSAO.json sobrepõem as fixas", () => {
    const esperadas = contagensEsperadas({ "ocupacao com titulo_cbo": 1, conceito: 1, decisao: 20 }, base);
    expect(esperadas).toEqual({ "ocupacao com titulo_cbo": 2694, conceito: 96, decisao: 20 });
  });
});
