import { afterEach, describe, expect, it } from "vitest";
import { criarLimitador, ipDe } from "@/http/limite";
import { tratar } from "@/http/dispatcher";

describe("I4 limitador por instância", () => {
  it("o Map não cresce além do teto", () => {
    const limitador = criarLimitador({ teto: 50 });
    for (let i = 0; i < 1_000; i++) limitador.contar(`10.0.${Math.floor(i / 256)}.${i % 256}`, 120);
    expect(limitador.tamanho()).toBe(50);
  });

  it("entradas vencidas saem do Map", () => {
    let agora = 1_000_000;
    const limitador = criarLimitador({ agora: () => agora });
    for (let i = 0; i < 100; i++) limitador.contar(`ip${i}`, 120);
    expect(limitador.tamanho()).toBe(100);
    agora += 61_000;
    limitador.contar("outro", 120);
    expect(limitador.tamanho()).toBe(1);
  });

  it("conta por janela e devolve a espera em segundos", () => {
    let agora = 0;
    const limitador = criarLimitador({ agora: () => agora });
    expect(limitador.contar("a", 2)).toBe(0);
    expect(limitador.contar("a", 2)).toBe(0);
    expect(limitador.contar("a", 2)).toBe(60);
    agora += 30_000;
    expect(limitador.contar("a", 2)).toBe(30);
    agora += 30_000;
    expect(limitador.contar("a", 2)).toBe(0);
  });

  it("lê x-real-ip antes de x-forwarded-for", () => {
    expect(ipDe(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("1.1.1.1");
    expect(ipDe(new Headers({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
    expect(ipDe(new Headers())).toBe("local");
  });
});

describe("I4 429 na API e no MCP", () => {
  afterEach(() => {
    delete process.env.LIMITE_TAXA;
  });

  it("a API responde 429 em problem+json com Retry-After", async () => {
    process.env.LIMITE_TAXA = "2";
    const pedir = () => tratar(new Request("http://localhost/api/v1/versao", { headers: { "x-real-ip": "198.51.100.1" } }));
    expect((await pedir()).status).toBe(200);
    expect((await pedir()).status).toBe(200);
    const terceira = await pedir();
    expect(terceira.status).toBe(429);
    expect(terceira.headers.get("content-type")).toContain("application/problem+json");
    expect(Number(terceira.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("/mcp passa pelo limitador e responde 429 em JSON-RPC", async () => {
    process.env.LIMITE_TAXA = "2";
    const { POST } = await import("../app/mcp/route");
    const pedir = () =>
      POST(
        new Request("http://localhost/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "x-real-ip": "198.51.100.2",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "teste", version: "0" } },
          }),
        }),
      );
    expect((await pedir()).status).toBe(200);
    expect((await pedir()).status).toBe(200);
    const terceira = await pedir();
    expect(terceira.status).toBe(429);
    expect(Number(terceira.headers.get("retry-after"))).toBeGreaterThan(0);
    const corpo = await terceira.json();
    expect(corpo.jsonrpc).toBe("2.0");
    expect(corpo.id).toBeNull();
    expect(corpo.error.code).toBe(-32000);
    expect(corpo.error.message).toContain("pedidos por minuto");
  });
});
