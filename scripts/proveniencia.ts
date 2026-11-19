/**
 * Proveniência do banco (I8): de qual commit de cbo-qbq-dados ele saiu, e se esse commit é o da tag fixada.
 * Sem dependências do resto do projeto, para os testes importarem sem rodar o gerador.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

export type Proveniencia = {
  /** Commit da árvore usada, ou null se a pasta não é um repositório git. */
  commit: string | null;
  /** Commit da tag fixada, ou null se a tag não existe nessa pasta. */
  commitDaTag: string | null;
  /** A árvore tem mudanças fora de commit. */
  alterada: boolean;
  /** A árvore é exatamente a tag: mesmo commit e sem mudanças. */
  naTag: boolean;
};

function git(raiz: string, ...args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", raiz, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function lerProveniencia(raiz: string, tag: string): Proveniencia {
  const commit = git(raiz, "rev-parse", "HEAD");
  const commitDaTag = git(raiz, "rev-parse", "--verify", "--quiet", `${tag}^{commit}`);
  const alterada = commit != null && (git(raiz, "status", "--porcelain", "--untracked-files=no") ?? "") !== "";
  return { commit, commitDaTag, alterada, naTag: commit != null && commit === commitDaTag && !alterada };
}

/**
 * Avisa quando a árvore não é a tag. Com exigir (EXIGIR_TAG=1), lança erro com o motivo.
 * Devolve a proveniência para gravar no banco.
 */
export function conferirProveniencia(raiz: string, tag: string, exigir: boolean): Proveniencia {
  const prov = lerProveniencia(raiz, tag);
  if (prov.naTag) return prov;
  const motivo = !prov.commit
    ? `${raiz} não é um repositório git; não há como saber de qual commit os dados saíram.`
    : !prov.commitDaTag
      ? `${raiz} está no commit ${prov.commit.slice(0, 12)}, e a tag ${tag} não existe nessa pasta.`
      : prov.commit !== prov.commitDaTag
        ? `${raiz} está no commit ${prov.commit.slice(0, 12)}, mas a tag ${tag} aponta para ${prov.commitDaTag.slice(0, 12)}.`
        : `${raiz} está na tag ${tag}, mas tem arquivos alterados fora de commit.`;
  const conserto = `Faça checkout de ${tag} nessa pasta, aponte CBO_QBQ_DADOS para um clone da tag ou remova a pasta para o script clonar a tag.`;
  if (exigir) throw new Error(`EXIGIR_TAG=1: os dados não estão na tag fixada. ${motivo} ${conserto}`);
  console.warn(`aviso: os dados não estão na tag fixada. ${motivo} ${conserto}`);
  return prov;
}

/** O banco existe e foi gerado pelo mesmo gerador, a partir da mesma versão dos dados. */
export function bancoAtualizado(destino: string, esperado: { gerador: string; versaoDados: string }, forcar: boolean): boolean {
  if (forcar) return false;
  if (!fs.existsSync(destino)) return false;
  try {
    const db = new DatabaseSync(destino, { readOnly: true });
    const linhas = db.prepare("SELECT chave, valor FROM meta WHERE chave IN ('gerador', 'versao_dados')").all() as { chave: string; valor: string }[];
    db.close();
    const meta = Object.fromEntries(linhas.map((linha) => [linha.chave, linha.valor]));
    return meta.gerador === esperado.gerador && meta.versao_dados === esperado.versaoDados;
  } catch {
    return false;
  }
}
