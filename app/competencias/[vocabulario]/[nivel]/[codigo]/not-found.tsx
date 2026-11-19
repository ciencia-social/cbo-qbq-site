import { carregarTermo } from "@/site/competencias";
import { PaginaTermo } from "@/site/competencias-view";
import { segmentosDoPedido } from "@/site/caminho";

/** 404 do termo: aponta o mesmo código em outros níveis e o índice do vocabulário. */
export default async function NaoEncontrado() {
  const [, vocabulario = "", nivel = "", codigo = ""] = await segmentosDoPedido();
  const ficha = carregarTermo(vocabulario, nivel, codigo);
  if (ficha.tipo === "ausente") return <PaginaTermo ficha={ficha} />;
  return <PaginaTermo ficha={{ tipo: "ausente", detalhe: "Este termo não existe.", sugestoes: [{ href: "/competencias", rotulo: "Vocabulários do QBQ" }] }} />;
}
