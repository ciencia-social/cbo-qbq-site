import type { Metadata } from "next";
import { carregarInicio } from "@/site/inicio";
import { PaginaInicio } from "@/site/inicio-view";
import { jsonLdDataset, scriptJsonLd } from "@/site/jsonld";

export const metadata: Metadata = { title: { absolute: "CBO e QBQ em dados abertos" } };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const bruto = await searchParams;
  const exemplo = bruto.exemplo;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJsonLd(jsonLdDataset()) }} />
      <PaginaInicio vista={carregarInicio()} exemplo={Array.isArray(exemplo) ? exemplo[0] : exemplo} />
    </>
  );
}
