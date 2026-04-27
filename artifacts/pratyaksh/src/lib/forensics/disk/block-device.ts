// `BlockDevice` — a thin random-access wrapper over a `File`. Filesystem
// parsers ask for byte ranges and we hand them a `Uint8Array` cut from the
// original blob without ever loading the full image into memory.
//
// All disk parsers consume this interface, so the same code works for
// raw .dd / .img / .iso files. (.E01 / .EWF would require a Z-stream
// decoder; out of scope.)

import { readRange } from "../common/byte-reader";

export class BlockDevice {
  readonly file: File;
  readonly size: number;

  constructor(file: File) {
    this.file = file;
    this.size = file.size;
  }

  /** Read [offset, offset+length) clamped to the device size. */
  async read(offset: number, length: number): Promise<Uint8Array> {
    if (offset >= this.size) return new Uint8Array(0);
    const end = Math.min(offset + length, this.size);
    return readRange(this.file, offset, end);
  }

  /** Read a single 512-byte sector. */
  async sector(lba: number): Promise<Uint8Array> {
    return this.read(lba * 512, 512);
  }
}
