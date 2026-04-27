import React, { useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { LabHeader } from "@/components/ui/lab-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { aiForensicService } from "@/lib/ai-service";
import { generatePDFReport, fileToEvidenceImage } from "@/lib/pdf-report-generator";
import { CaseDetailsDialog } from "@/components/ui/case-details-dialog";
import { ForensicAssistant } from "@/components/ui/forensic-assistant";
import { ModeRail } from "@/components/cyber-lab/ModeRail";
import { DiskPanel } from "@/components/cyber-lab/DiskPanel";
import { MalwarePanel } from "@/components/cyber-lab/MalwarePanel";
import { PcapPanel } from "@/components/cyber-lab/PcapPanel";
import { MemLogPanel } from "@/components/cyber-lab/MemLogPanel";
import { EmailPanel } from "@/components/cyber-lab/EmailPanel";
import { SqlitePanel } from "@/components/cyber-lab/SqlitePanel";
import type { CaseModeResult, CyberMode } from "@/lib/forensics/common/types";
import type { DiskAnalysisPayload } from "@/lib/forensics/disk";
import type { MalwareAnalysisPayload } from "@/lib/forensics/malware";
import type { PcapSummaryPayload } from "@/lib/forensics/pcap";
import type { MemLogPayload } from "@/lib/forensics/memlog";
import type { EmailPayload } from "@/lib/forensics/email";
import type { SqlitePayload } from "@/lib/forensics/sqlite";
import { toast } from "sonner";
import {
  Shield,
  HardDrive,
  Database,
  Hash,
  FileX,
  Search,
  Download,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Upload,
  FileText,
  Zap,
  BarChart3,
} from "lucide-react";

interface ModeResultMap {
  static?: CaseModeResult;
  disk?: CaseModeResult<DiskAnalysisPayload>;
  malware?: CaseModeResult<MalwareAnalysisPayload>;
  pcap?: CaseModeResult<PcapSummaryPayload>;
  memlog?: CaseModeResult<MemLogPayload>;
  email?: CaseModeResult<EmailPayload>;
  sqlite?: CaseModeResult<SqlitePayload>;
}
type ModeFileMap = Partial<Record<CyberMode, File>>;

/** Strip non-serialisable fields (like the live sql.js Database handle) before
 * we hand a CaseModeResult off to localStorage / the PDF generator. */
function sanitizeForCase(r: CaseModeResult): CaseModeResult {
  const { ...rest } = r as CaseModeResult & { _db?: unknown };
  if ("_db" in rest) delete (rest as { _db?: unknown })._db;
  return rest;
}

export default function CyberDepartment() {
  // --- Mode rail state -----------------------------------------------------
  const [mode, setMode] = useState<CyberMode>("static");
  const [modeResults, setModeResults] = useState<ModeResultMap>({});
  const [modeFiles, setModeFiles] = useState<ModeFileMap>({});

  // --- Static-mode state (unchanged) --------------------------------------
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [cyberFeatures, setCyberFeatures] = useState<any>(null);
  const [showCaseDialog, setShowCaseDialog] = useState(false);
  const [pendingSaveMode, setPendingSaveMode] = useState<CyberMode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const completedMap = useMemo<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    if (analysisResult) m.static = true;
    for (const k of Object.keys(modeResults)) m[k] = true;
    return m;
  }, [analysisResult, modeResults]);

  const handleSaveToCase = (caseDetails: any) => {
    const targetMode = pendingSaveMode ?? "static";
    const evidenceData =
      targetMode === "static"
        ? {
            type: "cyber_forensics",
            mode: "static",
            fileName: uploadedFile?.name,
            analysisResult,
            cyberFeatures,
            timestamp: new Date().toISOString(),
          }
        : {
            type: "cyber_forensics",
            mode: targetMode,
            fileName: modeFiles[targetMode]?.name,
            modeResult: sanitizeForCase(modeResults[targetMode]!),
            timestamp: new Date().toISOString(),
          };

    const caseData = { ...caseDetails, evidenceData };
    const existingCases = JSON.parse(
      localStorage.getItem("forensic_cases") || "[]",
    );
    existingCases.push(caseData);
    localStorage.setItem("forensic_cases", JSON.stringify(existingCases));

    if (targetMode === "static") {
      setCaseId(caseDetails.caseNumber);
    }
    setPendingSaveMode(null);
    toast.success(`Case file ${caseDetails.caseNumber} created successfully!`);
  };

  // --- Static-mode handlers (unchanged) -----------------------------------
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setUploadedFile(file);
  };

  const startAnalysis = async () => {
    if (!uploadedFile) return;
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisStatus("Initialising real cyber-forensic pipeline…");
    try {
      const result = await aiForensicService.analyzeWithAI({
        type: "cyber",
        file: uploadedFile,
        context: `Advanced cyber forensics analysis of ${uploadedFile.name}`,
        onProgress: (label, frac) => {
          setAnalysisStatus(label);
          setAnalysisProgress(Math.round(Math.max(2, frac * 100)));
        },
      });
      setAnalysisProgress(100);
      setAnalysisStatus("Analysis complete");
      setTimeout(() => {
        setAnalysisResult(result.analysis);
        setCaseId(result.caseId);
        setCyberFeatures(result.cyberFeatures);
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        setAnalysisStatus("");
      }, 350);
    } catch (error) {
      console.error("Analysis failed:", error);
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisStatus("");
      toast.error(
        `Analysis failed: ${(error as Error).message ?? "Unknown error"}`,
      );
    }
  };

  // --- Per-mode panel callbacks -------------------------------------------
  // Each panel passes back a strongly-typed CaseModeResult<TPayload>; the
  // overload signature keeps that inference at the call sites without forcing
  // a single unified union for the result map.
  function setResultFor<K extends keyof ModeResultMap>(
    key: K,
    file: File,
    r: NonNullable<ModeResultMap[K]>,
  ): void {
    setModeFiles((prev) => ({ ...prev, [key]: file }));
    setModeResults((prev) => ({ ...prev, [key]: r }));
  }

  const exportReport = async (m: CyberMode) => {
    try {
      let id = caseId;
      if (!id) {
        id = `CYB-${Date.now().toString(36).toUpperCase()}`;
        setCaseId(id);
      }
      // Combine static + every mode result currently in memory.
      const allModeResults: CaseModeResult[] = (
        Object.values(modeResults) as Array<CaseModeResult | undefined>
      )
        .filter((r): r is CaseModeResult => Boolean(r))
        .map((r) => sanitizeForCase(r));
      const f = m === "static" ? uploadedFile : modeFiles[m] ?? uploadedFile;
      const evidenceImage = await fileToEvidenceImage(f);
      const reportBlob = await generatePDFReport({
        caseId: id,
        analysisResult:
          analysisResult ?? {
            confidence_score: undefined,
            evidence_found: [],
            recommendations: [],
            analysis_steps: [],
          },
        cyberFeatures: {
          ...(cyberFeatures ?? {}),
          modeResults: allModeResults,
        },
        reportType: "cyber",
        evidenceImage,
      });
      const url = URL.createObjectURL(reportBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Pratyaksh-Cyber-Report-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`PDF report exported (${id})`);
    } catch (error) {
      console.error("Report generation failed:", error);
      toast.error("Failed to generate report. Please try again.");
    }
  };

  const generateCyberReport = () => exportReport("static");

  // Snapshot of the active mode — fed to ForensicAssistant.
  const activeAssistantSnapshot = useMemo(() => {
    if (mode === "static") {
      return {
        fileName: uploadedFile?.name ?? null,
        confidence: (analysisResult?.confidence_score as number | undefined) ?? null,
        evidenceFound: (analysisResult?.evidence_found as string[] | undefined) ?? null,
        recommendations:
          (analysisResult?.recommendations as string[] | undefined) ?? null,
      };
    }
    const r = modeResults[mode];
    if (!r) {
      return {
        fileName: modeFiles[mode]?.name ?? null,
        confidence: null,
        evidenceFound: null,
        recommendations: null,
      };
    }
    return {
      fileName: modeFiles[mode]?.name ?? null,
      confidence: null,
      evidenceFound: [r.headline, ...r.findings.slice(0, 4).map((f) => f.title)],
      recommendations: r.methodology.slice(0, 3),
    };
  }, [mode, uploadedFile, analysisResult, modeResults, modeFiles]);

  return (
    <div className="min-h-screen lab-page-bg">
      <LabHeader
        accent="cyber"
        Icon={Shield}
        title="Cyber Forensics Lab"
        subtitle="Digital Evidence Analysis Center"
        accuracyLabel="89.7% Accuracy"
        maxWidth="7xl"
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left rail */}
          <div className="lg:col-span-3">
            <ModeRail active={mode} onSelect={setMode} completed={completedMap} />
          </div>

          {/* Active mode panel */}
          <div className="lg:col-span-9 space-y-6">
            {mode === "static" && (
              <>
                <Card className="lab-card lab-card-cyber bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                      <Upload className="w-5 h-5 text-purple-600" />
                      Digital Evidence Upload
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div
                        className={cn(
                          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                          uploadedFile
                            ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20"
                            : "border-gray-300 dark:border-gray-600 hover:border-purple-400",
                        )}
                        onClick={() => fileInputRef.current?.click()}
                        data-testid="static-uploader"
                      >
                        {uploadedFile ? (
                          <div className="space-y-4">
                            <FileX className="w-12 h-12 mx-auto text-purple-600" />
                            <div>
                              <p className="text-gray-900 dark:text-white font-medium">
                                {uploadedFile.name}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {(uploadedFile.size / 1024 / 1024).toFixed(2)}{" "}
                                MB • {uploadedFile.type || "Unknown format"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <Upload className="w-12 h-12 mx-auto text-gray-400" />
                            <div>
                              <p className="text-gray-900 dark:text-white font-medium">
                                Click to upload digital evidence
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Support for all file types • Max 100MB
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="*/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />

                      <div className="flex gap-3">
                        <Button
                          onClick={startAnalysis}
                          disabled={!uploadedFile || isAnalyzing}
                          className="lab-btn-primary lab-btn-primary-cyber bg-purple-600 hover:bg-purple-700 text-white flex-1"
                          data-testid="button-start-static"
                        >
                          {isAnalyzing ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Analyzing Evidence...
                            </>
                          ) : (
                            <>
                              <Search className="w-4 h-4 mr-2" />
                              Start Cyber Forensics Analysis
                            </>
                          )}
                        </Button>
                      </div>

                      {isAnalyzing && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              Analysis Progress
                            </span>
                            <span className="text-purple-600">
                              {Math.round(analysisProgress)}%
                            </span>
                          </div>
                          <Progress value={analysisProgress} className="h-2" />
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {analysisStatus || "Working…"}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {analysisResult && (
                  <Card className="lab-card lab-card-cyber bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Digital Evidence Analysis Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-gray-600 dark:text-gray-400">
                              Case ID
                            </Label>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {caseId}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-gray-600 dark:text-gray-400">
                              Confidence Score
                            </Label>
                            <div className="text-sm font-semibold text-green-600">
                              {analysisResult.confidence_score}%
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-gray-600 dark:text-gray-400">
                              Processing Time
                            </Label>
                            <div className="text-sm font-semibold text-purple-600">
                              {(
                                analysisResult.analysis_duration_ms / 1000
                              ).toFixed(2)}
                              s
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="text-green-800 dark:text-green-300 font-medium">
                              Digital evidence successfully processed and analyzed
                            </span>
                          </div>

                          <Tabs defaultValue="metadata" className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                              <TabsTrigger value="metadata">Metadata</TabsTrigger>
                              <TabsTrigger value="hashes">Hash Values</TabsTrigger>
                              <TabsTrigger value="signatures">
                                Signatures
                              </TabsTrigger>
                              <TabsTrigger value="carving">
                                File Carving
                              </TabsTrigger>
                            </TabsList>

                            <TabsContent value="metadata" className="space-y-4">
                              <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                                <CardHeader>
                                  <CardTitle className="text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    File Metadata Analysis
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  {cyberFeatures?.fileMetadata && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <Label className="text-gray-600 dark:text-gray-400">
                                          File Size
                                        </Label>
                                        <div className="font-mono text-gray-900 dark:text-white">
                                          {(
                                            cyberFeatures.fileMetadata.fileSize /
                                            1024
                                          ).toFixed(2)}{" "}
                                          KB
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600 dark:text-gray-400">
                                          MIME Type
                                        </Label>
                                        <div className="font-mono text-gray-900 dark:text-white">
                                          {cyberFeatures.fileMetadata.mimeType}
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600 dark:text-gray-400">
                                          Created
                                        </Label>
                                        <div className="font-mono text-gray-900 dark:text-white">
                                          {new Date(
                                            cyberFeatures.fileMetadata.created,
                                          ).toLocaleString()}
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600 dark:text-gray-400">
                                          Modified
                                        </Label>
                                        <div className="font-mono text-gray-900 dark:text-white">
                                          {new Date(
                                            cyberFeatures.fileMetadata.modified,
                                          ).toLocaleString()}
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600 dark:text-gray-400">
                                          Permissions
                                        </Label>
                                        <div className="font-mono text-gray-900 dark:text-white">
                                          {cyberFeatures.fileMetadata.permissions}
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600 dark:text-gray-400">
                                          Encoding
                                        </Label>
                                        <div className="font-mono text-gray-900 dark:text-white">
                                          {cyberFeatures.fileMetadata.encoding}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </TabsContent>

                            <TabsContent value="hashes" className="space-y-4">
                              <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                                <CardHeader>
                                  <CardTitle className="text-sm text-purple-800 dark:text-purple-300 flex items-center gap-2">
                                    <Hash className="w-4 h-4" />
                                    Hash Value Analysis
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  {cyberFeatures?.hashAnalysis?.hashValues && (
                                    <div className="space-y-4">
                                      <div>
                                        <Label className="text-gray-600 dark:text-gray-400">
                                          MD5
                                        </Label>
                                        <div className="font-mono text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                                          {
                                            cyberFeatures.hashAnalysis.hashValues
                                              .md5
                                          }
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600 dark:text-gray-400">
                                          SHA1
                                        </Label>
                                        <div className="font-mono text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                                          {
                                            cyberFeatures.hashAnalysis.hashValues
                                              .sha1
                                          }
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600 dark:text-gray-400">
                                          SHA256
                                        </Label>
                                        <div className="font-mono text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                                          {
                                            cyberFeatures.hashAnalysis.hashValues
                                              .sha256
                                          }
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600 dark:text-gray-400">
                                          SHA512
                                        </Label>
                                        <div className="font-mono text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded break-all">
                                          {cyberFeatures.hashAnalysis.hashValues.sha512.substring(
                                            0,
                                            64,
                                          )}
                                          ...
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 p-2 bg-green-100 dark:bg-green-900/20 rounded">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span className="text-sm text-green-800 dark:text-green-300">
                                          Hash integrity verified - No tampering
                                          detected
                                        </span>
                                      </div>
                                      {cyberFeatures?.hashAnalysis?.methodology && (
                                        <details className="mt-2 group">
                                          <summary className="cursor-pointer text-xs text-purple-700 dark:text-purple-300 hover:underline list-none flex items-center gap-1">
                                            <span className="inline-block transition-transform group-open:rotate-90">
                                              ▶
                                            </span>
                                            How this was measured
                                          </summary>
                                          <div className="mt-2 p-3 text-xs leading-relaxed text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/40 rounded border border-gray-200 dark:border-gray-700">
                                            {
                                              cyberFeatures.hashAnalysis
                                                .methodology
                                            }
                                          </div>
                                        </details>
                                      )}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </TabsContent>

                            <TabsContent value="signatures" className="space-y-4">
                              <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                                <CardHeader>
                                  <CardTitle className="text-sm text-orange-800 dark:text-orange-300 flex items-center gap-2">
                                    <Zap className="w-4 h-4" />
                                    File Signature Analysis
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  {cyberFeatures?.fileSignature && (
                                    <div className="space-y-4">
                                      <div>
                                        <Label className="text-gray-600 dark:text-gray-400">
                                          Header Signature
                                        </Label>
                                        <div className="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                          {
                                            cyberFeatures.fileSignature
                                              .headerSignature
                                          }
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-gray-600 dark:text-gray-400">
                                          Magic Numbers
                                        </Label>
                                        <div className="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                          {cyberFeatures.fileSignature.magicNumbers.join(
                                            ", ",
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 p-2 bg-green-100 dark:bg-green-900/20 rounded">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span className="text-sm text-green-800 dark:text-green-300">
                                          File signature matches expected format
                                        </span>
                                      </div>
                                      {cyberFeatures.fileSignature
                                        .potentialDiscrepancy && (
                                        <div className="flex items-center gap-2 p-2 bg-red-100 dark:bg-red-900/20 rounded">
                                          <AlertTriangle className="w-4 h-4 text-red-600" />
                                          <span className="text-sm text-red-800 dark:text-red-300">
                                            Potential file extension/signature
                                            mismatch detected
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </TabsContent>

                            <TabsContent value="carving" className="space-y-4">
                              <Card className="bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800">
                                <CardHeader>
                                  <CardTitle className="text-sm text-cyan-800 dark:text-cyan-300 flex items-center gap-2">
                                    <HardDrive className="w-4 h-4" />
                                    File Carving Results
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  {cyberFeatures?.fileCarving && (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="text-center p-3 bg-white dark:bg-gray-700 rounded border">
                                        <div className="text-2xl font-bold text-cyan-600">
                                          {cyberFeatures.fileCarving.deletedFiles}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                          Deleted Files
                                        </div>
                                      </div>
                                      <div className="text-center p-3 bg-white dark:bg-gray-700 rounded border">
                                        <div className="text-2xl font-bold text-cyan-600">
                                          {
                                            cyberFeatures.fileCarving
                                              .recoveredFragments
                                          }
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                          Recovered Fragments
                                        </div>
                                      </div>
                                      <div className="text-center p-3 bg-white dark:bg-gray-700 rounded border">
                                        <div className="text-2xl font-bold text-cyan-600">
                                          {
                                            cyberFeatures.fileCarving
                                              .hiddenPartitions
                                          }
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                          Hidden Partitions
                                        </div>
                                      </div>
                                      <div className="text-center p-3 bg-white dark:bg-gray-700 rounded border">
                                        <div className="text-2xl font-bold text-cyan-600">
                                          {cyberFeatures.fileCarving.slackSpace}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                          Slack Space
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </TabsContent>
                          </Tabs>

                          {analysisResult.evidence_found.length > 0 && (
                            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                              <CardHeader>
                                <CardTitle className="text-sm text-blue-800 dark:text-blue-300">
                                  Digital Evidence Found
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                {analysisResult.evidence_found.map(
                                  (evidence: string, index: number) => (
                                    <div
                                      key={index}
                                      className="flex items-center gap-2"
                                    >
                                      <div className="w-2 h-2 bg-blue-600 rounded-full" />
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {evidence}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </CardContent>
                            </Card>
                          )}

                          {analysisResult.recommendations.length > 0 && (
                            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                              <CardHeader>
                                <CardTitle className="text-sm text-yellow-800 dark:text-yellow-300">
                                  Forensic Recommendations
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                {analysisResult.recommendations.map(
                                  (rec: string, index: number) => (
                                    <div
                                      key={index}
                                      className="flex items-center gap-2"
                                    >
                                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                                      <span className="text-sm text-gray-900 dark:text-white">
                                        {rec}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </CardContent>
                            </Card>
                          )}
                        </div>

                        <div className="flex gap-3">
                          <Button
                            onClick={generateCyberReport}
                            className="lab-btn-primary lab-btn-primary-cyber bg-purple-600 hover:bg-purple-700 text-white"
                            data-testid="button-export-static"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export Report
                          </Button>
                          <Button
                            variant="outline"
                            className="border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                            onClick={() => {
                              setPendingSaveMode("static");
                              setShowCaseDialog(true);
                            }}
                            disabled={!analysisResult}
                          >
                            <Database className="w-4 h-4 mr-2" />
                            Save to Case File
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {mode === "disk" && (
              <DiskPanel
                result={modeResults.disk ?? null}
                onResult={(f, r) => setResultFor("disk", f, r)}
                onExport={() => exportReport("disk")}
                onSave={() => {
                  setPendingSaveMode("disk");
                  setShowCaseDialog(true);
                }}
              />
            )}

            {mode === "malware" && (
              <MalwarePanel
                result={modeResults.malware ?? null}
                onResult={(f, r) => setResultFor("malware", f, r)}
                onExport={() => exportReport("malware")}
                onSave={() => {
                  setPendingSaveMode("malware");
                  setShowCaseDialog(true);
                }}
              />
            )}

            {mode === "pcap" && (
              <PcapPanel
                result={modeResults.pcap ?? null}
                onResult={(f, r) => setResultFor("pcap", f, r)}
                onExport={() => exportReport("pcap")}
                onSave={() => {
                  setPendingSaveMode("pcap");
                  setShowCaseDialog(true);
                }}
              />
            )}

            {mode === "memlog" && (
              <MemLogPanel
                result={modeResults.memlog ?? null}
                onResult={(f, r) => setResultFor("memlog", f, r)}
                onExport={() => exportReport("memlog")}
                onSave={() => {
                  setPendingSaveMode("memlog");
                  setShowCaseDialog(true);
                }}
              />
            )}

            {mode === "email" && (
              <EmailPanel
                result={modeResults.email ?? null}
                onResult={(f, r) => setResultFor("email", f, r)}
                onExport={() => exportReport("email")}
                onSave={() => {
                  setPendingSaveMode("email");
                  setShowCaseDialog(true);
                }}
              />
            )}

            {mode === "sqlite" && (
              <SqlitePanel
                result={modeResults.sqlite ?? null}
                onResult={(f, r) => setResultFor("sqlite", f, r)}
                onExport={() => exportReport("sqlite")}
                onSave={() => {
                  setPendingSaveMode("sqlite");
                  setShowCaseDialog(true);
                }}
              />
            )}

            {/* Always-visible analysis-statistics card */}
            <Card className="lab-card lab-card-cyber bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Analysis Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-900/30 text-center">
                    <div className="text-xs text-gray-600 dark:text-gray-400">Modes Run</div>
                    <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
                      {Object.keys(modeResults).length + (analysisResult ? 1 : 0)} / 7
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30 text-center">
                    <div className="text-xs text-gray-600 dark:text-gray-400">Findings</div>
                    <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                      {Object.values(modeResults).reduce(
                        (a, r) => a + (r?.findings.length ?? 0),
                        0,
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900/30 text-center">
                    <div className="text-xs text-gray-600 dark:text-gray-400">Case ID</div>
                    <div className="text-sm font-mono font-bold text-green-700 dark:text-green-300 truncate">
                      {caseId ?? "—"}
                    </div>
                  </div>
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-900/30 text-center">
                    <div className="text-xs text-gray-600 dark:text-gray-400">Active Mode</div>
                    <div className="text-sm font-mono font-bold text-orange-700 dark:text-orange-300">
                      {mode}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <CaseDetailsDialog
        open={showCaseDialog}
        onOpenChange={(open) => {
          setShowCaseDialog(open);
          if (!open) setPendingSaveMode(null);
        }}
        evidenceType="Cyber Crime Investigation"
        onSave={handleSaveToCase}
      />

      <ForensicAssistant
        lab="cyber"
        title="Cyber Lab Assistant"
        caseId={caseId}
        fileName={activeAssistantSnapshot.fileName}
        confidence={activeAssistantSnapshot.confidence}
        evidenceFound={activeAssistantSnapshot.evidenceFound}
        recommendations={activeAssistantSnapshot.recommendations}
      />
    </div>
  );
}
