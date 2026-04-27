// Best-effort EVTX (Windows Event Log) inspection. Full EVTX parsing
// requires walking the binary XML template database — that's a heavyweight
// implementation. Here we recognise the file by signature and surface chunk
// + record counts plus Event IDs gleaned from binary XML literal token
// strings ("EventID", "Provider Name="), enough for triage.

import { readChunks, asciiAt, u32le } from "../common/byte-reader";

export interface EvtxSummary {
  isEvtx: boolean;
  fileMagic: string;
  fileSizeBytes: number;
  chunks: number;
  totalRecords: number;
  /** Best-effort EventID histogram extracted from string tokens. */
  eventIdHistogram: Array<{ id: number; count: number }>;
  notes: string[];
}

export async function summarizeEvtx(file: File): Promise<EvtxSummary> {
  const head = new Uint8Array(await file.slice(0, 128).arrayBuffer());
  const magic = asciiAt(head, 0, 7);
  if (magic !== "ElfFile") {
    return {
      isEvtx: false,
      fileMagic: magic,
      fileSizeBytes: file.size,
      chunks: 0,
      totalRecords: 0,
      eventIdHistogram: [],
      notes: ["File magic 'ElfFile\\0' missing — not an EVTX file."],
    };
  }
  // EVTX file header is 4096 bytes; 'NumberOfChunks' at offset 0x2A (UInt16)
  // not strictly relied on (often zero on unfinalised logs); we'll count
  // chunks ourselves.
  let chunks = 0;
  let records = 0;
  const evtIds = new Map<number, number>();
  const decoder = new TextDecoder("utf-16le", { fatal: false });
  await readChunks(file, async (chunk) => {
    // Each ElfChnk header is 0x200 bytes starting with "ElfChnk\0"
    for (let i = 0; i + 8 <= chunk.length; i++) {
      if (
        chunk[i] === 0x45 && chunk[i + 1] === 0x6c && chunk[i + 2] === 0x66 &&
        chunk[i + 3] === 0x43 && chunk[i + 4] === 0x68 && chunk[i + 5] === 0x6e &&
        chunk[i + 6] === 0x6b && chunk[i + 7] === 0x00
      ) {
        chunks++;
      }
    }
    // Record signature is 0x2A2A0000 (LE)
    for (let i = 0; i + 4 <= chunk.length; i++) {
      if (
        chunk[i] === 0x2a && chunk[i + 1] === 0x2a &&
        chunk[i + 2] === 0x00 && chunk[i + 3] === 0x00
      ) {
        records++;
      }
    }
    // Best-effort EventID extraction: look for the UTF-16LE string "EventID"
    // followed within ~64 bytes by a 0x06 (UInt16Type) marker and a 16-bit value.
    const text = decoder.decode(chunk);
    let p = 0;
    while ((p = text.indexOf("EventID", p)) !== -1) {
      // Search the next ~64 chars (128 bytes) of source for a numeric literal.
      // Simpler: read 16-bit values from the byte buffer at the offset where
      // "EventID" starts in the chunk and look for a plausible value.
      // Map text index → byte index: each utf-16le code unit is 2 bytes; index in `text`
      // approximates index/2 in `chunk` but only when characters are BMP. Good enough for triage.
      const byteOff = p * 2;
      for (let off = byteOff + 14; off < Math.min(byteOff + 128, chunk.length - 4); off += 2) {
        const v = u32le(chunk, off);
        // Common Windows event IDs are < 65536 and non-zero.
        const id = v & 0xffff;
        if (id > 0 && id < 65536 && (v >>> 16) === 0) {
          evtIds.set(id, (evtIds.get(id) ?? 0) + 1);
          break;
        }
      }
      p += 7;
    }
  }, { yieldEvery: 8 });

  const histogram = Array.from(evtIds.entries())
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  const notes: string[] = [
    "EVTX is binary-XML; chunk and record counts are derived from signature scans rather than full template decoding.",
  ];
  if (records === 0)
    notes.push("No record signatures (0x2A2A0000) located — log may be empty or corrupt.");

  return {
    isEvtx: true,
    fileMagic: magic,
    fileSizeBytes: file.size,
    chunks,
    totalRecords: records,
    eventIdHistogram: histogram,
    notes,
  };
}
