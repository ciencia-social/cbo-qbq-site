import { um } from "@/dados/banco";
import { casaPorPrefixo } from "@/texto";

let tokenchars: Set<string> | undefined;

/** Pontuação que o banco indexou como parte da palavra (meta.fts_tokenchars). */
function caracteresDePalavra(): Set<string> {
  if (!tokenchars) {
    const linha = um<{ valor: string }>("SELECT valor FROM meta WHERE chave = 'fts_tokenchars'");
    tokenchars = new Set(linha?.valor ?? "");
  }
  return tokenchars;
}

/**
 * Expressão FTS5 equivalente a textoCasa: cada termo é uma palavra inteira, separada só por espaço,
 * e o último casa por prefixo quando tem 3 caracteres ou mais.
 * Devolve null quando algum termo tem um caractere que não ocorre no texto indexado: nada casa.
 */
export function expressaoFts(termos: string[]): string | null {
  if (!termos.length) return null;
  const permitidos = caracteresDePalavra();
  const partes: string[] = [];
  for (const [indice, termo] of termos.entries()) {
    for (const caractere of termo) {
      if (!/[\p{L}\p{N}]/u.test(caractere) && !permitidos.has(caractere)) return null;
    }
    const citado = `"${termo.replaceAll('"', '""')}"`;
    partes.push(casaPorPrefixo(termos, indice) ? `${citado}*` : citado);
  }
  return partes.join(" AND ");
}
