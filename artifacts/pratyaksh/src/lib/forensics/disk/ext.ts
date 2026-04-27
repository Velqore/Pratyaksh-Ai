// ext2/3/4 triage parser — reads the superblock, the first block group's
// inode table, and the root directory; flags inodes whose deletion-time is
// non-zero (classic indicator of a deleted file on ext).
//
// As with NTFS this is intentionally a triage-grade parser; full extent-tree
// data extraction is out of scope.

import { BlockDevice } from "./block-device";
import { u16le, u32le } from "../common/byte-reader";

export interface ExtFile {
  inode: number;
  name: string;
  isDir: boolean;
  size: number;
  deleted: boolean;
  modifiedAt?: string;
}

export interface ExtVolume {
  fsType: "ext2" | "ext3" | "ext4";
  blockSize: number;
  inodeSize: number;
  totalInodes: number;
  totalBlocks: number;
  volumeName: string;
  uuid: string;
  files: ExtFile[];
  notes: string[];
}

function uuidFromBytes(b: Uint8Array, o: number): string {
  const h = (i: number) => b[o + i].toString(16).padStart(2, "0");
  return (
    h(0) + h(1) + h(2) + h(3) +
    "-" + h(4) + h(5) +
    "-" + h(6) + h(7) +
    "-" + h(8) + h(9) +
    "-" + h(10) + h(11) + h(12) + h(13) + h(14) + h(15)
  );
}

export async function readExtVolume(
  dev: BlockDevice,
  startOffset: number,
  partitionSize: number,
): Promise<ExtVolume | null> {
  // Superblock lives 1024 bytes into the partition.
  if (partitionSize < 2048) return null;
  const sb = await dev.read(startOffset + 1024, 1024);
  // Magic at 0x38 (LE 0xEF53)
  if (sb[0x38] !== 0x53 || sb[0x39] !== 0xef) return null;

  const inodesCount = u32le(sb, 0x00);
  const blocksCount = u32le(sb, 0x04);
  const logBlockSize = u32le(sb, 0x18);
  const blockSize = 1024 << logBlockSize;
  const inodesPerGroup = u32le(sb, 0x28);
  const inodeSize = u16le(sb, 0x58) || 128;
  const featureIncompat = u32le(sb, 0x60);
  const featureCompat = u32le(sb, 0x5c);
  const featureRoCompat = u32le(sb, 0x64);
  const hasJournal = (featureCompat & 0x4) !== 0;
  const isExt4 = (featureIncompat & 0x40) !== 0 || (featureRoCompat & 0x40) !== 0;
  const fsType: ExtVolume["fsType"] = isExt4
    ? "ext4"
    : hasJournal
      ? "ext3"
      : "ext2";

  const uuid = uuidFromBytes(sb, 0x68);
  const volumeName = String.fromCharCode(...sb.slice(0x78, 0x88))
    .replace(/\0/g, "")
    .trim();

  const notes: string[] = [
    `${fsType}, block=${blockSize} B, ${inodesCount} inodes, ${blocksCount} blocks`,
  ];

  // Block group descriptor 0 lives at the block immediately after the superblock.
  // Block 0 is reserved; SB is in block 0 (1024-byte FS) or in block 1 of a
  // larger-block FS. The descriptor table starts at the next block.
  const bgdOffset =
    startOffset + (blockSize === 1024 ? 2 * blockSize : blockSize);
  const bgdSize =
    (featureIncompat & 0x80) !== 0 ? 64 : 32; // 64-bit feature bit
  const bgd = await dev.read(bgdOffset, bgdSize);
  const inodeTableBlock =
    bgdSize >= 8
      ? u32le(bgd, 0x08) + (bgdSize >= 0x20 ? u32le(bgd, 0x20) * 0x100000000 : 0)
      : 0;
  const inodeTableOffset = startOffset + inodeTableBlock * blockSize;

  // Read inode #2 (root directory) — inodes are 1-indexed.
  const rootInodeIndex = 1; // (inode 2)
  const rootInodeOff = inodeTableOffset + rootInodeIndex * inodeSize;
  const rootInode = await dev.read(rootInodeOff, inodeSize);
  const rootMode = u16le(rootInode, 0x00);
  const rootSize = u32le(rootInode, 0x04);
  const isExtents = (u32le(rootInode, 0x20) & 0xf30a) === 0xf30a;
  // For ext2/3 (no extents), inode block pointers start at offset 0x28 (i_block[0])
  // For ext4 with extents header at i_block[0] (magic 0xF30A), we'd need to walk
  // the extent tree. We try i_block[0] either way as a "first data block" hint.
  const firstBlockPtr = isExtents
    ? u32le(rootInode, 0x28 + 12) // ee_start_lo of first ext_extent
    : u32le(rootInode, 0x28);
  if (rootSize === 0 || firstBlockPtr === 0) {
    notes.push("Root inode has no data block pointer recoverable without full extent walk.");
    return {
      fsType,
      blockSize,
      inodeSize,
      totalInodes: inodesCount,
      totalBlocks: blocksCount,
      volumeName,
      uuid,
      files: [],
      notes,
    };
  }
  const dirBlockOff = startOffset + firstBlockPtr * blockSize;
  const dirBlock = await dev.read(dirBlockOff, Math.min(rootSize, blockSize));

  // Walk linear directory entries
  const files: ExtFile[] = [];
  let o = 0;
  let safety = 4096;
  while (o + 8 < dirBlock.length && safety-- > 0) {
    const inode = u32le(dirBlock, o);
    const recLen = u16le(dirBlock, o + 4);
    const nameLen = dirBlock[o + 6];
    const fileType = dirBlock[o + 7];
    if (recLen < 8 || o + recLen > dirBlock.length) break;
    if (nameLen > 0) {
      const name = String.fromCharCode(...dirBlock.slice(o + 8, o + 8 + nameLen));
      let deleted = false;
      let size = 0;
      let modifiedAt: string | undefined;
      if (inode > 0 && inode <= inodesCount && inode <= inodesPerGroup) {
        const inOff = inodeTableOffset + (inode - 1) * inodeSize;
        const inBuf = await dev.read(inOff, inodeSize);
        const dtime = u32le(inBuf, 0x14);
        const mtime = u32le(inBuf, 0x10);
        size = u32le(inBuf, 0x04);
        deleted = dtime !== 0;
        if (mtime > 0) modifiedAt = new Date(mtime * 1000).toISOString();
      }
      if (name !== "." && name !== "..") {
        files.push({
          inode,
          name,
          isDir: fileType === 2,
          size,
          deleted,
          modifiedAt,
        });
      }
    }
    o += recLen;
  }

  const deletedCount = files.filter((f) => f.deleted).length;
  if (deletedCount > 0) {
    notes.push(`${deletedCount} root entries reference inodes whose dtime is non-zero (deleted).`);
  }
  // Use rootMode somewhere meaningful so it's not dead code:
  if ((rootMode & 0xf000) !== 0x4000) {
    notes.push(`Inode 2 mode 0x${rootMode.toString(16)} is not a directory — partition may be corrupt.`);
  }

  return {
    fsType,
    blockSize,
    inodeSize,
    totalInodes: inodesCount,
    totalBlocks: blocksCount,
    volumeName,
    uuid,
    files,
    notes,
  };
}
