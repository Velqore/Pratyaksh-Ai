// Tesseract.js OCR wrapper. Loaded lazily so the worker only fetches when
// the user actually asks for OCR.

export interface OcrResult {
  text: string;
  confidence: number;
  wordCount: number;
  lineCount: number;
  language: string;
}

export async function runOcr(
  source: File | HTMLCanvasElement | HTMLImageElement,
  onProgress?: (status: string, frac: number) => void,
  language: string = "eng",
): Promise<OcrResult> {
  // Dynamic import keeps the ~800KB tesseract.js bundle out of the main chunk.
  const Tesseract = await import("tesseract.js");

  const worker = await Tesseract.createWorker(language, 1, {
    logger: (m: { status: string; progress: number }) => {
      if (onProgress) onProgress(m.status, m.progress);
    },
    errorHandler: (err: unknown) => {
      // Tesseract emits worker errors via this callback in addition to
      // rejecting the recognize promise. Swallowing it prevents secondary
      // unhandled-rejection events from leaking out of the worker.
      console.warn("Tesseract worker error (handled):", err);
    },
  } as unknown as Record<string, unknown>);

  try {
    const { data } = await worker.recognize(source);
    return {
      text: data.text,
      confidence: data.confidence,
      wordCount: data.text.split(/\s+/).filter(Boolean).length,
      lineCount: data.text.split(/\n/).filter((l) => l.trim().length > 0).length,
      language,
    };
  } finally {
    try {
      await worker.terminate();
    } catch (e) {
      console.warn("Tesseract worker terminate error (handled):", e);
    }
  }
}

export async function ocrFromTextFile(file: File): Promise<OcrResult> {
  // Plain text or RTF — read directly, no OCR needed.
  const text = await file.text();
  let plain = text;
  if (text.startsWith("{\\rtf")) {
    // Strip basic RTF control words for a readable preview
    plain = text
      .replace(/\\par[d]?/g, "\n")
      .replace(/\\'[0-9a-fA-F]{2}/g, "")
      .replace(/\\[a-z]+-?\d* ?/gi, "")
      .replace(/[{}]/g, "")
      .trim();
  }
  return {
    text: plain,
    confidence: 100,
    wordCount: plain.split(/\s+/).filter(Boolean).length,
    lineCount: plain.split(/\n/).filter((l) => l.trim().length > 0).length,
    language: "n/a (plain text)",
  };
}
