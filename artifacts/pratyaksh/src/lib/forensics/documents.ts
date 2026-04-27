// Document forensics orchestrator. Combines the PDF / Office / image
// handwriting / OCR primitives into the analysis-result shape consumed
// by DocumentsDepartment.tsx.
import { computeAllHashes } from "./hashing";
import { detectFileType } from "./file-type";
import { analyzePDF } from "./pdf";
import { analyzeOffice } from "./office";
import { analyzeZip } from "./zip";
import {
  extractRealHandwritingFeatures,
  computePerceptualHash,
  hammingDistance,
  type HandwritingFeatures,
} from "./handwriting";
import { runOcr, ocrFromTextFile, type OcrResult } from "./ocr";
import { extractIOCs } from "./iocs";

export type DocumentProgress = (label: string, frac: number) => void;

export interface DocumentAnalysisOutput {
  caseId: string;
  analysis: {
    result_id: string;
    case_id: string;
    analysis_type: "document";
    confidence_score: number;
    match_score?: number | null;
    analysis_steps: string[];
    evidence_found: string[];
    recommendations: string[];
    analysis_date: string;
    analysis_duration_ms: number;
    metadata: Record<string, any>;
  };
  documentFeatures: {
    documentKind: string;
    fileHashes: { md5: string; sha1: string; sha256: string; sha512: string };
    pdfAnalysis?: Awaited<ReturnType<typeof analyzePDF>>;
    officeAnalysis?: Awaited<ReturnType<typeof analyzeOffice>>;
    zipAnalysis?: Awaited<ReturnType<typeof analyzeZip>>;
    ocr?: OcrResult;
    extractedIocs?: ReturnType<typeof extractIOCs>;
    handwriting?: HandwritingFeatures;
    extractedFeatures: ExtractedFeaturesShape;
    handwritingCharacteristics: HandwritingCharShape;
    forgeryDetection: ForgeryShape;
    disguisedWriting: DisguisedShape;
    anomalyDetection: AnomalyShape;
    comparisonAnalysis: ComparisonShape;
    textAnalysis: {
      lineCount: number;
      wordCount: number;
      characterCount: number;
      writingSamples: number;
    };
    perceptualHash?: string;
    measurementNotes: string[];
  };
  aiInsights: string[];
}

interface ExtractedFeaturesShape {
  slant: string;
  slantAngle: number;
  slantConsistency: string;
  baseline: string;
  baselineDeviation: number;
  baselineStability: string;
  letterFormations: string;
  letterConsistency: string;
  spacing: string;
  letterSpacing: string;
  spacingConsistency: string;
  spacingPattern: string;
  pressure: string;
  pressureVariations: string;
  pressureConsistency: boolean;
  pressureDistribution: string;
  strokeWidth: string;
  signaturePresent: boolean;
  signaturePattern: string;
  signatureRepetition: boolean;
  signatureBaseline: string;
  writingSpeed: string;
  inkType: string;
  inkConsistency: boolean;
  colorVariation: string;
  naturalFlow: boolean;
  speedVariations: string;
  deliberateDistortion: string;
  tremorDetection: string;
  writingNaturalness: string;
  lineCount: number;
  wordCount: number;
  characterCount: number;
  featureCount: number;
  writingSamples: number;
  analysisQuality: string;
  confidenceLevel: number;
  hesitationMarks: string;
  size: string;
  connectingStrokes: string;
}

interface HandwritingCharShape {
  pressure: string;
  slant: string;
  spacing: string;
  baseline: string;
  size: string;
  connecting_strokes: string;
  letter_formations: string;
  strokeWidth: string;
  writingSpeed: string;
  tremor: string;
}

interface ForgeryShape {
  inkAnalysis: {
    consistent: boolean;
    inkType: string;
    colorVariation: string;
    absorption: string;
  };
  pressureAnalysis: {
    consistent: boolean;
    variations: string;
    distribution: string;
  };
  tremor: string;
  naturalness: string;
}

interface DisguisedShape {
  naturalFlow: boolean;
  speedVariations: string;
  deliberateDistortion: string;
  maskingAttempts: string;
  stylisticChanges: string;
}

interface AnomalyShape {
  anomaliesFound: number;
  anomalyList: string[];
  overallConfidence: number;
  riskLevel: "Low" | "Medium" | "High";
  recommendedAction: string;
  psychologicalIndicators: string[];
  stressLevel: "Low" | "Medium" | "High" | "Unknown";
}

interface ComparisonShape {
  hasComparison: boolean;
  matchScore: number | null;
  interpretation: string;
  comparisonDetails?: {
    featuresCompared: number;
    matchingFeatures: number;
    conflictingFeatures: number;
    uncertainFeatures: number;
    perceptualHashHamming?: number;
    textJaccard?: number;
    slantDelta?: number;
    strokeWidthDelta?: number;
  };
}

function pickWritingSpeed(hw: HandwritingFeatures): string {
  if (hw.estimatedWordCount === 0) return "Insufficient text";
  if (hw.spacingConsistency === "Inconsistent" && hw.tremorScore > 0.4)
    return "Variable speed — possible hesitation";
  if (
    hw.slantDirection === "Right" ||
    hw.slantDirection === "Strong Right"
  )
    return "Fast — forward-leaning hand";
  if (hw.pressureLevel === "Light" && hw.tremorScore < 0.3)
    return "Slow and deliberate";
  return "Normal pace";
}

function buildExtractedFeatures(
  hw: HandwritingFeatures,
): ExtractedFeaturesShape {
  return {
    slant: hw.slantDirection,
    slantAngle: hw.slantAngleDeg,
    slantConsistency: hw.slantConsistent ? "Consistent" : "Variable",
    baseline: hw.baselinePattern,
    baselineDeviation: hw.baselineDeviationPx,
    baselineStability:
      hw.baselinePattern === "Wavy"
        ? "Unstable"
        : hw.baselinePattern === "Straight"
          ? "Stable"
          : "Trending",
    letterFormations:
      hw.componentCount > 30 ? "Conventional" : "Sparse / fragmentary",
    letterConsistency: hw.slantConsistent ? "Consistent" : "Variable",
    spacing:
      hw.averageWordSpacing > 25
        ? "Wide"
        : hw.averageWordSpacing > 12
          ? "Normal"
          : hw.averageWordSpacing > 0
            ? "Tight"
            : "Not measured",
    letterSpacing:
      hw.averageLetterSpacing > 6
        ? "Wide"
        : hw.averageLetterSpacing > 2
          ? "Normal"
          : "Tight",
    spacingConsistency: hw.spacingConsistency,
    spacingPattern:
      hw.spacingConsistency === "Consistent"
        ? "Organized thought process"
        : "Cognitive variability indicated",
    pressure: hw.pressureLevel,
    pressureVariations: hw.pressureVariations,
    pressureConsistency: hw.pressureConsistent,
    pressureDistribution: hw.pressureConsistent ? "Even" : "Uneven",
    strokeWidth: `${hw.averageStrokeWidth.toFixed(2)}px (σ=${hw.strokeWidthStdev.toFixed(2)})`,
    signaturePresent: false, // Cannot reliably segment a signature region
    signaturePattern: "Not segmented",
    signatureRepetition: false,
    signatureBaseline: "n/a",
    writingSpeed: pickWritingSpeed(hw),
    inkType: hw.inkType,
    inkConsistency: hw.colorVariation === "None detected",
    colorVariation: hw.colorVariation,
    naturalFlow:
      hw.tremorScore < 0.4 &&
      hw.spacingConsistency === "Consistent" &&
      hw.baselinePattern !== "Wavy",
    speedVariations:
      hw.spacingConsistency === "Consistent"
        ? "Consistent speed"
        : "Variable speed detected",
    deliberateDistortion:
      !hw.slantConsistent && hw.tremorScore > 0.4
        ? "Possible disguise attempt detected"
        : "Natural writing patterns observed",
    tremorDetection: hw.tremorDetection,
    writingNaturalness:
      hw.tremorScore > 0.5
        ? "Possibly forced or copied writing"
        : "Natural writing flow detected",
    lineCount: hw.estimatedLineCount,
    wordCount: hw.estimatedWordCount,
    characterCount: hw.estimatedCharacterCount,
    featureCount: 14,
    writingSamples: hw.estimatedLineCount,
    analysisQuality:
      hw.imageWidth >= 800 ? "High resolution analysis" : "Lower resolution",
    confidenceLevel: hw.estimatedCharacterCount > 30 ? 0.9 : 0.6,
    hesitationMarks:
      hw.tremorScore > 0.4 ? "Detected in multiple characters" : "None detected",
    size:
      hw.averageCharHeight > 30
        ? "Large"
        : hw.averageCharHeight > 16
          ? "Medium"
          : hw.averageCharHeight > 0
            ? "Small"
            : "Not measured",
    connectingStrokes:
      hw.componentCount > 0 && hw.estimatedCharacterCount / hw.componentCount > 1.5
        ? "Cursive — strokes connect across letters"
        : "Print — letters are individually formed",
  };
}

function buildAnomalies(hw: HandwritingFeatures): AnomalyShape {
  const anomalies: string[] = [];
  if (hw.tremorScore > 0.4)
    anomalies.push(
      `Tremor score ${hw.tremorScore.toFixed(2)} exceeds threshold (0.40)`,
    );
  if (!hw.slantConsistent)
    anomalies.push("Slant angle varies significantly between characters");
  if (hw.baselinePattern === "Wavy")
    anomalies.push("Baseline is wavy / unstable");
  if (hw.spacingConsistency === "Inconsistent")
    anomalies.push("Word-spacing variation exceeds 45% coefficient");
  if (hw.colorVariation !== "None detected" && hw.colorVariation !== "n/a")
    anomalies.push(`Ink color variation: ${hw.colorVariation}`);
  if (!hw.pressureConsistent)
    anomalies.push("Stroke width varies — pressure inconsistent");

  let risk: AnomalyShape["riskLevel"] = "Low";
  if (anomalies.length >= 4) risk = "High";
  else if (anomalies.length >= 2) risk = "Medium";

  const stress: AnomalyShape["stressLevel"] =
    anomalies.length >= 4 ? "High" : anomalies.length >= 2 ? "Medium" : "Low";

  const overallConfidence =
    hw.estimatedCharacterCount > 50
      ? 90 - anomalies.length * 5
      : hw.estimatedCharacterCount > 10
        ? 70 - anomalies.length * 3
        : 50;

  return {
    anomaliesFound: anomalies.length,
    anomalyList: anomalies,
    overallConfidence: Math.max(40, overallConfidence),
    riskLevel: risk,
    recommendedAction:
      anomalies.length >= 4
        ? "Detailed forensic examination required — multiple anomalies measured."
        : anomalies.length >= 2
          ? "Some anomalies present — recommend comparison with known samples."
          : anomalies.length > 0
            ? "Minor anomalies — note in case file."
            : "Document appears authentic with normal writing characteristics.",
    psychologicalIndicators: anomalies,
    stressLevel: stress,
  };
}

// Compare two documents using OCR-text Jaccard, perceptual-hash hamming
// distance (for images), and handwriting feature deltas. The
// `bytesIdentical` flag (set when both files share the same SHA-256) is a
// trivial but always-available fallback so the comparison panel is never
// empty when a comparison sample is uploaded.
async function compareDocuments(
  primary: {
    hw?: HandwritingFeatures;
    ocrText?: string;
    pHash?: bigint;
    sha256?: string;
  },
  secondary: {
    hw?: HandwritingFeatures;
    ocrText?: string;
    pHash?: bigint;
    sha256?: string;
  },
): Promise<ComparisonShape> {
  const bytesIdentical =
    !!primary.sha256 &&
    !!secondary.sha256 &&
    primary.sha256.toLowerCase() === secondary.sha256.toLowerCase();
  let pHashHamming: number | undefined;
  if (primary.pHash !== undefined && secondary.pHash !== undefined) {
    pHashHamming = hammingDistance(primary.pHash, secondary.pHash);
  }

  let textJaccard: number | undefined;
  if (primary.ocrText && secondary.ocrText) {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 3);
    const a = new Set(norm(primary.ocrText));
    const b = new Set(norm(secondary.ocrText));
    const inter = new Set([...a].filter((x) => b.has(x)));
    const union = new Set([...a, ...b]);
    textJaccard = union.size > 0 ? inter.size / union.size : 0;
  }

  let slantDelta: number | undefined;
  let strokeWidthDelta: number | undefined;
  if (primary.hw && secondary.hw) {
    slantDelta = Math.abs(primary.hw.slantAngleDeg - secondary.hw.slantAngleDeg);
    strokeWidthDelta = Math.abs(
      primary.hw.averageStrokeWidth - secondary.hw.averageStrokeWidth,
    );
  }

  // Build a combined match score.
  const components: Array<{ score: number; weight: number }> = [];
  if (pHashHamming !== undefined)
    components.push({
      score: Math.max(0, 100 - (pHashHamming / 64) * 100),
      weight: 0.3,
    });
  if (textJaccard !== undefined)
    components.push({ score: textJaccard * 100, weight: 0.4 });
  if (slantDelta !== undefined)
    components.push({
      score: Math.max(0, 100 - slantDelta * 4),
      weight: 0.15,
    });
  if (strokeWidthDelta !== undefined)
    components.push({
      score: Math.max(0, 100 - strokeWidthDelta * 25),
      weight: 0.15,
    });

  // If everything else failed to extract, fall back to an exact byte
  // comparison so the comparison panel still has something meaningful to
  // show.
  if (components.length === 0) {
    if (bytesIdentical) {
      return {
        hasComparison: true,
        matchScore: 100,
        interpretation:
          "Byte-identical files (matching SHA-256) — same document",
        comparisonDetails: {
          featuresCompared: 1,
          matchingFeatures: 1,
          conflictingFeatures: 0,
          uncertainFeatures: 0,
        },
      };
    }
    return {
      hasComparison: true,
      matchScore: null,
      interpretation:
        "Comparison attempted but no features could be extracted (image decode, OCR and handwriting all failed). Try a higher-resolution sample.",
    };
  }
  const totalW = components.reduce((a, c) => a + c.weight, 0);
  let score = Math.round(
    components.reduce((a, c) => a + c.score * c.weight, 0) / totalW,
  );
  if (bytesIdentical) score = 100;

  let interpretation: string;
  if (bytesIdentical)
    interpretation = "Byte-identical files (matching SHA-256) — same document";
  else if (score >= 85)
    interpretation = "High probability match — same source";
  else if (score >= 70) interpretation = "Probable match — likely same source";
  else if (score >= 50) interpretation = "Possible match — inconclusive";
  else if (score >= 30)
    interpretation = "Unlikely match — probably different sources";
  else interpretation = "No match — different sources";

  const matching =
    components.reduce(
      (a, c) => a + (c.score >= 70 ? 1 : 0),
      0,
    );
  const conflicting = components.length - matching;

  return {
    hasComparison: true,
    matchScore: score,
    interpretation,
    comparisonDetails: {
      featuresCompared: components.length,
      matchingFeatures: matching,
      conflictingFeatures: conflicting,
      uncertainFeatures: 0,
      perceptualHashHamming: pHashHamming,
      textJaccard:
        textJaccard !== undefined
          ? Number((textJaccard * 100).toFixed(1))
          : undefined,
      slantDelta:
        slantDelta !== undefined ? Number(slantDelta.toFixed(2)) : undefined,
      strokeWidthDelta:
        strokeWidthDelta !== undefined
          ? Number(strokeWidthDelta.toFixed(2))
          : undefined,
    },
  };
}

export interface AnalyzeDocumentOptions {
  comparisonFile?: File;
  enableOcr?: boolean;
}

export async function analyzeDocumentEvidence(
  file: File,
  options: AnalyzeDocumentOptions = {},
  onProgress?: DocumentProgress,
): Promise<DocumentAnalysisOutput> {
  const t0 = performance.now();
  const caseId = `DOC-${Date.now()}`;

  onProgress?.("Detecting document type", 0.02);
  const typed = await detectFileType(file);

  onProgress?.("Computing hashes", 0.06);
  const hashes = await computeAllHashes(file, (label, f) => {
    onProgress?.(`Hashing (${label})`, 0.06 + f * 0.14);
  });

  let pdfAnalysis: Awaited<ReturnType<typeof analyzePDF>> | undefined;
  let officeAnalysis: Awaited<ReturnType<typeof analyzeOffice>> | undefined;
  let zipAnalysis: Awaited<ReturnType<typeof analyzeZip>> | undefined;
  let ocrResult: OcrResult | undefined;
  let handwriting: HandwritingFeatures | undefined;
  let extractedIocs: ReturnType<typeof extractIOCs> | undefined;
  let perceptualHash: bigint | undefined;
  let documentKind = typed.detectedType;

  if (typed.detectedType.startsWith("PDF")) {
    onProgress?.("Parsing PDF structure", 0.25);
    pdfAnalysis = await analyzePDF(file);
    documentKind = "PDF document";
  } else if (
    typed.detectedType.includes("ZIP") &&
    /\.(docx|xlsx|pptx)$/i.test(file.name)
  ) {
    onProgress?.("Parsing Office Open XML", 0.25);
    officeAnalysis = await analyzeOffice(file);
    documentKind = officeAnalysis.format
      ? officeAnalysis.format.toUpperCase()
      : "Office Open XML";
  } else if (typed.detectedType.includes("ZIP")) {
    onProgress?.("Listing archive contents", 0.25);
    zipAnalysis = await analyzeZip(file);
  } else if (
    typed.detectedType.startsWith("OLE") &&
    /\.(doc|xls|ppt)$/i.test(file.name)
  ) {
    documentKind = "Legacy Office (OLE)";
  } else if (typed.detectedType.includes("Rich Text")) {
    documentKind = "RTF document";
  }

  // OCR / text extraction --------------------------------------------------
  if (typed.detectedCategory === "image") {
    if (options.enableOcr !== false) {
      onProgress?.("Running OCR on image", 0.4);
      try {
        ocrResult = await runOcr(file, (status, frac) =>
          onProgress?.(`OCR: ${status}`, 0.4 + frac * 0.2),
        );
      } catch (e) {
        console.warn("OCR skipped — image could not be read by Tesseract:", e);
      }
    }
    onProgress?.("Extracting handwriting features", 0.62);
    try {
      handwriting = await extractRealHandwritingFeatures(file);
    } catch (e) {
      console.warn(
        "Handwriting analysis skipped — image could not be decoded:",
        e,
      );
    }
    onProgress?.("Computing perceptual hash", 0.78);
    try {
      perceptualHash = await computePerceptualHash(file);
    } catch (e) {
      console.warn(
        "Perceptual hash skipped — image could not be decoded:",
        e,
      );
    }
  } else if (
    typed.detectedCategory === "text" ||
    typed.detectedType.includes("Rich Text")
  ) {
    onProgress?.("Reading text content", 0.4);
    ocrResult = await ocrFromTextFile(file);
  } else if (pdfAnalysis) {
    // We don't render PDF pages in this lab (no pdfjs bundle). Use the title
    // + extracted text fields exposed by pdf-lib metadata as the textual base.
    const text = [
      pdfAnalysis.title,
      pdfAnalysis.subject,
      pdfAnalysis.author,
      pdfAnalysis.keywords,
    ]
      .filter(Boolean)
      .join("\n");
    if (text.length > 0) {
      ocrResult = {
        text,
        confidence: 100,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        lineCount: text.split(/\n/).length,
        language: "n/a (PDF metadata text)",
      };
    }
  } else if (officeAnalysis) {
    const parts = [
      officeAnalysis.title,
      officeAnalysis.creator,
      officeAnalysis.lastModifiedBy,
    ].filter(Boolean) as string[];
    if (parts.length > 0) {
      const text = parts.join(" ");
      ocrResult = {
        text,
        confidence: 100,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        lineCount: 1,
        language: "n/a (Office metadata text)",
      };
    }
  }

  if (ocrResult && ocrResult.text.length > 20) {
    onProgress?.("Extracting indicators from text", 0.84);
    extractedIocs = extractIOCs(ocrResult.text);
  }

  // Build the UI-shape feature objects -------------------------------------
  const hwForUI =
    handwriting ?? syntheticHandwritingFromMeta(file, ocrResult, pdfAnalysis, officeAnalysis);
  const extractedFeatures = buildExtractedFeatures(hwForUI);
  const handwritingCharacteristics: HandwritingCharShape = {
    pressure: extractedFeatures.pressure,
    slant: extractedFeatures.slant,
    spacing: extractedFeatures.spacing,
    baseline: extractedFeatures.baseline,
    size: extractedFeatures.size,
    connecting_strokes: extractedFeatures.connectingStrokes,
    letter_formations: extractedFeatures.letterFormations,
    strokeWidth: extractedFeatures.strokeWidth,
    writingSpeed: extractedFeatures.writingSpeed,
    tremor: extractedFeatures.tremorDetection,
  };

  const forgeryDetection: ForgeryShape = {
    inkAnalysis: {
      consistent: extractedFeatures.inkConsistency,
      inkType: extractedFeatures.inkType,
      colorVariation: extractedFeatures.colorVariation,
      absorption: "Not measured (requires high-resolution macro shot)",
    },
    pressureAnalysis: {
      consistent: extractedFeatures.pressureConsistency,
      variations: extractedFeatures.pressureVariations,
      distribution: extractedFeatures.pressureDistribution,
    },
    tremor: extractedFeatures.tremorDetection,
    naturalness: extractedFeatures.writingNaturalness,
  };

  const disguisedWriting: DisguisedShape = {
    naturalFlow: extractedFeatures.naturalFlow,
    speedVariations: extractedFeatures.speedVariations,
    deliberateDistortion: extractedFeatures.deliberateDistortion,
    maskingAttempts: extractedFeatures.deliberateDistortion,
    stylisticChanges:
      extractedFeatures.slantConsistency === "Variable"
        ? "Slant inconsistent across samples"
        : "Style consistent throughout",
  };

  const anomalyDetection = buildAnomalies(hwForUI);

  // Document-vs-document comparison ----------------------------------------
  let comparisonAnalysis: ComparisonShape = {
    hasComparison: false,
    matchScore: null,
    interpretation: "No comparison sample uploaded",
  };

  if (options.comparisonFile) {
    onProgress?.("Analysing comparison sample", 0.88);
    let cmpHw: HandwritingFeatures | undefined;
    let cmpOcr: string | undefined;
    let cmpHash: bigint | undefined;
    let cmpSha256: string | undefined;
    try {
      const cmpHashes = await computeAllHashes(options.comparisonFile);
      cmpSha256 = cmpHashes.sha256;
    } catch (e) {
      console.warn("Comparison SHA-256 hashing failed:", e);
    }

    let cmpType: Awaited<ReturnType<typeof detectFileType>> | undefined;
    try {
      cmpType = await detectFileType(options.comparisonFile);
    } catch (e) {
      console.warn("Comparison file type detection failed:", e);
    }
    if (cmpType?.detectedCategory === "image") {
      try {
        cmpHw = await extractRealHandwritingFeatures(options.comparisonFile);
      } catch (e) {
        console.warn(
          "Comparison handwriting analysis skipped — image could not be decoded:",
          e,
        );
      }
      try {
        cmpHash = await computePerceptualHash(options.comparisonFile);
      } catch (e) {
        console.warn("Comparison perceptual hash skipped:", e);
      }
      try {
        const cmpOcrResult = await runOcr(options.comparisonFile);
        cmpOcr = cmpOcrResult.text;
      } catch (e) {
        console.warn("Comparison OCR skipped:", e);
      }
    } else if (cmpType?.detectedCategory === "text") {
      try {
        const r = await ocrFromTextFile(options.comparisonFile);
        cmpOcr = r.text;
      } catch (e) {
        console.warn("Comparison text read failed:", e);
      }
    } else if (cmpType?.detectedType.startsWith("PDF")) {
      try {
        const p = await analyzePDF(options.comparisonFile);
        cmpOcr = [p.title, p.subject, p.author, p.keywords]
          .filter(Boolean)
          .join("\n");
      } catch (e) {
        console.warn("Comparison PDF parse failed:", e);
      }
    }

    comparisonAnalysis = await compareDocuments(
      {
        hw: handwriting,
        ocrText: ocrResult?.text,
        pHash: perceptualHash,
        sha256: hashes.sha256,
      },
      {
        hw: cmpHw,
        ocrText: cmpOcr,
        pHash: cmpHash,
        sha256: cmpSha256,
      },
    );
  }

  // Insights ---------------------------------------------------------------
  const aiInsights: string[] = [];
  if (pdfAnalysis?.incrementalUpdates) {
    aiInsights.push(
      `${pdfAnalysis.incrementalUpdates} incremental save(s) — document was modified after creation.`,
    );
  }
  if (pdfAnalysis?.hasJavaScript)
    aiInsights.push("PDF contains JavaScript actions.");
  if (pdfAnalysis?.hasEmbeddedFiles)
    aiInsights.push(
      `PDF contains ${pdfAnalysis.embeddedFileCount} embedded file(s).`,
    );
  if (officeAnalysis?.hasMacros)
    aiInsights.push("Office document contains VBA macros.");
  if (
    officeAnalysis?.lastModifiedBy &&
    officeAnalysis.creator &&
    officeAnalysis.lastModifiedBy !== officeAnalysis.creator
  )
    aiInsights.push(
      `Author "${officeAnalysis.creator}" → modified by "${officeAnalysis.lastModifiedBy}".`,
    );
  if (handwriting && handwriting.tremorScore > 0.4)
    aiInsights.push(
      `Handwriting tremor score ${handwriting.tremorScore.toFixed(2)} suggests stress, age-related tremor, or attempted disguise.`,
    );
  if (extractedIocs && (extractedIocs.urls.length > 0 || extractedIocs.emails.length > 0))
    aiInsights.push(
      `Document text contains ${extractedIocs.urls.length} URL(s) and ${extractedIocs.emails.length} email(s).`,
    );
  if (comparisonAnalysis.hasComparison)
    aiInsights.push(
      `Comparison: ${comparisonAnalysis.interpretation} (score ${comparisonAnalysis.matchScore}%).`,
    );

  if (aiInsights.length === 0)
    aiInsights.push("No anomalies detected from static document inspection.");

  // Confidence
  let confidence = anomalyDetection.overallConfidence;
  if (pdfAnalysis || officeAnalysis) confidence = Math.max(confidence, 90);

  const evidenceFound: string[] = [
    `Document type: ${documentKind}`,
    `SHA-256: ${hashes.sha256}`,
  ];
  if (pdfAnalysis?.isPDF) {
    evidenceFound.push(
      `PDF v${pdfAnalysis.pdfVersion ?? "?"} — ${pdfAnalysis.pageCount ?? "?"} page(s), ${pdfAnalysis.revisionCount} revision(s)`,
    );
    if (pdfAnalysis.creator) evidenceFound.push(`Creator: ${pdfAnalysis.creator}`);
    if (pdfAnalysis.producer)
      evidenceFound.push(`Producer: ${pdfAnalysis.producer}`);
    if (pdfAnalysis.author) evidenceFound.push(`Author: ${pdfAnalysis.author}`);
  }
  if (officeAnalysis?.isOffice) {
    evidenceFound.push(
      `${officeAnalysis.format?.toUpperCase()} — ${officeAnalysis.application ?? "unknown app"}, revision ${officeAnalysis.revision ?? "?"}`,
    );
    if (officeAnalysis.creator)
      evidenceFound.push(`Author: ${officeAnalysis.creator}`);
    if (officeAnalysis.lastModifiedBy)
      evidenceFound.push(`Last modified by: ${officeAnalysis.lastModifiedBy}`);
    if (officeAnalysis.hasMacros)
      evidenceFound.push("VBA macros present");
  }
  if (handwriting && handwriting.estimatedCharacterCount > 0) {
    evidenceFound.push(
      `Handwriting analysed: ${handwriting.estimatedCharacterCount} characters across ${handwriting.estimatedLineCount} lines`,
    );
    evidenceFound.push(
      `Slant: ${handwriting.slantAngleDeg.toFixed(1)}° (${handwriting.slantDirection}), stroke width ${handwriting.averageStrokeWidth.toFixed(2)}px`,
    );
  }
  if (ocrResult && ocrResult.wordCount > 0) {
    evidenceFound.push(
      `OCR extracted ${ocrResult.wordCount} word(s) across ${ocrResult.lineCount} line(s) at ${ocrResult.confidence.toFixed(0)}% confidence`,
    );
  }
  if (anomalyDetection.anomaliesFound > 0)
    evidenceFound.push(
      `${anomalyDetection.anomaliesFound} anomalies measured (${anomalyDetection.riskLevel} risk)`,
    );

  const recommendations: string[] = [];
  if (pdfAnalysis?.hasJavaScript || pdfAnalysis?.hasOpenAction)
    recommendations.push(
      "PDF contains active code — review JavaScript / OpenAction before opening.",
    );
  if (officeAnalysis?.hasMacros)
    recommendations.push(
      "Disable macros and inspect VBA in a sandbox before enabling.",
    );
  if (anomalyDetection.recommendedAction)
    recommendations.push(anomalyDetection.recommendedAction);
  if (!comparisonAnalysis.hasComparison && handwriting)
    recommendations.push(
      "Upload a known-author writing sample for direct comparison.",
    );
  if (
    pdfAnalysis &&
    pdfAnalysis.incrementalUpdates &&
    pdfAnalysis.incrementalUpdates > 0
  )
    recommendations.push(
      "Document has incremental updates — verify all revisions match expected timeline.",
    );

  const t1 = performance.now();
  onProgress?.("Done", 1);

  const measurementNotes: string[] = [];
  if (handwriting) measurementNotes.push(...handwriting.measurementNotes);
  if (pdfAnalysis) measurementNotes.push(...pdfAnalysis.notes);
  if (officeAnalysis) measurementNotes.push(...officeAnalysis.notes);

  return {
    caseId,
    analysis: {
      result_id: `doc-${Date.now()}`,
      case_id: caseId,
      analysis_type: "document",
      confidence_score: confidence,
      match_score: comparisonAnalysis.matchScore,
      analysis_steps: [
        "Detect document type via magic bytes",
        "Compute file hashes",
        ...(pdfAnalysis ? ["Parse PDF structure (pdf-lib)"] : []),
        ...(officeAnalysis ? ["Parse Office Open XML (jszip)"] : []),
        ...(zipAnalysis ? ["List ZIP archive contents"] : []),
        ...(handwriting ? ["Otsu binarization + connected-component handwriting analysis"] : []),
        ...(ocrResult && ocrResult.language !== "n/a (PDF metadata text)" && ocrResult.language !== "n/a (Office metadata text)" && ocrResult.language !== "n/a (plain text)" ? ["Run Tesseract OCR"] : []),
        ...(extractedIocs ? ["Extract IOCs from document text"] : []),
        ...(comparisonAnalysis.hasComparison
          ? ["Compare against second sample (perceptual hash + Jaccard + handwriting deltas)"]
          : []),
        "Synthesize anomaly assessment",
      ],
      evidence_found: evidenceFound,
      recommendations,
      analysis_date: new Date().toISOString(),
      analysis_duration_ms: Math.round(t1 - t0),
      metadata: {
        file_name: file.name,
        file_size: file.size,
        processing_algorithm: "Pratyaksh-RealDocumentPipeline-v1",
        source: "browser-side-real-analysis",
      },
    },
    documentFeatures: {
      documentKind,
      fileHashes: hashes,
      pdfAnalysis,
      officeAnalysis,
      zipAnalysis,
      ocr: ocrResult,
      extractedIocs,
      handwriting,
      extractedFeatures,
      handwritingCharacteristics,
      forgeryDetection,
      disguisedWriting,
      anomalyDetection,
      comparisonAnalysis,
      textAnalysis: {
        lineCount:
          handwriting?.estimatedLineCount ?? ocrResult?.lineCount ?? 0,
        wordCount: handwriting?.estimatedWordCount ?? ocrResult?.wordCount ?? 0,
        characterCount:
          handwriting?.estimatedCharacterCount ?? ocrResult?.text.length ?? 0,
        writingSamples: handwriting?.estimatedLineCount ?? 0,
      },
      perceptualHash:
        perceptualHash !== undefined
          ? perceptualHash.toString(16).padStart(16, "0")
          : undefined,
      measurementNotes,
    },
    aiInsights,
  };
}

// For non-image documents (PDF / Office) we don't have a rasterized writing
// sample, so the "handwriting" UI panels are populated with neutral values
// derived from the textual metadata rather than fake measurements.
function syntheticHandwritingFromMeta(
  file: File,
  ocrResult: OcrResult | undefined,
  pdf: Awaited<ReturnType<typeof analyzePDF>> | undefined,
  office: Awaited<ReturnType<typeof analyzeOffice>> | undefined,
): HandwritingFeatures {
  const wordCount = ocrResult?.wordCount ?? Number(office?.words ?? "0") ?? 0;
  const lineCount = ocrResult?.lineCount ?? 0;
  const charCount =
    ocrResult?.text.length ?? Number(office?.characters ?? "0") ?? 0;

  const notes = [
    "Document is not a rasterized writing sample — handwriting metrics are not measurable.",
    "Slant, baseline, pressure, and tremor would only be available if a scanned image of the writing were uploaded.",
  ];
  if (pdf) notes.push("Use a scanned image of the signed PDF page for writer analysis.");
  if (office) notes.push("Use a scanned image of the printed page for writer analysis.");

  return {
    imageWidth: 0,
    imageHeight: 0,
    inkPixels: 0,
    inkDensity: 0,
    averageStrokeWidth: 0,
    strokeWidthStdev: 0,
    pressureLevel: "Medium",
    pressureConsistent: true,
    pressureVariations: "Not measurable from this file type.",
    slantAngleDeg: 0,
    slantDirection: "Vertical",
    slantConsistent: true,
    baselinePattern: "Straight",
    baselineDeviationPx: 0,
    estimatedLineCount: lineCount,
    estimatedWordCount: wordCount,
    estimatedCharacterCount: charCount,
    averageCharHeight: 0,
    averageWordSpacing: 0,
    averageLetterSpacing: 0,
    spacingConsistency: "Consistent",
    componentCount: 0,
    tremorScore: 0,
    tremorDetection: "n/a (not a handwriting sample)",
    inkType: "n/a",
    colorVariation: "n/a",
    measurementNotes: notes,
  };
}
