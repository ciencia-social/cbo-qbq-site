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

function pedidoDePagina(req: Request) {
  const accept = req.headers.get("accept") ?? "";
  if (!accept.includes("text/html")) return false;
  if (req.headers.get("mcp-session-id") || req.headers.get("mcp-protocol-version")) return false;
  return true;
}

export function GET(req: Request) {
  if (pedidoDePagina(req)) {
    return new Response(null, { status: 307, headers: { location: "/docs/mcp" } });
  }
  if ((req.headers.get("accept") ?? "").includes("text/event-stream")) {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }
  return atender(req);
}

export function POST(req: Request) {
  return atender(req);
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}
