import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { criarServidor } from "@/mcp/servidor";
import { competencias } from "@/consulta/ocupacao";
import { tratar } from "@/http/dispatcher";

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

/** Lê properties[campo].enum de um inputSchema, conferindo a forma em tempo de execução. */
function enumDe(schema: unknown, campo: string): unknown {
  if (!schema || typeof schema !== "object") return undefined;
  const propriedades: unknown = (schema as Record<string, unknown>).properties;
  if (!propriedades || typeof propriedades !== "object") return undefined;
  const propriedade: unknown = (propriedades as Record<string, unknown>)[campo];
  if (!propriedade || typeof propriedade !== "object") return undefined;
  return (propriedade as Record<string, unknown>).enum;
}

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
      expect(tool, nome).toBeDefined();
      const dimensao = enumDe(tool?.inputSchema, "dimensao");
      expect(dimensao).toEqual(["habilidades", "atitudes", "conhecimentos", "conhecimentos-i", "conhecimentos-ii"]);
    }
  });
});

function linkRelativo(valor: unknown): boolean {
  if (!valor || typeof valor !== "object") return false;
  if (Array.isArray(valor)) return valor.some(linkRelativo);
  for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
    if (chave === "link" && typeof item === "string" && item.startsWith("/")) return true;
    if (linkRelativo(item)) return true;
  }
  return false;
}

describe("T9 HTTP sem sessão", () => {
  it("recusa o fluxo e o DELETE, e mantém o guia em HTML", async () => {
    const { GET, DELETE } = await import("../app/mcp/route");
    const fluxo = await GET(new Request("http://localhost/mcp", { headers: { accept: "text/event-stream" } }));
    expect(fluxo.status).toBe(405);
    expect(fluxo.headers.get("allow")).toBe("POST");
    const pagina = await GET(new Request("http://localhost/mcp", { headers: { accept: "text/html" } }));
    expect(pagina.status).toBe(307);
    expect(pagina.headers.get("location")).toBe("/docs/mcp");
    const apagar = await DELETE();
    expect(apagar.status).toBe(405);
  });

  it("anuncia que a lista de tools não muda", () => {
    expect(cliente.getServerCapabilities()?.tools?.listChanged).toBe(false);
  });
});

describe("T8 avisos do MCP", () => {
  it("a busca vazia tem um aviso só e nenhum link relativo", async () => {
    const { resultado } = await chamar("ocupacao_buscar", { consulta: "xyzqwe" });
    const corpo = resultado.structuredContent as { avisos: { mensagem: string }[] };
    expect(corpo.avisos).toHaveLength(1);
    expect(corpo.avisos[0].mensagem).toContain("cbo_buscar_atividades");
    expect(corpo.avisos[0].mensagem).not.toContain("/api/v1");
    const decodificado = await chamar("codigo_decodificar", { codigos: ["212499"] });
    expect(linkRelativo(decodificado.resultado.structuredContent)).toBe(false);
  });
});

describe("T7 erros de vocabulário", () => {
  async function erro(nome: string, args: Record<string, unknown>) {
    const resultado = await cliente.callTool({ name: nome, arguments: args });
    return (resultado.content as { text: string }[]).map((bloco) => bloco.text).join("\n");
  }

  it("não chama níveis de valores aceitos para codigo", async () => {
    const codigo = await erro("qbq_ocupacoes_por_competencia", { vocabulario: "habilidades", nivel: "habilidades", codigo: "99.99.99" });
    expect(codigo).toMatch(/não existe/);
    expect(codigo).toContain("qbq_buscar_termos");
    expect(codigo).not.toMatch(/valores aceitos para codigo/i);
    const nivel = await erro("qbq_vocabulario", { vocabulario: "habilidades", nivel: "xx", codigo: "01.01.01" });
    expect(nivel).toMatch(/dominios/);
    expect(nivel).toMatch(/categorias/);
    expect(nivel).toMatch(/habilidades/);
    expect(nivel).not.toMatch(/valores aceitos para codigo/i);
  });
});

describe("T6 navegação com código de ocupação", () => {
  it("212405 aponta ocupacao_obter e a família, sem negar o código", async () => {
    const resultado = await cliente.callTool({ name: "cbo_navegar", arguments: { codigo: "212405" } });
    const texto = (resultado.content as { text: string }[]).map((bloco) => bloco.text).join("\n");
    expect(resultado.isError).toBe(true);
    expect(texto).toContain("ocupacao_obter");
    expect(texto).toContain("2124");
    expect(texto).not.toContain("não é um código CBO");
  });
});

describe("T5 total da busca de termos", () => {
  it("direito ambiental conta as descrições de item", async () => {
    const { resultado, blocos } = await chamar("qbq_buscar_termos", {
      consulta: "direito ambiental",
      buscar_em: ["vocabulario", "conceito", "descricao_item"],
    });
    const corpo = resultado.structuredContent as { total: number; resultado: { total_termos: number; total_descricoes_item: number } };
    expect(corpo.total).toBeGreaterThan(0);
    expect(corpo.resultado.total_descricoes_item).toBeGreaterThan(0);
    expect(blocos[0].text).toMatch(new RegExp(`${corpo.resultado.total_termos} termos`));
    expect(blocos[0].text).toMatch(new RegExp(`${corpo.resultado.total_descricoes_item} ocorrências`));
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

function arquivosFonte(valor: unknown, achados: string[] = []): string[] {
  if (!valor || typeof valor !== "object") return achados;
  if (Array.isArray(valor)) {
    for (const item of valor) arquivosFonte(item, achados);
    return achados;
  }
  const registro = valor as Record<string, unknown>;
  for (const [chave, item] of Object.entries(registro)) {
    if ((chave === "fonte" || chave === "fonte_justificativa") && item && typeof item === "object") {
      const fonte = item as { arquivo?: string; cbo?: { arquivo?: string }; qbq?: { arquivo?: string } };
      if (fonte.arquivo) achados.push(fonte.arquivo);
      if (fonte.cbo?.arquivo) achados.push(fonte.cbo.arquivo);
      if (fonte.qbq?.arquivo) achados.push(fonte.qbq.arquivo);
    }
    arquivosFonte(item, achados);
  }
  return achados;
}

describe("T10 caminhos de fonte", () => {
  async function api(caminho: string) {
    const resposta = await tratar(new Request(`http://localhost${caminho}`));
    return { status: resposta.status, corpo: await resposta.json() };
  }

  it("prefixa fontes/ na API e no MCP e marca a aba da competência", async () => {
    const [lista, codigo, atividadesApi, oficiais, habilidadesApi, conhecimentosApi, atitudesApi, conhecimentosIi, habilidadesIi] = await Promise.all([
      api("/api/v1/ocupacoes?limite=1"),
      api("/api/v1/codigos/2124"),
      api("/api/v1/ocupacoes/212405/atividades?modo=resumo"),
      api("/api/v1/fontes"),
      api("/api/v1/ocupacoes/212405/competencias?dimensao=habilidades&limite=1"),
      api("/api/v1/ocupacoes/212405/competencias?dimensao=conhecimentos&limite=1"),
      api("/api/v1/ocupacoes/212405/competencias?dimensao=atitudes&limite=1"),
      api("/api/v1/ocupacoes/111325/competencias?dimensao=conhecimentos&limite=1"),
      api("/api/v1/ocupacoes/111325/competencias?dimensao=habilidades&limite=1"),
    ]);
    for (const resposta of [lista, codigo, atividadesApi, oficiais, habilidadesApi, conhecimentosApi, atitudesApi, conhecimentosIi, habilidadesIi]) {
      expect(resposta.status).toBe(200);
    }
    const arquivosApi = [lista, codigo, atividadesApi, habilidadesApi].flatMap((resposta) => arquivosFonte(resposta.corpo));
    const catalogo = (oficiais.corpo as { dados: { arquivo: string }[] }).dados.map((item) => item.arquivo);
    expect(arquivosApi.length).toBeGreaterThan(0);
    expect([...arquivosApi, ...catalogo].every((arquivo) => arquivo.startsWith("fontes/"))).toBe(true);
    expect((habilidadesApi.corpo as { dados: { habilidades: { itens: { fonte: { aba: string } }[] } } }).dados.habilidades.itens[0].fonte.aba).toBe("Habilidade");
    expect((conhecimentosApi.corpo as { dados: { conhecimentos: { itens: { fonte: { aba: string } }[] } } }).dados.conhecimentos.itens[0].fonte.aba).toBe("Conhecimento I");
    expect((atitudesApi.corpo as { dados: { atitudes: { itens: { fonte: { aba: string } }[] } } }).dados.atitudes.itens[0].fonte.aba).toBe("Atitude");
    expect((conhecimentosIi.corpo as { dados: { conhecimentos: { itens: { fonte: { aba: string } }[] } } }).dados.conhecimentos.itens[0].fonte.aba).toBe("Conhecimento II");
    expect((habilidadesIi.corpo as { dados: { habilidades: { itens: { fonte: { aba: string } }[] } } }).dados.habilidades.itens[0].fonte.aba).toBe("Habilidade");

    const ficha = await chamar("ocupacao_obter", { codigo: "212405" });
    const nav = await chamar("cbo_navegar", { codigo: "2124" });
    const atividades = await chamar("cbo_atividades", { codigo: "212405", modo: "resumo" });
    const competenciasMcp = await chamar("qbq_competencias", { codigo: "212405", limite: 5 });
    const fontes = await chamar("dados_sobre", { topico: "fontes" });
    const arquivosMcp = [ficha, nav, atividades, competenciasMcp].flatMap((chamada) => arquivosFonte(chamada.resultado.structuredContent));
    const listaFontes = (fontes.resultado.structuredContent as { resultado: { arquivo: string }[] }).resultado.map((item) => item.arquivo);
    expect(arquivosMcp.length).toBeGreaterThan(0);
    expect([...arquivosMcp, ...listaFontes].every((arquivo) => arquivo.startsWith("fontes/"))).toBe(true);
    const itens = (competenciasMcp.resultado.structuredContent as {
      resultado: {
        conhecimentos: { itens: { fonte: { aba: string } }[] };
        habilidades: { itens: { fonte: { aba: string } }[] };
        atitudes: { itens: { fonte: { aba: string } }[] };
      };
    }).resultado;
    expect(itens.habilidades.itens[0].fonte.aba).toBe("Habilidade");
    expect(itens.conhecimentos.itens[0].fonte.aba).toBe("Conhecimento I");
    expect(itens.atitudes.itens[0].fonte.aba).toBe("Atitude");
  });
});
