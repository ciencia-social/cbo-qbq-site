/**
 * Google Analytics 4 (fluxo 16371081400). Só carrega no deploy de produção da Vercel,
 * para que o next dev, o next start local e os previews não contem como visita.
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

/** Sem Google Signals nem personalização de anúncios: só a contagem de tráfego. */
export const SCRIPT_ANALYTICS = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ID_ANALYTICS}',{allow_google_signals:false,allow_ad_personalization_signals:false});`;
