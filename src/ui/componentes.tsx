import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import { formato, type FormatoNumero } from "@/ui/formato";
import { cx, Icon } from "@/ui/icone";
import { realcar } from "@/ui/realce";
import { BotaoCopiar, BotaoTema } from "@/ui/cliente";

export { cx, Icon };

export function Wordmark({ href, size, className }: { href?: string; size?: "lg"; className?: string }) {
  const cn = cx("cs-wordmark", size === "lg" && "cs-wordmark--lg", className);
  return href ? (
    <a className={cn} href={href}>
      ciencia.social
    </a>
  ) : (
    <span className={cn}>ciencia.social</span>
  );
}

export type LinkNav = { href: string; label: string };

const LINKS: LinkNav[] = [
  { href: "/ocupacoes", label: "Ocupações" },
  { href: "/competencias", label: "Competências" },
  { href: "/docs", label: "API" },
  { href: "/docs/mcp", label: "MCP" },
  { href: "/sobre", label: "Sobre" },
];

export function secaoAtual(pathname: string, href: string) {
  if (href === "/docs/mcp") return pathname === "/docs/mcp" || pathname.startsWith("/docs/mcp/");
  if (href === "/docs") return pathname === "/docs" || (pathname.startsWith("/docs/") && !pathname.startsWith("/docs/mcp"));
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NetworkBar({
  atual = "",
  links = LINKS,
  className,
}: {
  atual?: string;
  links?: LinkNav[];
  className?: string;
}) {
  return (
    <header className={cx("cs-netbar", className)}>
      <div className="cs-page cs-netbar__in">
        <Wordmark href="https://ciencia.social" />
        <span className="cs-netbar__sep" aria-hidden="true">
          /
        </span>
        <a className="cs-netbar__name" href="/">
          CBO e QBQ
        </a>
        <nav className="cs-netbar__nav" aria-label="Navegação do artefato">
          {links.map((link) => (
            <a key={link.href} href={link.href} aria-current={secaoAtual(atual, link.href) ? "page" : undefined}>
              {link.label}
            </a>
          ))}
          <BotaoTema />
        </nav>
      </div>
    </header>
  );
}

export type ItemRodape = string | { label: string; href?: string };

export function SiteFooter({
  note = "Dados abertos da Classificação Brasileira de Ocupações e do Quadro Brasileiro de Qualificações, a partir de publicações oficiais do Ministério do Trabalho e Emprego.",
  columns,
  className,
}: {
  note?: string;
  columns: { title: string; items: ItemRodape[] }[];
  className?: string;
}) {
  return (
    <footer className={cx("cs-footer", className)}>
      <div className="cs-page">
        <div className="cs-footer__grid">
          <div className="cs-footer__brand">
            <Wordmark href="https://ciencia.social" />
            {note ? <p>{note}</p> : null}
          </div>
          {columns.map((coluna) => (
            <section key={coluna.title}>
              <h2>{coluna.title}</h2>
              <ul>
                {coluna.items.map((item, i) => {
                  const rotulo = typeof item === "string" ? item : item.label;
                  const href = typeof item === "string" ? undefined : item.href;
                  return <li key={i}>{href ? <a href={href}>{rotulo}</a> : rotulo}</li>;
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </footer>
  );
}

export function ReportHeader({
  eyebrow,
  status,
  title,
  subtitle,
  meta = [],
  className,
}: {
  eyebrow?: string;
  status?: string;
  title: string;
  subtitle?: string;
  meta?: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cx("cs-rhead", className)}>
      <div className="cs-rhead__eyebrow">
        {eyebrow ? <span className="cs-meta-text">{eyebrow}</span> : null}
        {status ? <Badge status={status} /> : null}
      </div>
      <h1 className="cs-rhead__title">{title}</h1>
      {subtitle ? <p className="cs-rhead__sub">{subtitle}</p> : null}
      {meta.length ? (
        <dl className="cs-rhead__meta">
          {meta.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

const ROTULOS_BADGE: Record<string, string> = {
  rascunho: "Rascunho",
  preliminar: "Preliminar",
  revisao: "Em revisão",
  consolidado: "Consolidado",
  retificado: "Retificado",
  ilustrativo: "Dados ilustrativos",
};

export function Badge({ status = "rascunho", className, children }: { status?: string; className?: string; children?: ReactNode }) {
  return <span className={cx("cs-badge", `cs-badge--${status}`, className)}>{children || ROTULOS_BADGE[status]}</span>;
}

const ROTULOS_CALLOUT: Record<string, string> = {
  nota: "Nota metodológica",
  achado: "Achado",
  limite: "Limitação",
  ia: "Uso de IA",
};

export function Callout({ kind = "nota", label, className, children }: { kind?: string; label?: string; className?: string; children: ReactNode }) {
  return (
    <aside className={cx("cs-callout", `cs-callout--${kind}`, className)}>
      <span className="cs-callout__label">{label || ROTULOS_CALLOUT[kind]}</span>
      <div className="cs-callout__body">{children}</div>
    </aside>
  );
}

export function StatTile({ label, value, delta, n, hero, className }: { label: string; value: ReactNode; delta?: ReactNode; n?: ReactNode; hero?: boolean; className?: string }) {
  return (
    <div className={cx("cs-stat", hero && "cs-stat--hero", className)}>
      <div className="cs-stat__label">{label}</div>
      <div className="cs-stat__value">{value}</div>
      {delta ? <div className="cs-stat__delta">{delta}</div> : null}
      {n ? <div className="cs-stat__n">{n}</div> : null}
    </div>
  );
}

export function Button({
  variant = "quiet",
  icon,
  iconEnd,
  href,
  className,
  children,
  type,
  ...rest
}: {
  variant?: "quiet" | "primary" | "link";
  icon?: string;
  iconEnd?: string;
  href?: string;
  className?: string;
  children?: ReactNode;
  type?: "button" | "submit";
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "type" | "href">) {
  const cn = cx("cs-btn", variant !== "quiet" && `cs-btn--${variant}`, className);
  const miolo = (
    <>
      {icon ? <Icon name={icon} /> : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} /> : null}
    </>
  );
  if (href) {
    return (
      <a className={cn} href={href} {...rest}>
        {miolo}
      </a>
    );
  }
  return (
    <button className={cn} type={type ?? "button"} {...rest}>
      {miolo}
    </button>
  );
}

export function TextInput({
  label,
  hideLabel,
  icon,
  block,
  className,
  end,
  id,
  ...rest
}: {
  label: string;
  hideLabel?: boolean;
  icon?: string;
  block?: boolean;
  className?: string;
  end?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cx("cs-field", block && "cs-field--block", className)}>
      <span className={cx("cs-field__label", hideLabel && "cs-sr")}>{label}</span>
      <span className="cs-input">
        {icon ? <Icon name={icon} /> : null}
        <input id={id} className="cs-input__el" type={rest.type ?? "text"} {...rest} />
        {end}
      </span>
    </label>
  );
}

export function Select({
  label,
  options,
  block,
  className,
  id,
  ...rest
}: {
  label: string;
  options: { value: string; label: string }[];
  block?: boolean;
  className?: string;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={cx("cs-field", block && "cs-field--block", className)}>
      <span className="cs-field__label">{label}</span>
      <select id={id} className="cs-select" {...rest}>
        {options.map((opcao) => (
          <option key={opcao.value} value={opcao.value}>
            {opcao.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export type OpcaoSegmento = { value: string; label: string; href?: string };

export function SegmentedControl({
  legend,
  name,
  options,
  value,
  defaultValue,
  className,
}: {
  legend: string;
  name: string;
  options: OpcaoSegmento[];
  value?: string;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <fieldset className={cx("cs-seg", className)}>
      <legend className="cs-seg__legend">{legend}</legend>
      <div className="cs-seg__opts">
        {options.map((opcao) => {
          const escolhida = value !== undefined ? value === opcao.value : defaultValue === opcao.value;
          if (opcao.href) {
            return (
              <span key={opcao.value} className="cs-seg__opt">
                <a href={opcao.href} aria-current={escolhida ? "true" : undefined}>
                  {opcao.label}
                </a>
              </span>
            );
          }
          return (
            <label key={opcao.value} className="cs-seg__opt">
              <input type="radio" name={name} value={opcao.value} defaultChecked={escolhida} />
              <span>{opcao.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FilterBar({ label = "Filtros", className, end, children }: { label?: string; className?: string; end?: ReactNode; children: ReactNode }) {
  return (
    <div className={cx("cs-filters", className)} role="group" aria-label={label}>
      {children}
      {end ? <div className="cs-filters__end">{end}</div> : null}
    </div>
  );
}

export function Disclosure({ summary, open, className, children }: { summary: ReactNode; open?: boolean; className?: string; children: ReactNode }) {
  return (
    <details className={cx("cs-disclosure", className)} open={open}>
      <summary>{summary}</summary>
      <div className="cs-disclosure__body">{children}</div>
    </details>
  );
}

export type ItemSumario = { href: string; label: string; current?: boolean; children?: ItemSumario[] };

function listaSumario(itens: ItemSumario[]) {
  return (
    <ol>
      {itens.map((item) => (
        <li key={item.href}>
          <a href={item.href} aria-current={item.current ? "location" : undefined}>
            {item.label}
          </a>
          {item.children ? listaSumario(item.children) : null}
        </li>
      ))}
    </ol>
  );
}

export function Toc({ title = "Sumário", items, className }: { title?: string; items: ItemSumario[]; className?: string }) {
  return (
    <nav className={cx("cs-toc", className)} aria-label={title}>
      <p className="cs-toc__title">{title}</p>
      {listaSumario(items)}
    </nav>
  );
}

export function Figure({
  kind = "Figura",
  number,
  title,
  subtitle,
  variant,
  className,
  note,
  table,
  children,
}: {
  kind?: string;
  number?: string;
  title: string;
  subtitle?: string;
  variant?: "card";
  className?: string;
  note?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
}) {
  const numero = number ? `${kind} ${number} – ` : null;
  return (
    <figure className={cx("cs-figure", variant === "card" && "cs-figure--card", className)}>
      <figcaption className="cs-figure__head">
        <span className="cs-figure__title">
          {numero ? <span className="cs-figure__num">{numero}</span> : null}
          {title}
        </span>
        {subtitle ? <span className="cs-figure__sub">{subtitle}</span> : null}
      </figcaption>
      <div className="cs-figure__body">{children}</div>
      {note || table ? (
        <div className="cs-figure__foot">
          {note ? <p>Nota: {note}</p> : null}
          {table ? <Disclosure summary="Ver dados em tabela">{table}</Disclosure> : null}
        </div>
      ) : null}
    </figure>
  );
}

export function BarChart({
  items,
  max,
  slot = 1,
  format,
  ariaLabel,
  className,
}: {
  items: { label: string; value: number }[];
  max?: number;
  slot?: number;
  format?: FormatoNumero;
  ariaLabel?: string;
  className?: string;
}) {
  const topo = max ?? Math.max(...items.map((item) => item.value), 0);
  const cor = `var(--data-${slot})`;
  return (
    <div className={cx("cs-chart", className)}>
      <div className="cs-bars" role={ariaLabel ? "group" : undefined} aria-label={ariaLabel}>
        {items.map((item, indice) => {
          const pct = topo ? (item.value / topo) * 82 : 0;
          return (
            <span key={`${item.label}-${indice}`} style={{ display: "contents" }}>
              <div className="cs-bars__label">{item.label}</div>
              <div className="cs-bars__track">
                <div className="cs-bars__bar" style={{ width: `${pct.toFixed(2)}%`, background: cor }} />
                <span className="cs-bars__value">{formato(item.value, format)}</span>
              </div>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export type ColunaTabela = { key: string; label: string; numeric?: boolean; format?: FormatoNumero };

export function DataTable({
  columns,
  rows,
  title,
  number,
  kind = "Tabela",
  note,
  className,
}: {
  columns: ColunaTabela[];
  rows: Record<string, ReactNode>[];
  title?: string;
  number?: string;
  kind?: string;
  note?: ReactNode;
  className?: string;
}) {
  const numero = number ? `${kind} ${number} – ` : null;
  return (
    <div className={cx("cs-table-wrap", className)}>
      <div className="cs-table-scroll" tabIndex={0} role="region" aria-label={title || "Tabela"}>
        <table className="cs-table">
          {title ? (
            <caption>
              {numero ? <span className="cs-figure__num">{numero}</span> : null}
              {title}
            </caption>
          ) : null}
          <thead>
            <tr>
              {columns.map((coluna) => (
                <th key={coluna.key} scope="col" className={coluna.numeric ? "cs-num" : undefined}>
                  {coluna.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((linha, indice) => (
              <tr key={indice}>
                {columns.map((coluna) => {
                  const valor = linha[coluna.key];
                  const texto = coluna.numeric && typeof valor === "number" ? formato(valor, coluna.format) : valor;
                  return (
                    <td key={coluna.key} className={coluna.numeric ? "cs-num" : undefined}>
                      {texto}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note ? <p className="cs-table__foot">Nota: {note}</p> : null}
    </div>
  );
}

export function CodeBlock({
  code,
  lang,
  title,
  meta,
  copy = true,
  maxHeight,
  className,
}: {
  code: string;
  lang?: string;
  title?: string;
  meta?: string;
  copy?: boolean;
  maxHeight?: string;
  className?: string;
}) {
  const tokens = realcar(code, lang);
  return (
    <div className={cx("cs-code", className)}>
      <div className="cs-code__head">
        <span className="cs-code__title">{title || lang || "Código"}</span>
        {meta ? <span className="cs-code__meta">{meta}</span> : null}
        {copy ? <BotaoCopiar code={code} /> : null}
      </div>
      <pre className="cs-code__pre" tabIndex={0} aria-label={title || "Código"} style={maxHeight ? { maxHeight } : undefined}>
        <code>
          {tokens.map((token, indice) =>
            token.c ? (
              <span key={indice} className={`cs-tk-${token.c}`}>
                {token.t}
              </span>
            ) : (
              token.t
            ),
          )}
        </code>
      </pre>
    </div>
  );
}
