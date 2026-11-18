import type { Metadata } from "next";
import { PaginaMcp } from "@/site/mcp-view";

export const metadata: Metadata = { title: "Servidor MCP" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const bruto = await searchParams;
  const grupo = bruto.grupo;
  return <PaginaMcp grupo={Array.isArray(grupo) ? grupo[0] : grupo} />;
}
