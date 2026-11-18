import { rotas, type Rota } from "@/http/rotas";
import { Problema } from "@/http/erros";
import { PREFIXO_API } from "@/versao";

/** Tool MCP da rota, só onde definicoes tem equivalente. */
const TOOL_POR_CAMINHO: Record<string, string> = {
  "/ocupacoes": "ocupacao_buscar",
  "/sinonimos": "ocupacao_buscar",
  "/ocupacoes/:codigo": "ocupacao_obter",
  "/ocupacoes/:codigo/atividades": "cbo_atividades",
  "/ocupacoes/:codigo/competencias": "qbq_competencias",
  "/cbo/arvore": "cbo_navegar",
  "/cbo/:nivel/:codigo": "cbo_navegar",
  "/codigos": "codigo_decodificar",
  "/codigos/:codigo": "codigo_decodificar",
  "/qbq/vocabularios": "qbq_vocabulario",
  "/qbq/vocabularios/:vocabulario": "qbq_vocabulario",
  "/qbq/vocabularios/:vocabulario/:codigo": "qbq_vocabulario",
  "/qbq/vocabularios/:vocabulario/:nivel/:codigo": "qbq_vocabulario",
  "/versao": "dados_sobre",
  "/fontes": "dados_sobre",
  "/decisoes": "dados_sobre",
  "/decisoes/:id": "dados_sobre",
  "/atividades": "cbo_buscar_atividades",
  "/qbq/conceitos": "qbq_buscar_termos",
  "/qbq/itens": "qbq_buscar_termos",
  "/qbq/vocabularios/:vocabulario/:nivel/:codigo/ocupacoes": "qbq_ocupacoes_por_competencia",
  "/ocupacoes/comparar": "ocupacao_comparar",
  "/ocupacoes/:codigo/similares": "ocupacao_similares",
  "/cbo/:nivel/:codigo/resumo": "cbo_resumir_grupo",
  "/estatisticas/niveis": "cbo_resumir_grupo",
  "/estatisticas/competencias": "cbo_resumir_grupo",
  "/cobertura": "cobertura_consultar",
  "/cobertura/resumo": "cobertura_consultar",
  "/qbq/nao-classificadas": "cobertura_consultar",
};

export function slugRota(caminho: string) {
  if (caminho === "/") return "indice";
  return caminho.replace(/^\//, "").replace(/:([a-z_]+)/g, "_$1");
}

export function hrefRota(caminho: string) {
  return `/docs/${slugRota(caminho)}`;
}

export function toolDaRota(caminho: string) {
  return TOOL_POR_CAMINHO[caminho];
}

function paramsDe(caminho: string) {
  const params: Record<string, string> = {};
  if (caminho.startsWith("/cbo/:nivel")) {
    params.nivel = "grandes-grupos";
    params.codigo = "2";
  } else if (caminho.includes(":vocabulario")) {
    params.vocabulario = "habilidades";
    params.nivel = "habilidades";
    params.codigo = "01.03.05";
  } else if (caminho.includes(":id")) params.id = "D015";
  else if (caminho.includes(":codigo")) params.codigo = "212405";
  return params;
}

function consultaDe(rota: Rota) {
  const query = new URLSearchParams();
  for (const parametro of rota.parametros) {
    if (parametro.onde === "path") continue;
    if (parametro.nome === "q") query.set("q", "programador");
    if (parametro.nome === "codigos") query.set("codigos", "212405,212420");
    if (parametro.nome === "vocabulario") query.set("vocabulario", "habilidades");
    if (parametro.nome === "dimensao_nivel") query.set("dimensao_nivel", "qualificacao");
  }
  return query;
}

function chaves(dados: unknown) {
  if (Array.isArray(dados)) {
    const primeiro = dados[0];
    return primeiro && typeof primeiro === "object" ? Object.keys(primeiro as object) : [];
  }
  if (dados && typeof dados === "object") return Object.keys(dados as object);
  return [];
}

export function listarRotas(q?: string) {
  const termo = q?.trim().toLowerCase();
  const itens = rotas.filter((rota) => {
    if (!termo) return true;
    return `${rota.id} ${rota.caminho} ${rota.resumo} ${rota.grupo}`.toLowerCase().includes(termo);
  });
  const grupos: { titulo: string; itens: { id: string; caminho: string; resumo: string; href: string }[] }[] = [];
  for (const rota of itens) {
    const grupo = grupos.find((item) => item.titulo === rota.grupo) ?? grupos[grupos.push({ titulo: rota.grupo, itens: [] }) - 1];
    grupo.itens.push({ id: rota.id, caminho: rota.caminho, resumo: rota.resumo, href: hrefRota(rota.caminho) });
  }
  return grupos;
}

export function carregarRota(slug: string) {
  const rota = rotas.find((item) => slugRota(item.caminho) === slug);
  if (!rota) return { tipo: "ausente" as const };
  const params = paramsDe(rota.caminho);
  const query = consultaDe(rota);
  let chavesResposta: string[] = [];
  let avisos: { codigo?: string; mensagem: string }[] = [];
  let erro: { status: number; titulo: string; detalhe: string; dica?: string } | undefined;
  try {
    const saida = rota.handle({ params, query, url: new URL(`https://cbo.ciencia.social${PREFIXO_API}`) });
    chavesResposta = chaves(saida.dados);
    avisos = (saida.avisos ?? []).map((aviso) => ({ codigo: aviso.codigo, mensagem: aviso.mensagem }));
  } catch (falha) {
    if (!(falha instanceof Problema)) throw falha;
    erro = { status: falha.status, titulo: falha.titulo, detalhe: falha.detalhe, dica: falha.dica };
  }
  const caminhoPublico = rota.caminho === "/" ? PREFIXO_API : `${PREFIXO_API}${rota.caminho}`;
  return {
    tipo: "ok" as const,
    id: rota.id,
    grupo: rota.grupo,
    resumo: rota.resumo,
    caminho: rota.caminho,
    caminhoPublico,
    parametros: rota.parametros,
    tool: toolDaRota(rota.caminho),
    exemplos: params,
    consultaExemplo: query.toString(),
    chaves: chavesResposta,
    avisos,
    erro,
  };
}

export type VistaRota = ReturnType<typeof carregarRota>;
