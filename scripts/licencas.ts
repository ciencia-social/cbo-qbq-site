/**
 * Resume as licenças das dependências de produção instaladas (P2).
 * Grava docs/licencas-dependencias.md. Sem dependência nova: usa `npm ls` e os package.json.
 *
 *   node --experimental-strip-types scripts/licencas.ts
 *
 * Os binários opcionais (por exemplo, os do sharp) dependem da plataforma onde o npm instalou;
 * a lista reflete a máquina que rodou o script.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const DESTINO = path.join(RAIZ, "docs", "licencas-dependencias.md");
const PERMISSIVAS = new Set(["MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD"]);

type Pacote = { nome: string; versao: string; licenca: string };

function licencaDe(pkg: Record<string, unknown>): string {
  const campo = pkg.license ?? pkg.licenses;
  if (typeof campo === "string") return campo;
  if (Array.isArray(campo)) return campo.map((l) => (typeof l === "string" ? l : (l as { type?: string }).type ?? "?")).join(" OR ");
  if (campo && typeof campo === "object") return (campo as { type?: string }).type ?? "desconhecida";
  return "desconhecida";
}

function listar(): Pacote[] {
  let saida: string;
  try {
    saida = execFileSync("npm", ["ls", "--omit=dev", "--all", "--parseable"], { cwd: RAIZ, encoding: "utf8" });
  } catch (erro) {
    // npm ls sai com código diferente de zero quando há aviso de árvore (peer opcional etc.).
    saida = (erro as { stdout?: string }).stdout ?? "";
  }
  const vistos = new Map<string, Pacote>();
  for (const linha of saida.split("\n")) {
    const pasta = linha.trim();
    if (!pasta || path.resolve(pasta) === RAIZ) continue;
    const pkg = JSON.parse(readFileSync(path.join(pasta, "package.json"), "utf8")) as Record<string, unknown>;
    const nome = String(pkg.name);
    const versao = String(pkg.version);
    vistos.set(`${nome}@${versao}`, { nome, versao, licenca: licencaDe(pkg) });
  }
  return [...vistos.values()].sort((a, b) => (a.nome === b.nome ? a.versao.localeCompare(b.versao) : a.nome.localeCompare(b.nome)));
}

function permissiva(licenca: string): boolean {
  const termos = licenca.replace(/[()]/g, "").split(/\s+OR\s+/);
  return termos.some((t) => PERMISSIVAS.has(t.trim()));
}

const pacotes = listar();
const contagem = new Map<string, number>();
for (const p of pacotes) contagem.set(p.licenca, (contagem.get(p.licenca) ?? 0) + 1);
const fora = pacotes.filter((p) => !permissiva(p.licenca));

const linhas = [
  "# Licenças das dependências de produção",
  "",
  "Arquivo gerado por `node --experimental-strip-types scripts/licencas.ts`. Não editar à mão.",
  "",
  `São ${pacotes.length} pacotes de produção instalados (\`npm ls --omit=dev --all\`). Nenhum é redistribuído neste repositório: o npm os instala a partir do \`package-lock.json\`. Os binários opcionais dependem da plataforma onde o npm instalou.`,
  "",
  "## Contagem por licença",
  "",
  "| Licença | Pacotes |",
  "|---|---|",
  ...[...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l, n]) => `| ${l} | ${n} |`),
  "",
  `## Fora de ${[...PERMISSIVAS].join(", ")}`,
  "",
  ...(fora.length ? ["| Pacote | Versão | Licença |", "|---|---|---|", ...fora.map((p) => `| \`${p.nome}\` | ${p.versao} | ${p.licenca} |`)] : ["Nenhum."]),
  "",
];

writeFileSync(DESTINO, linhas.join("\n"));
console.log(`${pacotes.length} pacotes; ${fora.length} fora da lista permissiva → ${path.relative(RAIZ, DESTINO)}`);
