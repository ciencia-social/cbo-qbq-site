import type { Metadata } from "next";
import { carregarSobre } from "@/site/sobre";
import { PaginaSobre } from "@/site/sobre-view";

export const metadata: Metadata = { title: "Sobre os dados" };

export default function Page() {
  return <PaginaSobre vista={carregarSobre()} />;
}
