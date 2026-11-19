import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { criarServidor } from "@/mcp/servidor";
import { tratar } from "@/http/dispatcher";

const LONGA = "a".repeat(201);
const MUITOS_TERMOS = Array.from({ length: 13 }, (_, i) => `termo${i}`).join(" ");
const CODIGO_LONGO = "1".repeat(21);

async function api(caminho: string) {
  const resposta = await tratar(new Request(`http://localhost${caminho}`));
  return { status: resposta.status, tipo: resposta.headers.get("content-type") ?? "", corpo: await resposta.json() };
}

describe("I5 tetos na API", () => {
  it("q com mais de 200 caracteres responde 400 em problem+json", async () => {
    for (const rota of ["/api/v1/ocupacoes", "/api/v1/qbq/itens", "/api/v1/atividades", "/api/v1/busca"]) {
      const resposta = await api(`${rota}?q=${LONGA}`);
      expect(resposta.status, rota).toBe(400);
      expect(resposta.tipo).toContain("application/problem+json");
      expect(resposta.corpo.detalhe).toContain("200");
    }
    expect((await api(`/api/v1/ocupacoes?q=${"a".repeat(200)}`)).status).toBe(200);
  });

  it("q com mais de 12 termos responde 400", async () => {
    const resposta = await api(`/api/v1/atividades?q=${encodeURIComponent(MUITOS_TERMOS)}`);
    expect(resposta.status).toBe(400);
    expect(resposta.corpo.detalhe).toContain("12");
  });

  it("código com mais de 20 caracteres responde 400, no caminho e na consulta", async () => {
    const caminho = await api(`/api/v1/ocupacoes/${CODIGO_LONGO}`);
    expect(caminho.status).toBe(400);
    expect(caminho.tipo).toContain("application/problem+json");
    expect(caminho.corpo.detalhe).toContain("20");
    const lote = await api(`/api/v1/codigos?codigos=212405,${CODIGO_LONGO}`);
    expect(lote.status).toBe(400);
    const pai = await api(`/api/v1/cbo/familias?pai=${CODIGO_LONGO}`);
    expect(pai.status).toBe(400);
  });

  it("caminho com codificação inválida responde 400, não 500", async () => {
    const resposta = await api("/api/v1/ocupacoes/%E0%A4%A");
    expect(resposta.status).toBe(400);
  });
});

describe("I5 tetos no MCP", () => {
  let cliente: Client;
  let fechar: () => Promise<void>;

  beforeAll(async () => {
    const servidor = criarServidor();
    const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair();
    cliente = new Client({ name: "teste", version: "0" });
    await servidor.connect(transporteServidor);
    await cliente.connect(transporteCliente);
    fechar = async () => {
      await cliente.close();
      await servidor.close();
    };
  });

  afterAll(async () => {
    await fechar();
  });

  async function erro(nome: string, args: Record<string, unknown>) {
    const resultado = await cliente.callTool({ name: nome, arguments: args });
    expect(resultado.isError, nome).toBe(true);
    return (resultado.content as { text: string }[]).map((bloco) => bloco.text).join("\n");
  }

  it("consulta acima de 200 caracteres diz o limite", async () => {
    expect(await erro("ocupacao_buscar", { consulta: LONGA })).toContain("200");
    expect(await erro("cbo_buscar_atividades", { consulta: LONGA })).toContain("200");
  });

  it("consulta acima de 12 termos diz o limite", async () => {
    expect(await erro("qbq_buscar_termos", { consulta: MUITOS_TERMOS })).toContain("12");
  });

  it("código acima de 20 caracteres diz o limite", async () => {
    expect(await erro("ocupacao_obter", { codigo: CODIGO_LONGO })).toContain("20");
    expect(await erro("codigo_decodificar", { codigos: [CODIGO_LONGO] })).toContain("20");
  });

  it("lista de vocabulários acima de 4 itens diz o limite", async () => {
    const texto = await erro("qbq_buscar_termos", {
      consulta: "dados",
      vocabularios: ["habilidades", "atitudes", "conhecimentos-i", "conhecimentos-ii", "habilidades"],
    });
    expect(texto).toContain("4");
  });

  it("tools/list anuncia os tetos no esquema", async () => {
    const lista = await cliente.listTools();
    const buscar = lista.tools.find((tool) => tool.name === "qbq_buscar_termos")!;
    const propriedades = buscar.inputSchema.properties as Record<string, { maxLength?: number; maxItems?: number }>;
    expect(propriedades.consulta.maxLength).toBe(200);
    expect(propriedades.vocabularios.maxItems).toBe(4);
  });
});
