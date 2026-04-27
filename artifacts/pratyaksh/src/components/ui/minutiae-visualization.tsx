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
  Search,
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

  // Color scheme for different minutiae types
  const minutiaeColors = {
    ridge_ending: "#00ffff", // Cyan
    bifurcation: "#ff0080", // Hot pink
    dot: "#ffff00", // Yellow
    island: "#00ff00", // Green
    bridge: "#ff8000", // Orange
    spur: "#8000ff", // Purple
    crossover: "#ff4000", // Red-orange
    trifurcation: "#0080ff", // Blue
  };

  useEffect(() => {
    drawFingerprint();
  }, [zoom, showLabels, selectedPoint, activeView, minutiaePoints]);

  const drawFingerprint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Set canvas size
      const containerWidth = containerRef.current?.clientWidth || 600;
      const aspectRatio = img.height / img.width;
      canvas.width = containerWidth;
      canvas.height = containerWidth * aspectRatio;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw fingerprint image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Apply zoom and translation
      ctx.save();
      ctx.scale(zoom, zoom);

      // Draw core position
      if (corePosition) {
        const coreX = ((corePosition.x / 512) * canvas.width) / zoom;
        const coreY = ((corePosition.y / 512) * canvas.height) / zoom;

        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(coreX, coreY, 15, 0, Math.PI * 2);
        ctx.stroke();

        // Core label
        if (showLabels) {
          ctx.fillStyle = "#00ff00";
          ctx.font = "bold 12px Arial";
          ctx.fillText("CORE", coreX + 20, coreY - 5);
        }
      }

      // Draw delta positions
      deltaPositions.forEach((delta, index) => {
        const deltaX = ((delta.x / 512) * canvas.width) / zoom;
        const deltaY = ((delta.y / 512) * canvas.height) / zoom;

        ctx.strokeStyle = "#ff4000";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(deltaX - 10, deltaY - 10);
        ctx.lineTo(deltaX + 10, deltaY + 10);
        ctx.moveTo(deltaX - 10, deltaY + 10);
        ctx.lineTo(deltaX + 10, deltaY - 10);
        ctx.stroke();

        if (showLabels) {
          ctx.fillStyle = "#ff4000";
          ctx.font = "bold 12px Arial";
          ctx.fillText(`DELTA ${index + 1}`, deltaX + 15, deltaY - 5);
        }
      });

      // Draw minutiae points
      minutiaePoints.forEach((point, index) => {
        if (activeView !== "all" && point.type !== activeView) return;

        const x = ((point.x / 512) * canvas.width) / zoom;
        const y = ((point.y / 512) * canvas.height) / zoom;
        const color =
          minutiaeColors[point.type as keyof typeof minutiaeColors] ||
          "#ffffff";

        // Highlight selected point
        if (selectedPoint === point.id) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(x, y, 12, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw minutiae point
        ctx.fillStyle = color;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw direction line for ridge endings and bifurcations
        if (point.type === "ridge_ending" || point.type === "bifurcation") {
          const length = 15;
          const endX = x + Math.cos(point.angle) * length;
          const endY = y + Math.sin(point.angle) * length;

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Arrow head
          const arrowSize = 5;
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - arrowSize * Math.cos(point.angle - Math.PI / 6),
            endY - arrowSize * Math.sin(point.angle - Math.PI / 6),
          );
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - arrowSize * Math.cos(point.angle + Math.PI / 6),
            endY - arrowSize * Math.sin(point.angle + Math.PI / 6),
          );
          ctx.stroke();
        }

        // Draw labels
        if (showLabels) {
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 1;
          ctx.font = "bold 10px Arial";

          const label = `${point.id}`;
          ctx.strokeText(label, x + 10, y - 10);
          ctx.fillText(label, x + 10, y - 10);
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
    const x = ((event.clientX - rect.left) / canvas.width) * 512;
    const y = ((event.clientY - rect.top) / canvas.height) * 512;

    // Find closest minutiae point
    let closestPoint = null;
    let minDistance = Infinity;

    minutiaePoints.forEach((point) => {
      const distance = Math.sqrt(
        Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2),
      );
      if (distance < minDistance && distance < 30) {
        minDistance = distance;
        closestPoint = point.id;
      }
    });

    setSelectedPoint(closestPoint);
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
          <Badge className="bg-green-600/20 text-green-300">
            {patternType}
          </Badge>
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
          {/* Selected Point Details */}
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
                            backgroundColor:
                              minutiaeColors[
                                point.type as keyof typeof minutiaeColors
                              ],
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
                  <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                  <span className="text-gray-300">Ridge Ending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-pink-400"></div>
                  <span className="text-gray-300">Bifurcation</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-green-400"></div>
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
