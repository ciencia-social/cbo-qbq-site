import type { Metadata } from "next";
import { carregarOcupacoes } from "@/site/ocupacoes";
import { PaginaOcupacoes } from "@/site/ocupacoes-view";

export const metadata: Metadata = { title: "Ocupações" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const bruto = await searchParams;
  const params = Object.fromEntries(Object.entries(bruto).map(([chave, valor]) => [chave, Array.isArray(valor) ? valor[0] : valor]));
  return <PaginaOcupacoes vista={carregarOcupacoes(params)} />;
}
