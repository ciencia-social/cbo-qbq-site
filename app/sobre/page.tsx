import type { Metadata } from "next";
import { carregarSobre } from "@/site/sobre";
import { PaginaSobre } from "@/site/sobre-view";
import { jsonLdDataset, scriptJsonLd } from "@/site/jsonld";

export const metadata: Metadata = { title: "Sobre os dados" };

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJsonLd(jsonLdDataset()) }} />
      <PaginaSobre vista={carregarSobre()} />
    </>
  );
}
