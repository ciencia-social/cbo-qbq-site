import { describe, expect, it } from "vitest";
import { tratar } from "@/http/dispatcher";
import { esquemaDeDados } from "@/http/openapi";
import { ConsultaRota, P, type Parametro } from "@/http/parametros";
import { documentoOpenApi, rotas, type Rota } from "@/http/rotas";

type Operacao = { parameters: { name: string; in: string }[]; tags: string[] };
type Documento = {
  openapi: string;
  servers: { url: string }[];
  tags: { name: string }[];
  paths: Record<string, { get: Operacao }>;
  components: { schemas: Record<string, unknown> };
};

const documento = documentoOpenApi() as unknown as Documento;

/** Valores de caminho que existem, para a rota responder 200. */
function caminhoDe(rota: Rota) {
  let caminho = rota.caminho;
  const valores: Record<string, string> = rota.caminho.startsWith("/cbo/:nivel")
    ? { nivel: "familias", codigo: "2124" }
    : rota.caminho.includes(":vocabulario")
      ? { vocabulario: "habilidades", nivel: "habilidades", codigo: "01.03.05" }
      : rota.caminho.includes(":id")
        ? { id: "D015" }
        : { codigo: "212405" };
  for (const [nome, valor] of Object.entries(valores)) caminho = caminho.replace(`:${nome}`, encodeURIComponent(valor));
  return caminho === "/" ? "/api/v1" : `/api/v1${caminho}`;
}

const HIERARQUIA: Record<string, string> = { grande_grupo: "2", subgrupo_principal: "21", subgrupo: "212", familia: "2124", prefixo: "21" };

function amostra(parametro: Parametro): string {
  if (HIERARQUIA[parametro.nome]) return HIERARQUIA[parametro.nome];
  if (parametro.nome === "q") return "dados";
  if (parametro.nome === "codigos") return "212405,212420";
  if (parametro.valores?.length) return parametro.valores[0];
  switch (parametro.tipo) {
    case "integer":
      return String(parametro.padrao ?? parametro.minimo ?? 1);
    case "boolean":
      return "true";
    case "faixa":
      return String(parametro.minimo ?? 1);
    default:
      return "01";
  }
}

async function pedir(url: string) {
  const resposta = await tratar(new Request(`http://localhost${url}`));
  const corpo = await resposta.json();
  return { status: resposta.status, corpo };
}

describe("I6 OpenAPI completo", () => {
  it("todo {param} da URL está declarado como in: path", () => {
    for (const [caminho, item] of Object.entries(documento.paths)) {
      const tokens = [...caminho.matchAll(/\{([^}]+)\}/g)].map((casou) => casou[1]);
      const declarados = item.get.parameters.filter((parametro) => parametro.in === "path").map((parametro) => parametro.name);
      expect(declarados.sort(), caminho).toEqual(tokens.sort());
    }
  });

  it("tem servers, tags por grupo e os esquemas pedidos", () => {
    expect(documento.openapi).toBe("3.1.0");
    expect(documento.servers).toEqual([{ url: "https://cbo.ciencia.social" }]);
    const grupos = [...new Set(rotas.map((rota) => rota.grupo))];
    expect(documento.tags.map((tag) => tag.name)).toEqual(grupos);
    for (const item of Object.values(documento.paths)) expect(item.get.tags).toHaveLength(1);
    for (const nome of ["Envelope", "Meta", "Links", "Problema"]) expect(documento.components.schemas[nome], nome).toBeDefined();
    const comEsquema = new Set(rotas.filter((rota) => esquemaDeDados(rota.caminho)).map((rota) => rota.id));
    expect([...comEsquema].sort()).toEqual(["R02", "R14", "R17", "R20", "R21", "R23", "R24", "R42", "R43"]);
  });

  it("rotas que não paginam não anunciam limite nem deslocamento", () => {
    for (const caminho of ["/versao", "/fontes", "/escalas", "/qbq/vocabularios", "/qbq/niveis", "/cobertura/resumo", "/estatisticas"]) {
      const nomes = documento.paths[`/api/v1${caminho}`].get.parameters.map((parametro) => parametro.name);
      expect(nomes, caminho).not.toContain("limite");
      expect(nomes, caminho).not.toContain("deslocamento");
    }
  });

  it("R20 documenta os 16 filtros e a paginação", () => {
    const nomes = documento.paths["/api/v1/ocupacoes"].get.parameters.map((parametro) => parametro.name);
    for (const nome of [
      "q", "buscar_em", "grande_grupo", "subgrupo_principal", "subgrupo", "familia", "prefixo",
      "nivel_qualificacao", "nivel_conhecimento", "nivel_habilidade", "nivel_atitude",
      "situacao_qbq", "taxonomia_conhecimento", "tem_atividades", "tem_sinonimos", "divergencia",
      "limite", "deslocamento", "ordenar",
    ]) {
      expect(nomes).toContain(nome);
    }
  });
});

describe("I6 só os parâmetros declarados são aceitos", () => {
  it.each(rotas.map((rota) => [rota.id, rota.caminho, rota] as const))("%s %s recusa parâmetro inventado", async (_id, _caminho, rota) => {
    const { status, corpo } = await pedir(`${caminhoDe(rota)}?parametro_inventado=1`);
    expect(status).toBe(400);
    expect(corpo.tipo).toBe("/api/v1/problemas/parametro-desconhecido");
  });

  it.each(rotas.map((rota) => [rota.id, rota.caminho, rota] as const))("%s %s aceita cada parâmetro declarado", async (_id, _caminho, rota) => {
    const base = caminhoDe(rota);
    const obrigatorios = rota.parametros.filter((parametro) => parametro.onde === "query" && parametro.obrigatorio);
    const fixos = new URLSearchParams(obrigatorios.map((parametro) => [parametro.nome, amostra(parametro)]));
    for (const parametro of rota.parametros.filter((item) => item.onde === "query")) {
      const consulta = new URLSearchParams(fixos);
      consulta.set(parametro.nome, amostra(parametro));
      const { status, corpo } = await pedir(`${base}?${consulta.toString()}`);
      expect(status, `${base}?${consulta}`).not.toBe(500);
      expect(corpo.tipo, `${base}?${consulta}`).not.toBe("/api/v1/problemas/parametro-desconhecido");
    }
  });

  it("ler um parâmetro não declarado é erro de programação", () => {
    const consulta = new ConsultaRota("q=x&outro=1", [P.q("Texto.")]);
    expect(consulta.get("q")).toBe("x");
    expect(() => consulta.get("outro")).toThrow(/não declarou/);
  });

  it("o valor passa pela declaração: enum, inteiro e tetos", async () => {
    expect((await pedir("/api/v1/ocupacoes?situacao_qbq=xx")).status).toBe(400);
    expect((await pedir("/api/v1/ocupacoes?limite=101")).status).toBe(400);
    expect((await pedir("/api/v1/ocupacoes?limite=100")).status).toBe(200);
    expect((await pedir("/api/v1/qbq/conceitos?nivel=xx")).status).toBe(400);
  });
});

// Validador mínimo de JSON Schema (type, properties, required, items, enum, anyOf, oneOf, allOf, $ref),
// para conferir que os esquemas publicados descrevem as respostas reais.
function validar(esquema: unknown, valor: unknown, esquemas: Record<string, unknown>, onde = "dados"): string[] {
  const e = esquema as Record<string, unknown>;
  if (!e || typeof e !== "object") return [];
  if (typeof e.$ref === "string") return validar(esquemas[e.$ref.split("/").pop()!], valor, esquemas, onde);
  if (Array.isArray(e.allOf)) return e.allOf.flatMap((parte) => validar(parte, valor, esquemas, onde));
  if (Array.isArray(e.anyOf)) {
    return e.anyOf.some((parte) => validar(parte, valor, esquemas, onde).length === 0) ? [] : [`${onde}: não casa nenhuma alternativa de anyOf`];
  }
  if (Array.isArray(e.oneOf)) {
    const passam = e.oneOf.filter((parte) => validar(parte, valor, esquemas, onde).length === 0);
    return passam.length === 1 ? [] : [`${onde}: casa ${passam.length} alternativas de oneOf`];
  }
  const erros: string[] = [];
  if (e.type) {
    const tipos = Array.isArray(e.type) ? e.type : [e.type];
    const real = valor === null ? "null" : Array.isArray(valor) ? "array" : Number.isInteger(valor) ? "integer" : typeof valor;
    const aceita = tipos.some((tipo) => tipo === real || (tipo === "number" && real === "integer"));
    if (!aceita) return [`${onde}: esperado ${tipos.join("|")}, veio ${real}`];
  }
  if (Array.isArray(e.enum) && !e.enum.includes(valor)) erros.push(`${onde}: fora do enum`);
  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    const registro = valor as Record<string, unknown>;
    for (const campo of (e.required as string[] | undefined) ?? []) if (!(campo in registro)) erros.push(`${onde}.${campo}: ausente`);
    const propriedades = (e.properties as Record<string, unknown> | undefined) ?? {};
    for (const [campo, sub] of Object.entries(propriedades)) {
      if (campo in registro) erros.push(...validar(sub, registro[campo], esquemas, `${onde}.${campo}`));
    }
    if (e.additionalProperties && typeof e.additionalProperties === "object") {
      for (const [campo, item] of Object.entries(registro)) erros.push(...validar(e.additionalProperties, item, esquemas, `${onde}.${campo}`));
    }
  }
  if (Array.isArray(valor) && e.items) valor.forEach((item, i) => erros.push(...validar(e.items, item, esquemas, `${onde}[${i}]`)));
  return erros;
}

describe("I6 esquemas descrevem as respostas reais", () => {
  it.each([
    "/api/v1/versao",
    "/api/v1/cbo/familias/2124?incluir=filhos,caminho",
    "/api/v1/codigos/212405",
    "/api/v1/codigos?codigos=212405,212499,99,abc",
    "/api/v1/ocupacoes?q=programador",
    "/api/v1/ocupacoes?situacao_qbq=ausente_no_qbq",
    "/api/v1/ocupacoes/212405?incluir=sinonimos,atividades,competencias,perfil_ocupacional",
    "/api/v1/ocupacoes/010105",
    "/api/v1/ocupacoes/212405/atividades",
    "/api/v1/ocupacoes/010105/atividades",
    "/api/v1/ocupacoes/212405/competencias",
    "/api/v1/ocupacoes/010105/competencias",
    "/api/v1/qbq/vocabularios/habilidades/habilidades/01.03.05?incluir=uso",
    "/api/v1/qbq/vocabularios/atitudes/01",
    "/api/v1/qbq/vocabularios/habilidades/habilidades/01.03.05/ocupacoes",
  ])("%s", async (url) => {
    const { status, corpo } = await pedir(url);
    expect(status).toBe(200);
    const caminho = new URL(`http://x${url}`).pathname.replace("/api/v1", "");
    const rota = rotas.find((item) => {
      const modelo = item.caminho.split("/").filter(Boolean);
      const partes = caminho.split("/").filter(Boolean);
      return modelo.length === partes.length && modelo.every((parte, i) => parte.startsWith(":") || parte === partes[i]);
    })!;
    const nome = esquemaDeDados(rota.caminho);
    expect(nome).toBeDefined();
    const esquemas = documento.components.schemas;
    expect(validar(esquemas.Envelope, corpo, esquemas, "corpo")).toEqual([]);
    expect(validar(esquemas[nome!], corpo.dados, esquemas)).toEqual([]);
  });
});
