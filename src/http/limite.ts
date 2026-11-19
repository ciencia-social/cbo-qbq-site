import { Problema } from "@/http/erros";
import { api } from "@/versao";

/**
 * Limite de taxa da aplicação, por IP e por janela fixa de um minuto.
 *
 * Esta é a segunda camada. A contagem fica na memória de cada instância da função,
 * então na Vercel ela não limita por pessoa: duas instâncias contam em separado.
 * O limite que vale é o da borda (Firewall da Vercel); ver docs/operacao.md.
 */

const JANELA_MS = 60_000;
/** Teto de IPs guardados por instância. Acima dele, os mais antigos saem primeiro. */
export const TETO_BALDES = 10_000;
/** Intervalo mínimo entre duas varreduras das entradas vencidas. */
const VARREDURA_MS = 1_000;

type Balde = { n: number; ate: number };

export function criarLimitador(opcoes: { teto?: number; agora?: () => number } = {}) {
  const baldes = new Map<string, Balde>();
  const teto = opcoes.teto ?? TETO_BALDES;
  const relogio = opcoes.agora ?? Date.now;
  let ultimaVarredura = 0;

  function varrer(agora: number) {
    if (agora - ultimaVarredura < VARREDURA_MS) return;
    ultimaVarredura = agora;
    for (const [ip, balde] of baldes) if (balde.ate <= agora) baldes.delete(ip);
  }

  /** Conta um pedido do IP. Devolve os segundos de espera se passou do máximo, ou 0. */
  function contar(ip: string, maximo: number): number {
    const agora = relogio();
    varrer(agora);
    let balde = baldes.get(ip);
    if (!balde || balde.ate <= agora) {
      baldes.delete(ip);
      balde = { n: 0, ate: agora + JANELA_MS };
      baldes.set(ip, balde);
      while (baldes.size > teto) baldes.delete(baldes.keys().next().value as string);
    }
    balde.n += 1;
    return balde.n > maximo ? Math.max(1, Math.ceil((balde.ate - agora) / 1000)) : 0;
  }

  return { contar, tamanho: () => baldes.size };
}

const limitador = criarLimitador();

/** Pedidos por minuto aceitos por IP, ou null quando o limite está desligado. */
function maximoConfigurado(): number | null {
  const valor = process.env.LIMITE_TAXA;
  if (valor === "0") return null;
  // Na suíte de testes o limite fica desligado, salvo quando o teste define LIMITE_TAXA.
  if (valor == null && process.env.VITEST) return null;
  return Number(valor ?? 120);
}

/** IP do cliente. Na Vercel, x-real-ip é o endereço visto pela borda; x-forwarded-for vem depois. */
export function ipDe(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const encaminhado = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || "local";
}

/** Segundos de espera se o IP passou do limite, ou 0. */
export function esperaDoLimite(headers: Headers): number {
  const maximo = maximoConfigurado();
  if (maximo == null) return 0;
  return limitador.contar(ipDe(headers), maximo);
}

export function problemaDeLimite(espera: number) {
  const maximo = maximoConfigurado() ?? 120;
  return new Problema(
    429,
    api("/problemas/limite-de-taxa"),
    "Limite de taxa",
    `Este endereço passou de ${maximo} pedidos por minuto.`,
    "Espere e tente de novo. A API não tem chave para elevar o limite.",
    undefined,
    espera,
  );
}

/** Lança 429 em problem+json se o IP passou do limite. */
export function limitar(headers: Headers) {
  const espera = esperaDoLimite(headers);
  if (espera > 0) throw problemaDeLimite(espera);
}
