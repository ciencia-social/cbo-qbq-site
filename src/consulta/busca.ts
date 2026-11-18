import { noCbo, nosDoNivel, ocupacaoPorCodigo } from "@/consulta/cache";
import { fonteDe, resumoOcupacao } from "@/consulta/formatar";
import { listarOcupacoes, type FiltroOcupacao } from "@/consulta/ocupacao";
import { listarConceitos, listarTermos } from "@/consulta/qbq";
import { todos } from "@/dados/banco";
import { parametro } from "@/http/erros";
import { paginar } from "@/http/parametros";
import { ftsConsulta, termosDaConsulta, textoCasa, trecho } from "@/texto";
import type { Faixa, Saida } from "@/tipos";
import { api } from "@/versao";

export function buscaUnificada(q: string, tipos: string[], limite: number): Saida {
  const aceitos = ["ocupacao", "sinonimo", "familia", "atividade", "termo", "conceito"];
  for (const tipo of tipos) if (!aceitos.includes(tipo)) throw parametro("tipos", `Tipo desconhecido: ${tipo}.`, aceitos);
  const filtroBase: FiltroOcupacao = {
    q,
    buscarEm: ["titulo", "sinonimo"],
    limite,
    deslocamento: 0,
  };
  const grupos: Record<string, unknown> = {};
  if (tipos.includes("ocupacao")) {
    const lista = listarOcupacoes(filtroBase);
    grupos.ocupacao = (lista.dados as { codigo: string; titulo_cbo: string | null; casou_em?: string; trecho?: string }[]).map((item) => ({
      tipo: "ocupacao",
      identificador: item.codigo,
      rotulo: item.titulo_cbo,
      casou_em: item.casou_em,
      trecho: item.trecho,
      link: api(`/ocupacoes/${item.codigo}`),
    }));
  }
  if (tipos.includes("sinonimo")) {
    const lista = listarOcupacoes({ ...filtroBase, buscarEm: ["sinonimo"] });
    grupos.sinonimo = (lista.dados as { codigo: string; titulo_cbo: string | null; casou_em?: string; trecho?: string }[])
      .filter((item) => item.casou_em === "sinonimo")
      .map((item) => ({
        tipo: "sinonimo",
        identificador: item.codigo,
        rotulo: item.trecho,
        casou_em: "sinonimo",
        trecho: item.trecho,
        link: api(`/ocupacoes/${item.codigo}`),
      }));
  }
  if (tipos.includes("familia")) {
    const termos = termosDaConsulta(q);
    grupos.familia = nosDoNivel("familia")
      .filter((no) => textoCasa(no.titulo, termos))
      .slice(0, limite)
      .map((no) => ({
        tipo: "familia",
        identificador: no.codigo,
        rotulo: no.titulo,
        casou_em: "titulo",
        trecho: trecho(no.titulo, termos),
        link: api(`/cbo/familias/${no.codigo}`),
      }));
  }
  if (tipos.includes("atividade")) {
    const atividades = buscarAtividades({ q, limite, deslocamento: 0, agrupar: false, transversais: "incluir" });
    grupos.atividade = (atividades.dados as { ocupacao: string; descricao: string; trecho?: string }[]).slice(0, limite).map((item) => ({
      tipo: "atividade",
      identificador: item.ocupacao,
      rotulo: item.descricao,
      casou_em: "atividade",
      trecho: item.trecho,
      link: api(`/ocupacoes/${item.ocupacao}/atividades`),
    }));
  }
  if (tipos.includes("termo")) {
    const lista = listarTermos("habilidades", { q, formato: "plano", limite, deslocamento: 0 });
    const todosVoc = ["conhecimentos-i", "conhecimentos-ii", "habilidades", "atitudes"].flatMap((vocabulario) => {
      const saida = listarTermos(vocabulario, { q, formato: "plano", limite, deslocamento: 0 });
      return (saida.dados as { vocabulario: string; nivel: string; codigo: string; descricao: string; trecho?: string }[]).map((item) => ({
        tipo: "termo",
        identificador: `${item.vocabulario}/${item.nivel}/${item.codigo}`,
        rotulo: item.descricao,
        casou_em: "termo",
        trecho: item.trecho,
        link: api(`/qbq/vocabularios/${item.vocabulario}/${item.nivel}/${encodeURIComponent(item.codigo)}`),
      }));
    });
    grupos.termo = todosVoc.slice(0, limite);
    void lista;
  }
  if (tipos.includes("conceito")) {
    const lista = listarConceitos(q, undefined, limite, 0);
    grupos.conceito = (lista.dados as { nivel: string; codigo: string; termo: string; trecho?: string }[]).map((item) => ({
      tipo: "conceito",
      identificador: `${item.nivel}/${item.codigo}`,
      rotulo: item.termo,
      casou_em: "conceito",
      trecho: item.trecho,
      link: api(`/qbq/vocabularios/habilidades/${item.nivel}/${encodeURIComponent(item.codigo)}`),
    }));
  }
  return { dados: grupos };
}

export function buscarAtividades(opcoes: {
  q: string;
  prefixo?: string;
  nivelQualificacao?: Faixa;
  transversais: "incluir" | "excluir" | "somente";
  buscarEm?: ("atividade" | "area")[];
  agrupar: boolean;
  limite: number;
  deslocamento: number;
  maxCasadas?: number;
}): Saida {
  const termos = termosDaConsulta(opcoes.q);
  if (!termos.length) throw parametro("q", "Informe o texto da atividade.");
  const consulta = ftsConsulta(termos);
  const buscarEm = opcoes.buscarEm ?? ["atividade", "area"];
  const clausulas = [];
  if (buscarEm.includes("atividade")) clausulas.push(`descricao : (${consulta})`);
  if (buscarEm.includes("area")) clausulas.push(`area : (${consulta})`);
  const linhas = todos<{
    ocupacao: string;
    sigla: string;
    numero: number | null;
    ordem: number;
    descricao: string;
    area: string;
    fonte_arquivo: string | null;
    fonte_linha: number | null;
  }>(
    `SELECT f.ocupacao, f.sigla, f.numero, f.ordem, f.descricao, f.area, a.fonte_arquivo, a.fonte_linha
     FROM fts_atividade f
     JOIN atividade a ON a.ocupacao = f.ocupacao AND a.ordem = f.ordem
     WHERE fts_atividade MATCH ?`,
    clausulas.join(" OR "),
  );
  const casadas = [];
  for (const linha of linhas) {
    const transversal = linha.sigla === "Y" || linha.sigla === "Z";
    if (opcoes.transversais === "excluir" && transversal) continue;
    if (opcoes.transversais === "somente" && !transversal) continue;
    if (opcoes.prefixo && !linha.ocupacao.startsWith(opcoes.prefixo)) continue;
    const noTexto = buscarEm.includes("atividade") && textoCasa(linha.descricao, termos);
    const noNome = buscarEm.includes("area") && textoCasa(linha.area, termos);
    if (!noTexto && !noNome) continue;
    const ocupacao = ocupacaoPorCodigo(linha.ocupacao);
    if (!ocupacao) continue;
    if (opcoes.nivelQualificacao) {
      const nivel = ocupacao.nivel_qualificacao;
      if (nivel == null || nivel < opcoes.nivelQualificacao.min || nivel > opcoes.nivelQualificacao.max) continue;
    }
    casadas.push({ linha, ocupacao, casou_em: noTexto ? "atividade" : "area" });
  }
  if (!opcoes.agrupar) {
    const pagina = paginar(casadas, opcoes.limite, opcoes.deslocamento);
    return {
      dados: pagina.fatia.map(({ linha, ocupacao, casou_em }) => ({
        ocupacao: ocupacao.codigo,
        titulo: ocupacao.titulo_cbo ?? ocupacao.titulo_qbq,
        sigla: linha.sigla,
        area: linha.area,
        numero: linha.numero,
        descricao: linha.descricao,
        nivel_qualificacao: ocupacao.nivel_qualificacao,
        fonte: fonteDe(linha.fonte_arquivo, linha.fonte_linha),
        casou_em,
        trecho: trecho(casou_em === "atividade" ? linha.descricao : linha.area, termos),
      })),
      total: pagina.total,
      limite: opcoes.limite,
      deslocamento: opcoes.deslocamento,
    };
  }
  const grupos = new Map<string, { ocupacao: NonNullable<ReturnType<typeof ocupacaoPorCodigo>>; atividades: typeof casadas }>();
  for (const item of casadas) {
    const grupo = grupos.get(item.ocupacao.codigo) ?? { ocupacao: item.ocupacao, atividades: [] };
    grupo.atividades.push(item);
    grupos.set(item.ocupacao.codigo, grupo);
  }
  const lista = [...grupos.values()].sort(
    (a, b) => b.atividades.length - a.atividades.length || a.ocupacao.codigo.localeCompare(b.ocupacao.codigo),
  );
  const pagina = paginar(lista, opcoes.limite, opcoes.deslocamento);
  const max = opcoes.maxCasadas ?? 3;
  return {
    dados: pagina.fatia.map((grupo) => ({
      ...resumoOcupacao(grupo.ocupacao),
      total_casadas: grupo.atividades.length,
      atividades: grupo.atividades.slice(0, max).map(({ linha, casou_em }) => ({
        sigla: linha.sigla,
        area: linha.area,
        numero: linha.numero,
        descricao: linha.descricao,
        casou_em,
      })),
    })),
    total: pagina.total,
    limite: opcoes.limite,
    deslocamento: opcoes.deslocamento,
  };
}

export function noExiste(nivel: string, codigo: string) {
  return noCbo(nivel, codigo);
}
