import { VERSAO_DADOS } from "@/versao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    api: "/v1",
    mcp: "/mcp",
    llms: "/llms.txt",
    versao_dados: VERSAO_DADOS,
  });
}
