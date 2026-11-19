import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tratar } from "@/http/dispatcher";
import { executarTool } from "@/mcp/executar";
import { GERADOR, TAG_DADOS, VERSAO_DADOS } from "@/versao";
import { bancoAtualizado, lerProveniencia } from "../scripts/proveniencia";

const BANCO = path.join(process.cwd(), "data", "cbo-qbq.sqlite");

describe("I8 proveniência exposta", () => {
  it("/api/v1/versao devolve dados_commit com 40 caracteres hexadecimais", async () => {
    const corpo = await (await tratar(new Request("http://localhost/api/v1/versao"))).json();
    expect(corpo.dados.dados_commit).toMatch(/^[0-9a-f]{40}$/);
    expect(corpo.dados.dados_tag).toBe(TAG_DADOS);
    expect(corpo.dados.versao_dados).toBe(VERSAO_DADOS);
  });

  it("dados_sobre traz os mesmos campos, sem perder os antigos", () => {
    const { dados } = executarTool("dados_sobre", { topico: "versao" });
    const resultado = dados.resultado as Record<string, unknown>;
    expect(resultado.dados_commit).toMatch(/^[0-9a-f]{40}$/);
    expect(resultado.dados_tag).toBe(TAG_DADOS);
    for (const campo of ["versao_dados", "versao_schema", "camadas", "contagens", "licenca", "repositorio_dados", "ressalvas"]) {
      expect(resultado, campo).toHaveProperty(campo);
    }
  });
});

describe("I8 reconstrução", () => {
  it("trocar VERSAO_DADOS sem trocar GERADOR força a reconstrução", () => {
    expect(bancoAtualizado(BANCO, { gerador: GERADOR, versaoDados: VERSAO_DADOS }, false)).toBe(true);
    expect(bancoAtualizado(BANCO, { gerador: GERADOR, versaoDados: "dados-2099.01.1" }, false)).toBe(false);
    expect(bancoAtualizado(BANCO, { gerador: `${GERADOR}x`, versaoDados: VERSAO_DADOS }, false)).toBe(false);
    expect(bancoAtualizado(BANCO, { gerador: GERADOR, versaoDados: VERSAO_DADOS }, true)).toBe(false);
  });
});

describe("I8 EXIGIR_TAG", () => {
  let pasta: string;

  beforeAll(() => {
    // Repositório mínimo: a tag aponta para o primeiro commit, e HEAD está no segundo.
    pasta = fs.mkdtempSync(path.join(os.tmpdir(), "cbo-qbq-dados-"));
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", pasta, "-c", "user.name=teste", "-c", "user.email=teste@example.invalid", "-c", "commit.gpgsign=false", ...args], { stdio: "ignore" });
    fs.mkdirSync(path.join(pasta, "dados", "cbo"), { recursive: true });
    fs.writeFileSync(path.join(pasta, "dados", "cbo", "LEIA.txt"), "1\n");
    git("init", "-q");
    git("add", ".");
    git("commit", "-q", "-m", "um");
    git("tag", TAG_DADOS);
    fs.writeFileSync(path.join(pasta, "dados", "cbo", "LEIA.txt"), "2\n");
    git("commit", "-q", "-am", "dois");
  });

  afterAll(() => {
    fs.rmSync(pasta, { recursive: true, force: true });
  });

  it("lê o commit da árvore e o da tag", () => {
    const prov = lerProveniencia(pasta, TAG_DADOS);
    expect(prov.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(prov.commitDaTag).toMatch(/^[0-9a-f]{40}$/);
    expect(prov.commit).not.toBe(prov.commitDaTag);
    expect(prov.naTag).toBe(false);
  });

  it("com EXIGIR_TAG=1 e a pasta fora da tag, npm run dados falha explicando o motivo", () => {
    const destino = path.join(pasta, "banco.sqlite");
    const resultado = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/construir-banco.ts", "--force"], {
      env: { ...process.env, CBO_QBQ_DADOS: pasta, EXIGIR_TAG: "1", CBO_QBQ_BANCO: destino },
      encoding: "utf8",
    });
    expect(resultado.status).not.toBe(0);
    expect(resultado.stderr).toContain("EXIGIR_TAG=1");
    expect(resultado.stderr).toContain(`a tag ${TAG_DADOS} aponta para`);
    expect(fs.existsSync(destino)).toBe(false);
  });
});
