import { parametro, Problema } from "@/http/erros";
import { termosDaConsulta } from "@/texto";
import type { Faixa } from "@/tipos";
import { api } from "@/versao";

/** Tetos de tamanho das entradas (I5). */
export const TETO = {
  /** Caracteres de q e de consulta. */
  consultaCaracteres: 200,
  /** Termos separados por espaço em q e em consulta. */
  consultaTermos: 12,
  /** Caracteres de um código ou identificador curto. */
  codigo: 20,
  /** Itens de uma lista de vocabulários. */
  vocabularios: 4,
} as const;

/** Regra de casamento de todo parâmetro q. */
export const REGRA_Q =
  "Ignora caixa e acento. Palavras separadas por espaço; cada termo casa a palavra inteira, e o último casa por prefixo quando tem 3 caracteres ou mais (com 1 ou 2, casa a palavra inteira).";

// ---------------------------------------------------------------------------
// Declaração dos parâmetros (I6). É a fonte única da documentação e da validação.
// ---------------------------------------------------------------------------

export type TipoParametro = "string" | "integer" | "boolean" | "lista" | "faixa";

export type Parametro = {
  nome: string;
  onde: "query" | "path";
  tipo: TipoParametro;
  descricao: string;
  obrigatorio?: boolean;
  /** Valores aceitos (string e lista). */
  valores?: readonly string[];
  /** Mínimo e máximo (integer e faixa). */
  minimo?: number;
  maximo?: number;
  padrao?: string | number | boolean;
  /** Caracteres do valor (string) ou de cada item (lista). */
  maxCaracteres?: number;
  /** Termos separados por espaço (q). */
  maxTermos?: number;
  /** Itens da lista. */
  maxItens?: number;
};

/** Construtores de declaração, para as rotas ficarem legíveis. */
export const P = {
  caminho(nome: string, descricao: string, valores?: readonly string[]): Parametro {
    return { nome, onde: "path", tipo: "string", descricao, obrigatorio: true, maxCaracteres: TETO.codigo, ...(valores ? { valores } : {}) };
  },
  q(descricao: string, obrigatorio = false): Parametro {
    return {
      nome: "q",
      onde: "query",
      tipo: "string",
      descricao: `${descricao} ${REGRA_Q}`,
      maxCaracteres: TETO.consultaCaracteres,
      maxTermos: TETO.consultaTermos,
      ...(obrigatorio ? { obrigatorio } : {}),
    };
  },
  codigo(nome: string, descricao: string): Parametro {
    return { nome, onde: "query", tipo: "string", descricao, maxCaracteres: TETO.codigo };
  },
  inteiro(nome: string, descricao: string, minimo: number, maximo: number, padrao?: number): Parametro {
    return { nome, onde: "query", tipo: "integer", descricao, minimo, maximo, ...(padrao != null ? { padrao } : {}) };
  },
  escolha(nome: string, descricao: string, valores: readonly string[], padrao?: string): Parametro {
    return { nome, onde: "query", tipo: "string", descricao, valores, ...(padrao != null ? { padrao } : {}) };
  },
  lista(nome: string, descricao: string, opcoes: { valores?: readonly string[]; maxItens?: number; obrigatorio?: boolean } = {}): Parametro {
    return {
      nome,
      onde: "query",
      tipo: "lista",
      descricao,
      maxCaracteres: TETO.codigo,
      ...(opcoes.valores ? { valores: opcoes.valores } : {}),
      ...(opcoes.maxItens ? { maxItens: opcoes.maxItens } : {}),
      ...(opcoes.obrigatorio ? { obrigatorio: true } : {}),
    };
  },
  booleano(nome: string, descricao: string): Parametro {
    return { nome, onde: "query", tipo: "boolean", descricao };
  },
  faixa(nome: string, descricao: string, minimo: number, maximo: number): Parametro {
    return { nome, onde: "query", tipo: "faixa", descricao, minimo, maximo };
  },
  limite(padrao: number, maximo: number): Parametro {
    return P.inteiro("limite", `Tamanho da página. Padrão ${padrao}, máximo ${maximo}.`, 1, maximo, padrao);
  },
  paginacao(padrao: number, maximo: number): Parametro[] {
    return [P.limite(padrao, maximo), P.inteiro("deslocamento", "Quantos registros pular. Padrão 0.", 0, 1_000_000, 0)];
  },
};

/** Parâmetros que o dispatcher aceita em toda rota, além dos declarados por ela. */
export const PARAMETROS_GLOBAIS: Parametro[] = [
  {
    nome: "campos",
    onde: "query",
    tipo: "lista",
    descricao: "Subconjunto das chaves de dados a devolver, separadas por vírgula, como codigo,titulo_cbo.",
  },
  {
    nome: "formato",
    onde: "query",
    tipo: "string",
    descricao: "Formato da resposta. Só json nesta versão.",
    valores: ["json"],
    padrao: "json",
  },
];

/**
 * A consulta como a rota a vê. Ler um parâmetro que a rota não declarou é erro de programação
 * e lança Error, não Problema: a documentação e o comportamento não podem se separar.
 */
export class ConsultaRota extends URLSearchParams {
  readonly declarados: ReadonlyMap<string, Parametro>;
  readonly lidos = new Set<string>();

  constructor(init: URLSearchParams | string, parametros: readonly Parametro[]) {
    super(init);
    this.declarados = new Map(parametros.filter((item) => item.onde === "query").map((item) => [item.nome, item]));
  }

  declaracao(nome: string): Parametro {
    const declarado = this.declarados.get(nome);
    if (!declarado) throw new Error(`Erro de programação: a rota lê o parâmetro "${nome}", que não declarou.`);
    this.lidos.add(nome);
    return declarado;
  }

  override get(nome: string) {
    this.declaracao(nome);
    return super.get(nome);
  }

  override getAll(nome: string) {
    this.declaracao(nome);
    return super.getAll(nome);
  }

  override has(nome: string, valor?: string) {
    this.declaracao(nome);
    return super.has(nome, valor);
  }
}

/**
 * Confere o pedido contra a declaração: parâmetro desconhecido responde 400,
 * e cada parâmetro presente passa pelo leitor do seu tipo antes da rota rodar.
 */
export function validarPedido(parametros: readonly Parametro[], query: URLSearchParams, caminho: Record<string, string>) {
  for (const declarado of parametros.filter((item) => item.onde === "path")) {
    const valor = caminho[declarado.nome];
    if (valor != null) exigirTetoCodigo(valor, declarado.nome, declarado.maxCaracteres);
  }
  const globais = PARAMETROS_GLOBAIS.filter((global) => !parametros.some((item) => item.nome === global.nome));
  const aceitos = [...parametros.filter((item) => item.onde === "query"), ...globais];
  const consulta = new ConsultaRota(query, aceitos);
  for (const nome of new Set(query.keys())) {
    const declarado = aceitos.find((item) => item.nome === nome);
    if (!declarado) {
      throw new Problema(
        400,
        api("/problemas/parametro-desconhecido"),
        "Parâmetro desconhecido",
        `Esta rota não aceita o parâmetro ${nome}.`,
        aceitos.length ? `Parâmetros aceitos: ${aceitos.map((item) => item.nome).join(", ")}.` : "Esta rota não aceita parâmetros.",
        aceitos.map((item) => item.nome),
      );
    }
    lerDeclarado(consulta, declarado);
  }
}

function lerDeclarado(consulta: ConsultaRota, declarado: Parametro) {
  switch (declarado.tipo) {
    case "integer":
      return inteiro(consulta, declarado.nome);
    case "boolean":
      return booleano(consulta, declarado.nome);
    case "lista":
      return lista(consulta, declarado.nome);
    case "faixa":
      return faixa(consulta, declarado.nome);
    default:
      return declarado.valores ? escolha(consulta, declarado.nome) : texto(consulta, declarado.nome);
  }
}

// ---------------------------------------------------------------------------
// Tetos (I5), usados também pelo MCP.
// ---------------------------------------------------------------------------

/** Recusa texto de busca acima do teto de caracteres ou de termos. */
export function exigirTetoConsulta(valor: string, nome: string) {
  if (valor.length > TETO.consultaCaracteres) {
    throw parametro(nome, `${nome} tem ${valor.length} caracteres; o máximo é ${TETO.consultaCaracteres}.`);
  }
  const termos = termosDaConsulta(valor).length;
  if (termos > TETO.consultaTermos) {
    throw parametro(nome, `${nome} tem ${termos} termos; o máximo é ${TETO.consultaTermos}.`);
  }
}

/** Recusa código ou identificador acima do teto de caracteres. */
export function exigirTetoCodigo(valor: string, nome: string, maximo: number = TETO.codigo) {
  if (valor.length > maximo) {
    throw parametro(nome, `${nome} tem ${valor.length} caracteres; o máximo de um código é ${maximo}.`);
  }
}

// ---------------------------------------------------------------------------
// Leitores. Limites, valores aceitos e padrão vêm da declaração da rota.
// ---------------------------------------------------------------------------

export function texto(q: ConsultaRota, nome: string): string | undefined {
  const declarado = q.declaracao(nome);
  const valor = q.get(nome);
  if (valor == null || valor.trim() === "") return typeof declarado.padrao === "string" ? declarado.padrao : undefined;
  const limpo = valor.trim();
  if (declarado.maxTermos) exigirTetoConsulta(limpo, nome);
  else if (declarado.maxCaracteres) exigirTetoCodigo(limpo, nome, declarado.maxCaracteres);
  return limpo;
}

export function inteiro(q: ConsultaRota, nome: string): number | undefined {
  const declarado = q.declaracao(nome);
  const padrao = typeof declarado.padrao === "number" ? declarado.padrao : undefined;
  const valor = q.get(nome);
  if (valor == null || valor === "") return padrao;
  if (!/^-?\d+$/.test(valor)) throw parametro(nome, `${nome} precisa ser um inteiro.`);
  const numero = Number(valor);
  const minimo = declarado.minimo ?? Number.MIN_SAFE_INTEGER;
  const maximo = declarado.maximo ?? Number.MAX_SAFE_INTEGER;
  if (numero < minimo || numero > maximo) {
    throw parametro(nome, `${nome} precisa estar entre ${minimo} e ${maximo}.`);
  }
  return numero;
}

export function limite(q: ConsultaRota): number {
  return inteiro(q, "limite")!;
}

export function deslocamento(q: ConsultaRota): number {
  return inteiro(q, "deslocamento") ?? 0;
}

export function escolha<T extends string>(q: ConsultaRota, nome: string): T | undefined {
  const declarado = q.declaracao(nome);
  const valor = q.get(nome)?.trim();
  if (!valor) return declarado.padrao as T | undefined;
  const aceitos = declarado.valores ?? [];
  if (!aceitos.includes(valor)) throw parametro(nome, `${nome} recebeu "${valor}".`, aceitos);
  return valor as T;
}

export function lista(q: ConsultaRota, nome: string): string[] | undefined {
  const declarado = q.declaracao(nome);
  const valor = q.get(nome)?.trim();
  if (!valor) return undefined;
  const itens = valor.split(",").map((item) => item.trim()).filter(Boolean);
  if (declarado.maxItens && itens.length > declarado.maxItens) {
    throw parametro(nome, `${nome} tem ${itens.length} itens; o máximo é ${declarado.maxItens}.`);
  }
  if (declarado.maxCaracteres) for (const item of itens) exigirTetoCodigo(item, nome, declarado.maxCaracteres);
  if (declarado.valores) {
    const ruim = itens.find((item) => !declarado.valores!.includes(item));
    if (ruim) throw parametro(nome, `${nome} recebeu "${ruim}".`, declarado.valores);
  }
  return itens;
}

export function faixa(q: ConsultaRota, nome: string): Faixa | undefined {
  const declarado = q.declaracao(nome);
  const valor = q.get(nome)?.trim();
  if (!valor) return undefined;
  const minimo = declarado.minimo ?? 0;
  const maximo = declarado.maximo ?? Number.MAX_SAFE_INTEGER;
  const casou = valor.match(/^(\d+)(?:\.\.(\d+))?$/);
  if (!casou) throw parametro(nome, `${nome} aceita um valor ou um intervalo min..max, como 4 ou 3..5.`);
  const de = Number(casou[1]);
  const ate = casou[2] ? Number(casou[2]) : de;
  if (de < minimo || ate > maximo || de > ate) {
    throw parametro(nome, `${nome} precisa estar entre ${minimo} e ${maximo}.`);
  }
  return { min: de, max: ate };
}

export function booleano(q: ConsultaRota, nome: string): boolean | undefined {
  q.declaracao(nome);
  const valor = q.get(nome)?.trim();
  if (!valor) return undefined;
  if (valor === "true" || valor === "1") return true;
  if (valor === "false" || valor === "0") return false;
  throw parametro(nome, `${nome} aceita true ou false.`, ["true", "false"]);
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

export function paginar<T>(itens: T[], limiteItens: number, deslocamentoItens: number) {
  return {
    fatia: itens.slice(deslocamentoItens, deslocamentoItens + limiteItens),
    total: itens.length,
    limite: limiteItens,
    deslocamento: deslocamentoItens,
  };
}
