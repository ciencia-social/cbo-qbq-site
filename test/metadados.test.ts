import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { tratar } from "@/http/dispatcher";
import { criarServidor } from "@/mcp/servidor";
import { CITACAO_DADOS, DOI_DADOS, VERSAO_SERVICO } from "@/versao";
import pacote from "../package.json";

const RAIZ = path.resolve(import.meta.dirname, "..");
const cff = fs.readFileSync(path.join(RAIZ, "CITATION.cff"), "utf8");
const zenodo = JSON.parse(fs.readFileSync(path.join(RAIZ, ".zenodo.json"), "utf8")) as {
  title: string;
  creators: { name: string; orcid: string }[];
  license: string;
  version?: string;
  related_identifiers: { identifier: string; relation: string; resource_type: string }[];
};

/** Lê um campo escalar de primeiro nível do CFF, sem dependência de YAML. */
function campo(nome: string): string | undefined {
  const linha = cff.split("\n").find((l) => l.startsWith(`${nome}:`));
  return linha?.slice(nome.length + 1).trim().replace(/^"|"$/g, "");
}

/** Autores do bloco `authors:` de primeiro nível. */
function autores() {
  const bloco = cff.split(/\n(?=\S)/).find((parte) => parte.startsWith("authors:")) ?? "";
  return bloco
    .split(/\n  - /)
    .slice(1)
    .map((item) => {
      const valor = (chave: string) => item.match(new RegExp(`${chave}: "?([^"\\n]+)"?`))?.[1];
      return { family: valor("family-names"), given: valor("given-names"), orcid: valor("orcid") };
    });
}

describe("CITATION.cff e .zenodo.json andam juntos (P7)", () => {
  it("têm o mesmo título", () => {
    expect(campo("title")).toBe(zenodo.title);
  });

  it("têm os mesmos autores, com o mesmo ORCID", () => {
    const doCff = autores();
    expect(doCff.length).toBeGreaterThan(0);
    expect(doCff.map((a) => `${a.family}, ${a.given}`)).toEqual(zenodo.creators.map((c) => c.name));
    expect(doCff.map((a) => a.orcid?.replace("https://orcid.org/", ""))).toEqual(zenodo.creators.map((c) => c.orcid));
  });

  it("declaram MIT e o tipo software", () => {
    expect(campo("license")).toBe("MIT");
    expect(zenodo.license).toBe("MIT");
    expect(campo("type")).toBe("software");
  });

  it("não têm versão: ela vem da tag", () => {
    expect(campo("version")).toBeUndefined();
    expect(zenodo.version).toBeUndefined();
  });

  it("citam o mesmo DOI dos dados que src/versao.ts", () => {
    expect(cff).toContain(`doi: "${DOI_DADOS.conceito}"`);
    const referencia = zenodo.related_identifiers.find((r) => r.relation === "references" && r.resource_type === "dataset");
    expect(referencia?.identifier).toBe(DOI_DADOS.conceito);
  });
});

describe("versão do software (P8)", () => {
  it("vem do package.json", () => {
    expect(VERSAO_SERVICO).toBe(pacote.version);
  });

  it("vai no cabeçalho X-Versao-Servico, exposto no CORS", async () => {
    const resposta = await tratar(new Request("http://localhost/api/v1/versao"));
    expect(resposta.headers.get("x-versao-servico")).toBe(pacote.version);
    expect(resposta.headers.get("access-control-expose-headers")).toContain("X-Versao-Servico");
    const corpo = (await resposta.json()) as { dados: { versao_servico: string } };
    expect(corpo.dados.versao_servico).toBe(pacote.version);
  });

  it("vai em serverInfo.version do MCP", async () => {
    const [cliente, servidor] = InMemoryTransport.createLinkedPair();
    const mcp = criarServidor();
    await mcp.connect(servidor);
    const client = new Client({ name: "teste", version: "0" });
    await client.connect(cliente);
    expect(client.getServerVersion()?.version).toBe(pacote.version);
    await client.close();
    await mcp.close();
  });
});

describe("citação dos dados igual à do cbo-qbq-dados (P6, T6)", () => {
  const candidatos = [process.env.CBO_QBQ_DADOS, path.join(RAIZ, ".dados"), path.join(RAIZ, "..", "cbo-qbq-dados")].filter(Boolean) as string[];
  const licenca = candidatos.map((pasta) => path.join(pasta, "dados", "LICENSE.md")).find((arquivo) => fs.existsSync(arquivo));

  /**
   * O DOI só existe depois da release, então a tag publicada traz a atribuição sem ele e o
   * commit de acerto (na main do cbo-qbq-dados) a completa. Com DOI, a igualdade é exata; sem
   * DOI, tudo o mais tem de ser igual.
   */
  it.skipIf(!licenca)("dados/LICENSE.md traz CITACAO_DADOS palavra por palavra", () => {
    const linha = fs.readFileSync(licenca!, "utf8").split("\n").find((l) => l.startsWith("Atribuição sugerida: "));
    const atribuicao = linha?.replace("Atribuição sugerida: ", "").replace(/ Licença CC BY 4\.0\.$/, "");
    const esperada = atribuicao?.includes("doi.org") ? `${CITACAO_DADOS}.` : CITACAO_DADOS.replace(/ https:\/\/doi\.org\/\S+$/, "");
    expect(atribuicao).toBe(esperada);
  });
});
