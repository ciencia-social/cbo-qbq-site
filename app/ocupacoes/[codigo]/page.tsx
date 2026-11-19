import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { carregarFicha, type ConsultaFicha } from "@/site/ficha";
import { PaginaFicha } from "@/site/ficha-view";

type Params = { codigo: string };
type Busca = Record<string, string | string[] | undefined>;

function consultaDe(bruto: Busca): ConsultaFicha {
  const ler = (nome: string) => {
    const valor = bruto[nome];
    return Array.isArray(valor) ? valor[0] : valor;
  };
  const transversais = ler("transversais");
  const dimensao = ler("dimensao");
  return {
    transversais: transversais === "excluir" || transversais === "somente" ? transversais : "incluir",
    dimensao: dimensao === "conhecimentos" || dimensao === "atitudes" ? dimensao : "habilidades",
    todas: ler("todas") === "1",
    comparar: ler("comparar"),
  };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { codigo } = await params;
  const ficha = carregarFicha(codigo, { transversais: "incluir", dimensao: "habilidades", todas: false });
  if (ficha.tipo !== "ok") return { title: "Ocupação não encontrada" };
  return { title: `${ficha.formatado} · ${ficha.titulo}`, description: ficha.lead ?? ficha.titulo };
}

export default async function Page({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Busca> }) {
  const { codigo } = await params;
  const consulta = consultaDe(await searchParams);
  const ficha = carregarFicha(codigo, consulta);
  if (ficha.tipo === "redirect") {
    const params = new URLSearchParams();
    if (consulta.transversais !== "incluir") params.set("transversais", consulta.transversais);
    if (consulta.dimensao !== "habilidades") params.set("dimensao", consulta.dimensao);
    if (consulta.todas) params.set("todas", "1");
    if (consulta.comparar) params.set("comparar", consulta.comparar);
    const consultaUrl = params.toString();
    redirect(consultaUrl ? `${ficha.para}?${consultaUrl}` : ficha.para);
  }
  if (ficha.tipo === "ausente" || ficha.tipo === "malformado") notFound();
  return <PaginaFicha ficha={ficha} />;
}
