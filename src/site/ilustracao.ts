export type Dialogo = {
  rotulo: string;
  user: string;
  tool: string;
  args: string;
  ok: string;
  bot: string;
  cardCod: string;
  cardTitulo: string;
  cardLinhas: string[];
  fecho: string;
};

export type Tempos = {
  u: number;
  tool: number;
  toolOk: number;
  bot: number;
  botFim: number;
  card: number;
  fecho: number;
  fim: number;
};

/** 60 ms por passo. O pedido digita 2 caracteres; a resposta, 4. */
export function tempos(dialogo: Pick<Dialogo, "user" | "bot">): Tempos {
  const u = Math.ceil(dialogo.user.length / 2);
  const b = Math.ceil(dialogo.bot.length / 4);
  const bot = u + 28;
  const botFim = bot + b;
  const card = botFim + 4;
  const fecho = card + 6;
  return { u, tool: u + 8, toolOk: u + 22, bot, botFim, card, fecho, fim: fecho + 80 };
}

export function quadro(dialogo: Dialogo, t: number) {
  const tm = tempos(dialogo);
  return {
    showUser: t > 0,
    typingUser: t < tm.u,
    user: dialogo.user.slice(0, t * 2),
    showTool: t >= tm.tool,
    toolStatus: t >= tm.toolOk ? dialogo.ok : "→ consultando",
    showBot: t >= tm.bot,
    typingBot: t < tm.botFim,
    bot: dialogo.bot.slice(0, Math.max(0, t - tm.bot) * 4),
    showCard: t >= tm.card,
    showFecho: t >= tm.fecho,
  };
}
