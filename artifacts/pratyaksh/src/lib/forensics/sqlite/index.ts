// SQLite forensics orchestrator.
import type { CaseModeResult, ModeFinding, ModeProgress } from "../common/types";
import { sortFindings } from "../common/types";
import { openSqliteDatabase, type Database } from "./open";
import { listTables, type TableInfo } from "./tables";
import { recoverDeletedRows, type RecoveredRow } from "./deleted-recovery";

export interface SqlitePayload {
  fileSize: number;
  pageSize: number;
  encoding: string;
  userVersion: number;
  applicationId: number;
  tables: TableInfo[];
  recovered: RecoveredRow[];
  notes: string[];
}

export async function analyzeSqlite(
  file: File,
  onProgress?: ModeProgress,
): Promise<CaseModeResult<SqlitePayload> & { _db: Database | null }> {
  const t0 = performance.now();
  const findings: ModeFinding[] = [];
  const notes: string[] = [];
  let db: Database | null = null;
  let tables: TableInfo[] = [];
  let recovered: RecoveredRow[] = [];
  let pageSize = 0;
  let encoding = "unknown";
  let userVersion = 0;
  let applicationId = 0;

  // Read header for raw scan + sanity checks
  const headBuf = new Uint8Array(await file.slice(0, 100).arrayBuffer());
  const magic = String.fromCharCode(...headBuf.slice(0, 16));
  if (magic !== "SQLite format 3\0") {
    findings.push({
      title: "Not a SQLite database (header magic missing)",
      severity: "info",
    });
    return {
      mode: "sqlite",
      modeLabel: "SQLite Forensics",
      durationMs: Math.round(performance.now() - t0),
      headline: "Not a SQLite database",
      findings,
      payload: {
        fileSize: file.size,
        pageSize: 0,
        encoding,
        userVersion,
        applicationId,
        tables: [],
        recovered: [],
        notes: ["Header magic 'SQLite format 3\\0' not found."],
      },
      methodology: ["Verified SQLite header magic; aborted on mismatch."],
      _db: null,
    };
  }
  pageSize = (headBuf[16] << 8) | headBuf[17];
  if (pageSize === 1) pageSize = 65536;
  const encodingCode = (headBuf[56] << 24) | (headBuf[57] << 16) | (headBuf[58] << 8) | headBuf[59];
  encoding = encodingCode === 1 ? "UTF-8" : encodingCode === 2 ? "UTF-16le" : encodingCode === 3 ? "UTF-16be" : `code ${encodingCode}`;
  userVersion = (headBuf[60] << 24) | (headBuf[61] << 16) | (headBuf[62] << 8) | headBuf[63];
  applicationId = (headBuf[68] << 24) | (headBuf[69] << 16) | (headBuf[70] << 8) | headBuf[71];

  onProgress?.("Opening with SQLite WASM", 0.2);
  try {
    db = await openSqliteDatabase(file);
  } catch (e) {
    findings.push({
      title: "sql.js failed to open database",
      severity: "high",
      detail: (e as Error).message,
    });
    return {
      mode: "sqlite",
      modeLabel: "SQLite Forensics",
      durationMs: Math.round(performance.now() - t0),
      headline: "Database open failed",
      findings,
      payload: {
        fileSize: file.size,
        pageSize,
        encoding,
        userVersion,
        applicationId,
        tables: [],
        recovered: [],
        notes,
      },
      methodology: ["Header verified; SQL engine refused to open the file (likely corruption)."],
      _db: null,
    };
  }
  onProgress?.("Listing tables", 0.45);
  tables = listTables(db);
  onProgress?.("Walking pages for deleted-row recovery", 0.65);
  const raw = new Uint8Array(await file.arrayBuffer());
  recovered = await recoverDeletedRows(db, raw, { maxTotal: 1000, maxPerTable: 200 });

  findings.push({
    title: `Database opened: ${tables.length} table(s) (${tables.filter((t) => t.internal).length} internal)`,
    severity: "info",
  });
  if (recovered.length > 0) {
    findings.push({
      title: `${recovered.length} recoverable deleted row(s) across ${new Set(recovered.map((r) => r.table)).size} table(s)`,
      severity: "high",
      detail: "Cells found in unallocated page space matched the column types of one or more tables.",
    });
  }
  for (const t of tables) {
    if (!t.internal && t.rowCount > 0 && /password|hash|secret|token|key/i.test(t.columns.join(" "))) {
      findings.push({
        title: `${t.name} contains credential-like columns`,
        severity: "med",
        detail: t.columns.join(", "),
      });
    }
  }

  notes.push(
    `Page size: ${pageSize} bytes; encoding: ${encoding}; user_version: ${userVersion}; application_id: 0x${applicationId.toString(16)}.`,
  );

  const t1 = performance.now();
  onProgress?.("Done", 1);
  return {
    mode: "sqlite",
    modeLabel: "SQLite Forensics",
    durationMs: Math.round(t1 - t0),
    headline: `${tables.length} table(s); ${recovered.length} recoverable deleted row(s)`,
    findings: sortFindings(findings),
    payload: {
      fileSize: file.size,
      pageSize,
      encoding,
      userVersion,
      applicationId,
      tables,
      recovered,
      notes,
    },
    methodology: [
      "Validate the SQLite file header (magic + page size + encoding).",
      "Open the database read-only with sql.js (SQLite WASM).",
      "Enumerate every user table from sqlite_master with column lists and row counts.",
      "Walk every leaf B-tree page; treat unallocated cell space + the in-page free chain as candidate cells.",
      "Decode each candidate against every table's schema (column count + affinity); only structurally valid rows are kept.",
      "Surface tables with credential-like columns (password / token / key / secret).",
    ],
    _db: db,
  };
}
