import { criarServidor } from "@/mcp/servidor";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function atender(req: Request) {
  const servidor = criarServidor();
  const transporte = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await servidor.connect(transporte);
  try {
    return await transporte.handleRequest(req);
  } finally {
    await servidor.close();
  }
}

export function GET(req: Request) {
  return atender(req);
}

export function POST(req: Request) {
  return atender(req);
}

export function DELETE(req: Request) {
  return atender(req);
}
