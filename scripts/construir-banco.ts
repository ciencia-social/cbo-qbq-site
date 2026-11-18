/**
 * Gera data/cbo-qbq.sqlite a partir dos JSON canônicos de cbo-qbq-dados.
 * O SQLite publicado não tem fonte, vigência nem busca (F20).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { GERADOR, REPOSITORIO_DADOS, TAG_DADOS, VERSAO_CAMADAS, VERSAO_DADOS, VERSAO_SCHEMA } from "../src/versao.ts";
import { ehBalde, normalizarBusca, normalizarTitulo, textoIndexavel } from "../src/texto.ts";

const DESTINO = path.join(process.cwd(), "data", "cbo-qbq.sqlite");

type Fonte = { arquivo?: string; aba?: string; linha?: number };
type NoCbo = { codigo: string; titulo: string; pai?: string; fonte: Fonte };
type Sinonimo = { titulo: string; fonte?: Fonte };
type OcupacaoCbo = {
  codigo: string;
  titulo: string;
  familia: string;
  sinonimos: Sinonimo[];
  vigencia: { status: string; desde: string; ate: string | null };
  fonte: Fonte;
};
type Area = { sigla: string; nome: string; atividades: { numero: number; descricao: string }[] };
type Perfil = { codigo: string; areas: Area[]; fonte?: Fonte };
type OcupacaoQbq = {
  codigo: string;
  titulo: string;
  sintese: string | null;
  perfil_ocupacional: string | null;
  niveis: {
    conhecimento: number | null;
    habilidade: number | null;
    atitude: number | null;
    qualificacao: number | null;
  };
  vigencia: { status: string; desde: string; ate: string | null };
  fonte: Fonte;
};
type ItemCha = {
  codigo: string;
  profundidade?: number | null;
  frequencia?: number | null;
  importancia?: number | null;
  linha?: number;
  descricao?: string;
};
type Competencia = {
  codigo: string;
  taxonomia_conhecimento?: string;
  conhecimentos: ItemCha[];
  habilidades: ItemCha[];
  atitudes: ItemCha[];
};
type NaoClassificada = { codigo: string; titulo: string; justificativa: string; fonte?: Fonte };
type Termo = { codigo: string; descricao: string; pai?: string };
type Conceito = { codigo: string; termo: string; conceito: string };

const NIVEIS_VOCAB: Record<string, string[]> = {
  "conhecimentos-i": ["dominios", "areas", "campos", "conhecimentos"],
  "conhecimentos-ii": ["areas", "campos", "conhecimentos", "elementos"],
  habilidades: ["dominios", "categorias", "habilidades"],
  atitudes: ["categorias", "atitudes"],
};

const FOLHA: Record<string, string> = {
  "conhecimentos-i": "conhecimentos",
  "conhecimentos-ii": "elementos",
  habilidades: "habilidades",
  atitudes: "atitudes",
};

function ler<T>(arquivo: string): T {
  return JSON.parse(fs.readFileSync(arquivo, "utf8")) as T;
}

function exigirVersao(doc: { versao_dados?: string }, esperada: string, arquivo: string) {
  if (doc.versao_dados !== esperada) {
    throw new Error(`${arquivo}: versao_dados ${doc.versao_dados} (esperado ${esperada})`);
  }
}

function resolverDados(): string {
  const env = process.env.CBO_QBQ_DADOS;
  if (env && fs.existsSync(path.join(env, "dados", "cbo"))) return path.resolve(env);
  const irmao = path.resolve(process.cwd(), "..", "cbo-qbq-dados");
  if (fs.existsSync(path.join(irmao, "dados", "cbo"))) return irmao;
  const local = path.resolve(process.cwd(), ".dados");
  if (!fs.existsSync(path.join(local, "dados", "cbo"))) {
    console.log(`clonando ${REPOSITORIO_DADOS} @ ${TAG_DADOS}`);
    fs.mkdirSync(path.dirname(local), { recursive: true });
    execFileSync(
      "git",
      ["clone", "--depth", "1", "--branch", TAG_DADOS, `${REPOSITORIO_DADOS}.git`, local],
      { stdio: "inherit" },
    );
  }
  return local;
}

function bancoAtualizado(): boolean {
  if (process.argv.includes("--force") || process.env.REBUILD_DB === "1") return false;
  if (!fs.existsSync(DESTINO)) return false;
  try {
    const db = new DatabaseSync(DESTINO, { readOnly: true });
    const row = db.prepare("SELECT valor FROM meta WHERE chave = 'gerador'").get() as
      | { valor: string }
      | undefined;
    db.close();
    return row?.valor === GERADOR;
  } catch {
    return false;
  }
}

function arquivosGg(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((nome) => /^gg-\d\.json$/.test(nome))
    .sort()
    .map((nome) => path.join(dir, nome));
}

function main() {
  if (bancoAtualizado()) {
    console.log("banco já está na versão do gerador; use --force para reconstruir");
    return;
  }
  const raiz = resolverDados();
  const inicio = Date.now();
  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  fs.rmSync(DESTINO, { force: true });

  const db = new DatabaseSync(DESTINO);
  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    PRAGMA temp_store = MEMORY;
    CREATE TABLE meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
    CREATE TABLE cbo_no (
      nivel TEXT NOT NULL,
      codigo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      pai TEXT,
      fonte_arquivo TEXT,
      fonte_linha INTEGER,
      ordem INTEGER NOT NULL,
      titulo_busca TEXT NOT NULL,
      PRIMARY KEY (nivel, codigo)
    );
    CREATE TABLE ocupacao (
      codigo TEXT PRIMARY KEY,
      codigo_formatado TEXT NOT NULL,
      titulo_cbo TEXT,
      titulo_qbq TEXT,
      familia TEXT,
      situacao_qbq TEXT NOT NULL,
      divergencia TEXT,
      justificativa TEXT,
      sintese TEXT,
      perfil_ocupacional TEXT,
      nivel_conhecimento INTEGER,
      nivel_habilidade INTEGER,
      nivel_atitude INTEGER,
      nivel_qualificacao INTEGER,
      taxonomia_conhecimento TEXT,
      vigencia_cbo_status TEXT,
      vigencia_cbo_desde TEXT,
      vigencia_cbo_ate TEXT,
      vigencia_qbq_status TEXT,
      vigencia_qbq_desde TEXT,
      vigencia_qbq_ate TEXT,
      fonte_cbo_arquivo TEXT,
      fonte_cbo_linha INTEGER,
      fonte_qbq_arquivo TEXT,
      fonte_qbq_aba TEXT,
      fonte_qbq_linha INTEGER,
      fonte_justificativa_arquivo TEXT,
      fonte_justificativa_aba TEXT,
      fonte_justificativa_linha INTEGER,
      n_sinonimos INTEGER NOT NULL,
      n_areas INTEGER NOT NULL,
      n_atividades INTEGER NOT NULL,
      n_conhecimentos INTEGER NOT NULL,
      n_habilidades INTEGER NOT NULL,
      n_atitudes INTEGER NOT NULL,
      titulo_cbo_busca TEXT,
      titulo_qbq_busca TEXT,
      sintese_busca TEXT,
      ordem INTEGER NOT NULL
    );
    CREATE TABLE sinonimo (
      ocupacao TEXT NOT NULL,
      sinonimo TEXT NOT NULL,
      fonte_arquivo TEXT,
      fonte_linha INTEGER,
      ordem INTEGER NOT NULL,
      busca TEXT NOT NULL
    );
    CREATE TABLE area (
      ocupacao TEXT NOT NULL,
      sigla TEXT NOT NULL,
      nome TEXT NOT NULL,
      ordem INTEGER NOT NULL,
      busca TEXT NOT NULL,
      fonte_arquivo TEXT,
      fonte_linha INTEGER
    );
    CREATE TABLE atividade (
      ocupacao TEXT NOT NULL,
      sigla TEXT NOT NULL,
      numero INTEGER,
      descricao TEXT NOT NULL,
      ordem INTEGER NOT NULL,
      fonte_arquivo TEXT,
      fonte_linha INTEGER
    );
    CREATE TABLE cha (
      ocupacao TEXT NOT NULL,
      dimensao TEXT NOT NULL,
      taxonomia TEXT,
      codigo TEXT NOT NULL,
      nivel_vocabulario TEXT NOT NULL,
      profundidade INTEGER,
      frequencia INTEGER,
      importancia INTEGER,
      descricao_item TEXT,
      linha INTEGER,
      balde INTEGER NOT NULL,
      ordem INTEGER NOT NULL
    );
    CREATE TABLE cha_conjunto (
      ocupacao TEXT NOT NULL,
      dimensao TEXT NOT NULL,
      taxonomia TEXT NOT NULL,
      codigo TEXT NOT NULL,
      PRIMARY KEY (ocupacao, dimensao, codigo)
    );
    CREATE TABLE termo (
      vocabulario TEXT NOT NULL,
      nivel TEXT NOT NULL,
      codigo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      pai TEXT,
      nivel_pai TEXT,
      balde INTEGER NOT NULL,
      ordem INTEGER NOT NULL,
      busca TEXT NOT NULL,
      fonte_arquivo TEXT,
      PRIMARY KEY (vocabulario, nivel, codigo)
    );
    CREATE TABLE conceito (
      vocabulario TEXT NOT NULL,
      nivel TEXT NOT NULL,
      codigo TEXT NOT NULL,
      termo TEXT NOT NULL,
      conceito TEXT NOT NULL,
      fonte_arquivo TEXT,
      busca_termo TEXT NOT NULL,
      busca_conceito TEXT NOT NULL,
      PRIMARY KEY (vocabulario, nivel, codigo)
    );
    CREATE TABLE divergencia_grafia (
      vocabulario TEXT NOT NULL,
      nivel TEXT NOT NULL,
      codigo TEXT NOT NULL,
      termo_pdf TEXT,
      termo_planilha TEXT
    );
    CREATE TABLE decisao (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      contexto TEXT NOT NULL,
      decisao TEXT NOT NULL,
      ordem INTEGER NOT NULL,
      busca TEXT NOT NULL
    );
    CREATE TABLE fonte_oficial (
      arquivo TEXT PRIMARY KEY,
      origem TEXT,
      capturado_em TEXT,
      sha256 TEXT,
      ordem INTEGER NOT NULL
    );
  `);

  const insNo = db.prepare(
    `INSERT INTO cbo_no (nivel, codigo, titulo, pai, fonte_arquivo, fonte_linha, ordem, titulo_busca)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const mapaNivel: Record<string, string> = {
    "grandes-grupos": "grande_grupo",
    "subgrupos-principais": "subgrupo_principal",
    subgrupos: "subgrupo",
    familias: "familia",
  };

  db.exec("BEGIN");
  let ordemNo = 0;
  for (const [arquivo, nivel] of Object.entries(mapaNivel)) {
    const doc = ler<{ versao_dados: string; itens: NoCbo[] }>(
      path.join(raiz, "dados", "cbo", "estrutura", `${arquivo}.json`),
    );
    exigirVersao(doc, VERSAO_CAMADAS.cbo_espinha, arquivo);
    for (const item of doc.itens) {
      insNo.run(
        nivel,
        item.codigo,
        item.titulo,
        item.pai ?? null,
        item.fonte?.arquivo ?? null,
        item.fonte?.linha ?? null,
        ordemNo++,
        normalizarBusca(item.titulo),
      );
    }
  }

  const cbo = new Map<string, OcupacaoCbo>();
  for (const arquivo of arquivosGg(path.join(raiz, "dados", "cbo", "ocupacoes"))) {
    const doc = ler<{ versao_dados: string; ocupacoes: OcupacaoCbo[] }>(arquivo);
    exigirVersao(doc, VERSAO_CAMADAS.cbo_espinha, arquivo);
    for (const ocupacao of doc.ocupacoes) cbo.set(ocupacao.codigo, ocupacao);
  }

  const qbq = new Map<string, OcupacaoQbq>();
  for (const arquivo of arquivosGg(path.join(raiz, "dados", "qbq", "ocupacoes"))) {
    const doc = ler<{ versao_dados: string; ocupacoes: OcupacaoQbq[] }>(arquivo);
    exigirVersao(doc, VERSAO_CAMADAS.qbq, arquivo);
    for (const ocupacao of doc.ocupacoes) qbq.set(ocupacao.codigo, ocupacao);
  }

  const naoClass = new Map<string, NaoClassificada>();
  const docNc = ler<{ versao_dados: string; ocupacoes: NaoClassificada[] }>(
    path.join(raiz, "dados", "qbq", "nao-classificadas.json"),
  );
  exigirVersao(docNc, VERSAO_CAMADAS.qbq, "nao-classificadas");
  for (const ocupacao of docNc.ocupacoes) naoClass.set(ocupacao.codigo, ocupacao);

  const taxonomia = new Map<string, string>();
  const contagemCha = new Map<string, { conhecimentos: number; habilidades: number; atitudes: number }>();
  const insCha = db.prepare(
    `INSERT INTO cha (ocupacao, dimensao, taxonomia, codigo, nivel_vocabulario, profundidade, frequencia, importancia, descricao_item, linha, balde, ordem)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insConjunto = db.prepare(
    `INSERT OR IGNORE INTO cha_conjunto (ocupacao, dimensao, taxonomia, codigo) VALUES (?, ?, ?, ?)`,
  );
  let ordemCha = 0;
  let faltouFolha = 0;
  const termosFolha = new Set<string>();

  for (const [vocabulario, niveis] of Object.entries(NIVEIS_VOCAB)) {
    const doc = ler<Record<string, unknown>>(path.join(raiz, "dados", "qbq", "vocabularios", `${vocabulario}.json`));
    exigirVersao(doc as { versao_dados: string }, VERSAO_CAMADAS.qbq, vocabulario);
    const folha = FOLHA[vocabulario];
    const lista = doc[folha];
    if (!Array.isArray(lista)) throw new Error(`folha ausente em ${vocabulario}`);
    for (const termo of lista as Termo[]) termosFolha.add(`${vocabulario}|${termo.codigo}`);
  }

  for (const arquivo of arquivosGg(path.join(raiz, "dados", "qbq", "competencias"))) {
    const doc = ler<{ versao_dados: string; ocupacoes: Competencia[] }>(arquivo);
    exigirVersao(doc, VERSAO_CAMADAS.qbq, arquivo);
    for (const ocupacao of doc.ocupacoes) {
      const tax = ocupacao.taxonomia_conhecimento ?? "";
      if (tax) taxonomia.set(ocupacao.codigo, tax);
      const blocos: [string, string, ItemCha[]][] = [
        ["conhecimentos", tax, ocupacao.conhecimentos ?? []],
        ["habilidades", "", ocupacao.habilidades ?? []],
        ["atitudes", "", ocupacao.atitudes ?? []],
      ];
      const contagem = { conhecimentos: 0, habilidades: 0, atitudes: 0 };
      for (const [dimensao, taxDim, itens] of blocos) {
        const vocabulario = dimensao === "conhecimentos" ? tax : dimensao;
        const folha = FOLHA[vocabulario] ?? dimensao;
        contagem[dimensao as "conhecimentos"] = itens.length;
        for (const item of itens) {
          const balde = ehBalde(item.codigo) ? 1 : 0;
          if (vocabulario && !termosFolha.has(`${vocabulario}|${item.codigo}`)) faltouFolha++;
          insCha.run(
            ocupacao.codigo,
            dimensao,
            taxDim || null,
            item.codigo,
            folha,
            item.profundidade ?? null,
            item.frequencia ?? null,
            item.importancia ?? null,
            item.descricao ?? null,
            item.linha ?? null,
            balde,
            ordemCha++,
          );
          if (!balde) insConjunto.run(ocupacao.codigo, dimensao, taxDim, item.codigo);
        }
      }
      contagemCha.set(ocupacao.codigo, contagem);
    }
  }

  const areasPor = new Map<string, number>();
  const atividadesPor = new Map<string, number>();
  const insArea = db.prepare(
    `INSERT INTO area (ocupacao, sigla, nome, ordem, busca, fonte_arquivo, fonte_linha) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insAtividade = db.prepare(
    `INSERT INTO atividade (ocupacao, sigla, numero, descricao, ordem, fonte_arquivo, fonte_linha) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  let ordemArea = 0;
  let ordemAtividade = 0;
  for (const arquivo of arquivosGg(path.join(raiz, "dados", "cbo", "perfis"))) {
    const doc = ler<{ versao_dados: string; ocupacoes: Perfil[] }>(arquivo);
    exigirVersao(doc, VERSAO_CAMADAS.cbo_perfil, arquivo);
    for (const ocupacao of doc.ocupacoes) {
      areasPor.set(ocupacao.codigo, ocupacao.areas.length);
      let atividades = 0;
      for (const area of ocupacao.areas) {
        insArea.run(
          ocupacao.codigo,
          area.sigla,
          area.nome,
          ordemArea++,
          normalizarBusca(area.nome),
          ocupacao.fonte?.arquivo ?? null,
          ocupacao.fonte?.linha ?? null,
        );
        for (const atividade of area.atividades) {
          atividades++;
          insAtividade.run(
            ocupacao.codigo,
            area.sigla,
            atividade.numero,
            atividade.descricao,
            ordemAtividade++,
            ocupacao.fonte?.arquivo ?? null,
            ocupacao.fonte?.linha ?? null,
          );
        }
      }
      atividadesPor.set(ocupacao.codigo, atividades);
    }
  }

  const insOcupacao = db.prepare(
    `INSERT INTO ocupacao (
      codigo, codigo_formatado, titulo_cbo, titulo_qbq, familia, situacao_qbq, divergencia, justificativa,
      sintese, perfil_ocupacional, nivel_conhecimento, nivel_habilidade, nivel_atitude, nivel_qualificacao,
      taxonomia_conhecimento, vigencia_cbo_status, vigencia_cbo_desde, vigencia_cbo_ate,
      vigencia_qbq_status, vigencia_qbq_desde, vigencia_qbq_ate,
      fonte_cbo_arquivo, fonte_cbo_linha, fonte_qbq_arquivo, fonte_qbq_aba, fonte_qbq_linha,
      fonte_justificativa_arquivo, fonte_justificativa_aba, fonte_justificativa_linha,
      n_sinonimos, n_areas, n_atividades, n_conhecimentos, n_habilidades, n_atitudes,
      titulo_cbo_busca, titulo_qbq_busca, sintese_busca, ordem
    ) VALUES (${Array(39).fill("?").join(", ")})`,
  );
  const insSinonimo = db.prepare(
    `INSERT INTO sinonimo (ocupacao, sinonimo, fonte_arquivo, fonte_linha, ordem, busca) VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const codigos = [...new Set([...cbo.keys(), ...qbq.keys()])].sort();
  let ordemOcupacao = 0;
  let ordemSinonimo = 0;
  for (const codigo of codigos) {
    const c = cbo.get(codigo);
    const q = qbq.get(codigo);
    const nc = naoClass.get(codigo);
    const cha = contagemCha.get(codigo);
    let situacao: string;
    if (!q && c) situacao = "ausente_no_qbq";
    else if (nc) situacao = "nao_classificada";
    else if (q && q.niveis.qualificacao == null) situacao = "sem_nivel_sem_justificativa";
    else situacao = "classificada";
    let divergencia: string | null = null;
    if (c && !q) divergencia = "so_cbo";
    else if (q && !c) divergencia = "so_qbq";
    else if (c && q && normalizarTitulo(c.titulo) !== normalizarTitulo(q.titulo)) divergencia = "titulo_divergente";
    insOcupacao.run(
      codigo,
      `${codigo.slice(0, 4)}-${codigo.slice(4)}`,
      c?.titulo ?? null,
      q?.titulo ?? null,
      c?.familia ?? codigo.slice(0, 4),
      situacao,
      divergencia,
      nc?.justificativa ?? null,
      q?.sintese ?? null,
      q?.perfil_ocupacional ?? null,
      q?.niveis.conhecimento ?? null,
      q?.niveis.habilidade ?? null,
      q?.niveis.atitude ?? null,
      q?.niveis.qualificacao ?? null,
      taxonomia.get(codigo) ?? null,
      c?.vigencia.status ?? null,
      c?.vigencia.desde ?? null,
      c?.vigencia.ate ?? null,
      q?.vigencia.status ?? null,
      q?.vigencia.desde ?? null,
      q?.vigencia.ate ?? null,
      c?.fonte.arquivo ?? null,
      c?.fonte.linha ?? null,
      q?.fonte.arquivo ?? null,
      q?.fonte.aba ?? null,
      q?.fonte.linha ?? null,
      nc?.fonte?.arquivo ?? null,
      nc?.fonte?.aba ?? null,
      nc?.fonte?.linha ?? null,
      c?.sinonimos.length ?? 0,
      areasPor.get(codigo) ?? 0,
      atividadesPor.get(codigo) ?? 0,
      cha?.conhecimentos ?? 0,
      cha?.habilidades ?? 0,
      cha?.atitudes ?? 0,
      c ? normalizarBusca(c.titulo) : null,
      q ? normalizarBusca(q.titulo) : null,
      normalizarBusca(textoIndexavel(q?.sintese)),
      ordemOcupacao++,
    );
    for (const sinonimo of c?.sinonimos ?? []) {
      insSinonimo.run(
        codigo,
        sinonimo.titulo,
        sinonimo.fonte?.arquivo ?? null,
        sinonimo.fonte?.linha ?? null,
        ordemSinonimo++,
        normalizarBusca(sinonimo.titulo),
      );
    }
  }

  const insTermo = db.prepare(
    `INSERT INTO termo (vocabulario, nivel, codigo, descricao, pai, nivel_pai, balde, ordem, busca, fonte_arquivo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let ordemTermo = 0;
  for (const [vocabulario, niveis] of Object.entries(NIVEIS_VOCAB)) {
    const doc = ler<Record<string, unknown> & { fonte?: string }>(
      path.join(raiz, "dados", "qbq", "vocabularios", `${vocabulario}.json`),
    );
    niveis.forEach((nivel, indice) => {
      const lista = doc[nivel] as Termo[];
      const nivelPai = indice > 0 ? niveis[indice - 1] : null;
      for (const termo of lista) {
        insTermo.run(
          vocabulario,
          nivel,
          termo.codigo,
          termo.descricao,
          termo.pai ?? null,
          termo.pai ? nivelPai : null,
          ehBalde(termo.codigo) ? 1 : 0,
          ordemTermo++,
          normalizarBusca(termo.descricao),
          doc.fonte ?? null,
        );
      }
    });
  }

  const insConceito = db.prepare(
    `INSERT INTO conceito (vocabulario, nivel, codigo, termo, conceito, fonte_arquivo, busca_termo, busca_conceito)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insDivergencia = db.prepare(
    `INSERT INTO divergencia_grafia (vocabulario, nivel, codigo, termo_pdf, termo_planilha) VALUES (?, ?, ?, ?, ?)`,
  );
  const mapaNivelConceito: Record<string, string> = {
    dominio: "dominios",
    dominios: "dominios",
    categoria: "categorias",
    categorias: "categorias",
    habilidade: "habilidades",
    habilidades: "habilidades",
  };
  for (const nome of fs.readdirSync(path.join(raiz, "dados", "qbq", "conceitos")).filter((n) => n.endsWith(".json"))) {
    const doc = ler<Record<string, unknown> & { versao_dados: string; dimensao: string; fonte: string; divergencias?: { nivel: string; codigo: string; termo_pdf?: string; termo_planilha?: string }[] }>(
      path.join(raiz, "dados", "qbq", "conceitos", nome),
    );
    exigirVersao(doc, VERSAO_CAMADAS.qbq, nome);
    for (const [nivel, regs] of Object.entries(doc)) {
      if (!Array.isArray(regs) || nivel === "divergencias") continue;
      for (const reg of regs as Conceito[]) {
        insConceito.run(
          doc.dimensao,
          nivel,
          reg.codigo,
          reg.termo,
          reg.conceito,
          doc.fonte,
          normalizarBusca(reg.termo),
          normalizarBusca(reg.conceito),
        );
      }
    }
    for (const div of doc.divergencias ?? []) {
      insDivergencia.run(
        doc.dimensao,
        mapaNivelConceito[div.nivel] ?? div.nivel,
        div.codigo,
        div.termo_pdf ?? null,
        div.termo_planilha ?? null,
      );
    }
  }

  const decisoes = fs.readFileSync(path.join(raiz, "DECISOES.md"), "utf8");
  const blocos = decisoes.split(/\n(?=## D\d{3} )/).slice(1);
  const insDecisao = db.prepare(
    `INSERT INTO decisao (id, titulo, contexto, decisao, ordem, busca) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  blocos.forEach((bloco, indice) => {
    const cabeca = bloco.match(/^## (D\d{3}) — (.+)$/m);
    if (!cabeca) throw new Error(`decisão ilegível: ${bloco.slice(0, 80)}`);
    const contexto = bloco.match(/\*\*Contexto\.\*\*\s*([\s\S]*?)\n\n\*\*Decisão\.\*\*/)?.[1]?.trim() ?? "";
    const decisao = bloco.match(/\*\*Decisão\.\*\*\s*([\s\S]*)$/)?.[1]?.trim() ?? "";
    insDecisao.run(
      cabeca[1],
      cabeca[2].trim(),
      contexto,
      decisao,
      indice,
      normalizarBusca(`${cabeca[1]} ${cabeca[2]} ${contexto} ${decisao}`),
    );
  });

  const fontesMd = fs.readFileSync(path.join(raiz, "fontes", "README.md"), "utf8");
  const insFonte = db.prepare(
    `INSERT INTO fonte_oficial (arquivo, origem, capturado_em, sha256, ordem) VALUES (?, ?, ?, ?, ?)`,
  );
  let ordemFonte = 0;
  for (const linha of fontesMd.split("\n")) {
    const colunas = linha.split("|").map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length);
    if (colunas.length < 4 || colunas[0] === "arquivo" || colunas[0].startsWith("---")) continue;
    const limpar = (valor: string) => valor.replace(/^`|`$/g, "");
    const sha = limpar(colunas[3]);
    insFonte.run(limpar(colunas[0]), colunas[1], colunas[2], /^[0-9a-f]{64}$/.test(sha) ? sha : null, ordemFonte++);
  }

  const insMeta = db.prepare("INSERT INTO meta (chave, valor) VALUES (?, ?)");
  insMeta.run("versao_dados", VERSAO_DADOS);
  insMeta.run("versao_schema", VERSAO_SCHEMA);
  insMeta.run("versao_cbo_espinha", VERSAO_CAMADAS.cbo_espinha);
  insMeta.run("versao_cbo_perfil", VERSAO_CAMADAS.cbo_perfil);
  insMeta.run("versao_qbq", VERSAO_CAMADAS.qbq);
  insMeta.run("gerador", GERADOR);
  insMeta.run("repositorio_dados", REPOSITORIO_DADOS);

  db.exec("COMMIT");
  db.exec(`
    CREATE INDEX idx_ocupacao_familia ON ocupacao(familia);
    CREATE INDEX idx_ocupacao_situacao ON ocupacao(situacao_qbq);
    CREATE INDEX idx_ocupacao_nivel ON ocupacao(nivel_qualificacao);
    CREATE INDEX idx_sinonimo_ocupacao ON sinonimo(ocupacao);
    CREATE INDEX idx_sinonimo_busca ON sinonimo(busca);
    CREATE INDEX idx_area_ocupacao ON area(ocupacao, ordem);
    CREATE INDEX idx_atividade_ocupacao ON atividade(ocupacao, ordem);
    CREATE INDEX idx_cha_ocupacao ON cha(ocupacao, dimensao, ordem);
    CREATE INDEX idx_cha_codigo ON cha(dimensao, codigo, balde);
    CREATE INDEX idx_conjunto_dim ON cha_conjunto(dimensao, codigo);
    CREATE INDEX idx_termo_pai ON termo(vocabulario, nivel_pai, pai);
    CREATE INDEX idx_cbo_pai ON cbo_no(nivel, pai);
    CREATE VIRTUAL TABLE fts_atividade USING fts5(
      ocupacao UNINDEXED, sigla UNINDEXED, numero UNINDEXED, ordem UNINDEXED,
      descricao, area, tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE VIRTUAL TABLE fts_item USING fts5(
      ocupacao UNINDEXED, dimensao UNINDEXED, codigo UNINDEXED, linha UNINDEXED,
      descricao, tokenize = 'unicode61 remove_diacritics 2'
    );
  `);
  db.exec(`
    INSERT INTO fts_atividade (ocupacao, sigla, numero, ordem, descricao, area)
    SELECT a.ocupacao, a.sigla, a.numero, a.ordem, a.descricao, ar.nome
    FROM atividade a JOIN area ar ON ar.ocupacao = a.ocupacao AND ar.sigla = a.sigla;
    INSERT INTO fts_item (ocupacao, dimensao, codigo, linha, descricao)
    SELECT ocupacao, dimensao, codigo, linha, descricao_item FROM cha WHERE descricao_item IS NOT NULL AND descricao_item != 'NULL';
  `);

  const contar = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const esperado: Record<string, number> = {
    "cbo_no grande_grupo": 10,
    "cbo_no subgrupo_principal": 49,
    "cbo_no subgrupo": 195,
    "cbo_no familia": 626,
    "ocupacao com titulo_cbo": 2694,
    sinonimo: 7778,
    area: 20723,
    atividade: 174296,
    "ocupacao com titulo_qbq": 2673,
    "cha conhecimentos": 147041,
    "cha habilidades": 104712,
    "cha atitudes": 7210,
    conceito: 96,
    "nao_classificada": 52,
    "divergencia": 64,
    ocupacao: 2698,
    classificada: 2618,
    "sem_nivel": 3,
    ausente: 25,
    so_cbo: 25,
    so_qbq: 4,
    titulo_divergente: 35,
    decisao: 18,
  };
  const obtido: Record<string, number> = {
    "cbo_no grande_grupo": contar("SELECT count(*) n FROM cbo_no WHERE nivel = 'grande_grupo'"),
    "cbo_no subgrupo_principal": contar("SELECT count(*) n FROM cbo_no WHERE nivel = 'subgrupo_principal'"),
    "cbo_no subgrupo": contar("SELECT count(*) n FROM cbo_no WHERE nivel = 'subgrupo'"),
    "cbo_no familia": contar("SELECT count(*) n FROM cbo_no WHERE nivel = 'familia'"),
    "ocupacao com titulo_cbo": contar("SELECT count(*) n FROM ocupacao WHERE titulo_cbo IS NOT NULL"),
    sinonimo: contar("SELECT count(*) n FROM sinonimo"),
    area: contar("SELECT count(*) n FROM area"),
    atividade: contar("SELECT count(*) n FROM atividade"),
    "ocupacao com titulo_qbq": contar("SELECT count(*) n FROM ocupacao WHERE titulo_qbq IS NOT NULL"),
    "cha conhecimentos": contar("SELECT count(*) n FROM cha WHERE dimensao = 'conhecimentos'"),
    "cha habilidades": contar("SELECT count(*) n FROM cha WHERE dimensao = 'habilidades'"),
    "cha atitudes": contar("SELECT count(*) n FROM cha WHERE dimensao = 'atitudes'"),
    conceito: contar("SELECT count(*) n FROM conceito"),
    nao_classificada: contar("SELECT count(*) n FROM ocupacao WHERE situacao_qbq = 'nao_classificada'"),
    divergencia: contar("SELECT count(*) n FROM ocupacao WHERE divergencia IS NOT NULL"),
    ocupacao: contar("SELECT count(*) n FROM ocupacao"),
    classificada: contar("SELECT count(*) n FROM ocupacao WHERE situacao_qbq = 'classificada'"),
    sem_nivel: contar("SELECT count(*) n FROM ocupacao WHERE situacao_qbq = 'sem_nivel_sem_justificativa'"),
    ausente: contar("SELECT count(*) n FROM ocupacao WHERE situacao_qbq = 'ausente_no_qbq'"),
    so_cbo: contar("SELECT count(*) n FROM ocupacao WHERE divergencia = 'so_cbo'"),
    so_qbq: contar("SELECT count(*) n FROM ocupacao WHERE divergencia = 'so_qbq'"),
    titulo_divergente: contar("SELECT count(*) n FROM ocupacao WHERE divergencia = 'titulo_divergente'"),
    decisao: contar("SELECT count(*) n FROM decisao"),
  };
  const erros = Object.entries(esperado).filter(([chave, valor]) => obtido[chave] !== valor);
  if (erros.length || faltouFolha) {
    console.error(obtido);
    throw new Error(
      `contagens divergentes: ${erros.map(([c, v]) => `${c} ${obtido[c]} != ${v}`).join("; ")}` +
        (faltouFolha ? `; ${faltouFolha} itens sem folha` : ""),
    );
  }
  db.close();
  const mb = (fs.statSync(DESTINO).size / 1024 / 1024).toFixed(1);
  console.log(`banco gravado (${mb} MB) em ${((Date.now() - inicio) / 1000).toFixed(1)}s`);
}

main();
