import { RequestHandler } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_ROOT = path.resolve(__dirname, "../client/Fingerprint_Dataset");
const DATASET_DB_FOLDERS = ["DB1_B", "DB2_B", "DB3_B", "DB4_B"];

function normalizeDatasetPath(relativePath: string): string {
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, "/"));
  if (
    !normalized ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.startsWith("/")
  ) {
    throw new Error("Invalid dataset image path");
  }
  return normalized;
}

export const handleListFingerprintDatasetImages: RequestHandler = async (
  req,
  res,
) => {
  try {
    const files: string[] = [];

    for (const db of DATASET_DB_FOLDERS) {
      const dbPath = path.join(DATASET_ROOT, db);
      if (!fs.existsSync(dbPath)) {
        continue;
      }

      const entries = fs
        .readdirSync(dbPath)
        .filter((name) => /\.(tif|tiff)$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      for (const entry of entries) {
        files.push(`${db}/${entry}`);
      }
    }

    return res.json({
      success: true,
      files,
      total: files.length,
    });
  } catch (error) {
    console.error("Failed to list fingerprint dataset images:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list fingerprint dataset images",
    });
  }
};

export const handleGetFingerprintDatasetImage: RequestHandler = async (
  req,
  res,
) => {
  try {
    const rawPath = String(req.query.path || "");
    if (!rawPath) {
      return res.status(400).json({
        success: false,
        message: "Query parameter 'path' is required",
      });
    }

    const safeRelativePath = normalizeDatasetPath(rawPath);
    if (!/\.(tif|tiff)$/i.test(safeRelativePath)) {
      return res.status(400).json({
        success: false,
        message: "Only TIF/TIFF dataset images are supported",
      });
    }

    const absolutePath = path.join(DATASET_ROOT, safeRelativePath);
    const resolvedRoot = path.resolve(DATASET_ROOT);
    const resolvedImage = path.resolve(absolutePath);

    if (!resolvedImage.startsWith(resolvedRoot + path.sep)) {
      return res.status(400).json({
        success: false,
        message: "Invalid dataset image path",
      });
    }

    if (!fs.existsSync(resolvedImage)) {
      return res.status(404).json({
        success: false,
        message: "Dataset image not found",
      });
    }

    res.setHeader("Content-Type", "image/tiff");
    return res.sendFile(resolvedImage);
  } catch (error) {
    console.error("Failed to fetch fingerprint dataset image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch fingerprint dataset image",
    });
  }
};
