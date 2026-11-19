import { createHash } from "node:crypto";
import { Problema, parametro } from "@/http/erros";
import { paraCsv } from "@/http/csv";
import { limitar } from "@/http/limite";
import { ConsultaRota, lista, PARAMETROS_GLOBAIS, validarPedido } from "@/http/parametros";
import { rotas, type Ctx } from "@/http/rotas";
import { api, GERADOR, PREFIXO_API, VERSAO_DADOS, VERSAO_SCHEMA, VERSAO_SERVICO } from "@/versao";
import type { Saida } from "@/tipos";
import { alvoDaRota, linkSignposting } from "@/signposting";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "X-Versao-Dados, X-Versao-Servico, X-Total, ETag, Retry-After, Link",
};

export async function tratar(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return responderProblema(
      new Problema(405, api("/problemas/metodo"), "Método não permitido", "Esta API é somente leitura.", "Use GET."),
      req,
    );
  }
  try {
    limitar(req.headers);
    const url = new URL(req.url);
    const relativo = caminhoRelativo(url.pathname);
    const casou = casar(relativo);
    if (!casou) {
      throw new Problema(
        404,
        api("/problemas/rota-inexistente"),
        "Rota não encontrada",
        `Não há recurso em ${url.pathname}.`,
        `O índice está em ${PREFIXO_API}.`,
      );
    }
    const declaraFormato = casou.rota.parametros.some((item) => item.nome === "formato");
    const csv = !declaraFormato && url.searchParams.get("formato") === "csv";
    if (csv && !casou.rota.csv) {
      throw parametro(
        "formato",
        `Esta rota devolve dados aninhados e não tem CSV. Rotas com formato=csv: ${ROTAS_CSV.join(", ")}.`,
        ["json"],
      );
    }
    validarPedido(casou.rota.parametros, url.searchParams, casou.params);
    const ctx: Ctx = { params: casou.params, query: new ConsultaRota(url.searchParams, casou.rota.parametros), url };
    const saida = casou.rota.handle(ctx);
    if (saida.cru) {
      return finalizar(req, url, 200, JSON.stringify(saida.dados), "application/json; charset=utf-8");
    }
    const campos = lista(new ConsultaRota(url.searchParams, PARAMETROS_GLOBAIS), "campos");
    const dados = campos ? aplicarCampos(saida.dados, campos) : saida.dados;
    if (csv) return responderCsv(req, url, saida, dados);
    const corpo = JSON.stringify(envelope(url, saida, dados));
    return finalizar(req, url, 200, corpo, "application/json; charset=utf-8");
  } catch (erro) {
    if (erro instanceof Problema) return responderProblema(erro, req);
    console.error(erro);
    return responderProblema(
      new Problema(500, api("/problemas/erro-interno"), "Erro interno", "A consulta não pôde ser concluída."),
      req,
    );
  }
}

const ROTAS_CSV = [...new Set(rotas.filter((rota) => rota.csv).map((rota) => api(rota.caminho).replace(/:([a-z_]+)/g, "{$1}")))];

function responderCsv(req: Request, url: URL, saida: Saida, dados: unknown) {
  const temListaDeObjetos = (valor: unknown): boolean =>
    Array.isArray(valor)
      ? valor.some((item) => item !== null && typeof item === "object")
      : !!valor && typeof valor === "object" && Object.values(valor as Record<string, unknown>).some(temListaDeObjetos);
  if (!Array.isArray(dados) || dados.some((registro) => registro && typeof registro === "object" && Object.values(registro).some(temListaDeObjetos))) {
    throw parametro("formato", "Com estes parâmetros a rota devolve dados aninhados, sem CSV. Na busca por atividades, tire agrupar_por.", ["json"]);
  }
  const resposta = finalizar(req, url, 200, paraCsv(dados), "text/csv; charset=utf-8");
  if (saida.total != null) resposta.headers.set("x-total", String(saida.total));
  return resposta;
}

function caminhoRelativo(pathname: string) {
  if (pathname === PREFIXO_API) return "/";
  if (pathname.startsWith(`${PREFIXO_API}/`)) return pathname.slice(PREFIXO_API.length);
  return pathname;
}

function casar(caminho: string) {
  const partes = caminho.split("/").filter(Boolean);
  for (const rota of rotas) {
    const modelo = rota.caminho.split("/").filter(Boolean);
    if (modelo.length !== partes.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < modelo.length; i++) {
      if (modelo[i].startsWith(":")) params[modelo[i].slice(1)] = decodificar(modelo[i].slice(1), partes[i]);
      else if (modelo[i] !== partes[i]) ok = false;
    }
    if (ok) return { rota, params };
  }
  return null;
}

function decodificar(nome: string, valor: string) {
  try {
    return decodeURIComponent(valor);
  } catch {
    throw parametro(nome, `${nome} tem codificação inválida na URL.`);
  }
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

/** Identifica o código que gerou a resposta: o commit na Vercel, a versão do pacote fora dela. */
export function identificadorBuild() {
  return process.env.VERCEL_GIT_COMMIT_SHA || `pacote-${VERSAO_SERVICO}`;
}

/** Muda quando mudam os dados, o gerador do banco ou o código (I7). */
export function etagDe(url: URL) {
  const chaves = [...url.searchParams.keys()].sort();
  const consulta = chaves.map((chave) => `${chave}=${url.searchParams.getAll(chave).join(",")}`).join("&");
  const base = [VERSAO_DADOS, GERADOR, identificadorBuild(), `${url.pathname}?${consulta}`].join(" ");
  const hash = createHash("sha256").update(base).digest("hex");
  return `"${hash}"`;
}

function finalizar(req: Request, url: URL, status: number, corpo: string, tipo: string) {
  const etag = etagDe(url);
  const headers = new Headers({
    ...CORS,
    "content-type": tipo,
    etag,
    "x-versao-dados": VERSAO_DADOS,
    "x-versao-servico": VERSAO_SERVICO,
    "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
  });
  if (status < 400) headers.set("link", linkSignposting(alvoDaRota(caminhoRelativo(url.pathname))));
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
    "x-versao-servico": VERSAO_SERVICO,
    "cache-control": "no-store",
  });
  if (erro.retryAfter) headers.set("retry-after", String(erro.retryAfter));
  if (req.method === "HEAD") return new Response(null, { status: erro.status, headers });
  return new Response(JSON.stringify(erro.corpo()), { status: erro.status, headers });
}
