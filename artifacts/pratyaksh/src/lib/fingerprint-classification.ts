/**
 * Fingerprint Classification Service
 * Client-side service for classifying fingerprints using trained neural network
 */

interface FingerprintFeatures {
  minutiae_count?: number;
  core_position?: { x: number; y: number };
  delta_positions?: Array<{ x: number; y: number }>;
  quality_score?: number;
  image_size?: { width: number; height: number };
  minutiae_by_type?: { ridge_ending: number; bifurcation: number };
  minutiae_variance?: { x: number; y: number };
  minutiae_spread?: number;
}

interface ClassificationResult {
  success: boolean;
  classification?: {
    pattern: string;
    confidence: number;
    probabilities: Record<string, number>;
  };
  extracted_features?: number[];
  model_info?: {
    version: string;
    accuracy: number;
  };
  error?: string;
  message?: string;
}

interface ModelInfo {
  success: boolean;
  model?: {
    timestamp: string;
    patterns: string[];
    featureDimensions: number;
    accuracy: { train: number; test: number };
    datasetSize: { train: number; test: number };
  };
  message?: string;
}

/**
 * Extract fingerprint features from an image and minutiae data
 */
function extractFeaturesFromFingerprint(
  minutiae: Array<{ x: number; y: number; type: string; quality?: number }>,
  corePosition?: { x: number; y: number },
  deltaPositions?: Array<{ x: number; y: number }>,
  imageSize?: { width: number; height: number }
): number[] {
  const w = imageSize?.width || 512;
  const h = imageSize?.height || 512;
  const minutiaeCount = minutiae.length;

  // Count minutiae types
  let ridgeEndings = 0;
  let bifurcations = 0;
  const xs: number[] = [];
  const ys: number[] = [];

  for (const m of minutiae) {
    xs.push(m.x);
    ys.push(m.y);
    if (m.type === "ridge_ending") ridgeEndings++;
    if (m.type === "bifurcation") bifurcations++;
  }

  // Calculate variance and spread
  const meanX = xs.length > 0 ? xs.reduce((a, b) => a + b) / xs.length : w / 2;
  const meanY = ys.length > 0 ? ys.reduce((a, b) => a + b) / ys.length : h / 2;

  let varX = 0;
  let varY = 0;
  if (xs.length > 0) {
    varX = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0) / xs.length / (w * w);
    varY = ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0) / ys.length / (h * h);
  }

  const maxX = xs.length > 0 ? Math.max(...xs) : w;
  const minX = xs.length > 0 ? Math.min(...xs) : 0;
  const maxY = ys.length > 0 ? Math.max(...ys) : h;
  const minY = ys.length > 0 ? Math.min(...ys) : 0;

  const spread = ((maxX - minX) + (maxY - minY)) / (w + h);
  const density = minutiaeCount / ((w * h) / 10000);

  // Create feature vector matching training format
  return [
    minutiaeCount / 100, // Normalized count
    (corePosition?.x || w / 2) / 512, // Core X (normalized)
    (corePosition?.y || h / 2) / 512, // Core Y (normalized)
    (deltaPositions?.length || 0) / 3, // Number of deltas
    0.5, // Default quality score
    ridgeEndings / Math.max(minutiaeCount, 1), // Ridge ending ratio
    bifurcations / Math.max(minutiaeCount, 1), // Bifurcation ratio
    density, // Minutiae density
    varX, // X variance
    varY, // Y variance
    spread, // Spread
  ];
}

/**
 * Classify a fingerprint using extracted features
 */
export async function classifyFingerprintByFeatures(
  features: number[]
): Promise<ClassificationResult> {
  try {
    const response = await fetch("/api/classify/fingerprint", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ features }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || `HTTP ${response.status}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Classify a fingerprint from analyzed image data
 */
export async function classifyFingerprintImage(
  fingerprintData: FingerprintFeatures
): Promise<ClassificationResult> {
  try {
    const response = await fetch("/api/classify/fingerprint/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fingerprintData),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || `HTTP ${response.status}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get model information
 */
export async function getClassifierModelInfo(): Promise<ModelInfo> {
  try {
    const response = await fetch("/api/classify/fingerprint/model");

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        message: error.message || `HTTP ${response.status}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Analyze fingerprint and classify pattern
 */
export async function analyzeAndClassifyFingerprint(
  minutiae: Array<{ x: number; y: number; type: string; quality?: number }>,
  corePosition?: { x: number; y: number },
  deltaPositions?: Array<{ x: number; y: number }>,
  imageSize?: { width: number; height: number }
): Promise<ClassificationResult> {
  try {
    const features = extractFeaturesFromFingerprint(
      minutiae,
      corePosition,
      deltaPositions,
      imageSize
    );

    return await classifyFingerprintByFeatures(features);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const fingerprintClassificationService = {
  classifyByFeatures: classifyFingerprintByFeatures,
  classifyImage: classifyFingerprintImage,
  getModelInfo: getClassifierModelInfo,
  analyzeAndClassify: analyzeAndClassifyFingerprint,
  extractFeatures: extractFeaturesFromFingerprint,
};
