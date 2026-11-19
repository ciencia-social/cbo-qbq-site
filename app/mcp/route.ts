import { esperaDoLimite, problemaDeLimite } from "@/http/limite";
import { criarServidor } from "@/mcp/servidor";
import { linkSignposting } from "@/signposting";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 429 com corpo JSON-RPC: o pedido não foi lido, então o id é null. */
function respostaDeLimite(espera: number) {
  const problema = problemaDeLimite(espera);
  const corpo = {
    jsonrpc: "2.0",
    error: { code: -32000, message: `${problema.detalhe} ${problema.dica ?? ""}`.trim(), data: problema.corpo() },
    id: null,
  };
  return new Response(JSON.stringify(corpo), {
    status: 429,
    headers: { "content-type": "application/json; charset=utf-8", "retry-after": String(espera), "cache-control": "no-store" },
  });
}

async function atender(req: Request) {
  const espera = esperaDoLimite(req.headers);
  if (espera > 0) return respostaDeLimite(espera);
  const servidor = criarServidor();
  const transporte = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await servidor.connect(transporte);
  try {
    const resposta = await transporte.handleRequest(req);
    const headers = new Headers(resposta.headers);
    headers.set("link", linkSignposting("software"));
    return new Response(resposta.body, { status: resposta.status, statusText: resposta.statusText, headers });
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
