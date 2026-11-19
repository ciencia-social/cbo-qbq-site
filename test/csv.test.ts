import { describe, expect, it } from "vitest";
import { tratar } from "@/http/dispatcher";
import { paraCsv } from "@/http/csv";
import { TAG_DADOS } from "@/versao";

async function pedir(caminho: string) {
  const resposta = await tratar(new Request(`http://localhost${caminho}`));
  return { status: resposta.status, tipo: resposta.headers.get("content-type") ?? "", headers: resposta.headers, texto: await resposta.text() };
}

describe("I14 CSV", () => {
  it("/ocupacoes?formato=csv&limite=100 devolve 101 linhas, com cabeçalho", async () => {
    const resposta = await pedir("/api/v1/ocupacoes?formato=csv&limite=100");
    expect(resposta.status).toBe(200);
    expect(resposta.tipo).toBe("text/csv; charset=utf-8");
    expect(resposta.texto.charCodeAt(0)).not.toBe(0xfeff);
    expect(resposta.texto.endsWith("\n")).toBe(true);
    const linhas = resposta.texto.trimEnd().split("\n");
    expect(linhas).toHaveLength(101);
    expect(linhas[0].split(",").slice(0, 4)).toEqual(["codigo", "codigo_formatado", "titulo_cbo", "titulo_qbq"]);
    expect(linhas[0]).toContain("familia_codigo");
    expect(resposta.headers.get("x-total")).toBe("2698");
  });

  it.each([
    "/api/v1/cbo/familias?formato=csv",
    "/api/v1/cbo/familias/2124/ocupacoes?formato=csv",
    "/api/v1/sinonimos?q=programador&formato=csv",
    "/api/v1/atividades?q=programar&formato=csv",
    "/api/v1/qbq/nao-classificadas?formato=csv",
    "/api/v1/cobertura?formato=csv",
  ])("%s responde CSV", async (caminho) => {
    const resposta = await pedir(caminho);
    expect(resposta.status).toBe(200);
    expect(resposta.tipo).toContain("text/csv");
    expect(resposta.texto.split("\n").length).toBeGreaterThan(2);
  });

  it("rota com dados aninhados recusa CSV e lista as que aceitam", async () => {
    const resposta = await pedir("/api/v1/ocupacoes/212405?formato=csv");
    expect(resposta.status).toBe(400);
    const corpo = JSON.parse(resposta.texto);
    expect(corpo.detalhe).toContain("/api/v1/ocupacoes");
    expect(corpo.detalhe).toContain("/api/v1/cobertura");
    expect((await pedir("/api/v1/atividades?q=programar&agrupar_por=ocupacao&formato=csv")).status).toBe(400);
  });

  it("escapa aspas, vírgulas e quebras de linha", () => {
    expect(paraCsv([{ a: 'x, "y"', b: "1\n2", c: null, d: { e: 3 } }])).toBe('a,b,c,d_e\n"x, ""y""","1\n2",,3\n');
  });
});

describe("I14 R07 downloads", () => {
  it("aponta os anexos da release e o manifesto, sem hospedar arquivo", async () => {
    const resposta = await pedir("/api/v1/downloads");
    expect(resposta.status).toBe(200);
    const { dados } = JSON.parse(resposta.texto);
    expect(dados.tag).toBe(TAG_DADOS);
    expect(dados.manifesto).toBe(`https://github.com/ciencia-social/cbo-qbq-dados/releases/download/${TAG_DADOS}/MANIFEST.sha256`);
    expect(dados.anexos.map((anexo: { nome: string }) => anexo.nome)).toEqual(["qbq.sqlite.gz", "qbq.sql.gz", "MANIFEST.sha256"]);
    for (const anexo of dados.anexos) expect(anexo.url).toMatch(/^https:\/\/github\.com\//);
  });
});
