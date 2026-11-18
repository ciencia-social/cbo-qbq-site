import { buscarAtividades } from "@/consulta/busca";
import { listarNivel, obterNo } from "@/consulta/cbo";
import { listarOcupacoes, buscarSinonimos, type FiltroOcupacao } from "@/consulta/ocupacao";
import { Problema } from "@/http/erros";
import { formato } from "@/ui/formato";

export const POR_PAGINA = 20;

export type Parametros = Record<string, string | undefined>;

export type NoArvore = {
  codigo: string;
  titulo: string;
  total: number;
  filhos?: NoArvore[];
};

type Resumo = {
  codigo: string;
  codigo_formatado: string;
  titulo_cbo: string | null;
  titulo_qbq: string | null;
  familia: { codigo: string; titulo: string | null } | null;
  nivel_qualificacao: number | null;
  situacao_qbq: string;
  casou_em?: string;
  trecho?: string;
};

export type LinhaBusca = {
  casou: string;
  trecho: string;
  codigo: string;
  codigoFormatado: string;
  titulo: string;
  familia: string;
  nivel: string;
};

export type VistaOcupacoes = {
  q: string;
  prefixo?: string;
  grandeGrupo: string;
  nivel: string;
  situacao: string;
  buscarEm: "titulo_sinonimo" | "sintese" | "atividade";
  arvore: NoArvore[];
  grupos: { value: string; label: string }[];
  no?: { codigo: string; titulo: string; caminho: string; total: number };
  ocupacoes: { codigo: string; codigoFormatado: string; titulo: string; nivel: string; situacao: string }[];
  busca?: { total: number; sinonimos?: number; linhas: LinhaBusca[]; deslocamento: number };
  vazio: boolean;
};

const NIVEIS = ["grandes-grupos", "subgrupos-principais", "subgrupos", "familias"] as const;

function texto(params: Parametros, nome: string) {
  const valor = params[nome];
  return valor?.trim() ? valor.trim() : undefined;
}

function nos(nivel: (typeof NIVEIS)[number], pai?: string): NoArvore[] {
  const saida = listarNivel(nivel, pai, undefined, 400, 0);
  return (saida.dados as { codigo: string; titulo: string; total_ocupacoes: number }[]).map((no) => ({
    codigo: no.codigo,
    titulo: no.titulo,
    total: no.total_ocupacoes,
  }));
}

export function arvoreAberta(prefixo?: string): NoArvore[] {
  const grupos = nos("grandes-grupos");
  if (!prefixo) return grupos;
  const cadeia = [1, 2, 3, 4].filter((tamanho) => prefixo.length >= tamanho).map((tamanho) => prefixo.slice(0, tamanho));
  const pendurar = (lista: NoArvore[], profundidade: number) => {
    const codigo = cadeia[profundidade];
    const nivelFilho = NIVEIS[profundidade + 1];
    if (!codigo || !nivelFilho) return;
    const no = lista.find((item) => item.codigo === codigo);
    if (!no) return;
    no.filhos = nos(nivelFilho, no.codigo);
    pendurar(no.filhos, profundidade + 1);
  };
  pendurar(grupos, 0);
  return grupos;
}

function filtroBase(params: Parametros, prefixo: string | undefined, deslocamento: number): FiltroOcupacao {
  const nivel = texto(params, "nivel_qualificacao");
  return {
    buscarEm: ["titulo", "sinonimo"],
    prefixo,
    nivelQualificacao: nivel ? { min: Number(nivel), max: Number(nivel) } : undefined,
    situacaoQbq: texto(params, "situacao_qbq"),
    limite: POR_PAGINA,
    deslocamento,
  };
}

function tituloDe(item: { titulo_cbo: string | null; titulo_qbq: string | null }) {
  return item.titulo_cbo ?? item.titulo_qbq ?? "Sem título nas duas camadas";
}

function linhaOcupacao(item: Resumo) {
  return {
    codigo: item.codigo,
    codigoFormatado: item.codigo_formatado,
    titulo: tituloDe(item),
    nivel: item.nivel_qualificacao == null ? "s/d" : String(item.nivel_qualificacao),
    situacao: item.situacao_qbq,
  };
}

export function carregarOcupacoes(params: Parametros): VistaOcupacoes {
  const q = texto(params, "q") ?? "";
  const grandeGrupo = texto(params, "grande_grupo") ?? "";
  const prefixoInformado = texto(params, "prefixo");
  const prefixo =
    prefixoInformado && (!grandeGrupo || prefixoInformado.startsWith(grandeGrupo)) ? prefixoInformado : grandeGrupo || undefined;
  const buscarEm = (texto(params, "buscar_em") ?? "titulo_sinonimo") as VistaOcupacoes["buscarEm"];
  const deslocamento = Math.max(0, Number(texto(params, "deslocamento") ?? 0) || 0);
  const grupos = nos("grandes-grupos").map((no) => ({ value: no.codigo, label: `${no.codigo} · ${no.titulo}` }));
  let no: VistaOcupacoes["no"];
  let ocupacoes: VistaOcupacoes["ocupacoes"] = [];
  if (prefixo) {
    try {
      const nivel = ["grandes-grupos", "subgrupos-principais", "subgrupos", "familias"][prefixo.length - 1];
      if (nivel) {
        const dados = obterNo(nivel, prefixo, ["caminho"]).dados as {
          codigo: string;
          titulo: string;
          caminho?: { codigo: string }[];
        };
        const caminho = (dados.caminho ?? []).map((item) => item.codigo);
        no = { codigo: dados.codigo, titulo: dados.titulo, caminho: caminho.join(" → "), total: 0 };
      }
      const lista = listarOcupacoes({ ...filtroBase(params, prefixo, 0), q: undefined, limite: prefixo.length === 4 ? 50 : POR_PAGINA });
      ocupacoes = (lista.dados as Resumo[]).map(linhaOcupacao);
      if (no) no = { ...no, total: lista.total ?? ocupacoes.length };
    } catch (erro) {
      if (!(erro instanceof Problema)) throw erro;
    }
  }
  let busca: VistaOcupacoes["busca"];
  if (q) {
    if (buscarEm === "atividade") {
      const saida = buscarAtividades({
        q,
        prefixo,
        nivelQualificacao: filtroBase(params, prefixo, 0).nivelQualificacao,
        transversais: "excluir",
        agrupar: true,
        limite: POR_PAGINA,
        deslocamento,
      });
      const gruposAtividade = saida.dados as {
        codigo: string;
        codigo_formatado: string;
        titulo_cbo: string | null;
        titulo_qbq: string | null;
        familia: { codigo: string } | null;
        nivel_qualificacao: number | null;
        atividades: { descricao: string }[];
      }[];
      busca = {
        total: saida.total ?? gruposAtividade.length,
        deslocamento,
        linhas: gruposAtividade.map((item) => ({
          casou: "atividade",
          trecho: item.atividades[0]?.descricao ?? "",
          codigo: item.codigo,
          codigoFormatado: item.codigo_formatado,
          titulo: item.titulo_cbo ?? item.titulo_qbq ?? "Sem título",
          familia: item.familia?.codigo ?? item.codigo.slice(0, 4),
          nivel: item.nivel_qualificacao == null ? "s/d" : String(item.nivel_qualificacao),
        })),
      };
    } else if (buscarEm === "sintese") {
      const saida = listarOcupacoes({
        ...filtroBase(params, prefixo, deslocamento),
        q,
        buscarEm: ["titulo", "sinonimo", "sintese"],
      });
      busca = {
        total: saida.total ?? 0,
        deslocamento,
        linhas: (saida.dados as Resumo[]).map((item) => ({
          casou: item.casou_em ?? "sintese",
          trecho: item.trecho ?? "",
          codigo: item.codigo,
          codigoFormatado: item.codigo_formatado,
          titulo: tituloDe(item),
          familia: item.familia?.codigo ?? item.codigo.slice(0, 4),
          nivel: item.nivel_qualificacao == null ? "s/d" : String(item.nivel_qualificacao),
        })),
      };
    } else {
      const sinonimos = buscarSinonimos({ ...filtroBase(params, prefixo, deslocamento), q, buscarEm: ["sinonimo"] });
      const titulos = listarOcupacoes({ ...filtroBase(params, prefixo, 0), q, buscarEm: ["titulo"], limite: 100, deslocamento: 0 });
      const linhas = (sinonimos.dados as (Resumo & { sinonimo: string; trecho?: string })[]).map((item) => ({
        casou: "sinônimo",
        trecho: item.sinonimo,
        codigo: item.codigo,
        codigoFormatado: item.codigo_formatado,
        titulo: item.titulo_cbo ?? "Sem título na CBO",
        familia: item.codigo.slice(0, 4),
        nivel: item.nivel_qualificacao == null ? "s/d" : String(item.nivel_qualificacao),
      }));
      if (deslocamento === 0) {
        const ja = new Set(linhas.map((item) => item.codigo));
        for (const item of titulos.dados as Resumo[]) {
          if (item.casou_em === "titulo" && !ja.has(item.codigo)) {
            linhas.push({
              casou: "título",
              trecho: item.trecho ?? tituloDe(item),
              codigo: item.codigo,
              codigoFormatado: item.codigo_formatado,
              titulo: tituloDe(item),
              familia: item.familia?.codigo ?? item.codigo.slice(0, 4),
              nivel: item.nivel_qualificacao == null ? "s/d" : String(item.nivel_qualificacao),
            });
          }
        }
      }
      const totalSinonimos = sinonimos.total ?? 0;
      const titulosExtras = deslocamento === 0 ? linhas.length - (sinonimos.dados as unknown[]).length : 0;
      busca = { total: totalSinonimos + titulosExtras, sinonimos: totalSinonimos, deslocamento, linhas };
    }
  }
  return {
    q,
    prefixo,
    grandeGrupo: prefixo?.[0] ?? grandeGrupo,
    nivel: texto(params, "nivel_qualificacao") ?? "",
    situacao: texto(params, "situacao_qbq") ?? "",
    buscarEm: buscarEm === "sintese" || buscarEm === "atividade" ? buscarEm : "titulo_sinonimo",
    arvore: arvoreAberta(prefixo),
    grupos,
    no,
    ocupacoes,
    busca,
    vazio: Boolean(q) && (busca?.total ?? 0) === 0,
  };
}

export function rotuloSituacao(situacao: string) {
  if (situacao === "classificada") return "classificada";
  if (situacao === "nao_classificada") return "não classificada";
  if (situacao === "sem_nivel_sem_justificativa") return "sem nível e sem justificativa";
  if (situacao === "ausente_no_qbq") return "ausente no QBQ";
  return situacao;
}

export function totalFormatado(total: number) {
  return formato(total);
}
