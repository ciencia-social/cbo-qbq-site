import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { carregarIndice, vocabularioExiste } from "@/site/competencias";
import { PaginaIndice } from "@/site/competencias-view";

export const metadata: Metadata = { title: "Competências" };

export default async function Page({ params }: { params: Promise<{ vocabulario: string }> }) {
  const { vocabulario } = await params;
  const id = decodeURIComponent(vocabulario);
  if (!vocabularioExiste(id)) notFound();
  return <PaginaIndice vista={carregarIndice(id)} />;
}
