import { RequestHandler } from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

interface TrainingStatusRecord {
  id: string;
  startTime: string;
  status: "queued" | "in-progress" | "completed" | "failed";
  progress: number;
  message: string;
  logsPath?: string;
  error?: string;
  modelPath?: string;
  accuracy?: {
    train: number;
    test: number;
  };
  endTime?: string;
}

const trainingStatusPath = path.join(
  process.cwd(),
  "server",
  "training_status.json",
);
const trainingLogsDir = path.join(process.cwd(), "server", "training_logs");

// Ensure logs directory exists
if (!fs.existsSync(trainingLogsDir)) {
  fs.mkdirSync(trainingLogsDir, { recursive: true });
}

let currentTraining: {
  id: string;
  process: any;
  status: "running" | "completed" | "failed";
} | null = null;

function getTrainingStatus(): TrainingStatusRecord[] {
  if (!fs.existsSync(trainingStatusPath)) {
    return [];
  }

  const content = fs.readFileSync(trainingStatusPath, "utf-8");
  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function saveTrainingStatus(records: TrainingStatusRecord[]): void {
  fs.writeFileSync(trainingStatusPath, JSON.stringify(records, null, 2));
}

function updateTrainingStatus(
  id: string,
  updates: Partial<TrainingStatusRecord>,
): void {
  const records = getTrainingStatus();
  const idx = records.findIndex((r) => r.id === id);

  if (idx >= 0) {
    records[idx] = { ...records[idx], ...updates };
  } else {
    records.push({ id, ...updates } as TrainingStatusRecord);
  }

  saveTrainingStatus(records);
}

export const handleStartTraining: RequestHandler = async (req, res) => {
  return res.status(503).json({
    success: false,
    message:
      "Fingerprint auto-training is temporarily disabled. Use the Manual Fingerprint Labeling Panel.",
  });

  try {
    // Check if training is already in progress
    if (currentTraining && currentTraining.status === "running") {
      return res.status(409).json({
        success: false,
        message: "Training already in progress",
        trainingId: currentTraining.id,
      });
    }

    const trainingId = `train_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const logsPath = path.join(
      trainingLogsDir,
      `${trainingId}_training.log`,
    );

    // Create initial status record
    updateTrainingStatus(trainingId, {
      startTime: new Date().toISOString(),
      status: "queued",
      progress: 0,
      message: "Training job queued, preparing to start...",
      logsPath,
    });

    // Spawn training process in background
    const scriptPath = path.resolve(
      "scripts/train_fingerprint_classifier.js",
    );

    const trainingProcess = spawn("node", [scriptPath, "--auto", "--target=98", "--max-runs=30", "--epochs=220"], {
      cwd: process.cwd(),
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const logStream = fs.createWriteStream(logsPath, { flags: "a" });

    trainingProcess.stdout?.on("data", (data) => {
      const message = data.toString();
      logStream.write(`[stdout] ${message}\n`);

      // Extract progress from output
      if (message.includes("Epoch")) {
        const progressMatch = message.match(/Accuracy=(\d+\.?\d*)/);
        if (progressMatch) {
          const accuracy = Math.min(
            100,
            Math.max(0, parseFloat(progressMatch[1])),
          );
          updateTrainingStatus(trainingId, {
            progress: Math.round(accuracy),
            message: `Training in progress... ${accuracy.toFixed(1)}% accuracy`,
          });
        }
      }

      if (message.includes("✅ Training complete")) {
        updateTrainingStatus(trainingId, {
          status: "completed",
          progress: 100,
          message: "Training completed successfully",
          endTime: new Date().toISOString(),
        });
        currentTraining = null;
      }
    });

    trainingProcess.stderr?.on("data", (data) => {
      logStream.write(`[stderr] ${data.toString()}\n`);
    });

    trainingProcess.on("close", (code) => {
      logStream.end();

      if (code !== 0) {
        updateTrainingStatus(trainingId, {
          status: "failed",
          error: `Training process exited with code ${code}`,
          endTime: new Date().toISOString(),
        });
        currentTraining = null;
      }
    });

    // Allow process to continue in background
    trainingProcess.unref();

    currentTraining = {
      id: trainingId,
      process: trainingProcess,
      status: "running",
    };

    // Update status to in-progress
    updateTrainingStatus(trainingId, {
      status: "in-progress",
      message: "Training started, processing fingerprint data...",
    });

    return res.status(202).json({
      success: true,
      message: "Training initiated",
      trainingId,
      statusUrl: `/api/fingerprint/training-status/${trainingId}`,
    });
  } catch (error) {
    console.error("Failed to start training:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initiate training",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const handleGetTrainingStatus: RequestHandler = async (req, res) => {
  try {
    const { trainingId } = req.params;

    if (!trainingId) {
      // Get all training records
      const records = getTrainingStatus();
      const sortedRecords = records.sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      );

      return res.json({
        success: true,
        data: {
          records: sortedRecords,
          currentTraining: currentTraining ? currentTraining.id : null,
        },
      });
    }

    // Get specific training record
    const records = getTrainingStatus();
    const record = records.find((r) => r.id === trainingId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Training record not found",
      });
    }

    return res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("Failed to get training status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve training status",
    });
  }
};

export const handleGetTrainingLogs: RequestHandler = async (req, res) => {
  try {
    const { trainingId } = req.params;

    const logsPath = path.join(trainingLogsDir, `${trainingId}_training.log`);

    if (!fs.existsSync(logsPath)) {
      return res.status(404).json({
        success: false,
        message: "Training logs not found",
      });
    }

    const logs = fs.readFileSync(logsPath, "utf-8");

    return res.json({
      success: true,
      data: {
        trainingId,
        logs,
      },
    });
  } catch (error) {
    console.error("Failed to get training logs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve training logs",
    });
  }
};
