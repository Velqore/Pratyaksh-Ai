// NTFS triage parser. Reads the boot sector, locates $MFT, walks the first
// few hundred MFT records, and surfaces filenames (including unallocated /
// deleted ones, recognised by the Flags field of the record header).
//
// We deliberately implement only what's needed to enumerate filenames for
// triage; full NTFS data-stream extraction would balloon the implementation.

import { BlockDevice } from "./block-device";
import { u16le, u32le, u64le } from "../common/byte-reader";

export interface NtfsFile {
  /** MFT record number. */
  recordId: number;
  name: string;
  isDir: boolean;
  /** True when the record is unallocated (deleted). */
  deleted: boolean;
  size: number;
  parentId?: number;
  /** Win32 / DOS / posix from $FILE_NAME header. */
  namespace: string;
}

export interface NtfsVolume {
  oemName: string;
  bytesPerSector: number;
  sectorsPerCluster: number;
  mftCluster: number;
  mftBytesPerRecord: number;
  serialNumber: string;
  files: NtfsFile[];
  notes: string[];
}

const NAMESPACE: Record<number, string> = {
  0: "POSIX",
  1: "Win32",
  2: "DOS",
  3: "Win32+DOS",
};

function fixupRecord(rec: Uint8Array, sectorSize: number) {
  // NTFS multi-sector header fixup. The Update Sequence Array overwrites
  // the last two bytes of every sector with a sequence number; the original
  // bytes are stored in the USA. We restore them so subsequent reads see the
  // real on-disk values.
  if (rec.length < 8) return;
  const usaOffset = u16le(rec, 4);
  const usaCount = u16le(rec, 6);
  if (usaCount === 0 || usaOffset + usaCount * 2 > rec.length) return;
  const sectors = usaCount - 1;
  for (let i = 0; i < sectors; i++) {
    const sectorEnd = (i + 1) * sectorSize;
    if (sectorEnd > rec.length) break;
    rec[sectorEnd - 2] = rec[usaOffset + 2 + i * 2];
    rec[sectorEnd - 1] = rec[usaOffset + 3 + i * 2];
  }
}

interface ParsedRecord {
  fileName?: string;
  parentId?: number;
  namespace?: number;
  isDir?: boolean;
  size?: number;
}

function parseAttributes(rec: Uint8Array): ParsedRecord {
  const out: ParsedRecord = {};
  const flags = u16le(rec, 22);
  out.isDir = (flags & 0x02) !== 0;
  const firstAttrOff = u16le(rec, 20);
  let off = firstAttrOff;
  while (off + 4 < rec.length) {
    const type = u32le(rec, off);
    if (type === 0xffffffff) break;
    const length = u32le(rec, off + 4);
    if (length === 0 || off + length > rec.length) break;
    const nonResident = rec[off + 8];
    if (type === 0x30 && nonResident === 0) {
      // $FILE_NAME (resident only — most are)
      const valOff = u16le(rec, off + 20);
      const valLen = u32le(rec, off + 16);
      const start = off + valOff;
      if (start + 0x42 < rec.length && start + valLen <= rec.length) {
        const parent = Number(u64le(rec, start) & ((1n << 48n) - 1n));
        const allocSize = Number(u64le(rec, start + 0x28));
        const realSize = Number(u64le(rec, start + 0x30));
        const nameLength = rec[start + 0x40];
        const namespace = rec[start + 0x41];
        let name = "";
        for (let i = 0; i < nameLength; i++) {
          const cOff = start + 0x42 + i * 2;
          if (cOff + 1 >= rec.length) break;
          name += String.fromCharCode(rec[cOff] | (rec[cOff + 1] << 8));
        }
        // Prefer Win32/Win32+DOS over DOS-only namespace
        const prevNs = out.namespace ?? -1;
        if (prevNs === -1 || namespace === 1 || namespace === 3) {
          out.fileName = name;
          out.parentId = parent;
          out.namespace = namespace;
          out.size = realSize || allocSize;
        }
      }
    }
    off += length;
  }
  return out;
}

export async function readNtfsVolume(
  dev: BlockDevice,
  startOffset: number,
  partitionSize: number,
  maxRecords = 256,
): Promise<NtfsVolume | null> {
  const boot = await dev.read(startOffset, 512);
  if (boot.length < 512) return null;
  // OEM ID must be "NTFS    "
  const oem = String.fromCharCode(...boot.slice(3, 11));
  if (oem.trim() !== "NTFS") return null;

  const bytesPerSector = u16le(boot, 11);
  const sectorsPerCluster = boot[13];
  const mftCluster = Number(u64le(boot, 0x30));
  const mftClustersPerRecRaw = boot[0x40] | 0;
  // If positive: clusters per record. If negative (sign-bit set): 2^|raw| bytes.
  const mftClustersPerRec = mftClustersPerRecRaw < 128 ? mftClustersPerRecRaw : mftClustersPerRecRaw - 256;
  const clusterBytes = bytesPerSector * sectorsPerCluster;
  const recordBytes =
    mftClustersPerRec > 0 ? mftClustersPerRec * clusterBytes : 1 << -mftClustersPerRec;
  const serial = u64le(boot, 0x48).toString(16).toUpperCase();

  const mftStart = startOffset + mftCluster * clusterBytes;
  const notes: string[] = [
    `NTFS, sector=${bytesPerSector} B, cluster=${clusterBytes} B, MFT@LCN ${mftCluster} (${recordBytes} B/record).`,
  ];

  const files: NtfsFile[] = [];
  const limit = Math.min(maxRecords, Math.floor(partitionSize / recordBytes));
  for (let i = 0; i < limit; i++) {
    const recOff = mftStart + i * recordBytes;
    if (recOff + recordBytes > startOffset + partitionSize) break;
    const rec = await dev.read(recOff, recordBytes);
    if (rec.length < recordBytes) break;
    const sig = String.fromCharCode(rec[0], rec[1], rec[2], rec[3]);
    if (sig !== "FILE") continue;
    fixupRecord(rec, bytesPerSector);
    const flags = u16le(rec, 22);
    const allocated = (flags & 0x01) !== 0;
    const parsed = parseAttributes(rec);
    if (!parsed.fileName) continue;
    files.push({
      recordId: i,
      name: parsed.fileName,
      isDir: !!parsed.isDir,
      deleted: !allocated,
      size: parsed.size ?? 0,
      parentId: parsed.parentId,
      namespace: NAMESPACE[parsed.namespace ?? 1] ?? "Unknown",
    });
  }

  const deletedCount = files.filter((f) => f.deleted).length;
  if (deletedCount > 0) {
    notes.push(`${deletedCount} unallocated $MFT entries — names are recoverable.`);
  }

  return {
    oemName: oem.trim(),
    bytesPerSector,
    sectorsPerCluster,
    mftCluster,
    mftBytesPerRecord: recordBytes,
    serialNumber: serial,
    files,
    notes,
  };
}
