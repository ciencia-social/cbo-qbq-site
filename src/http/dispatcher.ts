import { createHash } from "node:crypto";
import { Problema, parametro } from "@/http/erros";
import { limitar } from "@/http/limite";
import { lista } from "@/http/parametros";
import { rotas, type Ctx } from "@/http/rotas";
import { VERSAO_DADOS, VERSAO_SCHEMA } from "@/versao";
import type { Saida } from "@/tipos";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "X-Versao-Dados, ETag, Retry-After",
};

export async function tratar(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return responderProblema(
      new Problema(405, "/v1/problemas/metodo", "Método não permitido", "Esta API é somente leitura.", "Use GET."),
      req,
    );
  }
  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
    limitar(ip);
    const url = new URL(req.url);
    if (url.searchParams.get("formato") === "csv") {
      throw parametro("formato", "O formato CSV não está disponível nesta versão.", ["json"]);
    }
    const relativo = url.pathname === "/v1" ? "/" : url.pathname.replace(/^\/v1/, "");
    const casou = casar(relativo);
    if (!casou) {
      throw new Problema(404, "/v1/problemas/rota-inexistente", "Rota não encontrada", `Não há recurso em ${url.pathname}.`, "O índice está em /v1.");
    }
    const ctx: Ctx = { params: casou.params, query: url.searchParams, url };
    const saida = casou.rota.handle(ctx);
    if (saida.cru) {
      return finalizar(req, url, 200, JSON.stringify(saida.dados), "application/json; charset=utf-8");
    }
    const campos = lista(url.searchParams, "campos");
    const dados = campos ? aplicarCampos(saida.dados, campos) : saida.dados;
    const corpo = JSON.stringify(envelope(url, saida, dados));
    return finalizar(req, url, 200, corpo, "application/json; charset=utf-8");
  } catch (erro) {
    if (erro instanceof Problema) return responderProblema(erro, req);
    console.error(erro);
    return responderProblema(
      new Problema(500, "/v1/problemas/erro-interno", "Erro interno", "A consulta não pôde ser concluída."),
      req,
    );
  }
}

function casar(caminho: string) {
  const partes = caminho.split("/").filter(Boolean);
  for (const rota of rotas) {
    const modelo = rota.caminho.split("/").filter(Boolean);
    if (modelo.length !== partes.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < modelo.length; i++) {
      if (modelo[i].startsWith(":")) params[modelo[i].slice(1)] = decodeURIComponent(partes[i]);
      else if (modelo[i] !== partes[i]) ok = false;
    }
    if (ok) return { rota, params };
  }
  return null;
}

function envelope(url: URL, saida: Saida, dados: unknown) {
  return {
    dados,
    meta: {
      versao_dados: VERSAO_DADOS,
      versao_schema: VERSAO_SCHEMA,
      ...(saida.total != null ? { total: saida.total } : {}),
      ...(saida.limite != null ? { limite: saida.limite } : {}),
      ...(saida.deslocamento != null ? { deslocamento: saida.deslocamento } : {}),
      derivado: saida.derivado === true,
      ...(saida.metodo ? { metodo: saida.metodo } : {}),
      avisos: saida.avisos ?? [],
    },
    links: links(url, saida.total, saida.limite, saida.deslocamento),
  };
}

function links(url: URL, total?: number, limite?: number, deslocamento?: number) {
  const proprio = url.pathname + url.search;
  if (total == null || limite == null || deslocamento == null) return { proprio, proxima: null, anterior: null };
  const com = (valor: number) => {
    const params = new URLSearchParams(url.searchParams);
    params.set("deslocamento", String(valor));
    return `${url.pathname}?${params.toString()}`;
  };
  return {
    proprio,
    proxima: deslocamento + limite < total ? com(deslocamento + limite) : null,
    anterior: deslocamento > 0 ? com(Math.max(0, deslocamento - limite)) : null,
  };
}

function aplicarCampos(dados: unknown, campos: string[]): unknown {
  const filtrar = (item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const registro = item as Record<string, unknown>;
    const saida: Record<string, unknown> = {};
    for (const campo of campos) {
      if (!(campo in registro)) {
        throw parametro("campos", `Campo desconhecido: ${campo}.`, Object.keys(registro));
      }
      saida[campo] = registro[campo];
    }
    return saida;
  };
  return Array.isArray(dados) ? dados.map(filtrar) : filtrar(dados);
}

function etagDe(url: URL) {
  const chaves = [...url.searchParams.keys()].sort();
  const consulta = chaves.map((chave) => `${chave}=${url.searchParams.getAll(chave).join(",")}`).join("&");
  const hash = createHash("sha256").update(`${VERSAO_DADOS} ${url.pathname}?${consulta}`).digest("hex");
  return `"${hash}"`;
}

function finalizar(req: Request, url: URL, status: number, corpo: string, tipo: string) {
  const etag = etagDe(url);
  const headers = new Headers({
    ...CORS,
    "content-type": tipo,
    etag,
    "x-versao-dados": VERSAO_DADOS,
    "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
  });
  const pedido = req.headers.get("if-none-match");
  if (pedido && pedido.split(",").some((item) => item.trim() === etag || item.trim() === `W/${etag}`)) {
    return new Response(null, { status: 304, headers });
  }
  if (req.method === "HEAD") return new Response(null, { status, headers });
  return new Response(corpo, { status, headers });
}

function responderProblema(erro: Problema, req: Request) {
  const headers = new Headers({
    ...CORS,
    "content-type": "application/problem+json; charset=utf-8",
    "x-versao-dados": VERSAO_DADOS,
    "cache-control": "no-store",
  });
  if (erro.retryAfter) headers.set("retry-after", String(erro.retryAfter));
  if (req.method === "HEAD") return new Response(null, { status: erro.status, headers });
  return new Response(JSON.stringify(erro.corpo()), { status: erro.status, headers });
}
