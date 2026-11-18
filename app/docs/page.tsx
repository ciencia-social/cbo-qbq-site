import type { Metadata } from "next";
import { PaginaDocs } from "@/site/docs-view";

export const metadata: Metadata = { title: "Documentação da API" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const bruto = await searchParams;
  const q = bruto.q;
  return <PaginaDocs q={Array.isArray(q) ? q[0] : q} />;
}
