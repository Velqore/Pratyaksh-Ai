// Disk imaging orchestrator. Given a raw disk image (.dd/.img/.iso), this
// reads the partition table, then for each partition probes the filesystem
// (FAT/NTFS/ext) and lists the root directory. Designed for triage: we
// surface filenames + sizes + deleted-marker so an examiner can decide
// whether to escalate to a heavier tool.

import { BlockDevice } from "./block-device";
import { readPartitionTable, type PartitionTable, type Partition } from "./mbr-gpt";
import { readFatVolume, type FatVolume } from "./fat";
import { readNtfsVolume, type NtfsVolume } from "./ntfs";
import { readExtVolume, type ExtVolume } from "./ext";
import type { CaseModeResult, ModeFinding, ModeProgress } from "../common/types";
import { sortFindings } from "../common/types";

export type FilesystemView =
  | { kind: "fat"; volume: FatVolume }
  | { kind: "ntfs"; volume: NtfsVolume }
  | { kind: "ext"; volume: ExtVolume }
  | { kind: "unknown"; reason: string };

export interface DiskPartitionView {
  partition: Partition;
  filesystem: FilesystemView;
}

export interface DiskAnalysisPayload {
  imageSize: number;
  table: PartitionTable;
  views: DiskPartitionView[];
}

async function probeFilesystem(
  dev: BlockDevice,
  p: Partition,
): Promise<FilesystemView> {
  // FAT BPB OEM ID is at offset 3..10. Try in order: FAT, NTFS, ext.
  const head = await dev.read(p.start, 512);
  if (head.length < 512) {
    return { kind: "unknown", reason: "Partition smaller than 512 bytes" };
  }
  const oem = String.fromCharCode(...head.slice(3, 11));
  if (oem.trim() === "NTFS") {
    const v = await readNtfsVolume(dev, p.start, p.size);
    if (v) return { kind: "ntfs", volume: v };
  }
  // FAT BPB heuristic: bytes-per-sector is 512/1024/2048/4096 and sectors-per-cluster is power of two.
  const bps = head[11] | (head[12] << 8);
  const spc = head[13];
  if (
    (bps === 512 || bps === 1024 || bps === 2048 || bps === 4096) &&
    spc !== 0 &&
    (spc & (spc - 1)) === 0
  ) {
    const v = await readFatVolume(dev, p.start, p.size);
    if (v) return { kind: "fat", volume: v };
  }
  // ext: superblock at +1024 with magic 0xEF53
  const sb = await dev.read(p.start + 1024, 4);
  if (sb.length === 4) {
    // magic at offset 0x38 of SB; we need a longer read
    const sb2 = await dev.read(p.start + 1024, 0x40);
    if (sb2.length >= 0x40 && sb2[0x38] === 0x53 && sb2[0x39] === 0xef) {
      const v = await readExtVolume(dev, p.start, p.size);
      if (v) return { kind: "ext", volume: v };
    }
  }
  return { kind: "unknown", reason: `OEM=${oem.trim() || "(none)"}, bps=${bps}, spc=${spc}` };
}

export async function analyzeDiskImage(
  file: File,
  onProgress?: ModeProgress,
): Promise<CaseModeResult<DiskAnalysisPayload>> {
  const t0 = performance.now();
  onProgress?.("Opening image as block device", 0.05);
  const dev = new BlockDevice(file);
  onProgress?.("Reading partition table", 0.15);
  const table = await readPartitionTable(dev);

  const views: DiskPartitionView[] = [];
  const findings: ModeFinding[] = [];

  for (let i = 0; i < table.partitions.length; i++) {
    const p = table.partitions[i];
    onProgress?.(
      `Probing partition ${i + 1}/${table.partitions.length} (${p.typeName})`,
      0.2 + (0.7 * i) / Math.max(1, table.partitions.length),
    );
    const fs = await probeFilesystem(dev, p);
    views.push({ partition: p, filesystem: fs });

    if (fs.kind === "fat") {
      const dCount = fs.volume.entries.filter((e) => e.deleted).length;
      if (dCount > 0)
        findings.push({
          title: `${dCount} recoverable deleted entries on ${fs.volume.fsType} partition #${p.index}`,
          severity: "med",
          where: `${fs.volume.fsType} root, label=${fs.volume.volumeLabel || "(none)"}`,
          detail: "Short-name records with first byte 0xE5 — filenames remain in the directory until the slot is reused.",
        });
      const exeOnly = fs.volume.entries.filter((e) =>
        /\.(exe|dll|bat|cmd|ps1|vbs|js)$/i.test(e.shortName),
      );
      if (exeOnly.length > 5)
        findings.push({
          title: `${exeOnly.length} executables in root of ${fs.volume.fsType} partition #${p.index}`,
          severity: "low",
          detail: "Numerous executables in the volume root may indicate a staging directory.",
        });
    }
    if (fs.kind === "ntfs") {
      const dCount = fs.volume.files.filter((f) => f.deleted).length;
      if (dCount > 0)
        findings.push({
          title: `${dCount} unallocated MFT records on NTFS partition #${p.index}`,
          severity: "med",
          where: `MFT @ LCN ${fs.volume.mftCluster}`,
          detail: "Filenames remain readable in the $MFT until the record is overwritten.",
        });
    }
    if (fs.kind === "ext") {
      const dCount = fs.volume.files.filter((f) => f.deleted).length;
      if (dCount > 0)
        findings.push({
          title: `${dCount} root entries with non-zero dtime on ${fs.volume.fsType} partition #${p.index}`,
          severity: "med",
          detail: "ext stores deletion-time on the inode; non-zero dtime is a deletion indicator.",
        });
    }
  }

  if (table.partitions.length === 0) {
    findings.push({
      title: "No partitions enumerated",
      severity: "info",
      detail:
        "The image either lacks a partition table or uses an unsupported scheme (LVM, BSD disklabel, full-disk encryption).",
    });
  }
  if (table.scheme === "GPT")
    findings.push({
      title: `GPT scheme — disk GUID ${table.diskId}`,
      severity: "info",
    });
  else if (table.scheme === "MBR")
    findings.push({
      title: `MBR scheme — signature 0x${table.diskId}`,
      severity: "info",
    });

  const t1 = performance.now();
  onProgress?.("Disk image triage complete", 1);

  const headline =
    table.scheme === "none"
      ? "No recognised partition table"
      : `${table.scheme} disk with ${table.partitions.length} partition(s); ${
          views.filter((v) => v.filesystem.kind !== "unknown").length
        } filesystem(s) identified`;

  return {
    mode: "disk",
    modeLabel: "Disk Imaging",
    durationMs: Math.round(t1 - t0),
    headline,
    findings: sortFindings(findings),
    payload: { imageSize: file.size, table, views },
    methodology: [
      "Open the upload as a random-access BlockDevice using File.slice (no full-image RAM read).",
      "Parse the MBR; if a 0xEE protective MBR is found, walk the GPT header at LBA 1.",
      "For each partition, sniff the boot sector / superblock and dispatch to the FAT, NTFS, or ext parser.",
      "List directory entries; flag deletion markers (0xE5 short-name byte for FAT, unallocated record flag for $MFT, non-zero dtime for ext).",
    ],
  };
}
