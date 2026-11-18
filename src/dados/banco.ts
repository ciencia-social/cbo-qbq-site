import path from "node:path";
import { DatabaseSync } from "node:sqlite";

type ValorSql = null | number | bigint | string;

const CAMINHO = path.join(process.cwd(), "data", "cbo-qbq.sqlite");

const globalComBanco = globalThis as typeof globalThis & { __cboQbq?: DatabaseSync };

export function banco(): DatabaseSync {
  if (!globalComBanco.__cboQbq) {
    globalComBanco.__cboQbq = new DatabaseSync(CAMINHO, { readOnly: true });
  }
  return globalComBanco.__cboQbq;
}

export function todos<T>(sql: string, ...params: ValorSql[]): T[] {
  return banco().prepare(sql).all(...params) as T[];
}

export function um<T>(sql: string, ...params: ValorSql[]): T | undefined {
  return banco().prepare(sql).get(...params) as T | undefined;
}
