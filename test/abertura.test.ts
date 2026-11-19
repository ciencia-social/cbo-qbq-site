import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { tratar } from "@/http/dispatcher";
import { carregarSobre } from "@/site/sobre";
import { PaginaSobre } from "@/site/sobre-view";
import { CITACAO_DADOS, CITACAO_SOFTWARE, DECLARACAO_IA } from "@/versao";
import pacote from "../package.json";

/**
 * P15: o que precisa ser verdade para o repositório ficar público, e continuar sendo depois.
 * O teste dos marcadores falha até o mantenedor escrever a declaração de uso de IA. É intencional.
 */

const RAIZ = path.resolve(import.meta.dirname, "..");
const ler = (relativo: string) => fs.readFileSync(path.join(RAIZ, relativo), "utf8");

/** Arquivos versionados ou a versionar (respeita o .gitignore). */
function arquivosDoRepositorio(): string[] {
  const saida = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: RAIZ, encoding: "utf8" });
  return saida.split("\n").filter((arquivo) => arquivo && fs.existsSync(path.join(RAIZ, arquivo)));
}

/** src/, app/, public/, .github/ e os arquivos da raiz. Os planos em docs/ usam os marcadores de propósito. */
function varridos(): string[] {
  const pastas = ["src/", "app/", "public/", ".github/"];
  return arquivosDoRepositorio().filter(
    (arquivo) => (pastas.some((pasta) => arquivo.startsWith(pasta)) || !arquivo.includes("/")) && arquivo !== "package-lock.json",
  );
}

function comMarcador(marcadores: string[]) {
  const achados: string[] = [];
  for (const arquivo of varridos()) {
    const texto = ler(arquivo);
    for (const marcador of marcadores) if (texto.includes(marcador)) achados.push(`${arquivo}: ${marcador}`);
  }
  return achados;
}

/** Links relativos de um Markdown, sem âncora; ignora URLs absolutas e e-mails. */
function linksRelativos(arquivo: string): string[] {
  const texto = ler(arquivo).replace(/<!--[\s\S]*?-->/g, "");
  return [...texto.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((casamento) => casamento[1])
    .filter((alvo) => !/^[a-z]+:/i.test(alvo) && !alvo.startsWith("#"))
    .map((alvo) => alvo.split("#")[0]);
}

describe("P15 prontidão para abrir o repositório", () => {
  it("os arquivos de repositório público existem", () => {
    const exigidos = [
      "LICENSE",
      "THIRD_PARTY_NOTICES.md",
      "SECURITY.md",
      "CONTRIBUTING.md",
      "CHANGELOG.md",
      "CITATION.cff",
      ".zenodo.json",
      "docs/USO-DE-IA.md",
      "docs/operacao.md",
      "docs/README.md",
      ".github/workflows/ci.yml",
      ".github/dependabot.yml",
      ".github/PULL_REQUEST_TEMPLATE.md",
      ".github/ISSUE_TEMPLATE/erro-na-api.yml",
      ".github/ISSUE_TEMPLATE/erro-no-mcp.yml",
      ".github/ISSUE_TEMPLATE/config.yml",
    ];
    expect(exigidos.filter((arquivo) => !fs.existsSync(path.join(RAIZ, arquivo)))).toEqual([]);
  });

  it("nenhum marcador de texto a escrever pelo mantenedor ficou no código ou na raiz", () => {
    expect(comMarcador(["[DESCREVER", "<DECLARACAO_IA>", "<PRENOME>", "<SOBRENOME>", "<LICENCA_DESIGN>", "<CONTATO_SEGURANCA>"])).toEqual([]);
  });

  it("nenhum marcador de DOI ficou no código ou na raiz", () => {
    expect(comMarcador(["<DOI_"])).toEqual([]);
  });

  it.each(["README.md", "docs/README.md"])("todo link relativo de %s aponta para arquivo existente", (arquivo) => {
    const pasta = path.dirname(path.join(RAIZ, arquivo));
    const quebrados = linksRelativos(arquivo).filter((alvo) => !fs.existsSync(path.resolve(pasta, alvo)));
    expect(linksRelativos(arquivo).length).toBeGreaterThan(0);
    expect(quebrados).toEqual([]);
  });

  it("package.json tem licença, repositório e página", () => {
    expect(pacote.license).toBe("MIT");
    expect(pacote.repository.url).toContain("github.com/ciencia-social/cbo-qbq-site");
    expect(pacote.homepage).toBe("https://cbo.ciencia.social");
    expect(pacote.private).toBe(true);
  });

  it("os documentos da avaliação ficam fora do git", () => {
    expect(ler(".gitignore").split("\n")).toContain("docs/avaliacao-2026-11/");
  });

  it("os documentos de processo começam com o bloco de situação", () => {
    for (const arquivo of [
      "design/PROMPT.md",
      "design/HANDOFF.md",
      "docs/plano-api-mcp-cbo-qbq.md",
      "docs/tarefas-mcp.md",
      "docs/plano-fair-servico.md",
      "docs/relatorio-fair-servico.md",
    ]) {
      expect(ler(arquivo), arquivo).toMatch(/^> Escrito em .+\n> Situação: (concluído|em andamento|histórico)/);
    }
  });
});

describe("P6 citação unificada", () => {
  it("as citações antigas não existem mais", () => {
    const antigas = ["cbo-qbq-dados —", "CBO-QBQ-DADOS. Ocupação"];
    const achados = arquivosDoRepositorio()
      .filter((arquivo) => ["src/", "app/", "public/"].some((pasta) => arquivo.startsWith(pasta)))
      .flatMap((arquivo) => antigas.filter((antiga) => ler(arquivo).includes(antiga)).map((antiga) => `${arquivo}: ${antiga}`));
    expect(achados).toEqual([]);
  });

  it("/api/v1/versao, /sobre, llms.txt, llms-full.txt e README trazem exatamente CITACAO_DADOS", async () => {
    const resposta = await tratar(new Request("http://localhost/api/v1/versao"));
    const corpo = (await resposta.json()) as { dados: { citacao: { dados: string; software: string }; licenca: { citacao: string } } };
    expect(corpo.dados.citacao.dados).toBe(CITACAO_DADOS);
    expect(corpo.dados.citacao.software).toBe(CITACAO_SOFTWARE);
    expect(corpo.dados.licenca.citacao).toBe(CITACAO_DADOS);
    const html = renderToStaticMarkup(createElement(PaginaSobre, { vista: carregarSobre() }));
    expect(html).toContain(CITACAO_DADOS);
    for (const arquivo of ["public/llms.txt", "public/llms-full.txt", "README.md"]) expect(ler(arquivo), arquivo).toContain(CITACAO_DADOS);
    expect(ler("README.md")).toContain(CITACAO_SOFTWARE);
  });
});

describe("P4 declaração de uso de IA", () => {
  it("a constante de /sobre é o texto da seção 7 de docs/USO-DE-IA.md", () => {
    const doc = fs.readFileSync(path.resolve(import.meta.dirname, "../docs/USO-DE-IA.md"), "utf8");
    const secao = doc.split("## 7.")[1]?.split("\n## ")[0] ?? "";
    const citado = secao.split("\n").find((linha) => linha.startsWith("> "))?.slice(2);
    expect(citado).toBe(DECLARACAO_IA);
    expect(DECLARACAO_IA).not.toMatch(/\[|<DECLARACAO_IA>/);
  });
});
