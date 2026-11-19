import { describe, expect, it } from "vitest";
import { executarTool } from "@/mcp/executar";
import { tratar } from "@/http/dispatcher";
import { VERSAO_DADOS } from "@/versao";

async function get(caminho: string) {
  const resposta = await tratar(new Request(`http://localhost${caminho}`));
  const tipo = resposta.headers.get("content-type") ?? "";
  const corpo = tipo.includes("json") ? await resposta.json() : await resposta.text();
  return { status: resposta.status, headers: resposta.headers, corpo };
}

describe("gabarito dados-2026.11.2", () => {
  it("expõe a versão em toda resposta e no cabeçalho", async () => {
    const { status, headers, corpo } = await get("/api/v1/ocupacoes?limite=1");
    expect(status).toBe(200);
    expect(headers.get("x-versao-dados")).toBe(VERSAO_DADOS);
    expect(corpo.meta.versao_dados).toBe(VERSAO_DADOS);
    expect(corpo.dados[0].fonte.cbo.arquivo).toBeTruthy();
  });

  it("R60 conta os conjuntos", async () => {
    const { corpo } = await get("/api/v1/estatisticas");
    expect(corpo.dados).toMatchObject({
      grandes_grupos: 10,
      subgrupos_principais: 49,
      subgrupos: 195,
      familias: 626,
      ocupacoes_cbo: 2694,
      sinonimos: 7778,
      areas: 20723,
      atividades: 174296,
      ocupacoes_qbq: 2673,
      conhecimentos: 147041,
      habilidades: 104712,
      atitudes: 7210,
      conceitos: 96,
      nao_classificadas: 52,
      divergencias: 64,
    });
  });

  it("R20 lista 2698 ocupações e as quatro situações", async () => {
    const todas = await get("/api/v1/ocupacoes?limite=1");
    expect(todas.corpo.meta.total).toBe(2698);
    for (const [situacao, total] of [
      ["classificada", 2618],
      ["nao_classificada", 52],
      ["sem_nivel_sem_justificativa", 3],
      ["ausente_no_qbq", 25],
    ] as const) {
      const resposta = await get(`/api/v1/ocupacoes?situacao_qbq=${situacao}&limite=1`);
      expect(resposta.corpo.meta.total).toBe(total);
    }
  });

  it("R21 de 212405 traz caminho, níveis e contagens", async () => {
    const { corpo } = await get("/api/v1/ocupacoes/212405");
    expect(corpo.dados.caminho.map((item: { codigo: string }) => item.codigo)).toEqual(["2", "21", "212", "2124"]);
    expect(corpo.dados.qbq.niveis).toEqual({ conhecimento: 5, habilidade: 5, atitude: 5, qualificacao: 5 });
    expect(corpo.dados.qbq.taxonomia_conhecimento).toBe("conhecimentos-i");
    expect(corpo.dados.contagens).toEqual({
      sinonimos: 10,
      areas: 10,
      atividades: 79,
      conhecimentos: 62,
      habilidades: 46,
      atitudes: 4,
    });
  });

  it("normaliza as formas do código e o zero à esquerda", async () => {
    const a = await get("/api/v1/ocupacoes/2124-05");
    const b = await get("/api/v1/ocupacoes/2124%2005");
    const c = await get("/api/v1/ocupacoes/212405");
    expect(a.corpo.dados.codigo).toBe("212405");
    expect(b.corpo.dados.codigo).toBe("212405");
    expect(c.corpo.dados.codigo).toBe("212405");
    const curto = await get("/api/v1/ocupacoes/10105");
    expect(curto.corpo.dados.codigo).toBe("010105");
    expect(curto.corpo.meta.avisos.some((aviso: { codigo?: string }) => aviso.codigo === "D001")).toBe(true);
  });

  it("R15 da família 2124 devolve as seis ocupações", async () => {
    const { corpo } = await get("/api/v1/cbo/familias/2124/ocupacoes?limite=20");
    expect(corpo.dados.map((item: { codigo: string }) => item.codigo)).toEqual([
      "212405",
      "212410",
      "212415",
      "212420",
      "212425",
      "212430",
    ]);
  });

  it("acha programador e capoteiro", async () => {
    const programador = await get("/api/v1/sinonimos?q=programador&limite=100");
    expect(programador.corpo.meta.total).toBe(17);
    expect(programador.corpo.dados[0].fonte.arquivo).toBeTruthy();
    const capoteiro = await get("/api/v1/sinonimos?q=capoteiro&limite=10");
    expect(capoteiro.corpo.dados.map((item: { codigo: string }) => item.codigo).sort()).toEqual(["765240", "991310"]);
  });

  it("212499 não existe e aponta a família 2124", async () => {
    const unico = await get("/api/v1/codigos/212499");
    expect(unico.status).toBe(404);
    expect(JSON.stringify(unico.corpo)).toContain("2124");
    const lote = await get("/api/v1/codigos?codigos=212499");
    expect(lote.status).toBe(200);
    expect(lote.corpo.dados.itens[0].existe).toBe(false);
    expect(lote.corpo.dados.itens[0].ancestral.codigo).toBe("2124");
  });

  it("distingue ausência de nível e ocupação só do QBQ", async () => {
    const militar = await get("/api/v1/ocupacoes/010105");
    expect(militar.corpo.dados.situacao_qbq).toBe("nao_classificada");
    expect(militar.corpo.dados.justificativa.length).toBeGreaterThan(20);
    const sem = await get("/api/v1/ocupacoes/113005");
    expect(sem.corpo.dados.situacao_qbq).toBe("sem_nivel_sem_justificativa");
    expect(sem.corpo.meta.avisos.some((aviso: { codigo?: string }) => aviso.codigo === "D010")).toBe(true);
    const pedicure = await get("/api/v1/ocupacoes/516140");
    expect(pedicure.corpo.dados.cbo).toBeNull();
    expect(pedicure.corpo.dados.divergencia).toBe("so_qbq");
  });

  it("R50 separa as divergências e mostra 114210", async () => {
    const todas = await get("/api/v1/cobertura?limite=100");
    expect(todas.corpo.meta.total).toBe(64);
    for (const [situacao, total] of [
      ["so_cbo", 25],
      ["so_qbq", 4],
      ["titulo_divergente", 35],
    ] as const) {
      const resposta = await get(`/api/v1/cobertura?situacao=${situacao}&limite=1`);
      expect(resposta.corpo.meta.total).toBe(total);
    }
    const dirigente = (await get("/api/v1/ocupacoes/114210")).corpo.dados;
    expect(dirigente.cbo.titulo).toBe("Dirigente de entidade patronal");
    expect(dirigente.qbq.titulo).toBe("Dirigentes de entidades patronais");
    expect(dirigente.divergencia).toBe("titulo_divergente");
  });

  it("R61 reproduz a distribuição de níveis", async () => {
    const { corpo } = await get("/api/v1/estatisticas/niveis");
    expect(corpo.dados[0].niveis).toEqual({
      "1": 96,
      "2": 869,
      "3": 560,
      "4": 291,
      "5": 82,
      "6": 316,
      "7": 356,
      "8": 48,
    });
    expect(corpo.dados[0].sem_nivel).toBe(55);
  });

  it("R40 conta os vocabulários", async () => {
    const { corpo } = await get("/api/v1/qbq/vocabularios");
    const porId = Object.fromEntries(corpo.dados.map((item: { id: string; niveis: { nivel: string; total: number }[] }) => [item.id, item.niveis]));
    expect(porId["conhecimentos-i"].map((item: { total: number }) => item.total)).toEqual([2, 22, 211, 1446]);
    expect(porId["conhecimentos-ii"].map((item: { total: number }) => item.total)).toEqual([9, 86, 448, 1417]);
    expect(porId.habilidades.map((item: { total: number }) => item.total)).toEqual([3, 12, 87]);
    expect(porId.atitudes.map((item: { total: number }) => item.total)).toEqual([4, 22]);
  });

  it("código de vocabulário ambíguo pede o nível", async () => {
    const sem = await get("/api/v1/qbq/vocabularios/conhecimentos-i/23.01.00");
    expect(sem.status).toBe(400);
    expect(sem.corpo.sugestoes).toEqual(expect.arrayContaining(["campos", "conhecimentos"]));
    const campo = await get("/api/v1/qbq/vocabularios/conhecimentos-i/campos/23.01.00");
    expect(campo.status).toBe(200);
    expect(campo.corpo.dados.descricao).toContain("FINANCEIROS");
  });

  it("BANCO DE DADOS com importância >= 4 tem 29 ocupações", async () => {
    const { corpo } = await get("/api/v1/qbq/vocabularios/conhecimentos-i/conhecimentos/01.01.02/ocupacoes?importancia_min=4&limite=50");
    expect(corpo.meta.total).toBe(29);
    expect(corpo.dados.termo.descricao).toBe("BANCO DE DADOS");
  });

  it("conceito oficial e balde sem conceito", async () => {
    const oral = await get("/api/v1/qbq/vocabularios/habilidades/habilidades/01.01.01");
    expect(oral.corpo.dados.conceito.conceito).toBe(
      "Capacidade desenvolvida de ouvir e compreender informações e ideias apresentadas por meio de palavras faladas e frases.",
    );
    const balde = await get("/api/v1/qbq/vocabularios/habilidades/habilidades/01.90.01");
    expect(balde.corpo.dados.conceito).toBeNull();
    expect(balde.corpo.dados.motivo_conceito.codigo).toBe("D012");
  });

  it("habilidades de 212405 marcam os baldes", async () => {
    const { corpo } = await get("/api/v1/ocupacoes/212405/competencias?dimensao=habilidades&limite=100");
    const baldes = corpo.dados.habilidades.itens.filter((item: { balde: boolean }) => item.balde);
    const codigos = baldes.map((item: { codigo: string }) => item.codigo).sort();
    expect(codigos).toEqual(["01.90.01", "01.90.01", "02.90.01", "03.90.01"]);
    expect(baldes.every((item: { descricao_item: string }) => item.descricao_item)).toBe(true);
    expect(baldes[0].fonte.linha).toBeTypeOf("number");
  });

  it("similares de 212405 seguem o gabarito", async () => {
    const { corpo } = await get("/api/v1/ocupacoes/212405/similares?dimensao=habilidades&escopo=todas&limite=5");
    expect(corpo.dados.termos_origem).toBe(42);
    expect(corpo.dados.similares.map((item: { codigo: string; similaridade: number }) => [item.codigo, item.similaridade])).toEqual([
      ["212415", 0.955],
      ["212420", 0.913],
      ["212410", 0.911],
      ["212310", 0.891],
      ["212315", 0.87],
    ]);
    expect(corpo.meta.derivado).toBe(true);
  });

  it("atividade e item de competência trazem fonte", async () => {
    const perfil = await get("/api/v1/ocupacoes/212405/atividades");
    expect(perfil.corpo.dados.areas[0].fonte.arquivo).toBeTruthy();
    expect(perfil.corpo.dados.areas[0].atividades[0].fonte.linha).toBeTypeOf("number");
    const busca = await get("/api/v1/atividades?q=programar&transversais=excluir&agrupar_por=ocupacao&limite=5");
    expect(busca.status).toBe(200);
    expect(busca.corpo.meta.total).toBeGreaterThan(0);
    expect(busca.corpo.dados[0].fonte.cbo.arquivo).toBeTruthy();
    const tool = executarTool("cbo_buscar_atividades", { consulta: "programar", transversais: "excluir", limite: 5 });
    expect(tool.dados.resultado).toEqual(busca.corpo.dados);
  });

  it("decisão, escala e resumo de cobertura", async () => {
    const decisao = await get("/api/v1/decisoes/D004");
    expect(decisao.status).toBe(200);
    expect(decisao.corpo.dados.id).toBe("D004");
    const escalas = await get("/api/v1/escalas");
    expect(escalas.corpo.dados.niveis).toMatchObject({ minimo: 1, maximo: 8, descritores: null });
    expect(escalas.corpo.dados.graus).toMatchObject({ minimo: 1, maximo: 5, descritores: null });
    const resumo = await get("/api/v1/cobertura/resumo");
    expect(resumo.corpo.dados.por_divergencia).toEqual({ so_cbo: 25, so_qbq: 4, titulo_divergente: 35 });
    const tool = executarTool("cobertura_consultar", {});
    expect(tool.dados.resultado).toEqual(resumo.corpo.dados);
  });

  it("ocupação sem perfil não é 404", async () => {
    const { status, corpo } = await get("/api/v1/ocupacoes/010105/atividades");
    expect(status).toBe(200);
    expect(corpo.dados.areas).toEqual([]);
    expect(corpo.dados.motivo).toMatch(/não descreve/);
  });

  it("código malformado explica o formato", async () => {
    const { status, corpo } = await get("/api/v1/codigos/21240");
    expect(status).toBe(400);
    expect(corpo.dica).toMatch(/6 dígitos|212405/);
  });

  it("OpenAPI 3.1 e ETag", async () => {
    const spec = await get("/api/v1/openapi.json");
    expect(spec.corpo.openapi).toBe("3.1.0");
    expect(spec.corpo.paths["/api/v1/ocupacoes"]).toBeTruthy();
    const deNovo = await tratar(new Request("http://localhost/api/v1/versao", { headers: { "if-none-match": spec.headers.get("etag")! } }));
    expect(deNovo.status).not.toBe(304);
    const versao = await get("/api/v1/versao");
    const condicional = await tratar(new Request("http://localhost/api/v1/versao", { headers: { "if-none-match": versao.headers.get("etag")! } }));
    expect(condicional.status).toBe(304);
  });

  it("tools devolvem os mesmos valores da rota", async () => {
    const ficha = executarTool("ocupacao_obter", { codigo: "2124-05" });
    const rest = await get("/api/v1/ocupacoes/212405");
    expect((ficha.dados.resultado as { contagens: unknown }).contagens).toEqual(rest.corpo.dados.contagens);
    const similares = executarTool("ocupacao_similares", { codigo: "212405", limite: 5 });
    expect((similares.dados.resultado as { similares: { codigo: string }[] }).similares[0].codigo).toBe("212415");
    const decodificado = executarTool("codigo_decodificar", { codigos: ["212499"] });
    expect((decodificado.dados.resultado as { itens: { ancestral: { codigo: string } }[] }).itens[0].ancestral.codigo).toBe("2124");
    const grupo = executarTool("cbo_resumir_grupo", { codigo: "2124", limite: 5 });
    expect(grupo.dados.derivado).toBe(true);
    const banco = executarTool("qbq_ocupacoes_por_competencia", {
      vocabulario: "conhecimentos-i",
      nivel: "conhecimentos",
      codigo: "01.01.02",
      importancia_min: 4,
      limite: 50,
    });
    expect(banco.dados.total).toBe(29);
  });

  it("MCP HTTP anuncia o servidor e as tools", async () => {
    const { POST } = await import("../app/mcp/route");
    const pedido = (method: string, params?: unknown) =>
      POST(
        new Request("http://localhost/mcp", {
          method: "POST",
          headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        }),
      );
    const inicio = await pedido("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "teste", version: "0" },
    });
    expect(inicio.status).toBe(200);
    const aberto = await inicio.json();
    expect(aberto.result.serverInfo.name).toBe("cbo-qbq");
    expect(aberto.result.instructions).toMatch(/CBO e QBQ são fontes distintas/);
    const lista = await pedido("tools/list", {});
    expect(lista.status).toBe(200);
    const tools = (await lista.json()).result.tools as { name: string; annotations: { readOnlyHint: boolean } }[];
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "ocupacao_buscar",
        "ocupacao_obter",
        "cbo_atividades",
        "qbq_competencias",
        "cbo_navegar",
        "codigo_decodificar",
        "qbq_vocabulario",
        "dados_sobre",
        "cbo_buscar_atividades",
        "qbq_buscar_termos",
        "qbq_ocupacoes_por_competencia",
        "ocupacao_comparar",
        "ocupacao_similares",
        "cbo_resumir_grupo",
        "cobertura_consultar",
      ]),
    );
    expect(tools.every((tool) => tool.annotations.readOnlyHint)).toBe(true);
  });

  it("redireciona /v1 para /api/v1 e manda o navegador do MCP ao guia", async () => {
    const { GET } = await import("../app/v1/[[...caminho]]/route");
    const resposta = await GET(new Request("http://localhost/v1/ocupacoes/212405?limite=1"));
    expect(resposta.status).toBe(308);
    expect(resposta.headers.get("location")).toBe("http://localhost/api/v1/ocupacoes/212405?limite=1");
    const indice = await GET(new Request("http://localhost/v1"));
    expect(indice.headers.get("location")).toBe("http://localhost/api/v1");
    const { GET: mcp } = await import("../app/mcp/route");
    const pagina = await mcp(new Request("http://localhost/mcp", { headers: { accept: "text/html" } }));
    expect(pagina.status).toBe(307);
    expect(pagina.headers.get("location")).toBe("/docs/mcp");
  });
});
