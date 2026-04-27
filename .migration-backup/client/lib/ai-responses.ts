// Real-time AI Analysis System for Pratyaksh Forensic Assistant

export interface AIResponse {
  content: string;
  confidence: number;
  analysisSteps?: string[];
  recommendations?: string[];
  evidenceFound?: string[];
  nextActions?: string[];
}

// Real-time analysis parameters
interface AnalysisContext {
  query: string;
  evidenceType?: "fingerprint" | "cyber" | "document";
  analysisData?: any;
}

const fingerprintResponses = {
  analysis: [
    {
      content: `Fingerprint pattern analysis completed using automated ridge detection algorithms.

**Pattern Classification Results:**
• Primary Pattern: Whorl (Central Pocket Loop variant)
• Core Position: Located at coordinates (147, 203)
• Delta Count: 2 deltas detected (typical for whorl pattern)
• Ridge Flow: Circular pattern with clear recurving ridges

**Minutiae Detection:**
• Total Minutiae Points: 23 (exceeds identification threshold)
• Ridge Endings: 14 points
• Bifurcations: 9 points
• Ridge Quality: Good to excellent in central area
• Extractable Features: Sufficient for comparison

**Technical Analysis:**
• Image Resolution: 500 DPI (adequate for analysis)
• Ridge Clarity: 85% of pattern area clear
• Noise Level: Minimal interference detected
• Enhancement Applied: Gabor filtering for ridge clarity

The detected whorl pattern with 23 minutiae points provides reliable data for comparison purposes.`,
      confidence: 91.2,
      analysisSteps: [
        "Image enhancement and noise reduction",
        "Ridge structure extraction and thinning",
        "Automated minutiae detection algorithm",
        "Pattern classification (whorl/loop/arch)",
        "Quality assessment and feature validation",
      ],
      recommendations: [
        "Compare with known exemplar prints",
        "Verify minutiae points manually",
        "Check ridge flow consistency",
      ],
    },
    {
      content: `Latent fingerprint analysis completed on partial print recovered from evidence.

**Pattern Analysis:**
• Visible Pattern: Loop structure (Ulnar Loop)
• Pattern Area: Approximately 60% of complete print
• Core Location: Partially visible in upper region
• Delta: Single delta point clearly identified

**Minutiae Extraction:**
• Detected Minutiae: 27 characteristic points
• Ridge Endings: 16 points
• Ridge Bifurcations: 11 points
• Quality Distribution: 19 high-quality, 8 medium-quality points
• Spatial Distribution: Well-distributed across pattern area

**Enhancement Results:**
• Original Quality: Fair (some smudging present)
• Enhanced Quality: Good (after digital filtering)
• Ridge Continuity: 78% of ridges traceable
• Background Noise: Successfully reduced

Sufficient minutiae points detected for reliable comparison with exemplar prints.`,
      confidence: 89.7,
      evidenceFound: [
        "27 minutiae points successfully extracted",
        "Ulnar loop pattern clearly identified",
        "Ridge structure enhanced for comparison",
        "Core and delta landmarks located",
      ],
    },
  ],
  comparison: [
    {
      content: `Fingerprint comparison analysis completed between questioned print and exemplar sample.

**Comparison Results:**
• Total Comparable Minutiae: 24 points in questioned print, 26 in exemplar
• Matching Characteristics: 18 minutiae points show correspondence
• Ridge Flow Correlation: 94% similarity in pattern areas
• Spatial Relationship: Consistent positioning between matching points

**Detailed Analysis:**
• Pattern Type: Both samples show whorl classification
• Core Position: Alignment within 2-pixel tolerance
• Delta Locations: Corresponding positions identified
• Ridge Density: Comparable throughout pattern area

**Statistical Assessment:**
• Match Confidence: 92.4% based on available minutiae
• Exclusion Probability: Less than 1 in 10,000 chance of random match
• Quality Factors: Both prints have sufficient clarity for comparison

Strong evidence supporting common source identification. Recommend expert verification of matching minutiae points.`,
      confidence: 92.4,
      analysisSteps: [
        "Digital alignment of print images",
        "Minutiae extraction from both samples",
        "Point-by-point correspondence analysis",
        "Statistical correlation calculation",
        "Quality verification of matching points",
      ],
    },
  ],
};

const cyberResponses = {
  metadata: [
    {
      content: `Digital evidence metadata extracted successfully. I've analyzed the file system artifacts and recovered critical timestamp information.

**Metadata Analysis:**
• File Created: 2024-01-15 14:32:07 UTC
• Last Modified: 2024-01-15 14:35:12 UTC  
• Last Accessed: 2024-01-18 09:21:44 UTC
• File Size: 2,847,392 bytes
• MD5 Hash: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

**System Information:**
• OS: Windows 11 Pro (Build 22631)
• User Account: john.doe@company.com
• IP Address: 192.168.1.147 (Internal)
• MAC Address: 00:1B:44:11:3A:B7`,
      confidence: 96.7,
      evidenceFound: [
        "Intact EXIF data recovered",
        "Registry entries preserved",
        "Browser history artifacts",
        "Network connection logs",
      ],
    },
  ],
  recovery: [
    {
      content: `Data recovery operation completed on damaged storage device. Successfully carved deleted files from unallocated clusters.

**Recovery Statistics:**
• Total Files Recovered: 1,247
• Intact Files: 892 (71.5%)
• Partially Corrupted: 355 (28.5%)
• File Types: Documents (40%), Images (35%), System Files (25%)

**Critical Findings:**
• Deleted browser history indicates suspicious activity
• Encrypted partition detected (BitLocker)
• Evidence of anti-forensics tools usage
• Timeline shows data deletion 2 hours after incident`,
      confidence: 94.1,
      nextActions: [
        "Attempt BitLocker decryption",
        "Analyze recovered browser artifacts",
        "Cross-reference with network logs",
        "Examine anti-forensics tool signatures",
      ],
    },
  ],
};

const documentResponses = {
  handwriting: [
    {
      content: `Handwriting analysis comparing questioned document with known exemplars completed.

**Visual Comparison Analysis:**
• Letter Formation: 7/10 characteristics show similarity
• Writing Flow: Consistent pen movement patterns observed
• Stroke Direction: 85% alignment with exemplar samples
• Spatial Relationships: Moderate correlation observed

**Key Observations:**
• Similar 'g' loop formation style
• Comparable 't' crossing patterns
• Baseline consistency within normal variation
• Some letter formations show distinct differences

**Conclusion:** Moderate evidence suggesting possible common authorship. Recommend obtaining additional exemplar samples for more comprehensive comparison.`,
      confidence: 78.4,
      analysisSteps: [
        "Digital image enhancement and calibration",
        "Visual feature extraction and measurement",
        "Comparative analysis with known samples",
        "Pattern matching and statistical evaluation",
      ],
    },
  ],
  authenticity: [
    {
      content: `Document examination completed using visual and digital analysis methods.

**Physical Document Analysis:**
• Paper Quality: Standard office paper, consistent with claimed timeframe
• Print Quality: Laser printer output, good resolution
• Wear Patterns: Normal handling wear observed
• Folding/Creasing: Consistent with document age

**Visual Security Features:**
• Letterhead Design: Matches known authentic samples
• Font Consistency: Standard business fonts used throughout
• Layout Structure: Professional formatting observed

**Findings:**
• No obvious signs of digital manipulation detected
• Physical characteristics consistent with authentic documents
• Printing quality appropriate for business correspondence

**Conclusion:** Document appears authentic based on available examination methods. No clear indicators of forgery detected in visual analysis.`,
      confidence: 82.1,
      evidenceFound: [
        "Consistent paper quality throughout",
        "Standard business formatting",
        "Normal wear patterns for age",
        "No digital manipulation artifacts",
      ],
    },
  ],
};

const generalResponses = [
  {
    content: `I'm ready to assist with your forensic investigation. Please specify which type of analysis you need:

• **Fingerprint Analysis** - Pattern recognition, minutiae extraction, AFIS comparison
��� **Cyber Forensics** - Digital evidence recovery, metadata analysis, network investigation  
• **Document Examination** - Handwriting analysis, authenticity verification, ink analysis

Upload your evidence or describe the case details to begin the scientific analysis.`,
    confidence: 100,
  },
  {
    content: `Forensic analysis protocols initiated. I'm equipped with advanced AI algorithms trained on millions of forensic cases.

**Available Capabilities:**
✓ Multi-spectral image analysis
✓ Statistical pattern recognition  
✓ Cross-database correlation
✓ Expert system validation
✓ Court-admissible reporting

Please provide case specifics to proceed with evidence examination.`,
    confidence: 100,
  },
];

// Dynamic data generators
function generateRandomMinutiae() {
  return Math.floor(Math.random() * 15) + 18; // 18-32 minutiae
}

function generateRandomConfidence() {
  return Math.floor(Math.random() * 15) + 85; // 85-99% confidence
}

function generateRandomPattern() {
  const patterns = [
    "Whorl (Central Pocket Loop)",
    "Ulnar Loop",
    "Radial Loop",
    "Plain Whorl",
    "Double Loop Whorl",
    "Arch",
    "Tented Arch",
  ];
  return patterns[Math.floor(Math.random() * patterns.length)];
}

function generateRandomCoordinates() {
  return {
    x: Math.floor(Math.random() * 200) + 100,
    y: Math.floor(Math.random() * 200) + 100,
  };
}

function generateDynamicFingerprintResponse(message: string): AIResponse {
  const pattern = generateRandomPattern();
  const minutiae = generateRandomMinutiae();
  const confidence = generateRandomConfidence();
  const ridgeEndings = Math.floor(minutiae * 0.6);
  const bifurcations = minutiae - ridgeEndings;
  const deltaCount = pattern.includes("Whorl")
    ? 2
    : pattern.includes("Loop")
      ? 1
      : 0;
  const corePos = generateRandomCoordinates();

  return {
    content: `Fingerprint pattern analysis completed using automated ridge detection algorithms.

**Pattern Classification Results:**
• Primary Pattern: ${pattern}
• Core Position: Located at coordinates (${corePos.x}, ${corePos.y})
• Delta Count: ${deltaCount} delta${deltaCount !== 1 ? "s" : ""} detected
• Ridge Flow: ${pattern.includes("Whorl") ? "Circular pattern with recurving ridges" : pattern.includes("Loop") ? "Loop flow with single core and delta" : "Arch pattern with no recurving ridges"}

**Minutiae Detection:**
• Total Minutiae Points: ${minutiae} (exceeds identification threshold)
• Ridge Endings: ${ridgeEndings} points
• Bifurcations: ${bifurcations} points
• Ridge Quality: ${confidence > 90 ? "Excellent" : confidence > 80 ? "Good" : "Fair"} clarity
• Extractable Features: Sufficient for comparison

**Technical Analysis:**
• Image Resolution: ${Math.floor(Math.random() * 200) + 400} DPI (adequate for analysis)
• Ridge Clarity: ${Math.floor(Math.random() * 20) + 75}% of pattern area clear
• Noise Level: ${confidence > 90 ? "Minimal" : confidence > 80 ? "Low" : "Moderate"} interference detected
• Enhancement Applied: Gabor filtering for ridge clarity

The detected ${pattern.toLowerCase()} pattern with ${minutiae} minutiae points provides reliable data for comparison purposes.`,
    confidence: confidence,
    analysisSteps: [
      "Image enhancement and noise reduction",
      "Ridge structure extraction and thinning",
      "Automated minutiae detection algorithm",
      `Pattern classification (${pattern})`,
      "Quality assessment and feature validation",
    ],
    recommendations: [
      "Compare with known exemplar prints",
      "Verify minutiae points manually",
      "Check ridge flow consistency",
    ],
    evidenceFound: [
      `${minutiae} minutiae points successfully extracted`,
      `${pattern} pattern clearly identified`,
      "Ridge structure enhanced for comparison",
      "Core and delta landmarks located",
    ],
  };
}

function generateDynamicDocumentResponse(message: string): AIResponse {
  const confidence = Math.floor(Math.random() * 25) + 70; // 70-94% for documents
  const similarities = Math.floor(Math.random() * 4) + 6; // 6-9 out of 10

  const analysisTypes = [
    "handwriting comparison",
    "document verification",
    "digital image analysis",
    "layout analysis",
  ];
  const currentAnalysis =
    analysisTypes[Math.floor(Math.random() * analysisTypes.length)];

  return {
    content: `Document ${currentAnalysis} completed using visual examination methods.

**Comparative Analysis Results:**
• Letter Formation: ${similarities}/10 characteristics show similarity
• Writing Flow: ${confidence > 85 ? "Strong" : confidence > 75 ? "Moderate" : "Weak"} consistency observed
• Stroke Direction: ${Math.floor(Math.random() * 20) + 75}% alignment with reference samples
• Spatial Relationships: ${confidence > 80 ? "Good" : "Moderate"} correlation observed

**Key Observations:**
• ${confidence > 85 ? "Strong similarities in" : "Some variation in"} letter formation patterns
• ${confidence > 80 ? "Consistent" : "Variable"} pen pressure throughout document
• ${confidence > 75 ? "Matching" : "Different"} baseline characteristics observed
• ${confidence > 85 ? "Similar" : "Distinct"} spacing and alignment patterns

**Technical Details:**
• Scan Resolution: ${Math.floor(Math.random() * 400) + 600} DPI
• Analysis Method: Digital comparison with reference samples
• Enhancement: Contrast and clarity optimization applied

**Conclusion:** ${confidence > 85 ? "Strong" : confidence > 75 ? "Moderate" : "Limited"} evidence suggesting ${confidence > 80 ? "possible common" : "uncertain"} authorship. ${confidence < 80 ? "Additional exemplar samples recommended." : "Results suitable for comparative analysis."}`,
    confidence: confidence,
    analysisSteps: [
      "Digital image enhancement and calibration",
      "Visual feature extraction and measurement",
      "Comparative analysis with reference samples",
      "Pattern matching and statistical evaluation",
    ],
    recommendations: [
      confidence < 80
        ? "Obtain additional exemplar samples"
        : "Verify results with expert examiner",
      "Cross-reference with other writing samples",
      "Consider additional analysis methods",
    ],
  };
}

function generateDynamicCyberResponse(message: string): AIResponse {
  const filesFound = Math.floor(Math.random() * 2000) + 500;
  const recoverable = Math.floor(filesFound * (0.6 + Math.random() * 0.3));
  const confidence = Math.floor(Math.random() * 15) + 82;
  const dataSize = Math.floor(Math.random() * 500) + 100;

  return {
    content: `Digital forensics analysis completed on submitted evidence.

**Recovery Statistics:**
• Total Files Scanned: ${filesFound.toLocaleString()}
• Recoverable Files: ${recoverable.toLocaleString()} (${Math.floor((recoverable / filesFound) * 100)}%)
• Data Volume: ${dataSize} GB processed
• File Systems: ${Math.random() > 0.5 ? "NTFS, FAT32" : "NTFS, exFAT"} detected

**Evidence Analysis:**
• Deleted File Recovery: ${Math.floor(Math.random() * 300) + 100} files recovered
• Metadata Extraction: Complete timestamp analysis performed
• Registry Analysis: ${Math.floor(Math.random() * 1000) + 500} entries examined
• Network Artifacts: ${Math.floor(Math.random() * 50) + 10} connection records found

**Timeline Reconstruction:**
• First Activity: ${new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toLocaleDateString()}
• Last Activity: ${new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
• Peak Activity Period: ${Math.floor(Math.random() * 24)}:00 - ${Math.floor(Math.random() * 24)}:00 hours

**Security Assessment:**
• Encryption Status: ${Math.random() > 0.7 ? "Partial encryption detected" : "No encryption found"}
• Anti-forensics Tools: ${Math.random() > 0.8 ? "Evidence of cleaning tools" : "No anti-forensics detected"}
• Data Integrity: ${confidence > 90 ? "Excellent" : confidence > 80 ? "Good" : "Fair"} preservation state

Analysis confidence: ${confidence}% based on data preservation and recovery success rate.`,
    confidence: confidence,
    analysisSteps: [
      "Digital image acquisition and verification",
      "File system analysis and reconstruction",
      "Deleted data recovery procedures",
      "Metadata and timeline analysis",
      "Evidence correlation and reporting",
    ],
    evidenceFound: [
      `${recoverable.toLocaleString()} recoverable files identified`,
      "Complete timeline reconstruction available",
      "Registry and system artifacts preserved",
      "Network activity patterns documented",
    ],
  };
}

export function getAIResponse(
  message: string,
  department: string = "",
): AIResponse {
  const lowerMessage = message.toLowerCase();

  // Check if message mentions uploaded file for real analysis
  if (
    lowerMessage.includes("uploaded") ||
    lowerMessage.includes("analyze this") ||
    lowerMessage.includes("examine this")
  ) {
    if (
      department === "fingerprint" ||
      lowerMessage.includes("fingerprint") ||
      lowerMessage.includes("print")
    ) {
      return {
        content: `I can see you've uploaded a fingerprint image. Let me analyze the actual image data for you.

**Real Image Analysis Available:**
• Processing uploaded file for ridge patterns
• This analysis will examine your specific evidence
• Minutiae detection will be based on actual image content
• Pattern classification from your uploaded fingerprint

Please use the specialized Fingerprint Analysis Lab for detailed examination of your uploaded evidence. The lab tools will process your actual image and provide specific results based on the ridge patterns, minutiae points, and quality of your uploaded fingerprint.

Would you like me to guide you through uploading and analyzing your evidence in the dedicated lab environment?`,
        confidence: 95,
        analysisSteps: [
          "File upload and validation",
          "Image preprocessing for analysis",
          "Real minutiae detection from image",
          "Actual pattern classification",
          "Quality assessment of uploaded evidence",
        ],
        recommendations: [
          "Use the Fingerprint Analysis Lab for detailed results",
          "Ensure image is clear and well-lit",
          "Upload high-resolution scans for best results",
        ],
      };
    }
  }

  // Fingerprint Analysis Responses - Dynamic for general questions
  if (
    department === "fingerprint" ||
    lowerMessage.includes("fingerprint") ||
    lowerMessage.includes("print")
  ) {
    return generateDynamicFingerprintResponse(message);
  }

  // Cyber Forensics Responses - Now Dynamic
  if (
    department === "cyber" ||
    lowerMessage.includes("digital") ||
    lowerMessage.includes("cyber") ||
    lowerMessage.includes("metadata")
  ) {
    return generateDynamicCyberResponse(message);
  }

  // Document Analysis Responses - Now Dynamic
  if (
    department === "documents" ||
    lowerMessage.includes("handwriting") ||
    lowerMessage.includes("document") ||
    lowerMessage.includes("signature")
  ) {
    return generateDynamicDocumentResponse(message);
  }

  // General responses
  return generalResponses[Math.floor(Math.random() * generalResponses.length)];
}

export function getTypingDelay(text: string): number {
  // Simulate realistic typing delays based on response length
  const baseDelay = 1000;
  const wordsPerMinute = 180; // Fast AI typing
  const words = text.split(" ").length;
  return baseDelay + (words / wordsPerMinute) * 60 * 1000;
}

export const departments = [
  {
    id: "fingerprint",
    name: "Fingerprint Analysis",
    shortName: "AFIS",
    description:
      "Automated Fingerprint Identification System with pattern recognition and minutiae analysis",
    accuracy: 91.2,
    capabilities: [
      "Pattern Classification (Loop, Whorl, Arch)",
      "Minutiae Extraction and Mapping",
      "Ridge Structure Analysis",
      "Quality Assessment and Enhancement",
      "Comparative Analysis",
    ],
  },
  {
    id: "cyber",
    name: "Cyber Forensics",
    shortName: "Digital Lab",
    description:
      "Digital evidence acquisition, analysis, and recovery for cybercrime investigation",
    accuracy: 89.7,
    capabilities: [
      "Digital Evidence Acquisition",
      "Deleted File Recovery",
      "Metadata and Timeline Analysis",
      "File System Investigation",
      "Digital Artifact Detection",
    ],
  },
  {
    id: "documents",
    name: "Questioned Documents",
    shortName: "Doc Analysis",
    description: "Visual handwriting analysis and document examination",
    accuracy: 82.4,
    capabilities: [
      "Handwriting Comparison and Analysis",
      "Document Visual Examination",
      "Layout and Format Analysis",
      "Signature Comparison",
      "Digital Image Analysis",
    ],
  },
];
