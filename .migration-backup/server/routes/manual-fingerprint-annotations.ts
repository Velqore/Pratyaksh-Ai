import { RequestHandler } from "express";
import fs from "fs";
import path from "path";

type ManualPoint = {
  id: string;
  x: number;
  y: number;
  type:
    | "ridge_ending"
    | "bifurcation"
    | "dot"
    | "island"
    | "lake"
    | "spur"
    | "bridge"
    | "crossover"
    | "trifurcation"
    | "double_bifurcation"
    | "opposed_bifurcation"
    | "divergence"
    | "convergence"
    | "tuning_fork"
    | "appendage"
    | "overlap"
    | "fragment"
    | "bar_rod"
    | "core"
    | "delta";
  note?: string;
};

type ManualAnnotationRecord = {
  id: string;
  createdAt: string;
  sourceFileName: string;
  image: {
    width: number;
    height: number;
  };
  patternLabel: string;
  points: ManualPoint[];
  identificationGuidance: string;
  analystNotes?: string;
};

const manualAnnotationsPath = path.join(
  process.cwd(),
  "server",
  "fingerprint_manual_annotations.json",
);

function loadManualAnnotations(): ManualAnnotationRecord[] {
  if (!fs.existsSync(manualAnnotationsPath)) {
    return [];
  }

  const content = fs.readFileSync(manualAnnotationsPath, "utf-8");
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : [];
}

export const handleSaveManualFingerprintAnnotations: RequestHandler = async (
  req,
  res,
) => {
  try {
    const payload = req.body as Partial<ManualAnnotationRecord>;

    if (!payload?.sourceFileName || !payload?.patternLabel) {
      return res.status(400).json({
        success: false,
        message: "sourceFileName and patternLabel are required",
      });
    }

    if (!Array.isArray(payload.points) || payload.points.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one manual point is required",
      });
    }

    const record: ManualAnnotationRecord = {
      id: payload.id || `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: payload.createdAt || new Date().toISOString(),
      sourceFileName: payload.sourceFileName,
      image: {
        width: Number(payload.image?.width || 0),
        height: Number(payload.image?.height || 0),
      },
      patternLabel: payload.patternLabel,
      points: payload.points,
      identificationGuidance: payload.identificationGuidance || "",
      analystNotes: payload.analystNotes,
    };

    const records = loadManualAnnotations();
    records.push(record);
    fs.writeFileSync(manualAnnotationsPath, JSON.stringify(records, null, 2));

    return res.json({
      success: true,
      message: "Manual annotation saved",
      annotationId: record.id,
      totalRecords: records.length,
    });
  } catch (error) {
    console.error("Failed to save manual fingerprint annotation:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save manual fingerprint annotation",
    });
  }
};
