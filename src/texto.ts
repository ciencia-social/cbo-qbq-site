/** Busca: ignora caixa e acento, preserva os tokens. */
export function normalizarBusca(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** A mesma normalização do pipeline, para comparar títulos entre camadas. */
export function normalizarTitulo(valor: string): string {
  const base = valor.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return base.replace(/[^a-z0-9]+/g, " ").trim();
}

export function termosDaConsulta(consulta: string): string[] {
  return normalizarBusca(consulta).split(" ").filter(Boolean);
}

/** Último termo com menos letras que isto casa a palavra inteira, não o prefixo. */
export const PREFIXO_MINIMO = 3;

/** O termo de índice `indice` casa por prefixo? Só o último, e só com 3 caracteres ou mais. */
export function casaPorPrefixo(termos: string[], indice: number): boolean {
  return indice === termos.length - 1 && termos[indice].length >= PREFIXO_MINIMO;
}

/**
 * Palavras são separadas só por espaço; pontuação faz parte da palavra.
 * Todos os termos casam como palavra inteira; o último casa por prefixo se tiver 3 caracteres ou mais.
 */
export function textoCasa(texto: string, termos: string[]): boolean {
  if (termos.length === 0) return false;
  const palavras = normalizarBusca(texto).split(" ").filter(Boolean);
  return termos.every((termo, indice) => {
    const prefixo = casaPorPrefixo(termos, indice);
    return palavras.some((palavra) => (prefixo ? palavra.startsWith(termo) : palavra === termo));
  });
}

export function trecho(original: string, termos: string[], raio = 70): string {
  const re = /\p{L}[\p{L}\p{N}]*/gu;
  let encontrado = re.exec(original);
  let indice = -1;
  while (encontrado) {
    const palavra = normalizarBusca(encontrado[0]);
    const casa = termos.some((termo, i) => (casaPorPrefixo(termos, i) ? palavra.startsWith(termo) : palavra === termo));
    if (casa) {
      indice = encontrado.index;
      break;
    }
    encontrado = re.exec(original);
  }
  if (indice < 0) return original.slice(0, raio * 2);
  const inicio = Math.max(0, indice - raio);
  const fim = Math.min(original.length, indice + raio);
  const pedaco = original.slice(inicio, fim).trim();
  return `${inicio > 0 ? "…" : ""}${pedaco}${fim < original.length ? "…" : ""}`;
}

/** Segmento 90 ou 99: o conteúdo real está na descrição da linha (D009). */
export function ehBalde(codigo: string): boolean {
  return codigo.split(".").some((segmento) => segmento === "90" || segmento === "99");
}

/** O literal "NULL" da planilha não é texto (pendência 10.1.1). */
export function textoIndexavel(valor: string | null | undefined): string {
  if (!valor || valor === "NULL") return "";
  return valor;
}
