export type Token = { t: string; c: string };

const PALAVRAS: Record<string, string> = {
  js: " const let var function return await async if else for while new import from export default true false null undefined of in typeof class this ",
  python: " import from as def return if elif else for while in not and or None True False with class lambda try except ",
  bash: "",
};

const EXPRESSOES: Record<string, RegExp> = {
  js: /(\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|([^\s\S])|([A-Za-z_$][\w$]*)|([{}\[\]().,:;=<>+*\/|&!?-])/g,
  python: /(#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|([^\s\S])|([A-Za-z_]\w*)|([{}\[\]().,:;=<>+*\/|&!-])/g,
  bash: /(^[ \t]*#[^\n]*)|("(?:\\.|[^"\\\n])*"|'[^'\n]*')|([^\s\S])|(\s--?[A-Za-z][\w-]*)|(^[ \t]*[A-Za-z][\w.-]*(?=[ \t]|$))|(\$)/gm,
};

/** Realce por token, as mesmas classes cs-tk-* de bundle.js. Sem biblioteca. */
export function realcar(codigo: string | null | undefined, lang?: string): Token[] {
  const code = codigo == null ? "" : String(codigo);
  const out: Token[] = [];
  const push = (t: string, c: string) => {
    if (!t) return;
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.c === c) ultimo.t += t;
    else out.push({ t, c });
  };
  if (lang === "json") {
    const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\],:])/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
      push(code.slice(last, m.index), "");
      if (m[1]) {
        push(m[1], m[2] ? "key" : "str");
        if (m[2]) push(m[2], "pun");
      } else if (m[3]) push(m[3], "num");
      else if (m[4]) push(m[4], "kw");
      else push(m[5] ?? "", "pun");
      last = re.lastIndex;
    }
    push(code.slice(last), "");
    return out;
  }
  const base = lang ? EXPRESSOES[lang] : undefined;
  if (!base) return [{ t: code, c: "" }];
  const re = new RegExp(base.source, base.flags);
  const kw = PALAVRAS[lang ?? ""] ?? "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m[0] === "") {
      re.lastIndex += 1;
      continue;
    }
    push(code.slice(last, m.index), "");
    if (m[1]) push(m[1], "com");
    else if (m[2]) push(m[2], "str");
    else if (m[3]) push(m[3], "num");
    else if (m[4]) push(m[4], "key");
    else if (m[5]) {
      if (lang === "bash") push(m[5], "kw");
      else if (kw.includes(` ${m[5]} `)) push(m[5], "kw");
      else if (code.charAt(re.lastIndex) === "(") push(m[5], "key");
      else push(m[5], "");
    } else push(m[6] ?? "", "pun");
    last = re.lastIndex;
  }
  push(code.slice(last), "");
  return out;
}
