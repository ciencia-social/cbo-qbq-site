/**
 * Google Analytics 4 (fluxo 16371081400), só com consentimento.
 *
 * O gtag.js não vem no HTML. O componente AvisoAnalytics (src/ui/aviso-analytics.tsx) o carrega no
 * navegador depois que a pessoa aceita, e a escolha fica em localStorage. Só existe no deploy de
 * produção da Vercel, para que o next dev, o next start local e os previews não contem como visita.
 */
export const ID_ANALYTICS = "G-8BP7Z603EG";

export function analyticsAtivo(vercelEnv: string | undefined = process.env.VERCEL_ENV) {
  return vercelEnv === "production";
}

/** Origens que o gtag.js usa; entram na CSP das páginas. */
export const ORIGENS_ANALYTICS = {
  script: ["https://*.googletagmanager.com"],
  conexao: ["https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com"],
  imagem: ["https://*.google-analytics.com", "https://*.googletagmanager.com"],
};

/** Chave em localStorage. Sem valor, a pessoa ainda não escolheu e o GA não carrega. */
export const CHAVE_CONSENTIMENTO = "cs-analytics";
/** Evento que avisa os componentes da página quando a escolha muda. */
export const EVENTO_CONSENTIMENTO = "cs-analytics";

export type Consentimento = "aceito" | "recusado" | null;

export function lerConsentimento(armazenamento?: Pick<Storage, "getItem">): Consentimento {
  try {
    const valor = (armazenamento ?? globalThis.localStorage)?.getItem(CHAVE_CONSENTIMENTO);
    return valor === "aceito" || valor === "recusado" ? valor : null;
  } catch {
    return null;
  }
}

export function gravarConsentimento(valor: "aceito" | "recusado") {
  try {
    localStorage.setItem(CHAVE_CONSENTIMENTO, valor);
  } catch {
    // Sem armazenamento, a escolha vale só para esta página.
  }
  window.dispatchEvent(new CustomEvent(EVENTO_CONSENTIMENTO, { detail: valor }));
}

type JanelaGtag = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } & Record<string, unknown>;

/** Carrega o gtag.js uma vez. Sem Google Signals nem personalização de anúncios: só a contagem de tráfego. */
export function carregarAnalytics() {
  const janela = window as unknown as JanelaGtag;
  janela[`ga-disable-${ID_ANALYTICS}`] = false;
  if (janela.gtag) return;
  janela.dataLayer = janela.dataLayer || [];
  janela.gtag = function gtag() {
    // O gtag.js espera o objeto arguments, não um array.
    janela.dataLayer!.push(arguments);
  };
  janela.gtag("js", new Date());
  janela.gtag("config", ID_ANALYTICS, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ID_ANALYTICS}`;
  document.head.appendChild(script);
}

/** Para o envio na hora e apaga os cookies que o GA gravou (_ga e _ga_<fluxo>). */
export function desligarAnalytics() {
  const janela = window as unknown as JanelaGtag;
  janela[`ga-disable-${ID_ANALYTICS}`] = true;
  const nomes = document.cookie
    .split(";")
    .map((par) => par.split("=")[0].trim())
    .filter((nome) => nome === "_ga" || nome.startsWith("_ga_"));
  const partes = location.hostname.split(".");
  const dominios = partes.map((_, indice) => partes.slice(indice).join(".")).filter((dominio) => dominio.includes("."));
  for (const nome of nomes) {
    document.cookie = `${nome}=; Max-Age=0; path=/`;
    for (const dominio of dominios) document.cookie = `${nome}=; Max-Age=0; path=/; domain=.${dominio}`;
  }
}
