import { PaginaTermo } from "@/site/competencias-view";
import { segmentosDoPedido } from "@/site/caminho";
import { VOCABULARIOS } from "@/tipos";

/** 404 do índice: o vocabulário pedido não existe. Lista os quatro. */
export default async function NaoEncontrado() {
  const [, vocabulario = ""] = await segmentosDoPedido();
  return (
    <PaginaTermo
      ficha={{
        tipo: "ausente",
        detalhe: `Não há vocabulário ${vocabulario || "com esse nome"}. O QBQ tem quatro.`,
        sugestoes: VOCABULARIOS.map((id) => ({ href: `/competencias/${id}`, rotulo: id })),
      }}
    />
  );
}
