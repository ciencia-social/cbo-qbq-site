import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { definicoes, executarTool, INSTRUCOES, somenteLeitura, textoMcp } from "@/mcp/executar";
import { Problema } from "@/http/erros";

export function criarServidor() {
  const servidor = new McpServer({ name: "cbo-qbq", version: "0.1.0" }, { instructions: INSTRUCOES });
  for (const ferramenta of definicoes) {
    servidor.registerTool(
      ferramenta.nome,
      { title: ferramenta.title, description: ferramenta.descricao, inputSchema: ferramenta.schema, annotations: somenteLeitura },
      async (args: Record<string, unknown>) => {
        try {
          const resultado = executarTool(ferramenta.nome, args as Record<string, unknown>);
          return {
            content: [
              { type: "text" as const, text: resultado.texto },
              { type: "text" as const, text: JSON.stringify(resultado.dados) },
            ],
            structuredContent: resultado.dados,
          };
        } catch (erro) {
          const mensagem = erro instanceof Problema ? textoMcp(`${erro.detalhe} ${erro.dica ?? ""}`.trim()) : "A consulta falhou.";
          return { isError: true as const, content: [{ type: "text" as const, text: mensagem }] };
        }
      },
    );
  }
  servidor.server.registerCapabilities({ tools: { listChanged: false } });
  return servidor;
}
