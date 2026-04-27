// Cleartext HTTP request line + Host header sniffer. We only need the
// first line and the Host header for IOC enrichment; full body decoding
// is deliberately out of scope.

export interface HttpHit {
  method: string;
  path: string;
  host?: string;
  userAgent?: string;
  fullUrl: string;
}

const METHODS = new Set(["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH", "CONNECT"]);

export function parseHttpRequest(payload: Uint8Array): HttpHit | null {
  if (payload.length < 16) return null;
  // Quick reject — first byte must be ASCII upper-case letter
  if (payload[0] < 0x41 || payload[0] > 0x5a) return null;
  let text = "";
  const limit = Math.min(payload.length, 4096);
  for (let i = 0; i < limit; i++) text += String.fromCharCode(payload[i]);
  const lines = text.split(/\r\n/);
  const first = lines[0]?.split(" ");
  if (!first || first.length < 3) return null;
  const method = first[0];
  const path = first[1];
  if (!METHODS.has(method)) return null;
  if (!first[2].startsWith("HTTP/")) return null;
  let host: string | undefined;
  let ua: string | undefined;
  for (const line of lines.slice(1)) {
    if (!line) break;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim().toLowerCase();
    const v = line.slice(idx + 1).trim();
    if (k === "host") host = v;
    else if (k === "user-agent") ua = v;
  }
  const fullUrl = host ? `http://${host}${path}` : path;
  return { method, path, host, userAgent: ua, fullUrl };
}
