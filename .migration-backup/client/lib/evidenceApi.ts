// Client-side API service for evidence analysis

export interface EvidenceAnalysisResult {
  caseId: string;
  analysis: {
    result_id: string;
    case_id: string;
    analysis_type: string;
    confidence_score: number;
    pattern_type?: string;
    minutiae_count?: number;
    ridge_endings?: number;
    bifurcations?: number;
    ridge_count?: number;
    quality_score?: number;
    core_position?: { x: number; y: number };
    delta_count?: number;
    enhancement_applied?: string;
    analysis_steps: string[];
    evidence_found: string[];
    recommendations: string[];
    analysis_date: string;
    analysis_duration_ms: number;
    metadata: Record<string, any>;
    // Additional properties for fingerprint analysis
    knowledge_base_applied?: boolean;
    processing_method?: string;
    ml_powered?: boolean;
    professional_standards?: {
      iso_compliance: boolean;
      fbi_standards: boolean;
      quality_assessment: string;
      chain_of_custody: boolean;
      court_admissible?: boolean;
      meets_afis_standards?: boolean;
      recommended_for_court?: boolean;
    };
    minutiae_positions?: Array<{
      id?: string;
      x: number;
      y: number;
      type: string;
      angle: number;
    }>;
    delta_positions?: Array<{ x: number; y: number }>;
    pattern_characteristics?: Array<{
      classification?: string;
      quality_metrics?: Record<string, number>;
      ridge_flow?: string;
    }> | {
      classification: string;
      quality_metrics: Record<string, number>;
      ridge_flow: string;
    };
  };
}

export interface ChatAnalysisResult {
  caseId: string;
  response: string;
  analysis: EvidenceAnalysisResult["analysis"];
  processingStages: string[];
}

export interface EvidenceCase {
  case_id: string;
  case_number: string;
  case_type: "fingerprint" | "cyber" | "document";
  title: string;
  description?: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  upload_date: string;
  status: "pending" | "processing" | "analyzed" | "reviewed" | "archived";
}

class EvidenceApiService {
  private baseUrl = "/api/evidence";

  /**
   * Analyze evidence file through standard upload
   */
  async analyzeEvidence(
    file: File,
    caseType: "fingerprint" | "cyber" | "document",
    title: string,
    description?: string,
  ): Promise<EvidenceAnalysisResult> {
    const formData = new FormData();
    formData.append("evidence", file);
    formData.append("caseType", caseType);
    formData.append("title", title);
    if (description) {
      formData.append("description", description);
    }

    const response = await fetch(`${this.baseUrl}/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Network error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Analysis failed");
    }

    return result.data;
  }

  /**
   * Analyze evidence through chat interface
   */
  async chatAnalyzeEvidence(
    file: File,
    message: string,
    caseType?: "fingerprint" | "cyber" | "document",
  ): Promise<ChatAnalysisResult> {
    const formData = new FormData();
    formData.append("evidence", file);
    formData.append("message", message);
    if (caseType) {
      formData.append("caseType", caseType);
    }

    const response = await fetch(`${this.baseUrl}/chat-analyze`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Network error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Analysis failed");
    }

    return result.data;
  }

  /**
   * Get evidence case details
   */
  async getEvidenceCase(caseId: string): Promise<{
    case: EvidenceCase;
    analysis: EvidenceAnalysisResult["analysis"];
  }> {
    const response = await fetch(`${this.baseUrl}/case/${caseId}`);

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Network error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to retrieve case");
    }

    return result.data;
  }

  /**
   * Get processed image from specific stage
   */
  async getProcessedImage(
    caseId: string,
    stage: "original" | "enhanced" | "denoised" | "binarized" | "skeletonized",
  ): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/case/${caseId}/image/${stage}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to get ${stage} image`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  /**
   * Get recent evidence cases
   */
  async getRecentCases(limit: number = 10): Promise<EvidenceCase[]> {
    const response = await fetch(`${this.baseUrl}/recent?limit=${limit}`);

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Network error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to retrieve cases");
    }

    return result.data;
  }

  /**
   * Search evidence cases
   */
  async searchCases(
    searchTerm: string,
    caseType?: "fingerprint" | "cyber" | "document",
  ): Promise<EvidenceCase[]> {
    const params = new URLSearchParams({ q: searchTerm });
    if (caseType) {
      params.append("type", caseType);
    }

    const response = await fetch(`${this.baseUrl}/search?${params}`);

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Network error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Search failed");
    }

    return result.data;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const result = await response.json();
      return result.success && result.data.status === "healthy";
    } catch (error) {
      console.error("Health check failed:", error);
      return false;
    }
  }
}

export const evidenceApi = new EvidenceApiService();

// Helper function to determine case type from file
export function determineCaseTypeFromFile(
  file: File,
): "fingerprint" | "cyber" | "document" {
  const { type, name } = file;

  // Check MIME type first
  if (type.startsWith("image/")) {
    // For images, default to fingerprint but could be cyber forensics
    if (
      name.toLowerCase().includes("finger") ||
      name.toLowerCase().includes("print")
    ) {
      return "fingerprint";
    }
    return "fingerprint"; // Default for images
  }

  if (
    type === "application/pdf" ||
    type === "application/msword" ||
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "text/plain"
  ) {
    return "document";
  }

  // Check filename extensions as fallback
  const extension = name.toLowerCase().split(".").pop();

  if (["jpg", "jpeg", "png", "bmp", "tiff", "webp"].includes(extension || "")) {
    return "fingerprint";
  }

  if (["pdf", "doc", "docx", "txt", "rtf"].includes(extension || "")) {
    return "document";
  }

  // Default to cyber for any digital evidence
  return "cyber";
}

// Helper function to format analysis response for chat
export function formatAnalysisForChat(
  analysis: EvidenceAnalysisResult["analysis"],
): string {
  let response = `## Analysis Complete\n\n`;

  response += `**Confidence:** ${analysis.confidence_score}%\n`;

  if (analysis.pattern_type) {
    response += `**Pattern:** ${analysis.pattern_type}\n`;
  }

  if (analysis.minutiae_count) {
    response += `**Minutiae Points:** ${analysis.minutiae_count}\n`;
  }

  if (analysis.quality_score) {
    response += `**Quality Score:** ${analysis.quality_score}/10\n`;
  }

  response += `\n**Processing Time:** ${(analysis.analysis_duration_ms / 1000).toFixed(2)}s\n\n`;

  if (analysis.evidence_found.length > 0) {
    response += `**Evidence Found:**\n`;
    analysis.evidence_found.forEach((evidence) => {
      response += `• ${evidence}\n`;
    });
    response += "\n";
  }

  if (analysis.recommendations.length > 0) {
    response += `**Recommendations:**\n`;
    analysis.recommendations.forEach((rec) => {
      response += `• ${rec}\n`;
    });
  }

  return response;
}

// Types are already exported above
