// Table-introspection helpers for the SQLite forensics view. Lists tables,
// reads paged rows, and exports CSV.

import type { Database } from "sql.js";

export interface TableInfo {
  name: string;
  type: "table" | "view";
  columns: string[];
  rowCount: number;
  /** True for sqlite_* internal tables. */
  internal: boolean;
}

export function listTables(db: Database): TableInfo[] {
  const stmt = db.prepare(
    "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name",
  );
  const out: TableInfo[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { name: string; type: string };
    const internal = row.name.startsWith("sqlite_");
    let columns: string[] = [];
    let rowCount = 0;
    try {
      const cs = db.prepare(`PRAGMA table_info("${row.name.replace(/"/g, '""')}")`);
      while (cs.step()) {
        const r = cs.getAsObject() as { name: string };
        columns.push(r.name);
      }
      cs.free();
    } catch {
      columns = [];
    }
    try {
      const rs = db.exec(`SELECT COUNT(*) AS c FROM "${row.name.replace(/"/g, '""')}"`);
      if (rs[0]?.values?.[0]) rowCount = Number(rs[0].values[0][0]);
    } catch {
      rowCount = 0;
    }
    out.push({
      name: row.name,
      type: row.type === "view" ? "view" : "table",
      columns,
      rowCount,
      internal,
    });
  }
  stmt.free();
  return out;
}

export interface PagedRows {
  columns: string[];
  rows: Array<Array<string | number | null>>;
  totalRows: number;
  page: number;
  pageSize: number;
}

export function readPage(
  db: Database,
  table: string,
  page: number,
  pageSize: number,
): PagedRows {
  const safe = table.replace(/"/g, '""');
  let totalRows = 0;
  try {
    const cnt = db.exec(`SELECT COUNT(*) FROM "${safe}"`);
    if (cnt[0]?.values?.[0]) totalRows = Number(cnt[0].values[0][0]);
  } catch {
    totalRows = 0;
  }
  const offset = page * pageSize;
  const result = db.exec(
    `SELECT * FROM "${safe}" LIMIT ${Number(pageSize) | 0} OFFSET ${Number(offset) | 0}`,
  );
  const r0 = result[0];
  const columns = r0?.columns ?? [];
  const rows = (r0?.values ?? []).map((row) =>
    row.map((v) => (typeof v === "object" && v ? "[blob]" : (v as string | number | null))),
  );
  return { columns, rows, totalRows, page, pageSize };
}

export function tableToCsv(db: Database, table: string, max = 10_000): string {
  const safe = table.replace(/"/g, '""');
  const result = db.exec(`SELECT * FROM "${safe}" LIMIT ${max}`);
  const r = result[0];
  if (!r) return "";
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [r.columns.join(",")];
  for (const row of r.values) lines.push(row.map(escape).join(","));
  return lines.join("\n");
}
