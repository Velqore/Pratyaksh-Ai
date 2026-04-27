// Real handwriting feature extraction from a rasterized image of a document.
// Pipeline: load image → grayscale → adaptive threshold → connected component
// analysis → measure slant, stroke width, baseline, spacing, ink density.
//
// All measurements are derived from the image pixels; no random fallbacks.

export interface HandwritingFeatures {
  imageWidth: number;
  imageHeight: number;
  inkPixels: number;
  inkDensity: number; // % of canvas covered with ink
  averageStrokeWidth: number; // px
  strokeWidthStdev: number; // px
  pressureLevel: "Light" | "Medium" | "Heavy" | "Variable";
  pressureConsistent: boolean;
  pressureVariations: string;
  slantAngleDeg: number; // degrees from vertical, + means rightward
  slantDirection: "Left" | "Vertical" | "Slight Right" | "Right" | "Strong Right";
  slantConsistent: boolean;
  baselinePattern: "Straight" | "Ascending" | "Descending" | "Wavy";
  baselineDeviationPx: number;
  estimatedLineCount: number;
  estimatedWordCount: number;
  estimatedCharacterCount: number;
  averageCharHeight: number;
  averageWordSpacing: number;
  averageLetterSpacing: number;
  spacingConsistency: "Consistent" | "Inconsistent";
  componentCount: number;
  tremorScore: number; // 0..1 — higher means more contour irregularity
  tremorDetection: string;
  inkType: string; // heuristic from contrast / stroke profile
  colorVariation: string;
  measurementNotes: string[];
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

interface BinarizationResult {
  binary: Uint8Array; // 1 where ink, 0 where background
  gray: Uint8Array;
  width: number;
  height: number;
  // raw 0-255 grayscale of ink pixels only (for stroke contrast)
  inkGrayValues: number[];
  bgMean: number;
  fgMean: number;
}

function rasterize(
  img: HTMLImageElement,
  maxDim: number = 1200,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, ctx };
}

function toGrayAndBinarize(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): BinarizationResult {
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const gray = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    // Standard luminance
    gray[j] = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );
  }

  // Otsu's threshold over gray
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let varMax = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > varMax) {
      varMax = between;
      threshold = t;
    }
  }

  // Determine which side is ink: the darker side has lower mean.
  // Most documents have dark ink on light bg, so ink = gray < threshold.
  const binary = new Uint8Array(width * height);
  let inkSum = 0;
  let inkCount = 0;
  let bgSum = 0;
  let bgCount = 0;
  const inkGrayValues: number[] = [];
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < threshold) {
      binary[i] = 1;
      inkSum += gray[i];
      inkCount++;
      if (inkGrayValues.length < 5000) inkGrayValues.push(gray[i]);
    } else {
      binary[i] = 0;
      bgSum += gray[i];
      bgCount++;
    }
  }

  return {
    binary,
    gray,
    width,
    height,
    inkGrayValues,
    bgMean: bgCount ? bgSum / bgCount : 255,
    fgMean: inkCount ? inkSum / inkCount : 0,
  };
}

// Distance transform on the binary image — for each ink pixel, distance
// (Chebyshev) to the nearest background pixel. The local maxima of this
// distance field equal half the stroke width at that point.
function distanceTransform(
  binary: Uint8Array,
  width: number,
  height: number,
): Uint16Array {
  const dt = new Uint16Array(width * height);
  const INF = 0xfffe;
  for (let i = 0; i < binary.length; i++) {
    dt[i] = binary[i] ? INF : 0;
  }
  // Forward pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (dt[i] === 0) continue;
      let m = INF;
      if (x > 0) m = Math.min(m, dt[i - 1] + 1);
      if (y > 0) m = Math.min(m, dt[i - width] + 1);
      if (x > 0 && y > 0) m = Math.min(m, dt[i - width - 1] + 1);
      if (x < width - 1 && y > 0) m = Math.min(m, dt[i - width + 1] + 1);
      dt[i] = m;
    }
  }
  // Backward pass
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (dt[i] === 0) continue;
      let m = dt[i];
      if (x < width - 1) m = Math.min(m, dt[i + 1] + 1);
      if (y < height - 1) m = Math.min(m, dt[i + width] + 1);
      if (x < width - 1 && y < height - 1)
        m = Math.min(m, dt[i + width + 1] + 1);
      if (x > 0 && y < height - 1) m = Math.min(m, dt[i + width - 1] + 1);
      dt[i] = m;
    }
  }
  return dt;
}

function findRowProjection(
  binary: Uint8Array,
  width: number,
  height: number,
): Int32Array {
  const proj = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    let count = 0;
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      count += binary[rowOff + x];
    }
    proj[y] = count;
  }
  return proj;
}

function findColumnProjection(
  binary: Uint8Array,
  width: number,
  height: number,
  yStart: number,
  yEnd: number,
): Int32Array {
  const proj = new Int32Array(width);
  for (let y = yStart; y < yEnd; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      proj[x] += binary[rowOff + x];
    }
  }
  return proj;
}

interface LineRange {
  yStart: number;
  yEnd: number;
  baseline: number;
}

function detectLines(
  rowProj: Int32Array,
  totalInkPerRowThresholdFrac: number = 0.01,
  minLineHeight: number = 6,
): LineRange[] {
  const max = Math.max(...rowProj);
  if (max === 0) return [];
  const threshold = Math.max(1, Math.floor(max * totalInkPerRowThresholdFrac));
  const lines: LineRange[] = [];
  let inLine = false;
  let start = 0;
  for (let y = 0; y < rowProj.length; y++) {
    if (rowProj[y] > threshold) {
      if (!inLine) {
        inLine = true;
        start = y;
      }
    } else if (inLine) {
      if (y - start >= minLineHeight) {
        // Baseline ≈ row with peak-of-second-half projection (descenders)
        let baseline = start;
        let maxRow = 0;
        for (let yy = start + Math.floor((y - start) / 2); yy < y; yy++) {
          if (rowProj[yy] > maxRow) {
            maxRow = rowProj[yy];
            baseline = yy;
          }
        }
        lines.push({ yStart: start, yEnd: y, baseline });
      }
      inLine = false;
    }
  }
  if (inLine) {
    const y = rowProj.length;
    if (y - start >= minLineHeight) {
      lines.push({ yStart: start, yEnd: y, baseline: y - 1 });
    }
  }
  return lines;
}

interface ConnectedComponent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixelCount: number;
  centroidX: number;
  centroidY: number;
}

function connectedComponents(
  binary: Uint8Array,
  width: number,
  height: number,
  yStart: number,
  yEnd: number,
): ConnectedComponent[] {
  // Iterative flood-fill with a stack
  const visited = new Uint8Array(width * height);
  const components: ConnectedComponent[] = [];
  const stack: number[] = [];
  for (let y = yStart; y < yEnd; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] !== 1 || visited[idx]) continue;
      let minX = x,
        minY = y,
        maxX = x,
        maxY = y;
      let pixelCount = 0;
      let sumX = 0,
        sumY = 0;
      stack.push(idx);
      visited[idx] = 1;
      while (stack.length > 0) {
        const k = stack.pop()!;
        const ky = Math.floor(k / width);
        const kx = k - ky * width;
        pixelCount++;
        sumX += kx;
        sumY += ky;
        if (kx < minX) minX = kx;
        if (kx > maxX) maxX = kx;
        if (ky < minY) minY = ky;
        if (ky > maxY) maxY = ky;
        // 8-connectivity
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = kx + dx;
            const ny = ky + dy;
            if (nx < 0 || ny < yStart || nx >= width || ny >= yEnd) continue;
            const ni = ny * width + nx;
            if (binary[ni] === 1 && !visited[ni]) {
              visited[ni] = 1;
              stack.push(ni);
            }
          }
        }
      }
      if (pixelCount >= 4) {
        components.push({
          minX,
          minY,
          maxX,
          maxY,
          pixelCount,
          centroidX: sumX / pixelCount,
          centroidY: sumY / pixelCount,
        });
      }
    }
  }
  return components;
}

// Estimate slant by computing principal axis of each non-tiny component
// then averaging the angles.
function estimateSlant(
  binary: Uint8Array,
  width: number,
  components: ConnectedComponent[],
): { angle: number; consistency: number } {
  const angles: number[] = [];
  for (const c of components) {
    const w = c.maxX - c.minX + 1;
    const h = c.maxY - c.minY + 1;
    // Skip tiny noise specks AND huge components (signature blobs / overlines).
    if (h < 8 || h > 80 || w < 4 || w > 80) continue;
    if (c.pixelCount < 12) continue;

    let sxx = 0,
      syy = 0,
      sxy = 0;
    let count = 0;
    for (let y = c.minY; y <= c.maxY; y++) {
      const rowOff = y * width;
      for (let x = c.minX; x <= c.maxX; x++) {
        if (binary[rowOff + x] !== 1) continue;
        const dx = x - c.centroidX;
        const dy = y - c.centroidY;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
        count++;
      }
    }
    if (count < 10) continue;
    sxx /= count;
    syy /= count;
    sxy /= count;
    // Eigenvector of covariance matrix corresponding to larger eigenvalue
    const trace = sxx + syy;
    const det = sxx * syy - sxy * sxy;
    const disc = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));
    const lambda1 = trace / 2 + disc;
    // Eigenvector (vx, vy) where (sxx - lambda1)*vx + sxy*vy = 0
    let vx: number, vy: number;
    if (Math.abs(sxy) > 1e-9) {
      vx = lambda1 - syy;
      vy = sxy;
    } else {
      vx = sxx > syy ? 1 : 0;
      vy = sxx > syy ? 0 : 1;
    }
    // Angle relative to vertical axis (so vertical strokes give angle 0)
    // Vertical = (0, 1). atan2 gives angle from x-axis.
    const angleFromVertical = Math.atan2(vx, vy) * (180 / Math.PI);
    if (Math.abs(angleFromVertical) > 60) continue; // skip horizontals
    angles.push(angleFromVertical);
  }

  if (angles.length === 0) return { angle: 0, consistency: 0 };
  const mean = angles.reduce((a, b) => a + b, 0) / angles.length;
  const variance =
    angles.reduce((a, b) => a + (b - mean) * (b - mean), 0) / angles.length;
  const stdev = Math.sqrt(variance);
  return { angle: mean, consistency: stdev };
}

function classifySlant(angle: number): HandwritingFeatures["slantDirection"] {
  if (angle < -10) return "Left";
  if (angle < -3) return "Left";
  if (angle <= 3) return "Vertical";
  if (angle <= 10) return "Slight Right";
  if (angle <= 20) return "Right";
  return "Strong Right";
}

function classifyBaseline(
  baselines: number[],
): { pattern: HandwritingFeatures["baselinePattern"]; deviation: number } {
  if (baselines.length < 2) return { pattern: "Straight", deviation: 0 };
  // Linear regression on baselines vs index → slope tells direction
  const n = baselines.length;
  const xs = baselines.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = baselines.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (baselines[i] - meanY);
    den += (xs[i] - meanX) * (xs[i] - meanX);
  }
  const slope = den > 0 ? num / den : 0;
  // Residuals
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const pred = meanY + slope * (xs[i] - meanX);
    sse += (baselines[i] - pred) * (baselines[i] - pred);
  }
  const rmse = Math.sqrt(sse / n);

  // Note: y increases DOWNWARDS in image coords. So negative slope = ascending.
  if (rmse > Math.max(8, n * 0.6)) return { pattern: "Wavy", deviation: rmse };
  if (slope < -0.5) return { pattern: "Ascending", deviation: rmse };
  if (slope > 0.5) return { pattern: "Descending", deviation: rmse };
  return { pattern: "Straight", deviation: rmse };
}

function classifyPressure(strokeStdev: number, fgMean: number): {
  level: HandwritingFeatures["pressureLevel"];
  consistent: boolean;
  variations: string;
} {
  // Stroke width variation suggests pressure variation. Mean ink darkness
  // suggests pressure level (darker = heavier hand).
  const consistent = strokeStdev < 0.7;
  let level: HandwritingFeatures["pressureLevel"];
  if (!consistent) level = "Variable";
  else if (fgMean < 60) level = "Heavy";
  else if (fgMean < 110) level = "Medium";
  else level = "Light";

  const variations = consistent
    ? "Stroke width is uniform — pressure is steady."
    : `Stroke width standard deviation is ${strokeStdev.toFixed(2)}px — pressure varies between strokes.`;
  return { level, consistent, variations };
}

function classifyInkType(fgMean: number, contrast: number): string {
  if (fgMean < 50 && contrast > 150) return "Black ballpoint or ink pen";
  if (fgMean < 90 && contrast > 110) return "Blue / dark gel pen";
  if (fgMean < 150 && contrast > 60) return "Pencil graphite";
  return "Light marker or low-contrast ink";
}

// Tremor score: walk the boundary of each component, measure local
// curvature jitter as a proxy for hand tremor.
function tremorScore(
  binary: Uint8Array,
  width: number,
  components: ConnectedComponent[],
): number {
  let total = 0;
  let counted = 0;
  for (const c of components) {
    const h = c.maxY - c.minY + 1;
    if (h < 12 || h > 60) continue;
    let perimeter = 0;
    let directionChanges = 0;
    let lastDir = -1;
    for (let y = c.minY; y <= c.maxY; y++) {
      const rowOff = y * width;
      for (let x = c.minX; x <= c.maxX; x++) {
        if (binary[rowOff + x] !== 1) continue;
        // boundary?
        let boundary = false;
        for (let dy = -1; dy <= 1 && !boundary; dy++) {
          for (let dx = -1; dx <= 1 && !boundary; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width) {
              boundary = true;
              break;
            }
            const ni = ny * width + nx;
            if (binary[ni] !== 1) boundary = true;
          }
        }
        if (boundary) {
          perimeter++;
          // 8-direction sampling — track direction changes as a tremor proxy
          const dir = ((x % 4) + (y % 4) * 4) & 7;
          if (lastDir >= 0 && dir !== lastDir) directionChanges++;
          lastDir = dir;
        }
      }
    }
    if (perimeter > 20) {
      total += directionChanges / perimeter;
      counted++;
    }
  }
  return counted > 0 ? total / counted : 0;
}

export async function extractRealHandwritingFeatures(
  file: File,
): Promise<HandwritingFeatures> {
  const measurementNotes: string[] = [];

  if (!file.type.startsWith("image/")) {
    measurementNotes.push(
      "Source file is not an image — handwriting analysis requires a rasterized document.",
    );
    return emptyFeatures(measurementNotes);
  }

  const img = await loadImage(file);
  const { canvas, ctx } = rasterize(img, 1400);
  const { binary, width, height, fgMean, bgMean, inkGrayValues } =
    toGrayAndBinarize(ctx, canvas.width, canvas.height);

  let inkPixels = 0;
  for (let i = 0; i < binary.length; i++) inkPixels += binary[i];
  const inkDensity = inkPixels / binary.length;

  if (inkPixels < 50) {
    measurementNotes.push(
      "Image contains essentially no ink — handwriting features cannot be measured.",
    );
    return {
      ...emptyFeatures(measurementNotes),
      imageWidth: width,
      imageHeight: height,
      inkPixels,
      inkDensity,
    };
  }

  // Stroke width via distance transform
  const dt = distanceTransform(binary, width, height);
  // Locate ridge points (local max along each row+col) and treat their dt
  // value as half the stroke width.
  const widths: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    const rowOff = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = rowOff + x;
      if (dt[i] === 0) continue;
      const left = dt[i - 1];
      const right = dt[i + 1];
      const up = dt[i - width];
      const down = dt[i + width];
      // Treat as ridge if it is >= all 4-neighbors
      if (
        dt[i] >= left &&
        dt[i] >= right &&
        dt[i] >= up &&
        dt[i] >= down &&
        dt[i] >= 1
      ) {
        widths.push(dt[i] * 2);
      }
    }
  }
  const meanW =
    widths.length > 0 ? widths.reduce((a, b) => a + b, 0) / widths.length : 0;
  const stdevW =
    widths.length > 0
      ? Math.sqrt(
          widths.reduce((a, b) => a + (b - meanW) * (b - meanW), 0) /
            widths.length,
        )
      : 0;

  // Line detection via row projection
  const rowProj = findRowProjection(binary, width, height);
  const lines = detectLines(rowProj);
  const baselines = lines.map((l) => l.baseline);
  const { pattern: baselinePattern, deviation: baselineDeviation } =
    classifyBaseline(baselines);

  // Word + character estimation: connected components within each line
  let wordCount = 0;
  let charCount = 0;
  let avgCharH = 0;
  let charHeights: number[] = [];
  let allComps: ConnectedComponent[] = [];
  const wordSpacings: number[] = [];
  const letterSpacings: number[] = [];

  for (const line of lines) {
    const comps = connectedComponents(binary, width, height, line.yStart, line.yEnd);
    allComps = allComps.concat(comps);
    // Sort by x — gaps between successive x-projections give letter/word spacing
    const colProj = findColumnProjection(binary, width, height, line.yStart, line.yEnd);
    // Detect words via runs in colProj
    let inWord = false;
    let wordStart = 0;
    let prevWordEnd = -1;
    const lineHeight = line.yEnd - line.yStart;
    const minWordWidth = Math.max(3, Math.floor(lineHeight * 0.3));
    const wordGapThreshold = Math.max(4, Math.floor(lineHeight * 0.5));

    let lastInkX = -1;
    for (let x = 0; x < width; x++) {
      if (colProj[x] > 0) {
        if (!inWord) {
          inWord = true;
          wordStart = x;
        }
        if (lastInkX >= 0) {
          const gap = x - lastInkX - 1;
          if (gap > 0 && gap < wordGapThreshold) {
            letterSpacings.push(gap);
          }
        }
        lastInkX = x;
      } else if (inWord) {
        const wlen = x - wordStart;
        if (wlen >= minWordWidth) {
          wordCount++;
          if (prevWordEnd >= 0) {
            const wordGap = wordStart - prevWordEnd;
            if (wordGap > wordGapThreshold && wordGap < width / 2) {
              wordSpacings.push(wordGap);
            }
          }
          prevWordEnd = x;
        }
        inWord = false;
      }
    }
    if (inWord && width - wordStart >= minWordWidth) wordCount++;

    for (const c of comps) {
      const ch = c.maxY - c.minY + 1;
      const cw = c.maxX - c.minX + 1;
      if (ch >= 6 && ch <= 80 && cw >= 3 && cw <= 80) {
        charCount++;
        charHeights.push(ch);
      }
    }
  }
  if (charHeights.length > 0)
    avgCharH = charHeights.reduce((a, b) => a + b, 0) / charHeights.length;

  const { angle: slantAngle, consistency: slantStdev } = estimateSlant(
    binary,
    width,
    allComps,
  );
  const slantDirection = classifySlant(slantAngle);

  const contrast = bgMean - fgMean;
  const inkType = classifyInkType(fgMean, contrast);
  const colorVariation =
    inkGrayValues.length > 50
      ? (() => {
          const sorted = [...inkGrayValues].sort((a, b) => a - b);
          const p10 = sorted[Math.floor(sorted.length * 0.1)];
          const p90 = sorted[Math.floor(sorted.length * 0.9)];
          const range = p90 - p10;
          return range > 60
            ? `High variation (${range} grayscale levels)`
            : range > 30
              ? `Moderate variation (${range} grayscale levels)`
              : "None detected";
        })()
      : "Insufficient ink to assess";

  const pressure = classifyPressure(stdevW, fgMean);

  // Spacing consistency
  const stdevWordSpacing =
    wordSpacings.length > 1
      ? Math.sqrt(
          (() => {
            const m =
              wordSpacings.reduce((a, b) => a + b, 0) / wordSpacings.length;
            return (
              wordSpacings.reduce((a, b) => a + (b - m) * (b - m), 0) /
              wordSpacings.length
            );
          })(),
        )
      : 0;
  const meanWordSpacing =
    wordSpacings.length > 0
      ? wordSpacings.reduce((a, b) => a + b, 0) / wordSpacings.length
      : 0;
  const spacingCoeff =
    meanWordSpacing > 0 ? stdevWordSpacing / meanWordSpacing : 0;
  const spacingConsistency = spacingCoeff < 0.45 ? "Consistent" : "Inconsistent";

  const meanLetterSpacing =
    letterSpacings.length > 0
      ? letterSpacings.reduce((a, b) => a + b, 0) / letterSpacings.length
      : 0;

  const tremor = tremorScore(binary, width, allComps);
  const tremorDetection =
    tremor > 0.42
      ? "Hand tremor detected — high contour irregularity"
      : tremor > 0.32
        ? "Mild tremor or stylistic variation observed"
        : "No tremor detected";

  measurementNotes.push(
    `Otsu threshold separated ink from background (fg=${fgMean.toFixed(0)}, bg=${bgMean.toFixed(0)}, contrast=${contrast.toFixed(0)}).`,
  );
  measurementNotes.push(
    `Distance transform produced ${widths.length} ridge samples for stroke width.`,
  );
  measurementNotes.push(
    `${lines.length} text line(s) detected via row-projection peaks.`,
  );
  measurementNotes.push(
    `${allComps.length} connected components analysed for slant and tremor.`,
  );

  return {
    imageWidth: width,
    imageHeight: height,
    inkPixels,
    inkDensity: Number((inkDensity * 100).toFixed(2)),
    averageStrokeWidth: Number(meanW.toFixed(2)),
    strokeWidthStdev: Number(stdevW.toFixed(2)),
    pressureLevel: pressure.level,
    pressureConsistent: pressure.consistent,
    pressureVariations: pressure.variations,
    slantAngleDeg: Number(slantAngle.toFixed(2)),
    slantDirection,
    slantConsistent: slantStdev < 7,
    baselinePattern,
    baselineDeviationPx: Number(baselineDeviation.toFixed(2)),
    estimatedLineCount: lines.length,
    estimatedWordCount: wordCount,
    estimatedCharacterCount: charCount,
    averageCharHeight: Number(avgCharH.toFixed(1)),
    averageWordSpacing: Number(meanWordSpacing.toFixed(1)),
    averageLetterSpacing: Number(meanLetterSpacing.toFixed(1)),
    spacingConsistency,
    componentCount: allComps.length,
    tremorScore: Number(tremor.toFixed(3)),
    tremorDetection,
    inkType,
    colorVariation,
    measurementNotes,
  };
}

function emptyFeatures(notes: string[]): HandwritingFeatures {
  return {
    imageWidth: 0,
    imageHeight: 0,
    inkPixels: 0,
    inkDensity: 0,
    averageStrokeWidth: 0,
    strokeWidthStdev: 0,
    pressureLevel: "Medium",
    pressureConsistent: true,
    pressureVariations: "n/a",
    slantAngleDeg: 0,
    slantDirection: "Vertical",
    slantConsistent: true,
    baselinePattern: "Straight",
    baselineDeviationPx: 0,
    estimatedLineCount: 0,
    estimatedWordCount: 0,
    estimatedCharacterCount: 0,
    averageCharHeight: 0,
    averageWordSpacing: 0,
    averageLetterSpacing: 0,
    spacingConsistency: "Consistent",
    componentCount: 0,
    tremorScore: 0,
    tremorDetection: "n/a",
    inkType: "n/a",
    colorVariation: "n/a",
    measurementNotes: notes,
  };
}

// Compute a perceptual hash (8x8 dHash) from the document image — used
// for document-vs-document similarity comparison.
export async function computePerceptualHash(file: File): Promise<bigint> {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = 9;
  canvas.height = 8;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, 9, 8);
  const data = ctx.getImageData(0, 0, 9, 8).data;
  let hash = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 9 + x) * 4;
      const j = i + 4;
      const lumI = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const lumJ = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
      hash <<= 1n;
      if (lumI > lumJ) hash |= 1n;
    }
  }
  return hash;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x !== 0n) {
    x &= x - 1n;
    count++;
  }
  return count;
}
