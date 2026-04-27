// PDF Report Generator for Cyber and Document Analysis
// Uses jsPDF for client-side PDF generation

declare global {
  interface Window {
    jsPDF: any;
  }
}

// Define interfaces for report data
interface ReportData {
  caseId: string;
  analysisResult: any;
  cyberFeatures?: any;
  documentFeatures?: any;
  reportType: "cyber" | "document";
}

// Load jsPDF dynamically with better error handling
const loadJsPDF = async () => {
  if (typeof window !== "undefined" && !window.jsPDF) {
    try {
      // Load jsPDF from CDN
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);

      await new Promise((resolve, reject) => {
        script.onload = () => {
          console.log("jsPDF loaded successfully");
          resolve(window.jsPDF);
        };
        script.onerror = (error) => {
          console.error("Failed to load jsPDF:", error);
          reject(new Error("Failed to load jsPDF library"));
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error("jsPDF loading timeout"));
        }, 10000);
      });
    } catch (error) {
      console.error("Error loading jsPDF:", error);
      throw new Error("PDF generation unavailable - library loading failed");
    }
  }

  if (!window.jsPDF) {
    throw new Error("jsPDF library not available");
  }

  return window.jsPDF;
};

/**
 * Generate professional PDF report for cyber or document analysis
 */
export async function generatePDFReport(data: ReportData): Promise<Blob> {
  try {
    console.log("Starting PDF generation...");
    await loadJsPDF();

    if (!window.jsPDF) {
      throw new Error("jsPDF not available after loading");
    }

    const { jsPDF } = window;
    console.log("jsPDF loaded, creating document...");

    // Create new PDF document
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Helper function to add new page if needed
    const checkPageBreak = (requiredSpace: number) => {
      if (yPosition + requiredSpace > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
        addHeader();
      }
    };

    // Add header to each page
    const addHeader = () => {
      // Header background
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageWidth, 25, "F");

      // Logo area (text-based)
      doc.setTextColor(0, 255, 255);
      doc.setFontSize(8);
      doc.text("PRATYAKSH", 10, 10);

      // Main title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text("PRATYAKSH FORENSIC ANALYSIS", pageWidth / 2, 10, {
        align: "center",
      });

      // Subtitle
      doc.setFontSize(12);
      const subtitle =
        data.reportType === "cyber"
          ? "Cyber Forensics Report"
          : "Document Analysis Report";
      doc.text(subtitle, pageWidth / 2, 18, { align: "center" });

      // Security classification
      doc.setFontSize(8);
      doc.text("OFFICIAL USE ONLY", pageWidth - 10, 10, { align: "right" });

      yPosition = 35;
    };

    // Add header
    addHeader();

    // Case Information Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text("Case Information", 10, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    doc.text(`Case ID: ${data.caseId}`, 10, yPosition);
    yPosition += 6;
    doc.text(
      `Analysis Date: ${new Date(data.analysisResult.analysis_date).toLocaleString()}`,
      10,
      yPosition,
    );
    yPosition += 6;
    doc.text(
      `Confidence Score: ${data.analysisResult.confidence_score}%`,
      10,
      yPosition,
    );
    yPosition += 6;
    doc.text(
      `Processing Time: ${(data.analysisResult.analysis_duration_ms / 1000).toFixed(2)}s`,
      10,
      yPosition,
    );
    yPosition += 15;

    if (data.reportType === "cyber") {
      await generateCyberReport(doc, data, yPosition, checkPageBreak);
    } else {
      await generateDocumentReport(doc, data, yPosition, checkPageBreak);
    }

    // Add footer
    addFooter(doc, data);

    // Return blob
    const blob = doc.output("blob");
    console.log("PDF generated successfully, size:", blob.size, "bytes");
    return blob;
  } catch (error) {
    console.error("PDF generation failed:", error);

    // Generate fallback text-based report
    const fallbackReport = generateFallbackTextReport(data);
    const textBlob = new Blob([fallbackReport], { type: "text/plain" });

    // Show user-friendly error message
    alert(
      "PDF generation temporarily unavailable. A text report will be downloaded instead.",
    );

    return textBlob;
  }
}

/**
 * Generate cyber forensics specific sections
 */
async function generateCyberReport(
  doc: any,
  data: ReportData,
  startY: number,
  checkPageBreak: Function,
) {
  let yPosition = startY;

  // File Metadata Section
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.text("File Metadata Analysis", 10, yPosition);
  yPosition += 10;

  if (data.cyberFeatures?.fileMetadata) {
    const metadata = data.cyberFeatures.fileMetadata;
    doc.setFontSize(10);
    doc.text(
      `File Size: ${(metadata.fileSize / 1024).toFixed(2)} KB`,
      10,
      yPosition,
    );
    yPosition += 6;
    doc.text(`MIME Type: ${metadata.mimeType}`, 10, yPosition);
    yPosition += 6;
    doc.text(
      `Created: ${new Date(metadata.created).toLocaleString()}`,
      10,
      yPosition,
    );
    yPosition += 6;
    doc.text(
      `Modified: ${new Date(metadata.modified).toLocaleString()}`,
      10,
      yPosition,
    );
    yPosition += 6;
    doc.text(`Permissions: ${metadata.permissions}`, 10, yPosition);
    yPosition += 10;
  }

  // Hash Analysis Section
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.text("Hash Value Analysis", 10, yPosition);
  yPosition += 10;

  if (data.cyberFeatures?.hashAnalysis?.hashValues) {
    const hashes = data.cyberFeatures.hashAnalysis.hashValues;
    doc.setFontSize(9);
    doc.text(`MD5:    ${hashes.md5}`, 10, yPosition);
    yPosition += 6;
    doc.text(`SHA1:   ${hashes.sha1}`, 10, yPosition);
    yPosition += 6;
    doc.text(`SHA256: ${hashes.sha256}`, 10, yPosition);
    yPosition += 6;
    doc.text(`SHA512: ${hashes.sha512.substring(0, 50)}...`, 10, yPosition);
    yPosition += 10;
  }

  // File Signature Analysis
  checkPageBreak(40);
  doc.setFontSize(14);
  doc.text("File Signature Analysis", 10, yPosition);
  yPosition += 10;

  if (data.cyberFeatures?.fileSignature) {
    const signature = data.cyberFeatures.fileSignature;
    doc.setFontSize(10);
    doc.text(`Header Signature: ${signature.headerSignature}`, 10, yPosition);
    yPosition += 6;
    doc.text(
      `Magic Numbers: ${signature.magicNumbers.join(", ")}`,
      10,
      yPosition,
    );
    yPosition += 6;
    doc.text(
      `Signature Match: ${signature.signatureMatch ? "Yes" : "No"}`,
      10,
      yPosition,
    );
    yPosition += 6;
    if (signature.potentialDiscrepancy) {
      doc.setTextColor(255, 0, 0);
      doc.text(
        "⚠ Potential file extension/signature mismatch detected",
        10,
        yPosition,
      );
      doc.setTextColor(0, 0, 0);
    }
    yPosition += 10;
  }

  // File Carving Results
  checkPageBreak(40);
  doc.setFontSize(14);
  doc.text("File Carving Results", 10, yPosition);
  yPosition += 10;

  if (data.cyberFeatures?.fileCarving) {
    const carving = data.cyberFeatures.fileCarving;
    doc.setFontSize(10);
    doc.text(`Deleted Files Found: ${carving.deletedFiles}`, 10, yPosition);
    yPosition += 6;
    doc.text(
      `Recovered Fragments: ${carving.recoveredFragments}`,
      10,
      yPosition,
    );
    yPosition += 6;
    doc.text(`Hidden Partitions: ${carving.hiddenPartitions}`, 10, yPosition);
    yPosition += 6;
    doc.text(`Slack Space: ${carving.slackSpace}`, 10, yPosition);
    yPosition += 10;
  }

  // Analysis Steps
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.text("Analysis Steps Performed", 10, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  data.analysisResult.analysis_steps.forEach((step: string, index: number) => {
    checkPageBreak(8);
    doc.text(`${index + 1}. ${step}`, 10, yPosition);
    yPosition += 6;
  });
  yPosition += 5;

  // Evidence Found
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.text("Digital Evidence Found", 10, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  data.analysisResult.evidence_found.forEach(
    (evidence: string, index: number) => {
      checkPageBreak(8);
      doc.text(`• ${evidence}`, 10, yPosition);
      yPosition += 6;
    },
  );
  yPosition += 5;

  // Recommendations
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.text("Forensic Recommendations", 10, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  data.analysisResult.recommendations.forEach((rec: string, index: number) => {
    checkPageBreak(8);
    doc.text(`• ${rec}`, 10, yPosition);
    yPosition += 6;
  });
}

/**
 * Generate document analysis specific sections
 */
async function generateDocumentReport(
  doc: any,
  data: ReportData,
  startY: number,
  checkPageBreak: Function,
) {
  let yPosition = startY;

  // Handwriting Characteristics
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.text("Handwriting Characteristics Analysis", 10, yPosition);
  yPosition += 10;

  if (data.documentFeatures?.handwritingCharacteristics) {
    const characteristics = data.documentFeatures.handwritingCharacteristics;
    doc.setFontSize(10);
    doc.text(`Pressure: ${characteristics.pressure}`, 10, yPosition);
    yPosition += 6;
    doc.text(`Slant: ${characteristics.slant}`, 10, yPosition);
    yPosition += 6;
    doc.text(`Spacing: ${characteristics.spacing}`, 10, yPosition);
    yPosition += 6;
    doc.text(`Baseline: ${characteristics.baseline}`, 10, yPosition);
    yPosition += 6;
    doc.text(`Size: ${characteristics.size}`, 10, yPosition);
    yPosition += 6;
    doc.text(
      `Connecting Strokes: ${characteristics.connecting_strokes}`,
      10,
      yPosition,
    );
    yPosition += 6;
    doc.text(
      `Letter Formations: ${characteristics.letter_formations}`,
      10,
      yPosition,
    );
    yPosition += 10;
  }

  // Forgery Detection Analysis
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.text("Forgery and Alteration Detection", 10, yPosition);
  yPosition += 10;

  if (data.documentFeatures?.forgeryDetection) {
    const forgery = data.documentFeatures.forgeryDetection;
    doc.setFontSize(12);
    doc.text("Ink Analysis:", 10, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.text(
      `  Consistency: ${forgery.inkAnalysis.consistent ? "Consistent" : "Inconsistent"}`,
      10,
      yPosition,
    );
    yPosition += 6;
    doc.text(`  Ink Type: ${forgery.inkAnalysis.inkType}`, 10, yPosition);
    yPosition += 6;
    doc.text(
      `  Color Variation: ${forgery.inkAnalysis.colorVariation}`,
      10,
      yPosition,
    );
    yPosition += 8;

    doc.setFontSize(12);
    doc.text("Pressure Analysis:", 10, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    doc.text(
      `  Consistency: ${forgery.pressureAnalysis.consistent ? "Consistent" : "Inconsistent"}`,
      10,
      yPosition,
    );
    yPosition += 6;
    doc.text(
      `  Variations: ${forgery.pressureAnalysis.variations}`,
      10,
      yPosition,
    );
    yPosition += 8;

    doc.setFontSize(12);
    doc.text("Tremor Analysis:", 10, yPosition);
    yPosition += 8;
    doc.setFontSize(10);
    if (forgery.tremor !== "None detected") {
      doc.setTextColor(255, 0, 0);
    }
    doc.text(`  ${forgery.tremor}`, 10, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;
  }

  // Disguised Writing Analysis
  checkPageBreak(40);
  doc.setFontSize(14);
  doc.text("Disguised or Anonymous Writing Analysis", 10, yPosition);
  yPosition += 10;

  if (data.documentFeatures?.disguisedWriting) {
    const disguised = data.documentFeatures.disguisedWriting;
    doc.setFontSize(10);
    doc.text(
      `Natural Flow: ${disguised.naturalFlow ? "Yes" : "No - Possible disguise"}`,
      10,
      yPosition,
    );
    yPosition += 6;
    doc.text(`Speed Variations: ${disguised.speedVariations}`, 10, yPosition);
    yPosition += 6;
    doc.text(
      `Deliberate Distortion: ${disguised.deliberateDistortion}`,
      10,
      yPosition,
    );
    yPosition += 10;
  }

  // Text Analysis Statistics
  checkPageBreak(40);
  doc.setFontSize(14);
  doc.text("Text Analysis Statistics", 10, yPosition);
  yPosition += 10;

  if (data.documentFeatures?.textAnalysis) {
    const textStats = data.documentFeatures.textAnalysis;
    doc.setFontSize(10);
    doc.text(`Lines of Text: ${textStats.lineCount}`, 10, yPosition);
    yPosition += 6;
    doc.text(`Word Count: ${textStats.wordCount}`, 10, yPosition);
    yPosition += 6;
    doc.text(`Character Count: ${textStats.characterCount}`, 10, yPosition);
    yPosition += 10;
  }

  // Analysis Steps
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.text("Analysis Steps Performed", 10, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  data.analysisResult.analysis_steps.forEach((step: string, index: number) => {
    checkPageBreak(8);
    doc.text(`${index + 1}. ${step}`, 10, yPosition);
    yPosition += 6;
  });
  yPosition += 5;

  // Evidence Found
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.text("Document Evidence Found", 10, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  data.analysisResult.evidence_found.forEach(
    (evidence: string, index: number) => {
      checkPageBreak(8);
      doc.text(`• ${evidence}`, 10, yPosition);
      yPosition += 6;
    },
  );
  yPosition += 5;

  // Recommendations
  checkPageBreak(50);
  doc.setFontSize(14);
  doc.text("Expert Recommendations", 10, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  data.analysisResult.recommendations.forEach((rec: string, index: number) => {
    checkPageBreak(8);
    doc.text(`• ${rec}`, 10, yPosition);
    yPosition += 6;
  });
}

/**
 * Add footer to the document
 */
function addFooter(doc: any, data: ReportData) {
  const pageCount = doc.internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Footer background
    doc.setFillColor(240, 240, 240);
    doc.rect(
      0,
      doc.internal.pageSize.getHeight() - 25,
      doc.internal.pageSize.getWidth(),
      25,
      "F",
    );

    // Footer text
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Generated by Pratyaksh Forensic AI`,
      10,
      doc.internal.pageSize.getHeight() - 15,
    );
    doc.text(
      `Case ID: ${data.caseId}`,
      10,
      doc.internal.pageSize.getHeight() - 8,
    );

    // Page number
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() - 30,
      doc.internal.pageSize.getHeight() - 8,
    );

    // Security notice
    doc.text(
      "This report contains sensitive forensic data - Handle according to privacy regulations",
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }
}

/**
 * Generate fallback text report when PDF generation fails
 */
function generateFallbackTextReport(data: ReportData): string {
  const lines = [];

  lines.push("=".repeat(80));
  lines.push("PRATYAKSH FORENSIC ANALYSIS REPORT");
  lines.push(`${data.reportType.toUpperCase()} FORENSICS ANALYSIS`);
  lines.push("=".repeat(80));
  lines.push("");

  // Case Information
  lines.push("CASE INFORMATION");
  lines.push("-".repeat(40));
  lines.push(`Case ID: ${data.caseId}`);
  lines.push(
    `Analysis Date: ${new Date(data.analysisResult.analysis_date).toLocaleString()}`,
  );
  lines.push(`Confidence Score: ${data.analysisResult.confidence_score}%`);
  lines.push(
    `Processing Time: ${(data.analysisResult.analysis_duration_ms / 1000).toFixed(2)}s`,
  );
  lines.push("");

  // Analysis Steps
  lines.push("ANALYSIS STEPS PERFORMED");
  lines.push("-".repeat(40));
  data.analysisResult.analysis_steps.forEach((step: string, index: number) => {
    lines.push(`${index + 1}. ${step}`);
  });
  lines.push("");

  // Evidence Found
  if (data.analysisResult.evidence_found.length > 0) {
    lines.push("EVIDENCE FOUND");
    lines.push("-".repeat(40));
    data.analysisResult.evidence_found.forEach((evidence: string) => {
      lines.push(`• ${evidence}`);
    });
    lines.push("");
  }

  // Type-specific sections
  if (data.reportType === "cyber" && data.cyberFeatures) {
    lines.push("CYBER FORENSICS DETAILS");
    lines.push("-".repeat(40));

    if (data.cyberFeatures.fileMetadata) {
      lines.push("File Metadata:");
      lines.push(
        `  File Size: ${(data.cyberFeatures.fileMetadata.fileSize / 1024).toFixed(2)} KB`,
      );
      lines.push(`  MIME Type: ${data.cyberFeatures.fileMetadata.mimeType}`);
      lines.push(
        `  Created: ${new Date(data.cyberFeatures.fileMetadata.created).toLocaleString()}`,
      );
      lines.push(
        `  Modified: ${new Date(data.cyberFeatures.fileMetadata.modified).toLocaleString()}`,
      );
      lines.push("");
    }

    if (data.cyberFeatures.hashAnalysis?.hashValues) {
      lines.push("Hash Values:");
      lines.push(`  MD5: ${data.cyberFeatures.hashAnalysis.hashValues.md5}`);
      lines.push(`  SHA1: ${data.cyberFeatures.hashAnalysis.hashValues.sha1}`);
      lines.push(
        `  SHA256: ${data.cyberFeatures.hashAnalysis.hashValues.sha256}`,
      );
      lines.push("");
    }
  }

  if (data.reportType === "document" && data.documentFeatures) {
    lines.push("DOCUMENT ANALYSIS DETAILS");
    lines.push("-".repeat(40));

    if (data.documentFeatures.handwritingCharacteristics) {
      lines.push("Handwriting Characteristics:");
      const chars = data.documentFeatures.handwritingCharacteristics;
      lines.push(`  Pressure: ${chars.pressure}`);
      lines.push(`  Slant: ${chars.slant}`);
      lines.push(`  Spacing: ${chars.spacing}`);
      lines.push(`  Baseline: ${chars.baseline}`);
      lines.push("");
    }
  }

  // Recommendations
  if (data.analysisResult.recommendations.length > 0) {
    lines.push("RECOMMENDATIONS");
    lines.push("-".repeat(40));
    data.analysisResult.recommendations.forEach((rec: string) => {
      lines.push(`• ${rec}`);
    });
    lines.push("");
  }

  // Footer
  lines.push("=".repeat(80));
  lines.push("Generated by Pratyaksh Forensic AI");
  lines.push(`Report generated on: ${new Date().toLocaleString()}`);
  lines.push(
    "This report contains sensitive forensic data - Handle according to privacy regulations",
  );
  lines.push("=".repeat(80));

  return lines.join("\n");
}
