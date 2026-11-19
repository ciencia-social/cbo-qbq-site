import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { interpretarCodigo, obterNo } from "@/consulta/cbo";
import { obterOcupacao } from "@/consulta/ocupacao";
import { listarTermos } from "@/consulta/qbq";
import { um } from "@/dados/banco";
import { Problema } from "@/http/erros";
import { embrulho, executarTool, textoMcp } from "@/mcp/executar";
import { NIVEL_POR_TAMANHO, URL_DO_NIVEL, VOCABULARIOS } from "@/tipos";
import { api, VERSAO_DADOS } from "@/versao";

/** Resources da seção 6.5 do plano (I13). Reaproveitam as mesmas consultas das tools. */

const JSON_MIME = "application/json";
const MARKDOWN_MIME = "text/markdown";

function json(uri: URL, dados: unknown) {
  return { contents: [{ uri: uri.href, mimeType: JSON_MIME, text: JSON.stringify(dados) }] };
}

function documento(nome: string) {
  const linha = um<{ texto: string; fonte: string }>("SELECT texto, fonte FROM documento WHERE nome = ?", nome);
  if (!linha) throw new McpError(ErrorCode.InternalError, `O banco não tem o documento ${nome}. Reconstrua com npm run dados.`);
  return linha;
}

/** Converte Problema em erro de JSON-RPC, com o texto já adaptado ao MCP. */
function lerComErro<T>(ler: () => T): T {
  try {
    return ler();
  } catch (erro) {
    if (erro instanceof Problema) {
      throw new McpError(ErrorCode.InvalidParams, textoMcp(`${erro.detalhe} ${erro.dica ?? ""}`.trim()));
    }
    throw erro;
  }
}

function variavel(valor: string | string[]) {
  return decodeURIComponent(Array.isArray(valor) ? valor[0] : valor);
}

export function registrarRecursos(servidor: McpServer) {
  servidor.registerResource(
    "sobre",
    "cboqbq://sobre",
    { title: "Sobre os dados", description: "Versão, proveniência, licença e ressalvas do dataset. O mesmo de dados_sobre.", mimeType: JSON_MIME },
    (uri) => json(uri, executarTool("dados_sobre", {}).dados),
  );

  servidor.registerResource(
    "modelo-de-dados",
    "cboqbq://modelo-de-dados",
    { title: "Modelo de dados", description: `Entidades e campos de CBO e QBQ, de docs/modelo-de-dados.md do repositório de dados (${VERSAO_DADOS}).`, mimeType: MARKDOWN_MIME },
    (uri) => ({ contents: [{ uri: uri.href, mimeType: MARKDOWN_MIME, text: documento("modelo-de-dados").texto }] }),
  );

  servidor.registerResource(
    "decisoes",
    "cboqbq://decisoes",
    { title: "Decisões de modelagem", description: `DECISOES.md do repositório de dados (${VERSAO_DADOS}): D001 em diante.`, mimeType: MARKDOWN_MIME },
    (uri) => ({ contents: [{ uri: uri.href, mimeType: MARKDOWN_MIME, text: documento("decisoes").texto }] }),
  );

  servidor.registerResource(
    "ocupacao",
    new ResourceTemplate("cboqbq://ocupacao/{codigo}", { list: undefined }),
    { title: "Ficha da ocupação", description: "Ficha integrada CBO e QBQ de uma ocupação de 6 dígitos (R21), como em ocupacao_obter.", mimeType: JSON_MIME },
    (uri, { codigo }) =>
      json(uri, lerComErro(() => {
        const saida = obterOcupacao(variavel(codigo), {});
        const ficha = saida.dados as { codigo: string };
        return embrulho(saida, `Ficha de ${ficha.codigo}.`).dados;
      })),
  );

  servidor.registerResource(
    "cbo",
    new ResourceTemplate("cboqbq://cbo/{codigo}", { list: undefined }),
    { title: "Nó da classificação", description: "Grande grupo, subgrupo principal, subgrupo ou família (1 a 4 dígitos), com caminho e filhos (R14).", mimeType: JSON_MIME },
    (uri, { codigo }) =>
      json(uri, lerComErro(() => {
        const canonico = interpretarCodigo(variavel(codigo)).codigo;
        const nivel = NIVEL_POR_TAMANHO[canonico.length];
        if (!nivel) {
          throw new Problema(400, api("/problemas/parametro-invalido"), "Código fora da classificação", `${canonico} tem ${canonico.length} dígitos. Este resource aceita de 1 a 4; para uma ocupação, use cboqbq://ocupacao/${canonico}.`);
        }
        const saida = obterNo(URL_DO_NIVEL[nivel], canonico, ["filhos", "caminho"]);
        return embrulho(saida, `Nó ${canonico}.`).dados;
      })),
  );

  servidor.registerResource(
    "vocabulario",
    new ResourceTemplate("cboqbq://vocabulario/{vocabulario}", {
      list: () => ({
        resources: VOCABULARIOS.map((id) => ({ uri: `cboqbq://vocabulario/${id}`, name: `vocabulario-${id}`, title: `Vocabulário ${id}`, mimeType: JSON_MIME })),
      }),
      complete: { vocabulario: (valor) => VOCABULARIOS.filter((id) => id.startsWith(valor)) },
    }),
    { title: "Árvore do vocabulário", description: "Os dois primeiros níveis de um vocabulário do QBQ (R41 com formato=arvore). Os níveis abaixo saem de qbq_vocabulario.", mimeType: JSON_MIME },
    (uri, { vocabulario }) =>
      json(uri, lerComErro(() => {
        const id = variavel(vocabulario);
        const saida = listarTermos(id, { formato: "arvore", profundidade: 2, limite: 100, deslocamento: 0 });
        return embrulho(saida, `Árvore de ${id}.`).dados;
      })),
  );
}
