import type { Metadata } from "next";
import { carregarIndice } from "@/site/competencias";
import { PaginaIndice } from "@/site/competencias-view";

export const metadata: Metadata = { title: "Competências" };

export default async function Page({ params }: { params: Promise<{ vocabulario: string }> }) {
  const { vocabulario } = await params;
  return <PaginaIndice vista={carregarIndice(decodeURIComponent(vocabulario))} />;
}
