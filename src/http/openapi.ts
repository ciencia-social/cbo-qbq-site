import { PARAMETROS_GLOBAIS, type Parametro } from "@/http/parametros";
import type { Rota } from "@/http/rotas";
import { api, DOI_DADOS, DOI_SOFTWARE_CONCEITO, LICENCAS, PREFIXO_API, REPOSITORIO_DADOS, REPOSITORIO_SERVICO, SITE, VERSAO_DADOS, VERSAO_SERVICO } from "@/versao";

/** Documento OpenAPI 3.1. Parâmetros, esquemas e documentação do site saem das mesmas declarações. */

type Esquema = Record<string, unknown>;

const ref = (nome: string) => ({ $ref: `#/components/schemas/${nome}` });
const texto: Esquema = { type: "string" };
const inteiro: Esquema = { type: "integer" };
const booleano: Esquema = { type: "boolean" };
const anulavel = (esquema: Esquema): Esquema =>
  typeof esquema.type === "string" ? { ...esquema, type: [esquema.type, "null"] } : { anyOf: [esquema, { type: "null" }] };
const objeto = (propriedades: Record<string, Esquema>, obrigatorios: string[] = Object.keys(propriedades)): Esquema => ({
  type: "object",
  properties: propriedades,
  required: obrigatorios,
});
const lista = (itens: Esquema): Esquema => ({ type: "array", items: itens });
const livre: Esquema = { type: "object", additionalProperties: true };

const ESQUEMAS: Record<string, Esquema> = {
  Aviso: objeto({ codigo: texto, mensagem: texto, link: texto }, ["mensagem"]),
  Meta: objeto(
    {
      versao_dados: texto,
      versao_schema: texto,
      total: inteiro,
      limite: inteiro,
      deslocamento: inteiro,
      derivado: { type: "boolean", description: "true quando a resposta é um cálculo deste serviço, não dado oficial." },
      metodo: { type: "string", description: "Como o cálculo derivado foi feito." },
      avisos: lista(ref("Aviso")),
    },
    ["versao_dados", "versao_schema", "derivado", "avisos"],
  ),
  Links: objeto({ proprio: texto, proxima: anulavel(texto), anterior: anulavel(texto) }),
  Envelope: {
    ...objeto({ dados: {}, meta: ref("Meta"), links: ref("Links") }),
    description: "Toda resposta 200 da API, exceto /openapi.json, vem neste envelope.",
  },
  Problema: {
    ...objeto(
      { tipo: texto, titulo: texto, status: inteiro, detalhe: texto, dica: texto, sugestoes: {} },
      ["tipo", "titulo", "status", "detalhe"],
    ),
    description: "Erro em application/problem+json (RFC 9457, com nomes em português).",
  },
  Fonte: objeto({ arquivo: texto, aba: texto, linha: inteiro }, ["arquivo"]),
  FonteDupla: objeto({ cbo: anulavel(ref("Fonte")), qbq: anulavel(ref("Fonte")) }, []),
  Passo: objeto({ nivel: texto, codigo: texto, titulo: texto }),
  Vigencia: objeto({ status: anulavel(texto), desde: anulavel(texto), ate: anulavel(texto) }),
  Niveis: objeto({ conhecimento: anulavel(inteiro), habilidade: anulavel(inteiro), atitude: anulavel(inteiro), qualificacao: anulavel(inteiro) }),
  MotivoConceito: objeto({ codigo: texto, mensagem: texto, link: texto }, ["mensagem"]),
  OcupacaoResumo: objeto(
    {
      codigo: texto,
      codigo_formatado: texto,
      titulo_cbo: anulavel(texto),
      titulo_qbq: anulavel(texto),
      familia: objeto({ codigo: texto, titulo: anulavel(texto) }),
      nivel_qualificacao: anulavel(inteiro),
      situacao_qbq: texto,
      fonte: ref("FonteDupla"),
      casou_em: texto,
      trecho: texto,
    },
    ["codigo", "codigo_formatado", "titulo_cbo", "titulo_qbq", "situacao_qbq"],
  ),
  TermoResumo: objeto(
    {
      vocabulario: texto,
      nivel: texto,
      codigo: texto,
      descricao: texto,
      pai: anulavel(objeto({ codigo: texto, nivel: texto })),
      balde: booleano,
      fonte: ref("Fonte"),
    },
    ["vocabulario", "nivel", "codigo", "descricao", "balde"],
  ),
  ItemCompetencia: objeto(
    {
      codigo: texto,
      nivel_vocabulario: texto,
      termo: anulavel(texto),
      descricao_item: anulavel(texto),
      caminho: lista(livre),
      graus: objeto({ profundidade: inteiro, frequencia: inteiro, importancia: inteiro }, []),
      balde: booleano,
      conceito: anulavel(livre),
      motivo_conceito: ref("MotivoConceito"),
      fonte: anulavel(ref("Fonte")),
    },
    ["codigo", "nivel_vocabulario", "termo", "graus", "balde"],
  ),
  BlocoCompetencia: objeto({ total: inteiro, motivo_conceito: ref("MotivoConceito"), itens: lista(ref("ItemCompetencia")) }, ["total", "itens"]),
  CodigoDecodificado: objeto(
    {
      entrada: texto,
      codigo: anulavel(texto),
      existe: booleano,
      nivel: anulavel(texto),
      titulo: anulavel(texto),
      caminho: lista(ref("Passo")),
      na_cbo: booleano,
      no_qbq: booleano,
      situacao_qbq: anulavel(texto),
      divergencia: anulavel(texto),
      fonte: ref("FonteDupla"),
      ancestral: anulavel(ref("Passo")),
      erro: texto,
    },
    ["entrada", "existe"],
  ),

  // Esquemas de dados por rota
  R02_Versao: objeto(
    {
      versao_dados: texto,
      versao_schema: texto,
      dados_commit: { type: ["string", "null"], pattern: "^[0-9a-f]{40}$", description: "Commit de cbo-qbq-dados de onde o banco saiu." },
      dados_tag: { type: ["string", "null"], description: "A tag fixada, quando o commit é o dela; null quando o banco saiu de outra árvore." },
      camadas: objeto({ cbo_espinha: texto, cbo_perfil: texto, qbq: texto }),
      contagens: { type: "object", additionalProperties: { type: "integer" } },
      versao_servico: { type: "string", description: "Versão do software (semver), independente da versão dos dados." },
      doi: objeto({ conceito: texto, versao: texto }, ["conceito", "versao"]),
      doi_software: { type: ["string", "null"], description: "DOI de conceito do software; null até a primeira release no Zenodo." },
      citacao: objeto(
        { dados: texto, software: texto, bibtex_dados: texto, bibtex_software: texto, doi_url: texto },
        ["dados", "software", "bibtex_dados", "bibtex_software", "doi_url"],
      ),
      autor: objeto({ nome: texto, orcid: texto }, ["nome", "orcid"]),
      licencas: objeto({
        dados: objeto({ nome: texto, spdx: texto, url: texto }),
        codigo: objeto({ nome: texto, spdx: texto, url: texto }),
      }),
      licenca: { ...objeto({ nome: texto, url: texto, citacao: texto }), deprecated: true, description: "Obsoleto. Use licencas e citacao." },
      fontes_oficiais: lista(texto),
      repositorio_dados: texto,
      repositorio_servico: texto,
      ressalvas: lista(texto),
    },
    ["versao_dados", "versao_schema", "dados_commit", "dados_tag", "camadas", "contagens", "versao_servico", "doi", "doi_software", "citacao", "autor", "licencas", "licenca", "repositorio_dados", "repositorio_servico"],
  ),
  R14_No: objeto(
    {
      codigo: texto,
      titulo: texto,
      nivel: texto,
      pai: anulavel(texto),
      total_ocupacoes: inteiro,
      fonte: anulavel(ref("Fonte")),
      caminho: lista(ref("Passo")),
      filhos: lista(objeto({ nivel: texto, codigo: texto, titulo: anulavel(texto), nivel_qualificacao: anulavel(inteiro) }, ["nivel", "codigo"])),
    },
    ["codigo", "titulo", "nivel", "total_ocupacoes"],
  ),
  R17_Codigos: {
    oneOf: [
      ref("CodigoDecodificado"),
      objeto({ itens: lista(ref("CodigoDecodificado")), validos: inteiro, invalidos: inteiro }),
    ],
    description: "Um código em /codigos/{codigo}; um lote com itens, validos e invalidos em /codigos.",
  },
  R20_Ocupacoes: lista(ref("OcupacaoResumo")),
  R21_Ficha: objeto(
    {
      codigo: texto,
      codigo_formatado: texto,
      situacao_qbq: texto,
      divergencia: anulavel(texto),
      justificativa: texto,
      fonte_justificativa: ref("Fonte"),
      caminho: lista(ref("Passo")),
      cbo: anulavel(
        objeto(
          {
            titulo: texto,
            familia: texto,
            sinonimos: lista(objeto({ titulo: texto, fonte: anulavel(ref("Fonte")) }, ["titulo"])),
            vigencia: ref("Vigencia"),
            fonte: anulavel(ref("Fonte")),
          },
          ["titulo", "familia"],
        ),
      ),
      qbq: anulavel(
        objeto(
          {
            titulo: texto,
            sintese: anulavel(texto),
            perfil_ocupacional: anulavel(texto),
            niveis: ref("Niveis"),
            taxonomia_conhecimento: anulavel(texto),
            vigencia: ref("Vigencia"),
            fonte: anulavel(ref("Fonte")),
          },
          ["titulo", "niveis"],
        ),
      ),
      contagens: objeto({ sinonimos: inteiro, areas: inteiro, atividades: inteiro, conhecimentos: inteiro, habilidades: inteiro, atitudes: inteiro }),
      links: { type: "object", additionalProperties: { type: "string" } },
      atividades: ref("R23_Atividades"),
      competencias: ref("R24_Competencias"),
    },
    ["codigo", "codigo_formatado", "situacao_qbq", "caminho", "cbo", "qbq", "contagens"],
  ),
  R23_Atividades: objeto(
    {
      codigo: texto,
      areas: lista(
        objeto(
          {
            sigla: texto,
            nome: texto,
            fonte: anulavel(ref("Fonte")),
            total_atividades: inteiro,
            atividades: lista(objeto({ numero: anulavel(inteiro), descricao: texto, fonte: anulavel(ref("Fonte")) }, ["descricao"])),
          },
          ["sigla", "nome", "total_atividades"],
        ),
      ),
      total_areas: inteiro,
      total_atividades: inteiro,
      motivo: texto,
    },
    ["codigo", "areas", "total_areas", "total_atividades"],
  ),
  R24_Competencias: objeto(
    {
      codigo: texto,
      situacao_qbq: texto,
      justificativa: anulavel(texto),
      taxonomia_conhecimento: anulavel(texto),
      niveis: ref("Niveis"),
      conhecimentos: ref("BlocoCompetencia"),
      habilidades: ref("BlocoCompetencia"),
      atitudes: ref("BlocoCompetencia"),
      truncado: booleano,
      motivo: texto,
    },
    ["codigo", "situacao_qbq"],
  ),
  R42_Termo: objeto(
    {
      vocabulario: texto,
      nivel: texto,
      codigo: texto,
      descricao: texto,
      pai: anulavel(objeto({ codigo: texto, nivel: texto })),
      balde: booleano,
      fonte: ref("Fonte"),
      caminho: lista(objeto({ nivel: texto, codigo: texto, descricao: texto })),
      filhos: lista(ref("TermoResumo")),
      conceito: anulavel(objeto({ termo: texto, conceito: texto, fonte: ref("Fonte") })),
      motivo_conceito: ref("MotivoConceito"),
      divergencia_de_grafia: anulavel(livre),
      uso: livre,
    },
    ["vocabulario", "nivel", "codigo", "descricao", "caminho", "filhos", "conceito"],
  ),
  R43_OcupacoesDoTermo: objeto(
    {
      termo: ref("TermoResumo"),
      agregou_descendentes: booleano,
      total: inteiro,
      distribuicao: objeto({
        por_grande_grupo: { type: "object", additionalProperties: { type: "integer" } },
        por_nivel_qualificacao: { type: "object", additionalProperties: { type: "integer" } },
      }),
      ocupacoes: lista({
        allOf: [
          ref("OcupacaoResumo"),
          objeto({ itens_casados: inteiro, importancia: anulavel(inteiro), frequencia: anulavel(inteiro), profundidade: anulavel(inteiro) }),
        ],
      }),
    },
  ),
};

/** Esquema de dados declarado por caminho de rota. As demais rotas devolvem dados sem esquema publicado. */
const DADOS_POR_CAMINHO: Record<string, string> = {
  "/versao": "R02_Versao",
  "/cbo/:nivel/:codigo": "R14_No",
  "/codigos": "R17_Codigos",
  "/codigos/:codigo": "R17_Codigos",
  "/ocupacoes": "R20_Ocupacoes",
  "/ocupacoes/:codigo": "R21_Ficha",
  "/ocupacoes/:codigo/atividades": "R23_Atividades",
  "/ocupacoes/:codigo/competencias": "R24_Competencias",
  "/qbq/vocabularios/:vocabulario/:codigo": "R42_Termo",
  "/qbq/vocabularios/:vocabulario/:nivel/:codigo": "R42_Termo",
  "/qbq/vocabularios/:vocabulario/:nivel/:codigo/ocupacoes": "R43_OcupacoesDoTermo",
};

export function esquemaDeDados(caminho: string) {
  return DADOS_POR_CAMINHO[caminho];
}

export function esquemasPublicados() {
  return ESQUEMAS;
}

function esquemaDoParametro(parametro: Parametro): Esquema {
  const base: Esquema = {};
  if (parametro.padrao != null) base.default = parametro.padrao;
  switch (parametro.tipo) {
    case "integer":
      return { type: "integer", ...(parametro.minimo != null ? { minimum: parametro.minimo } : {}), ...(parametro.maximo != null ? { maximum: parametro.maximo } : {}), ...base };
    case "boolean":
      return { type: "boolean", ...base };
    case "faixa":
      return { type: "string", pattern: "^\\d+(\\.\\.\\d+)?$", examples: [`${parametro.minimo ?? 1}`, `${parametro.minimo ?? 1}..${parametro.maximo ?? 1}`], ...base };
    case "lista":
      return {
        type: "array",
        items: { type: "string", ...(parametro.valores ? { enum: [...parametro.valores] } : {}), ...(parametro.maxCaracteres ? { maxLength: parametro.maxCaracteres } : {}) },
        ...(parametro.maxItens ? { maxItems: parametro.maxItens } : {}),
        ...base,
      };
    default:
      return {
        type: "string",
        ...(parametro.valores ? { enum: [...parametro.valores] } : {}),
        ...(parametro.maxCaracteres ? { maxLength: parametro.maxCaracteres } : {}),
        ...base,
      };
  }
}

function parametroOpenApi(parametro: Parametro) {
  return {
    name: parametro.nome,
    in: parametro.onde,
    required: parametro.onde === "path" ? true : parametro.obrigatorio === true,
    description: parametro.descricao + (parametro.maxTermos ? ` No máximo ${parametro.maxTermos} termos.` : ""),
    schema: esquemaDoParametro(parametro),
    ...(parametro.tipo === "lista" ? { style: "form", explode: false } : {}),
  };
}

/** Converte /a/:b em /api/v1/a/{b}. */
export function caminhoOpenApi(caminho: string) {
  return (caminho === "/" ? PREFIXO_API : api(caminho)).replace(/:([A-Za-z_]+)/g, "{$1}");
}

const problema = (descricao: string) => ({
  description: descricao,
  content: { "application/problem+json": { schema: ref("Problema") } },
});

export function montarOpenApi(rotas: readonly Rota[]) {
  const paths: Record<string, { get: unknown }> = {};
  const tags = [...new Set(rotas.map((rota) => rota.grupo))];
  for (const rota of rotas) {
    const caminho = caminhoOpenApi(rota.caminho);
    const tokens = (rota.caminho.match(/:([A-Za-z_]+)/g) ?? []).map((token) => token.slice(1));
    for (const token of tokens) {
      if (!rota.parametros.some((item) => item.onde === "path" && item.nome === token)) {
        throw new Error(`Erro de programação: ${rota.caminho} não declara o parâmetro de caminho ${token}.`);
      }
    }
    const globais = rota.caminho === "/openapi.json"
      ? []
      : PARAMETROS_GLOBAIS.filter((global) => !rota.parametros.some((item) => item.nome === global.nome));
    const dados = esquemaDeDados(rota.caminho);
    const cru = rota.caminho === "/openapi.json";
    const esquema200 = cru
      ? { type: "object", description: "Este documento." }
      : {
          allOf: [ref("Envelope"), objeto({ dados: dados ? ref(dados) : { description: "Sem esquema publicado nesta versão." } }, ["dados"])],
        };
    paths[caminho] = {
      get: {
        operationId: `${rota.id}_${rota.caminho.replace(/\W+/g, "_")}`,
        summary: rota.resumo,
        tags: [rota.grupo],
        parameters: [
          ...rota.parametros,
          ...globais.map((global) => (global.nome === "formato" && !rota.csv ? { ...global, valores: ["json"], descricao: "Formato da resposta. Esta rota só tem json." } : global)),
        ].map(parametroOpenApi),
        responses: {
          "200": {
            description: cru
              ? "O documento OpenAPI, sem envelope."
              : `Envelope dados/meta/links.${dados ? "" : " O esquema de dados desta rota ainda não é publicado: trate dados como objeto ou lista livre."}`,
            headers: {
              ETag: { schema: { type: "string" }, description: "Muda com a versão dos dados e com o build." },
              "X-Versao-Dados": { schema: { type: "string" } },
            },
            content: {
              "application/json": { schema: esquema200 },
              ...(rota.csv ? { "text/csv": { schema: { type: "string" }, description: "Com formato=csv: cabeçalho na primeira linha; X-Total traz o total." } } : {}),
            },
          },
          "304": { description: "If-None-Match casou com o ETag." },
          "400": problema("Parâmetro desconhecido, parâmetro inválido ou código malformado."),
          ...(tokens.length ? { "404": problema("Código bem formado e inexistente.") } : {}),
          "429": {
            ...problema("Limite de pedidos por minuto excedido."),
            headers: { "Retry-After": { schema: { type: "integer" }, description: "Segundos de espera." } },
          },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "CBO e QBQ",
      version: VERSAO_DADOS,
      summary: "API somente leitura da Classificação Brasileira de Ocupações e do Quadro Brasileiro de Qualificações.",
      description:
        `Toda resposta 200 vem no envelope dados/meta/links, exceto /openapi.json. Os esquemas de dados publicados cobrem R02, R14, R17, R20, R21, R23, R24, R42 e R43; nas demais rotas, dados é um objeto ou lista sem esquema publicado nesta versão. A API está sob a licença ${LICENCAS.codigo.nome}. Os dados servidos estão sob ${LICENCAS.dados.nome} (${LICENCAS.dados.url}); a citação está em ${PREFIXO_API}/versao.`,
      termsOfService: `${SITE}/sobre`,
      contact: { name: "Issues do cbo-qbq-site", url: `${REPOSITORIO_SERVICO}/issues` },
      license: { name: LICENCAS.codigo.nome, identifier: LICENCAS.codigo.spdx },
      "x-versao-servico": VERSAO_SERVICO,
      "x-licenca-dados": { name: LICENCAS.dados.nome, identifier: LICENCAS.dados.spdx, url: LICENCAS.dados.url },
      "x-doi": { dados_conceito: DOI_DADOS.conceito, dados_versao: DOI_DADOS.versao, software_conceito: DOI_SOFTWARE_CONCEITO },
    },
    externalDocs: { description: "Repositório de dados: modelo, decisões e fontes", url: REPOSITORIO_DADOS },
    servers: [{ url: "https://cbo.ciencia.social" }],
    tags: tags.map((nome) => ({ name: nome })),
    paths,
    components: { schemas: ESQUEMAS },
  };
}
