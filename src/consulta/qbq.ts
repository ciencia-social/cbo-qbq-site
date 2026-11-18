import {
  conceitoDe,
  divergenciaDe,
  filhosDe,
  ocupacaoPorCodigo,
  termo as termoDe,
  termosDoCodigo,
  todosConceitos,
  todosTermos,
} from "@/consulta/cache";
import {
  caminhoTermo,
  codigosFolha,
  fonteDe,
  fonteItem,
  resumoOcupacao,
  termoPublico,
} from "@/consulta/formatar";
import { todos } from "@/dados/banco";
import { parametro } from "@/http/erros";
import { paginar } from "@/http/parametros";
import { ehBalde, ftsConsulta, termosDaConsulta, textoCasa, trecho } from "@/texto";
import { FOLHA, NIVEIS_VOCAB, VOCABULARIOS, type Faixa, type Saida } from "@/tipos";
import { api } from "@/versao";

const APLICA: Record<string, string> = {
  "conhecimentos-i": "Ocupações com nível de qualificação de 1 a 5.",
  "conhecimentos-ii": "Ocupações com nível de qualificação de 6 a 8.",
  habilidades: "Todas as ocupações classificadas.",
  atitudes: "Todas as ocupações classificadas.",
};

export function vocabularios(): Saida {
  const contagens = todos<{ vocabulario: string; nivel: string; n: number }>(
    "SELECT vocabulario, nivel, count(*) n FROM termo GROUP BY vocabulario, nivel",
  );
  return {
    dados: VOCABULARIOS.map((id) => ({
      id,
      niveis: NIVEIS_VOCAB[id].map((nivel) => ({
        nivel,
        total: contagens.find((item) => item.vocabulario === id && item.nivel === nivel)?.n ?? 0,
      })),
      aplica_se_a: APLICA[id],
      tem_conceitos: id === "habilidades",
    })),
  };
}

export function exigirVocabulario(id: string) {
  if (!VOCABULARIOS.includes(id)) throw parametro("vocabulario", `Vocabulário desconhecido: ${id}.`, VOCABULARIOS);
  return id;
}

export function listarTermos(
  vocabulario: string,
  opcoes: {
    nivel?: string;
    pai?: string;
    nivelPai?: string;
    q?: string;
    formato?: "plano" | "arvore";
    profundidade?: number;
    excluirBaldes?: boolean;
    limite: number;
    deslocamento: number;
  },
): Saida {
  exigirVocabulario(vocabulario);
  if (opcoes.nivel && !NIVEIS_VOCAB[vocabulario].includes(opcoes.nivel)) {
    throw parametro("nivel", `Nível desconhecido em ${vocabulario}.`, NIVEIS_VOCAB[vocabulario]);
  }
  let lista = todosTermos().filter((termo) => termo.vocabulario === vocabulario);
  if (opcoes.nivel) lista = lista.filter((termo) => termo.nivel === opcoes.nivel);
  if (opcoes.excluirBaldes) lista = lista.filter((termo) => termo.balde === 0);
  if (opcoes.pai) {
    const candidatos = termosDoCodigo(vocabulario, opcoes.pai);
    const nivelPai = opcoes.nivelPai ?? (candidatos.length === 1 ? candidatos[0].nivel : undefined);
    if (!nivelPai) {
      throw parametro("nivel_pai", "O código do pai existe em mais de um nível.", candidatos.map((item) => item.nivel));
    }
    lista = lista.filter((termo) => termo.pai === opcoes.pai && termo.nivel_pai === nivelPai);
  }
  const termos = opcoes.q ? termosDaConsulta(opcoes.q) : [];
  if (termos.length) lista = lista.filter((termo) => textoCasa(termo.descricao, termos));
  if (opcoes.formato === "arvore" && !termos.length && !opcoes.pai && !opcoes.nivel) {
    const raiz = NIVEIS_VOCAB[vocabulario][0];
    const nos = lista.filter((termo) => termo.nivel === raiz);
    return { dados: nos.map((termo) => noArvore(termo.vocabulario, termo.nivel, termo.codigo, opcoes.profundidade ?? 1, opcoes.excluirBaldes === true)) };
  }
  const pagina = paginar(lista, opcoes.limite, opcoes.deslocamento);
  return {
    dados: pagina.fatia.map((termo) => ({
      ...termoPublico(termo),
      ...(termos.length ? { casou_em: "termo", trecho: trecho(termo.descricao, termos) } : {}),
    })),
    total: pagina.total,
    limite: opcoes.limite,
    deslocamento: opcoes.deslocamento,
  };
}

function noArvore(vocabulario: string, nivel: string, codigo: string, profundidade: number, excluirBaldes: boolean): Record<string, unknown> {
  const item = termoDe(vocabulario, nivel, codigo)!;
  const base = termoPublico(item);
  if (profundidade <= 0) return base;
  const filhos = filhosDe(vocabulario, nivel, codigo).filter((filho) => !excluirBaldes || filho.balde === 0);
  return { ...base, filhos: filhos.map((filho) => noArvore(vocabulario, filho.nivel, filho.codigo, profundidade - 1, excluirBaldes)) };
}

export function obterTermo(vocabulario: string, nivel: string | undefined, codigo: string, incluirUso: boolean): Saida {
  exigirVocabulario(vocabulario);
  const candidatos = nivel ? [termoDe(vocabulario, nivel, codigo)].filter((item) => item != null) : termosDoCodigo(vocabulario, codigo);
  if (!nivel && candidatos.length > 1) {
    throw parametro(
      "nivel",
      `O código ${codigo} existe em mais de um nível de ${vocabulario}.`,
      candidatos.map((item) => item.nivel),
    );
  }
  const item = candidatos[0];
  if (!item) throw parametro("codigo", `O termo ${codigo} não existe em ${vocabulario}${nivel ? `/${nivel}` : ""}.`);
  const balde = item.balde === 1;
  const conceito = !balde && vocabulario === "habilidades" ? conceitoDe(item.nivel, item.codigo) : undefined;
  const motivo = balde
    ? { codigo: "D012", mensagem: "Balde de “outros”: não há conceito oficial.", link: api("/decisoes/D012") }
    : vocabulario !== "habilidades"
      ? { codigo: "D011", mensagem: "Só a dimensão habilidades tem conceitos oficiais neste dataset.", link: api("/decisoes/D011") }
      : conceito
        ? null
        : { codigo: "D012", mensagem: "Este termo não tem conceito oficial.", link: api("/decisoes/D012") };
  const dados: Record<string, unknown> = {
    ...termoPublico(item),
    caminho: caminhoTermo(vocabulario, item.nivel, item.codigo),
    filhos: filhosDe(vocabulario, item.nivel, item.codigo).map(termoPublico),
    conceito: conceito ? { termo: conceito.termo, conceito: conceito.conceito, fonte: fonteDe(conceito.fonte_arquivo) } : null,
    ...(motivo ? { motivo_conceito: motivo } : {}),
    divergencia_de_grafia: divergenciaDe(item.nivel, item.codigo) ?? null,
  };
  if (incluirUso) dados.uso = usoDoTermo(vocabulario, item.nivel, item.codigo);
  return { dados, ...(incluirUso ? { derivado: true, metodo: "Contagem de ocupações distintas que exigem o termo ou um descendente folha, e média dos graus desses itens." } : {}) };
}

function usoDoTermo(vocabulario: string, nivel: string, codigo: string) {
  return usoReal(vocabulario, nivel, codigo);
}

function usoReal(vocabulario: string, nivel: string, codigo: string) {
  const codigos = codigosFolha(vocabulario, nivel, codigo);
  if (codigos.length === 0) return { ocupacoes: 0 };
  const dimensao = vocabulario.startsWith("conhecimentos") ? "conhecimentos" : vocabulario;
  const marcas = codigos.map(() => "?").join(", ");
  const linhas = todos<{ ocupacao: string; importancia: number | null; frequencia: number | null; profundidade: number | null }>(
    `SELECT ocupacao, importancia, frequencia, profundidade FROM cha
     WHERE dimensao = ? AND codigo IN (${marcas})`,
    dimensao,
    ...codigos,
  );
  const ocupacoesDistintas = new Set(linhas.map((linha) => linha.ocupacao));
  const media = (campo: "importancia" | "frequencia" | "profundidade") => {
    const valores = linhas.map((linha) => linha[campo]).filter((valor): valor is number => valor != null);
    if (!valores.length) return null;
    return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100;
  };
  return {
    ocupacoes: ocupacoesDistintas.size,
    importancia_media: media("importancia"),
    frequencia_media: media("frequencia"),
    profundidade_media: media("profundidade"),
    derivado: true,
  };
}

export function ocupacoesDoTermo(
  vocabulario: string,
  nivel: string,
  codigo: string,
  opcoes: {
    importanciaMin?: number;
    frequenciaMin?: number;
    profundidadeMin?: number;
    incluirDescendentes?: boolean;
    prefixo?: string;
    nivelQualificacao?: Faixa;
    limite: number;
    deslocamento: number;
    ordenar?: string;
  },
): Saida {
  const termo = termoDe(exigirVocabulario(vocabulario), nivel, codigo);
  if (!termo) throw parametro("codigo", `O termo ${codigo} não existe em ${vocabulario}/${nivel}.`, NIVEIS_VOCAB[vocabulario]);
  const folha = FOLHA[vocabulario] === nivel;
  const codigos = !folha && opcoes.incluirDescendentes !== false ? codigosFolha(vocabulario, nivel, codigo) : [codigo];
  const dimensao = vocabulario.startsWith("conhecimentos") ? "conhecimentos" : vocabulario;
  const marcas = codigos.map(() => "?").join(", ");
  const linhas = todos<{
    ocupacao: string;
    codigo: string;
    importancia: number | null;
    frequencia: number | null;
    profundidade: number | null;
    linha: number | null;
  }>(
    `SELECT ocupacao, codigo, importancia, frequencia, profundidade, linha FROM cha
     WHERE dimensao = ? AND codigo IN (${marcas})`,
    dimensao,
    ...codigos,
  );
  const porOcupacao = new Map<string, typeof linhas>();
  for (const linha of linhas) {
    if (opcoes.importanciaMin != null && (linha.importancia ?? 0) < opcoes.importanciaMin) continue;
    if (opcoes.frequenciaMin != null && (linha.frequencia ?? 0) < opcoes.frequenciaMin) continue;
    if (opcoes.profundidadeMin != null && (linha.profundidade ?? 0) < opcoes.profundidadeMin) continue;
    const lista = porOcupacao.get(linha.ocupacao) ?? [];
    lista.push(linha);
    porOcupacao.set(linha.ocupacao, lista);
  }
  let ocupacoes = [...porOcupacao.entries()].flatMap(([codigoOcupacao, itens]) => {
    const ocupacao = ocupacaoPorCodigo(codigoOcupacao);
    if (!ocupacao) return [];
    if (opcoes.prefixo && !ocupacao.codigo.startsWith(opcoes.prefixo)) return [];
    if (opcoes.nivelQualificacao) {
      const nivelQ = ocupacao.nivel_qualificacao;
      if (nivelQ == null || nivelQ < opcoes.nivelQualificacao.min || nivelQ > opcoes.nivelQualificacao.max) return [];
    }
    const melhorItem = [...itens].sort((a, b) => (b.importancia ?? 0) - (a.importancia ?? 0))[0];
    return [{
      ...resumoOcupacao(ocupacao),
      itens_casados: itens.length,
      importancia: melhorItem.importancia,
      frequencia: melhorItem.frequencia,
      profundidade: melhorItem.profundidade,
      fonte: fonteItem(melhorItem.linha),
    }];
  });
  const desc = (opcoes.ordenar ?? "-importancia").startsWith("-");
  ocupacoes.sort((a, b) => ((a.importancia ?? -1) - (b.importancia ?? -1)) * (desc ? -1 : 1) || a.codigo.localeCompare(b.codigo));
  const porGrupo: Record<string, number> = {};
  const porNivel: Record<string, number> = {};
  for (const ocupacao of ocupacoes) {
    porGrupo[ocupacao.codigo[0]] = (porGrupo[ocupacao.codigo[0]] ?? 0) + 1;
    const chave = String(ocupacao.nivel_qualificacao ?? "sem_nivel");
    porNivel[chave] = (porNivel[chave] ?? 0) + 1;
  }
  const pagina = paginar(ocupacoes, opcoes.limite, opcoes.deslocamento);
  return {
    dados: {
      termo: termoPublico(termo),
      agregou_descendentes: !folha && opcoes.incluirDescendentes !== false,
      total: ocupacoes.length,
      distribuicao: { por_grande_grupo: porGrupo, por_nivel_qualificacao: porNivel },
      ocupacoes: pagina.fatia,
    },
    total: ocupacoes.length,
    limite: opcoes.limite,
    deslocamento: opcoes.deslocamento,
  };
}

export function listarConceitos(q?: string, nivel?: string, limite = 100, deslocamento = 0): Saida {
  let lista = todosConceitos();
  if (nivel) lista = lista.filter((conceito) => conceito.nivel === nivel);
  const termos = q ? termosDaConsulta(q) : [];
  if (termos.length) lista = lista.filter((conceito) => textoCasa(conceito.termo, termos) || textoCasa(conceito.conceito, termos));
  const pagina = paginar(lista, limite, deslocamento);
  return {
    dados: pagina.fatia.map((conceito) => ({
      codigo: conceito.codigo,
      nivel: conceito.nivel,
      termo: conceito.termo,
      conceito: conceito.conceito,
      fonte: fonteDe(conceito.fonte_arquivo),
      ...(termos.length ? { casou_em: textoCasa(conceito.termo, termos) ? "termo" : "conceito", trecho: trecho(textoCasa(conceito.termo, termos) ? conceito.termo : conceito.conceito, termos) } : {}),
    })),
    total: pagina.total,
    limite,
    deslocamento,
  };
}

export function naoClassificadas(q: string | undefined, prefixo: string | undefined, limite: number, deslocamento: number): Saida {
  const linhas = todos<{
    codigo: string;
    codigo_formatado: string;
    titulo_cbo: string | null;
    titulo_qbq: string | null;
    justificativa: string | null;
    familia: string;
    fonte_justificativa_arquivo: string | null;
    fonte_justificativa_aba: string | null;
    fonte_justificativa_linha: number | null;
  }>(
    `SELECT codigo, codigo_formatado, titulo_cbo, titulo_qbq, justificativa, familia,
            fonte_justificativa_arquivo, fonte_justificativa_aba, fonte_justificativa_linha
     FROM ocupacao WHERE situacao_qbq = 'nao_classificada' ORDER BY codigo`,
  );
  const termos = q ? termosDaConsulta(q) : [];
  const filtradas = linhas.filter((linha) => {
    if (prefixo && !linha.codigo.startsWith(prefixo)) return false;
    if (!termos.length) return true;
    return textoCasa(linha.titulo_cbo ?? "", termos) || textoCasa(linha.titulo_qbq ?? "", termos) || textoCasa(linha.justificativa ?? "", termos);
  });
  const pagina = paginar(filtradas, limite, deslocamento);
  return {
    dados: pagina.fatia.map((linha) => ({
      codigo: linha.codigo,
      codigo_formatado: linha.codigo_formatado,
      titulo_cbo: linha.titulo_cbo,
      titulo_qbq: linha.titulo_qbq,
      justificativa: linha.justificativa,
      fonte: fonteDe(linha.fonte_justificativa_arquivo, linha.fonte_justificativa_linha, linha.fonte_justificativa_aba),
    })),
    total: pagina.total,
    limite,
    deslocamento,
    avisos: [{ codigo: "D008", mensagem: "Estas ocupações permanecem sem nível, com a justificativa oficial.", link: api("/decisoes/D008") }],
  };
}

export function niveis(): Saida {
  const linhas = todos<{ nivel: number | null; n: number }>(
    "SELECT nivel_qualificacao AS nivel, count(*) n FROM ocupacao WHERE titulo_qbq IS NOT NULL GROUP BY nivel_qualificacao ORDER BY nivel",
  );
  return {
    dados: linhas.map((linha) => ({
      nivel: linha.nivel,
      total: linha.n,
      ...(linha.nivel != null ? { link: `${api("/ocupacoes")}?nivel_qualificacao=${linha.nivel}` } : {}),
    })),
  };
}

export function buscarItens(opcoes: {
  q: string;
  dimensao?: string;
  taxonomia?: string;
  somenteBaldes?: boolean;
  prefixo?: string;
  importanciaMin?: number;
  limite: number;
  deslocamento: number;
}): Saida {
  const termos = termosDaConsulta(opcoes.q);
  if (!termos.length) throw parametro("q", "Informe o texto a buscar.");
  const consulta = ftsConsulta(termos);
  const linhas = todos<{ ocupacao: string; dimensao: string; codigo: string; linha: number | null; descricao: string }>(
    "SELECT ocupacao, dimensao, codigo, linha, descricao FROM fts_item WHERE fts_item MATCH ?",
    consulta,
  );
  const itens = [];
  for (const linha of linhas) {
    if (!textoCasa(linha.descricao, termos)) continue;
    if (opcoes.dimensao && linha.dimensao !== opcoes.dimensao) continue;
    if (opcoes.prefixo && !linha.ocupacao.startsWith(opcoes.prefixo)) continue;
    if (opcoes.somenteBaldes && !linha.codigo.split(".").some((parte) => parte === "90" || parte === "99")) continue;
    const ocupacao = ocupacaoPorCodigo(linha.ocupacao);
    if (!ocupacao) continue;
    if (opcoes.taxonomia && ocupacao.taxonomia_conhecimento !== opcoes.taxonomia) continue;
    const cha = todos<{ importancia: number | null; frequencia: number | null; profundidade: number | null; nivel_vocabulario: string }>(
      "SELECT importancia, frequencia, profundidade, nivel_vocabulario FROM cha WHERE ocupacao = ? AND dimensao = ? AND codigo = ? AND linha IS ?",
      linha.ocupacao,
      linha.dimensao,
      linha.codigo,
      linha.linha,
    )[0];
    if (opcoes.importanciaMin != null && (cha?.importancia ?? 0) < opcoes.importanciaMin) continue;
    const vocabulario = linha.dimensao === "conhecimentos" ? ocupacao.taxonomia_conhecimento : linha.dimensao;
    itens.push({
      ocupacao: linha.ocupacao,
      titulo: ocupacao.titulo_cbo ?? ocupacao.titulo_qbq,
      dimensao: linha.dimensao,
      codigo: linha.codigo,
      termo: vocabulario && cha ? termoDe(vocabulario, cha.nivel_vocabulario, linha.codigo)?.descricao ?? null : null,
      descricao_item: linha.descricao,
      importancia: cha?.importancia ?? null,
      frequencia: cha?.frequencia ?? null,
      profundidade: cha?.profundidade ?? null,
      fonte: fonteItem(linha.linha),
      casou_em: "descricao_item",
      trecho: trecho(linha.descricao, termos),
    });
  }
  const pagina = paginar(itens, opcoes.limite, opcoes.deslocamento);
  return { dados: pagina.fatia, total: pagina.total, limite: opcoes.limite, deslocamento: opcoes.deslocamento };
}

export function buscarTermos(opcoes: { q: string; vocabularios?: string[]; buscarEm: string[]; limite: number }): Saida {
  const termos = termosDaConsulta(opcoes.q);
  if (!termos.length) throw parametro("consulta", "Informe o texto a buscar.");
  const vocabularios = opcoes.vocabularios?.length ? opcoes.vocabularios : VOCABULARIOS;
  for (const vocabulario of vocabularios) exigirVocabulario(vocabulario);
  const saida: Record<string, unknown>[] = [];
  if (opcoes.buscarEm.includes("vocabulario")) {
    for (const termo of todosTermos()) {
      if (!vocabularios.includes(termo.vocabulario) || !textoCasa(termo.descricao, termos)) continue;
      saida.push({
        origem: "vocabulario",
        ...termoPublico(termo),
        caminho: caminhoTermo(termo.vocabulario, termo.nivel, termo.codigo),
        tem_conceito: Boolean(conceitoDe(termo.nivel, termo.codigo)),
        casou_em: "termo",
        trecho: trecho(termo.descricao, termos),
      });
    }
  }
  if (opcoes.buscarEm.includes("conceito")) {
    for (const conceito of todosConceitos()) {
      if (!vocabularios.includes(conceito.vocabulario)) continue;
      const noTermo = textoCasa(conceito.termo, termos);
      const noConceito = textoCasa(conceito.conceito, termos);
      if (!noTermo && !noConceito) continue;
      saida.push({
        origem: "conceito",
        vocabulario: conceito.vocabulario,
        nivel: conceito.nivel,
        codigo: conceito.codigo,
        descricao: conceito.termo,
        conceito: conceito.conceito,
        fonte: fonteDe(conceito.fonte_arquivo),
        casou_em: noTermo ? "termo" : "conceito",
        trecho: trecho(noTermo ? conceito.termo : conceito.conceito, termos),
      });
    }
  }
  let descricoes: { codigo: string }[] = [];
  let totalDescricoes = 0;
  if (opcoes.buscarEm.includes("descricao_item")) {
    const busca = buscarItens({ q: opcoes.q, limite: opcoes.limite, deslocamento: 0 });
    descricoes = Array.isArray(busca.dados) ? (busca.dados as { codigo: string }[]) : [];
    totalDescricoes = busca.total ?? descricoes.length;
  }
  const avisos: { codigo?: string; mensagem: string; link?: string }[] = [
    {
      codigo: "D004",
      mensagem: "O mesmo assunto pode existir nas duas taxonomias de conhecimento, com códigos diferentes. O resultado de uma não vale para a outra.",
      link: api("/decisoes/D004"),
    },
  ];
  if (saida.length === 0 && totalDescricoes > 0) {
    const amostra = totalDescricoes > descricoes.length
      ? (buscarItens({ q: opcoes.q, limite: totalDescricoes, deslocamento: 0 }).dados as { codigo: string }[])
      : descricoes;
    if (amostra.every((item) => ehBalde(item.codigo))) {
      avisos.push({
        mensagem: "O assunto aparece como texto livre dentro de itens \"outros\", e não como termo do vocabulário.",
      });
    }
  }
  return {
    dados: {
      termos: saida.slice(0, opcoes.limite),
      total_termos: saida.length,
      ...(opcoes.buscarEm.includes("descricao_item") ? { descricoes_item: descricoes, total_descricoes_item: totalDescricoes } : {}),
    },
    total: saida.length + totalDescricoes,
    limite: opcoes.limite,
    avisos,
  };
}
