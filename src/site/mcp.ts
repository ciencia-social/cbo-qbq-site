import { definicoes, INSTRUCOES } from "@/mcp/executar";

export const CLIENTES = [
  { id: "code", label: "Claude Code", icon: "terminal", lang: "bash", arquivo: "terminal", codigo: "claude mcp add --transport http cbo-qbq https://cbo.ciencia.social/mcp", nota: "Confira com claude mcp list. As tools aparecem com o prefixo do servidor." },
  { id: "claude", label: "Claude (app e web)", icon: "message-square", lang: "text", arquivo: "URL do conector", codigo: "https://cbo.ciencia.social/mcp", nota: "Sem autenticação. Depois de adicionar, ative o conector na conversa." },
  { id: "cursor", label: "Cursor", icon: "code", lang: "json", arquivo: ".cursor/mcp.json", codigo: '{\n  "mcpServers": {\n    "cbo-qbq": {\n      "url": "https://cbo.ciencia.social/mcp"\n    }\n  }\n}', nota: "Para valer em todos os projetos, use o arquivo global de configuração MCP do Cursor." },
  { id: "vscode", label: "VS Code", icon: "code", lang: "json", arquivo: ".vscode/mcp.json", codigo: '{\n  "servers": {\n    "cbo-qbq": {\n      "type": "http",\n      "url": "https://cbo.ciencia.social/mcp"\n    }\n  }\n}', nota: "As tools ficam disponíveis no modo agente do chat." },
  { id: "local", label: "Local (stdio)", icon: "server", lang: "json", arquivo: "configuração do cliente", codigo: '{\n  "mcpServers": {\n    "cbo-qbq": {\n      "command": "[COMANDO]",\n      "args": ["[PACOTE DO SERVIDOR]"]\n    }\n  }\n}', nota: "O pacote ainda não foi publicado. Os campos entre colchetes serão preenchidos na release." },
] as const;

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
  const tools = definicoes.map(([nome, descricao, forma]) => {
    const mapa = REST[nome] ?? { rotas: "sem rota única", grupo: "exploracao" as const };
    return {
      nome,
      descricao,
      rotas: mapa.rotas,
      grupo: mapa.grupo,
      natureza: mapa.grupo === "derivado" ? "derivado" : "oficial",
      argumentos: Object.keys(forma),
    };
  });
  return {
    instrucoes: INSTRUCOES.split(/(?<=\.)\s+/),
    grupo: filtro,
    tools: tools.filter((tool) => filtro === "todas" || tool.grupo === filtro),
    total: tools.length,
  };
}
