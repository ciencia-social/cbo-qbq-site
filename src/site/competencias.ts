import { listarNivel } from "@/consulta/cbo";
import { coberturaResumo } from "@/consulta/derivado";
import { termosDoCodigo } from "@/consulta/cache";
import { buscarTermos, listarTermos, obterTermo, ocupacoesDoTermo, vocabularios } from "@/consulta/qbq";
import { Problema } from "@/http/erros";
import { formato } from "@/ui/formato";
import { NIVEIS_VOCAB, VOCABULARIOS } from "@/tipos";

const ORDEM = ["habilidades", "conhecimentos-i", "conhecimentos-ii", "atitudes"];
const POR_PAGINA = 20;

type Termo = {
  vocabulario: string;
  nivel: string;
  codigo: string;
  descricao: string;
  pai: { codigo: string; nivel: string } | null;
  balde: boolean;
};

export type NoCompetencia = {
  nivel: string;
  codigo: string;
  descricao: string;
  balde: boolean;
  aberto: boolean;
  atual: boolean;
  totalFilhos: number;
  filhos?: NoCompetencia[];
};

function ordenar<T extends { id?: string; slug?: string }>(lista: T[], chave: "id" | "slug") {
  return [...lista].sort((a, b) => ORDEM.indexOf(String(a[chave])) - ORDEM.indexOf(String(b[chave])));
}

function arvore(vocabulario: string, aberto: { nivel: string; codigo: string }[]) {
  const dados = listarTermos(vocabulario, { limite: 10000, deslocamento: 0 }).dados as Termo[];
  const porPai = new Map<string, Termo[]>();
  for (const termo of dados) {
    const chave = termo.pai ? `${termo.pai.nivel}|${termo.pai.codigo}` : "";
    const lista = porPai.get(chave) ?? [];
    lista.push(termo);
    porPai.set(chave, lista);
  }
  const chaves = new Set(aberto.map((passo) => `${passo.nivel}|${passo.codigo}`));
  const atual = aberto.length ? `${aberto[aberto.length - 1].nivel}|${aberto[aberto.length - 1].codigo}` : "";
  const visitar = (chave: string): NoCompetencia[] =>
    (porPai.get(chave) ?? []).map((termo) => {
      const id = `${termo.nivel}|${termo.codigo}`;
      const filhos = porPai.get(id) ?? [];
      const estaAberto = chaves.has(id);
      return {
        nivel: termo.nivel,
        codigo: termo.codigo,
        descricao: termo.descricao,
        balde: termo.balde,
        aberto: estaAberto,
        atual: id === atual,
        totalFilhos: filhos.length,
        filhos: estaAberto ? visitar(id) : undefined,
      };
    });
  return visitar("");
}

function resumoVocabulario(id: string) {
  const lista = vocabularios().dados as { id: string; niveis: { nivel: string; total: number }[] }[];
  const vocab = lista.find((item) => item.id === id);
  return (vocab?.niveis ?? []).map((nivel) => `${formato(nivel.total)} ${nivel.nivel}`).join(" · ");
}

export function vocabulariosDoSite() {
  return ordenar(
    (vocabularios().dados as { id: string; niveis: { nivel: string; total: number }[] }[]).map((item) => ({
      id: item.id,
      resumo: item.niveis.map((nivel) => `${formato(nivel.total)} ${nivel.nivel}`).join(" · "),
    })),
    "id",
  );
}

export function carregarIndice(vocabulario = "habilidades", q?: string) {
  const id = VOCABULARIOS.includes(vocabulario) ? vocabulario : "habilidades";
  let busca: { termos: { vocabulario: string; nivel: string; codigo: string; descricao: string; trecho: string }[]; descricoes: { ocupacao: string; titulo: string | null; descricao: string }[]; totalTermos: number } | undefined;
  if (q) {
    const saida = buscarTermos({ q, vocabularios: [id], buscarEm: ["vocabulario", "conceito", "descricao_item"], limite: POR_PAGINA }).dados as {
      termos: { vocabulario: string; nivel: string; codigo: string; descricao: string; trecho: string }[];
      total_termos: number;
      descricoes_item?: { ocupacao: string; titulo: string | null; descricao_item: string }[];
    };
    busca = {
      termos: saida.termos ?? [],
      totalTermos: saida.total_termos ?? 0,
      descricoes: (saida.descricoes_item ?? []).map((item) => ({ ocupacao: item.ocupacao, titulo: item.titulo, descricao: item.descricao_item })),
    };
  }
  return { vocabulario: id, resumo: resumoVocabulario(id), arvore: arvore(id, []), busca, vocabularios: vocabulariosDoSite() };
}

type Uso = { ocupacoes: number; importancia_media?: number | null };
type FichaTermo = Termo & {
  caminho: { nivel: string; codigo: string; descricao: string }[];
  conceito: { conceito: string } | null;
  motivo_conceito?: { mensagem: string } | null;
  uso?: Uso;
};

export function carregarTermo(vocabulario: string, nivel: string, codigo: string, consulta: { importanciaMin?: number; prefixo?: string; todas?: boolean; deslocamento?: number } = {}) {
  if (!VOCABULARIOS.includes(vocabulario) || !NIVEIS_VOCAB[vocabulario]?.includes(nivel)) {
    return termoAusente(vocabulario, codigo, "O vocabulário ou o nível não existe.");
  }
  try {
    const ficha = obterTermo(vocabulario, nivel, codigo, true).dados as FichaTermo;
    const uso = ficha.uso ?? { ocupacoes: 0, importancia_media: null };
    const limite = consulta.todas ? Math.max(uso.ocupacoes, 1) : POR_PAGINA;
    const lista = ocupacoesDoTermo(vocabulario, nivel, codigo, {
      importanciaMin: consulta.importanciaMin,
      prefixo: consulta.prefixo,
      limite,
      deslocamento: consulta.todas ? 0 : consulta.deslocamento ?? 0,
    }).dados as {
      total: number;
      distribuicao: { por_grande_grupo: Record<string, number>; por_nivel_qualificacao: Record<string, number> };
      ocupacoes: { codigo: string; codigo_formatado: string; titulo_qbq: string | null; titulo_cbo: string | null; nivel_qualificacao: number | null; frequencia: number | null; importancia: number | null }[];
    };
    const comCinco = (ocupacoesDoTermo(vocabulario, nivel, codigo, { importanciaMin: 5, limite: 1, deslocamento: 0 }).dados as { total: number }).total;
    const classificadas = (coberturaResumo().dados as { por_situacao_qbq: Record<string, number> }).por_situacao_qbq.classificada ?? 0;
    const distribuicaoCheia = consulta.importanciaMin || consulta.prefixo
      ? (ocupacoesDoTermo(vocabulario, nivel, codigo, { limite: 1, deslocamento: 0 }).dados as typeof lista).distribuicao
      : lista.distribuicao;
    const pai = ficha.caminho.length > 1 ? ficha.caminho[ficha.caminho.length - 2] : undefined;
    const conceitoPai = pai && vocabulario === "habilidades" ? ((obterTermo(vocabulario, pai.nivel, pai.codigo, false).dados as FichaTermo).conceito?.conceito ?? null) : null;
    const grupos = (listarNivel("grandes-grupos", undefined, undefined, 20).dados as { codigo: string; titulo: string }[]).map((grupo) => ({ value: grupo.codigo, label: `${grupo.codigo} ${grupo.titulo}` }));
    return {
      tipo: "ok" as const,
      vocabulario,
      nivel,
      codigo: ficha.codigo,
      descricao: ficha.descricao,
      balde: ficha.balde,
      caminho: ficha.caminho,
      conceito: ficha.conceito?.conceito ?? null,
      motivo: ficha.motivo_conceito?.mensagem ?? null,
      conceitoPai,
      pai,
      uso,
      comCinco,
      classificadas,
      percentualExigem: classificadas ? Math.round((uso.ocupacoes / classificadas) * 100) : null,
      percentualCinco: uso.ocupacoes ? Math.round((comCinco / uso.ocupacoes) * 100) : null,
      distribuicao: distribuicaoCheia,
      ocupacoes: lista.ocupacoes,
      totalLista: lista.total,
      todas: Boolean(consulta.todas),
      deslocamento: consulta.todas ? 0 : consulta.deslocamento ?? 0,
      importanciaMin: consulta.importanciaMin,
      prefixo: consulta.prefixo,
      grupos,
      resumo: resumoVocabulario(vocabulario),
      arvore: arvore(vocabulario, ficha.caminho),
      vocabularios: vocabulariosDoSite(),
    };
  } catch (erro) {
    if (erro instanceof Problema) return termoAusente(vocabulario, codigo, `O código ${codigo} não existe em ${vocabulario}/${nivel}.`);
    throw erro;
  }
}

/** Termo que não existe: aponta o mesmo código em outros níveis e o índice do vocabulário. */
function termoAusente(vocabulario: string, codigo: string, detalhe: string) {
  const valido = VOCABULARIOS.includes(vocabulario);
  const outros = valido ? termosDoCodigo(vocabulario, codigo) : [];
  const sugestoes = [
    ...outros.map((termo) => ({ href: hrefTermo(vocabulario, termo.nivel, termo.codigo), rotulo: `${termo.codigo} em ${termo.nivel}: ${termo.descricao}` })),
    ...(valido
      ? [{ href: `/competencias/${vocabulario}`, rotulo: `Índice de ${vocabulario}` }]
      : VOCABULARIOS.map((id) => ({ href: `/competencias/${id}`, rotulo: `Índice de ${id}` }))),
  ];
  return { tipo: "ausente" as const, detalhe, sugestoes };
}

export function hrefTermo(vocabulario: string, nivel: string, codigo: string) {
  return `/competencias/${vocabulario}/${nivel}/${encodeURIComponent(codigo)}`;
}

/** O vocabulário existe? A página de índice responde 404 quando não. */
export function vocabularioExiste(vocabulario: string) {
  return VOCABULARIOS.includes(vocabulario);
}

export type VistaTermo = ReturnType<typeof carregarTermo>;
export type VistaIndice = ReturnType<typeof carregarIndice>;
