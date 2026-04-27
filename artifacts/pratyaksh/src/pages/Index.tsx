import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { PratyakshLogo } from "@/components/ui/pratyaksh-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { buildResponse, typingDelayFor, type LabContext } from "@/lib/forensic-assistant";
import { useAuth } from "@/lib/auth-service";
import {
  evidenceApi,
  determineCaseTypeFromFile,
  formatAnalysisForChat,
  type ChatAnalysisResult,
} from "@/lib/evidenceApi";
import { aiForensicService } from "@/lib/ai-service";
import { EnhancedSignInDialog } from "@/components/ui/enhanced-sign-in-dialog";
import { AboutDialog } from "@/components/ui/about-dialog";
import {
  Send,
  Fingerprint,
  Shield,
  FileText,
  Microscope,
  Search,
  Brain,
  BarChart3,
  Upload,
  CheckCircle,
  AlertTriangle,
  Clock,
  Target,
  PenTool,
  Menu,
  ExternalLink,
  ArrowLeft,
  ChevronDown,
  MessageCircle,
  Settings,
  User,
  UserCircle,
  LogOut,
  CreditCard,
  Info,
} from "lucide-react";

interface Message {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  department?: string;
  confidence?: number;
  analysisSteps?: string[];
  recommendations?: string[];
  evidenceFound?: string[];
  nextActions?: string[];
  isTyping?: boolean;
  caseId?: string;
  analysisResult?: ChatAnalysisResult;
  hasEvidence?: boolean;
  aiEnhanced?: boolean;
  model?: string;
  processingTime?: number;
  expertWitnessMode?: boolean;
}

export default function Index() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, signOut } = useAuth();

  const labTools = [
    {
      title: "Fingerprint Lab",
      description: "AFIS Analysis",
      icon: <Fingerprint className="w-5 h-5" />,
      department: "fingerprint",
      route: "/fingerprint",
      color: "text-cyan-400",
    },
    {
      title: "Cyber Lab",
      description: "Digital Forensics",
      icon: <Shield className="w-5 h-5" />,
      department: "cyber",
      route: "/cyber",
      color: "text-purple-400",
    },
    {
      title: "Document Lab",
      description: "Handwriting Analysis",
      icon: <FileText className="w-5 h-5" />,
      department: "documents",
      route: "/documents",
      color: "text-green-400",
    },
  ];

  const userMenuItems = [
    {
      title: "User Dashboard",
      description: "Profile & Account",
      icon: <UserCircle className="w-5 h-5" />,
      route: "/dashboard",
      color: "text-blue-400",
    },
  ];

  const quickStartPrompts = [
    "Analyze fingerprint patterns and minutiae",
    "Investigate digital evidence for malware",
    "Examine document authenticity",
    "Process evidence from crime scene",
  ];

  const handleSendMessage = async (initialMessage?: string, dept?: string) => {
    const messageText = initialMessage || inputValue;
    if (!messageText.trim() && !uploadedFile) return;

    // Only set showChat if we're not already in chat mode
    if (!showChat) {
      setShowChat(true);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content:
        messageText ||
        (uploadedFile ? `Uploaded file: ${uploadedFile.name}` : ""),
      timestamp: new Date(),
      department: dept,
      hasEvidence: !!uploadedFile,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    // Realistic progress simulation
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
      let assistantMessage: Message;

      if (uploadedFile) {
        // Real evidence analysis with AI enhancement
        const caseType =
          (dept as "fingerprint" | "cyber" | "document") ||
          determineCaseTypeFromFile(uploadedFile);

        // Show typing indicator
        const typingMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: "",
          timestamp: new Date(),
          department: dept,
          isTyping: true,
        };

        setTimeout(() => {
          setMessages((prev) => [...prev, typingMessage]);
        }, 1000);

        // Perform real on-device forensic analysis
        const analysisResult = await aiForensicService.analyzeWithAI({
          type: caseType,
          file: uploadedFile,
          context: messageText || "Chat-based forensic analysis",
        });

        clearInterval(progressInterval);
        setAnalysisProgress(100);

        // Build assistant commentary using the local on-device engine
        const labCtx: LabContext =
          caseType === "fingerprint"
            ? "fingerprint"
            : caseType === "cyber"
              ? "cyber"
              : "document";
        const followUpQuery =
          messageText && messageText.trim().length > 0
            ? messageText
            : "Summarise the analysis";
        const localCommentary = buildResponse(followUpQuery, {
          lab: labCtx,
          caseId: analysisResult.caseId,
          fileName: uploadedFile.name,
          confidence: analysisResult.analysis.confidence_score,
          evidenceFound: analysisResult.analysis.evidence_found,
          recommendations: analysisResult.analysis.recommendations,
        });
        const aiResponse =
          formatAnalysisForChat(analysisResult) +
          "\n\n---\n\n" +
          localCommentary.content;

        assistantMessage = {
          id: (Date.now() + 2).toString(),
          type: "assistant",
          content: aiResponse,
          timestamp: new Date(),
          department: dept,
          confidence: analysisResult.analysis.confidence_score,
          analysisSteps: analysisResult.analysis.analysis_steps,
          recommendations: analysisResult.analysis.recommendations,
          evidenceFound: analysisResult.analysis.evidence_found,
          caseId: analysisResult.caseId,
          analysisResult: analysisResult,
          aiEnhanced: true,
        };

        setUploadedFile(null); // Clear uploaded file
      } else {
        // Regular chat — fully on-device assistant.
        const typingMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: "",
          timestamp: new Date(),
          department: dept,
          isTyping: true,
        };

        setTimeout(() => {
          setMessages((prev) => [...prev, typingMessage]);
        }, 600);

        const labCtx: LabContext =
          dept === "fingerprint"
            ? "fingerprint"
            : dept === "cyber"
              ? "cyber"
              : dept === "documents" || dept === "document"
                ? "document"
                : "general";
        const response = buildResponse(messageText, {
          lab: labCtx,
        });
        const delay = typingDelayFor(response.content);
        await new Promise((r) => setTimeout(r, delay));

        clearInterval(progressInterval);
        setAnalysisProgress(100);

        assistantMessage = {
          id: (Date.now() + 2).toString(),
          type: "assistant",
          content: response.content,
          timestamp: new Date(),
          department: dept,
          aiEnhanced: true,
          recommendations: response.followUps,
        };
      }

      setTimeout(() => {
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.isTyping);
          return [...filtered, assistantMessage];
        });
        setIsAnalyzing(false);
        setAnalysisProgress(0);
      }, 500);
    } catch (error) {
      console.error("Analysis error:", error);
      clearInterval(progressInterval);
      setAnalysisProgress(0);

      const errorMessage: Message = {
        id: (Date.now() + 3).toString(),
        type: "assistant",
        content: `Analysis failed: ${error instanceof Error ? error.message : String(error)}. Please try uploading your evidence again or try a different file format. I'm here to help with your forensic analysis.`,
        timestamp: new Date(),
        department: dept,
      };

      setTimeout(() => {
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.isTyping);
          return [...filtered, errorMessage];
        });
        setIsAnalyzing(false);
        setUploadedFile(null);
      }, 500);
    }
  };

  const handleLabToolClick = (tool: any) => {
    window.location.href = tool.route;
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
    handleSendMessage(prompt);
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  if (showChat) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        {/* Clean Header like ChatGPT */}
        <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChat(false)}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <PratyakshLogo size="sm" />

                {/* On-device assistant status pill */}
                <div className="flex items-center gap-2 ml-2 px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-gray-600 dark:text-gray-400">
                    Assistant Ready
                  </span>
                  <span className="text-gray-500 dark:text-gray-500 text-[10px]">
                    on-device
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Lab Tools Dropdown */}
                <div className="relative group">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">Lab Tools</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
                    <div className="p-2 space-y-1">
                      {labTools.map((tool, index) => (
                        <button
                          key={index}
                          onClick={() => handleLabToolClick(tool)}
                          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <div className={tool.color}>{tool.icon}</div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {tool.title}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {tool.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Dashboard Access - Always Visible for Testing */}
                <div className="relative group">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
                  >
                    <UserCircle className="w-4 h-4" />
                    <span className="text-sm">Dashboard</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
                    <div className="p-2 space-y-1">
                      {userMenuItems.map((item, index) => (
                        <Link
                          key={index}
                          to={item.route}
                          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <div className={item.color}>{item.icon}</div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {item.title}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.description}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {/* User Menu Dropdown */}
                {isAuthenticated ? (
                  <div className="relative group">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
                    >
                      <UserCircle className="w-4 h-4" />
                      <span className="text-sm">Profile</span>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
                      <div className="p-2 space-y-1">
                        {userMenuItems.map((item, index) => (
                          <Link
                            key={index}
                            to={item.route}
                            className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                          >
                            <div className={item.color}>{item.icon}</div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {item.title}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {item.description}
                              </div>
                            </div>
                          </Link>
                        ))}
                        <button
                          onClick={() => setShowAbout(true)}
                          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <div className="text-blue-400">
                            <Info className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              About
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Developer Info
                            </div>
                          </div>
                        </button>
                        <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                        <button
                          onClick={() => signOut()}
                          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <div className="text-red-400">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              Sign Out
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {user?.name}
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowSignIn(true)}
                    variant="outline"
                    size="sm"
                  >
                    Sign In
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-3xl mx-auto h-[calc(100vh-73px)] flex flex-col">
          <div className="flex-1 overflow-hidden">
            {/* Messages */}
            <ScrollArea ref={scrollAreaRef} className="h-full px-4">
              <div className="space-y-6 py-6">
                {messages.map((message) => (
                  <div key={message.id} className="flex gap-4 max-w-4xl">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                      {message.type === "user" ? (
                        <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      ) : message.isTyping ? (
                        <div className="w-4 h-4 text-blue-600 animate-spin">
                          <Brain className="w-4 h-4" />
                        </div>
                      ) : (
                        <Brain className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {message.type === "user" ? "You" : "Pratyaksh"}
                        </span>
                        {message.confidence && (
                          <Badge variant="secondary" className="text-xs">
                            {message.confidence}% Confidence
                          </Badge>
                        )}
                      </div>

                      {message.isTyping ? (
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                          <div className="flex gap-1">
                            <div
                              className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            />
                            <div
                              className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            />
                            <div
                              className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                          <span className="text-sm">Analyzing...</span>
                        </div>
                      ) : (
                        <>
                          <div className="text-gray-800 dark:text-gray-200 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                            {message.content.split("\n").map((line, i) => (
                              <div
                                key={i}
                                className={
                                  line.startsWith("**")
                                    ? "font-semibold mt-2"
                                    : ""
                                }
                              >
                                {line.replace(/\*\*(.*?)\*\*/g, "$1")}
                              </div>
                            ))}
                          </div>

                          {/* Clean Analysis Details */}
                          {message.analysisSteps && (
                            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                Analysis Steps
                              </h4>
                              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                                {message.analysisSteps.map((step, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2"
                                  >
                                    <span className="text-blue-600 font-medium mt-0.5">
                                      {i + 1}.
                                    </span>
                                    <span>{step}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {message.evidenceFound && (
                            <div className="mt-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                              <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-3 flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Evidence Found
                              </h4>
                              <ul className="text-sm text-green-700 dark:text-green-300 space-y-2">
                                {message.evidenceFound.map((evidence, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2"
                                  >
                                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    <span>{evidence}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {message.recommendations && (
                            <div className="mt-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                              <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Recommendations
                              </h4>
                              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
                                {message.recommendations.map((rec, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2"
                                  >
                                    <span className="text-yellow-600 font-medium mt-0.5">
                                      •
                                    </span>
                                    <span>{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {message.nextActions && (
                            <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Next Actions
                              </h4>
                              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                                {message.nextActions.map((action, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2"
                                  >
                                    <span className="text-blue-600 font-medium mt-0.5">
                                      →
                                    </span>
                                    <span>{action}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {isAnalyzing && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <Brain className="w-4 h-4 text-blue-600 animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          Pratyaksh
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          Analyzing
                        </Badge>
                      </div>
                      <div className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                        Processing evidence and generating analysis...
                      </div>
                      <Progress
                        value={analysisProgress}
                        className="h-1.5 bg-gray-200 dark:bg-gray-700"
                      />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Clean Input like ChatGPT */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 p-3">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 h-8 w-8"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*,.pdf,.doc,.docx";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      setUploadedFile(file);
                      setInputValue(
                        `I've uploaded a file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB). Please analyze this evidence.`,
                      );
                    }
                  };
                  input.click();
                }}
              >
                <Upload className="w-4 h-4" />
              </Button>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask anything about forensic analysis..."
                className="flex-1 border-none bg-transparent focus-visible:ring-0 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={isAnalyzing}
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isAnalyzing}
                size="icon"
                className="h-8 w-8 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Landing Page (ChatGPT-like Clean Design)
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Clean Header like ChatGPT */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <PratyakshLogo size="md" />
            <div className="flex items-center gap-4">
              {/* Profile Dropdown - Only show when authenticated */}
              {isAuthenticated && (
                <div className="relative group">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
                    <div className="p-2 space-y-1">
                      <Link to="/dashboard">
                        <button className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left">
                          <UserCircle className="w-4 h-4 text-cyan-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Dashboard</span>
                        </button>
                      </Link>
                      <button className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left">
                        <Settings className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Settings</span>
                      </button>
                      <button className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left">
                        <CreditCard className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Subscription</span>
                      </button>
                      <button
                        onClick={() => setShowAbout(true)}
                        className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <Info className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">About</span>
                      </button>
                      <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                      <button
                        onClick={() => signOut()}
                        className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4 text-red-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Lab Tools Dropdown */}
              <div className="relative group">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  <span>Lab Tools</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
                <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
                  <div className="p-2 space-y-1">
                    {labTools.map((tool, index) => (
                      <button
                        key={index}
                        onClick={() => handleLabToolClick(tool)}
                        className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <div className={tool.color}>{tool.icon}</div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {tool.title}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {tool.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sign In Button - Only show when not authenticated */}
              {!isAuthenticated && (
                <Button
                  onClick={() => setShowSignIn(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center">
          {/* Hero Section */}
          <div className="mb-12">
            <div className="flex justify-center mb-6">
              <PratyakshLogo size="xl" className="mx-auto" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white">
              Pratyaksh
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              AI-Powered Forensic Analysis System
            </p>
            <div className="flex items-center justify-center gap-8 text-sm text-gray-500 dark:text-gray-400 mb-12">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>91% Accuracy</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Real-time Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>AI-Enhanced</span>
              </div>
            </div>
          </div>

          {/* Quick Start Prompts */}
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Start
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quickStartPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="p-4 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    {prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Input Section */}
          <div className="max-w-2xl mx-auto mb-16">
            <div className="flex gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 p-4 shadow-sm">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*,.pdf,.doc,.docx";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      setUploadedFile(file);
                      setInputValue(
                        `I've uploaded a file: ${file.name}. Please analyze this evidence.`,
                      );
                    }
                  };
                  input.click();
                }}
              >
                <Upload className="w-5 h-5" />
              </Button>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask anything about forensic analysis..."
                className="flex-1 border-none bg-transparent focus-visible:ring-0 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-lg"
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 px-6"
              >
                <Send className="w-4 h-4 mr-2" />
                Send
              </Button>
            </div>

            {/* Feature highlights */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Instant Analysis</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                <Shield className="w-4 h-4 text-blue-500" />
                <span>Secure Processing</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                <Brain className="w-4 h-4 text-purple-500" />
                <span>AI-Enhanced Results</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center border-t border-gray-200 dark:border-gray-700 pt-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Professional forensic analysis tool for law enforcement agencies
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              By using Pratyaksh, you agree to our Terms of Service and Privacy
              Policy
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Sign In Dialog */}
      <EnhancedSignInDialog
        open={showSignIn}
        onOpenChange={setShowSignIn}
        onSuccess={() => {
          setShowSignIn(false);
          // Redirect to dashboard after successful authentication
          window.location.href = '/dashboard';
        }}
      />

      {/* About Dialog */}
      <AboutDialog
        open={showAbout}
        onOpenChange={setShowAbout}
      />
    </div>
  );
}
