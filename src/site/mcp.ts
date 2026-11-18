import { definicoes, INSTRUCOES } from "@/mcp/executar";
import { CLIENTES } from "@/site/mcp-clientes";

export { CLIENTES };

const REST: Record<string, { rotas: string; grupo: "nucleo" | "exploracao" | "derivado" }> = {
  ocupacao_buscar: { rotas: "R20, R31", grupo: "nucleo" },
  ocupacao_obter: { rotas: "R21", grupo: "nucleo" },
  cbo_atividades: { rotas: "R23", grupo: "nucleo" },
  qbq_competencias: { rotas: "R24", grupo: "nucleo" },
  cbo_navegar: { rotas: "R14, R16", grupo: "nucleo" },
  codigo_decodificar: { rotas: "R17", grupo: "nucleo" },
  qbq_vocabulario: { rotas: "R40 a R42", grupo: "nucleo" },
  dados_sobre: { rotas: "R02 a R04", grupo: "nucleo" },
  cbo_buscar_atividades: { rotas: "R32", grupo: "exploracao" },
  qbq_buscar_termos: { rotas: "R41, R44, R45", grupo: "exploracao" },
  qbq_ocupacoes_por_competencia: { rotas: "R43", grupo: "exploracao" },
  cobertura_consultar: { rotas: "R46, R50, R51", grupo: "exploracao" },
  ocupacao_comparar: { rotas: "R26", grupo: "derivado" },
  ocupacao_similares: { rotas: "R25", grupo: "derivado" },
  cbo_resumir_grupo: { rotas: "R18, R61, R62", grupo: "derivado" },
};

export function carregarMcp(grupo?: string) {
  const filtro = grupo === "nucleo" || grupo === "exploracao" || grupo === "derivado" ? grupo : "todas";
  const tools = definicoes.map((ferramenta) => {
    const mapa = REST[ferramenta.nome] ?? { rotas: "sem rota única", grupo: "exploracao" as const };
    return {
      nome: ferramenta.nome,
      descricao: ferramenta.descricao,
      rotas: mapa.rotas,
      grupo: mapa.grupo,
      natureza: mapa.grupo === "derivado" ? "derivado" : "oficial",
      argumentos: Object.keys(ferramenta.schema),
    };
  });
  return {
    instrucoes: INSTRUCOES.split(/(?<=\.)\s+/),
    grupo: filtro,
    tools: tools.filter((tool) => filtro === "todas" || tool.grupo === filtro),
    total: tools.length,
  };
}
