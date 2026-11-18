import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { criarServidor } from "@/mcp/servidor";

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

async function chamar(nome: string, args: Record<string, unknown>) {
  const resultado = await cliente.callTool({ name: nome, arguments: args });
  const blocos = resultado.content as { type: string; text: string }[];
  return { resultado, blocos };
}

const casos: [string, Record<string, unknown>][] = [
  ["ocupacao_buscar", { consulta: "programador" }],
  ["ocupacao_obter", { codigo: "212405" }],
  ["cbo_atividades", { codigo: "212405", modo: "resumo" }],
  ["qbq_competencias", { codigo: "212405" }],
  ["cbo_navegar", { codigo: "2124" }],
  ["codigo_decodificar", { codigos: ["212499"] }],
  ["qbq_vocabulario", { vocabulario: "habilidades", nivel: "habilidades", codigo: "01.01.01" }],
  ["dados_sobre", { topico: "versao" }],
  ["cbo_buscar_atividades", { consulta: "programar", limite: 5 }],
  ["qbq_buscar_termos", { consulta: "banco de dados", limite: 5 }],
  ["qbq_ocupacoes_por_competencia", { vocabulario: "conhecimentos-i", nivel: "conhecimentos", codigo: "01.01.02", importancia_min: 4, limite: 5 }],
  ["ocupacao_comparar", { codigos: ["212420", "212405"], dimensao: "habilidades" }],
  ["ocupacao_similares", { codigo: "212405", limite: 5 }],
  ["cbo_resumir_grupo", { codigo: "2124", limite: 5 }],
  ["cobertura_consultar", {}],
];

describe("T1 texto acompanha o JSON", () => {
  it.each(casos)("%s devolve o structuredContent no segundo bloco de texto", async (nome, args) => {
    const { resultado, blocos } = await chamar(nome, args);
    expect(blocos.map((bloco) => bloco.type)).toEqual(["text", "text"]);
    expect(JSON.parse(blocos[1].text)).toEqual(resultado.structuredContent);
    expect(blocos[0].text.length).toBeGreaterThan(0);
  });

  it("o resumo de codigo_decodificar cita a família 2124", async () => {
    const { blocos } = await chamar("codigo_decodificar", { codigos: ["212499"] });
    expect(blocos[0].text).toMatch(/família 2124/);
  });

  it("o resumo de qbq_competencias cita 62, 46 e 4", async () => {
    const { blocos } = await chamar("qbq_competencias", { codigo: "212405" });
    expect(blocos[0].text).toMatch(/62 conhecimentos/);
    expect(blocos[0].text).toMatch(/46 habilidades/);
    expect(blocos[0].text).toMatch(/4 atitudes/);
  });
});
