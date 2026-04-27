// Minimal DNS message parser — extracts query names + record types from a
// UDP/53 (or TCP/53 with length prefix stripped) payload.

import { u16be } from "../common/byte-reader";

export interface DnsQuery {
  name: string;
  type: number;
  typeName: string;
}

const TYPE_NAMES: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  12: "PTR",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  33: "SRV",
  35: "NAPTR",
  41: "OPT",
  43: "DS",
  46: "RRSIG",
  48: "DNSKEY",
  65: "HTTPS",
  255: "ANY",
};

export function parseDnsName(payload: Uint8Array, off: number): { name: string; next: number } {
  let name = "";
  let pos = off;
  let safety = 30;
  let jumped = false;
  let returnPos = -1;
  while (pos < payload.length && safety-- > 0) {
    const len = payload[pos];
    if (len === 0) {
      pos++;
      break;
    }
    if ((len & 0xc0) === 0xc0) {
      // Pointer
      if (pos + 1 >= payload.length) break;
      const ptr = ((len & 0x3f) << 8) | payload[pos + 1];
      if (!jumped) returnPos = pos + 2;
      pos = ptr;
      jumped = true;
      continue;
    }
    pos++;
    if (pos + len > payload.length) break;
    if (name) name += ".";
    for (let i = 0; i < len; i++) name += String.fromCharCode(payload[pos + i]);
    pos += len;
  }
  return { name, next: jumped ? returnPos : pos };
}

export function parseDnsMessage(payload: Uint8Array): DnsQuery[] {
  if (payload.length < 12) return [];
  const qdCount = u16be(payload, 4);
  const out: DnsQuery[] = [];
  let off = 12;
  for (let i = 0; i < qdCount && off < payload.length; i++) {
    const { name, next } = parseDnsName(payload, off);
    if (next < 0 || next + 4 > payload.length) break;
    const type = u16be(payload, next);
    out.push({ name, type, typeName: TYPE_NAMES[type] ?? `TYPE${type}` });
    off = next + 4;
  }
  return out;
}
