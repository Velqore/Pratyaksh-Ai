// PCAP / PCAPNG parser + summary engine. Reads the file in 1 MiB slices,
// streams packets through the L2/3/4 decoders, and aggregates a session-
// level summary: top talkers, conversations, DNS queries, HTTP hits, TLS SNIs.

import { readChunks, u16le, u32le, u32be } from "../common/byte-reader";
import type { CaseModeResult, ModeFinding, ModeProgress } from "../common/types";
import { sortFindings } from "../common/types";
import { decodeEthernet, tcpFlagSummary, type DecodedPacket } from "./decode";
import { parseDnsMessage } from "./dns";
import { parseHttpRequest, type HttpHit } from "./http";
import { parseTlsClientHello, type TlsHandshake } from "./tls";

const PCAP_MAGIC_LE = 0xa1b2c3d4;
const PCAP_MAGIC_BE = 0xd4c3b2a1;
const PCAPNG_BLOCK_SHB = 0x0a0d0d0a;

interface PacketRecord {
  ts: number;
  capLen: number;
  origLen: number;
  data: Uint8Array;
}

interface Conversation {
  src: string;
  dst: string;
  proto: string;
  packets: number;
  bytes: number;
  firstSeen: number;
  lastSeen: number;
}

export interface PcapSummaryPayload {
  format: "pcap" | "pcapng" | "unknown";
  linkType: number;
  totalPackets: number;
  totalBytes: number;
  firstTimestamp: number;
  lastTimestamp: number;
  topTalkers: Array<{ ip: string; packets: number; bytes: number }>;
  conversations: Conversation[];
  dnsQueries: Array<{ name: string; type: string; count: number }>;
  httpHits: Array<HttpHit & { count: number }>;
  tlsHandshakes: Array<{ sni?: string; ja3: string; count: number }>;
  iocIps: string[];
  iocDomains: string[];
  truncatedAtBytes?: number;
}

const MAX_PARSE_BYTES = 256 * 1024 * 1024; // 256 MiB streaming cap

class PcapStreamingParser {
  private format: "pcap" | "pcapng" | "unknown" = "unknown";
  private bigEndian = false;
  private linkType = 1;
  private headerBuf = new Uint8Array(0);
  private headerSeen = false;
  /** Inflight bytes from previous chunk (pcap only). */
  private leftover: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  /** Current read offset within leftover. */
  private packets: PacketRecord[] = [];

  constructor(private maxPackets = 200_000) {}

  feed(chunk: Uint8Array): void {
    if (this.packets.length >= this.maxPackets) return;
    // Concatenate leftover + chunk
    let buf: Uint8Array;
    if (this.leftover.length === 0) buf = chunk;
    else {
      buf = new Uint8Array(this.leftover.length + chunk.length);
      buf.set(this.leftover, 0);
      buf.set(chunk, this.leftover.length);
    }
    let p = 0;
    if (!this.headerSeen) {
      // Need at least 4 bytes
      if (buf.length < 4) {
        this.leftover = buf;
        return;
      }
      const magicLe = u32le(buf, 0);
      const magicBe = u32be(buf, 0);
      if (magicLe === PCAP_MAGIC_LE) {
        this.format = "pcap";
        this.bigEndian = false;
        if (buf.length < 24) {
          this.leftover = buf;
          return;
        }
        this.linkType = u32le(buf, 20);
        p = 24;
        this.headerSeen = true;
      } else if (magicBe === PCAP_MAGIC_LE) {
        this.format = "pcap";
        this.bigEndian = true;
        if (buf.length < 24) {
          this.leftover = buf;
          return;
        }
        this.linkType = u32be(buf, 20);
        p = 24;
        this.headerSeen = true;
      } else if (magicLe === PCAPNG_BLOCK_SHB || magicBe === PCAPNG_BLOCK_SHB) {
        this.format = "pcapng";
        this.headerSeen = true;
        // Don't advance — let block loop process SHB
      } else {
        // Not a pcap — eat the buffer to avoid runaway
        this.headerSeen = true;
        this.format = "unknown";
        return;
      }
    }

    if (this.format === "pcap") {
      // Each record: ts_sec(4) ts_usec(4) cap_len(4) orig_len(4) data
      while (p + 16 <= buf.length) {
        const ts_sec = this.bigEndian ? u32be(buf, p) : u32le(buf, p);
        const ts_usec = this.bigEndian ? u32be(buf, p + 4) : u32le(buf, p + 4);
        const cap = this.bigEndian ? u32be(buf, p + 8) : u32le(buf, p + 8);
        const orig = this.bigEndian ? u32be(buf, p + 12) : u32le(buf, p + 12);
        if (cap > 65535 * 4) {
          // Garbage — bail
          p = buf.length;
          break;
        }
        if (p + 16 + cap > buf.length) break;
        const data = buf.slice(p + 16, p + 16 + cap);
        this.packets.push({
          ts: ts_sec + ts_usec / 1_000_000,
          capLen: cap,
          origLen: orig,
          data,
        });
        p += 16 + cap;
        if (this.packets.length >= this.maxPackets) break;
      }
    } else if (this.format === "pcapng") {
      // pcapng: each block has type(4) len(4) ... len(4)
      while (p + 12 <= buf.length) {
        const blockType = u32le(buf, p);
        const blockLen = u32le(buf, p + 4);
        if (blockLen < 12 || blockLen > 8 * 1024 * 1024) {
          p = buf.length;
          break;
        }
        if (p + blockLen > buf.length) break;
        if (blockType === 0x00000006) {
          // Enhanced Packet Block
          const tsHigh = u32le(buf, p + 12);
          const tsLow = u32le(buf, p + 16);
          const cap = u32le(buf, p + 20);
          const orig = u32le(buf, p + 24);
          const ts = (tsHigh * 2 ** 32 + tsLow) / 1_000_000;
          const data = buf.slice(p + 28, p + 28 + cap);
          this.packets.push({ ts, capLen: cap, origLen: orig, data });
        } else if (blockType === 0x00000003) {
          // Simple Packet Block
          const orig = u32le(buf, p + 8);
          const cap = blockLen - 16;
          const data = buf.slice(p + 12, p + 12 + cap);
          this.packets.push({ ts: 0, capLen: cap, origLen: orig, data });
        }
        p += blockLen;
        if (this.packets.length >= this.maxPackets) break;
      }
    }

    // Save leftover
    this.leftover = buf.slice(p);
  }

  result() {
    return {
      format: this.format,
      linkType: this.linkType,
      packets: this.packets,
    };
  }
}

// We deliberately keep the parser lenient — silence the "unused" tcpFlagSummary
// import for downstream callers by re-exporting it here.
export { tcpFlagSummary };

function safePush<T>(arr: T[], v: T, max = 200): void {
  if (arr.length < max) arr.push(v);
}

function summarize(
  packets: PacketRecord[],
  format: "pcap" | "pcapng" | "unknown",
  linkType: number,
): PcapSummaryPayload {
  const decoded: DecodedPacket[] = [];
  const talkerStats = new Map<string, { packets: number; bytes: number }>();
  const convoMap = new Map<string, Conversation>();
  const dnsCounts = new Map<string, { name: string; type: string; count: number }>();
  const httpCounts = new Map<string, HttpHit & { count: number }>();
  const tlsCounts = new Map<string, { sni?: string; ja3: string; count: number }>();
  const ips = new Set<string>();
  const domains = new Set<string>();
  let firstTs = Infinity;
  let lastTs = -Infinity;
  let totalBytes = 0;

  for (const rec of packets) {
    totalBytes += rec.origLen;
    if (rec.ts > 0) {
      if (rec.ts < firstTs) firstTs = rec.ts;
      if (rec.ts > lastTs) lastTs = rec.ts;
    }
    // Only decode if linkType is Ethernet (1) — others fall back to "unknown"
    if (linkType !== 1) continue;
    const pkt = decodeEthernet(rec.data, {
      timestamp: rec.ts,
      capLen: rec.capLen,
      origLen: rec.origLen,
    });
    decoded.push(pkt);

    if (pkt.srcIp) {
      ips.add(pkt.srcIp);
      const a = talkerStats.get(pkt.srcIp) ?? { packets: 0, bytes: 0 };
      a.packets++;
      a.bytes += rec.origLen;
      talkerStats.set(pkt.srcIp, a);
    }
    if (pkt.dstIp) {
      ips.add(pkt.dstIp);
      const b = talkerStats.get(pkt.dstIp) ?? { packets: 0, bytes: 0 };
      b.packets++;
      b.bytes += rec.origLen;
      talkerStats.set(pkt.dstIp, b);
    }
    if (pkt.srcIp && pkt.dstIp && pkt.protoName) {
      const k = `${pkt.srcIp}|${pkt.dstIp}|${pkt.protoName}|${pkt.srcPort ?? ""}|${pkt.dstPort ?? ""}`;
      const c = convoMap.get(k) ?? {
        src: `${pkt.srcIp}${pkt.srcPort ? `:${pkt.srcPort}` : ""}`,
        dst: `${pkt.dstIp}${pkt.dstPort ? `:${pkt.dstPort}` : ""}`,
        proto: pkt.protoName,
        packets: 0,
        bytes: 0,
        firstSeen: rec.ts,
        lastSeen: rec.ts,
      };
      c.packets++;
      c.bytes += rec.origLen;
      c.lastSeen = rec.ts;
      convoMap.set(k, c);
    }

    if (pkt.payload && pkt.payload.length > 0) {
      // DNS — UDP/53 either direction
      if (pkt.protoName === "UDP" && (pkt.srcPort === 53 || pkt.dstPort === 53)) {
        const queries = parseDnsMessage(pkt.payload);
        for (const q of queries) {
          domains.add(q.name);
          const k = `${q.name}|${q.typeName}`;
          const c = dnsCounts.get(k) ?? { name: q.name, type: q.typeName, count: 0 };
          c.count++;
          dnsCounts.set(k, c);
        }
      }
      // HTTP — TCP destination port 80 / 8080
      if (pkt.protoName === "TCP" && (pkt.dstPort === 80 || pkt.dstPort === 8080)) {
        const hit = parseHttpRequest(pkt.payload);
        if (hit) {
          if (hit.host) domains.add(hit.host);
          const k = `${hit.method}|${hit.host ?? ""}|${hit.path}`;
          const c = httpCounts.get(k) ?? { ...hit, count: 0 };
          c.count++;
          httpCounts.set(k, c);
        }
      }
      // TLS — TCP destination 443
      if (pkt.protoName === "TCP" && pkt.dstPort === 443) {
        const tls = parseTlsClientHello(pkt.payload);
        if (tls) {
          if (tls.serverName) domains.add(tls.serverName);
          const c =
            tlsCounts.get(tls.ja3) ??
            ({ sni: tls.serverName, ja3: tls.ja3, count: 0 } as TlsHandshake & { count: number; sni?: string });
          c.count++;
          tlsCounts.set(tls.ja3, c);
        }
      }
    }
  }

  const topTalkers = Array.from(talkerStats.entries())
    .map(([ip, s]) => ({ ip, ...s }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 25);
  const conversations = Array.from(convoMap.values())
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 50);
  const dnsQueries = Array.from(dnsCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);
  const httpHits = Array.from(httpCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);
  const tlsHandshakes = Array.from(tlsCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return {
    format,
    linkType,
    totalPackets: packets.length,
    totalBytes,
    firstTimestamp: firstTs === Infinity ? 0 : firstTs,
    lastTimestamp: lastTs === -Infinity ? 0 : lastTs,
    topTalkers,
    conversations,
    dnsQueries,
    httpHits,
    tlsHandshakes,
    iocIps: Array.from(ips).slice(0, 200),
    iocDomains: Array.from(domains).slice(0, 200),
  };
}

export async function analyzePcap(
  file: File,
  onProgress?: ModeProgress,
): Promise<CaseModeResult<PcapSummaryPayload>> {
  const t0 = performance.now();
  const parser = new PcapStreamingParser();
  const sliceEnd = Math.min(file.size, MAX_PARSE_BYTES);
  let truncated: number | undefined;
  if (file.size > MAX_PARSE_BYTES) truncated = MAX_PARSE_BYTES;
  await readChunks(
    file,
    async (chunk) => parser.feed(chunk),
    {
      end: sliceEnd,
      yieldEvery: 4,
      onProgress: (f) => onProgress?.("Parsing pcap stream", 0.05 + f * 0.7),
    },
  );
  onProgress?.("Summarising packets", 0.85);
  const { packets, format, linkType } = parser.result();
  const summary = summarize(packets, format, linkType);
  if (truncated) summary.truncatedAtBytes = truncated;

  const findings: ModeFinding[] = [];
  if (format === "unknown") {
    findings.push({
      title: "Not a recognised pcap or pcapng file",
      severity: "info",
      detail: "Magic bytes did not match libpcap or pcapng headers.",
    });
  } else {
    findings.push({
      title: `${format.toUpperCase()} parsed: ${summary.totalPackets} packets, ${(summary.totalBytes / 1024).toFixed(1)} KiB`,
      severity: "info",
    });
  }
  if (linkType !== 1 && format !== "unknown") {
    findings.push({
      title: `Link-layer type ${linkType} not Ethernet — L3 decoding skipped`,
      severity: "low",
    });
  }
  if (summary.dnsQueries.length > 0) {
    findings.push({
      title: `${summary.dnsQueries.length} unique DNS queries`,
      severity: "info",
    });
  }
  // Heuristic: many distinct destinations from a single source = possible scan / beacon
  const srcCounts = new Map<string, number>();
  for (const c of summary.conversations) {
    const src = c.src.split(":")[0];
    srcCounts.set(src, (srcCounts.get(src) ?? 0) + 1);
  }
  for (const [ip, count] of srcCounts) {
    if (count >= 25) {
      findings.push({
        title: `${ip} contacted ${count} distinct destinations — possible scan or beacon`,
        severity: "med",
      });
    }
  }
  // Cleartext HTTP usage
  if (summary.httpHits.length > 0) {
    findings.push({
      title: `${summary.httpHits.length} cleartext HTTP request(s) observed`,
      severity: "low",
      detail: "Cleartext HTTP carries credentials and payloads in the clear.",
    });
  }
  if (truncated) {
    findings.push({
      title: `Capture truncated at ${(truncated / (1024 * 1024)).toFixed(0)} MiB`,
      severity: "info",
    });
  }

  const t1 = performance.now();
  onProgress?.("Done", 1);

  return {
    mode: "pcap",
    modeLabel: "Network / pcap",
    durationMs: Math.round(t1 - t0),
    headline:
      format === "unknown"
        ? "Unrecognised capture format"
        : `${summary.totalPackets} packets · ${summary.topTalkers.length} talkers · ${summary.dnsQueries.length} DNS queries`,
    findings: sortFindings(findings),
    payload: summary,
    methodology: [
      "Stream the capture in 1 MiB slices; decode pcap or pcapng headers in-place.",
      "For each packet, decode Ethernet → IPv4/IPv6 → TCP/UDP and surface flag bits.",
      "Recognise UDP/53 as DNS, TCP/80 + TCP/8080 as cleartext HTTP, and TCP/443 as TLS to extract SNI + a JA3-style fingerprint.",
      "Aggregate top talkers, conversations, DNS queries, HTTP requests and TLS handshakes.",
      "Flag scan-like behaviour (single source contacting ≥25 distinct destinations) and any cleartext HTTP.",
    ],
  };
}
