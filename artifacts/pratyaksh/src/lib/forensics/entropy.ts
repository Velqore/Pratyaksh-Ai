// Shannon entropy calculation — global plus per-block. The file is streamed
// in fixed chunks via File.slice() so memory usage stays bounded; the event
// loop is yielded between chunks so the UI stays responsive on large files.
//
// Used to flag encryption, compression, packed executables, or stego payloads.

export interface EntropyResult {
  globalEntropy: number; // 0..8 bits per byte
  blockSize: number;
  blockEntropies: number[];
  highEntropyBlocks: number; // count of blocks with entropy > 7.5
  classification: string;
}

const READ_CHUNK = 1024 * 1024; // 1 MiB

function entropyOfHistogram(hist: Uint32Array, total: number): number {
  if (total === 0) return 0;
  let e = 0;
  for (let i = 0; i < 256; i++) {
    const c = hist[i];
    if (c === 0) continue;
    const p = c / total;
    e -= p * Math.log2(p);
  }
  return e;
}

export async function computeEntropy(
  file: File,
  blockSize: number = 1024,
): Promise<EntropyResult> {
  if (file.size === 0) {
    return {
      globalEntropy: 0,
      blockSize,
      blockEntropies: [],
      highEntropyBlocks: 0,
      classification: "Empty file",
    };
  }

  const totalBlocks = Math.ceil(file.size / blockSize);
  // Cap the number of plotted blocks so the chart stays tractable on large
  // files. We compute true entropy on every block but only emit one in
  // `stride` to the result series.
  const stride = Math.max(1, Math.floor(totalBlocks / 256));

  const globalHist = new Uint32Array(256);
  const blockEntropies: number[] = [];
  let highBlocks = 0;

  // We re-use a tiny histogram per block to avoid allocation churn.
  const blockHist = new Uint32Array(256);

  let cursor = 0; // file offset of current chunk
  let blockIdx = 0; // global block index across all chunks
  let blockBytesSoFar = 0; // bytes consumed in current block

  while (cursor < file.size) {
    const end = Math.min(cursor + READ_CHUNK, file.size);
    const slice = file.slice(cursor, end);
    const bytes = new Uint8Array(await slice.arrayBuffer());

    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      globalHist[b]++;
      blockHist[b]++;
      blockBytesSoFar++;
      if (blockBytesSoFar === blockSize || cursor + i + 1 === file.size) {
        const e = entropyOfHistogram(blockHist, blockBytesSoFar);
        if (e > 7.5) highBlocks++;
        if (blockIdx % stride === 0) {
          blockEntropies.push(Number(e.toFixed(3)));
        }
        blockHist.fill(0);
        blockBytesSoFar = 0;
        blockIdx++;
      }
    }

    cursor = end;
    // Yield to the event loop between megabyte chunks so the UI stays
    // responsive even on multi-GB evidence files.
    await new Promise((r) => setTimeout(r, 0));
  }

  const globalEntropy = entropyOfHistogram(globalHist, file.size);

  let classification: string;
  if (globalEntropy < 3) {
    classification = "Very low entropy — likely text or sparse data";
  } else if (globalEntropy < 5) {
    classification = "Low entropy — structured data";
  } else if (globalEntropy < 7) {
    classification = "Medium entropy — mixed content";
  } else if (globalEntropy < 7.5) {
    classification = "High entropy — compressed or media";
  } else {
    classification = "Very high entropy — likely encrypted or packed";
  }

  return {
    globalEntropy: Number(globalEntropy.toFixed(3)),
    blockSize,
    blockEntropies,
    highEntropyBlocks: highBlocks,
    classification,
  };
}
