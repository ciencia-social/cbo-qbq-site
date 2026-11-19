import { todos, um } from "@/dados/banco";
import { parametro } from "@/http/erros";
import { paginar } from "@/http/parametros";
import { normalizarArquivo } from "@/tipos";
import { ANEXOS_RELEASE, api, LICENCA, REPOSITORIO_DADOS, TAG_DADOS, VERSAO_CAMADAS, VERSAO_DADOS, VERSAO_SCHEMA } from "@/versao";
import { termosDaConsulta, textoCasa, trecho } from "@/texto";
import type { Saida } from "@/tipos";
import { estatisticas } from "@/consulta/derivado";

function lerMeta(chave: string): string | null {
  return um<{ valor: string }>("SELECT valor FROM meta WHERE chave = ?", chave)?.valor ?? null;
}

export function versao(): Saida {
  return {
    dados: {
      versao_dados: VERSAO_DADOS,
      versao_schema: VERSAO_SCHEMA,
      dados_commit: lerMeta("dados_commit"),
      dados_tag: lerMeta("dados_tag"),
      camadas: VERSAO_CAMADAS,
      contagens: (estatisticas().dados as object),
      licenca: LICENCA,
      repositorio_dados: REPOSITORIO_DADOS,
      ressalvas: [
        "52 ocupações não têm nível no QBQ e trazem justificativa oficial; 3 não têm nível nem justificativa (D010).",
        "25 códigos existem só na CBO, 4 só no QBQ e 35 têm título diferente (D015).",
        "Itens de balde (segmento 90 ou 99) guardam o conteúdo na descrição da linha (D009).",
        "Só habilidades têm conceito oficial (D011, D012).",
      ],
    },
  };
}

export function fontes(): Saida {
  const linhas = todos<{ arquivo: string; origem: string | null; capturado_em: string | null; sha256: string | null }>(
    "SELECT arquivo, origem, capturado_em, sha256 FROM fonte_oficial ORDER BY ordem",
  );
  return { dados: linhas.map((linha) => ({ ...linha, arquivo: normalizarArquivo(linha.arquivo) })) };
}

export function decisoes(q?: string, limite = 20, deslocamento = 0): Saida {
  let lista = todos<{ id: string; titulo: string; contexto: string; decisao: string }>(
    "SELECT id, titulo, contexto, decisao FROM decisao ORDER BY ordem",
  );
  const termos = q ? termosDaConsulta(q) : [];
  if (termos.length) {
    lista = lista.filter((item) => textoCasa(`${item.id} ${item.titulo} ${item.contexto} ${item.decisao}`, termos));
  }
  const pagina = paginar(lista, limite, deslocamento);
  return {
    dados: pagina.fatia.map((item) => ({
      ...item,
      link: api(`/decisoes/${item.id}`),
      ...(termos.length ? { trecho: trecho(`${item.titulo}. ${item.decisao}`, termos) } : {}),
    })),
    total: pagina.total,
    limite,
    deslocamento,
  };
}

export function decisao(id: string): Saida {
  const item = todos<{ id: string; titulo: string; contexto: string; decisao: string }>(
    "SELECT id, titulo, contexto, decisao FROM decisao WHERE id = ?",
    id.toUpperCase(),
  )[0];
  if (!item) throw parametro("id", `Não há decisão ${id}.`, todos<{ id: string }>("SELECT id FROM decisao ORDER BY ordem").map((linha) => linha.id));
  return { dados: item };
}

export function escalas(): Saida {
  return {
    dados: {
      niveis: {
        minimo: 1,
        maximo: 8,
        dimensoes: ["conhecimento", "habilidade", "atitude", "qualificacao"],
        descritores: null,
      },
      graus: {
        minimo: 1,
        maximo: 5,
        aplicacao: {
          profundidade: ["conhecimentos"],
          frequencia: ["conhecimentos", "habilidades"],
          importancia: ["conhecimentos", "habilidades", "atitudes"],
        },
        descritores: null,
      },
    },
    avisos: [
      {
        mensagem: "O dataset não traz descritores textuais dos pontos das escalas. A resposta expõe só os intervalos oficiais.",
      },
    ],
  };
}

export function sobre(topico?: string, id?: string): Saida {
  if (!topico) return versao();
  if (topico === "versao") return versao();
  if (topico === "fontes") return fontes();
  if (topico === "licenca") return { dados: LICENCA };
  if (topico === "decisoes") return id ? decisao(id) : decisoes(undefined, 18, 0);
  if (topico === "cobertura") {
    return {
      dados: {
        texto: "CBO e QBQ divergem em 64 códigos: 25 só na CBO, 4 só no QBQ e 35 com título diferente. Nenhuma camada é corrigida.",
        link: api("/cobertura/resumo"),
      },
      avisos: [{ codigo: "D015", mensagem: "Divergência é dado.", link: api("/decisoes/D015") }],
    };
  }
  throw parametro("topico", `Tópico desconhecido: ${topico}.`, ["versao", "fontes", "cobertura", "decisoes", "licenca"]);
}

/** R07: links da release fixada. A API não hospeda os arquivos; aponta para o GitHub. */
export function downloads(): Saida {
  const release = `${REPOSITORIO_DADOS}/releases/tag/${TAG_DADOS}`;
  const anexo = (nome: string) => `${REPOSITORIO_DADOS}/releases/download/${TAG_DADOS}/${nome}`;
  return {
    dados: {
      versao_dados: VERSAO_DADOS,
      tag: TAG_DADOS,
      release,
      anexos: ANEXOS_RELEASE.map((nome) => ({ nome, url: anexo(nome) })),
      manifesto: anexo("MANIFEST.sha256"),
      csv: `${REPOSITORIO_DADOS}/tree/${TAG_DADOS}/derivados/csv`,
      codigo_fonte: {
        zip: `${REPOSITORIO_DADOS}/archive/refs/tags/${TAG_DADOS}.zip`,
        tar_gz: `${REPOSITORIO_DADOS}/archive/refs/tags/${TAG_DADOS}.tar.gz`,
      },
      licenca: LICENCA,
    },
    avisos: [{ mensagem: "Confira os arquivos com sha256sum -c MANIFEST.sha256. Os anexos ficam no GitHub; esta API não os hospeda." }],
  };
}
