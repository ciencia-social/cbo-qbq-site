/**
 * Grava as respostas das buscas textuais como referência (I3).
 * Uso: npx tsx scripts/gravar-busca.ts [pasta]   (padrão: test/fixtures/busca-antes)
 * Roda contra o banco local em data/cbo-qbq.sqlite.
 */
import fs from "node:fs";
import path from "node:path";
import { tratar } from "@/http/dispatcher";

export const CONSULTAS = ["a", "direito ambiental", "banco de dados", "programa", "estat", "comunica"];

export const ROTAS: { nome: string; caminho: string; extra?: string }[] = [
  { nome: "itens", caminho: "/api/v1/qbq/itens" },
  { nome: "itens-p2", caminho: "/api/v1/qbq/itens", extra: "limite=100&deslocamento=100" },
  { nome: "atividades", caminho: "/api/v1/atividades" },
  { nome: "atividades-p2", caminho: "/api/v1/atividades", extra: "limite=100&deslocamento=100" },
  { nome: "atividades-agrupadas", caminho: "/api/v1/atividades", extra: "agrupar_por=ocupacao" },
  { nome: "atividades-agrupadas-p2", caminho: "/api/v1/atividades", extra: "agrupar_por=ocupacao&limite=100&deslocamento=100" },
  { nome: "busca", caminho: "/api/v1/busca" },
];

export function urlDe(rota: (typeof ROTAS)[number], consulta: string) {
  const params = new URLSearchParams({ q: consulta });
  const extra = new URLSearchParams(rota.extra ?? "");
  for (const [chave, valor] of extra) params.set(chave, valor);
  return `${rota.caminho}?${params.toString()}`;
}

export function arquivoDe(rota: (typeof ROTAS)[number], consulta: string) {
  return `${rota.nome}--${consulta.replace(/\s+/g, "-")}.json`;
}

async function main() {
  const destino = path.resolve(process.argv[2] ?? "test/fixtures/busca-antes");
  fs.mkdirSync(destino, { recursive: true });
  for (const consulta of CONSULTAS) {
    for (const rota of ROTAS) {
      const url = urlDe(rota, consulta);
      const inicio = performance.now();
      const resposta = await tratar(new Request(`http://localhost${url}`));
      const corpo = await resposta.json();
      const ms = Math.round(performance.now() - inicio);
      fs.writeFileSync(path.join(destino, arquivoDe(rota, consulta)), `${JSON.stringify({ url, status: resposta.status, corpo }, null, 1)}\n`);
      console.log(`${String(ms).padStart(6)} ms  ${resposta.status}  ${url}`);
    }
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await main();
