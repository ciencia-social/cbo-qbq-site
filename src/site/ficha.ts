import { interpretarCodigo } from "@/consulta/cbo";
import { ancestralDe } from "@/consulta/formatar";
import { atividades, comparar, competencias, obterOcupacao, similares } from "@/consulta/ocupacao";
import { Problema } from "@/http/erros";
import { tresCasas } from "@/ui/formato";
import { citacaoFicha } from "@/versao";

export type ConsultaFicha = {
  transversais: "incluir" | "excluir" | "somente";
  dimensao: "habilidades" | "conhecimentos" | "atitudes";
  todas: boolean;
  comparar?: string;
};

type Caminho = { nivel: string; codigo: string; titulo: string };
type Sinonimo = { titulo: string };
type Area = {
  sigla: string;
  nome: string;
  atividades?: { numero: number | null; descricao: string }[];
};
type Item = {
  codigo: string;
  nivel_vocabulario: string;
  termo: string | null;
  descricao_item: string | null;
  graus: { profundidade?: number | null; frequencia?: number | null; importancia: number | null };
  balde: boolean;
  conceito?: { termo: string; conceito: string } | null;
};
type Similar = {
  codigo: string;
  codigo_formatado: string;
  titulo: string | null;
  nivel_qualificacao: number | null;
  similaridade: number;
};
type FichaBruta = {
  codigo: string;
  codigo_formatado: string;
  situacao_qbq: string;
  divergencia: string | null;
  justificativa?: string | null;
  caminho: Caminho[];
  cbo: { titulo: string; sinonimos: Sinonimo[]; vigencia: { desde: string | null } } | null;
  qbq: {
    titulo: string;
    sintese: string | null;
    perfil_ocupacional?: string | null;
    niveis: { conhecimento: number | null; habilidade: number | null; atitude: number | null; qualificacao: number | null };
    taxonomia_conhecimento: string | null;
    vigencia: { desde: string | null };
  } | null;
  contagens: { sinonimos: number; areas: number; atividades: number; conhecimentos: number; habilidades: number; atitudes: number };
};

export type FichaOk = {
  tipo: "ok";
  codigo: string;
  formatado: string;
  titulo: string;
  situacao: string;
  divergencia: string | null;
  justificativa: string | null;
  caminho: Caminho[];
  cbo: FichaBruta["cbo"];
  qbq: FichaBruta["qbq"];
  contagens: FichaBruta["contagens"];
  lead: string | null;
  areas: { sigla: string; nome: string; aberto: boolean; itens: { numero: string; descricao: string }[] }[];
  semPerfil: string | null;
  dimensao: ConsultaFicha["dimensao"];
  transversais: ConsultaFicha["transversais"];
  competencias: Item[];
  totalDimensao: number;
  similares: { codigo: string; formatado: string; titulo: string; nivel: string; valor: number; rotulo: string }[];
  termosOrigem: number;
  comparacao: { outro: string; similaridade: string; comuns: { termo: string; nesta: string; outra: string }[] } | null;
  citacao: string;
};

export type FichaVista =
  | { tipo: "redirect"; para: string }
  | { tipo: "malformado"; detalhe: string; dica?: string }
  | {
      tipo: "ausente";
      entrada: string;
      detalhe: string;
      dica?: string;
      ancestral: { nivel: string; codigo: string; titulo: string; href: string } | null;
      sugestoes: { codigo: string; titulo: string; href: string }[];
    }
  | FichaOk;

function inicio(texto: string | null | undefined) {
  if (!texto || texto === "NULL") return null;
  const corte = texto.indexOf(". ");
  return corte > 0 ? texto.slice(0, corte + 1) : texto;
}

function dataPorExtenso(hoje: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(hoje);
}

const NOME_NIVEL: Record<string, string> = {
  grande_grupo: "o grande grupo",
  subgrupo_principal: "o subgrupo principal",
  subgrupo: "o subgrupo",
  familia: "a família",
};

export function carregarFicha(entrada: string, consulta: ConsultaFicha, hoje = new Date()): FichaVista {
  let canonico: string;
  try {
    canonico = interpretarCodigo(entrada).codigo;
  } catch (erro) {
    if (erro instanceof Problema) return { tipo: "malformado", detalhe: erro.detalhe, dica: erro.dica };
    throw erro;
  }
  if (canonico.length !== 6) {
    return {
      tipo: "malformado",
      detalhe: `O endereço de uma ocupação tem 6 dígitos. "${entrada}" tem ${canonico.length}.`,
      dica: "Use 212405 ou 2124-05. Família e grupos ficam em /ocupacoes.",
    };
  }
  if (entrada !== canonico) return { tipo: "redirect", para: `/ocupacoes/${canonico}` };
  let bruta: FichaBruta;
  try {
    bruta = obterOcupacao(canonico, { perfil: true }).dados as FichaBruta;
  } catch (erro) {
    if (!(erro instanceof Problema)) throw erro;
    const filhos = (erro.sugestoes ?? []) as { codigo: string; titulo?: string | null; nivel?: string }[];
    const ancestral = ancestralDe(canonico);
    return {
      tipo: "ausente",
      entrada,
      detalhe: erro.detalhe,
      dica: ancestral
        ? `O ancestral mais profundo que existe é ${NOME_NIVEL[ancestral.nivel] ?? ancestral.nivel} ${ancestral.codigo} (${ancestral.titulo}).`
        : "Nenhum ancestral desse código existe na CBO.",
      ancestral: ancestral
        ? { nivel: NOME_NIVEL[ancestral.nivel] ?? ancestral.nivel, codigo: ancestral.codigo, titulo: ancestral.titulo, href: `/ocupacoes?prefixo=${ancestral.codigo}` }
        : null,
      sugestoes: filhos.map((filho) => ({
        codigo: filho.codigo,
        titulo: filho.titulo ?? "",
        href: filho.nivel === "ocupacao" || filho.codigo.length === 6 ? `/ocupacoes/${filho.codigo}` : `/ocupacoes?prefixo=${filho.codigo}`,
      })),
    };
  }
  const perfil = atividades(canonico, { transversais: consulta.transversais });
  const dadosAtividades = perfil.dados as { areas: Area[]; motivo?: string };
  const bloco = competencias(canonico, {
    dimensao: consulta.dimensao,
    incluirConceitos: true,
    ...(consulta.todas ? {} : { limite: 20 }),
  }).dados as Record<string, { total: number; itens: Item[]; motivo?: string } | unknown>;
  const chave = consulta.dimensao;
  const dimensao = bloco[chave] as { total: number; itens: Item[] } | undefined;
  const parecidas = similares(canonico, "habilidades", "todas", 5).dados as { similares: Similar[]; termos_origem: number };
  let comparacao: FichaOk["comparacao"] = null;
  if (consulta.comparar) {
    try {
      const lado = comparar([canonico, consulta.comparar], "habilidades").dados as {
        similaridade: { similaridade: number | null }[];
        em_comum: { termo: string | null; graus: Record<string, { importancia: number | null }>; diferenca?: { importancia: number | null } }[];
      };
      const outro = interpretarCodigo(consulta.comparar).codigo;
      comparacao = {
        outro,
        similaridade: lado.similaridade[0]?.similaridade == null ? "s/d" : tresCasas(lado.similaridade[0].similaridade),
        comuns: lado.em_comum
          .filter((item) => item.diferenca?.importancia)
          .sort((a, b) => Math.abs(b.diferenca?.importancia ?? 0) - Math.abs(a.diferenca?.importancia ?? 0))
          .slice(0, 5)
          .map((item) => ({
            termo: item.termo ?? "",
            outra: String(item.graus[outro]?.importancia ?? "s/d"),
            nesta: String(item.graus[canonico]?.importancia ?? "s/d"),
          })),
      };
    } catch (erro) {
      if (!(erro instanceof Problema)) throw erro;
      comparacao = { outro: consulta.comparar, similaridade: "s/d", comuns: [] };
    }
  }
  const titulo = bruta.cbo?.titulo ?? bruta.qbq?.titulo ?? bruta.codigo_formatado;
  return {
    tipo: "ok",
    codigo: bruta.codigo,
    formatado: bruta.codigo_formatado,
    titulo,
    situacao: bruta.situacao_qbq,
    divergencia: bruta.divergencia,
    justificativa: bruta.justificativa ?? null,
    caminho: bruta.caminho,
    cbo: bruta.cbo,
    qbq: bruta.qbq,
    contagens: bruta.contagens,
    lead: inicio(bruta.qbq?.sintese),
    semPerfil: dadosAtividades.motivo ?? null,
    areas: (dadosAtividades.areas ?? []).map((area, indice) => ({
      sigla: area.sigla,
      nome: area.nome,
      aberto: indice === 0,
      itens: (area.atividades ?? []).map((item) => ({ numero: item.numero == null ? "" : String(item.numero), descricao: item.descricao })),
    })),
    dimensao: consulta.dimensao,
    transversais: consulta.transversais,
    competencias: dimensao?.itens ?? [],
    totalDimensao: dimensao?.total ?? 0,
    termosOrigem: parecidas.termos_origem ?? 0,
    similares: (parecidas.similares ?? []).map((item) => ({
      codigo: item.codigo,
      formatado: item.codigo_formatado,
      titulo: item.titulo ?? "Sem título",
      nivel: item.nivel_qualificacao == null ? "s/d" : String(item.nivel_qualificacao),
      valor: item.similaridade,
      rotulo: tresCasas(item.similaridade),
    })),
    comparacao,
    citacao: citacaoFicha(bruta.codigo_formatado, titulo, dataPorExtenso(hoje)),
  };
}
