// .eml parser wrapper — uses postal-mime for the actual MIME work and pulls
// out the headers needed for spoof analysis: Received chain, Authentication-Results,
// SPF/DKIM/DMARC, Reply-To vs From mismatch, embedded URLs.

import PostalMime from "postal-mime";

export interface ReceivedHop {
  raw: string;
  byHost?: string;
  fromHost?: string;
  fromIp?: string;
  protocol?: string;
  receivedAt?: string;
}

export interface EmlParsed {
  from?: { address?: string; name?: string };
  replyTo?: { address?: string; name?: string };
  to: Array<{ address?: string; name?: string }>;
  cc: Array<{ address?: string; name?: string }>;
  subject?: string;
  date?: string;
  messageId?: string;
  textBody?: string;
  htmlBody?: string;
  attachments: Array<{ filename: string; mimeType: string; size: number }>;
  /** Lower-cased name → raw value list */
  headers: Record<string, string[]>;
  receivedChain: ReceivedHop[];
  authenticationResults?: string;
  spf?: string;
  dkim?: string;
  dmarc?: string;
  /** URLs extracted from text + html bodies (deduplicated). */
  urls: string[];
}

const RECEIVED_RE =
  /^from\s+([^\s]+)(?:\s+\(([^)]*)\))?\s+by\s+([^\s]+).*?(?:with\s+(\S+))?(?:.*?;\s*(.+))?$/is;

function parseReceived(raw: string): ReceivedHop {
  const m = RECEIVED_RE.exec(raw.trim());
  if (!m) return { raw };
  const fromHost = m[1];
  const fromInfo = m[2];
  const byHost = m[3];
  const protocol = m[4];
  const receivedAt = m[5];
  let fromIp: string | undefined;
  if (fromInfo) {
    const ipMatch = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/.exec(fromInfo);
    if (ipMatch) fromIp = ipMatch[1];
  }
  return { raw, byHost, fromHost, fromIp, protocol, receivedAt };
}

function extractUrls(s: string | undefined): string[] {
  if (!s) return [];
  const re = /https?:\/\/[^\s"'<>)]+/gi;
  return Array.from(new Set(s.match(re) ?? []));
}

export async function parseEml(file: File): Promise<EmlParsed> {
  const text = await file.text();
  const parser = new PostalMime();
  const msg = await parser.parse(text);

  // Build header dictionary from raw text (postal-mime gives a typed view too)
  const headers: Record<string, string[]> = {};
  const headerEnd = text.indexOf("\r\n\r\n") !== -1 ? text.indexOf("\r\n\r\n") : text.indexOf("\n\n");
  const headerBlock = headerEnd > 0 ? text.slice(0, headerEnd) : text;
  // Unfold (RFC 5322): lines starting with WSP continue the previous header
  const unfolded: string[] = [];
  for (const raw of headerBlock.split(/\r?\n/)) {
    if (/^[ \t]/.test(raw) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += " " + raw.trim();
    } else if (raw) {
      unfolded.push(raw);
    }
  }
  for (const line of unfolded) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    (headers[k] ??= []).push(v);
  }

  const receivedChain = (headers["received"] ?? []).map(parseReceived);
  const authenticationResults = headers["authentication-results"]?.[0];
  const spf = headers["received-spf"]?.[0];
  const dkim = headers["dkim-signature"]?.[0];
  const dmarc = headers["dmarc-results"]?.[0];

  const urls = Array.from(
    new Set([
      ...extractUrls(msg.text),
      ...extractUrls(msg.html ?? undefined),
    ]),
  );

  const toArr = Array.isArray(msg.to) ? msg.to : msg.to ? [msg.to] : [];
  const ccArr = Array.isArray(msg.cc) ? msg.cc : msg.cc ? [msg.cc] : [];

  return {
    from: msg.from && { address: msg.from.address, name: msg.from.name },
    replyTo: msg.replyTo && Array.isArray(msg.replyTo)
      ? msg.replyTo[0] && { address: msg.replyTo[0].address, name: msg.replyTo[0].name }
      : (msg.replyTo as { address?: string; name?: string } | undefined),
    to: toArr.map((a) => ({ address: a.address, name: a.name })),
    cc: ccArr.map((a) => ({ address: a.address, name: a.name })),
    subject: msg.subject,
    date: msg.date,
    messageId: msg.messageId,
    textBody: msg.text,
    htmlBody: msg.html ?? undefined,
    attachments: (msg.attachments ?? []).map((a) => ({
      filename: a.filename ?? "(unnamed)",
      mimeType: a.mimeType ?? "application/octet-stream",
      size: a.content ? (a.content as ArrayBuffer | Uint8Array).byteLength ?? 0 : 0,
    })),
    headers,
    receivedChain,
    authenticationResults,
    spf,
    dkim,
    dmarc,
    urls,
  };
}
