// Real cryptographic hashing using hash-wasm streaming hashers.
// All four algorithms (MD5, SHA-1, SHA-256, SHA-512) read the file in fixed
// chunks and feed each chunk into a streaming WASM hasher. Memory usage stays
// bounded regardless of file size and the event loop yields between chunks so
// the UI never freezes — even on multi-GB evidence files.
import { md5 } from "js-md5";
import {
  createSHA1,
  createSHA256,
  createSHA512,
  createMD5 as createMD5Wasm,
  type IHasher,
} from "hash-wasm";

export type HashAlgorithm = "MD5" | "SHA-1" | "SHA-256" | "SHA-512";

export interface FileHashes {
  md5: string;
  sha1: string;
  sha256: string;
  sha512: string;
}

const CHUNK_SIZE = 1024 * 1024; // 1 MiB — small enough to stay snappy

async function makeHasher(algo: HashAlgorithm): Promise<IHasher> {
  switch (algo) {
    case "MD5":
      return createMD5Wasm();
    case "SHA-1":
      return createSHA1();
    case "SHA-256":
      return createSHA256();
    case "SHA-512":
      return createSHA512();
  }
}

// Stream a file through a hash-wasm hasher in CHUNK_SIZE blocks. Yields
// control to the event loop after every chunk so the main thread stays
// responsive; reports progress as a fraction in [0,1].
async function streamHash(
  file: File,
  algo: HashAlgorithm,
  onProgress?: (frac: number) => void,
): Promise<string> {
  const hasher = await makeHasher(algo);
  hasher.init();
  const total = file.size || 1;
  let read = 0;
  for (let off = 0; off < file.size; off += CHUNK_SIZE) {
    const slice = file.slice(off, Math.min(off + CHUNK_SIZE, file.size));
    const buf = await slice.arrayBuffer();
    hasher.update(new Uint8Array(buf));
    read += buf.byteLength;
    if (onProgress) onProgress(read / total);
    // Yield to the event loop so the UI can repaint between chunks.
    await new Promise((r) => setTimeout(r, 0));
  }
  return hasher.digest("hex");
}

export async function digestFile(
  file: File,
  algo: HashAlgorithm,
  onProgress?: (frac: number) => void,
): Promise<string> {
  return streamHash(file, algo, onProgress);
}

export async function computeAllHashes(
  file: File,
  onProgress?: (label: string, frac: number) => void,
): Promise<FileHashes> {
  // Run hashers sequentially: they are all CPU-bound on the main thread, so
  // running them serially is faster overall than parallel + context-switch.
  // Each hasher reports its own per-algorithm progress fraction.
  const md5Hex = await streamHash(file, "MD5", (f) => onProgress?.("MD5", f));
  const sha1Hex = await streamHash(file, "SHA-1", (f) =>
    onProgress?.("SHA-1", f),
  );
  const sha256Hex = await streamHash(file, "SHA-256", (f) =>
    onProgress?.("SHA-256", f),
  );
  const sha512Hex = await streamHash(file, "SHA-512", (f) =>
    onProgress?.("SHA-512", f),
  );
  return { md5: md5Hex, sha1: sha1Hex, sha256: sha256Hex, sha512: sha512Hex };
}

// Verify a known hash matches the freshly computed one (chain-of-custody check).
export async function verifyHash(
  file: File,
  algorithm: HashAlgorithm,
  expected: string,
): Promise<boolean> {
  const computed = await streamHash(file, algorithm);
  return computed.toLowerCase() === expected.toLowerCase();
}

// Pure-JS MD5 of an ArrayBuffer (used by helpers that already have bytes
// in memory, e.g. PE header dumps). Kept as a thin wrapper over js-md5.
export function md5OfBuffer(buf: ArrayBuffer | Uint8Array): string {
  const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return md5(view);
}
