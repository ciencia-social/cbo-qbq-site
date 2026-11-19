import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TETO } from "@/http/parametros";

/** Prompts da seção 6.5 do plano (I13): roteiros que encadeiam as tools. */

const REGRAS =
  "Cite só códigos, títulos, níveis e competências obtidos das tools nesta conversa. Diga se cada afirmação vem da CBO ou do QBQ e relate divergência em vez de escolher um lado. Similaridade e resumos são cálculos derivados.";

function mensagem(texto: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text: `${texto}\n\n${REGRAS}` } }] };
}

const codigoOuNome = () =>
  z.string().max(TETO.consultaCaracteres, `No máximo ${TETO.consultaCaracteres} caracteres.`);

export function registrarPrompts(servidor: McpServer) {
  servidor.registerPrompt(
    "classificar_vaga",
    {
      title: "Classificar vaga",
      description: "Sugere até três códigos CBO para o texto de uma vaga, com a evidência de cada um e o que os separa.",
      argsSchema: { texto: z.string().max(4000, "No máximo 4000 caracteres.").describe("Texto da vaga: título, tarefas e requisitos.") },
    },
    ({ texto }) =>
      mensagem(
        [
          "Classifique esta vaga na CBO.",
          "",
          "1. Use ocupacao_buscar com o título da vaga (e com variações do nome do cargo).",
          "2. Use cbo_buscar_atividades com as tarefas principais descritas.",
          "3. Para os candidatos que aparecerem nos dois caminhos, use ocupacao_obter.",
          "4. Responda com até três códigos, do mais provável ao menos provável. Para cada um, a evidência (título, sinônimo ou atividade que casou) e o que o separa dos outros.",
          "",
          "Vaga:",
          texto,
        ].join("\n"),
      ),
  );

  servidor.registerPrompt(
    "perfil_de_ocupacao",
    {
      title: "Perfil de ocupação",
      description: "Ficha em linguagem simples de uma ocupação: o que faz e o que exige, com fonte.",
      argsSchema: { ocupacao: codigoOuNome().describe("Código CBO (212405 ou 2124-05) ou nome da ocupação.") },
    },
    ({ ocupacao }) =>
      mensagem(
        [
          `Monte o perfil da ocupação "${ocupacao}".`,
          "",
          "1. Se não for um código de 6 dígitos, use ocupacao_buscar e escolha o resultado mais próximo; diga qual escolheu.",
          "2. Use ocupacao_obter com o código.",
          "3. Use cbo_atividades com modo resumo.",
          "4. Use qbq_competencias com importancia_min 4.",
          "5. Escreva a ficha em linguagem simples: o que a ocupação faz (CBO), o que ela exige (QBQ), níveis de qualificação e a fonte de cada parte. Se faltar nível ou perfil, diga isso com a justificativa.",
        ].join("\n"),
      ),
  );

  servidor.registerPrompt(
    "transicao_de_carreira",
    {
      title: "Transição de carreira",
      description: "Lacunas de competência para ir de uma ocupação a outra, ordenadas por importância.",
      argsSchema: {
        origem: codigoOuNome().describe("Ocupação de origem: código CBO ou nome."),
        destino: codigoOuNome().describe("Ocupação de destino: código CBO ou nome."),
      },
    },
    ({ origem, destino }) =>
      mensagem(
        [
          `Analise a transição de "${origem}" para "${destino}".`,
          "",
          "1. Se algum dos dois não for um código de 6 dígitos, use ocupacao_buscar para achar o código.",
          "2. Use ocupacao_comparar com a origem primeiro e o destino depois, dimensão habilidades. A diferença é destino menos origem.",
          "3. Para as habilidades que o destino exige e a origem não, ou exige com grau maior, use qbq_vocabulario para trazer a definição oficial.",
          "4. Liste as lacunas da maior para a menor importância no destino. Lembre que a comparação é cálculo derivado.",
        ].join("\n"),
      ),
  );

  servidor.registerPrompt(
    "panorama_de_grupo",
    {
      title: "Panorama de grupo",
      description: "Retrato de um grande grupo, subgrupo ou família: níveis e competências que o distinguem.",
      argsSchema: { codigo: z.string().max(TETO.codigo, `No máximo ${TETO.codigo} caracteres.`).describe("Código de 1 a 4 dígitos, como 2 ou 2124.") },
    },
    ({ codigo }) =>
      mensagem(
        [
          `Faça o panorama do grupo ${codigo} da CBO.`,
          "",
          "1. Use cbo_navegar com o código para ver o nó e os filhos.",
          "2. Use cbo_resumir_grupo com o código.",
          "3. Leia a distribuição dos níveis de qualificação e as competências que mais distinguem o grupo do conjunto. Deixe claro que o resumo é cálculo derivado, não dado oficial.",
        ].join("\n"),
      ),
  );
}
