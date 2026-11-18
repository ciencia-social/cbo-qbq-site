import { avisoNormalizacao, avisosOcupacao } from "@/consulta/formatar";
import type { OcupacaoLista } from "@/consulta/cache";
import { rotas, type Rota } from "@/http/rotas";
import { Problema } from "@/http/erros";
import type { Aviso, Saida } from "@/tipos";
import { PREFIXO_API, VERSAO_DADOS, VERSAO_SCHEMA } from "@/versao";

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

const LISTAS = new Set(["incluir", "codigos", "tipos", "buscar_em", "campos"]);
const LIMITE_JSON = 8000;

const CAMPOS_FICHA: Record<string, string> = {
  codigo: "Código canônico de 6 dígitos, com zero à esquerda.",
  codigo_formatado: "Forma com hífen, 2124-05.",
  situacao_qbq: "classificada, nao_classificada (com justificativa), sem_nivel_sem_justificativa ou ausente_no_qbq.",
  divergencia: "so_cbo, so_qbq ou titulo_divergente. Acompanha um aviso de divergência.",
  caminho: "Ancestrais até o grande grupo, sempre com código e título.",
  cbo: "Título, família, sinônimos (objetos com título), vigência e fonte na CBO. null em 4 ocupações só do QBQ.",
  qbq: "Título, síntese, quatro níveis, taxonomia de conhecimento, vigência e fonte. null em 25 ocupações só da CBO.",
  contagens: "Totais de sinônimos, áreas, atividades e itens CHA, para decidir o que pedir em seguida.",
  links: "Dentro de dados, as rotas dos sub-recursos desta ocupação.",
  "meta.versao_dados": "Versão do conjunto. Presente em toda resposta.",
  "meta.versao_schema": "Versão do esquema da resposta.",
  "meta.derivado": "true quando a resposta é um cálculo deste projeto.",
  "meta.avisos": "O que é preciso saber para não interpretar errado. Cada aviso pode apontar para uma decisão.",
};

const ERROS_CODIGO = [
  { situacao: "Código malformado (21240, ABC)", status: "400", diz: "Formato esperado por nível: 1, 2, 3, 4 ou 6 dígitos." },
  { situacao: "Código bem formado e inexistente (212499)", status: "404", diz: "Até onde o código existe e quais ocupações há ali." },
  { situacao: "Código existe só em uma camada", status: "200", diz: "Registro com cbo ou qbq null e aviso de divergência. Não é erro." },
  { situacao: "Parâmetro com valor inválido", status: "400", diz: "Lista dos valores aceitos." },
  { situacao: "Limite de requisições excedido", status: "429", diz: "Cabeçalho Retry-After com a espera em segundos." },
];

export function rotuloRota(caminho: string) {
  if (caminho === "/") return "GET /api/v1";
  return `GET ${caminho.replace(/:([a-z_]+)/g, "{$1}")}`;
}

function tipoDe(valor: unknown) {
  if (valor == null) return "enum | null";
  if (Array.isArray(valor)) return "array";
  if (typeof valor === "number") return "número";
  if (typeof valor === "boolean") return "booleano";
  if (typeof valor === "object") return "objeto";
  return "string";
}

function enxugar(valor: unknown, profundidade = 0): unknown {
  if (typeof valor === "string") return valor.length > 240 ? `${valor.slice(0, 240)}…` : valor;
  if (Array.isArray(valor)) {
    const fatia = valor.slice(0, 3).map((item) => enxugar(item, profundidade + 1));
    if (valor.length > 3) fatia.push(`… ${valor.length - 3} itens`);
    return fatia;
  }
  if (valor && typeof valor === "object") {
    if (profundidade > 4) return "…";
    return Object.fromEntries(Object.entries(valor as Record<string, unknown>).map(([chave, item]) => [chave, enxugar(item, profundidade + 1)]));
  }
  return valor;
}

function jsonLegivel(valor: unknown) {
  const texto = JSON.stringify(enxugar(valor), null, 2);
  return texto.length > LIMITE_JSON ? `${texto.slice(0, LIMITE_JSON)}\n…` : texto;
}

function envelope(saida: Saida, proprio: string) {
  return {
    dados: saida.dados,
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
    links: { proprio },
  };
}

function camposDe(corpo: { dados: unknown; meta: object }, caminho: string) {
  const textos = caminho === "/ocupacoes/:codigo" ? CAMPOS_FICHA : {};
  const linhas: { nome: string; tipo: string; descricao: string }[] = [];
  const dados = corpo.dados;
  if (Array.isArray(dados)) {
    const primeiro = dados[0];
    if (primeiro && typeof primeiro === "object") {
      for (const [nome, valor] of Object.entries(primeiro as Record<string, unknown>)) {
        linhas.push({ nome, tipo: tipoDe(valor), descricao: textos[nome] ?? "" });
      }
    } else linhas.push({ nome: "dados", tipo: "array", descricao: "" });
  } else if (dados && typeof dados === "object") {
    for (const [nome, valor] of Object.entries(dados as Record<string, unknown>)) {
      linhas.push({ nome, tipo: tipoDe(valor), descricao: textos[nome] ?? "" });
    }
  }
  for (const [nome, valor] of Object.entries(corpo.meta)) {
    const chave = `meta.${nome}`;
    linhas.push({ nome: chave, tipo: tipoDe(valor), descricao: textos[chave] ?? "" });
  }
  linhas.push({
    nome: "links",
    tipo: "objeto",
    descricao: caminho === "/ocupacoes/:codigo" ? "Irmão de dados. Traz o link próprio da resposta." : (textos.links ?? ""),
  });
  return linhas;
}

function avisosDaFicha(emitidos: Aviso[]) {
  const parcial = (divergencia: string | null, situacao: string) =>
    avisosOcupacao({ divergencia, situacao_qbq: situacao } as OcupacaoLista, true);
  const d015 = [...parcial("titulo_divergente", "classificada"), ...parcial("so_cbo", "ausente_no_qbq"), ...parcial("so_qbq", "classificada")];
  const d010 = parcial(null, "sem_nivel_sem_justificativa")[0];
  const normalizacao = avisoNormalizacao("10105", "010105");
  const cartaoD015: Aviso = {
    codigo: "D015",
    mensagem: [...new Set(d015.map((aviso) => aviso.mensagem))].join(" "),
    link: d015[0]?.link,
  };
  const todos = [...emitidos, cartaoD015, d010, normalizacao].filter((aviso): aviso is Aviso => Boolean(aviso));
  const vistos = new Set<string>();
  return todos.filter((aviso) => {
    const chave = aviso.codigo ?? aviso.mensagem;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
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

function parametrosDoc(rota: Rota) {
  const tokens = (rota.caminho.match(/:([a-z_]+)/g) ?? []).map((token) => token.slice(1));
  const doCaminho = tokens.map((nome) => {
    const registro = rota.parametros.find((parametro) => parametro.nome === nome);
    return { nome, onde: "path" as const, tipo: "string", obrigatorio: true, descricao: registro?.descricao ?? "Trecho do caminho." };
  });
  const consulta = rota.parametros
    .filter((parametro) => parametro.onde !== "path" && !tokens.includes(parametro.nome))
    .map((parametro) => ({
      nome: parametro.nome,
      onde: "query" as const,
      tipo: LISTAS.has(parametro.nome) ? "lista" : "string",
      obrigatorio: false,
      descricao: parametro.descricao,
    }));
  return [
    ...doCaminho,
    ...consulta,
    { nome: "campos", onde: "query" as const, tipo: "lista", obrigatorio: false, descricao: "Subconjunto opcional das chaves de dados, por exemplo codigo,cbo.titulo." },
  ];
}

function urlExemplo(caminho: string, params: Record<string, string>, query: URLSearchParams) {
  let path = caminho === "/" ? "" : caminho;
  for (const [nome, valor] of Object.entries(params)) path = path.replaceAll(`:${nome}`, valor);
  const busca = query.toString();
  return `https://cbo.ciencia.social${PREFIXO_API}${path}${busca ? `?${busca}` : ""}`;
}

export function carregarRota(slug: string) {
  const rota = rotas.find((item) => slugRota(item.caminho) === slug);
  if (!rota) return { tipo: "ausente" as const };
  const indice = rotas.indexOf(rota);
  const params = paramsDe(rota.caminho);
  const query = consultaDe(rota);
  const url = urlExemplo(rota.caminho, params, query);
  let corpo: ReturnType<typeof envelope> | undefined;
  let erro: { status: number; titulo: string; detalhe: string; dica?: string } | undefined;
  try {
    const saida = rota.handle({ params, query, url: new URL(url) });
    corpo = envelope(saida, url.replace("https://cbo.ciencia.social", ""));
  } catch (falha) {
    if (!(falha instanceof Problema)) throw falha;
    erro = { status: falha.status, titulo: falha.titulo, detalhe: falha.detalhe, dica: falha.dica };
  }
  const emitidos = corpo?.meta.avisos ?? [];
  const avisos = rota.caminho === "/ocupacoes/:codigo" ? avisosDaFicha(emitidos) : emitidos;
  const erros = rota.caminho.includes(":codigo")
    ? ERROS_CODIGO
    : erro
      ? [{ situacao: erro.titulo, status: String(erro.status), diz: erro.detalhe }]
      : [];
  const vizinho = (item?: Rota) => (item ? { href: hrefRota(item.caminho), resumo: item.resumo } : null);
  const caminhoPublico = rota.caminho === "/" ? PREFIXO_API : `${PREFIXO_API}${rota.caminho}`;
  const campos = corpo ? camposDe(corpo, rota.caminho) : [];
  return {
    tipo: "ok" as const,
    id: rota.id,
    grupo: rota.grupo,
    resumo: rota.resumo,
    caminho: rota.caminho,
    caminhoPublico,
    parametros: parametrosDoc(rota),
    tool: toolDaRota(rota.caminho),
    exemplos: params,
    consultaExemplo: query.toString(),
    curl: `curl ${url}`,
    exemploJson: corpo ? jsonLegivel(corpo) : jsonLegivel({ tipo: `${PREFIXO_API}/problemas/`, titulo: erro?.titulo, status: erro?.status, detalhe: erro?.detalhe }),
    campos,
    chaves: campos.map((campo) => campo.nome),
    avisos,
    erros,
    anterior: vizinho(rotas[indice - 1]),
    proxima: vizinho(rotas[indice + 1]),
  };
}

export type VistaRota = ReturnType<typeof carregarRota>;
