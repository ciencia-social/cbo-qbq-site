import type { Metadata } from "next";
import { carregarRota, listarRotas } from "@/site/docs";
import { PaginaRota } from "@/site/docs-view";

export async function generateMetadata({ params }: { params: Promise<{ rota: string[] }> }): Promise<Metadata> {
  const { rota } = await params;
  const vista = carregarRota(rota.join("/"));
  if (vista.tipo !== "ok") return { title: "Documentação" };
  return { title: `${vista.id} · ${vista.resumo}` };
}

export default async function Page({ params }: { params: Promise<{ rota: string[] }> }) {
  const { rota } = await params;
  const vista = carregarRota(rota.join("/"));
  return <PaginaRota rota={vista} irmas={listarRotas()} />;
}
