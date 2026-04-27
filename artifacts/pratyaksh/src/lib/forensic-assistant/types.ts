export type LabContext = "fingerprint" | "cyber" | "document" | "general";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  sources?: string[];
  followUps?: string[];
  isError?: boolean;
}

export interface AssistantContextSnapshot {
  lab: LabContext;
  caseId?: string | null;
  fileName?: string | null;
  confidence?: number | null;
  evidenceFound?: string[] | null;
  recommendations?: string[] | null;
  features?: Record<string, unknown> | null;
}

export interface AssistantResponse {
  content: string;
  sources: string[];
  followUps: string[];
  intent: string;
}

export interface KnowledgeEntry {
  id: string;
  intent: string;
  triggers: string[];
  answer: string;
  followUps?: string[];
  source?: string;
}
