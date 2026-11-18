import { parametro } from "@/http/erros";
import type { Faixa } from "@/tipos";

export function texto(q: URLSearchParams, nome: string): string | undefined {
  const valor = q.get(nome);
  if (valor == null || valor.trim() === "") return undefined;
  return valor.trim();
}

export function inteiro(
  q: URLSearchParams,
  nome: string,
  minimo: number,
  maximo: number,
  padrao?: number,
): number | undefined {
  const valor = q.get(nome);
  if (valor == null || valor === "") return padrao;
  if (!/^-?\d+$/.test(valor)) throw parametro(nome, `${nome} precisa ser um inteiro.`);
  const numero = Number(valor);
  if (numero < minimo || numero > maximo) {
    throw parametro(nome, `${nome} precisa estar entre ${minimo} e ${maximo}.`);
  }
  return numero;
}

export function limite(q: URLSearchParams, padrao = 20, maximo = 100): number {
  return inteiro(q, "limite", 1, maximo, padrao) ?? padrao;
}

export function deslocamento(q: URLSearchParams): number {
  return inteiro(q, "deslocamento", 0, 1_000_000, 0) ?? 0;
}

export function escolha<T extends string>(
  q: URLSearchParams,
  nome: string,
  aceitos: readonly T[],
  padrao?: T,
): T | undefined {
  const valor = texto(q, nome);
  if (valor == undefined) return padrao;
  if (!(aceitos as readonly string[]).includes(valor)) {
    throw parametro(nome, `${nome} recebeu "${valor}".`, aceitos);
  }
  return valor as T;
}

export function lista(
  q: URLSearchParams,
  nome: string,
  aceitos?: readonly string[],
): string[] | undefined {
  const valor = texto(q, nome);
  if (!valor) return undefined;
  const itens = valor.split(",").map((item) => item.trim()).filter(Boolean);
  if (aceitos) {
    const ruim = itens.find((item) => !aceitos.includes(item));
    if (ruim) throw parametro(nome, `${nome} recebeu "${ruim}".`, aceitos);
  }
  return itens;
}

export function faixa(q: URLSearchParams, nome: string, minimo: number, maximo: number): Faixa | undefined {
  const valor = texto(q, nome);
  if (!valor) return undefined;
  const casou = valor.match(/^(\d+)(?:\.\.(\d+))?$/);
  if (!casou) throw parametro(nome, `${nome} aceita um valor ou um intervalo min..max, como 4 ou 3..5.`);
  const de = Number(casou[1]);
  const ate = casou[2] ? Number(casou[2]) : de;
  if (de < minimo || ate > maximo || de > ate) {
    throw parametro(nome, `${nome} precisa estar entre ${minimo} e ${maximo}.`);
  }
  return { min: de, max: ate };
}

export function faixaDeParams(
  minimo: number | undefined,
  maximo: number | undefined,
  nome: string,
  piso: number,
  teto: number,
): Faixa | undefined {
  if (minimo == null && maximo == null) return undefined;
  const de = minimo ?? piso;
  const ate = maximo ?? teto;
  if (de < piso || ate > teto || de > ate) throw parametro(nome, `${nome} precisa estar entre ${piso} e ${teto}.`);
  return { min: de, max: ate };
}

export function booleano(q: URLSearchParams, nome: string): boolean | undefined {
  const valor = texto(q, nome);
  if (valor == undefined) return undefined;
  if (valor === "true" || valor === "1") return true;
  if (valor === "false" || valor === "0") return false;
  throw parametro(nome, `${nome} aceita true ou false.`, ["true", "false"]);
}

export function paginar<T>(itens: T[], limiteItens: number, deslocamentoItens: number) {
  return {
    fatia: itens.slice(deslocamentoItens, deslocamentoItens + limiteItens),
    total: itens.length,
    limite: limiteItens,
    deslocamento: deslocamentoItens,
  };
}
