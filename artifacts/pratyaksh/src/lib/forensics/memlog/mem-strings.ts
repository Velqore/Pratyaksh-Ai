// Memory image string extraction with IOC enrichment. Streams the file in
// chunks; for each chunk runs printable-string scans + an IOC regex pass over
// the assembled string set, producing a deduplicated, severity-ranked summary.

import { readChunks } from "../common/byte-reader";
import type { ModeProgress } from "../common/types";
import { extractIOCs, summarizeIOCs } from "../iocs";

const MIN_LEN = 6;
const MAX_STRINGS = 50_000;

export interface MemStrings {
  totalAscii: number;
  totalUtf16: number;
  /** Sample of the longest distinct strings discovered. */
  longest: Array<{ text: string; offset: number; encoding: "ascii" | "utf16" }>;
  iocs: ReturnType<typeof extractIOCs>;
  iocSummary: string[];
}

function scanAscii(
  bytes: Uint8Array,
  baseOffset: number,
  out: Array<{ text: string; offset: number; encoding: "ascii" | "utf16" }>,
): number {
  let count = 0;
  let start = -1;
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    const printable = c >= 0x20 && c < 0x7f;
    if (printable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1 && i - start >= MIN_LEN) {
        count++;
        if (out.length < MAX_STRINGS) {
          let s = "";
          for (let j = start; j < i; j++) s += String.fromCharCode(bytes[j]);
          out.push({ text: s, offset: baseOffset + start, encoding: "ascii" });
        }
      }
      start = -1;
    }
  }
  if (start !== -1 && bytes.length - start >= MIN_LEN) {
    count++;
    if (out.length < MAX_STRINGS) {
      let s = "";
      for (let j = start; j < bytes.length; j++) s += String.fromCharCode(bytes[j]);
      out.push({ text: s, offset: baseOffset + start, encoding: "ascii" });
    }
  }
  return count;
}

function scanUtf16(
  bytes: Uint8Array,
  baseOffset: number,
  out: Array<{ text: string; offset: number; encoding: "ascii" | "utf16" }>,
): number {
  let count = 0;
  let start = -1;
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const lo = bytes[i];
    const hi = bytes[i + 1];
    const printable = hi === 0 && lo >= 0x20 && lo < 0x7f;
    if (printable) {
      if (start === -1) start = i;
    } else {
      if (start !== -1 && (i - start) / 2 >= MIN_LEN) {
        count++;
        if (out.length < MAX_STRINGS) {
          let s = "";
          for (let j = start; j < i; j += 2) s += String.fromCharCode(bytes[j]);
          out.push({ text: s, offset: baseOffset + start, encoding: "utf16" });
        }
      }
      start = -1;
    }
  }
  return count;
}

export async function extractMemoryStrings(
  file: File,
  onProgress?: ModeProgress,
): Promise<MemStrings> {
  const all: Array<{ text: string; offset: number; encoding: "ascii" | "utf16" }> = [];
  let totalAscii = 0;
  let totalUtf16 = 0;
  await readChunks(
    file,
    async (chunk, offset) => {
      totalAscii += scanAscii(chunk, offset, all);
      totalUtf16 += scanUtf16(chunk, offset, all);
    },
    {
      yieldEvery: 4,
      onProgress: (f) => onProgress?.("Scanning strings", f * 0.85),
    },
  );
  // Concatenate all surfaced strings for IOC pass
  const blob = all.map((s) => s.text).join("\n");
  const iocs = extractIOCs(blob);
  // Deduplicate + take the longest 200 strings as a "longest" sample
  const seen = new Set<string>();
  const dedup: typeof all = [];
  for (const s of all) {
    if (seen.has(s.text)) continue;
    seen.add(s.text);
    dedup.push(s);
  }
  dedup.sort((a, b) => b.text.length - a.text.length);
  return {
    totalAscii,
    totalUtf16,
    longest: dedup.slice(0, 200),
    iocs,
    iocSummary: summarizeIOCs(iocs),
  };
}
