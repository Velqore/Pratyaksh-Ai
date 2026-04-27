// MBR + GPT partition table parsing. Both formats are well-defined; the
// trickiest part is recognising a "protective MBR" that fronts a GPT.

import { BlockDevice } from "./block-device";
import { u16le, u32le, u64le, hexAt } from "../common/byte-reader";

export interface Partition {
  /** 1-based partition index. */
  index: number;
  /** Partition type GUID (GPT) or hex type code (MBR). */
  type: string;
  /** Human-readable label. */
  typeName: string;
  /** Partition name (GPT only) or empty. */
  name: string;
  /** Starting byte offset on the device. */
  start: number;
  /** Length in bytes. */
  size: number;
  /** Source format. */
  source: "MBR" | "GPT";
  /** True when bootable (MBR) or has the LegacyBIOSBootable flag (GPT). */
  bootable: boolean;
}

export interface PartitionTable {
  scheme: "MBR" | "GPT" | "none";
  /** Disk identifier — MBR signature or GPT disk GUID. */
  diskId: string;
  partitions: Partition[];
  notes: string[];
}

const MBR_TYPES: Record<number, string> = {
  0x00: "Empty",
  0x01: "FAT12",
  0x04: "FAT16 <32MB",
  0x05: "Extended (CHS)",
  0x06: "FAT16",
  0x07: "NTFS / exFAT / IFS",
  0x0b: "FAT32 (CHS)",
  0x0c: "FAT32 (LBA)",
  0x0e: "FAT16 (LBA)",
  0x0f: "Extended (LBA)",
  0x11: "Hidden FAT12",
  0x14: "Hidden FAT16 <32MB",
  0x16: "Hidden FAT16",
  0x17: "Hidden NTFS",
  0x1b: "Hidden FAT32 (CHS)",
  0x1c: "Hidden FAT32 (LBA)",
  0x27: "Windows Recovery",
  0x82: "Linux swap / Solaris",
  0x83: "Linux native (ext*/xfs/btrfs)",
  0x85: "Linux extended",
  0x8e: "Linux LVM",
  0xa5: "FreeBSD",
  0xa6: "OpenBSD",
  0xa9: "NetBSD",
  0xaf: "macOS HFS+",
  0xee: "GPT protective MBR",
  0xef: "EFI system partition",
  0xfb: "VMware VMFS",
  0xfd: "Linux RAID auto",
};

const GPT_TYPES: Record<string, string> = {
  "00000000-0000-0000-0000-000000000000": "Unused",
  "C12A7328-F81F-11D2-BA4B-00A0C93EC93B": "EFI System Partition",
  "EBD0A0A2-B9E5-4433-87C0-68B6B72699C7": "Microsoft Basic Data",
  "E3C9E316-0B5C-4DB8-817D-F92DF00215AE": "Microsoft Reserved",
  "DE94BBA4-06D1-4D40-A16A-BFD50179D6AC": "Windows Recovery",
  "0FC63DAF-8483-4772-8E79-3D69D8477DE4": "Linux Filesystem",
  "0657FD6D-A4AB-43C4-84E5-0933C84B4F4F": "Linux Swap",
  "E6D6D379-F507-44C2-A23C-238F2A3DF928": "Linux LVM",
  "48465300-0000-11AA-AA11-00306543ECAC": "Apple HFS+",
  "7C3457EF-0000-11AA-AA11-00306543ECAC": "Apple APFS",
  "21686148-6449-6E6F-744E-656564454649": "BIOS Boot Partition",
};

function guidLE(b: Uint8Array, o: number): string {
  // GPT GUIDs are stored mixed-endian: first 3 fields little-endian, last 2 big-endian.
  const hex = hexAt(b, o, 16);
  const part = (start: number, end: number) => hex.slice(start, end);
  // Field 1: bytes 0..3 (4 bytes) reversed
  const p1 = part(6, 8) + part(4, 6) + part(2, 4) + part(0, 2);
  const p2 = part(10, 12) + part(8, 10);
  const p3 = part(14, 16) + part(12, 14);
  const p4 = part(16, 20);
  const p5 = part(20, 32);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`.toUpperCase();
}

function utf16leAt(b: Uint8Array, o: number, n: number): string {
  let s = "";
  for (let i = 0; i < n; i += 2) {
    const c = b[o + i] | (b[o + i + 1] << 8);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

export async function readPartitionTable(
  dev: BlockDevice,
): Promise<PartitionTable> {
  const notes: string[] = [];
  if (dev.size < 512) {
    return { scheme: "none", diskId: "", partitions: [], notes: ["Image too small for an MBR"] };
  }
  const mbr = await dev.read(0, 512);
  // Boot signature 0x55AA at offset 510..511
  const validSig = mbr[510] === 0x55 && mbr[511] === 0xaa;
  if (!validSig) {
    notes.push(
      `MBR boot signature missing (got 0x${mbr[510].toString(16)}${mbr[511].toString(16)} at 0x1FE) — image may not be partitioned.`,
    );
  }

  // Disk signature at 0x1B8 (4 bytes LE) for MBR
  const diskSig = u32le(mbr, 0x1b8).toString(16).padStart(8, "0").toUpperCase();

  const parts: Partition[] = [];
  let isProtectiveGpt = false;

  for (let i = 0; i < 4; i++) {
    const o = 0x1be + i * 16;
    const status = mbr[o];
    const type = mbr[o + 4];
    const startLba = u32le(mbr, o + 8);
    const sizeLba = u32le(mbr, o + 12);
    if (type === 0x00) continue;
    if (type === 0xee) isProtectiveGpt = true;
    parts.push({
      index: i + 1,
      type: `0x${type.toString(16).padStart(2, "0").toUpperCase()}`,
      typeName: MBR_TYPES[type] ?? "Unknown",
      name: "",
      start: startLba * 512,
      size: sizeLba * 512,
      source: "MBR",
      bootable: status === 0x80,
    });
  }

  if (isProtectiveGpt && dev.size >= 1024) {
    // GPT header lives at LBA 1
    const hdr = await dev.read(512, 512);
    const sig = String.fromCharCode(...hdr.slice(0, 8));
    if (sig === "EFI PART") {
      const partLba = Number(u64le(hdr, 72));
      const numEntries = u32le(hdr, 80);
      const entrySize = u32le(hdr, 84);
      const diskGuid = guidLE(hdr, 56);
      const tableBytes = numEntries * entrySize;
      const tableBuf = await dev.read(partLba * 512, tableBytes);
      const gptParts: Partition[] = [];
      for (let i = 0; i < numEntries; i++) {
        const o = i * entrySize;
        if (o + entrySize > tableBuf.length) break;
        const typeGuid = guidLE(tableBuf, o);
        if (typeGuid === "00000000-0000-0000-0000-000000000000") continue;
        const firstLba = Number(u64le(tableBuf, o + 32));
        const lastLba = Number(u64le(tableBuf, o + 40));
        const attrs = u64le(tableBuf, o + 48);
        const name = utf16leAt(tableBuf, o + 56, 72);
        gptParts.push({
          index: gptParts.length + 1,
          type: typeGuid,
          typeName: GPT_TYPES[typeGuid] ?? "Unknown",
          name,
          start: firstLba * 512,
          size: (lastLba - firstLba + 1) * 512,
          source: "GPT",
          bootable: (attrs & 4n) !== 0n,
        });
      }
      notes.push(`GPT detected: ${gptParts.length} partition(s).`);
      return {
        scheme: "GPT",
        diskId: diskGuid,
        partitions: gptParts,
        notes,
      };
    }
  }

  if (parts.length === 0 && validSig) {
    notes.push("MBR present but no populated partition entries.");
  }
  return {
    scheme: validSig ? "MBR" : "none",
    diskId: diskSig,
    partitions: parts,
    notes,
  };
}

// Convenience for parsers that need just a 4-byte hex string.
export function partitionLabel(p: Partition): string {
  return p.name && p.name.length > 0 ? p.name : `${p.source} #${p.index}`;
}

// Re-export so callers don't need a second import.
export { u16le };
