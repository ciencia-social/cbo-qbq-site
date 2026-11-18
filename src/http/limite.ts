import { Problema } from "@/http/erros";

const baldes = new Map<string, { n: number; ate: number }>();

export function limitar(ip: string) {
  if (process.env.VITEST || process.env.LIMITE_TAXA === "0") return;
  const maximo = Number(process.env.LIMITE_TAXA ?? 120);
  const agora = Date.now();
  const atual = baldes.get(ip);
  const balde = !atual || atual.ate < agora ? { n: 0, ate: agora + 60_000 } : atual;
  balde.n += 1;
  baldes.set(ip, balde);
  if (balde.n > maximo) {
    const espera = Math.ceil((balde.ate - agora) / 1000);
    throw new Problema(
      429,
      "/v1/problemas/limite-de-taxa",
      "Limite de taxa",
      `Este endereço passou de ${maximo} pedidos por minuto.`,
      "Espere e tente de novo. A API não tem chave para elevar o limite.",
      undefined,
      espera,
    );
  }
}
