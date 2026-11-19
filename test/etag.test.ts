import { afterEach, describe, expect, it } from "vitest";
import { etagDe, identificadorBuild, tratar } from "@/http/dispatcher";

const ORIGINAL = process.env.VERCEL_GIT_COMMIT_SHA;

afterEach(() => {
  if (ORIGINAL == null) delete process.env.VERCEL_GIT_COMMIT_SHA;
  else process.env.VERCEL_GIT_COMMIT_SHA = ORIGINAL;
});

describe("I7 ETag acompanha o build", () => {
  it("mudar o identificador do build muda o ETag da mesma URL", async () => {
    const url = "http://localhost/api/v1/ocupacoes/212405";
    process.env.VERCEL_GIT_COMMIT_SHA = "a".repeat(40);
    const antes = (await tratar(new Request(url))).headers.get("etag");
    process.env.VERCEL_GIT_COMMIT_SHA = "b".repeat(40);
    const depois = (await tratar(new Request(url))).headers.get("etag");
    expect(antes).toBeTruthy();
    expect(depois).not.toBe(antes);
  });

  it("um ETag de outro build não recebe 304", async () => {
    const url = "http://localhost/api/v1/versao";
    process.env.VERCEL_GIT_COMMIT_SHA = "a".repeat(40);
    const velho = (await tratar(new Request(url))).headers.get("etag")!;
    expect((await tratar(new Request(url, { headers: { "if-none-match": velho } }))).status).toBe(304);
    process.env.VERCEL_GIT_COMMIT_SHA = "b".repeat(40);
    expect((await tratar(new Request(url, { headers: { "if-none-match": velho } }))).status).toBe(200);
  });

  it("sem commit da Vercel, usa a versão do pacote", () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    expect(identificadorBuild()).toMatch(/^pacote-\d+\.\d+\.\d+/);
    expect(etagDe(new URL("http://localhost/api/v1/versao"))).toMatch(/^"[0-9a-f]{64}"$/);
  });
});
