// Steganography heuristics — LSB statistics, channel chi-square, and a
// simple "suspicious region" detector. This won't extract a payload, but
// it surfaces the statistical fingerprint of LSB-based stego.

export interface StegoResult {
  applicable: boolean;
  hiddenDataDetected: boolean;
  lsbBias: number; // 0..1, 0.5 means perfectly balanced
  chiSquare: number;
  expectedChiSquare: number;
  pValueRoughEstimate: number;
  suspiciousRegions: Array<{ x: number; y: number; confidence: number }>;
  notes: string[];
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export async function detectSteganography(file: File): Promise<StegoResult> {
  if (!file.type.startsWith("image/")) {
    return {
      applicable: false,
      hiddenDataDetected: false,
      lsbBias: 0,
      chiSquare: 0,
      expectedChiSquare: 0,
      pValueRoughEstimate: 0,
      suspiciousRegions: [],
      notes: ["Steganography analysis only applies to images"],
    };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return {
      applicable: false,
      hiddenDataDetected: false,
      lsbBias: 0,
      chiSquare: 0,
      expectedChiSquare: 0,
      pValueRoughEstimate: 0,
      suspiciousRegions: [],
      notes: ["Failed to decode image for stego analysis"],
    };
  }

  const maxDim = 512;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      applicable: false,
      hiddenDataDetected: false,
      lsbBias: 0,
      chiSquare: 0,
      expectedChiSquare: 0,
      pValueRoughEstimate: 0,
      suspiciousRegions: [],
      notes: ["Canvas 2D context unavailable"],
    };
  }
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  // Whole-image LSB stats over R/G/B channels
  let zeros = 0;
  let ones = 0;
  // Chi-square pair test: in clean images, P(value=2k) ≈ P(value=2k+1)
  // In LSB-embedded images, those pairs become equally probable.
  const pairCounts = new Array<[number, number]>(128);
  for (let i = 0; i < 128; i++) pairCounts[i] = [0, 0];

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c];
      if ((v & 1) === 0) zeros++;
      else ones++;
      const pair = v >> 1;
      pairCounts[pair][v & 1]++;
    }
  }

  const total = zeros + ones;
  const lsbBias = total > 0 ? ones / total : 0.5;

  // Compute chi-square statistic across the 128 pairs (only non-empty pairs).
  let chiSquare = 0;
  let dof = 0;
  for (let i = 0; i < 128; i++) {
    const sum = pairCounts[i][0] + pairCounts[i][1];
    if (sum < 4) continue;
    const expected = sum / 2;
    const diff0 = pairCounts[i][0] - expected;
    chiSquare += (diff0 * diff0) / expected;
    dof++;
  }

  // Rough p-value heuristic: in a clean image with N pairs and k=N-1 dof,
  // chi-square is roughly N. Stego embedding pushes chi-square WAY down
  // (close to zero) because pairs become equiprobable. So we flag low
  // chi-square relative to dof as suspicious.
  const expectedChi = dof; // mean of chi-square distribution with k dof
  const ratio = expectedChi > 0 ? chiSquare / expectedChi : 1;
  const pValueRough = Math.max(0, Math.min(1, 1 - Math.exp(-ratio)));

  const lsbBiasDeviation = Math.abs(lsbBias - 0.5);
  const looksRandom = lsbBiasDeviation < 0.005 && ratio < 0.5;

  // Block-level scan for suspicious regions (32x32 blocks, ratio < 0.4)
  const suspiciousRegions: Array<{ x: number; y: number; confidence: number }> = [];
  const block = 32;
  for (let by = 0; by + block <= h; by += block) {
    for (let bx = 0; bx + block <= w; bx += block) {
      const blockPairs = new Array<[number, number]>(128);
      for (let i = 0; i < 128; i++) blockPairs[i] = [0, 0];
      for (let y = by; y < by + block; y++) {
        for (let x = bx; x < bx + block; x++) {
          const i = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            const v = data[i + c];
            blockPairs[v >> 1][v & 1]++;
          }
        }
      }
      let bChi = 0;
      let bDof = 0;
      for (let i = 0; i < 128; i++) {
        const sum = blockPairs[i][0] + blockPairs[i][1];
        if (sum < 4) continue;
        const expected = sum / 2;
        const diff0 = blockPairs[i][0] - expected;
        bChi += (diff0 * diff0) / expected;
        bDof++;
      }
      const bRatio = bDof > 0 ? bChi / bDof : 1;
      if (bRatio < 0.35) {
        suspiciousRegions.push({
          x: bx + block / 2,
          y: by + block / 2,
          confidence: Number((1 - bRatio).toFixed(2)),
        });
      }
    }
  }

  const notes: string[] = [];
  notes.push(`LSB bias: ${(lsbBias * 100).toFixed(2)}% ones`);
  notes.push(
    `Pair chi-square: ${chiSquare.toFixed(1)} over ${dof} dof (expected ≈ ${expectedChi})`,
  );
  if (looksRandom) {
    notes.push(
      "Chi-square ratio is significantly below expected — LSB plane behaves like random data, consistent with steganographic embedding.",
    );
  } else {
    notes.push(
      "LSB statistics fall within natural variation — no strong evidence of LSB stego.",
    );
  }

  return {
    applicable: true,
    hiddenDataDetected: looksRandom,
    lsbBias: Number(lsbBias.toFixed(4)),
    chiSquare: Number(chiSquare.toFixed(2)),
    expectedChiSquare: expectedChi,
    pValueRoughEstimate: Number(pValueRough.toFixed(3)),
    suspiciousRegions: suspiciousRegions.slice(0, 10),
    notes,
  };
}
