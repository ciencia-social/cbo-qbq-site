"use client";

import { useEffect, useState } from "react";
import {
  carregarAnalytics,
  type Consentimento,
  desligarAnalytics,
  EVENTO_CONSENTIMENTO,
  gravarConsentimento,
  lerConsentimento,
} from "@/site/analytics";

/** Acompanha a escolha salva; null enquanto o componente não montou no navegador. */
function useConsentimento(): Consentimento | undefined {
  const [valor, setValor] = useState<Consentimento | undefined>(undefined);
  useEffect(() => {
    setValor(lerConsentimento());
    const mudou = (evento: Event) => setValor((evento as CustomEvent<Consentimento>).detail);
    window.addEventListener(EVENTO_CONSENTIMENTO, mudou);
    return () => window.removeEventListener(EVENTO_CONSENTIMENTO, mudou);
  }, []);
  return valor;
}

/**
 * Cartão discreto no canto da tela, na primeira visita. Não cobre o conteúdo nem impede a navegação.
 * Aceitar e Recusar têm o mesmo peso; o GA só carrega depois de Aceitar.
 */
export function AvisoAnalytics() {
  const consentimento = useConsentimento();

  useEffect(() => {
    if (consentimento === "aceito") carregarAnalytics();
  }, [consentimento]);

  if (consentimento !== null) return null;
  return (
    <aside className="cs-consentimento" aria-label="Estatísticas de visita">
      <p>
        Com sua permissão, o site conta as visitas com o Google Analytics, que grava cookies. Nada é coletado se você recusar.{" "}
        <a href="/sobre#privacidade">Saiba mais</a>
      </p>
      <div className="cs-consentimento__acoes">
        <button type="button" className="cs-btn" onClick={() => gravarConsentimento("recusado")}>
          Recusar
        </button>
        <button type="button" className="cs-btn" onClick={() => gravarConsentimento("aceito")}>
          Aceitar
        </button>
      </div>
    </aside>
  );
}

/** Controle em /sobre#privacidade para rever a escolha a qualquer momento. */
export function PreferenciaAnalytics() {
  const consentimento = useConsentimento();
  if (consentimento === undefined) return null;

  const estado =
    consentimento === "aceito" ? "Você aceitou o Google Analytics." : consentimento === "recusado" ? "Você recusou o Google Analytics." : "Você ainda não escolheu; o Google Analytics está desligado.";
  return (
    <p className="cs-consentimento__preferencia">
      {estado}{" "}
      {consentimento === "aceito" ? (
        <button
          type="button"
          className="cs-btn cs-btn--link"
          onClick={() => {
            desligarAnalytics();
            gravarConsentimento("recusado");
          }}
        >
          Desativar e apagar os cookies
        </button>
      ) : (
        <button type="button" className="cs-btn cs-btn--link" onClick={() => gravarConsentimento("aceito")}>
          Ativar
        </button>
      )}
    </p>
  );
}
