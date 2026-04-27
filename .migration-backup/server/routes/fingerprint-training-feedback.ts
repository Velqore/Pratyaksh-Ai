import { RequestHandler } from "express";
import fs from "fs";
import path from "path";

type FingerprintFeedbackRecord = {
  id: string;
  timestamp: string;
  caseId?: string | null;
  sourceFileName?: string;
  predictedPattern: string;
  correctedPattern: string;
  confidenceScore?: number;
  correctionNotes?: string;
  trainingFeatures?: number[];
  analysisSnapshot?: Record<string, unknown>;
};

const feedbackFilePath = path.join(
  process.cwd(),
  "server",
  "fingerprint_training_feedback.json",
);

function loadFeedbackRecords(): FingerprintFeedbackRecord[] {
  if (!fs.existsSync(feedbackFilePath)) {
    return [];
  }

  const content = fs.readFileSync(feedbackFilePath, "utf-8");
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : [];
}

export const handleSaveFingerprintTrainingFeedback: RequestHandler = async (
  req,
  res,
) => {
  try {
    const {
      caseId,
      sourceFileName,
      predictedPattern,
      correctedPattern,
      confidenceScore,
      correctionNotes,
      trainingFeatures,
      analysisSnapshot,
    } = req.body as {
      caseId?: string;
      sourceFileName?: string;
      predictedPattern?: string;
      correctedPattern?: string;
      confidenceScore?: number;
      correctionNotes?: string;
      trainingFeatures?: number[];
      analysisSnapshot?: Record<string, unknown>;
    };

    if (!predictedPattern || !correctedPattern) {
      return res.status(400).json({
        success: false,
        message: "predictedPattern and correctedPattern are required",
      });
    }

    const feedbackRecord: FingerprintFeedbackRecord = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      caseId,
      sourceFileName,
      predictedPattern,
      correctedPattern,
      confidenceScore,
      correctionNotes,
      trainingFeatures: Array.isArray(trainingFeatures)
        ? trainingFeatures
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
        : undefined,
      analysisSnapshot,
    };

    const feedback = loadFeedbackRecords();
    feedback.push(feedbackRecord);
    fs.writeFileSync(feedbackFilePath, JSON.stringify(feedback, null, 2));

    return res.json({
      success: true,
      message:
        "Training feedback saved successfully. Auto-training is disabled.",
      feedbackId: feedbackRecord.id,
      totalFeedbackRecords: feedback.length,
      retrainingStarted: false,
    });
  } catch (error) {
    console.error("Failed to save fingerprint training feedback:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save training feedback",
    });
  }
};