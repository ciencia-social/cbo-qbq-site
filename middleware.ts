import { NextResponse, type NextRequest } from "next/server";

/**
 * Repassa o caminho pedido num cabeçalho, para as páginas not-found por segmento
 * mostrarem o ancestral e os vizinhos do código que não existe (I9).
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-cbo-caminho", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/ocupacoes/:codigo", "/competencias/:vocabulario", "/competencias/:vocabulario/:nivel/:codigo"],
};
