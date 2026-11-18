import type { Metadata } from "next";
import { carregarIndice } from "@/site/competencias";
import { PaginaIndice } from "@/site/competencias-view";

export const metadata: Metadata = { title: "Competências" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const bruto = await searchParams;
  const ler = (nome: string) => {
    const valor = bruto[nome];
    return Array.isArray(valor) ? valor[0] : valor;
  };
  return <PaginaIndice vista={carregarIndice(ler("vocab"), ler("q"))} />;
}
