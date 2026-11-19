import { obterOcupacao } from "@/consulta/ocupacao";
import { coberturaResumo } from "@/consulta/derivado";
import { decisoes, fontes, versao } from "@/consulta/meta";
import { todos } from "@/dados/banco";
import { DECLARACAO_IA, doiUrl, FONTES_OFICIAIS, LICENCAS, REPOSITORIO_DADOS, REPOSITORIO_SERVICO } from "@/versao";

const CAMADA: Record<string, string> = {
  cbo_espinha: "Espinha da CBO",
  cbo_perfil: "Perfil ocupacional da CBO",
  qbq: "QBQ",
};

const SITUACAO: Record<string, string> = {
  classificada: "Classificada",
  nao_classificada: "Não classificada",
  sem_nivel_sem_justificativa: "Sem nível e sem justificativa",
  ausente_no_qbq: "Ausente no QBQ",
};

export function carregarSobre() {
  const dados = versao().dados as {
    versao_dados: string;
    versao_schema: string;
    camadas: Record<string, string>;
    doi: { conceito: string; versao: string };
    doi_software: string | null;
    citacao: { dados: string; software: string; bibtex_dados: string; bibtex_software: string };
    repositorio_dados: string;
  };
  const cobertura = coberturaResumo().dados as {
    por_divergencia: { so_cbo: number; so_qbq: number; titulo_divergente: number };
    por_situacao_qbq: Record<string, number>;
  };
  const exemplo = obterOcupacao("114210").dados as { codigo_formatado: string; cbo: { titulo: string } | null; qbq: { titulo: string } | null };
  const lista = decisoes(undefined, 100, 0);
  const registros = lista.dados as { id: string; titulo: string; contexto: string; decisao: string; link: string }[];
  const arquivos = fontes().dados as { arquivo: string; origem: string | null; capturado_em: string | null }[];
  const nulas = todos<{ n: number }>("SELECT count(*) n FROM ocupacao WHERE sintese = 'NULL'")[0]?.n ?? 0;
  return {
    versao: dados.versao_dados,
    schema: dados.versao_schema,
    camadas: Object.entries(dados.camadas).map(([id, valor]) => ({ id, nome: CAMADA[id] ?? id, versao: valor })),
    arquivos,
    situacoes: Object.entries(cobertura.por_situacao_qbq).map(([id, total]) => ({ id, rotulo: SITUACAO[id] ?? id, total })),
    divergencia: cobertura.por_divergencia,
    exemplo,
    nulas,
    decisoes: registros,
    licenca: LICENCAS.dados.nome,
    licencas: LICENCAS,
    citacao: dados.citacao,
    doi: { conceito: dados.doi.conceito, versao: dados.doi.versao, conceito_url: doiUrl(dados.doi.conceito), versao_url: doiUrl(dados.doi.versao) },
    doiSoftware: dados.doi_software ? { doi: dados.doi_software, url: doiUrl(dados.doi_software) } : null,
    fontesOficiais: FONTES_OFICIAIS,
    declaracaoIa: DECLARACAO_IA,
    repositorio: dados.repositorio_dados || REPOSITORIO_DADOS,
    repositorioServico: REPOSITORIO_SERVICO,
  };
}

export type VistaSobre = ReturnType<typeof carregarSobre>;
