// sql.js wrapper. Loads the WASM exactly once per session, then opens a
// SQLite database from a `File` (read fully into memory). Used by the SQLite
// forensics mode for table inspection and schema-driven recovery.

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

let promise: Promise<SqlJsStatic> | null = null;

function loadSqlJs(): Promise<SqlJsStatic> {
  if (!promise) {
    promise = initSqlJs({
      // Vite resolves this URL at bundle time, hashes the wasm and serves it.
      locateFile: (file: string) =>
        new URL(`../../../../node_modules/sql.js/dist/${file}`, import.meta.url).href,
    });
  }
  return promise;
}

export async function openSqliteDatabase(file: File): Promise<Database> {
  const buf = await file.arrayBuffer();
  const SQL = await loadSqlJs();
  return new SQL.Database(new Uint8Array(buf));
}

export type { Database } from "sql.js";
