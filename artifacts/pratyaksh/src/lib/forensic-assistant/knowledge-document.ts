import type { KnowledgeEntry } from "./types";

export const DOCUMENT_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "doc-handwriting",
    intent: "handwriting-features",
    triggers: [
      "handwriting",
      "writing",
      "slant",
      "pressure",
      "spacing",
      "baseline",
      "stroke",
    ],
    answer:
      "Handwriting examination in Pratyaksh extracts **eight measurable features** from the questioned image:\n\n- **Slant** — mean angle of vertical strokes relative to the baseline.\n- **Pressure** — derived from grayscale intensity along stroke skeletons.\n- **Spacing** — mean inter-word and inter-character gap in pixels normalised by x-height.\n- **Baseline drift** — best-fit line through the lower envelope of each text row.\n- **Letter size** — x-height and ascender/descender ratios.\n- **Connecting strokes** — count of cursive ligatures vs. lifted pen events.\n- **Stroke width** — median width of the binarised skeleton.\n- **Tremor** — high-frequency oscillation along stroke contours (a forgery / impairment indicator).\n\nThese features are deterministic — re-running the analysis on the same image produces the same numbers, which matters in court.",
    followUps: [
      "How does Pratyaksh decide if two samples were written by the same person?",
      "What constitutes an indicator of forgery?",
    ],
    source: "Pratyaksh document pipeline (lib/forensics/document.ts)",
  },
  {
    id: "doc-comparison",
    intent: "writer-comparison",
    triggers: [
      "compare",
      "comparison",
      "match",
      "exemplar",
      "writer",
      "same author",
      "different author",
    ],
    answer:
      "When you upload a comparison sample, the engine fuses **four independent similarity measures** into a single writer-match score:\n\n1. **Perceptual hash distance** (Hamming, lower = more visually similar).\n2. **OCR-text Jaccard overlap** (0–1, lexical content overlap).\n3. **Slant delta** (absolute degrees difference).\n4. **Stroke-width delta** (pixels).\n\nThe four are normalised to `[0,1]` and combined with weights `[0.40, 0.20, 0.20, 0.20]`. A score > 0.75 supports *common authorship*, 0.45–0.75 is *inconclusive*, and < 0.45 supports *different authorship*. The PDF report includes the raw four numbers so the result is fully reproducible.",
    followUps: [
      "What does the Diff Highlights table show?",
      "Explain perceptual hashing in plain language",
    ],
    source: "Pratyaksh document pipeline (lib/forensics/document.ts → compareDocuments)",
  },
  {
    id: "doc-forgery",
    intent: "forgery-detection",
    triggers: [
      "forgery",
      "forged",
      "fake",
      "tremor",
      "ink",
      "alteration",
      "tracing",
      "hesitation",
    ],
    answer:
      "Forgery indicators tracked by the engine:\n\n- **Tremor** — high-frequency contour oscillation; common in *traced* signatures because the writer is following a guide instead of writing fluidly.\n- **Pressure inconsistency** — unnatural light/heavy alternation between letters.\n- **Pen lifts in unexpected places** — segmentation gaps that don't correspond to natural cursive breaks.\n- **Speed variation** — slow, deliberate strokes in one region and fluid strokes in another suggests *patching* (a forger fixing up a problem area).\n- **Ink discontinuity** — colour-channel variance across what should be a single stroke (suggests over-writing with a different pen).\n\nA hit on **two or more** indicators raises the report's risk level to *Elevated*; three or more raises it to *High*.",
    followUps: [
      "How is the Anomaly Detection tab populated?",
      "Show me what gets written into the report's Conclusions section",
    ],
    source: "Pratyaksh document pipeline (forgery scoring)",
  },
  {
    id: "doc-pdf-properties",
    intent: "pdf-properties",
    triggers: ["pdf", "metadata", "author", "producer", "revision", "edited"],
    answer:
      "For uploaded PDFs we parse the document **Info dictionary** and **XMP metadata**: `Title`, `Author`, `Producer`, `Creator`, `CreationDate`, `ModDate`, plus the `xmpMM:History` revision list when present.\n\nAny mismatch between `CreationDate` and `ModDate`, or a `Producer` string that disagrees with the `Creator` (e.g. created in *Microsoft Word* but last touched by *iText*), is flagged as a possible post-authoring modification. The full revision history is rendered in the report's *Document Properties* table.",
    followUps: [
      "What goes into the Document Properties section of the PDF report?",
      "Walk me through the methodology section",
    ],
    source: "Pratyaksh document pipeline (lib/forensics/pdf.ts)",
  },
  {
    id: "doc-conclusions",
    intent: "report-conclusions",
    triggers: [
      "conclusion",
      "verdict",
      "outcome",
      "court",
      "expert opinion",
      "report",
    ],
    answer:
      "The PDF report's **Conclusions** section is auto-composed from three deterministic inputs: the writer-match score (if a comparison sample was supplied), the count of forgery indicators triggered, and the document-properties anomaly count.\n\nIt is phrased in cautious examiner language — *supports*, *is consistent with*, *cannot be excluded* — and never makes absolute identification claims. The numerical evidence sits alongside the prose so a reviewing expert can re-derive the conclusion from the data table.",
    followUps: [
      "What's in the Methodology section?",
      "Explain the chain of custody record",
    ],
    source: "Pratyaksh report generator",
  },
];
