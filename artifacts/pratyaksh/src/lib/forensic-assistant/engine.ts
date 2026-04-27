import type {
  AssistantContextSnapshot,
  AssistantResponse,
  KnowledgeEntry,
  LabContext,
} from "./types";
import { CYBER_KNOWLEDGE } from "./knowledge-cyber";
import { DOCUMENT_KNOWLEDGE } from "./knowledge-document";
import { FINGERPRINT_KNOWLEDGE } from "./knowledge-fingerprint";

const KNOWLEDGE_BY_LAB: Record<LabContext, KnowledgeEntry[]> = {
  cyber: CYBER_KNOWLEDGE,
  document: DOCUMENT_KNOWLEDGE,
  fingerprint: FINGERPRINT_KNOWLEDGE,
  general: [...FINGERPRINT_KNOWLEDGE, ...CYBER_KNOWLEDGE, ...DOCUMENT_KNOWLEDGE],
};

const GENERIC_FOLLOWUPS: Record<LabContext, string[]> = {
  fingerprint: [
    "Explain the detected pattern type",
    "What is a delta and why does it matter?",
    "How many minutiae do we have?",
    "Walk me through the analysis steps",
  ],
  cyber: [
    "Summarise the indicators of compromise",
    "What does the file signature say?",
    "Explain the entropy reading",
    "Walk me through the chain of custody",
  ],
  document: [
    "What does the writer-match score mean?",
    "List the forgery indicators triggered",
    "Explain the handwriting features extracted",
    "What's in the Conclusions section?",
  ],
  general: [
    "What can the cyber lab analyse?",
    "Explain how the document lab compares writers",
    "Show me what minutiae are",
    "How is a chain of custody established?",
  ],
};

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "of",
  "to",
  "in",
  "on",
  "for",
  "and",
  "or",
  "with",
  "what",
  "how",
  "why",
  "where",
  "when",
  "this",
  "that",
  "do",
  "does",
  "i",
  "me",
  "my",
  "you",
  "can",
  "please",
  "tell",
  "show",
  "explain",
  "give",
  "about",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function scoreEntry(entry: KnowledgeEntry, tokens: string[], rawQuery: string): number {
  const lowerQuery = rawQuery.toLowerCase();
  let score = 0;
  for (const trigger of entry.triggers) {
    const t = trigger.toLowerCase();
    if (lowerQuery.includes(t)) {
      score += t.split(" ").length * 3;
    }
    for (const tok of tokens) {
      if (t === tok) score += 2;
      else if (t.includes(tok) || tok.includes(t)) score += 1;
    }
  }
  return score;
}

function bestMatch(
  query: string,
  lab: LabContext,
): { entry: KnowledgeEntry | null; score: number } {
  const tokens = tokenize(query);
  if (!tokens.length) return { entry: null, score: 0 };
  const pool = KNOWLEDGE_BY_LAB[lab] ?? KNOWLEDGE_BY_LAB.general;
  let best: KnowledgeEntry | null = null;
  let bestScore = 0;
  for (const entry of pool) {
    const s = scoreEntry(entry, tokens, query);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }
  if (!best && lab !== "general") {
    for (const entry of KNOWLEDGE_BY_LAB.general) {
      const s = scoreEntry(entry, tokens, query);
      if (s > bestScore) {
        bestScore = s;
        best = entry;
      }
    }
  }
  return { entry: best, score: bestScore };
}

function lab_label(lab: LabContext): string {
  switch (lab) {
    case "cyber":
      return "Cyber Forensics";
    case "document":
      return "Document Examination";
    case "fingerprint":
      return "Fingerprint Lab";
    default:
      return "Pratyaksh";
  }
}

function buildSourceList(
  entrySource: string | null,
  ctx: AssistantContextSnapshot,
  citedFindings: string[],
): string[] {
  const sources: string[] = [];
  if (entrySource) sources.push(entrySource);
  if (citedFindings.length > 0) {
    citedFindings.forEach((f, i) => {
      sources.push(`Case finding [${i + 1}]: ${f}`);
    });
  } else if (ctx.caseId) {
    sources.push(`${lab_label(ctx.lab)} session — case ${ctx.caseId}`);
  }
  return sources;
}

function caseFindingsLine(ctx: AssistantContextSnapshot): {
  line: string;
  cites: string[];
} {
  const findings = (ctx.evidenceFound ?? []).slice(0, 4);
  if (findings.length === 0) return { line: "", cites: [] };
  const numbered = findings.map((f, i) => `**[${i + 1}]** ${f}`).join("\n- ");
  return {
    line: `\n\n**Live findings on this case**\n- ${numbered}`,
    cites: findings,
  };
}

function caseHeaderLine(ctx: AssistantContextSnapshot): string {
  const parts: string[] = [];
  if (ctx.fileName) parts.push(`**File:** \`${ctx.fileName}\``);
  if (ctx.caseId) parts.push(`**Case ID:** ${ctx.caseId}`);
  if (typeof ctx.confidence === "number")
    parts.push(`**Confidence:** ${ctx.confidence}%`);
  return parts.join(" • ");
}

function caseSummaryAnswer(ctx: AssistantContextSnapshot): AssistantResponse {
  const head =
    caseHeaderLine(ctx) ||
    `_No case loaded yet — upload evidence in the ${lab_label(ctx.lab)} lab._`;

  const sections: string[] = [head, ""];
  const cites: string[] = [];

  const findings = ctx.evidenceFound ?? [];
  if (findings.length) {
    sections.push("**Key findings**");
    findings.slice(0, 6).forEach((f, i) => {
      cites.push(f);
      sections.push(`- **[${i + 1}]** ${f}`);
    });
    sections.push("");
  }
  const recs = ctx.recommendations ?? [];
  if (recs.length) {
    sections.push("**Recommended next actions**");
    recs.slice(0, 4).forEach((r) => sections.push(`- ${r}`));
  }
  if (sections.length === 2) {
    sections.push(
      "Once an analysis completes I'll be able to summarise findings, IOCs, hashes, writer-match scores and recommendations against this case — every claim will carry an inline citation back to the underlying finding.",
    );
  }
  return {
    content: sections.join("\n"),
    sources: buildSourceList(`${lab_label(ctx.lab)} session context`, ctx, cites),
    followUps: dynamicFollowUps(ctx),
    intent: "case-summary",
  };
}

function helpAnswer(ctx: AssistantContextSnapshot): AssistantResponse {
  const labName = lab_label(ctx.lab);
  const followUps = dynamicFollowUps(ctx);
  const content = [
    `I'm the **Pratyaksh Forensic Assistant** — a fully on-device knowledge engine. No external AI services are contacted, so your evidence and questions never leave the browser.`,
    "",
    `**${labName} — what I can help with**`,
    ...followUps.map((q) => `- ${q}`),
    "",
    "Ask me anything about the analysis you just ran, or pick one of the suggestions below.",
  ].join("\n");
  return {
    content,
    sources: ["Pratyaksh assistant"],
    followUps,
    intent: "help",
  };
}

function greetingAnswer(ctx: AssistantContextSnapshot): AssistantResponse {
  const labName = lab_label(ctx.lab);
  return {
    content: `Hello — I'm the on-device assistant for the **${labName}**. Ask me about the case you're working on, or about any of the analytical methods Pratyaksh uses.`,
    sources: ["Pratyaksh assistant"],
    followUps: dynamicFollowUps(ctx),
    intent: "greeting",
  };
}

function isGreeting(q: string): boolean {
  return /^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/i.test(q.trim());
}

function isHelp(q: string): boolean {
  const s = q.trim().toLowerCase();
  return (
    s === "help" ||
    s === "?" ||
    s === "/help" ||
    s.startsWith("what can you") ||
    s.startsWith("how do you") ||
    s.startsWith("who are you")
  );
}

function isCaseSummary(q: string): boolean {
  const s = q.toLowerCase();
  return (
    s.includes("summary") ||
    s.includes("summarise") ||
    s.includes("summarize") ||
    s.includes("what did you find") ||
    s.includes("findings") ||
    s.includes("results") ||
    s.includes("this case") ||
    s.includes("the case") ||
    s.includes("my evidence")
  );
}

function fallbackAnswer(query: string, ctx: AssistantContextSnapshot): AssistantResponse {
  const labName = lab_label(ctx.lab);
  const tips = dynamicFollowUps(ctx);
  const content = [
    `I don't have a confident answer for that in the ${labName} knowledge base.`,
    "",
    "I'm a deterministic on-device assistant — I won't make up content I can't trace back to the Pratyaksh analysis pipeline. Try one of these instead:",
    "",
    ...tips.map((t) => `- ${t}`),
    "",
    `_Your question: "${query.slice(0, 140)}"_`,
  ].join("\n");
  return {
    content,
    sources: ["Pratyaksh assistant"],
    followUps: tips,
    intent: "fallback",
  };
}

/**
 * Build a list of suggested follow-up prompts, mixing static lab prompts with
 * findings-aware prompts when an active case has been analysed.
 */
export function dynamicFollowUps(ctx: AssistantContextSnapshot): string[] {
  const generic = GENERIC_FOLLOWUPS[ctx.lab] ?? GENERIC_FOLLOWUPS.general;
  const findings = ctx.evidenceFound ?? [];
  if (findings.length === 0) return generic;

  const dyn: string[] = [];
  // Pull a couple of finding-aware questions
  const f0 = findings[0];
  if (f0) dyn.push(`Explain finding [1]: ${shorten(f0, 60)}`);
  if (findings.length > 1) dyn.push(`Compare findings [1] and [2]`);
  if (typeof ctx.confidence === "number")
    dyn.push(`Why is confidence ${ctx.confidence}%?`);
  // Always include a "summarise" anchor
  dyn.push("Summarise this case");

  // Mix dynamic + generic, dynamic first, dedup, cap at 4
  const combined: string[] = [];
  for (const item of [...dyn, ...generic]) {
    if (!combined.includes(item)) combined.push(item);
    if (combined.length >= 4) break;
  }
  return combined;
}

function shorten(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function buildResponse(
  query: string,
  context: AssistantContextSnapshot,
): AssistantResponse {
  const trimmed = query.trim();
  if (!trimmed) return helpAnswer(context);

  if (isGreeting(trimmed)) return greetingAnswer(context);
  if (isHelp(trimmed)) return helpAnswer(context);
  if (isCaseSummary(trimmed)) return caseSummaryAnswer(context);

  const { entry, score } = bestMatch(trimmed, context.lab);
  if (entry && score >= 2) {
    const ctxLine = caseHeaderLine(context);
    const findings = caseFindingsLine(context);
    let body = entry.answer;
    if (ctxLine) body += `\n\n---\n${ctxLine}`;
    if (findings.line) body += findings.line;
    return {
      content: body,
      sources: buildSourceList(
        entry.source ?? "Pratyaksh knowledge base",
        context,
        findings.cites,
      ),
      followUps:
        entry.followUps && entry.followUps.length
          ? entry.followUps
          : dynamicFollowUps(context),
      intent: entry.intent,
    };
  }

  return fallbackAnswer(trimmed, context);
}

export function suggestedPrompts(
  lab: LabContext,
  context?: AssistantContextSnapshot,
): string[] {
  if (context) return dynamicFollowUps(context);
  return GENERIC_FOLLOWUPS[lab] ?? GENERIC_FOLLOWUPS.general;
}

export function typingDelayFor(text: string): number {
  const base = 350;
  const perChar = 4;
  return Math.min(1600, base + Math.min(text.length, 240) * perChar);
}
