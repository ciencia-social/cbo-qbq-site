import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { todos } from "@/dados/banco";
import { tratar } from "@/http/dispatcher";
import { textoCasa } from "@/texto";
import { arquivoDe, CONSULTAS, ROTAS, urlDe } from "../scripts/gravar-busca";

const PASTA = path.join(import.meta.dirname, "fixtures", "busca-antes");

type Gravado = { url: string; status: number; corpo: { dados: unknown; meta: { total?: number } } };

function antes(rota: (typeof ROTAS)[number], consulta: string): Gravado {
  return JSON.parse(fs.readFileSync(path.join(PASTA, arquivoDe(rota, consulta)), "utf8")) as Gravado;
}

async function agora(url: string) {
  const resposta = await tratar(new Request(`http://localhost${url}`));
  return { status: resposta.status, corpo: await resposta.json() };
}

describe("I3 busca no banco: mesmas respostas de antes", () => {
  const casos = CONSULTAS.filter((consulta) => consulta.length >= 3).flatMap((consulta) =>
    ROTAS.map((rota) => [rota.nome, consulta, rota] as const),
  );

  it.each(casos)("%s q=%s é idêntica à referência", async (_nome, consulta, rota) => {
    const gravado = antes(rota, consulta);
    const resposta = await agora(urlDe(rota, consulta));
    expect(resposta.status).toBe(gravado.status);
    expect(resposta.corpo).toEqual(gravado.corpo);
  });
});

describe("I3 prefixo curto: q=a casa a palavra inteira", () => {
  const palavraA = (texto: string) => textoCasa(texto, ["a"]);

  it("a regra vale para o último termo com menos de 3 caracteres", () => {
    expect(textoCasa("Gestão de A a Z", ["a"])).toBe(true);
    expect(textoCasa("Administração", ["a"])).toBe(false);
    expect(textoCasa("Administração", ["adm"])).toBe(true);
    expect(textoCasa("banco de dados", ["de", "da"])).toBe(false);
    expect(textoCasa("banco de dados", ["de", "dad"])).toBe(true);
  });

  it("/qbq/itens?q=a: o total é o de antes restrito à palavra inteira, na mesma ordem", async () => {
    const rota = ROTAS.find((item) => item.nome === "itens")!;
    const resposta = await agora(urlDe(rota, "a"));
    const linhas = todos<{ descricao_item: string }>(
      `SELECT c.descricao_item FROM cha c JOIN ocupacao o ON o.codigo = c.ocupacao
       WHERE c.descricao_item IS NOT NULL AND c.descricao_item != 'NULL'`,
    );
    const esperado = linhas.filter((linha) => palavraA(linha.descricao_item)).length;
    expect(resposta.corpo.meta.total).toBe(esperado);
    expect(esperado).toBeLessThan(antes(rota, "a").corpo.meta.total!);
    const novos = resposta.corpo.dados as { descricao_item: string }[];
    expect(novos.every((item) => palavraA(item.descricao_item))).toBe(true);
    // Os itens de antes que casam a palavra inteira aparecem, na mesma ordem, no começo da lista nova.
    const antigos = (antes(rota, "a").corpo.dados as { descricao_item: string; ocupacao: string; codigo: string }[])
      .filter((item) => palavraA(item.descricao_item));
    expect(novos.slice(0, antigos.length)).toEqual(antigos);
  });

  it("/atividades?q=a: o total é o de antes restrito à palavra inteira", async () => {
    const rota = ROTAS.find((item) => item.nome === "atividades")!;
    const resposta = await agora(urlDe(rota, "a"));
    const linhas = todos<{ descricao: string; nome: string }>(
      `SELECT a.descricao, ar.nome FROM atividade a
       JOIN area ar ON ar.ocupacao = a.ocupacao AND ar.sigla = a.sigla
       JOIN ocupacao o ON o.codigo = a.ocupacao`,
    );
    const esperado = linhas.filter((linha) => palavraA(linha.descricao) || palavraA(linha.nome)).length;
    expect(resposta.corpo.meta.total).toBe(esperado);
    expect(esperado).toBeLessThan(antes(rota, "a").corpo.meta.total!);
  });
});
