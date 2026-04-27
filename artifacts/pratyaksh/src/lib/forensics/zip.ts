// Generic ZIP archive listing — list contents without extracting payloads.
import JSZip from "jszip";

export interface ZipEntry {
  name: string;
  size: number;
  compressedSize: number;
  isDir: boolean;
  date?: string;
  comment?: string;
}

export interface ZipAnalysis {
  isZip: boolean;
  entryCount: number;
  totalUncompressed: number;
  totalCompressed: number;
  compressionRatio: number;
  entries: ZipEntry[];
  comment?: string;
  notes: string[];
}

export async function analyzeZip(file: File): Promise<ZipAnalysis> {
  const buf = await file.arrayBuffer();
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch (e) {
    return {
      isZip: false,
      entryCount: 0,
      totalUncompressed: 0,
      totalCompressed: 0,
      compressionRatio: 0,
      entries: [],
      notes: [`Not a valid ZIP: ${e instanceof Error ? e.message : "unknown"}`],
    };
  }

  const entries: ZipEntry[] = [];
  let totalUncompressed = 0;
  let totalCompressed = 0;

  // JSZip's internal structure exposes _data with size info. We narrow the
  // shape with a runtime guard so we never reach for unknown properties on
  // an unexpected node type.
  interface JszipInternalData {
    uncompressedSize?: number;
    compressedSize?: number;
  }
  interface JszipObjectInternal {
    _data?: JszipInternalData;
  }
  const readSizes = (f: unknown): JszipInternalData => {
    if (
      typeof f === "object" &&
      f !== null &&
      "_data" in f &&
      typeof (f as JszipObjectInternal)._data === "object"
    ) {
      return (f as JszipObjectInternal)._data ?? {};
    }
    return {};
  };
  for (const name of Object.keys(zip.files)) {
    const f = zip.files[name];
    const internalData = readSizes(f);
    const uncompressed: number = internalData.uncompressedSize ?? 0;
    const compressed: number = internalData.compressedSize ?? 0;
    totalUncompressed += uncompressed;
    totalCompressed += compressed;
    entries.push({
      name,
      size: uncompressed,
      compressedSize: compressed,
      isDir: f.dir,
      date: f.date?.toISOString(),
      comment: f.comment,
    });
  }

  const compressionRatio =
    totalUncompressed > 0 ? totalCompressed / totalUncompressed : 0;

  const notes: string[] = [];
  notes.push(
    `${entries.length} entries, ${(totalUncompressed / 1024).toFixed(
      1,
    )} KB uncompressed → ${(totalCompressed / 1024).toFixed(1)} KB compressed (${(compressionRatio * 100).toFixed(1)}% ratio).`,
  );
  if (
    totalUncompressed > 100 * 1024 * 1024 &&
    compressionRatio < 0.01 &&
    entries.length < 5
  ) {
    notes.push(
      "Possible ZIP bomb pattern: very small compressed payload expanding to a very large size.",
    );
  }
  const suspiciousExt = entries.filter((e) =>
    /\.(exe|dll|bat|cmd|js|vbs|ps1|jar|scr)$/i.test(e.name),
  );
  if (suspiciousExt.length > 0) {
    notes.push(
      `${suspiciousExt.length} executable / script entries inside archive.`,
    );
  }

  return {
    isZip: true,
    entryCount: entries.length,
    totalUncompressed,
    totalCompressed,
    compressionRatio: Number(compressionRatio.toFixed(4)),
    entries: entries.slice(0, 100),
    notes,
  };
}
