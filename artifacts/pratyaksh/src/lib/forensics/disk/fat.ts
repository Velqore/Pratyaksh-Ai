// FAT12 / FAT16 / FAT32 parser. Reads the BPB, walks the root directory and
// (for FAT32) the data clusters of the root, and lists short-name entries
// including those with `0xE5` first-byte (deleted markers) so an examiner
// can see recoverable filenames.
//
// Long filename (LFN, VFAT) entries are decoded best-effort.

import { BlockDevice } from "./block-device";
import { u16le, u32le } from "../common/byte-reader";

export interface FatFileEntry {
  /** Short 8.3 name. */
  shortName: string;
  /** Long filename when present. */
  longName?: string;
  /** True when the first byte was 0xE5. */
  deleted: boolean;
  isDir: boolean;
  isVolume: boolean;
  attr: number;
  size: number;
  startCluster: number;
  /** Best-effort timestamps (FAT date/time format). */
  createdAt?: string;
  modifiedAt?: string;
}

export interface FatVolume {
  fsType: "FAT12" | "FAT16" | "FAT32";
  /** OEM name from BPB. */
  oemName: string;
  bytesPerSector: number;
  sectorsPerCluster: number;
  reservedSectors: number;
  numFats: number;
  totalSectors: number;
  rootDirEntries: number;
  rootDirCluster: number; // FAT32 only
  volumeLabel: string;
  serialNumber: string;
  entries: FatFileEntry[];
  notes: string[];
}

function decodeFatDate(date: number, time: number): string {
  if (date === 0) return "";
  const day = date & 0x1f;
  const month = (date >> 5) & 0x0f;
  const year = ((date >> 9) & 0x7f) + 1980;
  const sec = (time & 0x1f) * 2;
  const min = (time >> 5) & 0x3f;
  const hr = (time >> 11) & 0x1f;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function decodeShortName(b: Uint8Array, o: number): string {
  const namePart = String.fromCharCode(...b.slice(o, o + 8))
    .replace(/\0/g, "")
    .trim();
  const ext = String.fromCharCode(...b.slice(o + 8, o + 11))
    .replace(/\0/g, "")
    .trim();
  return ext ? `${namePart}.${ext}` : namePart;
}

function decodeLfnFragment(b: Uint8Array, o: number): string {
  // 5 chars at +1, 6 chars at +14, 2 chars at +28
  const segs: number[] = [];
  for (let i = 0; i < 5; i++) segs.push(b[o + 1 + i * 2] | (b[o + 2 + i * 2] << 8));
  for (let i = 0; i < 6; i++) segs.push(b[o + 14 + i * 2] | (b[o + 15 + i * 2] << 8));
  for (let i = 0; i < 2; i++) segs.push(b[o + 28 + i * 2] | (b[o + 29 + i * 2] << 8));
  let out = "";
  for (const c of segs) {
    if (c === 0 || c === 0xffff) break;
    out += String.fromCharCode(c);
  }
  return out;
}

function parseDirSectors(buf: Uint8Array, maxEntries: number): FatFileEntry[] {
  const entries: FatFileEntry[] = [];
  const lfnBuf: string[] = [];
  const limit = Math.min(buf.length, maxEntries * 32);
  for (let o = 0; o < limit; o += 32) {
    const first = buf[o];
    if (first === 0x00) break; // end of dir
    const attr = buf[o + 11];
    if (attr === 0x0f) {
      // LFN entry (sequence in buf[o] but we ignore strict ordering — concat in reverse)
      const frag = decodeLfnFragment(buf, o);
      lfnBuf.unshift(frag);
      continue;
    }
    const deleted = first === 0xe5;
    const shortName = decodeShortName(buf, o);
    if (!shortName && !deleted) {
      lfnBuf.length = 0;
      continue;
    }
    const startHi = u16le(buf, o + 20);
    const startLo = u16le(buf, o + 26);
    const startCluster = ((startHi << 16) | startLo) >>> 0;
    const size = u32le(buf, o + 28);
    const cTime = u16le(buf, o + 14);
    const cDate = u16le(buf, o + 16);
    const mTime = u16le(buf, o + 22);
    const mDate = u16le(buf, o + 24);
    entries.push({
      shortName: deleted ? `?${shortName.slice(1)}` : shortName,
      longName: lfnBuf.length > 0 ? lfnBuf.join("") : undefined,
      deleted,
      isDir: (attr & 0x10) !== 0,
      isVolume: (attr & 0x08) !== 0,
      attr,
      size,
      startCluster,
      createdAt: decodeFatDate(cDate, cTime) || undefined,
      modifiedAt: decodeFatDate(mDate, mTime) || undefined,
    });
    lfnBuf.length = 0;
  }
  return entries;
}

export async function readFatVolume(
  dev: BlockDevice,
  startOffset: number,
  partitionSize: number,
): Promise<FatVolume | null> {
  const boot = await dev.read(startOffset, 512);
  if (boot.length < 512) return null;
  // Boot signature
  if (boot[510] !== 0x55 || boot[511] !== 0xaa) {
    // Some FAT12 floppies omit it — keep going
  }
  const bytesPerSector = u16le(boot, 11);
  const sectorsPerCluster = boot[13];
  if (
    bytesPerSector !== 512 &&
    bytesPerSector !== 1024 &&
    bytesPerSector !== 2048 &&
    bytesPerSector !== 4096
  ) {
    return null;
  }
  if (sectorsPerCluster === 0) return null;
  const reservedSectors = u16le(boot, 14);
  const numFats = boot[16];
  const rootDirEntries = u16le(boot, 17);
  const totalSectors16 = u16le(boot, 19);
  const fatSize16 = u16le(boot, 22);
  const totalSectors32 = u32le(boot, 32);
  const fatSize32 = u32le(boot, 36);
  const rootCluster = u32le(boot, 44); // FAT32
  const totalSectors = totalSectors16 || totalSectors32;
  const fatSize = fatSize16 || fatSize32;
  const rootDirSectors = Math.ceil((rootDirEntries * 32) / bytesPerSector);
  const dataSectors =
    totalSectors - (reservedSectors + numFats * fatSize + rootDirSectors);
  const totalClusters = Math.floor(dataSectors / sectorsPerCluster);

  let fsType: "FAT12" | "FAT16" | "FAT32";
  if (totalClusters < 4085) fsType = "FAT12";
  else if (totalClusters < 65525) fsType = "FAT16";
  else fsType = "FAT32";

  const oemName = String.fromCharCode(...boot.slice(3, 11)).trim();

  // Volume label + serial — different offsets per FS type
  let volumeLabel = "";
  let serial = "";
  if (fsType === "FAT32") {
    serial = u32le(boot, 67).toString(16).toUpperCase().padStart(8, "0");
    volumeLabel = String.fromCharCode(...boot.slice(71, 82)).trim();
  } else {
    serial = u32le(boot, 39).toString(16).toUpperCase().padStart(8, "0");
    volumeLabel = String.fromCharCode(...boot.slice(43, 54)).trim();
  }

  const notes: string[] = [
    `${fsType}, ${bytesPerSector} B/sector, ${sectorsPerCluster} sectors/cluster, ${totalClusters} clusters total`,
  ];

  let entries: FatFileEntry[] = [];

  if (fsType === "FAT32") {
    // Walk the root directory's cluster chain (just the first cluster for triage)
    const fatStart = startOffset + reservedSectors * bytesPerSector;
    const dataStart =
      startOffset +
      (reservedSectors + numFats * fatSize) * bytesPerSector;
    const clusterBytes = sectorsPerCluster * bytesPerSector;
    const clusterOffset = (cluster: number) =>
      dataStart + (cluster - 2) * clusterBytes;
    const visited = new Set<number>();
    let cur = rootCluster;
    let safety = 64;
    while (cur >= 2 && cur < 0x0ffffff8 && safety-- > 0 && !visited.has(cur)) {
      visited.add(cur);
      const off = clusterOffset(cur);
      if (off + clusterBytes > startOffset + partitionSize) break;
      const buf = await dev.read(off, clusterBytes);
      const dir = parseDirSectors(buf, clusterBytes / 32);
      entries.push(...dir);
      // Next cluster from FAT
      const fatEntryOff = fatStart + cur * 4;
      const fatEntry = await dev.read(fatEntryOff, 4);
      cur = u32le(fatEntry, 0) & 0x0fffffff;
    }
  } else {
    // FAT12/16: root directory is a fixed area between FAT(s) and data
    const rootStart =
      startOffset +
      (reservedSectors + numFats * fatSize) * bytesPerSector;
    const rootBytes = rootDirEntries * 32;
    const buf = await dev.read(rootStart, rootBytes);
    entries = parseDirSectors(buf, rootDirEntries);
  }

  const deletedCount = entries.filter((e) => e.deleted).length;
  if (deletedCount > 0) {
    notes.push(`${deletedCount} deleted directory entries recoverable from root.`);
  }

  return {
    fsType,
    oemName,
    bytesPerSector,
    sectorsPerCluster,
    reservedSectors,
    numFats,
    totalSectors,
    rootDirEntries,
    rootDirCluster: rootCluster,
    volumeLabel,
    serialNumber: serial,
    entries,
    notes,
  };
}
