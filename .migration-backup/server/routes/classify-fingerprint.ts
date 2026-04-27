import { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface FingerprintModel {
  timestamp: string;
  patternMap: Record<string, number>;
  reversePatternMap: Record<number, string>;
  classifier: {
    inputSize: number;
    hiddenSize: number;
    outputSize: number;
    w1: number[][];
    b1: number[];
    w2: number[][];
    b2: number[];
  };
  normalization: {
    means: number[];
    stds: number[];
  };
  trainingStats: {
    trainSize: number;
    testSize: number;
    trainAccuracy: number;
    testAccuracy: number;
  };
  featureDimensions: number;
}

let model: FingerprintModel | null = null;

function loadModel(): FingerprintModel {
  if (model) return model;

  // Try multiple paths to find the model
  const possiblePaths = [
    path.join(__dirname, "fingerprint_model.json"),
    path.join(process.cwd(), "server", "fingerprint_model.json"),
    path.resolve("server/fingerprint_model.json"),
  ];

  let modelPath = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      modelPath = p;
      break;
    }
  }

  if (!modelPath) {
    console.error(`Model not found in any of: ${possiblePaths.join(", ")}`);
    throw new Error("Fingerprint model not found. Please train the model first.");
  }

  const modelContent = fs.readFileSync(modelPath, "utf-8");
  model = JSON.parse(modelContent);
  return model;
}

function relu(x: number): number {
  return Math.max(0, x);
}

function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const sumExp = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / (sumExp + 1e-10));
}

function predict(features: number[], model: FingerprintModel): { pattern: string; confidence: number; probabilities: Record<string, number> } {
  const { classifier, normalization, reversePatternMap } = model;

  // Normalize features
  const normalizedFeatures = features.map((val, i) => (val - normalization.means[i]) / Math.max(normalization.stds[i], 1e-10));

  // Forward pass through network
  let hidden = [];
  for (let j = 0; j < classifier.hiddenSize; j++) {
    let sum = classifier.b1[j];
    for (let i = 0; i < normalizedFeatures.length; i++) {
      sum += normalizedFeatures[i] * (classifier.w1[i]?.[j] ?? 0);
    }
    hidden.push(relu(sum));
  }

  // Output layer
  let output = [];
  for (let j = 0; j < classifier.outputSize; j++) {
    let sum = classifier.b2[j];
    for (let i = 0; i < hidden.length; i++) {
      sum += hidden[i] * (classifier.w2[i]?.[j] ?? 0);
    }
    output.push(sum);
  }

  const probs = softmax(output);
  const maxIdx = probs.indexOf(Math.max(...probs));

  const patternName = reversePatternMap[maxIdx] || "unknown";
  const confidence = probs[maxIdx];

  // Build probability map
  const probabilities: Record<string, number> = {};
  for (let i = 0; i < probs.length; i++) {
    const pattern = reversePatternMap[i];
    if (pattern && !isNaN(probs[i])) {
      probabilities[pattern] = Math.round(probs[i] * 10000) / 100; // Convert to percentage
    }
  }

  return {
    pattern: patternName,
    confidence: Math.round(confidence * 10000) / 100,
    probabilities,
  };
}

export const handleClassifyFingerprint: RequestHandler = async (req, res) => {
  try {
    const { features } = req.body as { features?: number[] };

    if (!features || !Array.isArray(features)) {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid 'features' array in request body",
      });
    }

    try {
      const model = loadModel();

      if (features.length !== model.featureDimensions) {
        return res.status(400).json({
          success: false,
          message: `Expected ${model.featureDimensions} features, got ${features.length}`,
        });
      }

      const result = predict(features, model);

      return res.json({
        success: true,
        classification: result,
        model_info: {
          version: model.timestamp,
          accuracy: model.trainingStats.testAccuracy,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(503).json({
          success: false,
          message: error.message,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Classification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const handleClassifyFingerprintImage: RequestHandler = async (req, res) => {
  try {
    const {
      minutiae_count,
      core_position,
      delta_positions,
      quality_score,
      image_size,
      minutiae_by_type,
      minutiae_variance,
      minutiae_spread,
    } = req.body as {
      minutiae_count?: number;
      core_position?: { x: number; y: number };
      delta_positions?: Array<{ x: number; y: number }>;
      quality_score?: number;
      image_size?: { width: number; height: number };
      minutiae_by_type?: { ridge_ending: number; bifurcation: number };
      minutiae_variance?: { x: number; y: number };
      minutiae_spread?: number;
    };

    // Extract features from fingerprint data
    const features = [
      (minutiae_count || 0) / 100,
      (core_position?.x || 0) / 512,
      (core_position?.y || 0) / 512,
      (delta_positions?.length || 0) / 3,
      quality_score || 0.5,
      (minutiae_by_type?.ridge_ending || 0) / (minutiae_count || 1),
      (minutiae_by_type?.bifurcation || 0) / (minutiae_count || 1),
      (minutiae_count || 0) / ((image_size?.width || 512) * (image_size?.height || 512) / 10000),
      minutiae_variance?.x || 0,
      minutiae_variance?.y || 0,
      minutiae_spread || 0,
    ];

    const model = loadModel();
    const result = predict(features, model);

    return res.json({
      success: true,
      classification: result,
      extracted_features: features,
      model_info: {
        version: model.timestamp,
        accuracy: model.trainingStats.testAccuracy,
      },
    });
  } catch (error) {
    console.error("Image classification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to classify fingerprint image",
    });
  }
};

export const handleGetModelInfo: RequestHandler = async (req, res) => {
  try {
    const model = loadModel();

    return res.json({
      success: true,
      model: {
        timestamp: model.timestamp,
        patterns: Object.keys(model.patternMap),
        featureDimensions: model.featureDimensions,
        accuracy: {
          train: model.trainingStats.trainAccuracy,
          test: model.trainingStats.testAccuracy,
        },
        datasetSize: {
          train: model.trainingStats.trainSize,
          test: model.trainingStats.testSize,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(503).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to retrieve model info",
    });
  }
};
