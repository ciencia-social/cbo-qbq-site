"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/ui/icone";
import { quadro, tempos, type Dialogo } from "@/site/ilustracao";

export function Ilustracao({ dialogos }: { dialogos: Dialogo[] }) {
  const estado = useRef({ c: 0, t: 0, pausado: false, hover: false, reduzido: false });
  const [, pintar] = useState(0);
  useEffect(() => {
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduz) {
      estado.current = { c: 0, t: tempos(dialogos[0]).fim, pausado: true, hover: false, reduzido: true };
      pintar((n) => n + 1);
      return;
    }
    const id = window.setInterval(() => {
      const atual = estado.current;
      if (atual.pausado || atual.hover || atual.reduzido) return;
      const fim = tempos(dialogos[atual.c]).fim;
      if (atual.t + 1 > fim) {
        atual.c = (atual.c + 1) % dialogos.length;
        atual.t = 0;
      } else atual.t += 1;
      pintar((n) => n + 1);
    }, 60);
    return () => window.clearInterval(id);
  }, [dialogos]);

  const atual = estado.current;
  const dialogo = dialogos[atual.c] ?? dialogos[0];
  const chat = quadro(dialogo, atual.t);
  const fim = tempos(dialogo).fim;
  function escolher(indice: number) {
    const reduzido = estado.current.reduzido || estado.current.pausado;
    estado.current.c = indice;
    estado.current.t = reduzido ? tempos(dialogos[indice]).fim : 0;
    pintar((n) => n + 1);
  }
  return (
    <figure
      style={{ flex: "1 1 30rem", minWidth: 0, margin: 0 }}
      aria-label="Ilustração: conversa simulada com um assistente de IA conectado ao servidor MCP"
      onMouseEnter={() => {
        estado.current.hover = true;
      }}
      onMouseLeave={() => {
        estado.current.hover = false;
      }}
      onFocus={() => {
        estado.current.hover = true;
      }}
      onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) estado.current.hover = false;
      }}
    >
      <div className="x-win" aria-hidden="true">
        <div className="x-win__bar">
          <span className="x-win__dot" />
          <span>Assistente · conectado a cbo.ciencia.social/mcp</span>
        </div>
        <div className="x-win__body">
          {chat.showUser ? (
            <div className="x-msg-user">
              {chat.user}
              {chat.typingUser ? <span className="x-caret" /> : null}
            </div>
          ) : null}
          {chat.showTool ? (
            <div className="x-tool">
              <Icon name="wrench" size={14} />
              <b>{dialogo.tool}</b>
              <span>{dialogo.args}</span>
              <span className="ok">{chat.toolStatus}</span>
            </div>
          ) : null}
          {chat.showBot ? (
            <p className="x-msg-bot" style={{ margin: 0 }}>
              {chat.bot}
              {chat.typingBot ? <span className="x-caret" /> : null}
            </p>
          ) : null}
          {chat.showCard ? (
            <div className="x-result">
              <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "baseline", flexWrap: "wrap" }}>
                <span className="x-id" style={{ color: "var(--ink)", fontWeight: 500 }}>
                  {dialogo.cardCod}
                </span>
                <span style={{ font: "500 16px/22px var(--font-serif)" }}>{dialogo.cardTitulo}</span>
              </div>
              {dialogo.cardLinhas.map((linha) => (
                <span key={linha} style={{ fontSize: "13px", lineHeight: "18px", color: "var(--ink-2)" }}>
                  {linha}
                </span>
              ))}
            </div>
          ) : null}
          {chat.showFecho ? (
            <p className="x-msg-bot" style={{ margin: 0, color: "var(--ink-2)", fontSize: "15px" }}>
              {dialogo.fecho}
            </p>
          ) : null}
        </div>
        <div className="x-win__input">
          <Icon name="message-square" />
          <span>Pergunte sobre uma ocupação</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
        {dialogos.map((item, indice) => {
          const pct = indice < atual.c ? 100 : indice === atual.c ? Math.min(100, (atual.t / fim) * 100) : 0;
          return (
            <button
              key={item.rotulo}
              type="button"
              aria-label={`Conversa ${indice + 1} de ${dialogos.length}: ${item.rotulo.toLowerCase()}`}
              aria-pressed={indice === atual.c}
              onClick={() => escolher(indice)}
              style={{ appearance: "none", display: "block", width: "100%", padding: "10px 0", border: 0, background: "transparent", cursor: "pointer" }}
            >
              <span style={{ display: "block", height: "3px", overflow: "hidden", background: "var(--line)", borderRadius: "1px" }}>
                <span style={{ display: "block", height: "100%", width: `${pct}%`, background: "var(--accent)" }} />
              </span>
            </button>
          );
        })}
      </div>
    </figure>
  );
}
