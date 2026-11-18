import { conceitoDe, divergenciaDe, ocupacaoPorCodigo, sinonimos, sinonimosDa, termo as termoDe } from "@/consulta/cache";
import { exigirOcupacao } from "@/consulta/cbo";
import {
  avisosOcupacao,
  caminhoOcupacao,
  caminhoTermo,
  casarTexto,
  codigosFolha,
  familiaDe,
  fonteDe,
  fonteItem,
  melhor,
  motivoConceito,
  resumoOcupacao,
} from "@/consulta/formatar";
import { todos, um } from "@/dados/banco";
import { parametro, Problema } from "@/http/erros";
import { paginar } from "@/http/parametros";
import { ehBalde, termosDaConsulta, textoCasa, trecho } from "@/texto";
import {
  FOLHA,
  METODO_SIMILARIDADE,
  type Aviso,
  type Faixa,
  type Saida,
} from "@/tipos";
import { ocupacoes as todasOcupacoes, type OcupacaoLista } from "@/consulta/cache";

export type FiltroOcupacao = {
  q?: string;
  buscarEm: ("titulo" | "sinonimo" | "sintese")[];
  prefixo?: string;
  nivelQualificacao?: Faixa;
  nivelConhecimento?: Faixa;
  nivelHabilidade?: Faixa;
  nivelAtitude?: Faixa;
  situacaoQbq?: string;
  taxonomia?: string;
  temAtividades?: boolean;
  temSinonimos?: boolean;
  divergencia?: string;
  limite: number;
  deslocamento: number;
  ordenar?: string;
};

function naFaixa(valor: number | null, faixa?: Faixa) {
  if (!faixa) return true;
  if (valor == null) return false;
  return valor >= faixa.min && valor <= faixa.max;
}

function passa(ocupacao: OcupacaoLista, filtro: FiltroOcupacao) {
  if (filtro.prefixo && !ocupacao.codigo.startsWith(filtro.prefixo)) return false;
  if (!naFaixa(ocupacao.nivel_qualificacao, filtro.nivelQualificacao)) return false;
  if (!naFaixa(ocupacao.nivel_conhecimento, filtro.nivelConhecimento)) return false;
  if (!naFaixa(ocupacao.nivel_habilidade, filtro.nivelHabilidade)) return false;
  if (!naFaixa(ocupacao.nivel_atitude, filtro.nivelAtitude)) return false;
  if (filtro.situacaoQbq && ocupacao.situacao_qbq !== filtro.situacaoQbq) return false;
  if (filtro.taxonomia && ocupacao.taxonomia_conhecimento !== filtro.taxonomia) return false;
  if (filtro.temAtividades != null && (ocupacao.n_atividades > 0) !== filtro.temAtividades) return false;
  if (filtro.temSinonimos != null && (ocupacao.n_sinonimos > 0) !== filtro.temSinonimos) return false;
  if (filtro.divergencia && ocupacao.divergencia !== filtro.divergencia) return false;
  return true;
}

export function listarOcupacoes(filtro: FiltroOcupacao): Saida {
  const termos = filtro.q ? termosDaConsulta(filtro.q) : [];
  const consulta = termos.join(" ");
  const itens: { ocupacao: OcupacaoLista; rank: number; casou_em?: string; trecho?: string }[] = [];
  for (const ocupacao of todasOcupacoes()) {
    if (!passa(ocupacao, filtro)) continue;
    if (!termos.length) {
      itens.push({ ocupacao, rank: 0 });
      continue;
    }
    let casou = undefined as { casou_em: string; trecho: string; rank: number } | undefined;
    if (filtro.buscarEm.includes("titulo")) {
      casou = melhor(casou, casarTexto(ocupacao.titulo_cbo, termos, consulta, "titulo"));
      casou = melhor(casou, casarTexto(ocupacao.titulo_qbq, termos, consulta, "titulo"));
    }
    if (filtro.buscarEm.includes("sintese") && ocupacao.sintese_busca && textoCasa(ocupacao.sintese_busca, termos)) {
      const sintese = um<{ sintese: string }>("SELECT sintese FROM ocupacao WHERE codigo = ?", ocupacao.codigo);
      casou = melhor(
        casou,
        casarTexto(sintese?.sintese && sintese.sintese !== "NULL" ? sintese.sintese : null, termos, consulta, "sintese"),
      );
    }
    if (filtro.buscarEm.includes("sinonimo")) {
      for (const sinonimo of sinonimosDa(ocupacao.codigo)) {
        casou = melhor(casou, casarTexto(sinonimo.sinonimo, termos, consulta, "sinonimo"));
      }
    }
    if (casou) itens.push({ ocupacao, rank: casou.rank, casou_em: casou.casou_em, trecho: casou.trecho });
  }
  ordenarOcupacoes(itens, filtro.ordenar, termos.length > 0);
  const pagina = paginar(itens, filtro.limite, filtro.deslocamento);
  const avisos: Aviso[] = [];
  if (termos.length && pagina.total === 0) {
    avisos.push({
      mensagem: "Nenhuma ocupação casou no título ou no sinônimo. Tente um termo mais curto ou busque pela tarefa em /v1/atividades.",
    });
  }
  return {
    dados: pagina.fatia.map((item) =>
      resumoOcupacao(item.ocupacao, termos.length ? { casou_em: item.casou_em, trecho: item.trecho } : undefined),
    ),
    total: pagina.total,
    limite: filtro.limite,
    deslocamento: filtro.deslocamento,
    avisos,
  };
}

function ordenarOcupacoes(
  itens: { ocupacao: OcupacaoLista; rank: number }[],
  ordenar: string | undefined,
  porRelevancia: boolean,
) {
  const campos: Record<string, (item: OcupacaoLista) => string | number | null> = {
    codigo: (item) => item.codigo,
    titulo_cbo: (item) => item.titulo_cbo,
    titulo_qbq: (item) => item.titulo_qbq,
    nivel_qualificacao: (item) => item.nivel_qualificacao,
    situacao_qbq: (item) => item.situacao_qbq,
  };
  if (!ordenar) {
    itens.sort((a, b) => (porRelevancia ? a.rank - b.rank : 0) || a.ocupacao.codigo.localeCompare(b.ocupacao.codigo));
    return;
  }
  const desc = ordenar.startsWith("-");
  const nome = desc ? ordenar.slice(1) : ordenar;
  const ler = campos[nome];
  if (!ler) throw parametro("ordenar", `Campo de ordenação desconhecido: ${nome}.`, Object.keys(campos));
  itens.sort((a, b) => {
    const va = ler(a.ocupacao);
    const vb = ler(b.ocupacao);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return (desc ? -cmp : cmp) || a.ocupacao.codigo.localeCompare(b.ocupacao.codigo);
  });
}

type OcupacaoCheia = OcupacaoLista & {
  justificativa: string | null;
  sintese: string | null;
  perfil_ocupacional: string | null;
  vigencia_cbo_status: string | null;
  vigencia_cbo_desde: string | null;
  vigencia_cbo_ate: string | null;
  vigencia_qbq_status: string | null;
  vigencia_qbq_desde: string | null;
  vigencia_qbq_ate: string | null;
  fonte_justificativa_arquivo: string | null;
  fonte_justificativa_aba: string | null;
  fonte_justificativa_linha: number | null;
};

function cheia(codigo: string) {
  return um<OcupacaoCheia>("SELECT * FROM ocupacao WHERE codigo = ?", codigo);
}

export function obterOcupacao(
  entrada: string,
  opcoes: { perfil?: boolean; atividades?: boolean | "resumo"; competencias?: boolean | "principais" } = {},
): Saida {
  const { ocupacao, avisos } = exigirOcupacao(entrada);
  const row = cheia(ocupacao.codigo);
  if (!row) throw inexistenteSilencioso();
  const sins = sinonimosDa(row.codigo).map((sinonimo) => ({
    titulo: sinonimo.sinonimo,
    fonte: fonteDe(sinonimo.fonte_arquivo, sinonimo.fonte_linha),
  }));
  const dados: Record<string, unknown> = {
    codigo: row.codigo,
    codigo_formatado: row.codigo_formatado,
    situacao_qbq: row.situacao_qbq,
    divergencia: row.divergencia,
    ...(row.justificativa ? { justificativa: row.justificativa, fonte_justificativa: fonteDe(row.fonte_justificativa_arquivo, row.fonte_justificativa_linha, row.fonte_justificativa_aba) } : {}),
    caminho: caminhoOcupacao(row.codigo),
    cbo: row.titulo_cbo
      ? {
          titulo: row.titulo_cbo,
          familia: row.familia,
          sinonimos: sins,
          vigencia: { status: row.vigencia_cbo_status, desde: row.vigencia_cbo_desde, ate: row.vigencia_cbo_ate },
          fonte: fonteDe(row.fonte_cbo_arquivo, row.fonte_cbo_linha),
        }
      : null,
    qbq: row.titulo_qbq
      ? {
          titulo: row.titulo_qbq,
          sintese: row.sintese,
          ...(opcoes.perfil ? { perfil_ocupacional: row.perfil_ocupacional } : {}),
          niveis: {
            conhecimento: row.nivel_conhecimento,
            habilidade: row.nivel_habilidade,
            atitude: row.nivel_atitude,
            qualificacao: row.nivel_qualificacao,
          },
          taxonomia_conhecimento: row.taxonomia_conhecimento,
          vigencia: { status: row.vigencia_qbq_status, desde: row.vigencia_qbq_desde, ate: row.vigencia_qbq_ate },
          fonte: fonteDe(row.fonte_qbq_arquivo, row.fonte_qbq_linha, row.fonte_qbq_aba),
        }
      : null,
    contagens: {
      sinonimos: row.n_sinonimos,
      areas: row.n_areas,
      atividades: row.n_atividades,
      conhecimentos: row.n_conhecimentos,
      habilidades: row.n_habilidades,
      atitudes: row.n_atitudes,
    },
    links: {
      sinonimos: `/v1/ocupacoes/${row.codigo}/sinonimos`,
      atividades: `/v1/ocupacoes/${row.codigo}/atividades`,
      competencias: `/v1/ocupacoes/${row.codigo}/competencias`,
      similares: `/v1/ocupacoes/${row.codigo}/similares`,
      familia: `/v1/cbo/familias/${row.familia}`,
    },
  };
  if (opcoes.atividades) dados.atividades = atividades(row.codigo, { modo: opcoes.atividades === "resumo" ? "resumo" : "completo" }).dados;
  if (opcoes.competencias) {
    dados.competencias = competencias(row.codigo, {
      incluirConceitos: true,
      limite: opcoes.competencias === "principais" ? 10 : 100,
      importanciaMin: opcoes.competencias === "principais" ? undefined : undefined,
    }).dados;
  }
  return { dados, avisos: [...avisos, ...avisosOcupacao(row, true)] };
}

function inexistenteSilencioso(): Problema {
  return new Problema(404, "/v1/problemas/codigo-inexistente", "Código não encontrado", "Ocupação ausente.");
}

export function listarSinonimosDaOcupacao(entrada: string): Saida {
  const { ocupacao, avisos } = exigirOcupacao(entrada);
  const itens = sinonimosDa(ocupacao.codigo).map((sinonimo) => ({
    sinonimo: sinonimo.sinonimo,
    codigo: ocupacao.codigo,
    fonte: fonteDe(sinonimo.fonte_arquivo, sinonimo.fonte_linha),
  }));
  return { dados: itens, total: itens.length, avisos };
}

export function buscarSinonimos(filtro: FiltroOcupacao): Saida {
  const termos = filtro.q ? termosDaConsulta(filtro.q) : [];
  if (!termos.length && !filtro.prefixo) throw parametro("q", "Informe q ou um filtro de hierarquia.");
  const itens = [];
  for (const sinonimo of sinonimos()) {
    if (termos.length && !textoCasa(sinonimo.sinonimo, termos)) continue;
    const ocupacao = ocupacaoPorCodigo(sinonimo.ocupacao);
    if (!ocupacao || !passa(ocupacao, { ...filtro, q: undefined })) continue;
    itens.push({
      sinonimo: sinonimo.sinonimo,
      codigo: ocupacao.codigo,
      codigo_formatado: ocupacao.codigo_formatado,
      titulo_cbo: ocupacao.titulo_cbo,
      nivel_qualificacao: ocupacao.nivel_qualificacao,
      fonte: fonteDe(sinonimo.fonte_arquivo, sinonimo.fonte_linha),
      ...(termos.length ? { casou_em: "sinonimo" as const, trecho: trecho(sinonimo.sinonimo, termos) } : {}),
    });
  }
  itens.sort((a, b) => a.sinonimo.localeCompare(b.sinonimo, "pt") || a.codigo.localeCompare(b.codigo));
  const pagina = paginar(itens, filtro.limite, filtro.deslocamento);
  return { dados: pagina.fatia, total: pagina.total, limite: filtro.limite, deslocamento: filtro.deslocamento };
}

export function sugerir(q: string, limite = 8): Saida {
  const consulta = termosDaConsulta(q).join(" ");
  if (!consulta) throw parametro("q", "Informe o texto do autocompletar.");
  const vistos = new Set<string>();
  const itens: { codigo: string; rotulo: string; casou_em: string }[] = [];
  for (const ocupacao of todasOcupacoes()) {
    const rotulo = ocupacao.titulo_cbo ?? ocupacao.titulo_qbq ?? "";
    const busca = ocupacao.titulo_cbo_busca ?? ocupacao.titulo_qbq_busca ?? "";
    if (busca.startsWith(consulta)) {
      itens.push({ codigo: ocupacao.codigo, rotulo, casou_em: "titulo" });
      vistos.add(ocupacao.codigo);
    }
  }
  for (const sinonimo of sinonimos()) {
    if (vistos.has(sinonimo.ocupacao + sinonimo.sinonimo)) continue;
    if (!sinonimo.busca.startsWith(consulta)) continue;
    itens.push({ codigo: sinonimo.ocupacao, rotulo: sinonimo.sinonimo, casou_em: "sinonimo" });
  }
  itens.sort((a, b) => (a.casou_em === b.casou_em ? a.rotulo.localeCompare(b.rotulo, "pt") : a.casou_em === "titulo" ? -1 : 1));
  return { dados: itens.slice(0, limite), total: itens.length, limite };
}

type AtividadeRow = {
  sigla: string;
  numero: number | null;
  descricao: string;
  ordem: number;
  fonte_arquivo: string | null;
  fonte_linha: number | null;
};
type AreaRow = { sigla: string; nome: string; ordem: number; fonte_arquivo: string | null; fonte_linha: number | null };

export function atividades(
  entrada: string,
  opcoes: { area?: string; transversais?: "incluir" | "excluir" | "somente"; q?: string; modo?: "completo" | "resumo" } = {},
): Saida {
  const { ocupacao, avisos } = exigirOcupacao(entrada);
  if (ocupacao.n_areas === 0) {
    return {
      dados: {
        codigo: ocupacao.codigo,
        areas: [],
        total_areas: 0,
        total_atividades: 0,
        motivo: "A fonte oficial não descreve perfil ocupacional para esta ocupação.",
      },
      avisos,
    };
  }
  const areas = todos<AreaRow>("SELECT sigla, nome, ordem, fonte_arquivo, fonte_linha FROM area WHERE ocupacao = ? ORDER BY ordem", ocupacao.codigo);
  const atos = todos<AtividadeRow>(
    "SELECT sigla, numero, descricao, ordem, fonte_arquivo, fonte_linha FROM atividade WHERE ocupacao = ? ORDER BY ordem",
    ocupacao.codigo,
  );
  const termos = opcoes.q ? termosDaConsulta(opcoes.q) : [];
  const transversais = opcoes.transversais ?? "incluir";
  const grupos = [];
  for (const area of areas) {
    if (opcoes.area && area.sigla !== opcoes.area) continue;
    const transversal = area.sigla === "Y" || area.sigla === "Z";
    if (transversais === "excluir" && transversal) continue;
    if (transversais === "somente" && !transversal) continue;
    let atividadesDaArea = atos.filter((atividade) => atividade.sigla === area.sigla);
    if (termos.length) atividadesDaArea = atividadesDaArea.filter((atividade) => textoCasa(atividade.descricao, termos) || textoCasa(area.nome, termos));
    if (termos.length && atividadesDaArea.length === 0) continue;
    grupos.push({
      sigla: area.sigla,
      nome: area.nome,
      fonte: fonteDe(area.fonte_arquivo, area.fonte_linha),
      total_atividades: atividadesDaArea.length,
      ...(opcoes.modo === "resumo"
        ? {}
        : {
            atividades: atividadesDaArea.map((atividade) => ({
              numero: atividade.numero,
              descricao: atividade.descricao,
              fonte: fonteDe(atividade.fonte_arquivo, atividade.fonte_linha),
            })),
          }),
    });
  }
  const totalAtividades = grupos.reduce((soma, grupo) => soma + grupo.total_atividades, 0);
  return {
    dados: { codigo: ocupacao.codigo, areas: grupos, total_areas: grupos.length, total_atividades: totalAtividades },
    avisos: [
      ...avisos,
      {
        codigo: "D017",
        mensagem: "A sigla da área ordena o perfil dentro da ocupação e não é comparável entre ocupações. O número da atividade é o da fonte, com lacunas e repetições.",
        link: "/v1/decisoes/D017",
      },
    ],
  };
}

type ChaRow = {
  dimensao: string;
  taxonomia: string | null;
  codigo: string;
  nivel_vocabulario: string;
  profundidade: number | null;
  frequencia: number | null;
  importancia: number | null;
  descricao_item: string | null;
  linha: number | null;
  balde: number;
};

export function competencias(
  entrada: string,
  opcoes: {
    dimensao?: "conhecimentos" | "habilidades" | "atitudes";
    importanciaMin?: number;
    frequenciaMin?: number;
    profundidadeMin?: number;
    ramo?: string;
    nivelRamo?: string;
    excluirBaldes?: boolean;
    incluirConceitos?: boolean;
    limite?: number;
    deslocamento?: number;
  } = {},
): Saida {
  const { ocupacao, avisos } = exigirOcupacao(entrada);
  const row = cheia(ocupacao.codigo)!;
  const base = {
    codigo: row.codigo,
    situacao_qbq: row.situacao_qbq,
    justificativa: row.justificativa,
    taxonomia_conhecimento: row.taxonomia_conhecimento,
    niveis: {
      conhecimento: row.nivel_conhecimento,
      habilidade: row.nivel_habilidade,
      atitude: row.nivel_atitude,
      qualificacao: row.nivel_qualificacao,
    },
  };
  if (row.situacao_qbq === "nao_classificada" || row.situacao_qbq === "sem_nivel_sem_justificativa" || row.situacao_qbq === "ausente_no_qbq") {
    return {
      dados: {
        ...base,
        motivo: row.justificativa ?? "Esta ocupação não tem competências no QBQ.",
        conhecimentos: { total: 0, itens: [] },
        habilidades: { total: 0, itens: [] },
        atitudes: { total: 0, itens: [] },
      },
      avisos: [...avisos, ...avisosOcupacao(row, true)],
    };
  }
  let folhas: Set<string> | undefined;
  if (opcoes.ramo) {
    if (!opcoes.nivelRamo || !row.taxonomia_conhecimento && opcoes.dimensao === "conhecimentos") {
      throw parametro("nivel_ramo", "Informe nivel_ramo junto com ramo.");
    }
    const vocabulario = opcoes.dimensao === "habilidades" || opcoes.dimensao === "atitudes" ? opcoes.dimensao : row.taxonomia_conhecimento;
    if (!vocabulario || !opcoes.nivelRamo) throw parametro("ramo", "Não foi possível localizar o ramo no vocabulário da ocupação.");
    if (!termoDe(vocabulario, opcoes.nivelRamo, opcoes.ramo)) {
      throw parametro("ramo", `O termo ${opcoes.ramo} não existe em ${vocabulario}/${opcoes.nivelRamo}.`);
    }
    folhas = new Set(codigosFolha(vocabulario, opcoes.nivelRamo, opcoes.ramo));
  }
  const linhas = todos<ChaRow>(
    `SELECT dimensao, taxonomia, codigo, nivel_vocabulario, profundidade, frequencia, importancia, descricao_item, linha, balde
     FROM cha WHERE ocupacao = ? ORDER BY importancia DESC, ordem`,
    row.codigo,
  );
  const dimensoes = opcoes.dimensao ? [opcoes.dimensao] : (["conhecimentos", "habilidades", "atitudes"] as const);
  const blocos: Record<string, { total: number; itens: unknown[]; motivo_conceito?: Aviso }> = {};
  for (const dimensao of ["conhecimentos", "habilidades", "atitudes"] as const) {
    if (!dimensoes.includes(dimensao)) continue;
    let itens = linhas.filter((linha) => linha.dimensao === dimensao);
    if (opcoes.importanciaMin != null) itens = itens.filter((linha) => (linha.importancia ?? 0) >= opcoes.importanciaMin!);
    if (opcoes.frequenciaMin != null) itens = itens.filter((linha) => (linha.frequencia ?? 0) >= opcoes.frequenciaMin!);
    if (opcoes.profundidadeMin != null) itens = itens.filter((linha) => (linha.profundidade ?? 0) >= opcoes.profundidadeMin!);
    if (opcoes.excluirBaldes) itens = itens.filter((linha) => linha.balde === 0);
    if (folhas) itens = itens.filter((linha) => folhas!.has(linha.codigo));
    const total = itens.length;
    const limite = opcoes.limite ?? total;
    const deslocamento = opcoes.deslocamento ?? 0;
    const fatia = itens.slice(deslocamento, deslocamento + limite);
    const motivo = motivoConceito(false, dimensao);
    blocos[dimensao] = {
      total,
      ...(motivo ? { motivo_conceito: motivo } : {}),
      itens: fatia.map((linha) => itemCompetencia(linha, dimensao, row.taxonomia_conhecimento, opcoes.incluirConceitos === true)),
    };
  }
  return {
    dados: { ...base, ...blocos, ...(opcoes.limite != null && linhas.length > opcoes.limite ? { truncado: true } : {}) },
    avisos: [...avisos, ...avisosOcupacao(row, true)],
    limite: opcoes.limite,
    deslocamento: opcoes.deslocamento,
  };
}

function itemCompetencia(linha: ChaRow, dimensao: string, taxonomia: string | null, incluirConceitos: boolean) {
  const vocabulario = dimensao === "conhecimentos" ? taxonomia : dimensao;
  const termo = vocabulario ? termoDe(vocabulario, linha.nivel_vocabulario, linha.codigo) : undefined;
  const balde = linha.balde === 1 || ehBalde(linha.codigo);
  const conceito = !balde && dimensao === "habilidades" ? conceitoDe(linha.nivel_vocabulario, linha.codigo) : undefined;
  const motivo = motivoConceito(balde, dimensao);
  return {
    codigo: linha.codigo,
    nivel_vocabulario: linha.nivel_vocabulario,
    termo: termo?.descricao ?? null,
    descricao_item: linha.descricao_item,
    caminho: vocabulario ? caminhoTermo(vocabulario, linha.nivel_vocabulario, linha.codigo) : [],
    graus: {
      ...(dimensao === "conhecimentos" ? { profundidade: linha.profundidade } : {}),
      ...(dimensao !== "atitudes" ? { frequencia: linha.frequencia } : {}),
      importancia: linha.importancia,
    },
    balde,
    ...(incluirConceitos || motivo ? { conceito: conceito ? { termo: conceito.termo, conceito: conceito.conceito, fonte: fonteDe(conceito.fonte_arquivo) } : null, ...(motivo ? { motivo_conceito: motivo } : {}) } : {}),
    ...(divergenciaDe(linha.nivel_vocabulario, linha.codigo) ? { divergencia_de_grafia: divergenciaDe(linha.nivel_vocabulario, linha.codigo) } : {}),
    fonte: fonteItem(linha.linha),
  };
}

export function similares(entrada: string, dimensao: string, escopo: string, limite: number): Saida {
  const { ocupacao, avisos } = exigirOcupacao(entrada);
  const mapa = mapaDimensao(dimensao);
  if (mapa.dimensao === "conhecimentos" && !ocupacao.taxonomia_conhecimento) {
    return { dados: { codigo: ocupacao.codigo, similares: [], termos_origem: 0 }, avisos, derivado: true, metodo: METODO_SIMILARIDADE };
  }
  if (mapa.vocabulario === "conhecimentos" && ocupacao.taxonomia_conhecimento == null) {
    throw parametro("dimensao", "A ocupação não tem taxonomia de conhecimento.");
  }
  const taxonomia = mapa.dimensao === "conhecimentos" ? ocupacao.taxonomia_conhecimento! : "";
  const base = todos<{ codigo: string }>(
    "SELECT codigo FROM cha_conjunto WHERE ocupacao = ? AND dimensao = ? AND taxonomia = ?",
    ocupacao.codigo,
    mapa.dimensao,
    taxonomia,
  );
  const linhas = todos<{ codigo: string; em_comum: number; n_outra: number }>(
    `SELECT c.ocupacao AS codigo, count(*) AS em_comum,
            (SELECT count(*) FROM cha_conjunto x WHERE x.ocupacao = c.ocupacao AND x.dimensao = c.dimensao AND x.taxonomia = c.taxonomia) AS n_outra
     FROM cha_conjunto c
     WHERE c.dimensao = ? AND c.taxonomia = ? AND c.ocupacao != ?
       AND c.codigo IN (SELECT codigo FROM cha_conjunto WHERE ocupacao = ? AND dimensao = ? AND taxonomia = ?)
     GROUP BY c.ocupacao`,
    mapa.dimensao,
    taxonomia,
    ocupacao.codigo,
    ocupacao.codigo,
    mapa.dimensao,
    taxonomia,
  );
  const nOrigem = base.length;
  const candidatos = linhas
    .map((linha) => {
      const outra = ocupacaoPorCodigo(linha.codigo);
      if (!outra) return null;
      if (!escopoCasa(ocupacao, outra, escopo)) return null;
      const uniao = nOrigem + linha.n_outra - linha.em_comum;
      return {
        outra,
        em_comum: linha.em_comum,
        so_na_origem: nOrigem - linha.em_comum,
        so_na_outra: linha.n_outra - linha.em_comum,
        similaridade: uniao === 0 ? 0 : Math.round((linha.em_comum / uniao) * 1000) / 1000,
        bruto: uniao === 0 ? 0 : linha.em_comum / uniao,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .sort((a, b) => b.bruto - a.bruto || b.em_comum - a.em_comum || b.outra.codigo.localeCompare(a.outra.codigo));
  const avisosFinais = [...avisos];
  if (mapa.dimensao === "atitudes") {
    avisosFinais.push({
      mensagem: "Atitudes têm baixa resolução: são 22 termos, cerca de 2,75 por ocupação.",
    });
  }
  return {
    dados: {
      codigo: ocupacao.codigo,
      dimensao: mapa.nome,
      termos_origem: nOrigem,
      escopo,
      similares: candidatos.slice(0, limite).map((item) => ({
        codigo: item.outra.codigo,
        codigo_formatado: item.outra.codigo_formatado,
        titulo: item.outra.titulo_cbo ?? item.outra.titulo_qbq,
        familia: familiaDe(item.outra.familia),
        nivel_qualificacao: item.outra.nivel_qualificacao,
        similaridade: item.similaridade,
        em_comum: item.em_comum,
        so_na_origem: item.so_na_origem,
        so_na_outra: item.so_na_outra,
      })),
    },
    total: candidatos.length,
    limite,
    avisos: avisosFinais,
    derivado: true,
    metodo: METODO_SIMILARIDADE,
  };
}

function escopoCasa(origem: OcupacaoLista, outra: OcupacaoLista, escopo: string) {
  if (escopo === "todas") return true;
  if (escopo === "mesma_familia") return outra.familia === origem.familia;
  if (escopo === "mesmo_grande_grupo") return outra.codigo[0] === origem.codigo[0];
  if (escopo === "fora_da_familia") return outra.familia !== origem.familia;
  throw parametro("escopo", `Escopo desconhecido: ${escopo}.`, ["todas", "mesma_familia", "mesmo_grande_grupo", "fora_da_familia"]);
}

export function mapaDimensao(nome: string) {
  if (nome === "habilidades" || nome === "atitudes") return { nome, dimensao: nome, vocabulario: nome, nivel: FOLHA[nome], taxonomia: "" };
  if (nome === "conhecimentos-i" || nome === "conhecimentos-ii") {
    return { nome, dimensao: "conhecimentos", vocabulario: nome, nivel: FOLHA[nome], taxonomia: nome };
  }
  if (nome === "conhecimentos") return { nome, dimensao: "conhecimentos", vocabulario: "", nivel: "", taxonomia: "" };
  throw parametro("dimensao", `Dimensão desconhecida: ${nome}.`, ["habilidades", "atitudes", "conhecimentos", "conhecimentos-i", "conhecimentos-ii"]);
}

export function comparar(entradas: string[], dimensao: string, importanciaMin?: number): Saida {
  if (entradas.length < 2 || entradas.length > 5) throw parametro("codigos", "A comparação pede de 2 a 5 códigos.");
  const lidos = entradas.map((entrada) => exigirOcupacao(entrada));
  const mapa = mapaDimensao(dimensao);
  const avisos = lidos.flatMap((lido) => lido.avisos);
  const taxonomias = new Set(lidos.map((lido) => lido.ocupacao.taxonomia_conhecimento).filter(Boolean));
  let comparavel = true;
  if (mapa.dimensao === "conhecimentos" && taxonomias.size > 1) {
    comparavel = false;
    avisos.push({
      codigo: "D004",
      mensagem: "As ocupações usam taxonomias de conhecimento diferentes. Os conhecimentos não são comparáveis.",
      link: "/v1/decisoes/D004",
    });
  }
  const conjuntos = new Map<string, Map<string, ChaRow>>();
  if (comparavel) {
    const taxonomia = mapa.dimensao === "conhecimentos" ? [...taxonomias][0] ?? "" : "";
    for (const lido of lidos) {
      const linhas = todos<ChaRow>(
        `SELECT dimensao, taxonomia, codigo, nivel_vocabulario, profundidade, frequencia, importancia, descricao_item, linha, balde
         FROM cha WHERE ocupacao = ? AND dimensao = ? AND balde = 0`,
        lido.ocupacao.codigo,
        mapa.dimensao,
      );
      const mapaItens = new Map<string, ChaRow>();
      for (const linha of linhas) {
        if (mapa.dimensao === "conhecimentos" && linha.taxonomia !== taxonomia) continue;
        if (importanciaMin != null && (linha.importancia ?? 0) < importanciaMin) continue;
        const atual = mapaItens.get(linha.codigo);
        if (!atual || (linha.importancia ?? 0) > (atual.importancia ?? 0)) mapaItens.set(linha.codigo, linha);
      }
      conjuntos.set(lido.ocupacao.codigo, mapaItens);
    }
  }
  const codigos = lidos.map((lido) => lido.ocupacao.codigo);
  const universo = new Set<string>();
  for (const conjunto of conjuntos.values()) for (const codigo of conjunto.keys()) universo.add(codigo);
  const emComum = [];
  const exclusivos: Record<string, unknown[]> = {};
  for (const codigo of codigos) exclusivos[codigo] = [];
  for (const codigoTermo of universo) {
    const presentes = codigos.filter((codigo) => conjuntos.get(codigo)?.has(codigoTermo));
    const amostra = conjuntos.get(presentes[0])?.get(codigoTermo);
    const vocabulario = mapa.dimensao === "conhecimentos" ? lidos[0].ocupacao.taxonomia_conhecimento : mapa.vocabulario;
    const registro = {
      codigo: codigoTermo,
      termo: vocabulario && amostra ? termoDe(vocabulario, amostra.nivel_vocabulario, codigoTermo)?.descricao ?? null : null,
      graus: Object.fromEntries(
        presentes.map((codigo) => {
          const linha = conjuntos.get(codigo)!.get(codigoTermo)!;
          return [codigo, { profundidade: linha.profundidade, frequencia: linha.frequencia, importancia: linha.importancia }];
        }),
      ),
    };
    if (presentes.length === codigos.length) {
      const diferenca = codigos.length === 2 ? diferencaGraus(conjuntos.get(codigos[0])!.get(codigoTermo)!, conjuntos.get(codigos[1])!.get(codigoTermo)!) : undefined;
      emComum.push({ ...registro, ...(diferenca ? { diferenca } : {}) });
    } else if (presentes.length === 1) {
      exclusivos[presentes[0]].push(registro);
    }
  }
  const pares = [];
  for (let i = 0; i < codigos.length; i++) {
    for (let j = i + 1; j < codigos.length; j++) {
      const a = conjuntos.get(codigos[i]);
      const b = conjuntos.get(codigos[j]);
      if (!a || !b) {
        pares.push({ a: codigos[i], b: codigos[j], similaridade: null });
        continue;
      }
      let comum = 0;
      for (const codigo of a.keys()) if (b.has(codigo)) comum++;
      const uniao = a.size + b.size - comum;
      pares.push({ a: codigos[i], b: codigos[j], similaridade: uniao === 0 ? 0 : Math.round((comum / uniao) * 1000) / 1000, em_comum: comum });
    }
  }
  if (mapa.dimensao === "atitudes") avisos.push({ mensagem: "Atitudes têm baixa resolução: são 22 termos, cerca de 2,75 por ocupação." });
  return {
    dados: {
      ocupacoes: lidos.map((lido) => ({
        ...resumoOcupacao(lido.ocupacao),
        caminho: caminhoOcupacao(lido.ocupacao.codigo),
        niveis: {
          conhecimento: lido.ocupacao.nivel_conhecimento,
          habilidade: lido.ocupacao.nivel_habilidade,
          atitude: lido.ocupacao.nivel_atitude,
          qualificacao: lido.ocupacao.nivel_qualificacao,
        },
        taxonomia_conhecimento: lido.ocupacao.taxonomia_conhecimento,
        total_atividades: lido.ocupacao.n_atividades,
      })),
      dimensao: mapa.nome,
      comparavel,
      similaridade: pares,
      em_comum: emComum,
      exclusivos,
    },
    avisos,
    derivado: true,
    metodo: `${METODO_SIMILARIDADE} ${"Diferença de graus: subtração simples, na ordem dos códigos, sem índice sintético. Atividades são apenas contadas."}`,
  };
}

function diferencaGraus(a: ChaRow, b: ChaRow) {
  const sub = (x: number | null, y: number | null) => (x == null || y == null ? null : x - y);
  return {
    importancia: sub(a.importancia, b.importancia),
    frequencia: sub(a.frequencia, b.frequencia),
    profundidade: sub(a.profundidade, b.profundidade),
  };
}
