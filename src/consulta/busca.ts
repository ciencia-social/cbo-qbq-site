import { noCbo, nosDoNivel, ocupacaoPorCodigo } from "@/consulta/cache";
import { fonteDe, resumoOcupacao } from "@/consulta/formatar";
import { listarOcupacoes, type FiltroOcupacao } from "@/consulta/ocupacao";
import { listarConceitos, listarTermos } from "@/consulta/qbq";
import { todos, um } from "@/dados/banco";
import { expressaoFts } from "@/consulta/fts";
import { parametro } from "@/http/erros";
import { termosDaConsulta, textoCasa, trecho } from "@/texto";
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

type LinhaAtividade = {
  ocupacao: string;
  sigla: string;
  numero: number | null;
  descricao: string;
  area: string;
  fonte_arquivo: string | null;
  fonte_linha: number | null;
};

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
  const buscarEm = opcoes.buscarEm ?? ["atividade", "area"];
  const vazio = { dados: [], total: 0, limite: opcoes.limite, deslocamento: opcoes.deslocamento };
  const expressao = expressaoFts(termos);
  if (!expressao || !buscarEm.length) return vazio;
  const colunas = [];
  if (buscarEm.includes("atividade")) colunas.push(`descricao : (${expressao})`);
  if (buscarEm.includes("area")) colunas.push(`area : (${expressao})`);
  const condicoes = ["fts_atividade MATCH ?"];
  const valores: (string | number)[] = [colunas.join(" OR ")];
  if (opcoes.transversais === "excluir") condicoes.push("f.sigla NOT IN ('Y', 'Z')");
  if (opcoes.transversais === "somente") condicoes.push("f.sigla IN ('Y', 'Z')");
  if (opcoes.prefixo) {
    condicoes.push("substr(f.ocupacao, 1, ?) = ?");
    valores.push(opcoes.prefixo.length, opcoes.prefixo);
  }
  if (opcoes.nivelQualificacao) {
    condicoes.push("o.nivel_qualificacao BETWEEN ? AND ?");
    valores.push(opcoes.nivelQualificacao.min, opcoes.nivelQualificacao.max);
  }
  const de = `FROM fts_atividade f
     JOIN atividade a ON a.ocupacao = f.ocupacao AND a.ordem = f.ordem
     JOIN ocupacao o ON o.codigo = f.ocupacao
     WHERE ${condicoes.join(" AND ")}`;
  const campos = "f.ocupacao, f.sigla, f.numero, f.descricao, f.area, a.fonte_arquivo, a.fonte_linha";
  const casouEm = (linha: LinhaAtividade) =>
    buscarEm.includes("atividade") && textoCasa(linha.descricao, termos) ? "atividade" : "area";

  if (!opcoes.agrupar) {
    const total = um<{ n: number }>(`SELECT count(*) AS n ${de}`, ...valores)?.n ?? 0;
    const linhas = todos<LinhaAtividade>(`SELECT ${campos} ${de} ORDER BY f.rowid LIMIT ? OFFSET ?`, ...valores, opcoes.limite, opcoes.deslocamento);
    return {
      dados: linhas.map((linha) => {
        const ocupacao = ocupacaoPorCodigo(linha.ocupacao)!;
        const casou_em = casouEm(linha);
        return {
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
        };
      }),
      total,
      limite: opcoes.limite,
      deslocamento: opcoes.deslocamento,
    };
  }

  const total = um<{ n: number }>(`SELECT count(DISTINCT f.ocupacao) AS n ${de}`, ...valores)?.n ?? 0;
  const grupos = todos<{ ocupacao: string; n: number }>(
    `SELECT f.ocupacao AS ocupacao, count(*) AS n ${de} GROUP BY f.ocupacao ORDER BY n DESC, f.ocupacao LIMIT ? OFFSET ?`,
    ...valores,
    opcoes.limite,
    opcoes.deslocamento,
  );
  const max = opcoes.maxCasadas ?? 3;
  const exemplos = new Map<string, LinhaAtividade[]>();
  if (grupos.length) {
    const marcas = grupos.map(() => "?").join(", ");
    const linhas = todos<LinhaAtividade>(
      `SELECT ocupacao, sigla, numero, descricao, area, fonte_arquivo, fonte_linha FROM (
         SELECT ${campos}, row_number() OVER (PARTITION BY f.ocupacao ORDER BY f.rowid) AS posicao
         ${de} AND f.ocupacao IN (${marcas})
       )
       WHERE posicao <= ? ORDER BY ocupacao, posicao`,
      ...valores,
      ...grupos.map((grupo) => grupo.ocupacao),
      max,
    );
    for (const linha of linhas) exemplos.set(linha.ocupacao, [...(exemplos.get(linha.ocupacao) ?? []), linha]);
  }
  return {
    dados: grupos.map((grupo) => ({
      ...resumoOcupacao(ocupacaoPorCodigo(grupo.ocupacao)!),
      total_casadas: grupo.n,
      atividades: (exemplos.get(grupo.ocupacao) ?? []).map((linha) => ({
        sigla: linha.sigla,
        area: linha.area,
        numero: linha.numero,
        descricao: linha.descricao,
        casou_em: casouEm(linha),
      })),
    })),
    total,
    limite: opcoes.limite,
    deslocamento: opcoes.deslocamento,
  };
}

export function noExiste(nivel: string, codigo: string) {
  return noCbo(nivel, codigo);
}
