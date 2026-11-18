import {
  filhosDe,
  fonteCbo,
  fonteQbq,
  noCbo,
  nosDoNivel,
  ocupacoes,
  termo as termoDe,
  type OcupacaoLista,
  type TermoRow,
} from "@/consulta/cache";
import { Problema } from "@/http/erros";
import { ARQUIVO_QBQ, FOLHA, NIVEL_POR_TAMANHO, URL_DO_NIVEL, type Aviso, type Fonte } from "@/tipos";
import { normalizarBusca, textoCasa, trecho } from "@/texto";

export function fonteDe(arquivo: string | null, linha?: number | null, aba?: string | null): Fonte | null {
  if (!arquivo) return null;
  return { arquivo, ...(aba ? { aba } : {}), ...(linha != null ? { linha } : {}) };
}

export function avisosOcupacao(ocupacao: OcupacaoLista, ficha = false): Aviso[] {
  const avisos: Aviso[] = [];
  if (ocupacao.divergencia === "titulo_divergente") {
    avisos.push({
      codigo: "D015",
      mensagem: "Título difere entre CBO e QBQ; nenhuma camada é corrigida.",
      link: "/v1/decisoes/D015",
    });
  } else if (ocupacao.divergencia === "so_cbo") {
    avisos.push({
      codigo: "D015",
      mensagem: "O código existe na CBO e não no QBQ. A ausência é dado, não lacuna a preencher.",
      link: "/v1/decisoes/D015",
    });
  } else if (ocupacao.divergencia === "so_qbq") {
    avisos.push({
      codigo: "D015",
      mensagem: "O código existe no QBQ e não na CBO. A ausência é dado, não lacuna a preencher.",
      link: "/v1/decisoes/D015",
    });
  }
  if (ocupacao.situacao_qbq === "sem_nivel_sem_justificativa") {
    avisos.push({
      codigo: "D010",
      mensagem: "Ocupação sem nível no QBQ e sem justificativa oficial. A lacuna é da fonte.",
      link: "/v1/decisoes/D010",
    });
  }
  if (ficha && ocupacao.situacao_qbq === "nao_classificada") {
    avisos.push({
      codigo: "D008",
      mensagem: "Ocupação sem nível no QBQ, com a justificativa oficial.",
      link: "/v1/decisoes/D008",
    });
  }
  return avisos;
}

export function avisoNormalizacao(entrada: string, codigo: string): Aviso {
  return {
    codigo: "D001",
    mensagem: `A entrada "${entrada}" foi normalizada para "${codigo}", com zero à esquerda.`,
    link: "/v1/decisoes/D001",
  };
}

export function familiaDe(codigo: string | null) {
  if (!codigo) return null;
  const no = noCbo("familia", codigo);
  return { codigo, titulo: no?.titulo ?? null };
}

export function caminhoOcupacao(codigo: string) {
  const caminho = [];
  for (const tamanho of [1, 2, 3, 4]) {
    if (codigo.length < tamanho) break;
    const nivel = NIVEL_POR_TAMANHO[tamanho];
    const no = noCbo(nivel, codigo.slice(0, tamanho));
    if (no) caminho.push({ nivel, codigo: no.codigo, titulo: no.titulo });
  }
  return caminho;
}

export function resumoOcupacao(ocupacao: OcupacaoLista, extra?: Record<string, unknown>) {
  return {
    codigo: ocupacao.codigo,
    codigo_formatado: ocupacao.codigo_formatado,
    titulo_cbo: ocupacao.titulo_cbo,
    titulo_qbq: ocupacao.titulo_qbq,
    familia: familiaDe(ocupacao.familia),
    nivel_qualificacao: ocupacao.nivel_qualificacao,
    situacao_qbq: ocupacao.situacao_qbq,
    fonte: { cbo: fonteCbo(ocupacao), qbq: fonteQbq(ocupacao) },
    ...extra,
  };
}

export function casarTexto(
  original: string | null,
  termos: string[],
  consulta: string,
  tipo: "titulo" | "sinonimo" | "sintese",
) {
  if (!original || !textoCasa(original, termos)) return null;
  const busca = normalizarBusca(original);
  let rank = 4;
  if (tipo === "titulo" && busca === consulta) rank = 0;
  else if (tipo === "titulo" && busca.startsWith(consulta)) rank = 1;
  else if (tipo === "titulo") rank = 2;
  else if (tipo === "sinonimo") rank = 3;
  return { casou_em: tipo, trecho: trecho(original, termos), rank };
}

export function melhor(
  atual: { casou_em: string; trecho: string; rank: number } | undefined,
  proximo: { casou_em: string; trecho: string; rank: number } | null,
) {
  if (!proximo) return atual;
  if (!atual || proximo.rank < atual.rank) return proximo;
  return atual;
}

export function ancestralDe(codigo: string) {
  for (const tamanho of [4, 3, 2, 1]) {
    if (tamanho >= codigo.length) continue;
    const nivel = NIVEL_POR_TAMANHO[tamanho];
    const no = noCbo(nivel, codigo.slice(0, tamanho));
    if (!no) continue;
    const url = URL_DO_NIVEL[no.nivel];
    return {
      nivel: no.nivel,
      codigo: no.codigo,
      titulo: no.titulo,
      link: `/v1/cbo/${url}/${no.codigo}`,
      filhos: filhosDoNo(no.nivel, no.codigo).slice(0, 30),
    };
  }
  return null;
}

export function inexistente(entrada: string, codigo: string): Problema {
  const ancestral = ancestralDe(codigo);
  const dica = ancestral
    ? `O ancestral mais profundo é ${ancestral.nivel} ${ancestral.codigo} (${ancestral.titulo}). Veja ${ancestral.link}.`
    : "Confira o código em /v1/cbo/grandes-grupos.";
  return new Problema(
    404,
    "/v1/problemas/codigo-inexistente",
    "Código não encontrado",
    `O código ${entrada} não existe na CBO nem no QBQ.`,
    dica,
    ancestral?.filhos ?? [],
  );
}

export function ocupacoesSob(prefixo: string) {
  return ocupacoes().filter((ocupacao) => ocupacao.codigo.startsWith(prefixo));
}

export function contarOcupacoes(prefixo: string) {
  return ocupacoesSob(prefixo).length;
}

export function filhosDoNo(nivel: string, codigo: string) {
  if (nivel === "familia") {
    return ocupacoesSob(codigo).map((ocupacao) => ({
      nivel: "ocupacao",
      codigo: ocupacao.codigo,
      titulo: ocupacao.titulo_cbo ?? ocupacao.titulo_qbq,
      nivel_qualificacao: ocupacao.nivel_qualificacao,
    }));
  }
  const seguinte: Record<string, string> = {
    grande_grupo: "subgrupo_principal",
    subgrupo_principal: "subgrupo",
    subgrupo: "familia",
  };
  const nivelFilho = seguinte[nivel];
  if (!nivelFilho) return [];
  return nosDoNivel(nivelFilho)
    .filter((no) => no.pai === codigo)
    .map((no) => ({
      nivel: no.nivel,
      codigo: no.codigo,
      titulo: no.titulo,
      total_ocupacoes: contarOcupacoes(no.codigo),
    }));
}

export function caminhoTermo(vocabulario: string, nivel: string, codigo: string) {
  const caminho: { nivel: string; codigo: string; descricao: string }[] = [];
  const vistos = new Set<string>();
  let atual = termoDe(vocabulario, nivel, codigo);
  while (atual && !vistos.has(`${atual.nivel}|${atual.codigo}`)) {
    vistos.add(`${atual.nivel}|${atual.codigo}`);
    caminho.push({ nivel: atual.nivel, codigo: atual.codigo, descricao: atual.descricao });
    if (!atual.pai || !atual.nivel_pai) break;
    atual = termoDe(vocabulario, atual.nivel_pai, atual.pai);
  }
  return caminho.reverse();
}

export function codigosFolha(vocabulario: string, nivel: string, codigo: string): string[] {
  const folha = FOLHA[vocabulario];
  const saida: string[] = [];
  const visitar = (nivelAtual: string, codigoAtual: string) => {
    if (nivelAtual === folha) saida.push(codigoAtual);
    for (const filho of filhosDe(vocabulario, nivelAtual, codigoAtual)) visitar(filho.nivel, filho.codigo);
  };
  visitar(nivel, codigo);
  return saida;
}

export function termoPublico(item: TermoRow) {
  return {
    vocabulario: item.vocabulario,
    nivel: item.nivel,
    codigo: item.codigo,
    descricao: item.descricao,
    pai: item.pai ? { codigo: item.pai, nivel: item.nivel_pai } : null,
    balde: item.balde === 1,
    fonte: fonteDe(item.fonte_arquivo),
  };
}

export function fonteItem(linha: number | null): Fonte {
  return { arquivo: ARQUIVO_QBQ, ...(linha != null ? { linha } : {}) };
}

export function motivoConceito(balde: boolean, dimensao: string): Aviso | null {
  if (balde) {
    return {
      codigo: "D012",
      mensagem: "Balde de “outros”: o conteúdo está na descrição do item, e não há conceito oficial.",
      link: "/v1/decisoes/D012",
    };
  }
  if (dimensao !== "habilidades") {
    return {
      codigo: "D011",
      mensagem: "Só a dimensão habilidades tem conceitos oficiais neste dataset.",
      link: "/v1/decisoes/D011",
    };
  }
  return null;
}
