import { PREFIXO_API } from "@/versao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Endereço antigo. O caminho e a consulta seguem para /api/v1. */
export function redirecionar(req: Request) {
  const url = new URL(req.url);
  const resto = url.pathname.replace(/^\/v1(?=\/|$)/, "");
  url.pathname = `${PREFIXO_API}${resto}`;
  return new Response(null, { status: 308, headers: { location: url.toString() } });
}

export const GET = redirecionar;
export const HEAD = redirecionar;
export const OPTIONS = redirecionar;
export const POST = redirecionar;
export const PUT = redirecionar;
export const PATCH = redirecionar;
export const DELETE = redirecionar;
