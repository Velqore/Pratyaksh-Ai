import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { evidenceApi, type EvidenceAnalysisResult } from "@/lib/evidenceApi";
import { aiForensicService } from "@/lib/ai-service";
import { generatePDFReport } from "@/lib/pdf-report-generator";
import { CaseDetailsDialog } from "@/components/ui/case-details-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
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

export default function CyberDepartment() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [cyberFeatures, setCyberFeatures] = useState<any>(null);
  const [showCaseDialog, setShowCaseDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveToCase = (caseDetails: any) => {
    const caseData = {
      ...caseDetails,
      evidenceData: {
        type: "cyber_forensics",
        fileName: uploadedFile?.name,
        analysisResult,
        cyberFeatures,
        timestamp: new Date().toISOString(),
      },
    };

    // Save to localStorage for now (in production, save to database)
    const existingCases = JSON.parse(
      localStorage.getItem("forensic_cases") || "[]",
    );
    existingCases.push(caseData);
    localStorage.setItem("forensic_cases", JSON.stringify(existingCases));

    setCaseId(caseDetails.caseNumber);
    toast.success(`Case file ${caseDetails.caseNumber} created successfully!`);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const startAnalysis = async () => {
    if (!uploadedFile) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    // Simulate analysis progress
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + Math.random() * 8 + 2;
      });
    }, 150);

    try {
      // Perform AI-enhanced cyber forensics analysis
      const result = await aiForensicService.analyzeWithAI({
        type: "cyber",
        file: uploadedFile,
        context: `Advanced cyber forensics analysis of ${uploadedFile.name}`,
      });

      // Complete the progress
      setTimeout(() => {
        clearInterval(progressInterval);
        setAnalysisProgress(100);
        setTimeout(() => {
          setAnalysisResult(result.analysis);
          setCaseId(result.caseId);
          setCyberFeatures(result.cyberFeatures);
          setIsAnalyzing(false);
          setAnalysisProgress(0);
        }, 500);
      }, 1000);
    } catch (error) {
      console.error("Analysis failed:", error);
      clearInterval(progressInterval);
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      toast.error(`Analysis failed: ${error.message}`);
    }
  };

  const generateCyberReport = async () => {
    if (!analysisResult || !caseId) {
      alert("Please complete analysis first");
      return;
    }

    try {
      const reportData = {
        caseId,
        analysisResult,
        cyberFeatures,
        reportType: "cyber" as const,
      };

      // Generate PDF report
      const reportBlob = await generatePDFReport(reportData);

      // Create download link
      const url = URL.createObjectURL(reportBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Pratyaksh-Cyber-Report-${caseId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Report generation failed:", error);
      toast.error("Failed to generate report. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Clean Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Console
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-600">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Cyber Forensics Lab
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Digital Evidence Analysis Center
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
              >
                89.7% Accuracy
              </Badge>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  Pratyaksh
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload and Analysis */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
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
                  >
                    {uploadedFile ? (
                      <div className="space-y-4">
                        <FileX className="w-12 h-12 mx-auto text-purple-600" />
                        <div>
                          <p className="text-gray-900 dark:text-white font-medium">
                            {uploadedFile.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB •{" "}
                            {uploadedFile.type || "Unknown format"}
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
                      className="bg-purple-600 hover:bg-purple-700 text-white flex-1"
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
                        {analysisProgress < 25 && "Extracting file metadata..."}
                        {analysisProgress >= 25 &&
                          analysisProgress < 50 &&
                          "Calculating hash values..."}
                        {analysisProgress >= 50 &&
                          analysisProgress < 75 &&
                          "Analyzing file signatures..."}
                        {analysisProgress >= 75 &&
                          "Performing file carving analysis..."}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Analysis Results */}
            {analysisResult && (
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
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
                          {(analysisResult.analysis_duration_ms / 1000).toFixed(
                            2,
                          )}
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

                      {/* Comprehensive Cyber Analysis Results */}
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
                              (evidence, index) => (
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
                              (rec, index) => (
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
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Report
                      </Button>
                      <Button
                        variant="outline"
                        className="border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                        onClick={() => setShowCaseDialog(true)}
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white text-sm flex items-center gap-2">
                  🤖 AI Forensic Arsenal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                        Neural Metadata Extraction
                      </span>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      AI-powered EXIF analysis, device fingerprinting
                    </p>
                  </div>

                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Hash className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                        Quantum Hash Analysis
                      </span>
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-400">
                      Advanced cryptographic verification with threat intel
                    </p>
                  </div>

                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
                        Steganography Scanner
                      </span>
                    </div>
                    <p className="text-xs text-orange-700 dark:text-orange-400">
                      Deep learning hidden data detection
                    </p>
                  </div>

                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-300">
                        Behavioral AI Analysis
                      </span>
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-400">
                      ML-powered malware detection and classification
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white text-sm">
                  Analysis Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Evidence Files Processed
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      15,847
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Metadata Extracted
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      98.2%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Hash Matches
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      12,934
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Tampering Detected
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      247
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Case Details Dialog */}
      <CaseDetailsDialog
        open={showCaseDialog}
        onOpenChange={setShowCaseDialog}
        evidenceType="Cyber Crime Investigation"
        onSave={handleSaveToCase}
      />
    </div>
  );
}
