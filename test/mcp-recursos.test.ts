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

async function ler(uri: string) {
  const resultado = await cliente.readResource({ uri });
  const conteudo = resultado.contents[0] as { uri: string; mimeType?: string; text: string };
  return conteudo;
}

describe("I13 resources", () => {
  it("anuncia as capacidades de resources e prompts", () => {
    const capacidades = cliente.getServerCapabilities();
    expect(capacidades?.resources).toBeDefined();
    expect(capacidades?.prompts).toBeDefined();
    expect(capacidades?.tools?.listChanged).toBe(false);
  });

  it("resources/list e resources/templates/list cobrem os seis URIs da seção 6.5", async () => {
    const lista = await cliente.listResources();
    const modelos = await cliente.listResourceTemplates();
    const uris = lista.resources.map((item) => item.uri);
    const padroes = modelos.resourceTemplates.map((item) => item.uriTemplate);
    expect(uris).toEqual(expect.arrayContaining(["cboqbq://sobre", "cboqbq://modelo-de-dados", "cboqbq://decisoes"]));
    expect(padroes).toEqual(expect.arrayContaining(["cboqbq://ocupacao/{codigo}", "cboqbq://cbo/{codigo}", "cboqbq://vocabulario/{vocabulario}"]));
    // O vocabulário tem só quatro valores, então eles aparecem também na lista concreta.
    expect(uris).toEqual(expect.arrayContaining(["cboqbq://vocabulario/habilidades", "cboqbq://vocabulario/conhecimentos-i"]));
    const seis = ["sobre", "modelo-de-dados", "decisoes", "ocupacao", "cbo", "vocabulario"];
    const cobertos = new Set([...uris, ...padroes].map((uri) => uri.replace("cboqbq://", "").split("/")[0]));
    for (const nome of seis) expect(cobertos.has(nome), nome).toBe(true);
  });

  it("resources/read de cboqbq://ocupacao/212405 devolve a ficha", async () => {
    const conteudo = await ler("cboqbq://ocupacao/212405");
    expect(conteudo.mimeType).toBe("application/json");
    const corpo = JSON.parse(conteudo.text) as { versao_dados: string; resultado: { codigo: string; caminho: { codigo: string }[]; qbq: { niveis: Record<string, number> } } };
    expect(corpo.resultado.codigo).toBe("212405");
    expect(corpo.resultado.caminho.map((passo) => passo.codigo)).toEqual(["2", "21", "212", "2124"]);
    expect(corpo.resultado.qbq.niveis.qualificacao).toBe(5);
    expect(corpo.versao_dados).toBeTruthy();
  });

  it("lê sobre, modelo de dados, decisões, nó da CBO e vocabulário", async () => {
    const sobre = JSON.parse((await ler("cboqbq://sobre")).text) as { resultado: { dados_commit: string } };
    expect(sobre.resultado.dados_commit).toMatch(/^[0-9a-f]{40}$/);
    const modelo = await ler("cboqbq://modelo-de-dados");
    expect(modelo.mimeType).toBe("text/markdown");
    expect(modelo.text).toContain("# Modelo de dados");
    const decisoes = await ler("cboqbq://decisoes");
    expect(decisoes.text).toContain("D015");
    const no = JSON.parse((await ler("cboqbq://cbo/2124")).text) as { resultado: { codigo: string; filhos: { codigo: string }[] } };
    expect(no.resultado.codigo).toBe("2124");
    expect(no.resultado.filhos.map((filho) => filho.codigo)).toEqual(["212405", "212410", "212415", "212420", "212425", "212430"]);
    const vocabulario = JSON.parse((await ler("cboqbq://vocabulario/habilidades")).text) as { resultado: { codigo: string; filhos: unknown[] }[] };
    expect(vocabulario.resultado).toHaveLength(3);
    expect(vocabulario.resultado[0].filhos.length).toBeGreaterThan(0);
  });

  it("código inexistente responde erro com a dica, sem caminho relativo", async () => {
    await expect(cliente.readResource({ uri: "cboqbq://ocupacao/212499" })).rejects.toThrow(/2124/);
    await expect(cliente.readResource({ uri: "cboqbq://cbo/212405" })).rejects.toThrow(/cboqbq:\/\/ocupacao\/212405/);
  });
});

describe("I13 prompts", () => {
  it("prompts/list devolve os quatro prompts com os argumentos do plano", async () => {
    const { prompts } = await cliente.listPrompts();
    const porNome = Object.fromEntries(prompts.map((prompt) => [prompt.name, (prompt.arguments ?? []).map((argumento) => argumento.name)]));
    expect(porNome).toEqual({
      classificar_vaga: ["texto"],
      perfil_de_ocupacao: ["ocupacao"],
      transicao_de_carreira: ["origem", "destino"],
      panorama_de_grupo: ["codigo"],
    });
  });

  it("prompts/get encadeia as tools da seção 6.5", async () => {
    const vaga = await cliente.getPrompt({ name: "classificar_vaga", arguments: { texto: "Desenvolvedor back-end Node.js" } });
    const texto = (vaga.messages[0].content as { text: string }).text;
    for (const tool of ["ocupacao_buscar", "cbo_buscar_atividades", "ocupacao_obter"]) expect(texto).toContain(tool);
    expect(texto).toContain("Desenvolvedor back-end Node.js");
    const transicao = await cliente.getPrompt({ name: "transicao_de_carreira", arguments: { origem: "212420", destino: "212405" } });
    const roteiro = (transicao.messages[0].content as { text: string }).text;
    expect(roteiro).toContain("ocupacao_comparar");
    expect(roteiro).toContain("qbq_vocabulario");
  });
});
