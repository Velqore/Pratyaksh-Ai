// Slice-and-yield helpers shared by every multi-mode engine. Mirrors the
// pattern from `hashing.ts`: read in fixed-size blocks via `File.slice`, hand
// each block to the consumer, then yield the event loop so the UI stays alive
// even on multi-GB evidence files.

export const DEFAULT_CHUNK = 1024 * 1024; // 1 MiB

export interface ChunkedReadOptions {
  chunkSize?: number;
  /** Inclusive start offset (default 0). */
  start?: number;
  /** Exclusive end offset (default file.size). */
  end?: number;
  /** Yield to event loop after every Nth chunk; default 1 (every chunk). */
  yieldEvery?: number;
}

/**
 * Iterate `file` in fixed-size chunks. Each call to `cb` may be async;
 * progress callback receives a fraction in [0,1].
 */
export async function readChunks(
  file: File,
  cb: (chunk: Uint8Array, offset: number) => void | Promise<void>,
  options: ChunkedReadOptions & { onProgress?: (frac: number) => void } = {},
): Promise<void> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK;
  const start = options.start ?? 0;
  const end = options.end ?? file.size;
  const total = Math.max(1, end - start);
  const yieldEvery = Math.max(1, options.yieldEvery ?? 1);

  let off = start;
  let i = 0;
  while (off < end) {
    const next = Math.min(off + chunkSize, end);
    const buf = await file.slice(off, next).arrayBuffer();
    const bytes = new Uint8Array(buf);
    await cb(bytes, off);
    off = next;
    i++;
    options.onProgress?.((off - start) / total);
    if (i % yieldEvery === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}

/** Read a fixed range and return it as a Uint8Array. */
export async function readRange(
  file: File,
  start: number,
  end: number,
): Promise<Uint8Array> {
  if (end <= start) return new Uint8Array(0);
  const buf = await file
    .slice(start, Math.min(end, file.size))
    .arrayBuffer();
  return new Uint8Array(buf);
}

/** Little-endian readers — used by every binary parser in the lab. */
export function u16le(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}
export function u32le(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}
export function u32be(b: Uint8Array, o: number): number {
  return (
    ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
  );
}
export function u16be(b: Uint8Array, o: number): number {
  return ((b[o] << 8) | b[o + 1]) >>> 0;
}
export function u64le(b: Uint8Array, o: number): bigint {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[o + i]);
  return v;
}
export function asciiAt(b: Uint8Array, o: number, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) {
    const c = b[o + i];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}
export function hexAt(b: Uint8Array, o: number, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++)
    s += b[o + i].toString(16).padStart(2, "0").toUpperCase();
  return s;
}
