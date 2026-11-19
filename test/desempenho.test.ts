import { beforeAll, describe, expect, it } from "vitest";
import { tratar } from "@/http/dispatcher";

/** Orçamento local das buscas textuais mais amplas (I3). Em produção o alvo é 2 s. */
const ORCAMENTO_MS = 1000;

async function medir(caminho: string) {
  const inicio = performance.now();
  const resposta = await tratar(new Request(`http://localhost${caminho}`));
  await resposta.text();
  return { status: resposta.status, ms: performance.now() - inicio };
}

describe("I3 orçamento de tempo com q=a", () => {
  beforeAll(async () => {
    // Carrega o cache em memória das ocupações e termos, que não é custo da busca.
    await medir("/api/v1/ocupacoes?limite=1");
  });

  it.each([
    "/api/v1/qbq/itens?q=a",
    "/api/v1/atividades?q=a",
    "/api/v1/atividades?q=a&agrupar_por=ocupacao",
    "/api/v1/busca?q=a",
  ])("%s termina em menos de 1 s", async (caminho) => {
    const { status, ms } = await medir(caminho);
    expect(status).toBe(200);
    expect(ms).toBeLessThan(ORCAMENTO_MS);
  });
});
