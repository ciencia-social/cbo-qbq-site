import { decodificar, listarNivel } from "@/consulta/cbo";
import { coberturaResumo, estatisticas } from "@/consulta/derivado";
import { buscarSinonimos, comparar, listarOcupacoes, obterOcupacao } from "@/consulta/ocupacao";
import { vocabularios } from "@/consulta/qbq";
import { formato, tresCasas } from "@/ui/formato";
import { VERSAO_DADOS } from "@/versao";
import type { Dialogo } from "@/site/ilustracao";

type OcupacaoExemplo = {
  codigo: string;
  codigo_formatado: string;
  situacao_qbq: string;
  divergencia: string | null;
  caminho: { codigo: string; titulo: string }[];
  cbo: { titulo: string; familia: string } | null;
  qbq: { niveis: { conhecimento: number | null; habilidade: number | null; atitude: number | null; qualificacao: number | null }; taxonomia_conhecimento: string | null } | null;
  contagens: { sinonimos: number; atividades: number; conhecimentos: number; habilidades: number };
};

type Comparacao = {
  similaridade: { a: string; b: string; similaridade: number | null }[];
  em_comum: { termo: string | null; graus: Record<string, { importancia: number | null }> }[];
  exclusivos: Record<string, unknown[]>;
};

const ROTULO_NIVEL: Record<string, [string, string]> = {
  dominios: ["domínio", "domínios"],
  areas: ["área", "áreas"],
  campos: ["campo", "campos"],
  conhecimentos: ["conhecimento", "conhecimentos"],
  elementos: ["elemento", "elementos"],
  categorias: ["categoria", "categorias"],
  habilidades: ["habilidade", "habilidades"],
  atitudes: ["atitude", "atitudes"],
};

const NOME_VOCAB: Record<string, string> = {
  habilidades: "Habilidades",
  "conhecimentos-i": "Conhecimentos I",
  "conhecimentos-ii": "Conhecimentos II",
  atitudes: "Atitudes",
};

const ICONE_VOCAB: Record<string, string> = {
  habilidades: "wrench",
  "conhecimentos-i": "book-open",
  "conhecimentos-ii": "library",
  atitudes: "scale",
};

const ESCOPO_VOCAB: Record<string, string> = {
  habilidades: "todas as ocupações",
  "conhecimentos-i": "níveis 1 a 5",
  "conhecimentos-ii": "níveis 6 a 8",
  atitudes: "todas as ocupações",
};

function juntar(partes: string[]) {
  if (partes.length < 2) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

function dialogoSinonimo(): Dialogo {
  const achados = buscarSinonimos({ q: "programador de internet", buscarEm: ["sinonimo"], limite: 5, deslocamento: 0 });
  const primeiro = (achados.dados as { codigo: string }[])[0];
  const ficha = obterOcupacao(primeiro?.codigo ?? "317105").dados as OcupacaoExemplo;
  const familia = ficha.caminho.find((passo) => passo.codigo.length === 4);
  const total = achados.total ?? 0;
  return {
    rotulo: "Sinônimo",
    user: "Qual é o código CBO de quem trabalha como programador de internet?",
    tool: "ocupacao_buscar",
    args: '{ consulta: "programador de internet" }',
    ok: `→ ${total} ${total === 1 ? "ocupação" : "ocupações"}, casou em sinônimo`,
    bot:
      total === 1
        ? "Na CBO, “Programador de internet” é sinônimo de uma ocupação só:"
        : `Na CBO, “Programador de internet” casa com ${total} ocupações. A primeira é:`,
    cardCod: ficha.codigo_formatado,
    cardTitulo: ficha.cbo?.titulo ?? "Sem título na CBO",
    cardLinhas: [
      `Família ${familia?.codigo ?? ""} · ${familia?.titulo ?? ""}`,
      `QBQ: nível ${ficha.qbq?.niveis.qualificacao ?? "s/d"} de qualificação`,
    ],
    fecho: "Quer ver as atividades e as competências que ela exige?",
  };
}

function dialogoTransicao(): Dialogo {
  const saida = comparar(["212420", "212405"], "habilidades").dados as Comparacao;
  const par = saida.similaridade.find((item) => item.a === "212420" && item.b === "212405") ?? saida.similaridade[0];
  const nomes = ["PROGRAMAÇÃO DE OPERAÇÕES", "ANÁLISE DE OPERAÇÕES"];
  const sobem = nomes
    .map((nome) => saida.em_comum.find((item) => item.termo === nome))
    .filter((item): item is NonNullable<typeof item> => item != null);
  const novas = saida.exclusivos["212405"]?.length ?? 0;
  const noDesenvolvimento = saida.em_comum.length + novas;
  return {
    rotulo: "Transição",
    user: "O que falta a um analista de suporte computacional para trabalhar como analista de desenvolvimento de sistemas?",
    tool: "ocupacao_comparar",
    args: '{ codigos: ["212420", "212405"] }',
    ok: `→ similaridade ${par?.similaridade == null ? "s/d" : tresCasas(par.similaridade)}`,
    bot:
      novas === 0
        ? `Pelas habilidades do QBQ, nenhuma é nova: as ${noDesenvolvimento} do analista de desenvolvimento já estão no perfil do suporte. A diferença está na importância de duas delas:`
        : `Pelas habilidades do QBQ, ${novas} aparecem só no desenvolvimento. A similaridade considera as demais.`,
    cardCod: "2124-20 → 2124-05",
    cardTitulo: "Importância, de 1 a 5",
    cardLinhas: sobem.slice(0, 2).map((item) => `${item.termo}: ${item.graus["212420"]?.importancia ?? "s/d"} → ${item.graus["212405"]?.importancia ?? "s/d"}`),
    fecho: "A similaridade é um cálculo do projeto, não dado oficial.",
  };
}

function dialogoValidacao(): Dialogo {
  const lote = decodificar(["2124-99"], "lote").dados as { itens: { existe: boolean; ancestral?: { codigo: string; titulo: string } | null }[] };
  const item = lote.itens[0];
  const familia = item?.ancestral?.codigo ?? "2124";
  const ocupacoes = listarOcupacoes({ prefixo: familia, buscarEm: ["titulo"], limite: 50, deslocamento: 0 }).dados as { codigo_formatado: string; titulo_cbo: string | null }[];
  const [primeira, ...resto] = ocupacoes;
  return {
    rotulo: "Validação",
    user: "O código CBO 2124-99 existe?",
    tool: "codigo_decodificar",
    args: '{ codigos: ["2124-99"] }',
    ok: `→ existe: ${item?.existe ? "true" : "false"}`,
    bot: `Não existe. O nível mais próximo que existe é a família ${familia}, com ${ocupacoes.length} ocupações:`,
    cardCod: familia,
    cardTitulo: item?.ancestral?.titulo ?? "",
    cardLinhas: [
      `${primeira?.codigo_formatado ?? ""} ${primeira?.titulo_cbo ?? ""}`.trim(),
      resto.length ? `${resto.slice(0, -1).map((ocupacao) => ocupacao.codigo_formatado).join(", ")} e ${resto[resto.length - 1].codigo_formatado}` : "",
    ].filter(Boolean),
    fecho: ocupacoes.length === 6 ? "Quer que eu mostre as seis com o nível de cada uma?" : `Quer que eu mostre as ${ocupacoes.length} com o nível de cada uma?`,
  };
}

export function carregarInicio() {
  const numeros = estatisticas().dados as {
    grandes_grupos: number;
    ocupacoes: number;
    ocupacoes_cbo: number;
    sinonimos: number;
    areas: number;
    atividades: number;
    conhecimentos: number;
    habilidades: number;
    atitudes: number;
    conceitos: number;
  };
  const cobertura = coberturaResumo().dados as {
    por_divergencia: { so_cbo: number; so_qbq: number; titulo_divergente: number };
    por_situacao_qbq: Record<string, number>;
  };
  const grupos = (listarNivel("grandes-grupos", undefined, undefined, 20).dados as { codigo: string; titulo: string; total_ocupacoes: number }[]).map((grupo) => ({
    codigo: grupo.codigo,
    titulo: grupo.titulo,
    total: formato(grupo.total_ocupacoes),
  }));
  const ordem = ["habilidades", "conhecimentos-i", "conhecimentos-ii", "atitudes"];
  const vocabs = (vocabularios().dados as { id: string; niveis: { nivel: string; total: number }[]; tem_conceitos: boolean }[])
    .map((vocab) => {
    const partes = vocab.niveis.map((nivel) => {
      const par = ROTULO_NIVEL[nivel.nivel] ?? [nivel.nivel, nivel.nivel];
      return `${formato(nivel.total)} ${nivel.total === 1 ? par[0] : par[1]}`;
    });
    const frase = juntar(partes);
    return {
      icon: ICONE_VOCAB[vocab.id] ?? "book-open",
      slug: vocab.id,
      nome: NOME_VOCAB[vocab.id] ?? vocab.id,
      escopo: ESCOPO_VOCAB[vocab.id] ?? "",
      niveis: vocab.tem_conceitos ? `${frase}, com ${formato(numeros.conceitos)} definições oficiais` : frase,
    };
  }).sort((a, b) => ordem.indexOf(a.slug) - ordem.indexOf(b.slug));
  const exemplo = obterOcupacao("212405").dados as OcupacaoExemplo;
  const divergencia = cobertura.por_divergencia;
  return {
    versao: VERSAO_DADOS,
    numeros: {
      ocupacoes: formato(numeros.ocupacoes),
      detalheOcupacoes: `${formato(numeros.ocupacoes_cbo)} na CBO e ${formato(numeros.ocupacoes - numeros.ocupacoes_cbo)} só no QBQ`,
      atividades: formato(numeros.atividades),
      areas: formato(numeros.areas),
      competencias: formato(numeros.conhecimentos + numeros.habilidades + numeros.atitudes),
      sinonimos: formato(numeros.sinonimos),
      grandesGrupos: numeros.grandes_grupos,
    },
    grupos,
    vocabularios: vocabs,
    cobertura: {
      total: divergencia.so_cbo + divergencia.so_qbq + divergencia.titulo_divergente,
      soCbo: divergencia.so_cbo,
      soQbq: divergencia.so_qbq,
      titulo: divergencia.titulo_divergente,
      semNivel: (cobertura.por_situacao_qbq.nao_classificada ?? 0) + (cobertura.por_situacao_qbq.sem_nivel_sem_justificativa ?? 0),
    },
    dialogos: [dialogoSinonimo(), dialogoTransicao(), dialogoValidacao()],
    exemplo: JSON.stringify(
      {
        dados: {
          codigo: exemplo.codigo,
          codigo_formatado: exemplo.codigo_formatado,
          situacao_qbq: exemplo.situacao_qbq,
          divergencia: exemplo.divergencia,
          cbo: exemplo.cbo ? { titulo: exemplo.cbo.titulo, familia: exemplo.cbo.familia } : null,
          qbq: exemplo.qbq
            ? { niveis: exemplo.qbq.niveis, taxonomia_conhecimento: exemplo.qbq.taxonomia_conhecimento }
            : null,
          contagens: {
            sinonimos: exemplo.contagens.sinonimos,
            atividades: exemplo.contagens.atividades,
            conhecimentos: exemplo.contagens.conhecimentos,
            habilidades: exemplo.contagens.habilidades,
          },
        },
        meta: { versao_dados: VERSAO_DADOS, avisos: [] },
      },
      null,
      2,
    ),
  };
}

export type VistaInicio = ReturnType<typeof carregarInicio>;
