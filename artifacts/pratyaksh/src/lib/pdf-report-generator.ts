// Professional PDF report generator for Pratyaksh Forensic AI.
// Bundled jsPDF + jspdf-autotable — fully offline, no CDN.

import jsPDF from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import type { CaseModeResult, ModeFinding } from "./forensics/common/types";
import type { DiskAnalysisPayload } from "./forensics/disk";
import type { MalwareAnalysisPayload } from "./forensics/malware";
import type { PcapSummaryPayload } from "./forensics/pcap";
import type { MemLogPayload } from "./forensics/memlog";
import type { EmailPayload } from "./forensics/email";
import type { SqlitePayload } from "./forensics/sqlite";

// ─────────────────────────────────────────────────────────────────────────────
// Typed adapters around the few dynamic jsPDF surfaces (GState, image format)
// so the rest of the file is `any`-free.
// ─────────────────────────────────────────────────────────────────────────────
interface JsPdfGStateClass {
  new (params: { opacity?: number }): unknown;
}
/**
 * Surface for the optional graphics-state APIs used to draw the watermark.
 * jsPDF exposes these at runtime via the GState plugin, but the bundled type
 * definitions either omit `GState` or require a non-optional `setGState`.
 * We narrow only at the call site so the rest of the file stays jsPDF-typed.
 */
interface GraphicsStateApi {
  GState?: JsPdfGStateClass;
  setGState?: (state: unknown) => void;
}
type ImageFormat = "PNG" | "JPEG" | "WEBP";

export interface EmbeddedEvidenceImage {
  /** A `data:image/...;base64,…` URL */
  dataUrl: string;
  format: ImageFormat;
  /** Pixel size, used to compute aspect ratio when rendering. */
  width: number;
  height: number;
  caption?: string;
}

export interface ReportExaminer {
  name?: string;
  title?: string;
  department?: string;
  employeeId?: string;
}

export interface ReportData {
  caseId: string;
  analysisResult: {
    confidence_score?: number;
    analysis_date?: string | number | Date;
    analysis_steps?: string[];
    evidence_found?: string[];
    recommendations?: string[];
    [key: string]: unknown;
  };
  cyberFeatures?: Record<string, unknown>;
  documentFeatures?: Record<string, unknown>;
  reportType: "cyber" | "document";
  examiner?: ReportExaminer;
  /** Optional embedded image of the questioned evidence. */
  evidenceImage?: EmbeddedEvidenceImage | null;
}

const BRAND = {
  primary: [11, 30, 60] as [number, number, number],
  accent: [37, 99, 235] as [number, number, number],
  cyber: [124, 58, 237] as [number, number, number],
  document: [16, 185, 129] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  hairline: [203, 213, 225] as [number, number, number],
  lightFill: [248, 250, 252] as [number, number, number],
  warning: [220, 38, 38] as [number, number, number],
};

const PAGE = { margin: 18 };

function formatDate(value: unknown): string {
  if (!value) return "—";
  try {
    const d = new Date(value as string | number | Date);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  } catch {
    return String(value);
  }
}

function safe(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return String(value);
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  return null;
}

interface DocCtx {
  doc: jsPDF;
  pageW: number;
  pageH: number;
  accent: [number, number, number];
  data: ReportData;
  reportLabel: string;
  generatedAt: Date;
  reportId: string;
}

function makeReportId(caseId: string): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `RPT-${caseId}-${stamp}`;
}

function setText(doc: jsPDF, color: [number, number, number]) {
  doc.setTextColor(color[0], color[1], color[2]);
}
function setFill(doc: jsPDF, color: [number, number, number]) {
  doc.setFillColor(color[0], color[1], color[2]);
}
function setStroke(doc: jsPDF, color: [number, number, number]) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cover page
// ─────────────────────────────────────────────────────────────────────────────
function drawCover(ctx: DocCtx) {
  const { doc, pageW, pageH, accent, data, reportLabel, generatedAt, reportId } = ctx;

  setFill(doc, BRAND.primary);
  doc.rect(0, 0, pageW, 70, "F");
  setFill(doc, accent);
  doc.rect(0, 70, pageW, 4, "F");

  setFill(doc, accent);
  doc.circle(28, 38, 9, "F");
  doc.setFont("helvetica", "bold");
  setText(doc, [255, 255, 255]);
  doc.setFontSize(14);
  doc.text("P", 28, 42, { align: "center" });

  setText(doc, [255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("PRATYAKSH FORENSIC AI", 44, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Verifiable Digital & Document Forensic Examination", 44, 46);

  doc.setFontSize(9);
  doc.text("OFFICIAL USE ONLY", pageW - PAGE.margin, 16, { align: "right" });
  doc.text(reportId, pageW - PAGE.margin, 22, { align: "right" });

  setText(doc, BRAND.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(reportLabel.toUpperCase(), PAGE.margin, 110);

  setText(doc, BRAND.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("A reproducible, on-device forensic examination report.", PAGE.margin, 120);

  const cardY = 138;
  setFill(doc, BRAND.lightFill);
  setStroke(doc, BRAND.hairline);
  doc.roundedRect(PAGE.margin, cardY, pageW - PAGE.margin * 2, 70, 3, 3, "FD");

  const examiner = data.examiner ?? {};
  const cyberMeta = getRecord(data.cyberFeatures?.fileMetadata);
  const docMeta = getRecord(data.documentFeatures?.fileMetadata);
  const fileMeta = cyberMeta ?? docMeta ?? {};
  const fileName = (fileMeta.fileName as string | undefined) ?? "—";

  setText(doc, BRAND.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("CASE BRIEF", PAGE.margin + 6, cardY + 10);

  const rows: Array<[string, string]> = [
    ["Case ID", safe(data.caseId)],
    ["Report ID", reportId],
    ["Report Type", reportLabel],
    [
      "Confidence Score",
      typeof data.analysisResult?.confidence_score === "number"
        ? `${data.analysisResult.confidence_score}%`
        : "—",
    ],
    ["Evidence File", String(fileName)],
    ["Acquired", formatDate(data.analysisResult?.analysis_date)],
    ["Report Generated", formatDate(generatedAt)],
    [
      "Examiner",
      [examiner.name, examiner.title].filter(Boolean).join(" · ") || "Pratyaksh Analyst",
    ],
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  rows.forEach((row, i) => {
    const col = i % 2;
    const line = Math.floor(i / 2);
    const x = PAGE.margin + 6 + col * ((pageW - PAGE.margin * 2 - 12) / 2);
    const y = cardY + 22 + line * 12;
    setText(doc, BRAND.muted);
    doc.text(row[0], x, y);
    setText(doc, BRAND.primary);
    doc.setFont("helvetica", "bold");
    const value = doc.splitTextToSize(row[1], 75);
    doc.text(value, x, y + 5);
    doc.setFont("helvetica", "normal");
  });

  setFill(doc, accent);
  doc.rect(0, pageH - 26, pageW, 26, "F");
  setText(doc, [255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("CONFIDENTIAL — HANDLE PER EVIDENCE-CHAIN POLICY", pageW / 2, pageH - 12, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Generated by Pratyaksh Forensic AI · ${formatDate(generatedAt)}`,
    pageW / 2,
    pageH - 5,
    { align: "center" },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section helpers
// ─────────────────────────────────────────────────────────────────────────────
function addSectionHeader(
  doc: jsPDF,
  title: string,
  y: number,
  accent: [number, number, number],
): number {
  setFill(doc, accent);
  doc.rect(PAGE.margin, y, 3, 8, "F");
  setText(doc, BRAND.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title.toUpperCase(), PAGE.margin + 6, y + 6);
  setStroke(doc, BRAND.hairline);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, y + 10, doc.internal.pageSize.getWidth() - PAGE.margin, y + 10);
  return y + 16;
}

function addParagraph(doc: jsPDF, text: string, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const maxWidth = pageW - PAGE.margin * 2;
  setText(doc, BRAND.primary);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, PAGE.margin, y);
  return y + lines.length * 5 + 4;
}

function addHowMeasuredBlock(
  doc: jsPDF,
  title: string,
  body: string,
  y: number,
  accent: [number, number, number],
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const maxWidth = pageW - PAGE.margin * 2 - 8;
  setText(doc, BRAND.primary);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(body, maxWidth);
  const blockH = 8 + lines.length * 4.5 + 4;
  setFill(doc, BRAND.lightFill);
  setStroke(doc, accent);
  doc.setLineWidth(0.4);
  doc.roundedRect(PAGE.margin, y, pageW - PAGE.margin * 2, blockH, 2, 2, "FD");
  setText(doc, accent);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`HOW MEASURED — ${title.toUpperCase()}`, PAGE.margin + 4, y + 5);
  setText(doc, BRAND.primary);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(lines, PAGE.margin + 4, y + 10);
  return y + blockH + 6;
}

function addKeyValueTable(
  doc: jsPDF,
  rows: Array<[string, string]>,
  startY: number,
): number {
  const body: RowInput[] = rows.map(([k, v]) => [k, v]);
  autoTable(doc, {
    startY,
    margin: { left: PAGE.margin, right: PAGE.margin },
    head: [],
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      cellPadding: 2.5,
      textColor: BRAND.primary,
      lineColor: BRAND.hairline,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: {
        fontStyle: "bold",
        fillColor: BRAND.lightFill,
        textColor: BRAND.muted,
        cellWidth: 55,
      },
      1: { fillColor: [255, 255, 255] },
    },
  });
  return getLastTableY(doc) + 6;
}

function getLastTableY(doc: jsPDF): number {
  const internal = doc as unknown as { lastAutoTable?: { finalY: number } };
  return internal.lastAutoTable?.finalY ?? PAGE.margin;
}

function addBulletList(doc: jsPDF, items: string[], startY: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  let y = startY;
  setText(doc, BRAND.primary);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const item of items) {
    if (y > pageH - 30) {
      doc.addPage();
      y = PAGE.margin;
    }
    const lines = doc.splitTextToSize(
      `• ${item}`,
      doc.internal.pageSize.getWidth() - PAGE.margin * 2 - 4,
    );
    doc.text(lines, PAGE.margin + 2, y);
    y += lines.length * 5 + 1;
  }
  return y + 4;
}

function ensureSpace(doc: jsPDF, currentY: number, required: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (currentY + required > pageH - 28) {
    doc.addPage();
    return PAGE.margin;
  }
  return currentY;
}

function addEmbeddedImage(ctx: DocCtx, startY: number): number {
  const img = ctx.data.evidenceImage;
  if (!img || !img.dataUrl) return startY;
  const { doc, accent } = ctx;
  const maxW = doc.internal.pageSize.getWidth() - PAGE.margin * 2;
  const maxH = 90;
  const aspect = img.width > 0 && img.height > 0 ? img.width / img.height : 4 / 3;
  let renderW = maxW;
  let renderH = renderW / aspect;
  if (renderH > maxH) {
    renderH = maxH;
    renderW = renderH * aspect;
  }
  const xCenter = (doc.internal.pageSize.getWidth() - renderW) / 2;
  let y = ensureSpace(doc, startY, renderH + 22);
  y = addSectionHeader(doc, "Evidence Preview", y, accent);
  try {
    doc.addImage(img.dataUrl, img.format, xCenter, y, renderW, renderH);
  } catch (err) {
    setText(doc, BRAND.warning);
    doc.setFontSize(9);
    doc.text(`Could not embed evidence image: ${(err as Error).message}`, PAGE.margin, y + 6);
    setText(doc, BRAND.primary);
    return y + 14;
  }
  y += renderH + 4;
  if (img.caption) {
    setText(doc, BRAND.muted);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "italic");
    doc.text(img.caption, doc.internal.pageSize.getWidth() / 2, y, { align: "center" });
    doc.setFont("helvetica", "normal");
    setText(doc, BRAND.primary);
    y += 6;
  }
  return y + 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// Body sections
// ─────────────────────────────────────────────────────────────────────────────
function addChainOfCustody(ctx: DocCtx, startY: number): number {
  const { doc, data, reportId, generatedAt, accent } = ctx;
  let y = ensureSpace(doc, startY, 80);
  y = addSectionHeader(doc, "Chain of Custody", y, accent);

  const fileMeta =
    getRecord(data.cyberFeatures?.fileMetadata) ??
    getRecord(data.documentFeatures?.fileMetadata) ??
    {};
  const hashes =
    getRecord(getRecord(data.cyberFeatures?.hashAnalysis)?.hashValues) ??
    getRecord(getRecord(data.documentFeatures?.hashAnalysis)?.hashValues) ??
    {};

  const rawSize = fileMeta.fileSize;
  const sizeStr =
    typeof rawSize === "number" ? `${(rawSize / 1024).toFixed(2)} KB` : "—";
  const sha512 = hashes.sha512;
  const sha512Str =
    typeof sha512 === "string" ? `${sha512.slice(0, 80)}…` : "—";

  const rows: Array<[string, string]> = [
    ["Case ID", safe(data.caseId)],
    ["Report ID", reportId],
    ["Original File Name", safe(fileMeta.fileName)],
    ["Original File Size", sizeStr],
    ["MIME Type", safe(fileMeta.mimeType)],
    ["Acquisition Time", formatDate(data.analysisResult?.analysis_date)],
    ["Report Generated", formatDate(generatedAt)],
    ["MD5", safe(hashes.md5)],
    ["SHA-1", safe(hashes.sha1)],
    ["SHA-256", safe(hashes.sha256)],
    ["SHA-512", sha512Str],
  ];
  y = addKeyValueTable(doc, rows, y);
  y = addHowMeasuredBlock(
    doc,
    "Chain of custody",
    "All four digests are computed in a single streaming pass with `hash-wasm`. Re-running this analysis on the same byte stream must reproduce every value above; a single bit flip cascades through SHA-256 and SHA-512.",
    y,
    accent,
  );
  return y;
}

function addMethodology(ctx: DocCtx, startY: number): number {
  const { doc, data, accent } = ctx;
  let y = ensureSpace(doc, startY, 60);
  y = addSectionHeader(doc, "Methodology", y, accent);
  const text =
    data.reportType === "cyber"
      ? "The evidence file was acquired into the Pratyaksh on-device pipeline, hashed with MD5/SHA-1/SHA-256/SHA-512 in a single streaming pass using `hash-wasm`, and inspected for file-signature consistency against a built-in magic-number table. Strings were extracted with byte-offset capture, indicators of compromise (URLs, IPv4 addresses, e-mail addresses, BTC wallets, registry keys and known-bad command substrings) were enumerated by deterministic regular expressions, and Shannon entropy was computed in 4 KiB sliding windows to flag packed or encrypted regions. Container formats (ZIP/OOXML, PDF) were walked structurally to enumerate embedded files, suspicious actions and metadata."
      : "The questioned document was loaded into the Pratyaksh document pipeline. Image-based inputs were binarised, skeletonised and analysed for slant, pressure, baseline drift, spacing, x-height, stroke width, ligature count and contour tremor. PDFs were parsed for the document Info dictionary, XMP metadata and revision history. When a comparison sample was supplied, four independent similarity measures were combined into a single writer-match score: perceptual-hash distance, OCR-text Jaccard overlap, slant delta and stroke-width delta, weighted 0.40/0.20/0.20/0.20.";
  y = addParagraph(doc, text, y);
  const steps = data.analysisResult?.analysis_steps;
  if (Array.isArray(steps) && steps.length > 0) {
    y = addBulletList(doc, steps, y);
  } else {
    y = addParagraph(
      doc,
      "_No discrete pipeline steps were recorded for this analysis._",
      y,
    );
  }
  return y;
}

function addEvidenceSummary(ctx: DocCtx, startY: number): number {
  const { doc, data, accent } = ctx;
  let y = ensureSpace(doc, startY, 50);
  y = addSectionHeader(doc, "Evidence Summary", y, accent);
  const items: string[] = data.analysisResult?.evidence_found ?? [];
  if (items.length === 0) {
    y = addParagraph(
      doc,
      "No discrete evidence items were enumerated for this analysis. The chain-of-custody hashes and methodology section still constitute a verifiable record of the examination performed.",
      y,
    );
  } else {
    y = addBulletList(doc, items, y);
  }
  return y;
}

// ─────────────────── Cyber sections (always rendered) ────────────────────────
function addFileSignatureSection(ctx: DocCtx, startY: number): number {
  const { doc, data, accent } = ctx;
  const sig = getRecord(data.cyberFeatures?.fileSignature);
  let y = ensureSpace(doc, startY, 60);
  y = addSectionHeader(doc, "File Signature", y, accent);
  if (!sig) {
    y = addParagraph(
      doc,
      "_No file-signature record was attached to this analysis. The chain-of-custody section still records the declared MIME type._",
      y,
    );
  } else {
    const rows: Array<[string, string]> = [
      ["Header Signature", safe(sig.headerSignature)],
      [
        "Magic Numbers",
        Array.isArray(sig.magicNumbers)
          ? sig.magicNumbers.join(", ")
          : safe(sig.magicNumbers),
      ],
      ["Detected Type", safe(sig.detectedType)],
      ["Declared Extension", safe(sig.declaredExtension)],
      ["Signature Match", sig.signatureMatch ? "Yes" : "No"],
    ];
    y = addKeyValueTable(doc, rows, y);
    if (sig.potentialDiscrepancy) {
      setText(doc, BRAND.warning);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("⚠ Potential extension/signature mismatch detected.", PAGE.margin, y);
      doc.setFont("helvetica", "normal");
      setText(doc, BRAND.primary);
      y += 8;
    }
  }
  y = addHowMeasuredBlock(
    doc,
    "File signature",
    "The first 16 bytes of the upload are matched against an in-process magic-number table (PNG, JPEG, PDF, ZIP, ELF, …). A mismatch between the declared extension and the detected type raises `potentialDiscrepancy: true`.",
    y,
    accent,
  );
  return y;
}

function addIocSection(ctx: DocCtx, startY: number): number {
  const { doc, data, accent } = ctx;
  let y = ensureSpace(doc, startY, 60);
  y = addSectionHeader(doc, "Indicators of Compromise", y, accent);
  const iocs =
    getRecord(data.cyberFeatures?.iocs) ?? getRecord(data.cyberFeatures?.indicators);
  const buckets: Array<[string, unknown[]]> = [];
  if (iocs) {
    for (const [k, v] of Object.entries(iocs)) {
      if (Array.isArray(v) && v.length > 0) buckets.push([k, v]);
    }
  }
  if (buckets.length === 0) {
    y = addParagraph(
      doc,
      "_No indicators of compromise were enumerated. The deterministic IOC scanner ran but did not surface URLs, IPv4 addresses, e-mail addresses, wallets, registry keys or known-bad strings above its confidence threshold._",
      y,
    );
  } else {
    const body: RowInput[] = [];
    for (const [type, hits] of buckets) {
      for (const hit of (hits as unknown[]).slice(0, 25)) {
        let value: string;
        let offset = "—";
        if (typeof hit === "string") {
          value = hit;
        } else {
          const rec = getRecord(hit);
          value = safe(rec?.value ?? rec?.match);
          if (rec && "offset" in rec) offset = String(rec.offset);
        }
        body.push([type, value, offset]);
      }
    }
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.margin, right: PAGE.margin },
      head: [["Type", "Value", "Byte offset"]],
      body,
      theme: "striped",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 2,
        textColor: BRAND.primary,
      },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: BRAND.lightFill },
    });
    y = getLastTableY(doc) + 6;
  }
  y = addHowMeasuredBlock(
    doc,
    "IOCs",
    "Each IOC class is matched by a deterministic regular expression against the decoded byte stream. Byte offsets are captured at match time so an analyst can pivot to the location in a hex viewer.",
    y,
    accent,
  );
  return y;
}

function addCarvingSection(ctx: DocCtx, startY: number): number {
  const { doc, data, accent } = ctx;
  let y = ensureSpace(doc, startY, 50);
  y = addSectionHeader(doc, "File Carving", y, accent);
  const c = getRecord(data.cyberFeatures?.fileCarving);
  if (!c) {
    y = addParagraph(
      doc,
      "_No carving pass was performed on this evidence. Carving is automatically engaged for archive containers (ZIP/OOXML) and PDF objects._",
      y,
    );
  } else {
    const rows: Array<[string, string]> = [
      ["Deleted Files Found", safe(c.deletedFiles)],
      ["Recovered Fragments", safe(c.recoveredFragments)],
      ["Hidden Partitions", safe(c.hiddenPartitions)],
      ["Slack Space", safe(c.slackSpace)],
    ];
    y = addKeyValueTable(doc, rows, y);
  }
  y = addHowMeasuredBlock(
    doc,
    "Carving",
    "Header/footer magic-pair scans locate embedded payloads; archive Central Directories enumerate compressed entries with CRC-32; PDF object trees flag embedded JS and `/Launch` actions.",
    y,
    accent,
  );
  return y;
}

// ─────────────────── Document sections (always rendered) ─────────────────────
function addHandwritingSection(ctx: DocCtx, startY: number): number {
  const { doc, data, accent } = ctx;
  let y = ensureSpace(doc, startY, 60);
  y = addSectionHeader(doc, "Handwriting Characteristics", y, accent);
  const h = getRecord(data.documentFeatures?.handwritingCharacteristics);
  if (!h) {
    y = addParagraph(
      doc,
      "_No handwriting features were extracted. This is expected for native PDFs without embedded raster signatures or for non-image questioned documents._",
      y,
    );
  } else {
    const tremor =
      h.tremor ?? getRecord(data.documentFeatures?.forgeryDetection)?.tremor;
    const rows: Array<[string, string]> = [
      ["Pressure", safe(h.pressure)],
      ["Slant", safe(h.slant)],
      ["Spacing", safe(h.spacing)],
      ["Baseline", safe(h.baseline)],
      ["Size", safe(h.size)],
      ["Connecting Strokes", safe(h.connecting_strokes ?? h.connectingStrokes)],
      ["Stroke Width", safe(h.strokeWidth ?? h.stroke_width)],
      ["Ink Type", safe(h.inkType ?? h.ink_type)],
      ["Tremor", safe(tremor)],
    ];
    y = addKeyValueTable(doc, rows, y);
  }
  y = addHowMeasuredBlock(
    doc,
    "Handwriting",
    "Image is binarised (Otsu) and skeletonised. Slant is the mean angle of vertical strokes; pressure derives from grayscale intensity along the skeleton; tremor is the high-frequency oscillation along stroke contours.",
    y,
    accent,
  );
  return y;
}

function addDocumentPropertiesSection(ctx: DocCtx, startY: number): number {
  const { doc, data, accent } = ctx;
  let y = ensureSpace(doc, startY, 50);
  y = addSectionHeader(doc, "Document Properties", y, accent);
  const props =
    getRecord(data.documentFeatures?.documentProperties) ??
    getRecord(data.documentFeatures?.pdfProperties);
  if (!props) {
    y = addParagraph(
      doc,
      "_No PDF Info dictionary or XMP metadata was attached to this analysis. This is expected for image-only questioned documents._",
      y,
    );
  } else {
    const rows: Array<[string, string]> = Object.entries(props)
      .filter(([k]) => k !== "revisions" && k !== "history")
      .map(([k, v]) => [k, safe(v)]);
    if (rows.length) y = addKeyValueTable(doc, rows, y);
    const revisions = props.revisions ?? props.history;
    if (Array.isArray(revisions) && revisions.length) {
      y = ensureSpace(doc, y, 30);
      autoTable(doc, {
        startY: y,
        margin: { left: PAGE.margin, right: PAGE.margin },
        head: [["#", "When", "By", "Action"]],
        body: revisions.map((r: unknown, i: number) => {
          const rec = getRecord(r) ?? {};
          return [
            String(i + 1),
            formatDate(rec.when ?? rec.date),
            safe(rec.by ?? rec.author),
            safe(rec.action ?? rec.event ?? rec.note),
          ];
        }),
        theme: "striped",
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 2,
          textColor: BRAND.primary,
        },
        headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: BRAND.lightFill },
      });
      y = getLastTableY(doc) + 6;
    } else {
      y = addParagraph(
        doc,
        "_No revision history was recorded for this document._",
        y,
      );
    }
  }
  y = addHowMeasuredBlock(
    doc,
    "Document properties",
    "PDF Info dictionary and XMP metadata are parsed losslessly. Mismatch between `CreationDate` and `ModDate`, or between `Producer` and `Creator`, is flagged as a possible post-authoring modification.",
    y,
    accent,
  );
  return y;
}

function addComparisonSection(ctx: DocCtx, startY: number): number {
  const { doc, data, accent } = ctx;
  let y = ensureSpace(doc, startY, 50);
  y = addSectionHeader(doc, "Writer Comparison", y, accent);
  const comp = getRecord(data.documentFeatures?.comparisonAnalysis);
  if (!comp || !comp.hasComparison) {
    y = addParagraph(
      doc,
      "_No comparison sample was supplied. Upload a known exemplar in the Documents lab to engage the four-axis writer-match scorer (perceptual-hash distance, OCR Jaccard overlap, slant delta, stroke-width delta)._",
      y,
    );
  } else {
    const rows: Array<[string, string]> = [
      [
        "Match Score",
        typeof comp.matchScore === "number"
          ? `${Math.round(comp.matchScore * 100)} / 100`
          : "—",
      ],
      ["Interpretation", safe(comp.interpretation)],
      ["Perceptual Hash Distance", safe(comp.pHashDistance ?? comp.phashDistance)],
      ["OCR Jaccard Overlap", safe(comp.jaccard)],
      ["Slant Delta", safe(comp.slantDelta)],
      ["Stroke-Width Delta", safe(comp.strokeWidthDelta)],
    ];
    y = addKeyValueTable(doc, rows, y);
  }
  y = addHowMeasuredBlock(
    doc,
    "Writer comparison",
    "Score = 0.40·(1 − pHash/64) + 0.20·jaccard + 0.20·(1 − |Δslant|/45) + 0.20·(1 − |Δstroke|/4). > 0.75 supports common authorship; < 0.45 supports different authorship.",
    y,
    accent,
  );
  return y;
}

function addCyberSpecific(ctx: DocCtx, startY: number): number {
  let y = startY;
  y = addFileSignatureSection(ctx, y);
  y = addIocSection(ctx, y);
  y = addCarvingSection(ctx, y);
  y = addModeResultsSection(ctx, y);
  return y;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-mode Cyber Lab — per-mode PDF renderers
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_FILL: Record<ModeFinding["severity"], [number, number, number]> = {
  crit: [220, 38, 38],
  high: [234, 88, 12],
  med: [202, 138, 4],
  low: [37, 99, 235],
  info: [107, 114, 128],
};

function addFindingsTable(
  ctx: DocCtx,
  findings: ModeFinding[],
  startY: number,
): number {
  const { doc, accent } = ctx;
  let y = ensureSpace(doc, startY, 30);
  if (findings.length === 0) {
    return addParagraph(doc, "_No findings surfaced for this mode._", y);
  }
  autoTable(doc, {
    startY: y,
    margin: { left: PAGE.margin, right: PAGE.margin },
    head: [["Sev", "Title", "Detail / Where"]],
    body: findings.slice(0, 60).map((f) => [
      f.severity.toUpperCase(),
      f.title,
      [f.detail ?? "", f.where ? `@ ${f.where}` : ""].filter(Boolean).join(" — "),
    ]),
    theme: "striped",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: BRAND.primary },
    headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: BRAND.lightFill },
    columnStyles: {
      0: { cellWidth: 14, fontStyle: "bold" },
      1: { cellWidth: 70 },
    },
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.column.index === 0) {
        const sev = (findings[hook.row.index].severity ?? "info") as ModeFinding["severity"];
        hook.cell.styles.fillColor = SEVERITY_FILL[sev];
        hook.cell.styles.textColor = [255, 255, 255];
      }
    },
  });
  return getLastTableY(doc) + 6;
}

function addModeHeader(ctx: DocCtx, label: string, headline: string, durationMs: number, y: number): number {
  const { doc, accent } = ctx;
  let yy = ensureSpace(doc, y, 30);
  yy = addSectionHeader(doc, label, yy, accent);
  yy = addParagraph(doc, `${headline} · run time ${durationMs} ms`, yy);
  return yy;
}

function diskRenderer(ctx: DocCtx, r: CaseModeResult<DiskAnalysisPayload>, startY: number): number {
  const { doc, accent } = ctx;
  let y = addModeHeader(ctx, `Mode — ${r.modeLabel}`, r.headline, r.durationMs, startY);
  const p = r.payload;
  y = addKeyValueTable(
    doc,
    [
      ["Scheme", p.table.scheme],
      ["Disk ID", p.table.diskId],
      ["Image Size", `${p.imageSize.toLocaleString()} bytes`],
      ["Partitions", String(p.table.partitions.length)],
    ],
    y,
  );
  if (p.views.length > 0) {
    y = ensureSpace(doc, y, 30);
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.margin, right: PAGE.margin },
      head: [["#", "Type", "FS", "Start (B)", "Size (KiB)", "Entries", "Deleted"]],
      body: p.views.map((v) => {
        const fs = v.filesystem;
        let entries = 0;
        let deleted = 0;
        if (fs.kind === "fat") {
          entries = fs.volume.entries.length;
          deleted = fs.volume.entries.filter((e) => e.deleted).length;
        } else if (fs.kind === "ntfs" || fs.kind === "ext") {
          entries = fs.volume.files.length;
          deleted = fs.volume.files.filter((f) => f.deleted).length;
        }
        return [
          String(v.partition.index),
          v.partition.typeName,
          fs.kind,
          v.partition.start.toString(),
          (v.partition.size / 1024).toFixed(1),
          String(entries),
          String(deleted),
        ];
      }),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: BRAND.primary },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: BRAND.lightFill },
    });
    y = getLastTableY(doc) + 6;
  }
  y = addFindingsTable(ctx, r.findings, y);
  y = addHowMeasuredBlock(doc, "Disk imaging", r.methodology.join(" "), y, accent);
  return y;
}

function malwareRenderer(ctx: DocCtx, r: CaseModeResult<MalwareAnalysisPayload>, startY: number): number {
  const { doc, accent } = ctx;
  let y = addModeHeader(ctx, `Mode — ${r.modeLabel}`, r.headline, r.durationMs, startY);
  const p = r.payload;
  y = addKeyValueTable(
    doc,
    [
      ["File", `${p.fileName} (${p.fileSize.toLocaleString()} B)`],
      ["Detected Type", p.fileType],
      ["Verdict", `${p.verdict.toUpperCase()} (score ${p.verdictScore}/100)`],
      ["Global Entropy", `${p.globalEntropy.toFixed(3)} bits/byte`],
      ["MD5", p.hashes.md5],
      ["SHA-256", p.hashes.sha256],
    ],
    y,
  );
  if (p.ruleHits.length > 0) {
    y = ensureSpace(doc, y, 30);
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.margin, right: PAGE.margin },
      head: [["Rule", "Severity", "Hits", "First offsets"]],
      body: p.ruleHits.slice(0, 30).map((h) => [
        h.ruleName,
        h.severity.toUpperCase(),
        String(h.hitCount),
        h.firstOffsets.map((o) => `0x${o.toString(16)}`).join(", "),
      ]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: BRAND.primary },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: BRAND.lightFill },
    });
    y = getLastTableY(doc) + 6;
  }
  if (p.pe?.suspiciousApis?.length) {
    y = addParagraph(doc, `PE suspicious APIs: ${p.pe.suspiciousApis.slice(0, 12).join(", ")}`, y);
  }
  y = addFindingsTable(ctx, r.findings, y);
  y = addHowMeasuredBlock(doc, "Malware detector", r.methodology.join(" "), y, accent);
  return y;
}

function pcapRenderer(ctx: DocCtx, r: CaseModeResult<PcapSummaryPayload>, startY: number): number {
  const { doc, accent } = ctx;
  let y = addModeHeader(ctx, `Mode — ${r.modeLabel}`, r.headline, r.durationMs, startY);
  const p = r.payload;
  y = addKeyValueTable(
    doc,
    [
      ["Format", p.format],
      ["Link Type", String(p.linkType)],
      ["Total Packets", p.totalPackets.toLocaleString()],
      ["Total Bytes", p.totalBytes.toLocaleString()],
      ["First Timestamp", String(p.firstTimestamp)],
      ["Last Timestamp", String(p.lastTimestamp)],
    ],
    y,
  );
  if (p.topTalkers.length > 0) {
    y = ensureSpace(doc, y, 30);
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.margin, right: PAGE.margin },
      head: [["Top Talker IP", "Packets", "Bytes"]],
      body: p.topTalkers.slice(0, 15).map((t) => [t.ip, String(t.packets), String(t.bytes)]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: BRAND.primary },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: BRAND.lightFill },
    });
    y = getLastTableY(doc) + 6;
  }
  if (p.dnsQueries.length > 0) {
    y = ensureSpace(doc, y, 30);
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.margin, right: PAGE.margin },
      head: [["DNS Query", "Type", "Count"]],
      body: p.dnsQueries.slice(0, 15).map((q) => [q.name, q.type, String(q.count)]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: BRAND.primary },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: BRAND.lightFill },
    });
    y = getLastTableY(doc) + 6;
  }
  if (p.tlsHandshakes.length > 0) {
    y = ensureSpace(doc, y, 30);
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.margin, right: PAGE.margin },
      head: [["TLS SNI", "JA3", "Count"]],
      body: p.tlsHandshakes.slice(0, 15).map((t) => [
        t.sni ?? "—",
        (t.ja3 ?? "").slice(0, 32) || "—",
        String(t.count),
      ]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: BRAND.primary },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: BRAND.lightFill },
    });
    y = getLastTableY(doc) + 6;
  }
  y = addFindingsTable(ctx, r.findings, y);
  y = addHowMeasuredBlock(doc, "Network forensics", r.methodology.join(" "), y, accent);
  return y;
}

function memlogRenderer(ctx: DocCtx, r: CaseModeResult<MemLogPayload>, startY: number): number {
  const { doc, accent } = ctx;
  let y = addModeHeader(ctx, `Mode — ${r.modeLabel}`, r.headline, r.durationMs, startY);
  const p = r.payload;
  y = addKeyValueTable(doc, [["Detected Kind", p.kind]], y);
  if (p.auth) {
    y = addParagraph(doc, `auth.log: ${p.auth.events.length} events; ${p.auth.failedByIp.length} attacker IP(s); ${p.auth.bursts.length} brute-force burst(s).`, y);
    if (p.auth.failedByIp.length > 0) {
      y = ensureSpace(doc, y, 30);
      autoTable(doc, {
        startY: y,
        margin: { left: PAGE.margin, right: PAGE.margin },
        head: [["IP", "Failures", "Targeted users"]],
        body: p.auth.failedByIp.slice(0, 20).map((f) => [
          f.ip,
          String(f.count),
          f.users.slice(0, 6).join(", "),
        ]),
        theme: "striped",
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: BRAND.primary },
        headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: BRAND.lightFill },
      });
      y = getLastTableY(doc) + 6;
    }
  }
  if (p.evtx) {
    y = addParagraph(doc, `EVTX: ${p.evtx.chunks} chunk(s), ${p.evtx.totalRecords} record(s), ${p.evtx.eventIdHistogram.length} distinct EventID(s).`, y);
    if (p.evtx.eventIdHistogram.length > 0) {
      y = ensureSpace(doc, y, 30);
      autoTable(doc, {
        startY: y,
        margin: { left: PAGE.margin, right: PAGE.margin },
        head: [["EventID", "Count"]],
        body: p.evtx.eventIdHistogram.slice(0, 15).map((e) => [String(e.id), String(e.count)]),
        theme: "striped",
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: BRAND.primary },
        headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: BRAND.lightFill },
      });
      y = getLastTableY(doc) + 6;
    }
  }
  if (p.access) {
    y = addParagraph(doc, `Access log: ${p.access.rows.length} rows; ${p.access.topIps.length} IP(s); ${p.access.fourxxIps.length} 4xx-heavy IP(s).`, y);
  }
  if (p.memory) {
    y = addParagraph(doc, `Memory strings: ${p.memory.totalAscii.toLocaleString()} ASCII + ${p.memory.totalUtf16.toLocaleString()} UTF-16; IOC groups: ${p.memory.iocSummary.join(", ") || "(none)"}.`, y);
  }
  if (p.syslog) {
    y = addParagraph(doc, `Syslog: ${p.syslog.rows.length} lines across ${p.syslog.processes.length} process(es).`, y);
  }
  y = addFindingsTable(ctx, r.findings, y);
  y = addHowMeasuredBlock(doc, "Memory & logs", r.methodology.join(" "), y, accent);
  return y;
}

function emailRenderer(ctx: DocCtx, r: CaseModeResult<EmailPayload>, startY: number): number {
  const { doc, accent } = ctx;
  let y = addModeHeader(ctx, `Mode — ${r.modeLabel}`, r.headline, r.durationMs, startY);
  const p = r.payload;
  y = addKeyValueTable(
    doc,
    [
      ["From", `${p.parsed.from?.name ?? ""} <${p.parsed.from?.address ?? "—"}>`],
      ["Reply-To", p.parsed.replyTo?.address ?? "—"],
      ["Subject", p.parsed.subject ?? "—"],
      ["Verdict", `${p.verdict.toUpperCase()} (score ${p.phishingScore}/100)`],
      ["SPF / DKIM / DMARC", `${p.auth.spf} / ${p.auth.dkim} / ${p.auth.dmarc}`],
      ["Hops", String(p.parsed.receivedChain.length)],
      ["URLs in body", String(p.parsed.urls.length)],
      ["Attachments", String(p.parsed.attachments.length)],
    ],
    y,
  );
  if (p.parsed.receivedChain.length > 0) {
    y = ensureSpace(doc, y, 30);
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.margin, right: PAGE.margin },
      head: [["#", "From", "By", "When"]],
      body: p.parsed.receivedChain.slice(0, 15).map((h, i) => [
        String(i + 1),
        [h.fromHost, h.fromIp ? `(${h.fromIp})` : ""].filter(Boolean).join(" "),
        h.byHost ?? "—",
        h.receivedAt ?? "—",
      ]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: BRAND.primary },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: BRAND.lightFill },
    });
    y = getLastTableY(doc) + 6;
  }
  if (p.scoreBreakdown.length > 0) {
    y = ensureSpace(doc, y, 30);
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.margin, right: PAGE.margin },
      head: [["Indicator", "Weight"]],
      body: p.scoreBreakdown.map((b) => [b.label, `+${b.weight}`]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: BRAND.primary },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: BRAND.lightFill },
    });
    y = getLastTableY(doc) + 6;
  }
  y = addFindingsTable(ctx, r.findings, y);
  y = addHowMeasuredBlock(doc, "Email forensics", r.methodology.join(" "), y, accent);
  return y;
}

function sqliteRenderer(ctx: DocCtx, r: CaseModeResult<SqlitePayload>, startY: number): number {
  const { doc, accent } = ctx;
  let y = addModeHeader(ctx, `Mode — ${r.modeLabel}`, r.headline, r.durationMs, startY);
  const p = r.payload;
  y = addKeyValueTable(
    doc,
    [
      ["File Size", `${p.fileSize.toLocaleString()} bytes`],
      ["Page Size", `${p.pageSize}`],
      ["Encoding", p.encoding],
      ["user_version", String(p.userVersion)],
      ["application_id", `0x${p.applicationId.toString(16)}`],
      ["Tables", String(p.tables.length)],
      ["Recovered Deleted Rows", String(p.recovered.length)],
    ],
    y,
  );
  if (p.tables.length > 0) {
    y = ensureSpace(doc, y, 30);
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.margin, right: PAGE.margin },
      head: [["Table", "Type", "Rows", "Columns"]],
      body: p.tables.slice(0, 25).map((t) => [
        t.name + (t.internal ? " (internal)" : ""),
        t.type,
        String(t.rowCount),
        t.columns.slice(0, 6).join(", "),
      ]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: BRAND.primary },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: BRAND.lightFill },
    });
    y = getLastTableY(doc) + 6;
  }
  if (p.recovered.length > 0) {
    y = ensureSpace(doc, y, 30);
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE.margin, right: PAGE.margin },
      head: [["Table", "Page", "Offset", "Values (truncated)"]],
      body: p.recovered.slice(0, 25).map((row) => [
        row.table,
        String(row.pageNumber),
        `0x${row.fileOffset.toString(16)}`,
        row.values
          .map((v) => (v === null ? "NULL" : String(v).slice(0, 32)))
          .join(" | ")
          .slice(0, 90),
      ]),
      theme: "striped",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: BRAND.primary },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: BRAND.lightFill },
    });
    y = getLastTableY(doc) + 6;
  }
  y = addFindingsTable(ctx, r.findings, y);
  y = addHowMeasuredBlock(doc, "SQLite forensics", r.methodology.join(" "), y, accent);
  return y;
}

function addModeResultsSection(ctx: DocCtx, startY: number): number {
  const { data, doc } = ctx;
  const raw = (data.cyberFeatures as { modeResults?: unknown } | undefined)?.modeResults;
  if (!Array.isArray(raw) || raw.length === 0) return startY;

  let y = ensureSpace(doc, startY, 30);
  for (const item of raw) {
    const r = item as CaseModeResult;
    if (!r || typeof r !== "object" || !r.mode) continue;
    switch (r.mode) {
      case "disk":
        y = diskRenderer(ctx, r as CaseModeResult<DiskAnalysisPayload>, y);
        break;
      case "malware":
        y = malwareRenderer(ctx, r as CaseModeResult<MalwareAnalysisPayload>, y);
        break;
      case "pcap":
        y = pcapRenderer(ctx, r as CaseModeResult<PcapSummaryPayload>, y);
        break;
      case "memlog":
        y = memlogRenderer(ctx, r as CaseModeResult<MemLogPayload>, y);
        break;
      case "email":
        y = emailRenderer(ctx, r as CaseModeResult<EmailPayload>, y);
        break;
      case "sqlite":
        y = sqliteRenderer(ctx, r as CaseModeResult<SqlitePayload>, y);
        break;
      default:
        break;
    }
  }
  return y;
}

function addDocumentSpecific(ctx: DocCtx, startY: number): number {
  let y = startY;
  y = addHandwritingSection(ctx, y);
  y = addDocumentPropertiesSection(ctx, y);
  y = addComparisonSection(ctx, y);
  return y;
}

function addConclusions(ctx: DocCtx, startY: number): number {
  const { doc, data, accent } = ctx;
  let y = ensureSpace(doc, startY, 50);
  y = addSectionHeader(doc, "Conclusions", y, accent);

  const lines: string[] = [];
  const conf = data.analysisResult?.confidence_score;
  if (typeof conf === "number") {
    lines.push(
      `The analytical pipeline reports an aggregate confidence of ${conf}%. Discrete numerical evidence is tabulated in the preceding sections so a reviewing examiner may independently re-derive this conclusion.`,
    );
  }
  if (data.reportType === "cyber") {
    if (getRecord(data.cyberFeatures?.fileSignature)?.potentialDiscrepancy) {
      lines.push(
        "The declared file extension does not match the on-disk magic number; the evidence is consistent with a renamed or polyglot artefact and warrants further inspection.",
      );
    }
    const iocs =
      getRecord(data.cyberFeatures?.iocs) ?? getRecord(data.cyberFeatures?.indicators);
    let hits = 0;
    if (iocs) {
      for (const v of Object.values(iocs)) {
        if (Array.isArray(v)) hits += v.length;
      }
    }
    if (hits > 0)
      lines.push(`A total of ${hits} indicator(s) of compromise were enumerated.`);
  } else {
    const comp = getRecord(data.documentFeatures?.comparisonAnalysis);
    if (comp?.hasComparison && typeof comp.matchScore === "number") {
      const score = comp.matchScore as number;
      const verdict =
        score > 0.75
          ? "supports common authorship"
          : score < 0.45
            ? "supports different authorship"
            : "is inconclusive on authorship";
      lines.push(`The fused writer-match score ${verdict}.`);
    }
  }
  if (data.analysisResult?.recommendations?.length) {
    lines.push("Recommended next actions are listed below.");
  }
  if (!lines.length) {
    lines.push(
      "The analysis completed without raising any of the configured anomaly thresholds.",
    );
  }
  for (const line of lines) y = addParagraph(doc, line, y);
  if (data.analysisResult?.recommendations?.length) {
    y = addBulletList(doc, data.analysisResult.recommendations, y);
  }
  return y;
}

function addSignatureBlock(ctx: DocCtx, startY: number): number {
  const { doc, data, accent } = ctx;
  let y = ensureSpace(doc, startY, 60);
  y = addSectionHeader(doc, "Examiner Attestation", y, accent);
  const ex = data.examiner ?? {};
  const para =
    "I certify that the analysis described in this report was performed by the Pratyaksh on-device pipeline against the evidence identified in the Chain of Custody section above, and that the figures, tables and conclusions reproduced here are the deterministic output of that pipeline.";
  y = addParagraph(doc, para, y);
  y += 8;
  setStroke(doc, BRAND.primary);
  doc.setLineWidth(0.4);
  const pageW = doc.internal.pageSize.getWidth();
  const colW = (pageW - PAGE.margin * 2 - 10) / 2;
  doc.line(PAGE.margin, y + 12, PAGE.margin + colW, y + 12);
  doc.line(pageW - PAGE.margin - colW, y + 12, pageW - PAGE.margin, y + 12);
  setText(doc, BRAND.muted);
  doc.setFontSize(9);
  doc.text("Examiner Signature", PAGE.margin, y + 17);
  doc.text("Date", pageW - PAGE.margin - colW, y + 17);
  setText(doc, BRAND.primary);
  doc.setFont("helvetica", "bold");
  doc.text(safe(ex.name) || "Pratyaksh Analyst", PAGE.margin, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, BRAND.muted);
  const subtitle = [ex.title, ex.department, ex.employeeId].filter(Boolean).join(" · ");
  if (subtitle) doc.text(subtitle, PAGE.margin, y + 29);
  return y + 35;
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer / watermark on every page
// ─────────────────────────────────────────────────────────────────────────────
function decoratePages(ctx: DocCtx) {
  const { doc, pageW, pageH, accent, data, reportId, generatedAt, reportLabel } = ctx;
  const gs = doc as unknown as GraphicsStateApi;
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    if (i > 1) {
      setFill(doc, accent);
      doc.rect(0, 0, pageW, 6, "F");
      setText(doc, BRAND.muted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`PRATYAKSH · ${reportLabel}`, PAGE.margin, 13);
      doc.text(`Case ${data.caseId}`, pageW - PAGE.margin, 13, { align: "right" });

      // Diagonal watermark — guard the GState surface in case the runtime jsPDF
      // build does not expose it.
      doc.saveGraphicsState();
      const GStateCtor = gs.GState;
      const setGState = gs.setGState;
      if (GStateCtor && typeof setGState === "function") {
        setGState.call(doc, new GStateCtor({ opacity: 0.06 }));
      }
      setText(doc, BRAND.primary);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(72);
      doc.text("PRATYAKSH", pageW / 2, pageH / 2, {
        align: "center",
        angle: 45,
      });
      doc.restoreGraphicsState();
    }

    setStroke(doc, BRAND.hairline);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, pageH - 14, pageW - PAGE.margin, pageH - 14);
    setText(doc, BRAND.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `Generated by Pratyaksh Forensic AI · ${formatDate(generatedAt)}`,
      PAGE.margin,
      pageH - 8,
    );
    doc.text(reportId, pageW / 2, pageH - 8, { align: "center" });
    doc.text(`Page ${i} of ${total}`, pageW - PAGE.margin, pageH - 8, {
      align: "right",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public helper: convert a File (image) to an EmbeddedEvidenceImage.
// ─────────────────────────────────────────────────────────────────────────────
export async function fileToEvidenceImage(
  file: File | null | undefined,
): Promise<EmbeddedEvidenceImage | null> {
  if (!file || typeof window === "undefined") return null;
  const mime = file.type || "";
  let format: ImageFormat | null = null;
  if (mime.includes("png")) format = "PNG";
  else if (mime.includes("jpeg") || mime.includes("jpg")) format = "JPEG";
  else if (mime.includes("webp")) format = "WEBP";
  if (!format) return null;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });

  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });

  return {
    dataUrl,
    format,
    width: dims.width,
    height: dims.height,
    caption: `Questioned evidence — ${file.name}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePDFReport(data: ReportData): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const accent = data.reportType === "cyber" ? BRAND.cyber : BRAND.document;
  const reportLabel =
    data.reportType === "cyber"
      ? "Cyber Forensics Report"
      : "Document Examination Report";
  const generatedAt = new Date();
  const reportId = makeReportId(data.caseId);

  const ctx: DocCtx = {
    doc,
    pageW,
    pageH,
    accent,
    data,
    reportLabel,
    generatedAt,
    reportId,
  };

  drawCover(ctx);

  doc.addPage();
  let y = PAGE.margin + 4;

  y = addChainOfCustody(ctx, y);
  y = addEmbeddedImage(ctx, y);
  y = addMethodology(ctx, y);
  y = addEvidenceSummary(ctx, y);
  if (data.reportType === "cyber") {
    y = addCyberSpecific(ctx, y);
  } else {
    y = addDocumentSpecific(ctx, y);
  }
  y = addConclusions(ctx, y);
  y = addSignatureBlock(ctx, y);

  decoratePages(ctx);

  return doc.output("blob");
}
