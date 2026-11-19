import { carregarFicha } from "@/site/ficha";
import { PaginaFicha } from "@/site/ficha-view";
import { segmentosDoPedido } from "@/site/caminho";

/** 404 da ficha: mostra o ancestral que existe e os vizinhos, com links de página. */
export default async function NaoEncontrada() {
  const [, codigo = ""] = await segmentosDoPedido();
  const ficha = carregarFicha(codigo, { transversais: "incluir", dimensao: "habilidades", todas: false });
  if (ficha.tipo === "ausente" || ficha.tipo === "malformado") return <PaginaFicha ficha={ficha} />;
  return <PaginaFicha ficha={{ tipo: "malformado", detalhe: "Esta ocupação não existe.", dica: "Use 212405 ou 2124-05." }} />;
}
