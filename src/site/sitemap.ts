import { todos } from "@/dados/banco";
import { VOCABULARIOS } from "@/tipos";
import { SITE } from "@/versao";

/**
 * S5: páginas fixas, um vocabulário de competências por página e uma ficha por ocupação do
 * universo (CBO e QBQ juntos: 2.694 da CBO e 4 só do QBQ). Código inexistente fica fora (I9).
 */
export function entradasSitemap(): { url: string; changeFrequency: "monthly"; priority: number }[] {
  const fixas = ["", "/ocupacoes", "/competencias", "/docs", "/docs/mcp", "/sobre"];
  const vocabularios = VOCABULARIOS.map((vocabulario) => `/competencias/${vocabulario}`);
  const ocupacoes = todos<{ codigo: string }>("SELECT codigo FROM ocupacao ORDER BY codigo").map((linha) => `/ocupacoes/${linha.codigo}`);
  return [
    ...fixas.map((caminho) => ({ url: `${SITE}${caminho}`, changeFrequency: "monthly" as const, priority: caminho === "" ? 1 : 0.8 })),
    ...vocabularios.map((caminho) => ({ url: `${SITE}${caminho}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...ocupacoes.map((caminho) => ({ url: `${SITE}${caminho}`, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
