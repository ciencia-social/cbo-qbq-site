/**
 * CSV das rotas de lista (I14): cabeçalho na primeira linha, UTF-8 sem BOM, vírgula como separador,
 * aspas só quando preciso e quebra de linha no fim, para read.csv do R abrir sem aviso.
 * Objetos aninhados viram colunas com _ (familia_codigo, fonte_cbo_arquivo); listas de valores, texto com "; ".
 */

type Valor = string | number | boolean | null | undefined;

function achatar(valor: unknown, prefixo: string, saida: Map<string, Valor>) {
  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) achatar(item, prefixo ? `${prefixo}_${chave}` : chave, saida);
    return;
  }
  if (Array.isArray(valor)) {
    saida.set(prefixo, valor.map((item) => (item && typeof item === "object" ? JSON.stringify(item) : String(item))).join("; "));
    return;
  }
  saida.set(prefixo, valor as Valor);
}

function campo(valor: Valor): string {
  if (valor == null) return "";
  const texto = String(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export function paraCsv(registros: unknown[]): string {
  const linhas = registros.map((registro) => {
    const plano = new Map<string, Valor>();
    achatar(registro, "", plano);
    return plano;
  });
  const colunas: string[] = [];
  for (const linha of linhas) for (const chave of linha.keys()) if (!colunas.includes(chave)) colunas.push(chave);
  const corpo = [colunas.map((coluna) => campo(coluna)).join(","), ...linhas.map((linha) => colunas.map((coluna) => campo(linha.get(coluna))).join(","))];
  return `${corpo.join("\n")}\n`;
}
