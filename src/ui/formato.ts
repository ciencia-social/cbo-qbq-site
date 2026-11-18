const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export type FormatoNumero = "percent" | "number" | ((valor: number) => string);

/** Vírgula decimal e ponto de milhar. Ausente vira s/d. */
export function formato(valor: number | null | undefined, format?: FormatoNumero) {
  if (valor == null || Number.isNaN(valor)) return "s/d";
  if (typeof format === "function") return format(valor);
  return NUMERO.format(valor) + (format === "percent" ? "%" : "");
}

export function tresCasas(valor: number) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(valor);
}
