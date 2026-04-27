import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Copy,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  buildResponse,
  suggestedPrompts,
  typingDelayFor,
  type AssistantContextSnapshot,
  type AssistantMessage,
  type LabContext,
} from "@/lib/forensic-assistant";

interface ForensicAssistantProps {
  lab: LabContext;
  caseId?: string | null;
  fileName?: string | null;
  confidence?: number | null;
  evidenceFound?: string[] | null;
  recommendations?: string[] | null;
  features?: Record<string, unknown> | null;
  /** Title shown on the launcher button + panel header */
  title?: string;
  /** Force the panel open (controlled mode); omit for floating launcher */
  defaultOpen?: boolean;
}

const LAB_ACCENT: Record<LabContext, { ring: string; chip: string; bg: string }> = {
  fingerprint: {
    ring: "ring-cyan-500/40 hover:ring-cyan-500/70",
    chip: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    bg: "from-cyan-500 to-blue-600",
  },
  cyber: {
    ring: "ring-purple-500/40 hover:ring-purple-500/70",
    chip:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    bg: "from-purple-500 to-fuchsia-600",
  },
  document: {
    ring: "ring-emerald-500/40 hover:ring-emerald-500/70",
    chip:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    bg: "from-emerald-500 to-green-600",
  },
  general: {
    ring: "ring-blue-500/40 hover:ring-blue-500/70",
    chip: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    bg: "from-blue-500 to-indigo-600",
  },
};

const STORAGE_PREFIX = "pratyaksh_assistant_history__";

function storageKey(lab: LabContext, caseId?: string | null): string {
  return `${STORAGE_PREFIX}${lab}__${caseId ?? "no-case"}`;
}

function loadHistory(key: string): AssistantMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as AssistantMessage[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveHistory(key: string, messages: AssistantMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(messages.slice(-50)));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

function makeId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ForensicAssistant(props: ForensicAssistantProps) {
  const {
    lab,
    caseId = null,
    fileName = null,
    confidence = null,
    evidenceFound = null,
    recommendations = null,
    features = null,
    title = "Forensic Assistant",
    defaultOpen = false,
  } = props;

  const accent = LAB_ACCENT[lab];
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const key = useMemo(() => storageKey(lab, caseId), [lab, caseId]);

  useEffect(() => {
    setMessages(loadHistory(key));
  }, [key]);

  useEffect(() => {
    saveHistory(key, messages);
  }, [key, messages]);

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, thinking]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  // Cancel any pending timers on unmount.
  useEffect(() => {
    return () => {
      pendingTimers.current.forEach((id) => clearTimeout(id));
      pendingTimers.current.clear();
    };
  }, []);

  // Auto-grow the textarea (up to ~6 rows worth).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const snapshot: AssistantContextSnapshot = useMemo(
    () => ({
      lab,
      caseId,
      fileName,
      confidence,
      evidenceFound,
      recommendations,
      features,
    }),
    [lab, caseId, fileName, confidence, evidenceFound, recommendations, features],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || thinking) return;
      const userMsg: AssistantMessage = {
        id: makeId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setThinking(true);

      const response = buildResponse(text, snapshot);
      const delay = typingDelayFor(response.content);
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => {
          pendingTimers.current.delete(t);
          resolve();
        }, delay);
        pendingTimers.current.add(t);
      });

      const assistantMsg: AssistantMessage = {
        id: makeId(),
        role: "assistant",
        content: response.content,
        timestamp: Date.now(),
        sources: response.sources,
        followUps: response.followUps,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setThinking(false);
    },
    [thinking, snapshot],
  );

  const retryLast = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === lastUser.id);
      if (idx < 0) return prev;
      return prev.slice(0, idx);
    });
    const t = setTimeout(() => {
      pendingTimers.current.delete(t);
      send(lastUser.content);
    }, 50);
    pendingTimers.current.add(t);
  }, [messages, send]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
    toast.success("Conversation cleared.");
  }, [key]);

  const copy = useCallback((text: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied to clipboard."))
      .catch(() => toast.error("Could not copy — clipboard unavailable."));
  }, []);

  const prompts = useMemo(() => suggestedPrompts(lab, snapshot), [lab, snapshot]);

  const panelClass = expanded
    ? "fixed inset-4 sm:inset-8 lg:inset-16 z-50 flex flex-col"
    : "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[640px] max-h-[calc(100vh-3rem)] flex flex-col";

  return (
    <>
      {/* Floating launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 20 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            onClick={() => setOpen(true)}
            className={cn(
              "fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 group flex items-center gap-3 rounded-full bg-gradient-to-br text-white px-4 py-3 shadow-2xl ring-2 transition-all",
              accent.bg,
              accent.ring,
            )}
            aria-label="Open Forensic Assistant"
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur">
              <Bot className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 inline-flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
              </span>
            </span>
            <span className="hidden sm:inline text-sm font-semibold pr-1">
              {title}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className={cn(
              panelClass,
              "rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden",
            )}
            role="dialog"
            aria-label="Pratyaksh Forensic Assistant"
          >
            {/* Header */}
            <div
              className={cn(
                "flex items-center justify-between gap-2 px-4 py-3 text-white bg-gradient-to-br",
                accent.bg,
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight truncate">
                    {title}
                  </div>
                  <div className="text-[11px] text-white/80 leading-tight truncate">
                    On-device · Assistant Ready
                    {caseId ? ` · ${caseId}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/15"
                  onClick={clearHistory}
                  aria-label="Clear conversation"
                  title="Clear conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/15"
                  onClick={() => setExpanded((v) => !v)}
                  aria-label={expanded ? "Collapse panel" : "Expand panel"}
                  title={expanded ? "Collapse" : "Expand"}
                >
                  {expanded ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/15"
                  onClick={() => setOpen(false)}
                  aria-label="Close assistant"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Context strip */}
            {(fileName || caseId || typeof confidence === "number") && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
                {caseId && (
                  <Badge variant="outline" className={cn("text-[10px]", accent.chip)}>
                    Case · {caseId}
                  </Badge>
                )}
                {fileName && (
                  <Badge
                    variant="outline"
                    className="text-[10px] max-w-[220px] truncate"
                    title={fileName}
                  >
                    {fileName}
                  </Badge>
                )}
                {typeof confidence === "number" && (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  >
                    {confidence}% confidence
                  </Badge>
                )}
              </div>
            )}

            {/* Messages */}
            <div
              ref={scrollerRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white dark:bg-gray-950"
            >
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex-shrink-0">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-gray-100 dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-100">
                      Hi — I'm the on-device Forensic Assistant. I run entirely
                      in your browser, so nothing leaves this device. Ask me
                      about the analysis you've just run, or pick a starter
                      below.
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {prompts.slice(0, 4).map((p) => (
                      <button
                        key={p}
                        onClick={() => send(p)}
                        className="text-left text-sm rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-200"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex-shrink-0">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm max-w-[85%] shadow-sm",
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-tr-sm"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm",
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-pre:my-2 prose-code:before:hidden prose-code:after:hidden">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">
                          {msg.content}
                        </div>
                      )}
                      {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-400 space-y-0.5">
                          <div className="font-semibold uppercase tracking-wide text-[9px] text-gray-400 dark:text-gray-500">
                            Sources
                          </div>
                          {msg.sources.map((s, i) => (
                            <div key={`${msg.id}-src-${i}`}>
                              <span className="font-mono text-gray-400 dark:text-gray-500">
                                [{i + 1}]
                              </span>{" "}
                              {s}
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.role === "assistant" && (
                        <div className="mt-2 flex items-center gap-1">
                          <button
                            onClick={() => copy(msg.content)}
                            className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                            title="Copy"
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <button
                            onClick={retryLast}
                            className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                            title="Regenerate"
                          >
                            <RefreshCw className="h-3 w-3" /> Retry
                          </button>
                        </div>
                      )}
                      {msg.role === "assistant" &&
                        msg.followUps &&
                        msg.followUps.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {msg.followUps.slice(0, 4).map((f) => (
                              <button
                                key={f}
                                onClick={() => send(f)}
                                className="text-[11px] px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                    {msg.role === "user" && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 flex-shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {thinking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-gray-100 dark:bg-gray-800 px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" />
                      <span
                        className="h-2 w-2 rounded-full bg-blue-500 animate-bounce"
                        style={{ animationDelay: "120ms" }}
                      />
                      <span
                        className="h-2 w-2 rounded-full bg-blue-500 animate-bounce"
                        style={{ animationDelay: "240ms" }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-gray-200 dark:border-gray-800 p-3 bg-white dark:bg-gray-900">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Ask about hashes, IOCs, handwriting features… (Shift+Enter for a new line)"
                  disabled={thinking}
                  rows={1}
                  className="flex-1 resize-none min-h-[40px] max-h-[160px] py-2 leading-snug"
                />
                <Button
                  onClick={() => send(input)}
                  disabled={!input.trim() || thinking}
                  size="icon"
                  className={cn("bg-gradient-to-br text-white shrink-0", accent.bg)}
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
                On-device · evidence and questions never leave your browser.
                <span className="hidden sm:inline">
                  {" "}
                  Press <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[9px] font-mono">Enter</kbd> to send,{" "}
                  <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[9px] font-mono">Shift+Enter</kbd> for newline.
                </span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ForensicAssistant;
