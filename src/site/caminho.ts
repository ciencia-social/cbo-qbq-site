import { headers } from "next/headers";

/** Segmentos do caminho pedido, repassados pelo middleware. Vazio fora das rotas que ele cobre. */
export async function segmentosDoPedido(): Promise<string[]> {
  const caminho = (await headers()).get("x-cbo-caminho") ?? "";
  return caminho
    .split("/")
    .filter(Boolean)
    .map((parte) => {
      try {
        return decodeURIComponent(parte);
      } catch {
        return parte;
      }
    });
}
