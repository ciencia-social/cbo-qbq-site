import { noCbo, ocupacaoPorCodigo, ocupacoes, termo as termoDe } from "@/consulta/cache";
import { mapaDimensao } from "@/consulta/ocupacao";
import { familiaDe, resumoOcupacao } from "@/consulta/formatar";
import { todos } from "@/dados/banco";
import { parametro } from "@/http/erros";
import { paginar } from "@/http/parametros";
import { METODO_DISTINGUE, METODO_NIVEIS, NIVEL_POR_TAMANHO, type Saida } from "@/tipos";
import { api } from "@/versao";

export function estatisticas(): Saida {
  const n = (sql: string) => (todos<{ n: number }>(sql)[0]?.n ?? 0);
  return {
    dados: {
      grandes_grupos: n("SELECT count(*) n FROM cbo_no WHERE nivel = 'grande_grupo'"),
      subgrupos_principais: n("SELECT count(*) n FROM cbo_no WHERE nivel = 'subgrupo_principal'"),
      subgrupos: n("SELECT count(*) n FROM cbo_no WHERE nivel = 'subgrupo'"),
      familias: n("SELECT count(*) n FROM cbo_no WHERE nivel = 'familia'"),
      ocupacoes_cbo: n("SELECT count(*) n FROM ocupacao WHERE titulo_cbo IS NOT NULL"),
      sinonimos: n("SELECT count(*) n FROM sinonimo"),
      areas: n("SELECT count(*) n FROM area"),
      atividades: n("SELECT count(*) n FROM atividade"),
      ocupacoes_qbq: n("SELECT count(*) n FROM ocupacao WHERE titulo_qbq IS NOT NULL"),
      conhecimentos: n("SELECT count(*) n FROM cha WHERE dimensao = 'conhecimentos'"),
      habilidades: n("SELECT count(*) n FROM cha WHERE dimensao = 'habilidades'"),
      atitudes: n("SELECT count(*) n FROM cha WHERE dimensao = 'atitudes'"),
      conceitos: n("SELECT count(*) n FROM conceito"),
      nao_classificadas: n("SELECT count(*) n FROM ocupacao WHERE situacao_qbq = 'nao_classificada'"),
      divergencias: n("SELECT count(*) n FROM ocupacao WHERE divergencia IS NOT NULL"),
      ocupacoes: n("SELECT count(*) n FROM ocupacao"),
    },
    derivado: true,
    metodo: "Contagens dos conjuntos carregados nesta versão. Não são indicador oficial além da própria fonte.",
  };
}

export function estatisticasNiveis(dimensao: string, agruparPor?: string, prefixo?: string): Saida {
  const coluna = colunaNivel(dimensao);
  const grupos = gruposDe(agruparPor, prefixo);
  return {
    dados: grupos.map((grupo) => distribuicao(grupo, coluna)),
    derivado: true,
    metodo: METODO_NIVEIS,
  };
}

function colunaNivel(dimensao: string) {
  const mapa: Record<string, string> = {
    qualificacao: "nivel_qualificacao",
    conhecimento: "nivel_conhecimento",
    habilidade: "nivel_habilidade",
    atitude: "nivel_atitude",
  };
  const coluna = mapa[dimensao];
  if (!coluna) throw parametro("dimensao_nivel", `Dimensão de nível desconhecida: ${dimensao}.`, Object.keys(mapa));
  return coluna;
}

function gruposDe(agruparPor?: string, prefixo?: string) {
  if (!agruparPor) return [{ codigo: prefixo ?? null, titulo: prefixo ? (noCbo(NIVEL_POR_TAMANHO[prefixo.length], prefixo)?.titulo ?? null) : "conjunto" }];
  const mapa: Record<string, string> = {
    grande_grupo: "grande_grupo",
    subgrupo_principal: "subgrupo_principal",
    subgrupo: "subgrupo",
    familia: "familia",
  };
  const nivel = mapa[agruparPor];
  if (!nivel) throw parametro("agrupar_por", `agrupar_por desconhecido: ${agruparPor}.`, Object.keys(mapa));
  const nos = todos<{ codigo: string; titulo: string }>("SELECT codigo, titulo FROM cbo_no WHERE nivel = ? ORDER BY codigo", nivel)
    .filter((no) => !prefixo || no.codigo.startsWith(prefixo));
  return nos;
}

function distribuicao(grupo: { codigo: string | null; titulo: string | null }, coluna: string) {
  const where = grupo.codigo ? "AND codigo LIKE ?" : "";
  const params = grupo.codigo ? [`${grupo.codigo}%`] : [];
  const linhas = todos<{ nivel: number | null; n: number }>(
    `SELECT ${coluna} AS nivel, count(*) n FROM ocupacao WHERE titulo_qbq IS NOT NULL ${where} GROUP BY ${coluna}`,
    ...params,
  );
  const comNivel = linhas.filter((linha) => linha.nivel != null) as { nivel: number; n: number }[];
  const sem = linhas.find((linha) => linha.nivel == null)?.n ?? 0;
  const valores: number[] = [];
  for (const linha of comNivel) for (let i = 0; i < linha.n; i++) valores.push(linha.nivel);
  valores.sort((a, b) => a - b);
  const media = valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100 : null;
  const mediana = valores.length
    ? valores.length % 2
      ? valores[(valores.length - 1) / 2]
      : (valores[valores.length / 2 - 1] + valores[valores.length / 2]) / 2
    : null;
  const porNivel: Record<string, number> = {};
  for (let nivel = 1; nivel <= 8; nivel++) porNivel[String(nivel)] = comNivel.find((linha) => linha.nivel === nivel)?.n ?? 0;
  return {
    codigo: grupo.codigo,
    titulo: grupo.titulo,
    total_classificado: valores.length,
    sem_nivel: sem,
    media,
    mediana,
    niveis: porNivel,
  };
}

export function estatisticasCompetencias(opcoes: {
  vocabulario: string;
  nivel?: string;
  prefixo?: string;
  nivelQualificacao?: number;
  ordenar?: string;
  excluirBaldes?: boolean;
  limite: number;
}): Saida {
  const mapa = mapaDimensao(opcoes.vocabulario);
  const where = ["c.dimensao = ?"];
  const params: (string | number)[] = [mapa.dimensao];
  if (mapa.taxonomia) {
    where.push("c.taxonomia = ?");
    params.push(mapa.taxonomia);
  }
  if (opcoes.excluirBaldes) where.push("c.balde = 0");
  if (opcoes.prefixo) {
    where.push("c.ocupacao LIKE ?");
    params.push(`${opcoes.prefixo}%`);
  }
  if (opcoes.nivelQualificacao != null) {
    where.push("o.nivel_qualificacao = ?");
    params.push(opcoes.nivelQualificacao);
  }
  if (opcoes.nivel) {
    where.push("c.nivel_vocabulario = ?");
    params.push(opcoes.nivel);
  }
  const ordem = opcoes.ordenar === "-importancia_media" ? "importancia_media DESC" : "ocupacoes DESC";
  const linhas = todos<{ codigo: string; nivel: string; descricao: string; ocupacoes: number; importancia_media: number | null; frequencia_media: number | null }>(
    `SELECT c.codigo, c.nivel_vocabulario AS nivel, t.descricao,
            count(DISTINCT c.ocupacao) AS ocupacoes,
            avg(c.importancia) AS importancia_media,
            avg(c.frequencia) AS frequencia_media
     FROM cha c
     JOIN ocupacao o ON o.codigo = c.ocupacao
     LEFT JOIN termo t ON t.vocabulario = ? AND t.nivel = c.nivel_vocabulario AND t.codigo = c.codigo
     WHERE ${where.join(" AND ")}
     GROUP BY c.codigo, c.nivel_vocabulario
     ORDER BY ${ordem}
     LIMIT ?`,
    mapa.vocabulario || opcoes.vocabulario,
    ...params,
    opcoes.limite,
  );
  return {
    dados: linhas.map((linha) => ({
      ...linha,
      importancia_media: linha.importancia_media == null ? null : Math.round(linha.importancia_media * 100) / 100,
      frequencia_media: linha.frequencia_media == null ? null : Math.round(linha.frequencia_media * 100) / 100,
    })),
    total: linhas.length,
    limite: opcoes.limite,
    derivado: true,
    metodo: "Ocupações distintas que exigem o termo, com a média de importância e de frequência. Baldes podem ser excluídos.",
  };
}

export function resumoGrupo(codigo: string | undefined, dimensao: string, limite: number): Saida {
  if (codigo && !/^\d{1,4}$/.test(codigo)) throw parametro("codigo", "O resumo de grupo aceita 1 a 4 dígitos, ou nenhum código para o conjunto.");
  if (codigo) {
    const nivel = NIVEL_POR_TAMANHO[codigo.length];
    if (!noCbo(nivel, codigo)) throw parametro("codigo", `Não há nó ${codigo} na classificação.`);
  }
  const mapa = mapaDimensao(dimensao);
  const doGrupo = ocupacoes().filter((ocupacao) => !codigo || ocupacao.codigo.startsWith(codigo));
  const situacao: Record<string, number> = {};
  for (const ocupacao of doGrupo) situacao[ocupacao.situacao_qbq] = (situacao[ocupacao.situacao_qbq] ?? 0) + 1;
  const niveis = distribuicao(
    { codigo: codigo ?? null, titulo: codigo ? noCbo(NIVEL_POR_TAMANHO[codigo.length], codigo)?.titulo ?? null : "conjunto" },
    "nivel_qualificacao",
  );
  const classificadas = doGrupo.filter((ocupacao) => ocupacao.situacao_qbq === "classificada");
  const universo = mapa.dimensao === "conhecimentos"
    ? ocupacoes().filter((ocupacao) => ocupacao.situacao_qbq === "classificada" && ocupacao.taxonomia_conhecimento === mapa.taxonomia)
    : ocupacoes().filter((ocupacao) => ocupacao.situacao_qbq === "classificada");
  const grupoClassificado = classificadas.filter((ocupacao) => mapa.dimensao !== "conhecimentos" || ocupacao.taxonomia_conhecimento === mapa.taxonomia);
  const uso = todos<{ termo: string; ocupacao: string; importancia: number | null }>(
    `SELECT codigo AS termo, ocupacao, MAX(importancia) AS importancia FROM cha
     WHERE dimensao = ? AND balde = 0 ${mapa.taxonomia ? "AND taxonomia = ?" : ""}
     GROUP BY codigo, ocupacao`,
    mapa.dimensao,
    ...(mapa.taxonomia ? [mapa.taxonomia] : []),
  );
  const porTermo = new Map<string, { grupo: number; geral: number; impGrupo: number[]; impGeral: number[] }>();
  const codigosGrupo = new Set(grupoClassificado.map((ocupacao) => ocupacao.codigo));
  const codigosUniverso = new Set(universo.map((ocupacao) => ocupacao.codigo));
  for (const linha of uso) {
    if (!codigosUniverso.has(linha.ocupacao)) continue;
    const atual = porTermo.get(linha.termo) ?? { grupo: 0, geral: 0, impGrupo: [], impGeral: [] };
    atual.geral++;
    if (linha.importancia != null) atual.impGeral.push(linha.importancia);
    if (codigosGrupo.has(linha.ocupacao)) {
      atual.grupo++;
      if (linha.importancia != null) atual.impGrupo.push(linha.importancia);
    }
    porTermo.set(linha.termo, atual);
  }
  const nGrupo = grupoClassificado.length || 1;
  const nGeral = universo.length || 1;
  const media = (valores: number[]) => (valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null);
  const termos = [...porTermo.entries()]
    .map(([codigoTermo, valor]) => {
      const presencaGrupo = valor.grupo / nGrupo;
      const presencaGeral = valor.geral / nGeral;
      const item = termoDe(mapa.vocabulario, mapa.nivel, codigoTermo);
      return {
        codigo: codigoTermo,
        termo: item?.descricao ?? null,
        ocupacoes_grupo: valor.grupo,
        presenca_grupo: Math.round(presencaGrupo * 1000) / 1000,
        presenca_geral: Math.round(presencaGeral * 1000) / 1000,
        diferenca_presenca: Math.round((presencaGrupo - presencaGeral) * 1000) / 1000,
        importancia_media_grupo: media(valor.impGrupo) == null ? null : Math.round(media(valor.impGrupo)! * 100) / 100,
        importancia_media_geral: media(valor.impGeral) == null ? null : Math.round(media(valor.impGeral)! * 100) / 100,
      };
    })
    .sort((a, b) => b.diferenca_presenca - a.diferenca_presenca || b.ocupacoes_grupo - a.ocupacoes_grupo);
  const presentes = [...termos].sort((a, b) => b.ocupacoes_grupo - a.ocupacoes_grupo).slice(0, limite);
  return {
    dados: {
      codigo: codigo ?? null,
      titulo: niveis.titulo,
      total_ocupacoes: doGrupo.length,
      por_situacao_qbq: situacao,
      niveis,
      termos_mais_presentes: presentes,
      termos_que_distinguem: termos.slice(0, limite),
    },
    derivado: true,
    metodo: `${METODO_DISTINGUE} ${METODO_NIVEIS}`,
  };
}

export function cobertura(situacao: string | undefined, prefixo: string | undefined, q: string | undefined, limite: number, deslocamento: number): Saida {
  const aceitas = ["so_cbo", "so_qbq", "titulo_divergente"];
  if (situacao && !aceitas.includes(situacao)) throw parametro("situacao", `Situação desconhecida: ${situacao}.`, aceitas);
  let lista = ocupacoes().filter((ocupacao) => ocupacao.divergencia && (!situacao || ocupacao.divergencia === situacao));
  if (prefixo) lista = lista.filter((ocupacao) => ocupacao.codigo.startsWith(prefixo));
  if (q) {
    const { termosDaConsulta, textoCasa } = termos();
    const pedidos = termosDaConsulta(q);
    lista = lista.filter((ocupacao) => textoCasa(ocupacao.titulo_cbo ?? "", pedidos) || textoCasa(ocupacao.titulo_qbq ?? "", pedidos));
  }
  const pagina = paginar(lista, limite, deslocamento);
  return {
    dados: pagina.fatia.map((ocupacao) => resumoOcupacao(ocupacao, { divergencia: ocupacao.divergencia })),
    total: pagina.total,
    limite,
    deslocamento,
    avisos: [{ codigo: "D015", mensagem: "Nenhuma camada é corrigida quando CBO e QBQ divergem.", link: api("/decisoes/D015") }],
  };
}

function termos() {
  return {
    termosDaConsulta: (q: string) => q.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/\s+/).filter(Boolean),
    textoCasa: (texto: string, pedidos: string[]) => {
      const palavras = texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(/\s+/).filter(Boolean);
      return pedidos.every((termo, indice) => palavras.some((palavra) => (indice === pedidos.length - 1 ? palavra.startsWith(termo) : palavra === termo)));
    },
  };
}

export function coberturaResumo(): Saida {
  const porDivergencia: Record<string, number> = { so_cbo: 0, so_qbq: 0, titulo_divergente: 0 };
  const porSituacao: Record<string, number> = {};
  const porGrupo = new Map<string, Record<string, number>>();
  for (const ocupacao of ocupacoes()) {
    porSituacao[ocupacao.situacao_qbq] = (porSituacao[ocupacao.situacao_qbq] ?? 0) + 1;
    const grupo = porGrupo.get(ocupacao.codigo[0]) ?? {};
    grupo[ocupacao.situacao_qbq] = (grupo[ocupacao.situacao_qbq] ?? 0) + 1;
    if (ocupacao.divergencia) {
      porDivergencia[ocupacao.divergencia]++;
      grupo[ocupacao.divergencia] = (grupo[ocupacao.divergencia] ?? 0) + 1;
    }
    porGrupo.set(ocupacao.codigo[0], grupo);
  }
  return {
    dados: {
      por_divergencia: porDivergencia,
      por_situacao_qbq: porSituacao,
      por_grande_grupo: [...porGrupo.entries()].sort().map(([codigo, contagens]) => ({
        codigo,
        titulo: noCbo("grande_grupo", codigo)?.titulo ?? null,
        ...contagens,
      })),
      leitura: "docs/cobertura-qbq-cbo.md",
    },
    avisos: [
      { codigo: "D015", mensagem: "As divergências entre as camadas são dado.", link: api("/decisoes/D015") },
      { codigo: "D010", mensagem: "Três ocupações não têm nível nem justificativa.", link: api("/decisoes/D010") },
    ],
  };
}

export function familiaResumo(codigo: string) {
  return familiaDe(codigo);
}
