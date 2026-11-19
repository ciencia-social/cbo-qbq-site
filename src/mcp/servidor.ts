import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { definicoes, executarTool, INSTRUCOES, somenteLeitura, textoMcp } from "@/mcp/executar";
import { Problema } from "@/http/erros";
import { registrarPrompts } from "@/mcp/prompts";
import { registrarRecursos } from "@/mcp/recursos";
import { VERSAO_SERVICO } from "@/versao";

export function criarServidor() {
  const servidor = new McpServer({ name: "cbo-qbq", version: VERSAO_SERVICO }, { instructions: INSTRUCOES });
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
  registrarRecursos(servidor);
  registrarPrompts(servidor);
  servidor.server.registerCapabilities({
    tools: { listChanged: false },
    resources: { listChanged: false },
    prompts: { listChanged: false },
  });
  return servidor;
}
