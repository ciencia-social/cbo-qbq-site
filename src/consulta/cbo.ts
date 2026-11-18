import { noCbo, nosDoNivel, ocupacaoPorCodigo, type NoCbo } from "@/consulta/cache";
import {
  ancestralDe,
  caminhoOcupacao,
  contarOcupacoes,
  filhosDoNo,
  fonteDe,
  inexistente,
  avisoNormalizacao,
} from "@/consulta/formatar";
import { codigoMalformado, parametro, Problema } from "@/http/erros";
import { paginar } from "@/http/parametros";
import { NIVEL_POR_TAMANHO, NIVEL_URL, URL_DO_NIVEL, type Aviso, type Saida } from "@/tipos";
import { textoCasa, trecho } from "@/texto";
import { api } from "@/versao";

export function interpretarCodigo(entrada: string): { codigo: string; avisos: Aviso[] } {
  const limpo = entrada.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(limpo) || limpo.length < 1 || limpo.length > 6) throw codigoMalformado(entrada);
  if ([1, 2, 3, 4, 6].includes(limpo.length)) return { codigo: limpo, avisos: [] };
  if (limpo.length === 5) {
    const padded = limpo.padStart(6, "0");
    if (ocupacaoPorCodigo(padded)) return { codigo: padded, avisos: [avisoNormalizacao(entrada, padded)] };
  }
  throw codigoMalformado(entrada);
}

export function exigirOcupacao(entrada: string) {
  const lido = interpretarCodigo(entrada);
  if (lido.codigo.length !== 6) {
    const nivel = NIVEL_POR_TAMANHO[lido.codigo.length];
    const no = nivel ? noCbo(nivel, lido.codigo) : undefined;
    throw new Problema(
      400,
      api("/problemas/codigo-malformado"),
      "Código de ocupação esperado",
      `Esta rota espera uma ocupação de 6 dígitos. "${entrada}" tem ${lido.codigo.length}.`,
      no ? `Esse código é ${nivel}. Veja ${api(`/cbo/${URL_DO_NIVEL[nivel]}/${lido.codigo}`)}.` : "Use 212405 ou 2124-05.",
    );
  }
  const ocupacao = ocupacaoPorCodigo(lido.codigo);
  if (!ocupacao) throw inexistente(entrada, lido.codigo);
  return { ocupacao, avisos: lido.avisos };
}

export function descreverCodigo(codigo: string) {
  if (codigo.length === 6) {
    const ocupacao = ocupacaoPorCodigo(codigo);
    if (!ocupacao) {
      const ancestral = ancestralDe(codigo);
      return {
        existe: false,
        nivel: null,
        titulo: null,
        caminho: ancestral ? caminhoOcupacao(ancestral.codigo) : [],
        ancestral,
        na_cbo: false,
        no_qbq: false,
        situacao_qbq: null,
      };
    }
    return {
      existe: true,
      nivel: "ocupacao",
      titulo: ocupacao.titulo_cbo ?? ocupacao.titulo_qbq,
      caminho: caminhoOcupacao(codigo),
      na_cbo: ocupacao.titulo_cbo != null,
      no_qbq: ocupacao.titulo_qbq != null,
      situacao_qbq: ocupacao.situacao_qbq,
      divergencia: ocupacao.divergencia,
      fonte: {
        cbo: ocupacao.fonte_cbo_arquivo ? { arquivo: ocupacao.fonte_cbo_arquivo, linha: ocupacao.fonte_cbo_linha } : null,
        qbq: ocupacao.fonte_qbq_arquivo
          ? { arquivo: ocupacao.fonte_qbq_arquivo, aba: ocupacao.fonte_qbq_aba, linha: ocupacao.fonte_qbq_linha }
          : null,
      },
    };
  }
  const nivel = NIVEL_POR_TAMANHO[codigo.length];
  const no = nivel ? noCbo(nivel, codigo) : undefined;
  if (!no) {
    const ancestral = ancestralDe(codigo);
    return { existe: false, nivel: null, titulo: null, caminho: [], ancestral };
  }
  return {
    existe: true,
    nivel: no.nivel,
    titulo: no.titulo,
    caminho: caminhoOcupacao(codigo),
    total_ocupacoes: contarOcupacoes(codigo),
    fonte: fonteDe(no.fonte_arquivo, no.fonte_linha),
  };
}

export function decodificar(entradas: string[], modo: "unico" | "lote"): Saida {
  if (entradas.length === 0) throw parametro("codigos", "Informe ao menos um código.");
  if (entradas.length > (modo === "lote" ? 200 : 1)) {
    throw parametro("codigos", "A lista aceita no máximo 200 códigos.");
  }
  const itens = [];
  const avisos: Aviso[] = [];
  for (const entrada of entradas) {
    let codigo = "";
    let avisosItem: Aviso[] = [];
    try {
      const lido = interpretarCodigo(entrada);
      codigo = lido.codigo;
      avisosItem = lido.avisos;
    } catch (erro) {
      if (modo === "unico") throw erro;
      itens.push({
        entrada,
        codigo: null,
        existe: false,
        motivo: "malformado",
        detalhe: erro instanceof Problema ? erro.detalhe : "Código malformado",
      });
      continue;
    }
    const descricao = descreverCodigo(codigo);
    if (!descricao.existe && modo === "unico") throw inexistente(entrada, codigo);
    if (avisosItem.length) avisos.push(...avisosItem);
    itens.push({ entrada, codigo, ...descricao, ...(avisosItem.length ? { avisos: avisosItem } : {}) });
  }
  const validos = itens.filter((item) => item.existe).length;
  return {
    dados: modo === "unico" ? itens[0] : { itens, validos, invalidos: itens.length - validos },
    total: itens.length,
    avisos,
  };
}

function noPublico(no: NoCbo, incluir: string[]) {
  const dados: Record<string, unknown> = {
    codigo: no.codigo,
    titulo: no.titulo,
    nivel: no.nivel,
    pai: no.pai,
    total_ocupacoes: contarOcupacoes(no.codigo),
    fonte: fonteDe(no.fonte_arquivo, no.fonte_linha),
  };
  if (incluir.includes("caminho")) dados.caminho = caminhoOcupacao(no.codigo);
  if (incluir.includes("filhos")) dados.filhos = filhosDoNo(no.nivel, no.codigo);
  return dados;
}

export function listarNivel(nivelUrl: string, pai?: string, q?: string, limite = 100, deslocamentoItens = 0): Saida {
  const nivel = NIVEL_URL[nivelUrl];
  if (!nivel) throw parametro("nivel", `Nível desconhecido: ${nivelUrl}.`, Object.keys(NIVEL_URL));
  let lista = nosDoNivel(nivel);
  if (pai) {
    const nivelPai = NIVEL_POR_TAMANHO[pai.replace(/[\s-]/g, "").length];
    const codigoPai = pai.replace(/[\s-]/g, "");
    if (!nivelPai || !noCbo(nivelPai, codigoPai)) throw inexistente(pai, codigoPai);
    lista = lista.filter((no) => no.pai === codigoPai);
  }
  const termos = q
    ? q.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/\s+/).filter(Boolean)
    : [];
  if (termos.length) lista = lista.filter((no) => textoCasa(no.titulo, termos));
  const pagina = paginar(lista, limite, deslocamentoItens);
  return {
    dados: pagina.fatia.map((no) => ({
      codigo: no.codigo,
      titulo: no.titulo,
      nivel: no.nivel,
      pai: no.pai,
      total_ocupacoes: contarOcupacoes(no.codigo),
      fonte: fonteDe(no.fonte_arquivo, no.fonte_linha),
      ...(termos.length ? { casou_em: "titulo", trecho: trecho(no.titulo, termos) } : {}),
    })),
    total: pagina.total,
    limite,
    deslocamento: deslocamentoItens,
  };
}

export function obterNo(nivelUrl: string, codigoEntrada: string, incluir: string[]): Saida {
  const nivel = NIVEL_URL[nivelUrl];
  if (!nivel) throw parametro("nivel", `Nível desconhecido: ${nivelUrl}.`, Object.keys(NIVEL_URL));
  const { codigo } = interpretarCodigo(codigoEntrada);
  if (NIVEL_POR_TAMANHO[codigo.length] !== nivel) {
    throw parametro("codigo", `O nível ${nivelUrl} usa códigos de ${Object.entries(NIVEL_POR_TAMANHO).find(([, n]) => n === nivel)?.[0]} dígitos.`);
  }
  const no = noCbo(nivel, codigo);
  if (!no) throw inexistente(codigoEntrada, codigo);
  return { dados: noPublico(no, incluir) };
}

export function arvore(raiz: string | undefined, profundidade: number): Saida {
  if (profundidade < 1 || profundidade > 4) throw parametro("profundidade", "profundidade vai de 1 a 4.", ["1", "2", "3", "4"]);
  if (!raiz) {
    return {
      dados: nosDoNivel("grande_grupo").map((no) => expandir(no, profundidade - 1)),
    };
  }
  const limpo = raiz.replace(/[\s-]/g, "");
  if (!/^\d{1,4}$/.test(limpo)) throw codigoMalformado(raiz);
  const nivel = NIVEL_POR_TAMANHO[limpo.length];
  const no = noCbo(nivel, limpo);
  if (!no) throw inexistente(raiz, limpo);
  return { dados: expandir(no, profundidade) };
}

function expandir(no: NoCbo, niveisAbaixo: number): Record<string, unknown> {
  const base = {
    codigo: no.codigo,
    titulo: no.titulo,
    nivel: no.nivel,
    total_ocupacoes: contarOcupacoes(no.codigo),
  };
  if (niveisAbaixo <= 0) return base;
  const filhos = filhosDoNo(no.nivel, no.codigo);
  if (no.nivel === "familia") return { ...base, filhos };
  return {
    ...base,
    filhos: filhos.map((filho) => {
      const completo = noCbo(filho.nivel, filho.codigo);
      return completo ? expandir(completo, niveisAbaixo - 1) : filho;
    }),
  };
}
