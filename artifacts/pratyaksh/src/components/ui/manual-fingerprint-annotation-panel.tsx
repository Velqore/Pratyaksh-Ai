import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as UTIF from "utif";

type MinutiaeType =
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
  | "delta"
  | "core";

type ManualPoint = {
  id: string;
  x: number;
  y: number;
  type: MinutiaeType;
  note?: string;
};

type ManualAnnotationPayload = {
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
  analystNotes: string;
};

type PointInteractionMode = "add" | "delete";

type MarkerShape =
  | "circle"
  | "square"
  | "diamond"
  | "triangle"
  | "ring"
  | "cross"
  | "bar"
  | "hex"
  | "star";

const PATTERN_OPTIONS = [
  "whorl",
  "ulnar_loop",
  "radial_loop",
  "plain_arch",
  "tented_arch",
  "accidental",
];

const MINUTIAE_OPTIONS: Array<{
  value: MinutiaeType;
  label: string;
  aliases?: string;
}> = [
  {
    value: "ridge_ending",
    label: "Ridge Ending",
    aliases: "termination, stop",
  },
  { value: "bifurcation", label: "Bifurcation", aliases: "fork" },
  { value: "dot", label: "Dot", aliases: "ridge dot" },
  { value: "island", label: "Island", aliases: "short ridge" },
  { value: "lake", label: "Lake", aliases: "enclosure, eye" },
  { value: "spur", label: "Spur", aliases: "hook" },
  { value: "bridge", label: "Bridge" },
  { value: "crossover", label: "Crossover", aliases: "ridge crossing" },
  { value: "trifurcation", label: "Trifurcation" },
  { value: "double_bifurcation", label: "Double Bifurcation" },
  { value: "opposed_bifurcation", label: "Opposed Bifurcation" },
  { value: "divergence", label: "Divergence" },
  { value: "convergence", label: "Convergence" },
  { value: "tuning_fork", label: "Tuning Fork", aliases: "tunning fork" },
  { value: "appendage", label: "Appendage", aliases: "appendages" },
  { value: "overlap", label: "Overlap", aliases: "over/under" },
  { value: "fragment", label: "Fragment" },
  { value: "bar_rod", label: "Bar", aliases: "rod" },
  { value: "delta", label: "Delta", aliases: "singular point" },
  { value: "core", label: "Core", aliases: "singular point" },
];

const MINUTIAE_LABELS: Record<MinutiaeType, string> = Object.fromEntries(
  MINUTIAE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<MinutiaeType, string>;

const POINT_COLORS: Record<MinutiaeType, string> = {
  ridge_ending: "#f97316",
  bifurcation: "#22c55e",
  dot: "#f43f5e",
  island: "#a855f7",
  lake: "#0ea5e9",
  spur: "#f59e0b",
  bridge: "#84cc16",
  crossover: "#ef4444",
  trifurcation: "#06b6d4",
  double_bifurcation: "#14b8a6",
  opposed_bifurcation: "#8b5cf6",
  divergence: "#3b82f6",
  convergence: "#16a34a",
  tuning_fork: "#f472b6",
  appendage: "#fb7185",
  overlap: "#94a3b8",
  fragment: "#64748b",
  bar_rod: "#84cc16",
  core: "#06b6d4",
  delta: "#eab308",
};

const POINT_SHAPES: Record<MinutiaeType, MarkerShape> = {
  ridge_ending: "circle",
  bifurcation: "square",
  dot: "circle",
  island: "diamond",
  lake: "ring",
  spur: "diamond",
  bridge: "bar",
  crossover: "cross",
  trifurcation: "hex",
  double_bifurcation: "hex",
  opposed_bifurcation: "cross",
  divergence: "triangle",
  convergence: "triangle",
  tuning_fork: "star",
  appendage: "diamond",
  overlap: "cross",
  fragment: "bar",
  bar_rod: "bar",
  delta: "triangle",
  core: "star",
};

function formatPatternLabel(pattern: string): string {
  return pattern
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isTiffFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    file.type === "image/tiff" ||
    file.type === "image/tif" ||
    lowerName.endsWith(".tif") ||
    lowerName.endsWith(".tiff")
  );
}

interface ManualFingerprintAnnotationPanelProps {
  file: File | null;
}

export function ManualFingerprintAnnotationPanel({
  file,
}: ManualFingerprintAnnotationPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [datasetFiles, setDatasetFiles] = useState<string[]>([]);
  const [datasetIndex, setDatasetIndex] = useState(0);
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [isDatasetLoading, setIsDatasetLoading] = useState(false);
  const [sourceMode, setSourceMode] = useState<"upload" | "dataset">("dataset");
  const [selectedPattern, setSelectedPattern] = useState("");
  const [selectedPointType, setSelectedPointType] = useState<MinutiaeType>(
    "ridge_ending",
  );
  const [interactionMode, setInteractionMode] =
    useState<PointInteractionMode>("add");
  const [points, setPoints] = useState<ManualPoint[]>([]);
  const [analystNotes, setAnalystNotes] = useState("");
  const [identificationGuidance, setIdentificationGuidance] = useState(
    "Mark ridge endings and bifurcations in clear ridge flow regions. Mark one core and visible delta points before assigning final pattern label.",
  );

  const activeFile =
    sourceMode === "upload" && file ? file : datasetFile || file;
  const canAnnotate = Boolean(activeFile && imageWidth > 0 && imageHeight > 0);

  const pointStats = useMemo(() => {
    const counts = Object.fromEntries(
      MINUTIAE_OPTIONS.map((option) => [option.value, 0]),
    ) as Record<MinutiaeType, number>;

    for (const point of points) {
      counts[point.type] = (counts[point.type] || 0) + 1;
    }

    return counts;
  }, [points]);

  const renderMarkerShape = (point: ManualPoint) => {
    const color = POINT_COLORS[point.type];
    const shape = POINT_SHAPES[point.type];

    switch (shape) {
      case "triangle":
        return (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <polygon points="7,1 13,13 1,13" fill={color} stroke="white" strokeWidth="1" />
          </svg>
        );
      case "square":
        return (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <rect x="2" y="2" width="10" height="10" fill={color} stroke="white" strokeWidth="1" />
          </svg>
        );
      case "diamond":
        return (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <polygon points="7,1 13,7 7,13 1,7" fill={color} stroke="white" strokeWidth="1" />
          </svg>
        );
      case "ring":
        return (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="5" fill="transparent" stroke={color} strokeWidth="3" />
          </svg>
        );
      case "cross":
        return (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <line x1="2" y1="2" x2="12" y2="12" stroke={color} strokeWidth="2.5" />
            <line x1="12" y1="2" x2="2" y2="12" stroke={color} strokeWidth="2.5" />
          </svg>
        );
      case "bar":
        return (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <rect x="1" y="5" width="12" height="4" rx="2" fill={color} stroke="white" strokeWidth="1" />
          </svg>
        );
      case "hex":
        return (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <polygon points="4,1 10,1 13,7 10,13 4,13 1,7" fill={color} stroke="white" strokeWidth="1" />
          </svg>
        );
      case "star":
        return (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <polygon
              points="7,1 8.8,5 13,5.2 9.8,7.8 10.8,12 7,9.6 3.2,12 4.2,7.8 1,5.2 5.2,5"
              fill={color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
        );
      case "circle":
      default:
        return (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="5" fill={color} stroke="white" strokeWidth="1" />
          </svg>
        );
    }
  };

  useEffect(() => {
    const loadDatasetList = async () => {
      try {
        const response = await fetch("/api/fingerprint/dataset-images");
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to load dataset image list");
        }

        const files = Array.isArray(result.files) ? result.files : [];
        setDatasetFiles(files);

        if (files.length > 0) {
          await loadDatasetFile(files[0], 0);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load fingerprint dataset";
        toast.error(message);
      }
    };

    loadDatasetList();
  }, []);

  useEffect(() => {
    if (file) {
      setSourceMode("upload");
    }
  }, [file]);

  useEffect(() => {
    setPoints([]);
    setSelectedPattern("");
    setAnalystNotes("");

    if (!activeFile) {
      clearCanvas();
      return;
    }

    const loadImage = async () => {
      try {
        if (isTiffFile(activeFile)) {
          await drawTiff(activeFile);
          return;
        }

        await drawStandardImage(activeFile);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to open fingerprint image";
        toast.error(message);
        clearCanvas();
      }
    };

    loadImage();
  }, [activeFile]);

  const loadDatasetFile = async (relativePath: string, index: number) => {
    setIsDatasetLoading(true);
    try {
      const response = await fetch(
        `/api/fingerprint/dataset-image?path=${encodeURIComponent(relativePath)}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load selected dataset image");
      }

      const blob = await response.blob();
      const filename = relativePath.split("/").pop() || `dataset_${index}.tif`;
      const tifFile = new File([blob], filename, {
        type: blob.type || "image/tiff",
      });

      setDatasetFile(tifFile);
      setDatasetIndex(index);
      setSourceMode("dataset");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to open dataset fingerprint image";
      toast.error(message);
    } finally {
      setIsDatasetLoading(false);
    }
  };

  const loadPrevDatasetImage = async () => {
    if (datasetFiles.length === 0) return;
    const nextIndex = (datasetIndex - 1 + datasetFiles.length) % datasetFiles.length;
    await loadDatasetFile(datasetFiles[nextIndex], nextIndex);
  };

  const loadNextDatasetImage = async () => {
    if (datasetFiles.length === 0) return;
    const nextIndex = (datasetIndex + 1) % datasetFiles.length;
    await loadDatasetFile(datasetFiles[nextIndex], nextIndex);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setImageWidth(0);
    setImageHeight(0);
    setDisplayScale(1);
  };

  const drawStandardImage = async (imageFile: File) => {
    const imageUrl = URL.createObjectURL(imageFile);
    try {
      const image = await loadHtmlImage(imageUrl);
      drawToCanvas(image.width, image.height, (ctx) => {
        ctx.drawImage(image, 0, 0);
      });
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const drawTiff = async (imageFile: File) => {
    const buffer = await imageFile.arrayBuffer();
    const ifds = UTIF.decode(buffer);

    if (!ifds.length) {
      throw new Error("No TIFF frame found in selected file.");
    }

    UTIF.decodeImage(buffer, ifds[0]);
    const rgba = UTIF.toRGBA8(ifds[0]);
    const width = ifds[0].width as number;
    const height = ifds[0].height as number;

    if (!width || !height || !rgba) {
      throw new Error("Unsupported TIFF format for browser rendering.");
    }

    drawToCanvas(width, height, (ctx) => {
      const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
      ctx.putImageData(imageData, 0, 0);
    });
  };

  const drawToCanvas = (
    sourceWidth: number,
    sourceHeight: number,
    painter: (ctx: CanvasRenderingContext2D) => void,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    painter(ctx);

    setImageWidth(sourceWidth);
    setImageHeight(sourceHeight);
    setDisplayScale(1);
  };

  const loadHtmlImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to read selected image file."));
      image.src = src;
    });

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canAnnotate) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left) / displayScale);
    const y = Math.round((event.clientY - rect.top) / displayScale);

    if (interactionMode === "delete") {
      const radius = 14 / Math.max(displayScale, 0.2);
      let nearestId = "";
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const point of points) {
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance <= radius && distance < nearestDistance) {
          nearestDistance = distance;
          nearestId = point.id;
        }
      }

      if (nearestId) {
        removePoint(nearestId);
      }
      return;
    }

    const nextPoint: ManualPoint = {
      id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      x,
      y,
      type: selectedPointType,
    };

    setPoints((prev) => [...prev, nextPoint]);
  };

  const removePoint = (id: string) => {
    setPoints((prev) => prev.filter((point) => point.id !== id));
  };

  const clearPoints = () => {
    setPoints([]);
  };

  const undoLastPoint = () => {
    setPoints((prev) => prev.slice(0, -1));
  };

  const zoomIn = () => {
    setDisplayScale((prev) => Math.min(4, prev + 0.25));
  };

  const zoomOut = () => {
    setDisplayScale((prev) => Math.max(0.25, prev - 0.25));
  };

  const resetZoom = () => {
    setDisplayScale(1);
  };

  const handleExportJson = () => {
    if (!activeFile || !imageWidth || !imageHeight) {
      toast.error("Open an image before exporting annotation data.");
      return;
    }

    const payload: ManualAnnotationPayload = {
      id: `manual_${Date.now()}`,
      createdAt: new Date().toISOString(),
      sourceFileName: activeFile.name,
      image: {
        width: imageWidth,
        height: imageHeight,
      },
      patternLabel: selectedPattern || "unlabeled",
      points,
      identificationGuidance,
      analystNotes,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeFile.name.replace(/\.[^.]+$/, "")}_manual_annotation.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveToServer = async () => {
    if (!activeFile || !imageWidth || !imageHeight) {
      toast.error("Open and annotate an image before saving.");
      return;
    }

    if (!selectedPattern) {
      toast.error("Select a fingerprint pattern label before saving.");
      return;
    }

    if (points.length === 0) {
      toast.error("Add at least one manual point before saving.");
      return;
    }

    try {
      const payload: ManualAnnotationPayload = {
        id: `manual_${Date.now()}`,
        createdAt: new Date().toISOString(),
        sourceFileName: activeFile.name,
        image: {
          width: imageWidth,
          height: imageHeight,
        },
        patternLabel: selectedPattern,
        points,
        identificationGuidance,
        analystNotes,
      };

      const response = await fetch("/api/fingerprint/manual-annotations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save manual annotations.");
      }

      toast.success("Manual fingerprint annotation saved.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save annotation";
      toast.error(message);
    }
  };

  return (
    <Card className="bg-forensic-surface/50 border-forensic-border">
      <CardHeader>
        <CardTitle className="text-forensic-text flex items-center gap-2">
          <Eye className="w-5 h-5 text-forensic-accent" />
          Manual Fingerprint Labeling Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-forensic-text-secondary">
          Click directly on the image to place manually verified points. This panel is designed for investigator-supervised training data creation.
        </div>

        <div className="rounded-lg border border-forensic-border bg-forensic-surface/40 p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Dataset Files: {datasetFiles.length}</Badge>
            <Badge variant="outline">
              Source: {sourceMode === "dataset" ? "Fingerprint Dataset" : "Uploaded File"}
            </Badge>
            {datasetFiles.length > 0 && (
              <Badge variant="outline">
                {datasetIndex + 1} / {datasetFiles.length}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-forensic-border"
              onClick={loadPrevDatasetImage}
              disabled={datasetFiles.length === 0 || isDatasetLoading}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <Button
              variant="outline"
              className="border-forensic-border"
              onClick={loadNextDatasetImage}
              disabled={datasetFiles.length === 0 || isDatasetLoading}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              className="border-forensic-border"
              onClick={() => {
                if (datasetFiles[datasetIndex]) {
                  loadDatasetFile(datasetFiles[datasetIndex], datasetIndex);
                }
              }}
              disabled={datasetFiles.length === 0 || isDatasetLoading}
            >
              {isDatasetLoading ? "Loading..." : "Reload Image"}
            </Button>
            {file && (
              <Button
                variant="outline"
                className="border-forensic-border"
                onClick={() => setSourceMode("upload")}
              >
                Use Uploaded File
              </Button>
            )}
          </div>

          {datasetFiles[datasetIndex] && (
            <div className="text-xs text-forensic-text-secondary break-all">
              Current dataset image: {datasetFiles[datasetIndex]}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-forensic-border bg-forensic-surface/40 p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant={interactionMode === "add" ? "default" : "outline"}
              className={interactionMode === "add" ? "bg-forensic-primary text-white" : "border-forensic-border"}
              onClick={() => setInteractionMode("add")}
            >
              Add Points
            </Button>
            <Button
              variant={interactionMode === "delete" ? "destructive" : "outline"}
              className={interactionMode === "delete" ? "" : "border-forensic-border"}
              onClick={() => setInteractionMode("delete")}
            >
              Delete by Click
            </Button>
            <Button
              variant="outline"
              className="border-forensic-border"
              onClick={undoLastPoint}
              disabled={points.length === 0}
            >
              Undo Last Point
            </Button>
            <Button
              variant="outline"
              className="border-forensic-border"
              onClick={zoomOut}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="border-forensic-border"
              onClick={zoomIn}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="border-forensic-border"
              onClick={resetZoom}
            >
              100%
            </Button>
            <Badge variant="outline">Zoom: {Math.round(displayScale * 100)}%</Badge>
          </div>
        </div>

        <div className="rounded-lg border border-forensic-border bg-black/20 p-3 overflow-auto max-h-[75vh]">
          {activeFile ? (
            <div
              className="relative mx-auto"
              style={{
                width: imageWidth > 0 ? `${Math.round(imageWidth * displayScale)}px` : "auto",
                height: imageHeight > 0 ? `${Math.round(imageHeight * displayScale)}px` : "auto",
              }}
            >
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="mx-auto cursor-crosshair rounded border border-forensic-border"
                style={{
                  width: imageWidth > 0 ? `${Math.round(imageWidth * displayScale)}px` : "auto",
                  height: imageHeight > 0 ? `${Math.round(imageHeight * displayScale)}px` : "auto",
                }}
              />
              {points.map((point) => (
                <span
                  key={point.id}
                  className="absolute shadow"
                  style={{
                    left: `${Math.max(0, point.x * displayScale - 6)}px`,
                    top: `${Math.max(0, point.y * displayScale - 6)}px`,
                  }}
                  title={`${MINUTIAE_LABELS[point.type]} (${point.x}, ${point.y})`}
                >
                  {renderMarkerShape(point)}
                </span>
              ))}
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-sm text-forensic-text-secondary">
              Load a fingerprint image from dataset navigation or upload (JPG/PNG/TIF).
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Points: {points.length}</Badge>
          <Badge variant="outline">Ridge Endings: {pointStats.ridge_ending}</Badge>
          <Badge variant="outline">Bifurcations: {pointStats.bifurcation}</Badge>
          <Badge variant="outline">Core: {pointStats.core}</Badge>
          <Badge variant="outline">Delta: {pointStats.delta}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-forensic-text-secondary">Point Type</Label>
            <Select
              value={selectedPointType}
              onValueChange={(value: MinutiaeType) => setSelectedPointType(value)}
            >
              <SelectTrigger className="bg-forensic-surface/60 border-forensic-border text-forensic-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTIAE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.aliases
                      ? `${option.label} (${option.aliases})`
                      : option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-forensic-text-secondary">
              Selected marker style:
              <span
                className="inline-flex ml-2 align-middle"
                title={MINUTIAE_LABELS[selectedPointType]}
              >
                {renderMarkerShape({
                  id: "preview",
                  x: 0,
                  y: 0,
                  type: selectedPointType,
                })}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-forensic-text-secondary">Pattern Label</Label>
            <Select value={selectedPattern} onValueChange={setSelectedPattern}>
              <SelectTrigger className="bg-forensic-surface/60 border-forensic-border text-forensic-text">
                <SelectValue placeholder="Select pattern" />
              </SelectTrigger>
              <SelectContent>
                {PATTERN_OPTIONS.map((pattern) => (
                  <SelectItem key={pattern} value={pattern}>
                    {formatPatternLabel(pattern)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-forensic-text-secondary">
            Tell AI how to identify this fingerprint
          </Label>
          <Textarea
            value={identificationGuidance}
            onChange={(event) => setIdentificationGuidance(event.target.value)}
            rows={3}
            className="bg-forensic-surface/60 border-forensic-border text-forensic-text"
            placeholder="Describe what each marked point represents and which ridge flow cues define this pattern."
          />
        </div>

        <div className="space-y-2">
          <Label className="text-forensic-text-secondary">Analyst Notes</Label>
          <Textarea
            value={analystNotes}
            onChange={(event) => setAnalystNotes(event.target.value)}
            rows={2}
            className="bg-forensic-surface/60 border-forensic-border text-forensic-text"
            placeholder="Optional case notes, quality observations, or cautions."
          />
        </div>

        <div className="space-y-2">
          <Label className="text-forensic-text-secondary">Marked Points</Label>
          <div className="max-h-40 overflow-y-auto rounded border border-forensic-border bg-forensic-surface/40 divide-y divide-forensic-border/40">
            {points.length === 0 ? (
              <div className="p-3 text-sm text-forensic-text-secondary">
                No points added yet.
              </div>
            ) : (
              points.map((point) => (
                <div
                  key={point.id}
                  className="flex items-center justify-between gap-2 p-2 text-sm"
                >
                  <div className="flex items-center gap-2 text-forensic-text">
                    <span className="inline-flex">{renderMarkerShape(point)}</span>
                    <span>{MINUTIAE_LABELS[point.type]}</span>
                    <span className="text-forensic-text-secondary">
                      ({point.x}, {point.y})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePoint(point.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={clearPoints}
            variant="outline"
            className="border-forensic-border"
            disabled={points.length === 0}
          >
            Clear Points
          </Button>
          <Button
            onClick={handleExportJson}
            variant="outline"
            className="border-forensic-border"
            disabled={!canAnnotate}
          >
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button
            onClick={saveToServer}
            className="bg-forensic-primary hover:bg-forensic-primary/90 text-white"
            disabled={!canAnnotate}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Annotation Set
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
