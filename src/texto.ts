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

/** Todos os termos casam como palavra; o último casa por prefixo. */
export function textoCasa(texto: string, termos: string[]): boolean {
  if (termos.length === 0) return false;
  const palavras = normalizarBusca(texto).split(" ").filter(Boolean);
  return termos.every((termo, indice) => {
    const prefixo = indice === termos.length - 1;
    return palavras.some((palavra) => (prefixo ? palavra.startsWith(termo) : palavra === termo));
  });
}

export function trecho(original: string, termos: string[], raio = 70): string {
  const re = /\p{L}[\p{L}\p{N}]*/gu;
  let encontrado = re.exec(original);
  let indice = -1;
  while (encontrado) {
    const palavra = normalizarBusca(encontrado[0]);
    const casa = termos.some((termo, i) =>
      i === termos.length - 1 ? palavra.startsWith(termo) : palavra === termo,
    );
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

export function ftsConsulta(termos: string[]): string {
  return termos
    .map((termo, indice) => {
      const seguro = termo.replace(/[^a-z0-9]/g, "");
      if (!seguro) return "";
      return indice === termos.length - 1 ? `"${seguro}"*` : `"${seguro}"`;
    })
    .filter(Boolean)
    .join(" AND ");
}
