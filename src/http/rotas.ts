import { createHash } from "node:crypto";
import { arvore, decodificar, listarNivel, obterNo } from "@/consulta/cbo";
import { cobertura, coberturaResumo, estatisticas, estatisticasCompetencias, estatisticasNiveis, resumoGrupo } from "@/consulta/derivado";
import { buscaUnificada, buscarAtividades } from "@/consulta/busca";
import { decisao, decisoes, escalas, fontes, versao } from "@/consulta/meta";
import {
  atividades,
  buscarSinonimos,
  comparar,
  competencias,
  listarOcupacoes,
  listarSinonimosDaOcupacao,
  obterOcupacao,
  similares,
  sugerir,
  type FiltroOcupacao,
} from "@/consulta/ocupacao";
import {
  buscarItens,
  listarConceitos,
  listarTermos,
  naoClassificadas,
  niveis,
  ocupacoesDoTermo,
  obterTermo,
  vocabularios,
} from "@/consulta/qbq";
import { noCbo } from "@/consulta/cache";
import { inexistente } from "@/consulta/formatar";
import { parametro, Problema } from "@/http/erros";
import { booleano, escolha, faixa, inteiro, limite, lista, texto, deslocamento } from "@/http/parametros";
import { DIVERGENCIAS, NIVEL_POR_TAMANHO, SITUACOES_QBQ, type Saida } from "@/tipos";
import { REPOSITORIO_DADOS, VERSAO_DADOS, VERSAO_SCHEMA } from "@/versao";

export type Ctx = { params: Record<string, string>; query: URLSearchParams; url: URL };

export type Rota = {
  id: string;
  grupo: string;
  caminho: string;
  resumo: string;
  parametros: { nome: string; onde: "query" | "path"; descricao: string }[];
  handle: (ctx: Ctx) => Saida;
};

function hierarquia(q: URLSearchParams) {
  const regras = [
    ["grande_grupo", 1],
    ["subgrupo_principal", 2],
    ["subgrupo", 3],
    ["familia", 4],
    ["prefixo", 0],
  ] as const;
  const valores: string[] = [];
  for (const [campo, tamanho] of regras) {
    const bruto = texto(q, campo);
    if (!bruto) continue;
    const codigo = bruto.replace(/[\s-]/g, "");
    const ok = campo === "prefixo" ? /^\d{1,4}$/.test(codigo) : codigo.length === tamanho;
    if (!ok) throw parametro(campo, `${campo} não tem o número de dígitos esperado.`);
    const nivel = NIVEL_POR_TAMANHO[codigo.length];
    if (!noCbo(nivel, codigo)) throw inexistente(bruto, codigo);
    valores.push(codigo);
  }
  if (!valores.length) return undefined;
  const maior = [...valores].sort((a, b) => b.length - a.length)[0];
  if (valores.some((item) => !maior.startsWith(item))) {
    throw parametro("prefixo", "Os filtros de hierarquia não cabem no mesmo ramo.");
  }
  return maior;
}

function filtro(q: URLSearchParams, padrao = 20, maximo = 100): FiltroOcupacao {
  const buscar = lista(q, "buscar_em", ["titulo", "sinonimo", "sintese"]);
  return {
    q: texto(q, "q"),
    buscarEm: (buscar ?? ["titulo", "sinonimo"]) as FiltroOcupacao["buscarEm"],
    prefixo: hierarquia(q),
    nivelQualificacao: faixa(q, "nivel_qualificacao", 1, 8),
    nivelConhecimento: faixa(q, "nivel_conhecimento", 1, 8),
    nivelHabilidade: faixa(q, "nivel_habilidade", 1, 8),
    nivelAtitude: faixa(q, "nivel_atitude", 1, 8),
    situacaoQbq: escolha(q, "situacao_qbq", SITUACOES_QBQ),
    taxonomia: escolha(q, "taxonomia_conhecimento", ["conhecimentos-i", "conhecimentos-ii"]),
    temAtividades: booleano(q, "tem_atividades"),
    temSinonimos: booleano(q, "tem_sinonimos"),
    divergencia: escolha(q, "divergencia", DIVERGENCIAS),
    limite: limite(q, padrao, maximo),
    deslocamento: deslocamento(q),
    ordenar: texto(q, "ordenar"),
  };
}

function incluir(q: URLSearchParams, aceitos: string[]) {
  return lista(q, "incluir", aceitos) ?? [];
}

const p = (nome: string, descricao: string, onde: "query" | "path" = "query") => ({ nome, onde, descricao });

export const rotas: Rota[] = [
  {
    id: "R01",
    grupo: "Metadados",
    caminho: "/",
    resumo: "Índice da API.",
    parametros: [],
    handle: () => ({
      dados: {
        versao_dados: VERSAO_DADOS,
        versao_schema: VERSAO_SCHEMA,
        grupos: agrupar(),
        links: {
          openapi: "/v1/openapi.json",
          mcp: "/mcp",
          llms: "/llms.txt",
          repositorio_dados: REPOSITORIO_DADOS,
        },
      },
    }),
  },
  { id: "R02", grupo: "Metadados", caminho: "/versao", resumo: "Versão, licença e citação.", parametros: [], handle: () => versao() },
  { id: "R03", grupo: "Metadados", caminho: "/fontes", resumo: "Arquivos oficiais arquivados.", parametros: [], handle: () => fontes() },
  {
    id: "R04",
    grupo: "Metadados",
    caminho: "/decisoes",
    resumo: "Decisões de modelagem D001–D018.",
    parametros: [p("q", "Busca no texto da decisão.")],
    handle: ({ query }) => decisoes(texto(query, "q"), limite(query), deslocamento(query)),
  },
  {
    id: "R04",
    grupo: "Metadados",
    caminho: "/decisoes/:id",
    resumo: "Uma decisão de modelagem.",
    parametros: [p("id", "Identificador, como D015.", "path")],
    handle: ({ params }) => decisao(params.id),
  },
  { id: "R05", grupo: "Metadados", caminho: "/escalas", resumo: "Escalas oficiais de nível e grau.", parametros: [], handle: () => escalas() },
  {
    id: "R06",
    grupo: "Metadados",
    caminho: "/openapi.json",
    resumo: "Especificação OpenAPI 3.1.",
    parametros: [],
    handle: () => ({ dados: documentoOpenApi(), cru: true }),
  },
  rotaNivel("R10", "/cbo/grandes-grupos", "Os 10 grandes grupos."),
  rotaNivel("R11", "/cbo/subgrupos-principais", "Os 49 subgrupos principais."),
  rotaNivel("R12", "/cbo/subgrupos", "Os 195 subgrupos."),
  rotaNivel("R13", "/cbo/familias", "As 626 famílias."),
  {
    id: "R16",
    grupo: "Classificação",
    caminho: "/cbo/arvore",
    resumo: "Subárvore da classificação.",
    parametros: [p("raiz", "Código de 1 a 4 dígitos."), p("profundidade", "De 1 a 4. Padrão 1.")],
    handle: ({ query }) => arvore(texto(query, "raiz"), inteiro(query, "profundidade", 1, 4, 1) ?? 1),
  },
  {
    id: "R15",
    grupo: "Classificação",
    caminho: "/cbo/:nivel/:codigo/ocupacoes",
    resumo: "Ocupações sob um nó da classificação.",
    parametros: [p("nivel", "Nível da URL.", "path"), p("codigo", "Código do nó.", "path")],
    handle: ({ params, query }) => {
      const no = obterNo(params.nivel, params.codigo, []);
      const codigo = (no.dados as { codigo: string }).codigo;
      return listarOcupacoes({ ...filtro(query), prefixo: codigo });
    },
  },
  {
    id: "R18",
    grupo: "Classificação",
    caminho: "/cbo/:nivel/:codigo/resumo",
    resumo: "Retrato agregado e derivado de um grupo.",
    parametros: [p("dimensao", "habilidades, atitudes, conhecimentos-i ou conhecimentos-ii."), p("limite", "Termos listados.")],
    handle: ({ params, query }) => {
      const no = obterNo(params.nivel, params.codigo, []);
      return resumoGrupo((no.dados as { codigo: string }).codigo, escolha(query, "dimensao", ["habilidades", "atitudes", "conhecimentos-i", "conhecimentos-ii"], "habilidades")!, limite(query, 10, 50));
    },
  },
  {
    id: "R14",
    grupo: "Classificação",
    caminho: "/cbo/:nivel/:codigo",
    resumo: "Um nó da classificação.",
    parametros: [p("incluir", "filhos,caminho.")],
    handle: ({ params, query }) => obterNo(params.nivel, params.codigo, incluir(query, ["filhos", "caminho"])),
  },
  {
    id: "R17",
    grupo: "Classificação",
    caminho: "/codigos",
    resumo: "Decodifica até 200 códigos.",
    parametros: [p("codigos", "Lista separada por vírgula.")],
    handle: ({ query }) => decodificar((texto(query, "codigos") ?? "").split(",").map((item) => item.trim()).filter(Boolean), "lote"),
  },
  {
    id: "R17",
    grupo: "Classificação",
    caminho: "/codigos/:codigo",
    resumo: "Decodifica um código de 1 a 6 dígitos.",
    parametros: [p("codigo", "Código CBO.", "path")],
    handle: ({ params }) => decodificar([decodeURIComponent(params.codigo)], "unico"),
  },
  {
    id: "R27",
    grupo: "Ocupações",
    caminho: "/ocupacoes/sugerir",
    resumo: "Autocompletar de título e sinônimo.",
    parametros: [p("q", "Prefixo."), p("limite", "Padrão 8.")],
    handle: ({ query }) => sugerir(texto(query, "q") ?? "", limite(query, 8, 50)),
  },
  {
    id: "R26",
    grupo: "Ocupações",
    caminho: "/ocupacoes/comparar",
    resumo: "Compara de 2 a 5 ocupações. Cálculo derivado.",
    parametros: [p("codigos", "De 2 a 5 códigos."), p("dimensao", "Padrão habilidades."), p("importancia_min", "Grau mínimo.")],
    handle: ({ query }) =>
      comparar(
        (texto(query, "codigos") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
        escolha(query, "dimensao", ["habilidades", "atitudes", "conhecimentos", "conhecimentos-i", "conhecimentos-ii"], "habilidades")!,
        inteiro(query, "importancia_min", 1, 5),
      ),
  },
  {
    id: "R20",
    grupo: "Ocupações",
    caminho: "/ocupacoes",
    resumo: "Lista de ocupações das duas camadas.",
    parametros: [p("q", "Busca textual."), p("situacao_qbq", "classificada, nao_classificada, sem_nivel_sem_justificativa ou ausente_no_qbq.")],
    handle: ({ query }) => listarOcupacoes(filtro(query)),
  },
  {
    id: "R22",
    grupo: "Ocupações",
    caminho: "/ocupacoes/:codigo/sinonimos",
    resumo: "Sinônimos da ocupação, com fonte.",
    parametros: [p("codigo", "Código da ocupação.", "path")],
    handle: ({ params }) => listarSinonimosDaOcupacao(params.codigo),
  },
  {
    id: "R23",
    grupo: "Ocupações",
    caminho: "/ocupacoes/:codigo/atividades",
    resumo: "Perfil ocupacional da CBO.",
    parametros: [p("area", "Sigla da área."), p("transversais", "incluir, excluir ou somente."), p("q", "Busca nas atividades.")],
    handle: ({ params, query }) =>
      atividades(params.codigo, {
        area: texto(query, "area"),
        transversais: escolha(query, "transversais", ["incluir", "excluir", "somente"], "incluir"),
        q: texto(query, "q"),
        modo: "completo",
      }),
  },
  {
    id: "R24",
    grupo: "Ocupações",
    caminho: "/ocupacoes/:codigo/competencias",
    resumo: "Itens de conhecimento, habilidade e atitude.",
    parametros: [p("dimensao", "conhecimentos, habilidades ou atitudes."), p("importancia_min", "De 1 a 5."), p("excluir_baldes", "true ou false.")],
    handle: ({ params, query }) =>
      competencias(params.codigo, {
        dimensao: escolha(query, "dimensao", ["conhecimentos", "habilidades", "atitudes"]),
        importanciaMin: inteiro(query, "importancia_min", 1, 5),
        frequenciaMin: inteiro(query, "frequencia_min", 1, 5),
        profundidadeMin: inteiro(query, "profundidade_min", 1, 5),
        ramo: texto(query, "ramo"),
        nivelRamo: texto(query, "nivel_ramo"),
        excluirBaldes: booleano(query, "excluir_baldes"),
        incluirConceitos: true,
        limite: limite(query, 20, 100),
        deslocamento: deslocamento(query),
      }),
  },
  {
    id: "R25",
    grupo: "Ocupações",
    caminho: "/ocupacoes/:codigo/similares",
    resumo: "Ocupações com competências parecidas. Cálculo derivado.",
    parametros: [p("dimensao", "Padrão habilidades."), p("escopo", "todas, mesma_familia, mesmo_grande_grupo ou fora_da_familia.")],
    handle: ({ params, query }) =>
      similares(
        params.codigo,
        escolha(query, "dimensao", ["habilidades", "atitudes", "conhecimentos", "conhecimentos-i", "conhecimentos-ii"], "habilidades")!,
        escolha(query, "escopo", ["todas", "mesma_familia", "mesmo_grande_grupo", "fora_da_familia"], "todas")!,
        limite(query, 20, 50),
      ),
  },
  {
    id: "R21",
    grupo: "Ocupações",
    caminho: "/ocupacoes/:codigo",
    resumo: "Ficha integrada da CBO e do QBQ.",
    parametros: [p("incluir", "sinonimos,atividades,competencias,perfil_ocupacional.")],
    handle: ({ params, query }) => {
      const extras = incluir(query, ["sinonimos", "atividades", "competencias", "perfil_ocupacional"]);
      return obterOcupacao(params.codigo, {
        perfil: extras.includes("perfil_ocupacional"),
        atividades: extras.includes("atividades"),
        competencias: extras.includes("competencias"),
      });
    },
  },
  {
    id: "R30",
    grupo: "Busca",
    caminho: "/busca",
    resumo: "Busca unificada por tipo.",
    parametros: [p("q", "Texto."), p("tipos", "ocupacao,sinonimo,familia,atividade,termo,conceito.")],
    handle: ({ query }) => buscaUnificada(texto(query, "q") ?? "", lista(query, "tipos", ["ocupacao", "sinonimo", "familia", "atividade", "termo", "conceito"]) ?? ["ocupacao", "sinonimo", "familia", "atividade", "termo", "conceito"], limite(query, 10, 50)),
  },
  {
    id: "R31",
    grupo: "Busca",
    caminho: "/sinonimos",
    resumo: "Do nome de mercado ao código oficial.",
    parametros: [p("q", "Texto do sinônimo.")],
    handle: ({ query }) => buscarSinonimos(filtro(query)),
  },
  {
    id: "R32",
    grupo: "Busca",
    caminho: "/atividades",
    resumo: "Ocupações por tarefa descrita no perfil.",
    parametros: [p("q", "Texto da atividade."), p("agrupar_por", "ocupacao, para uma linha por ocupação."), p("transversais", "incluir, excluir ou somente.")],
    handle: ({ query }) =>
      buscarAtividades({
        q: texto(query, "q") ?? "",
        prefixo: hierarquia(query),
        nivelQualificacao: faixa(query, "nivel_qualificacao", 1, 8),
        transversais: escolha(query, "transversais", ["incluir", "excluir", "somente"], "incluir")!,
        buscarEm: (lista(query, "buscar_em", ["atividade", "area"]) ?? ["atividade", "area"]) as ("atividade" | "area")[],
        agrupar: texto(query, "agrupar_por") === "ocupacao",
        limite: limite(query),
        deslocamento: deslocamento(query),
      }),
  },
  { id: "R40", grupo: "QBQ", caminho: "/qbq/vocabularios", resumo: "Os quatro vocabulários.", parametros: [], handle: () => vocabularios() },
  {
    id: "R43",
    grupo: "QBQ",
    caminho: "/qbq/vocabularios/:vocabulario/:nivel/:codigo/ocupacoes",
    resumo: "Ocupações que exigem um termo.",
    parametros: [p("importancia_min", "De 1 a 5."), p("incluir_descendentes", "Padrão true em nó que não é folha.")],
    handle: ({ params, query }) =>
      ocupacoesDoTermo(params.vocabulario, params.nivel, params.codigo, {
        importanciaMin: inteiro(query, "importancia_min", 1, 5),
        frequenciaMin: inteiro(query, "frequencia_min", 1, 5),
        profundidadeMin: inteiro(query, "profundidade_min", 1, 5),
        incluirDescendentes: booleano(query, "incluir_descendentes"),
        prefixo: hierarquia(query),
        nivelQualificacao: faixa(query, "nivel_qualificacao", 1, 8),
        limite: limite(query),
        deslocamento: deslocamento(query),
        ordenar: texto(query, "ordenar"),
      }),
  },
  {
    id: "R42",
    grupo: "QBQ",
    caminho: "/qbq/vocabularios/:vocabulario/:codigo",
    resumo: "Um termo sem o nível explícito. Se o código existir em mais de um nível, responde 400.",
    parametros: [p("codigo", "Código do termo.", "path")],
    handle: ({ params, query }) => obterTermo(params.vocabulario, undefined, params.codigo, incluir(query, ["uso", "filhos"]).includes("uso")),
  },
  {
    id: "R42",
    grupo: "QBQ",
    caminho: "/qbq/vocabularios/:vocabulario/:nivel/:codigo",
    resumo: "Um termo do vocabulário.",
    parametros: [p("incluir", "uso, para a estatística derivada.")],
    handle: ({ params, query }) => obterTermo(params.vocabulario, params.nivel, params.codigo, incluir(query, ["uso", "filhos"]).includes("uso")),
  },
  {
    id: "R41",
    grupo: "QBQ",
    caminho: "/qbq/vocabularios/:vocabulario",
    resumo: "Termos de um vocabulário.",
    parametros: [p("nivel", "Nível do vocabulário."), p("q", "Busca na descrição."), p("formato", "plano ou arvore.")],
    handle: ({ params, query }) =>
      listarTermos(params.vocabulario, {
        nivel: texto(query, "nivel"),
        pai: texto(query, "pai"),
        nivelPai: texto(query, "nivel_pai"),
        q: texto(query, "q"),
        formato: escolha(query, "formato", ["plano", "arvore"], "plano"),
        profundidade: inteiro(query, "profundidade", 1, 4, 1),
        excluirBaldes: booleano(query, "excluir_baldes"),
        limite: limite(query, 100, 100),
        deslocamento: deslocamento(query),
      }),
  },
  {
    id: "R44",
    grupo: "QBQ",
    caminho: "/qbq/conceitos",
    resumo: "As 96 definições oficiais de habilidades.",
    parametros: [p("q", "Busca no termo ou no conceito."), p("nivel", "dominios, categorias ou habilidades.")],
    handle: ({ query }) => listarConceitos(texto(query, "q"), texto(query, "nivel"), limite(query, 100, 100), deslocamento(query)),
  },
  {
    id: "R45",
    grupo: "QBQ",
    caminho: "/qbq/itens",
    resumo: "Busca no texto dos itens, inclusive baldes.",
    parametros: [p("q", "Texto."), p("somente_baldes", "true para só baldes.")],
    handle: ({ query }) =>
      buscarItens({
        q: texto(query, "q") ?? "",
        dimensao: escolha(query, "dimensao", ["conhecimentos", "habilidades", "atitudes"]),
        taxonomia: escolha(query, "taxonomia", ["conhecimentos-i", "conhecimentos-ii"]),
        somenteBaldes: booleano(query, "somente_baldes"),
        prefixo: hierarquia(query),
        importanciaMin: inteiro(query, "importancia_min", 1, 5),
        limite: limite(query),
        deslocamento: deslocamento(query),
      }),
  },
  {
    id: "R46",
    grupo: "QBQ",
    caminho: "/qbq/nao-classificadas",
    resumo: "Ocupações sem nível, com a justificativa oficial.",
    parametros: [p("q", "Busca no título ou na justificativa.")],
    handle: ({ query }) => naoClassificadas(texto(query, "q"), hierarquia(query), limite(query, 100, 100), deslocamento(query)),
  },
  { id: "R47", grupo: "QBQ", caminho: "/qbq/niveis", resumo: "Totais por nível de qualificação.", parametros: [], handle: () => niveis() },
  {
    id: "R51",
    grupo: "Cobertura",
    caminho: "/cobertura/resumo",
    resumo: "Contagem das divergências e da situação no QBQ.",
    parametros: [],
    handle: () => coberturaResumo(),
  },
  {
    id: "R50",
    grupo: "Cobertura",
    caminho: "/cobertura",
    resumo: "Onde CBO e QBQ não coincidem.",
    parametros: [p("situacao", "so_cbo, so_qbq ou titulo_divergente.")],
    handle: ({ query }) => cobertura(texto(query, "situacao"), hierarquia(query), texto(query, "q"), limite(query, 100, 100), deslocamento(query)),
  },
  { id: "R60", grupo: "Estatísticas", caminho: "/estatisticas", resumo: "Contagens gerais dos conjuntos.", parametros: [], handle: () => estatisticas() },
  {
    id: "R61",
    grupo: "Estatísticas",
    caminho: "/estatisticas/niveis",
    resumo: "Distribuição dos níveis. Cálculo derivado.",
    parametros: [p("dimensao_nivel", "qualificacao, conhecimento, habilidade ou atitude."), p("agrupar_por", "grande_grupo, subgrupo_principal, subgrupo ou familia.")],
    handle: ({ query }) => estatisticasNiveis(escolha(query, "dimensao_nivel", ["qualificacao", "conhecimento", "habilidade", "atitude"], "qualificacao")!, texto(query, "agrupar_por"), hierarquia(query)),
  },
  {
    id: "R62",
    grupo: "Estatísticas",
    caminho: "/estatisticas/competencias",
    resumo: "Termos mais exigidos. Cálculo derivado.",
    parametros: [p("vocabulario", "Vocabulário."), p("ordenar", "-ocupacoes ou -importancia_media.")],
    handle: ({ query }) => {
      const vocabulario = texto(query, "vocabulario");
      if (!vocabulario) throw parametro("vocabulario", "Informe o vocabulário.", ["conhecimentos-i", "conhecimentos-ii", "habilidades", "atitudes"]);
      return estatisticasCompetencias({
        vocabulario,
        nivel: texto(query, "nivel"),
        prefixo: hierarquia(query),
        nivelQualificacao: inteiro(query, "nivel_qualificacao", 1, 8),
        ordenar: escolha(query, "ordenar", ["-ocupacoes", "-importancia_media"], "-ocupacoes"),
        excluirBaldes: booleano(query, "excluir_baldes"),
        limite: limite(query, 20, 100),
      });
    },
  },
];

function rotaNivel(id: string, caminho: string, resumo: string): Rota {
  const nivel = caminho.split("/").pop()!;
  return {
    id,
    grupo: "Classificação",
    caminho,
    resumo,
    parametros: [p("pai", "Código do nó pai."), p("q", "Busca no título.")],
    handle: ({ query }) => listarNivel(nivel, texto(query, "pai"), texto(query, "q"), limite(query, 100, 200), deslocamento(query)),
  };
}

function agrupar() {
  const grupos = new Map<string, { id: string; caminho: string; resumo: string }[]>();
  for (const rota of rotas) {
    if (rota.caminho === "/openapi.json") continue;
    const listaRotas = grupos.get(rota.grupo) ?? [];
    listaRotas.push({ id: rota.id, caminho: `/v1${rota.caminho === "/" ? "" : rota.caminho}`, resumo: rota.resumo });
    grupos.set(rota.grupo, listaRotas);
  }
  return [...grupos.entries()].map(([nome, itens]) => ({ nome, rotas: itens }));
}

export function documentoOpenApi() {
  const paths: Record<string, unknown> = {};
  for (const rota of rotas) {
    const caminho = `/v1${rota.caminho === "/" ? "" : rota.caminho}`.replace(/:([A-Za-z_]+)/g, "{$1}");
    const item = (paths[caminho] ??= { get: undefined }) as { get?: unknown };
    item.get = {
      operationId: `${rota.id}_${rota.caminho.replace(/\W+/g, "_")}`,
      summary: rota.resumo,
      parameters: [
        ...rota.parametros.map((param) => ({
          name: param.nome,
          in: param.onde,
          required: param.onde === "path",
          description: param.descricao,
          schema: { type: "string" },
        })),
        { name: "limite", in: "query", schema: { type: "integer" }, description: "Tamanho da página." },
        { name: "deslocamento", in: "query", schema: { type: "integer" }, description: "Deslocamento da página." },
      ],
      responses: {
        "200": { description: "Envelope dados/meta/links, ou o documento OpenAPI nesta rota." },
        "400": { description: "Parâmetro ou código malformado, em application/problem+json." },
        "404": { description: "Código bem formado e inexistente." },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: "CBO e QBQ", version: VERSAO_DADOS, summary: "API somente leitura da Classificação Brasileira de Ocupações e do Quadro Brasileiro de Qualificações." },
    paths,
  };
}
