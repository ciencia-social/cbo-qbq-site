import { arvore, decodificar, listarNivel, obterNo } from "@/consulta/cbo";
import { cobertura, coberturaResumo, estatisticas, estatisticasCompetencias, estatisticasNiveis, resumoGrupo } from "@/consulta/derivado";
import { buscaUnificada, buscarAtividades } from "@/consulta/busca";
import { decisao, decisoes, downloads, escalas, fontes, versao } from "@/consulta/meta";
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
import { parametro } from "@/http/erros";
import { montarOpenApi } from "@/http/openapi";
import {
  booleano,
  ConsultaRota,
  deslocamento,
  escolha,
  faixa,
  inteiro,
  limite,
  lista,
  P,
  texto,
  TETO,
  type Parametro,
} from "@/http/parametros";
import { DIVERGENCIAS, NIVEL_POR_TAMANHO, NIVEL_URL, SITUACOES_QBQ, VOCABULARIOS, type Saida } from "@/tipos";
import { api, PREFIXO_API, REPOSITORIO_DADOS, VERSAO_DADOS, VERSAO_SCHEMA } from "@/versao";

export { REGRA_Q } from "@/http/parametros";

export type Ctx = { params: Record<string, string>; query: ConsultaRota; url: URL };

export type Rota = {
  id: string;
  grupo: string;
  caminho: string;
  resumo: string;
  /** Todos os parâmetros que a rota lê, de caminho e de consulta (I6). */
  parametros: Parametro[];
  /** Aceita formato=csv: a rota devolve uma lista de registros planos (I14). */
  csv?: boolean;
  handle: (ctx: Ctx) => Saida;
};

// ---------------------------------------------------------------------------
// Parâmetros reaproveitados
// ---------------------------------------------------------------------------

const NIVEIS_URL = Object.keys(NIVEL_URL);
const DIMENSOES_CHA = ["conhecimentos", "habilidades", "atitudes"] as const;
const DIMENSOES_COMPARAVEIS = ["habilidades", "atitudes", "conhecimentos", "conhecimentos-i", "conhecimentos-ii"] as const;
const DIMENSOES_RESUMO = ["habilidades", "atitudes", "conhecimentos-i", "conhecimentos-ii"] as const;
const TRANSVERSAIS = ["incluir", "excluir", "somente"] as const;
const CAMPOS_ORDENAR_OCUPACAO = ["codigo", "titulo_cbo", "titulo_qbq", "nivel_qualificacao", "situacao_qbq"];
const ORDENAR_OCUPACAO = CAMPOS_ORDENAR_OCUPACAO.flatMap((campo) => [campo, `-${campo}`]);
const TIPOS_BUSCA = ["ocupacao", "sinonimo", "familia", "atividade", "termo", "conceito"];

const hierarquiaP: Parametro[] = [
  P.codigo("grande_grupo", "Restringe a um grande grupo, código de 1 dígito."),
  P.codigo("subgrupo_principal", "Restringe a um subgrupo principal, código de 2 dígitos."),
  P.codigo("subgrupo", "Restringe a um subgrupo, código de 3 dígitos."),
  P.codigo("familia", "Restringe a uma família, código de 4 dígitos."),
  P.codigo("prefixo", "Restringe a um ramo da CBO, código de 1 a 4 dígitos."),
];

const nivelQualificacaoP = P.faixa("nivel_qualificacao", "Nível de qualificação do QBQ: um valor (5) ou um intervalo (3..5).", 1, 8);
const grauMinimo = (nome: string, rotulo: string) => P.inteiro(nome, `Só itens com ${rotulo} a partir deste grau, de 1 a 5.`, 1, 5);
const caminhoCodigoOcupacao = P.caminho("codigo", "Código da ocupação, com ou sem hífen: 212405 ou 2124-05.");
const caminhoNivelCbo = P.caminho("nivel", "Nível da classificação na URL.", NIVEIS_URL);
const caminhoCodigoCbo = P.caminho("codigo", "Código do nó, de 1 a 4 dígitos conforme o nível.");
const caminhoVocabulario = P.caminho("vocabulario", "Vocabulário do QBQ.", VOCABULARIOS);
const caminhoNivelTermo = P.caminho("nivel", "Nível do termo no vocabulário, como dominios, categorias ou habilidades.");
const caminhoCodigoTermo = P.caminho("codigo", "Código do termo, como 01.03.05.");
const incluirTermoP = P.lista("incluir", "uso acrescenta a estatística derivada de uso; filhos já vem por padrão.", { valores: ["uso", "filhos"] });

type BlocosFiltro = { busca?: boolean; hierarquia?: boolean; ordenar?: boolean };

/** Filtros da lista de ocupações. Cada rota escolhe os blocos que de fato lê. */
function filtroP(blocos: BlocosFiltro = {}): Parametro[] {
  const { busca = true, hierarquia: comHierarquia = true, ordenar = true } = blocos;
  return [
    P.q("Busca no título e no sinônimo."),
    ...(busca ? [P.lista("buscar_em", "Onde casar q. Padrão titulo,sinonimo.", { valores: ["titulo", "sinonimo", "sintese"] })] : []),
    ...(comHierarquia ? hierarquiaP : []),
    nivelQualificacaoP,
    P.faixa("nivel_conhecimento", "Nível de conhecimento do QBQ: valor ou intervalo.", 1, 8),
    P.faixa("nivel_habilidade", "Nível de habilidade do QBQ: valor ou intervalo.", 1, 8),
    P.faixa("nivel_atitude", "Nível de atitude do QBQ: valor ou intervalo.", 1, 8),
    P.escolha("situacao_qbq", "Situação da ocupação no QBQ.", SITUACOES_QBQ),
    P.escolha("taxonomia_conhecimento", "Taxonomia de conhecimento da ocupação.", ["conhecimentos-i", "conhecimentos-ii"]),
    P.booleano("tem_atividades", "true para só ocupações com perfil de atividades na CBO."),
    P.booleano("tem_sinonimos", "true para só ocupações com sinônimos na CBO."),
    P.escolha("divergencia", "Tipo de divergência entre CBO e QBQ.", DIVERGENCIAS),
    ...P.paginacao(20, 100),
    ...(ordenar
      ? [P.escolha("ordenar", "Campo de ordenação; o sinal - inverte. Ausente: relevância com q, código sem q.", ORDENAR_OCUPACAO)]
      : []),
  ];
}

function hierarquia(q: ConsultaRota) {
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

function filtro(q: ConsultaRota, blocos: BlocosFiltro = {}): FiltroOcupacao {
  const { busca = true, hierarquia: comHierarquia = true, ordenar = true } = blocos;
  const buscar = busca ? lista(q, "buscar_em") : undefined;
  return {
    q: texto(q, "q"),
    buscarEm: (buscar ?? ["titulo", "sinonimo"]) as FiltroOcupacao["buscarEm"],
    prefixo: comHierarquia ? hierarquia(q) : undefined,
    nivelQualificacao: faixa(q, "nivel_qualificacao"),
    nivelConhecimento: faixa(q, "nivel_conhecimento"),
    nivelHabilidade: faixa(q, "nivel_habilidade"),
    nivelAtitude: faixa(q, "nivel_atitude"),
    situacaoQbq: escolha(q, "situacao_qbq"),
    taxonomia: escolha(q, "taxonomia_conhecimento"),
    temAtividades: booleano(q, "tem_atividades"),
    temSinonimos: booleano(q, "tem_sinonimos"),
    divergencia: escolha(q, "divergencia"),
    limite: limite(q),
    deslocamento: deslocamento(q),
    ordenar: ordenar ? escolha(q, "ordenar") : undefined,
  };
}

function incluir(q: ConsultaRota) {
  return lista(q, "incluir") ?? [];
}

function codigosDaLista(q: ConsultaRota) {
  return lista(q, "codigos") ?? [];
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

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
          openapi: api("/openapi.json"),
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
    resumo: "Decisões de modelagem D001–D020.",
    parametros: [P.q("Busca no texto da decisão."), ...P.paginacao(20, 100)],
    handle: ({ query }) => decisoes(texto(query, "q"), limite(query), deslocamento(query)),
  },
  {
    id: "R04",
    grupo: "Metadados",
    caminho: "/decisoes/:id",
    resumo: "Uma decisão de modelagem.",
    parametros: [P.caminho("id", "Identificador, como D015.")],
    handle: ({ params }) => decisao(params.id),
  },
  {
    id: "R07",
    grupo: "Metadados",
    caminho: "/downloads",
    resumo: "Links dos arquivos da release de dados, com o manifesto de checksums.",
    parametros: [],
    handle: () => downloads(),
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
    parametros: [
      P.codigo("raiz", "Código de 1 a 4 dígitos. Ausente: os grandes grupos."),
      P.inteiro("profundidade", "Quantos níveis abaixo da raiz. Padrão 1.", 1, 4, 1),
    ],
    handle: ({ query }) => arvore(texto(query, "raiz"), inteiro(query, "profundidade")!),
  },
  {
    id: "R15",
    grupo: "Classificação",
    caminho: "/cbo/:nivel/:codigo/ocupacoes",
    csv: true,
    resumo: "Ocupações sob um nó da classificação.",
    parametros: [caminhoNivelCbo, caminhoCodigoCbo, ...filtroP({ hierarquia: false })],
    handle: ({ params, query }) => {
      const no = obterNo(params.nivel, params.codigo, []);
      const codigo = (no.dados as { codigo: string }).codigo;
      return listarOcupacoes({ ...filtro(query, { hierarquia: false }), prefixo: codigo });
    },
  },
  {
    id: "R18",
    grupo: "Classificação",
    caminho: "/cbo/:nivel/:codigo/resumo",
    resumo: "Retrato agregado e derivado de um grupo.",
    parametros: [
      caminhoNivelCbo,
      caminhoCodigoCbo,
      P.escolha("dimensao", "Vocabulário dos termos que distinguem o grupo.", DIMENSOES_RESUMO, "habilidades"),
      P.limite(10, 50),
    ],
    handle: ({ params, query }) => {
      const no = obterNo(params.nivel, params.codigo, []);
      return resumoGrupo((no.dados as { codigo: string }).codigo, escolha(query, "dimensao")!, limite(query));
    },
  },
  {
    id: "R14",
    grupo: "Classificação",
    caminho: "/cbo/:nivel/:codigo",
    resumo: "Um nó da classificação.",
    parametros: [caminhoNivelCbo, caminhoCodigoCbo, P.lista("incluir", "Blocos extras: filhos, caminho.", { valores: ["filhos", "caminho"] })],
    handle: ({ params, query }) => obterNo(params.nivel, params.codigo, incluir(query)),
  },
  {
    id: "R17",
    grupo: "Classificação",
    caminho: "/codigos",
    resumo: "Decodifica até 200 códigos.",
    parametros: [P.lista("codigos", "De 1 a 200 códigos de 1 a 6 dígitos, separados por vírgula.", { obrigatorio: true })],
    handle: ({ query }) => decodificar(codigosDaLista(query), "lote"),
  },
  {
    id: "R17",
    grupo: "Classificação",
    caminho: "/codigos/:codigo",
    resumo: "Decodifica um código de 1 a 6 dígitos.",
    parametros: [P.caminho("codigo", "Código CBO de 1 a 6 dígitos, com ou sem hífen.")],
    handle: ({ params }) => decodificar([decodeURIComponent(params.codigo)], "unico"),
  },
  {
    id: "R27",
    grupo: "Ocupações",
    caminho: "/ocupacoes/sugerir",
    resumo: "Autocompletar de título e sinônimo.",
    parametros: [
      {
        nome: "q",
        onde: "query",
        tipo: "string",
        descricao: "Início do título ou do sinônimo. Casa por prefixo do texto inteiro, a partir de 1 caractere.",
        obrigatorio: true,
        maxCaracteres: TETO.consultaCaracteres,
        maxTermos: TETO.consultaTermos,
      },
      P.limite(8, 50),
    ],
    handle: ({ query }) => sugerir(texto(query, "q") ?? "", limite(query)),
  },
  {
    id: "R26",
    grupo: "Ocupações",
    caminho: "/ocupacoes/comparar",
    resumo: "Compara de 2 a 5 ocupações. Cálculo derivado.",
    parametros: [
      P.lista("codigos", "De 2 a 5 códigos de ocupação, separados por vírgula. O primeiro é a origem.", { obrigatorio: true }),
      P.escolha("dimensao", "Dimensão comparada.", DIMENSOES_COMPARAVEIS, "habilidades"),
      grauMinimo("importancia_min", "importância"),
    ],
    handle: ({ query }) => comparar(codigosDaLista(query), escolha(query, "dimensao")!, inteiro(query, "importancia_min")),
  },
  {
    id: "R20",
    grupo: "Ocupações",
    caminho: "/ocupacoes",
    csv: true,
    resumo: "Lista de ocupações das duas camadas.",
    parametros: filtroP(),
    handle: ({ query }) => listarOcupacoes(filtro(query)),
  },
  {
    id: "R22",
    grupo: "Ocupações",
    caminho: "/ocupacoes/:codigo/sinonimos",
    resumo: "Sinônimos da ocupação, com fonte.",
    parametros: [caminhoCodigoOcupacao],
    handle: ({ params }) => listarSinonimosDaOcupacao(params.codigo),
  },
  {
    id: "R23",
    grupo: "Ocupações",
    caminho: "/ocupacoes/:codigo/atividades",
    resumo: "Perfil ocupacional da CBO.",
    parametros: [
      caminhoCodigoOcupacao,
      P.codigo("area", "Sigla de uma área. A sigla não se compara entre ocupações."),
      P.escolha("transversais", "O que fazer com as áreas transversais Y e Z.", TRANSVERSAIS, "incluir"),
      P.q("Busca nas atividades e no nome da área."),
      P.escolha("modo", "completo lista as atividades; resumo devolve só as áreas e a contagem.", ["completo", "resumo"], "completo"),
    ],
    handle: ({ params, query }) =>
      atividades(params.codigo, {
        area: texto(query, "area"),
        transversais: escolha(query, "transversais"),
        q: texto(query, "q"),
        modo: escolha(query, "modo"),
      }),
  },
  {
    id: "R24",
    grupo: "Ocupações",
    caminho: "/ocupacoes/:codigo/competencias",
    resumo: "Itens de conhecimento, habilidade e atitude.",
    parametros: [
      caminhoCodigoOcupacao,
      P.escolha("dimensao", "Qual dimensão devolver. Ausente: as três.", DIMENSOES_CHA),
      grauMinimo("importancia_min", "importância"),
      grauMinimo("frequencia_min", "frequência"),
      grauMinimo("profundidade_min", "profundidade"),
      P.codigo("ramo", "Código de um termo do vocabulário; só itens sob ele."),
      P.codigo("nivel_ramo", "Nível do termo de ramo, quando o código existe em mais de um nível."),
      P.booleano("excluir_baldes", "true para tirar os baldes (segmento 90 ou 99)."),
      ...P.paginacao(20, 100),
    ],
    handle: ({ params, query }) =>
      competencias(params.codigo, {
        dimensao: escolha(query, "dimensao"),
        importanciaMin: inteiro(query, "importancia_min"),
        frequenciaMin: inteiro(query, "frequencia_min"),
        profundidadeMin: inteiro(query, "profundidade_min"),
        ramo: texto(query, "ramo"),
        nivelRamo: texto(query, "nivel_ramo"),
        excluirBaldes: booleano(query, "excluir_baldes"),
        incluirConceitos: true,
        limite: limite(query),
        deslocamento: deslocamento(query),
      }),
  },
  {
    id: "R25",
    grupo: "Ocupações",
    caminho: "/ocupacoes/:codigo/similares",
    resumo: "Ocupações com competências parecidas. Cálculo derivado.",
    parametros: [
      caminhoCodigoOcupacao,
      P.escolha("dimensao", "Dimensão comparada.", DIMENSOES_COMPARAVEIS, "habilidades"),
      P.escolha("escopo", "Onde procurar as parecidas.", ["todas", "mesma_familia", "mesmo_grande_grupo", "fora_da_familia"], "todas"),
      P.limite(20, 50),
    ],
    handle: ({ params, query }) => similares(params.codigo, escolha(query, "dimensao")!, escolha(query, "escopo")!, limite(query)),
  },
  {
    id: "R21",
    grupo: "Ocupações",
    caminho: "/ocupacoes/:codigo",
    resumo: "Ficha integrada da CBO e do QBQ.",
    parametros: [
      caminhoCodigoOcupacao,
      P.lista("incluir", "Blocos extras da ficha.", { valores: ["sinonimos", "atividades", "competencias", "perfil_ocupacional"] }),
    ],
    handle: ({ params, query }) => {
      const extras = incluir(query);
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
    parametros: [
      P.q("Texto.", true),
      P.lista("tipos", "Quais tipos buscar. Padrão: todos.", { valores: TIPOS_BUSCA }),
      P.limite(10, 50),
    ],
    handle: ({ query }) => buscaUnificada(texto(query, "q") ?? "", lista(query, "tipos") ?? TIPOS_BUSCA, limite(query)),
  },
  {
    id: "R31",
    grupo: "Busca",
    caminho: "/sinonimos",
    csv: true,
    resumo: "Do nome de mercado ao código oficial.",
    parametros: filtroP({ busca: false, ordenar: false }).map((item) =>
      item.nome === "q" ? P.q("Texto do sinônimo. Obrigatório sem filtro de hierarquia.") : item,
    ),
    handle: ({ query }) => buscarSinonimos(filtro(query, { busca: false, ordenar: false })),
  },
  {
    id: "R32",
    grupo: "Busca",
    caminho: "/atividades",
    csv: true,
    resumo: "Ocupações por tarefa descrita no perfil.",
    parametros: [
      P.q("Texto da atividade.", true),
      ...hierarquiaP,
      nivelQualificacaoP,
      P.escolha("transversais", "O que fazer com as áreas transversais Y e Z.", TRANSVERSAIS, "incluir"),
      P.lista("buscar_em", "Onde casar q. Padrão atividade,area.", { valores: ["atividade", "area"] }),
      P.escolha("agrupar_por", "ocupacao devolve uma linha por ocupação, com até 3 atividades de exemplo.", ["ocupacao"]),
      ...P.paginacao(20, 100),
    ],
    handle: ({ query }) =>
      buscarAtividades({
        q: texto(query, "q") ?? "",
        prefixo: hierarquia(query),
        nivelQualificacao: faixa(query, "nivel_qualificacao"),
        transversais: escolha(query, "transversais")!,
        buscarEm: (lista(query, "buscar_em") ?? ["atividade", "area"]) as ("atividade" | "area")[],
        agrupar: escolha(query, "agrupar_por") === "ocupacao",
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
    parametros: [
      caminhoVocabulario,
      caminhoNivelTermo,
      caminhoCodigoTermo,
      grauMinimo("importancia_min", "importância"),
      grauMinimo("frequencia_min", "frequência"),
      grauMinimo("profundidade_min", "profundidade"),
      P.booleano("incluir_descendentes", "Agrega os termos-folha abaixo do nó. Padrão true em nó que não é folha."),
      ...hierarquiaP,
      nivelQualificacaoP,
      ...P.paginacao(20, 100),
      P.escolha("ordenar", "Ordem pela importância. Padrão -importancia (maior primeiro).", ["-importancia", "importancia"], "-importancia"),
    ],
    handle: ({ params, query }) =>
      ocupacoesDoTermo(params.vocabulario, params.nivel, params.codigo, {
        importanciaMin: inteiro(query, "importancia_min"),
        frequenciaMin: inteiro(query, "frequencia_min"),
        profundidadeMin: inteiro(query, "profundidade_min"),
        incluirDescendentes: booleano(query, "incluir_descendentes"),
        prefixo: hierarquia(query),
        nivelQualificacao: faixa(query, "nivel_qualificacao"),
        limite: limite(query),
        deslocamento: deslocamento(query),
        ordenar: escolha(query, "ordenar"),
      }),
  },
  {
    id: "R42",
    grupo: "QBQ",
    caminho: "/qbq/vocabularios/:vocabulario/:codigo",
    resumo: "Um termo sem o nível explícito. Se o código existir em mais de um nível, responde 400.",
    parametros: [caminhoVocabulario, caminhoCodigoTermo, incluirTermoP],
    handle: ({ params, query }) => obterTermo(params.vocabulario, undefined, params.codigo, incluir(query).includes("uso")),
  },
  {
    id: "R42",
    grupo: "QBQ",
    caminho: "/qbq/vocabularios/:vocabulario/:nivel/:codigo",
    resumo: "Um termo do vocabulário.",
    parametros: [caminhoVocabulario, caminhoNivelTermo, caminhoCodigoTermo, incluirTermoP],
    handle: ({ params, query }) => obterTermo(params.vocabulario, params.nivel, params.codigo, incluir(query).includes("uso")),
  },
  {
    id: "R41",
    grupo: "QBQ",
    caminho: "/qbq/vocabularios/:vocabulario",
    resumo: "Termos de um vocabulário.",
    parametros: [
      caminhoVocabulario,
      P.codigo("nivel", "Nível do vocabulário."),
      P.codigo("pai", "Código do termo pai; lista só os filhos dele."),
      P.codigo("nivel_pai", "Nível do pai, quando o código existe em mais de um nível."),
      P.q("Busca na descrição do termo."),
      P.escolha("formato", "plano devolve uma lista; arvore devolve a hierarquia a partir da raiz.", ["plano", "arvore"], "plano"),
      P.inteiro("profundidade", "Níveis da árvore quando formato=arvore. Padrão 1.", 1, 4, 1),
      P.booleano("excluir_baldes", "true para tirar os baldes (segmento 90 ou 99)."),
      ...P.paginacao(100, 100),
    ],
    handle: ({ params, query }) =>
      listarTermos(params.vocabulario, {
        nivel: texto(query, "nivel"),
        pai: texto(query, "pai"),
        nivelPai: texto(query, "nivel_pai"),
        q: texto(query, "q"),
        formato: escolha(query, "formato"),
        profundidade: inteiro(query, "profundidade"),
        excluirBaldes: booleano(query, "excluir_baldes"),
        limite: limite(query),
        deslocamento: deslocamento(query),
      }),
  },
  {
    id: "R44",
    grupo: "QBQ",
    caminho: "/qbq/conceitos",
    resumo: "As 96 definições oficiais de habilidades.",
    parametros: [
      P.q("Busca no termo ou no conceito."),
      P.escolha("nivel", "Nível do vocabulário de habilidades.", ["dominios", "categorias", "habilidades"]),
      ...P.paginacao(100, 100),
    ],
    handle: ({ query }) => listarConceitos(texto(query, "q"), escolha(query, "nivel"), limite(query), deslocamento(query)),
  },
  {
    id: "R45",
    grupo: "QBQ",
    caminho: "/qbq/itens",
    resumo: "Busca no texto dos itens, inclusive baldes.",
    parametros: [
      P.q("Texto a buscar na descrição do item.", true),
      P.escolha("dimensao", "Dimensão do item.", DIMENSOES_CHA),
      P.escolha("taxonomia", "Taxonomia de conhecimento da ocupação.", ["conhecimentos-i", "conhecimentos-ii"]),
      P.booleano("somente_baldes", "true para só itens de balde (segmento 90 ou 99)."),
      ...hierarquiaP,
      grauMinimo("importancia_min", "importância"),
      ...P.paginacao(20, 100),
    ],
    handle: ({ query }) =>
      buscarItens({
        q: texto(query, "q") ?? "",
        dimensao: escolha(query, "dimensao"),
        taxonomia: escolha(query, "taxonomia"),
        somenteBaldes: booleano(query, "somente_baldes"),
        prefixo: hierarquia(query),
        importanciaMin: inteiro(query, "importancia_min"),
        limite: limite(query),
        deslocamento: deslocamento(query),
      }),
  },
  {
    id: "R46",
    grupo: "QBQ",
    caminho: "/qbq/nao-classificadas",
    csv: true,
    resumo: "Ocupações sem nível, com a justificativa oficial.",
    parametros: [P.q("Busca no título ou na justificativa."), ...hierarquiaP, ...P.paginacao(100, 100)],
    handle: ({ query }) => naoClassificadas(texto(query, "q"), hierarquia(query), limite(query), deslocamento(query)),
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
    csv: true,
    resumo: "Onde CBO e QBQ não coincidem.",
    parametros: [
      P.escolha("situacao", "Tipo de divergência.", DIVERGENCIAS),
      ...hierarquiaP,
      P.q("Busca no título CBO ou QBQ."),
      ...P.paginacao(100, 100),
    ],
    handle: ({ query }) => cobertura(escolha(query, "situacao"), hierarquia(query), texto(query, "q"), limite(query), deslocamento(query)),
  },
  { id: "R60", grupo: "Estatísticas", caminho: "/estatisticas", resumo: "Contagens gerais dos conjuntos.", parametros: [], handle: () => estatisticas() },
  {
    id: "R61",
    grupo: "Estatísticas",
    caminho: "/estatisticas/niveis",
    resumo: "Distribuição dos níveis. Cálculo derivado.",
    parametros: [
      P.escolha("dimensao_nivel", "Qual nível do QBQ.", ["qualificacao", "conhecimento", "habilidade", "atitude"], "qualificacao"),
      P.escolha("agrupar_por", "Nível da CBO pelo qual agrupar.", ["grande_grupo", "subgrupo_principal", "subgrupo", "familia"]),
      ...hierarquiaP,
    ],
    handle: ({ query }) => estatisticasNiveis(escolha(query, "dimensao_nivel")!, escolha(query, "agrupar_por"), hierarquia(query)),
  },
  {
    id: "R62",
    grupo: "Estatísticas",
    caminho: "/estatisticas/competencias",
    resumo: "Termos mais exigidos. Cálculo derivado.",
    parametros: [
      { ...P.escolha("vocabulario", "Vocabulário.", VOCABULARIOS), obrigatorio: true },
      P.codigo("nivel", "Nível do vocabulário. Padrão: o nível folha."),
      ...hierarquiaP,
      P.inteiro("nivel_qualificacao", "Só ocupações com este nível de qualificação.", 1, 8),
      P.escolha("ordenar", "Ordem da lista.", ["-ocupacoes", "-importancia_media"], "-ocupacoes"),
      P.booleano("excluir_baldes", "true para tirar os baldes (segmento 90 ou 99)."),
      P.limite(20, 100),
    ],
    handle: ({ query }) => {
      const vocabulario = escolha(query, "vocabulario");
      if (!vocabulario) throw parametro("vocabulario", "Informe o vocabulário.", VOCABULARIOS);
      return estatisticasCompetencias({
        vocabulario,
        nivel: texto(query, "nivel"),
        prefixo: hierarquia(query),
        nivelQualificacao: inteiro(query, "nivel_qualificacao"),
        ordenar: escolha(query, "ordenar"),
        excluirBaldes: booleano(query, "excluir_baldes"),
        limite: limite(query),
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
    csv: true,
    parametros: [P.codigo("pai", "Código do nó pai; lista só os filhos dele."), P.q("Busca no título."), ...P.paginacao(100, 200)],
    handle: ({ query }) => listarNivel(nivel, texto(query, "pai"), texto(query, "q"), limite(query), deslocamento(query)),
  };
}

function agrupar() {
  const grupos = new Map<string, { id: string; caminho: string; resumo: string }[]>();
  for (const rota of rotas) {
    if (rota.caminho === "/openapi.json") continue;
    const listaRotas = grupos.get(rota.grupo) ?? [];
    listaRotas.push({ id: rota.id, caminho: rota.caminho === "/" ? PREFIXO_API : api(rota.caminho), resumo: rota.resumo });
    grupos.set(rota.grupo, listaRotas);
  }
  return [...grupos.entries()].map(([nome, itens]) => ({ nome, rotas: itens }));
}

/** Documento OpenAPI 3.1, gerado das declarações das rotas. */
export function documentoOpenApi() {
  return montarOpenApi(rotas);
}
