// Cyber forensics orchestrator. Combines all primitives into the analysis
// result shape consumed by CyberDepartment.tsx, populated entirely from
// real measurements of the uploaded file.
import { computeAllHashes } from "./hashing";
import { detectFileType } from "./file-type";
import { computeEntropy } from "./entropy";
import { extractStrings } from "./strings";
import { extractIOCs, summarizeIOCs } from "./iocs";
import { analyzePE, analyzeELF } from "./headers";
import { analyzeZip } from "./zip";
import { detectSteganography } from "./stego";
import {
  basicFileMetadata,
  extractImageMetadata,
} from "./metadata";

export type CyberProgress = (label: string, frac: number) => void;

export interface CyberAnalysisOutput {
  caseId: string;
  analysis: {
    result_id: string;
    case_id: string;
    analysis_type: "cyber";
    confidence_score: number;
    analysis_steps: string[];
    evidence_found: string[];
    recommendations: string[];
    analysis_date: string;
    analysis_duration_ms: number;
    metadata: Record<string, any>;
  };
  cyberFeatures: {
    fileMetadata: ReturnType<typeof basicFileMetadata>;
    detectedFileType: Awaited<ReturnType<typeof detectFileType>>;
    imageMetadata?: Awaited<ReturnType<typeof extractImageMetadata>>;
    hashAnalysis: {
      hashValues: { md5: string; sha1: string; sha256: string; sha512: string };
      threatScore: number;
      knownThreat: boolean;
      hashMatches: string[];
      methodology: string;
    };
    fileSignature: {
      headerSignature: string;
      magicNumbers: string[];
      signatureMatch: boolean;
      potentialDiscrepancy: boolean;
      explanation: string;
    };
    fileCarving: {
      deletedFiles: number;
      recoveredFragments: number;
      hiddenPartitions: number;
      slackSpace: string;
      methodology: string;
    };
    entropy: Awaited<ReturnType<typeof computeEntropy>>;
    strings: {
      asciiCount: number;
      utf16Count: number;
      sample: Array<{ offset: number; offsetHex: string; text: string }>;
      minLength: number;
    };
    iocs: ReturnType<typeof extractIOCs>;
    iocSummary: string[];
    peInfo?: Awaited<ReturnType<typeof analyzePE>>;
    elfInfo?: Awaited<ReturnType<typeof analyzeELF>>;
    zipListing?: Awaited<ReturnType<typeof analyzeZip>>;
    steganography: Awaited<ReturnType<typeof detectSteganography>>;
    digitalSignature: {
      signed: boolean;
      validity: "valid" | "invalid" | "unknown";
      certificateChain: string[];
      issuer: string;
      note: string;
    };
    networkArtifacts: {
      ipAddresses: string[];
      domains: string[];
      communicationPorts: number[];
      methodology: string;
    };
  };
  aiInsights: string[];
  threatAssessment: "low" | "medium" | "high" | "critical";
  recommendedActions: string[];
}

function tStart(): number {
  return performance.now();
}

export async function analyzeCyberEvidence(
  file: File,
  onProgress?: CyberProgress,
): Promise<CyberAnalysisOutput> {
  const t0 = tStart();
  const caseId = `CYBER-${Date.now()}`;

  onProgress?.("Reading file metadata", 0.02);
  const fileMetadata = basicFileMetadata(file);

  onProgress?.("Detecting file type from magic bytes", 0.06);
  const detectedFileType = await detectFileType(file);

  onProgress?.("Computing cryptographic hashes", 0.1);
  const hashes = await computeAllHashes(file, (label, f) => {
    onProgress?.(`Hashing (${label})`, 0.1 + f * 0.25);
  });

  onProgress?.("Computing Shannon entropy", 0.4);
  const entropy = await computeEntropy(file);

  onProgress?.("Extracting printable strings", 0.5);
  const strings = await extractStrings(file, { minLength: 6, maxResults: 200 });
  const asciiTexts = strings.ascii.map((s) => s.text);
  const utf16Texts = strings.utf16.map((s) => s.text);
  const allText = asciiTexts.join("\n") + "\n" + utf16Texts.join("\n");

  onProgress?.("Extracting indicators of compromise", 0.6);
  const iocs = extractIOCs(allText);
  const iocSummary = summarizeIOCs(iocs);

  let imageMetadata: Awaited<ReturnType<typeof extractImageMetadata>> | undefined;
  if (file.type.startsWith("image/")) {
    onProgress?.("Reading EXIF / XMP / IPTC metadata", 0.65);
    imageMetadata = await extractImageMetadata(file);
  }

  let peInfo: Awaited<ReturnType<typeof analyzePE>> | undefined;
  let elfInfo: Awaited<ReturnType<typeof analyzeELF>> | undefined;
  if (
    detectedFileType.detectedCategory === "executable" ||
    detectedFileType.detectedType.startsWith("Windows PE")
  ) {
    onProgress?.("Parsing PE header", 0.7);
    peInfo = await analyzePE(file);
  }
  if (detectedFileType.detectedType.startsWith("ELF")) {
    onProgress?.("Parsing ELF header", 0.72);
    elfInfo = await analyzeELF(file);
  }

  let zipListing: Awaited<ReturnType<typeof analyzeZip>> | undefined;
  if (detectedFileType.detectedType.includes("ZIP")) {
    onProgress?.("Listing ZIP central directory", 0.74);
    try {
      zipListing = await analyzeZip(file);
    } catch (e) {
      console.warn("ZIP listing failed:", e);
    }
  }

  onProgress?.("Running steganography heuristic", 0.78);
  const steganography = await detectSteganography(file);

  // Synthesize the cyberFeatures shape the UI expects ----------------------
  onProgress?.("Building report", 0.92);

  const fileSignature = {
    headerSignature: detectedFileType.detectedType,
    magicNumbers:
      detectedFileType.headerHex
        .split(" ")
        .slice(0, 8)
        .filter((s) => s.length > 0) || [],
    signatureMatch: detectedFileType.extensionMatchesMagic,
    potentialDiscrepancy:
      !detectedFileType.extensionMatchesMagic &&
      detectedFileType.extension.length > 0,
    explanation: detectedFileType.signatureExplanation,
  };

  // "File carving" in a browser is a heuristic — we count anomalies that
  // would warrant deeper carving with a server-side tool like photorec.
  const fileCarving = (() => {
    let suspiciousCount = 0;
    if (
      asciiTexts.some((s) =>
        /\bPK\x03\x04|<\?xml|MZ\x90|\x7fELF|%PDF-/.test(s),
      )
    )
      suspiciousCount++;
    const trailingZeroBlocks =
      entropy.blockEntropies.filter((e) => e < 0.5).length;
    return {
      deletedFiles: 0,
      recoveredFragments: suspiciousCount,
      hiddenPartitions: 0,
      slackSpace: trailingZeroBlocks > 0
        ? `${trailingZeroBlocks * (entropy.blockSize / 1024)} KB low-entropy padding`
        : "0 KB",
      methodology:
        "Browser-side heuristic — true carving requires server-side tools (photorec, scalpel). Counts embedded-file signatures found in the byte stream and low-entropy padding regions.",
    };
  })();

  // Threat score: combine hash blocklist (none — offline), IOC count, entropy,
  // stego heuristic, and signature/extension mismatch.
  let threatScore = 0;
  if (fileSignature.potentialDiscrepancy) threatScore += 0.25;
  if (entropy.globalEntropy > 7.5 && detectedFileType.detectedCategory !== "archive")
    threatScore += 0.2;
  if (steganography.hiddenDataDetected) threatScore += 0.25;
  if (peInfo?.isDLL || peInfo?.isPE) threatScore += 0.05;
  if (iocs.urls.length > 5) threatScore += 0.1;
  threatScore = Math.min(1, threatScore);

  const cyberFeatures: CyberAnalysisOutput["cyberFeatures"] = {
    fileMetadata,
    detectedFileType,
    imageMetadata,
    hashAnalysis: {
      hashValues: hashes,
      threatScore: Number(threatScore.toFixed(3)),
      knownThreat: false, // No offline threat-intel DB shipped
      hashMatches: [],
      methodology:
        "All four hashes computed by hash-wasm streaming hashers. The file is read in 1 MiB slices and each slice is fed into the WASM hasher; the event loop is yielded between slices so the UI stays responsive even for multi-GB evidence files. The same byte stream is consumed by every algorithm, so the resulting digests are mutually consistent and reproducible bit-for-bit.",
    },
    fileSignature,
    fileCarving,
    entropy,
    strings: {
      asciiCount: strings.totalAscii,
      utf16Count: strings.totalUtf16,
      // Each sample now carries the byte offset where it was found, so an
      // examiner can locate it directly in the original file.
      sample: strings.ascii.slice(0, 25).map((s) => ({
        offset: s.offset,
        offsetHex: `0x${s.offset.toString(16).toUpperCase().padStart(8, "0")}`,
        text: s.text,
      })),
      minLength: strings.minLength,
    },
    iocs,
    iocSummary,
    peInfo,
    elfInfo,
    zipListing,
    steganography,
    digitalSignature: {
      signed: peInfo?.isPE
        ? false // We can't validate Authenticode signatures purely client-side
        : false,
      validity: "unknown",
      certificateChain: [],
      issuer: "(client-side validation not available)",
      note: "Authenticode / X.509 signature validation requires server-side cert chain verification.",
    },
    networkArtifacts: {
      ipAddresses: [...iocs.ipv4, ...iocs.ipv6].slice(0, 50),
      domains: iocs.domains.slice(0, 50),
      communicationPorts: extractPortsFromText(allText),
      methodology:
        "Extracted by regex from printable strings discovered in the binary.",
    },
  };

  // Threat assessment & recommendations
  const aiInsights: string[] = [];
  if (fileSignature.potentialDiscrepancy)
    aiInsights.push(
      `File extension .${detectedFileType.extension} does not match detected type "${detectedFileType.detectedType}".`,
    );
  if (entropy.globalEntropy > 7.5)
    aiInsights.push(
      `${entropy.classification} (entropy=${entropy.globalEntropy.toFixed(2)} bits/byte).`,
    );
  if (steganography.hiddenDataDetected)
    aiInsights.push(
      `Steganography heuristic flagged the LSB plane (chi-square ratio ≪ 1).`,
    );
  if (peInfo?.isPE)
    aiInsights.push(
      `Windows PE binary — ${peInfo.machine}, ${peInfo.numberOfSections} sections, ${peInfo.isDLL ? "DLL" : "EXE"}.`,
    );
  if (elfInfo?.isELF)
    aiInsights.push(
      `${elfInfo.bitness}-bit ${elfInfo.endianness}-endian ELF for ${elfInfo.machine}.`,
    );
  if (imageMetadata?.geolocation)
    aiInsights.push(
      `Image contains GPS coordinates (${imageMetadata.geolocation.lat.toFixed(4)}, ${imageMetadata.geolocation.lng.toFixed(4)}).`,
    );
  if (iocSummary.length > 0)
    aiInsights.push(`Indicators surfaced: ${iocSummary.join(", ")}.`);

  if (aiInsights.length === 0)
    aiInsights.push("No anomalous indicators surfaced from static analysis.");

  let threatAssessment: CyberAnalysisOutput["threatAssessment"] = "low";
  if (threatScore >= 0.6) threatAssessment = "high";
  else if (threatScore >= 0.4) threatAssessment = "medium";
  if (steganography.hiddenDataDetected && threatAssessment === "low")
    threatAssessment = "medium";

  const recommendedActions: string[] = [];
  if (fileSignature.potentialDiscrepancy)
    recommendedActions.push(
      "Investigate file extension mismatch — file may be disguised.",
    );
  if (steganography.hiddenDataDetected)
    recommendedActions.push(
      "Run a server-side stego extractor (zsteg, stegseek) on this image.",
    );
  if (peInfo?.isPE || elfInfo?.isELF)
    recommendedActions.push(
      "Submit binary to a sandbox for behavioral analysis before opening.",
    );
  if (entropy.globalEntropy > 7.5)
    recommendedActions.push(
      "High entropy may indicate encryption — verify there is no concealed payload.",
    );
  recommendedActions.push("Preserve chain-of-custody documentation.");
  recommendedActions.push(
    "Cross-reference SHA-256 against external threat-intel databases (VirusTotal, MalwareBazaar).",
  );

  // Confidence reflects measurement coverage: full hashing + entropy + strings
  // + magic + (image meta if applicable) ⇒ 90+ baseline.
  let confidence = 90;
  if (file.size === 0) confidence = 30;
  if (entropy.globalEntropy === 0) confidence -= 10;

  const t1 = tStart();
  onProgress?.("Done", 1);

  const evidenceFound: string[] = [
    `File type identified: ${detectedFileType.detectedType}`,
    `MD5: ${hashes.md5}`,
    `SHA-256: ${hashes.sha256}`,
    `Shannon entropy: ${entropy.globalEntropy.toFixed(2)} bits/byte (${entropy.classification})`,
    `Printable strings: ${strings.totalAscii} ASCII + ${strings.totalUtf16} UTF-16`,
    ...iocSummary.map((s) => `IOC: ${s}`),
  ];
  if (imageMetadata?.hasExif) evidenceFound.push(`EXIF metadata: ${imageMetadata.rawKeys.length} fields`);
  if (peInfo?.isPE) evidenceFound.push(`PE header parsed: ${peInfo.machine}, ${peInfo.numberOfSections} sections`);
  if (elfInfo?.isELF) evidenceFound.push(`ELF header parsed: ${elfInfo.bitness}-bit ${elfInfo.machine}`);
  if (steganography.applicable)
    evidenceFound.push(
      `Stego heuristic: chi-square ${steganography.chiSquare.toFixed(1)} / dof ${steganography.expectedChiSquare} ⇒ ${steganography.hiddenDataDetected ? "SUSPICIOUS" : "clean"}`,
    );

  return {
    caseId,
    analysis: {
      result_id: `cyber-${Date.now()}`,
      case_id: caseId,
      analysis_type: "cyber",
      confidence_score: confidence,
      analysis_steps: [
        "Extract basic file metadata",
        "Detect file type via magic bytes",
        "Compute MD5, SHA-1, SHA-256, SHA-512 hashes",
        "Compute Shannon entropy (global + per-block)",
        "Extract printable ASCII / UTF-16 strings",
        "Run IOC regex extraction over strings",
        ...(imageMetadata ? ["Parse EXIF / XMP / IPTC metadata"] : []),
        ...(peInfo?.isPE ? ["Parse PE/COFF header"] : []),
        ...(elfInfo?.isELF ? ["Parse ELF header"] : []),
        ...(steganography.applicable
          ? ["Run LSB chi-square steganography heuristic"]
          : []),
        "Synthesize threat assessment",
      ],
      evidence_found: evidenceFound,
      recommendations: recommendedActions,
      analysis_date: new Date().toISOString(),
      analysis_duration_ms: Math.round(t1 - t0),
      metadata: {
        file_name: file.name,
        file_size: file.size,
        processing_algorithm: "Pratyaksh-RealCyberPipeline-v1",
        source: "browser-side-real-analysis",
      },
    },
    cyberFeatures,
    aiInsights,
    threatAssessment,
    recommendedActions,
  };
}

function extractPortsFromText(text: string): number[] {
  const out = new Set<number>();
  const re = /\b(?:port|tcp|udp)[:= ]\s*(\d{1,5})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const p = parseInt(m[1], 10);
    if (p > 0 && p <= 65535) out.add(p);
  }
  // Also pick up host:port forms in URLs
  const urlPort = /:\/\/[^/\s:]+:(\d{2,5})\b/g;
  while ((m = urlPort.exec(text))) {
    const p = parseInt(m[1], 10);
    if (p > 0 && p <= 65535) out.add(p);
  }
  return Array.from(out).sort((a, b) => a - b).slice(0, 20);
}
