import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { carregarTermo } from "@/site/competencias";
import { PaginaTermo } from "@/site/competencias-view";

type Params = { vocabulario: string; nivel: string; codigo: string };

function numero(valor: string | undefined) {
  if (!valor) return undefined;
  const lido = Number(valor);
  return Number.isFinite(lido) ? lido : undefined;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { vocabulario, nivel, codigo } = await params;
  const ficha = carregarTermo(decodeURIComponent(vocabulario), decodeURIComponent(nivel), decodeURIComponent(codigo));
  if (ficha.tipo !== "ok") return { title: "Termo não encontrado" };
  return { title: ficha.descricao };
}

export default async function Page({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { vocabulario, nivel, codigo } = await params;
  const bruto = await searchParams;
  const ler = (nome: string) => {
    const valor = bruto[nome];
    return Array.isArray(valor) ? valor[0] : valor;
  };
  const ficha = carregarTermo(decodeURIComponent(vocabulario), decodeURIComponent(nivel), decodeURIComponent(codigo), {
    importanciaMin: numero(ler("importancia_min")),
    prefixo: ler("prefixo"),
    todas: ler("todas") === "1",
    deslocamento: numero(ler("deslocamento")),
  });
  if (ficha.tipo === "ausente") notFound();
  return <PaginaTermo ficha={ficha} />;
}
