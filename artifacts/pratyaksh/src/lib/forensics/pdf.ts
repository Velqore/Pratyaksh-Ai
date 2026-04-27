// PDF forensics: extract metadata, count revisions, look for embedded files,
// check for JavaScript actions and AcroForm interactivity.
import { PDFDocument, PDFName, PDFArray, PDFDict } from "pdf-lib";

export interface PDFAnalysis {
  isPDF: boolean;
  pageCount?: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  pdfVersion?: string;
  hasJavaScript: boolean;
  hasEmbeddedFiles: boolean;
  embeddedFileCount: number;
  embeddedFileNames: string[];
  hasForm: boolean;
  isEncrypted: boolean;
  hasOpenAction: boolean;
  revisionCount: number;
  incrementalUpdates: number;
  hasSignature: boolean;
  signatureNames: string[];
  rawSize: number;
  notes: string[];
}

function decodeAscii(bytes: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function countOccurrences(text: string, needle: string): number {
  let count = 0;
  let idx = 0;
  while ((idx = text.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

export async function analyzePDF(file: File): Promise<PDFAnalysis> {
  const notes: string[] = [];
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // Check %PDF- magic
  if (
    bytes.length < 5 ||
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46 ||
    bytes[4] !== 0x2d
  ) {
    return {
      isPDF: false,
      hasJavaScript: false,
      hasEmbeddedFiles: false,
      embeddedFileCount: 0,
      embeddedFileNames: [],
      hasForm: false,
      isEncrypted: false,
      hasOpenAction: false,
      revisionCount: 0,
      incrementalUpdates: 0,
      hasSignature: false,
      signatureNames: [],
      rawSize: bytes.length,
      notes: ["Not a valid PDF (missing %PDF- header)"],
    };
  }

  // Parse PDF version from header
  const headerEnd = Math.min(16, bytes.length);
  const header = decodeAscii(bytes, 0, headerEnd);
  const verMatch = header.match(/%PDF-(\d+\.\d+)/);
  const pdfVersion = verMatch ? verMatch[1] : undefined;

  // Quick scan of raw bytes (first 256KB cap for speed) for keyword indicators.
  // PDFs can stream-encrypt content but the trailer/xref is plain ASCII.
  const scanLimit = Math.min(bytes.length, 5 * 1024 * 1024);
  const text = decodeAscii(bytes, 0, scanLimit);

  const startxrefCount = countOccurrences(text, "startxref");
  const eofCount = countOccurrences(text, "%%EOF");
  // Each incremental save adds another startxref / %%EOF pair.
  const incrementalUpdates = Math.max(0, startxrefCount - 1);
  const revisionCount = startxrefCount;

  const hasJavaScript = /\/(JS|JavaScript)\b/.test(text);
  const hasEmbeddedFiles = /\/EmbeddedFiles?\b/.test(text) || /\/Filespec\b/.test(text);
  const hasForm = /\/AcroForm\b/.test(text);
  const isEncrypted = /\/Encrypt\b/.test(text);
  const hasOpenAction = /\/OpenAction\b/.test(text);

  const sigMatches = text.match(/\/Sig\b/g);
  const hasSignature = !!sigMatches && sigMatches.length > 0;
  const signatureNames: string[] = [];

  let pageCount: number | undefined;
  let title: string | undefined;
  let author: string | undefined;
  let subject: string | undefined;
  let keywords: string | undefined;
  let creator: string | undefined;
  let producer: string | undefined;
  let creationDate: string | undefined;
  let modificationDate: string | undefined;
  const embeddedFileNames: string[] = [];

  try {
    const pdfDoc = await PDFDocument.load(buf, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    });
    pageCount = pdfDoc.getPageCount();
    title = pdfDoc.getTitle() || undefined;
    author = pdfDoc.getAuthor() || undefined;
    subject = pdfDoc.getSubject() || undefined;
    const kws = pdfDoc.getKeywords();
    keywords = kws || undefined;
    creator = pdfDoc.getCreator() || undefined;
    producer = pdfDoc.getProducer() || undefined;
    creationDate = pdfDoc.getCreationDate()?.toISOString();
    modificationDate = pdfDoc.getModificationDate()?.toISOString();

    // Walk the catalog to enumerate embedded files
    try {
      const catalog = pdfDoc.catalog;
      const namesDict = catalog.lookup(PDFName.of("Names"), PDFDict);
      if (namesDict instanceof PDFDict) {
        const efDict = namesDict.lookup(
          PDFName.of("EmbeddedFiles"),
          PDFDict,
        );
        if (efDict instanceof PDFDict) {
          const namesArr = efDict.lookup(PDFName.of("Names"), PDFArray);
          if (namesArr instanceof PDFArray) {
            for (let i = 0; i < namesArr.size(); i += 2) {
              const nameObj = namesArr.lookup(i);
              // pdf-lib name objects expose .asString(); fall back to the
              // raw String() coercion if a different node type slipped in.
              const hasAsString = (
                v: unknown,
              ): v is { asString: () => string } =>
                typeof v === "object" &&
                v !== null &&
                typeof (v as { asString?: unknown }).asString === "function";
              const n = hasAsString(nameObj)
                ? nameObj.asString()
                : String(nameObj);
              if (n) embeddedFileNames.push(n);
            }
          }
        }
      }
    } catch {
      /* best-effort */
    }
  } catch (e) {
    notes.push(
      `pdf-lib parsing partial: ${e instanceof Error ? e.message : "unknown"}`,
    );
  }

  if (incrementalUpdates > 0) {
    notes.push(
      `${incrementalUpdates} incremental update(s) detected — document was modified after original signing/saving.`,
    );
  }
  if (hasJavaScript) notes.push("PDF contains JavaScript actions — review for exploit code.");
  if (hasEmbeddedFiles)
    notes.push(`Contains embedded file objects${embeddedFileNames.length ? ": " + embeddedFileNames.join(", ") : ""}.`);
  if (hasForm) notes.push("Interactive AcroForm fields present.");
  if (isEncrypted) notes.push("Document is encrypted (or has an /Encrypt dictionary).");
  if (hasOpenAction)
    notes.push("Document has /OpenAction — code or actions run automatically when opened.");
  if (hasSignature) notes.push(`Digital signature object(s) found (${sigMatches?.length ?? 0}).`);

  return {
    isPDF: true,
    pageCount,
    title,
    author,
    subject,
    keywords,
    creator,
    producer,
    creationDate,
    modificationDate,
    pdfVersion,
    hasJavaScript,
    hasEmbeddedFiles: hasEmbeddedFiles || embeddedFileNames.length > 0,
    embeddedFileCount: embeddedFileNames.length,
    embeddedFileNames,
    hasForm,
    isEncrypted,
    hasOpenAction,
    revisionCount,
    incrementalUpdates,
    hasSignature,
    signatureNames,
    rawSize: bytes.length,
    notes,
  };
}
