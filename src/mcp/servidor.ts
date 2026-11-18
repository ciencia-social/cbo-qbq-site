import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { definicoes, executarTool, INSTRUCOES, somenteLeitura } from "@/mcp/executar";
import { Problema } from "@/http/erros";

export function criarServidor() {
  const servidor = new McpServer({ name: "cbo-qbq", version: "0.1.0" }, { instructions: INSTRUCOES });
  for (const [nome, descricao, schema] of definicoes) {
    servidor.registerTool(
      nome,
      { description: descricao, inputSchema: schema, annotations: somenteLeitura },
      async (args: Record<string, unknown>) => {
        try {
          const resultado = executarTool(nome, args as Record<string, unknown>);
          return {
            content: [{ type: "text" as const, text: resultado.texto }],
            structuredContent: resultado.dados,
          };
        } catch (erro) {
          const mensagem = erro instanceof Problema ? `${erro.detalhe} ${erro.dica ?? ""}`.trim() : "A consulta falhou.";
          return { isError: true as const, content: [{ type: "text" as const, text: mensagem }] };
        }
      },
    );
  }
  return servidor;
}
