// Deleted-row recovery for SQLite. SQLite does not zero out cells when rows
// are deleted; the bytes remain on the page until vacuumed. We walk every
// page in the file, treat unallocated cell space as candidate cells, and try
// to decode them against the schema of every table whose root page matches
// the page type. Recovered rows are tentative — column types are honoured but
// row-id linkage is lost.

import type { Database } from "sql.js";

const PAGE_TYPE_TABLE_LEAF = 0x0d;
const PAGE_TYPE_TABLE_INTERIOR = 0x05;
const PAGE_TYPE_INDEX_LEAF = 0x0a;
const PAGE_TYPE_INDEX_INTERIOR = 0x02;

interface ColumnDef {
  name: string;
  affinity: "TEXT" | "NUMERIC" | "INTEGER" | "REAL" | "BLOB";
}

function affinityOf(typeStr: string): ColumnDef["affinity"] {
  const t = typeStr.toUpperCase();
  if (t.includes("INT")) return "INTEGER";
  if (t.includes("CHAR") || t.includes("CLOB") || t.includes("TEXT")) return "TEXT";
  if (t.includes("BLOB") || t === "") return "BLOB";
  if (t.includes("REAL") || t.includes("FLOA") || t.includes("DOUB")) return "REAL";
  return "NUMERIC";
}

function readVarint(buf: Uint8Array, off: number): { value: bigint; size: number } {
  let v = 0n;
  let i = 0;
  for (; i < 8; i++) {
    if (off + i >= buf.length) return { value: v, size: i };
    const b = buf[off + i];
    v = (v << 7n) | BigInt(b & 0x7f);
    if ((b & 0x80) === 0) return { value: v, size: i + 1 };
  }
  if (off + 8 < buf.length) {
    v = (v << 8n) | BigInt(buf[off + 8]);
    return { value: v, size: 9 };
  }
  return { value: v, size: 8 };
}

function decodeSerial(
  buf: Uint8Array,
  off: number,
  serialType: bigint,
): { value: string | number | null; size: number } {
  const t = Number(serialType);
  if (t === 0) return { value: null, size: 0 };
  if (t === 1) return { value: off < buf.length ? (new DataView(buf.buffer, buf.byteOffset + off, 1).getInt8(0)) : 0, size: 1 };
  if (t === 2) return { value: off + 1 < buf.length ? new DataView(buf.buffer, buf.byteOffset + off, 2).getInt16(0, false) : 0, size: 2 };
  if (t === 3) {
    if (off + 2 >= buf.length) return { value: 0, size: 3 };
    let v = (buf[off] << 16) | (buf[off + 1] << 8) | buf[off + 2];
    if (v & 0x800000) v -= 0x1000000;
    return { value: v, size: 3 };
  }
  if (t === 4) return { value: off + 3 < buf.length ? new DataView(buf.buffer, buf.byteOffset + off, 4).getInt32(0, false) : 0, size: 4 };
  if (t === 5) {
    if (off + 5 >= buf.length) return { value: 0, size: 6 };
    const hi = (buf[off] << 8) | buf[off + 1];
    const lo = (buf[off + 2] << 24) | (buf[off + 3] << 16) | (buf[off + 4] << 8) | buf[off + 5];
    return { value: hi * 4294967296 + (lo >>> 0), size: 6 };
  }
  if (t === 6) {
    if (off + 7 >= buf.length) return { value: 0, size: 8 };
    const hi = new DataView(buf.buffer, buf.byteOffset + off, 4).getInt32(0, false);
    const lo = new DataView(buf.buffer, buf.byteOffset + off + 4, 4).getUint32(0, false);
    return { value: hi * 4294967296 + lo, size: 8 };
  }
  if (t === 7) {
    if (off + 7 >= buf.length) return { value: 0, size: 8 };
    return { value: new DataView(buf.buffer, buf.byteOffset + off, 8).getFloat64(0, false), size: 8 };
  }
  if (t === 8) return { value: 0, size: 0 };
  if (t === 9) return { value: 1, size: 0 };
  if (t >= 12 && t % 2 === 0) {
    const len = (t - 12) / 2;
    return { value: `[blob ${len}B]`, size: len };
  }
  if (t >= 13 && t % 2 === 1) {
    const len = (t - 13) / 2;
    if (off + len > buf.length) return { value: "", size: len };
    let s = "";
    for (let i = 0; i < len; i++) s += String.fromCharCode(buf[off + i]);
    return { value: s, size: len };
  }
  return { value: null, size: 0 };
}

function tryDecodeCell(
  cellBytes: Uint8Array,
  schema: ColumnDef[],
): Array<string | number | null> | null {
  if (cellBytes.length < 2) return null;
  // Cell payload: header_size (varint), serial_type[0], serial_type[1], ..., body bytes
  const { value: headerSize, size: hsBytes } = readVarint(cellBytes, 0);
  const headerLen = Number(headerSize);
  if (headerLen < 1 || headerLen > cellBytes.length) return null;
  const serialTypes: bigint[] = [];
  let p = hsBytes;
  while (p < headerLen) {
    const { value, size } = readVarint(cellBytes, p);
    if (size === 0) return null;
    serialTypes.push(value);
    p += size;
  }
  if (serialTypes.length !== schema.length) return null;
  // Decode body
  const out: Array<string | number | null> = [];
  let body = headerLen;
  for (let i = 0; i < serialTypes.length; i++) {
    const { value, size } = decodeSerial(cellBytes, body, serialTypes[i]);
    body += size;
    if (body > cellBytes.length) return null;
    // Sanity-check against affinity
    if (schema[i].affinity === "TEXT" && typeof value === "string") {
      // Reject if non-printable characters dominate
      let printable = 0;
      for (let j = 0; j < value.length; j++) {
        const c = value.charCodeAt(j);
        if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127)) printable++;
      }
      if (value.length > 0 && printable / value.length < 0.7) return null;
    }
    out.push(value);
  }
  return out;
}

export interface RecoveredRow {
  table: string;
  values: Array<string | number | null>;
  pageNumber: number;
  /** Byte offset within the file where the cell starts. */
  fileOffset: number;
}

export async function recoverDeletedRows(
  db: Database,
  rawBytes: Uint8Array,
  options?: { maxPerTable?: number; maxTotal?: number },
): Promise<RecoveredRow[]> {
  const maxPerTable = options?.maxPerTable ?? 200;
  const maxTotal = options?.maxTotal ?? 1000;

  // SQLite header @offset 0..99
  if (
    rawBytes.length < 100 ||
    String.fromCharCode(...rawBytes.slice(0, 16)) !== "SQLite format 3\0"
  ) {
    return [];
  }
  const pageSize = (() => {
    const v = (rawBytes[16] << 8) | rawBytes[17];
    return v === 1 ? 65536 : v;
  })();
  // Reserved space at end of each page
  const reservedSpace = rawBytes[20];

  // Build schema map: rootpage → { table, columns }
  type Schema = { table: string; columns: ColumnDef[] };
  const rootSchemas = new Map<number, Schema>();
  const stmt = db.prepare(
    "SELECT name, sql, rootpage FROM sqlite_master WHERE type='table'",
  );
  while (stmt.step()) {
    const r = stmt.getAsObject() as { name: string; sql: string; rootpage: number };
    if (!r.sql) continue;
    // Parse columns with regex (good enough for triage; full parser too heavy)
    const m = /\(([\s\S]+)\)\s*;?\s*$/.exec(r.sql);
    if (!m) continue;
    const cols: ColumnDef[] = [];
    let depth = 0;
    let cur = "";
    const chunks: string[] = [];
    for (const ch of m[1]) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        chunks.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    if (cur.trim()) chunks.push(cur.trim());
    for (const c of chunks) {
      if (/^(PRIMARY|UNIQUE|CHECK|FOREIGN|CONSTRAINT)/i.test(c.trim())) continue;
      const tok = c.trim().match(/^"?([\w$]+)"?\s*([\w]+)?/);
      if (!tok) continue;
      cols.push({ name: tok[1], affinity: affinityOf(tok[2] ?? "") });
    }
    if (cols.length > 0) rootSchemas.set(r.rootpage, { table: r.name, columns: cols });
  }
  stmt.free();

  const recovered: RecoveredRow[] = [];
  const perTable = new Map<string, number>();

  const numPages = Math.floor(rawBytes.length / pageSize);
  for (let p = 1; p <= numPages; p++) {
    if (recovered.length >= maxTotal) break;
    const pageStart = (p - 1) * pageSize;
    // First page reserves 100-byte file header at the start
    const pageHeaderOff = p === 1 ? 100 : 0;
    const pageType = rawBytes[pageStart + pageHeaderOff];
    if (
      pageType !== PAGE_TYPE_TABLE_LEAF &&
      pageType !== PAGE_TYPE_TABLE_INTERIOR &&
      pageType !== PAGE_TYPE_INDEX_LEAF &&
      pageType !== PAGE_TYPE_INDEX_INTERIOR
    ) {
      continue;
    }
    if (pageType !== PAGE_TYPE_TABLE_LEAF) continue;
    const numCells =
      (rawBytes[pageStart + pageHeaderOff + 3] << 8) |
      rawBytes[pageStart + pageHeaderOff + 4];
    const cellContentStartRaw =
      (rawBytes[pageStart + pageHeaderOff + 5] << 8) |
      rawBytes[pageStart + pageHeaderOff + 6];
    const cellContentStart = cellContentStartRaw === 0 ? 65536 : cellContentStartRaw;
    const headerLen = pageHeaderOff + 8;
    const cellArrayStart = headerLen;
    const cellArrayEnd = cellArrayStart + numCells * 2;
    // Allocated cell offsets
    const allocated = new Set<number>();
    for (let i = 0; i < numCells; i++) {
      const off =
        (rawBytes[pageStart + cellArrayStart + i * 2] << 8) |
        rawBytes[pageStart + cellArrayStart + i * 2 + 1];
      allocated.add(off);
    }
    // Free list (within page)
    const freeOffset =
      (rawBytes[pageStart + pageHeaderOff + 1] << 8) |
      rawBytes[pageStart + pageHeaderOff + 2];

    // Decide which schema applies. We don't know which table this page belongs
    // to without walking interior pages — so we try every schema in turn.
    const schemas = Array.from(rootSchemas.values());
    if (schemas.length === 0) continue;

    // Scan unallocated bytes between the cell pointer array and the start of
    // allocated cell content. Also include the in-page free chain.
    const usableEnd = pageSize - reservedSpace;
    void usableEnd;
    const scanStart = cellArrayEnd;
    const scanEnd = cellContentStart;
    const candidates: number[] = [];
    for (let off = scanStart; off < scanEnd; off++) {
      candidates.push(off);
    }
    // Include free chain entries
    let fl = freeOffset;
    let safety = 64;
    while (fl > 0 && safety-- > 0) {
      candidates.push(fl + 4); // skip 4-byte block header
      fl =
        (rawBytes[pageStart + fl] << 8) | rawBytes[pageStart + fl + 1];
    }

    for (const off of candidates) {
      if (allocated.has(off)) continue;
      const slice = rawBytes.slice(pageStart + off, pageStart + Math.min(scanEnd + 64, pageSize));
      // SQLite leaf cell: payload_len varint, rowid varint, payload
      const { value: payloadLen, size: plBytes } = readVarint(slice, 0);
      const pl = Number(payloadLen);
      if (pl < 4 || pl > 4096) continue;
      const { value: rowid, size: ridBytes } = readVarint(slice, plBytes);
      void rowid;
      const cellHeader = slice.slice(plBytes + ridBytes, plBytes + ridBytes + pl);
      if (cellHeader.length < pl) continue;
      for (const sc of schemas) {
        if ((perTable.get(sc.table) ?? 0) >= maxPerTable) continue;
        const decoded = tryDecodeCell(cellHeader, sc.columns);
        if (decoded) {
          recovered.push({
            table: sc.table,
            values: decoded,
            pageNumber: p,
            fileOffset: pageStart + off,
          });
          perTable.set(sc.table, (perTable.get(sc.table) ?? 0) + 1);
          if (recovered.length >= maxTotal) break;
          break;
        }
      }
      if (recovered.length >= maxTotal) break;
    }
  }
  return recovered;
}
