import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Eye,
  Target,
} from "lucide-react";

interface MinutiaePoint {
  x: number;
  y: number;
  type: string;
  angle: number;
  id: number;
}

interface MinutiaeVisualizationProps {
  fingerprintImage: string;
  minutiaePoints: MinutiaePoint[];
  patternType: string;
  corePosition?: { x: number; y: number };
  deltaPositions?: { x: number; y: number }[];
  analysisResult?: any;
}

export function MinutiaeVisualization({
  fingerprintImage,
  minutiaePoints,
  patternType,
  corePosition,
  deltaPositions = [],
  analysisResult,
}: MinutiaeVisualizationProps) {
  const [zoom, setZoom] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [activeView, setActiveView] = useState("all");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Natural image dimensions — resolved once when the image loads.
  // All coordinate math uses these so points land on the correct pixels
  // regardless of how the canvas is sized or scaled.
  const naturalDimsRef = useRef<{ w: number; h: number } | null>(null);

  const minutiaeColors: Record<string, string> = {
    ridge_ending: "#00ffff",
    bifurcation: "#ff0080",
    dot: "#ffff00",
    island: "#00ff00",
    bridge: "#ff8000",
    spur: "#8000ff",
    crossover: "#ff4000",
    trifurcation: "#0080ff",
  };

  useEffect(() => {
    drawFingerprint();
  }, [zoom, showLabels, selectedPoint, activeView, minutiaePoints]);

  /**
   * Detect whether the AI returned coordinates in pixel space or 0-1
   * normalised space. We assume normalised when every value is ≤ 1.
   */
  const isNormalized = (points: MinutiaePoint[]): boolean => {
    if (points.length === 0) return false;
    return points.every((p) => p.x <= 1 && p.y <= 1);
  };

  const drawFingerprint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Store natural dims once
      naturalDimsRef.current = { w: img.naturalWidth, h: img.naturalHeight };

      // Size the canvas to fill its container, preserving aspect ratio
      const containerWidth = containerRef.current?.clientWidth || 600;
      const aspectRatio = img.naturalHeight / img.naturalWidth;
      canvas.width = containerWidth;
      canvas.height = containerWidth * aspectRatio;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.scale(zoom, zoom);

      const cw = canvas.width / zoom;
      const ch = canvas.height / zoom;
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;

      /**
       * Map a single point's (px, py) from AI-space → canvas-space.
       *
       * Three cases handled:
       *   1. Normalised (0–1): multiply by canvas dimensions directly.
       *   2. Pixel coords matching natural image size: scale by canvas/natural.
       *   3. Fallback — treat as normalised.
       */
      const toCanvas = (px: number, py: number): [number, number] => {
        const normalized = isNormalized(minutiaePoints);
        if (normalized) {
          return [px * cw, py * ch];
        }
        // Pixel space — scale from natural image size to display canvas size
        return [(px / natW) * cw, (py / natH) * ch];
      };

      // ── Core ────────────────────────────────────────────────────────────
      if (corePosition) {
        const [cx, cy] = toCanvas(corePosition.x, corePosition.y);
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.stroke();
        if (showLabels) {
          ctx.fillStyle = "#00ff00";
          ctx.font = "bold 12px Arial";
          ctx.fillText("CORE", cx + 20, cy - 5);
        }
      }

      // ── Deltas ──────────────────────────────────────────────────────────
      deltaPositions.forEach((delta, index) => {
        const [dx, dy] = toCanvas(delta.x, delta.y);
        ctx.strokeStyle = "#ff4000";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(dx - 10, dy - 10);
        ctx.lineTo(dx + 10, dy + 10);
        ctx.moveTo(dx - 10, dy + 10);
        ctx.lineTo(dx + 10, dy - 10);
        ctx.stroke();
        if (showLabels) {
          ctx.fillStyle = "#ff4000";
          ctx.font = "bold 12px Arial";
          ctx.fillText(`DELTA ${index + 1}`, dx + 15, dy - 5);
        }
      });

      // ── Minutiae points ─────────────────────────────────────────────────
      minutiaePoints.forEach((point) => {
        if (activeView !== "all" && point.type !== activeView) return;

        const [px, py] = toCanvas(point.x, point.y);
        const color = minutiaeColors[point.type] || "#ffffff";

        // Highlight ring for selected point
        if (selectedPoint === point.id) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(px, py, 12, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Point circle
        ctx.fillStyle = color;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Direction line + arrowhead for ridge endings / bifurcations
        if (point.type === "ridge_ending" || point.type === "bifurcation") {
          const len = 15;
          const ex = px + Math.cos(point.angle) * len;
          const ey = py + Math.sin(point.angle) * len;
          const as = 5;

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(
            ex - as * Math.cos(point.angle - Math.PI / 6),
            ey - as * Math.sin(point.angle - Math.PI / 6),
          );
          ctx.moveTo(ex, ey);
          ctx.lineTo(
            ex - as * Math.cos(point.angle + Math.PI / 6),
            ey - as * Math.sin(point.angle + Math.PI / 6),
          );
          ctx.stroke();
        }

        // Label
        if (showLabels) {
          ctx.font = "bold 10px Arial";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 1;
          ctx.strokeText(`${point.id}`, px + 10, py - 10);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(`${point.id}`, px + 10, py - 10);
        }
      });

      ctx.restore();
    };
    img.src = fingerprintImage;
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Convert click back to AI coordinate space for hit-testing
    const natW = naturalDimsRef.current?.w ?? canvas.width;
    const natH = naturalDimsRef.current?.h ?? canvas.height;
    const normalized = isNormalized(minutiaePoints);

    const toAI = (cx: number, cy: number): [number, number] => {
      if (normalized) return [cx / canvas.width, cy / canvas.height];
      return [(cx / canvas.width) * natW, (cy / canvas.height) * natH];
    };

    const [ax, ay] = toAI(clickX, clickY);
    const threshold = normalized ? 0.03 : (natW / canvas.width) * 20;

    let closestId: number | null = null;
    let minDist = Infinity;

    minutiaePoints.forEach((p) => {
      const d = Math.hypot(p.x - ax, p.y - ay);
      if (d < minDist && d < threshold) {
        minDist = d;
        closestId = p.id;
      }
    });

    setSelectedPoint(closestId);
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `minutiae-analysis-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const ridgeEndings = minutiaePoints.filter((p) => p.type === "ridge_ending");
  const bifurcations = minutiaePoints.filter((p) => p.type === "bifurcation");
  const otherPoints = minutiaePoints.filter(
    (p) => p.type !== "ridge_ending" && p.type !== "bifurcation",
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-800 rounded-lg">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            className="border-gray-600"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-300 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
            className="border-gray-600"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom(1)}
          className="border-gray-600"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Reset
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowLabels(!showLabels)}
          className={`border-gray-600 ${showLabels ? "bg-cyan-600/20 text-cyan-300" : ""}`}
        >
          <Eye className="w-4 h-4 mr-1" />
          Labels
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={exportImage}
          className="border-gray-600"
        >
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>

        <div className="flex items-center gap-2 ml-auto">
          <Badge className="bg-cyan-600/20 text-cyan-300">
            {minutiaePoints.length} Total Points
          </Badge>
          <Badge className="bg-green-600/20 text-green-300">{patternType}</Badge>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList className="grid w-full grid-cols-4 bg-gray-800">
          <TabsTrigger value="all">All ({minutiaePoints.length})</TabsTrigger>
          <TabsTrigger value="ridge_ending">
            Endings ({ridgeEndings.length})
          </TabsTrigger>
          <TabsTrigger value="bifurcation">
            Bifurcations ({bifurcations.length})
          </TabsTrigger>
          <TabsTrigger value="other">Other ({otherPoints.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Main Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Canvas */}
        <div className="lg:col-span-2">
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-400" />
                Minutiae Analysis Visualization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={containerRef} className="relative">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="border border-gray-600 rounded cursor-crosshair w-full"
                  style={{ maxHeight: "600px" }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details Panel */}
        <div className="space-y-4">
          {selectedPoint !== null && (
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-sm">
                  Point #{selectedPoint} Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const point = minutiaePoints.find(
                    (p) => p.id === selectedPoint,
                  );
                  if (!point) return null;
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Type:</span>
                        <span className="text-white capitalize">
                          {point.type.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Position:</span>
                        <span className="text-white">
                          ({point.x}, {point.y})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Angle:</span>
                        <span className="text-white">
                          {Math.round((point.angle * 180) / Math.PI)}°
                        </span>
                      </div>
                      <div className="mt-3">
                        <div
                          className="w-4 h-4 rounded-full border-2 border-gray-600"
                          style={{
                            backgroundColor: minutiaeColors[point.type],
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-400" />
                  <span className="text-gray-300">Ridge Ending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-pink-400" />
                  <span className="text-gray-300">Bifurcation</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-green-400" />
                  <span className="text-gray-300">Core Point</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3">
                    <svg viewBox="0 0 12 12" className="w-full h-full">
                      <path
                        d="M2 2 L10 10 M2 10 L10 2"
                        stroke="#ff4000"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <span className="text-gray-300">Delta Point</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-sm">Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Ridge Endings:</span>
                  <span className="text-cyan-400">{ridgeEndings.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Bifurcations:</span>
                  <span className="text-pink-400">{bifurcations.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Other Points:</span>
                  <span className="text-yellow-400">{otherPoints.length}</span>
                </div>
                <div className="flex justify-between border-t border-gray-700 pt-2">
                  <span className="text-gray-400">Total:</span>
                  <span className="text-white font-semibold">
                    {minutiaePoints.length}
                  </span>
                </div>
                {corePosition && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Core:</span>
                    <span className="text-green-400">Detected</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Deltas:</span>
                  <span className="text-orange-400">
                    {deltaPositions.length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
