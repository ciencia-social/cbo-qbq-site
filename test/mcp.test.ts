import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { criarServidor } from "@/mcp/servidor";
import { competencias } from "@/consulta/ocupacao";

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

describe("T2 descrição das tools", () => {
  it("tools/list descreve cada parâmetro, enumera dimensao e dá title", async () => {
    const lista = await cliente.listTools();
    expect(lista.tools).toHaveLength(15);
    for (const tool of lista.tools) {
      expect(tool.title, tool.name).toBeTruthy();
      const propriedades = ((tool.inputSchema as { properties?: Record<string, { description?: string }> }).properties) ?? {};
      for (const [campo, propriedade] of Object.entries(propriedades)) {
        expect(propriedade.description, `${tool.name}.${campo}`).toBeTruthy();
      }
    }
    for (const nome of ["ocupacao_comparar", "ocupacao_similares", "cbo_resumir_grupo"]) {
      const tool = lista.tools.find((item) => item.name === nome);
      const dimensao = (tool?.inputSchema as { properties: { dimensao: { enum?: string[] } } }).properties.dimensao;
      expect(dimensao.enum).toEqual(["habilidades", "atitudes", "conhecimentos", "conhecimentos-i", "conhecimentos-ii"]);
    }
  });
});

describe("T4 sentido da diferença", () => {
  async function diferenca(codigos: string[], termo: string) {
    const { resultado } = await chamar("ocupacao_comparar", { codigos, dimensao: "habilidades" });
    const corpo = resultado.structuredContent as {
      metodo?: string;
      resultado: { em_comum: { codigo: string; diferenca: { de: string; para: string; importancia: number }; graus: { codigo: string }[] }[] };
    };
    const item = corpo.resultado.em_comum.find((linha) => linha.codigo === termo);
    return { item, metodo: corpo.metodo };
  }

  it("mede destino menos origem e acompanha a ordem pedida", async () => {
    const programacao = await diferenca(["212420", "212405"], "02.02.02");
    const analise = await diferenca(["212420", "212405"], "02.02.01");
    expect(programacao.item?.diferenca).toMatchObject({ de: "212420", para: "212405", importancia: 3 });
    expect(analise.item?.diferenca.importancia).toBe(2);
    expect(programacao.item?.graus.map((grau) => grau.codigo)).toEqual(["212420", "212405"]);
    expect(programacao.metodo).toMatch(/destino menos origem/);
    const invertida = await diferenca(["212405", "212420"], "02.02.02");
    expect(invertida.item?.diferenca.importancia).toBe(-3);
  });
});

describe("T3 tamanho das respostas", () => {
  it("qbq_competencias de 212405 fica abaixo de 15 KB e avisa o corte", async () => {
    const { resultado, blocos } = await chamar("qbq_competencias", { codigo: "212405" });
    const corpo = resultado.structuredContent as {
      avisos: { mensagem: string }[];
      resultado: { truncado?: boolean; habilidades: { itens: Record<string, unknown>[] } };
    };
    expect(Buffer.byteLength(blocos[1].text)).toBeLessThan(15 * 1024);
    expect(corpo.resultado.truncado).toBe(true);
    expect(corpo.avisos.some((aviso) => aviso.mensagem.includes("restante"))).toBe(true);
    expect(corpo.resultado.habilidades.itens[0]).not.toHaveProperty("caminho");
    const cheia = competencias("212405", { dimensao: "habilidades", incluirConceitos: true, limite: 5 });
    const item = (cheia.dados as { habilidades: { itens: { caminho: unknown[] }[] } }).habilidades.itens[0];
    expect(item.caminho.length).toBeGreaterThan(0);
  });

  it("ocupacao_comparar fica abaixo de 8 KB e informa os 42 termos em comum", async () => {
    const { resultado, blocos } = await chamar("ocupacao_comparar", { codigos: ["212420", "212405"], dimensao: "habilidades" });
    const corpo = resultado.structuredContent as { resultado: { total_em_comum: number; truncado?: boolean }; avisos: { mensagem: string }[] };
    expect(Buffer.byteLength(blocos[1].text)).toBeLessThan(8 * 1024);
    expect(corpo.resultado.total_em_comum).toBe(42);
    expect(corpo.resultado.truncado).toBe(true);
    expect(corpo.avisos.some((aviso) => aviso.mensagem.includes("42") && aviso.mensagem.includes("restante"))).toBe(true);
  });
});

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
