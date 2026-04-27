// Layer 2/3/4 packet decoders. Pure functions over Uint8Array slices; the
// containing pcap/pcapng parser hands each frame to `decodeEthernet` which
// chains downward through IPv4/IPv6 → TCP/UDP.

import { u16be } from "../common/byte-reader";

export interface DecodedPacket {
  timestamp: number;
  capLen: number;
  origLen: number;
  ethType?: number;
  srcMac?: string;
  dstMac?: string;
  srcIp?: string;
  dstIp?: string;
  ipProto?: number;
  protoName?: string;
  srcPort?: number;
  dstPort?: number;
  tcpFlags?: number;
  payload?: Uint8Array;
  /** Offset of the L4 payload within the original frame. */
  payloadOffset?: number;
  notes: string[];
}

const PROTO: Record<number, string> = {
  1: "ICMP",
  6: "TCP",
  17: "UDP",
  41: "IPv6-in-IPv4",
  47: "GRE",
  50: "ESP",
  58: "ICMPv6",
  89: "OSPF",
};

function macAt(b: Uint8Array, o: number): string {
  return `${b[o].toString(16).padStart(2, "0")}:${b[o + 1].toString(16).padStart(2, "0")}:${b[o + 2].toString(16).padStart(2, "0")}:${b[o + 3].toString(16).padStart(2, "0")}:${b[o + 4].toString(16).padStart(2, "0")}:${b[o + 5].toString(16).padStart(2, "0")}`;
}

function ipv4At(b: Uint8Array, o: number): string {
  return `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`;
}

function ipv6At(b: Uint8Array, o: number): string {
  const parts: string[] = [];
  for (let i = 0; i < 8; i++)
    parts.push(((b[o + i * 2] << 8) | b[o + i * 2 + 1]).toString(16));
  // Compress longest run of zeros (best-effort)
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "0") {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestStart = curStart;
        bestLen = curLen;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }
  if (bestLen > 1) {
    return (
      parts.slice(0, bestStart).join(":") +
      "::" +
      parts.slice(bestStart + bestLen).join(":")
    );
  }
  return parts.join(":");
}

export function decodeEthernet(
  frame: Uint8Array,
  meta: { timestamp: number; capLen: number; origLen: number },
): DecodedPacket {
  const pkt: DecodedPacket = {
    timestamp: meta.timestamp,
    capLen: meta.capLen,
    origLen: meta.origLen,
    notes: [],
  };
  if (frame.length < 14) {
    pkt.notes.push("Frame shorter than Ethernet header");
    return pkt;
  }
  pkt.dstMac = macAt(frame, 0);
  pkt.srcMac = macAt(frame, 6);
  let ethType = u16be(frame, 12);
  let l3Off = 14;
  if (ethType === 0x8100) {
    // 802.1Q VLAN tag — skip 4 bytes
    if (frame.length < 18) return pkt;
    ethType = u16be(frame, 16);
    l3Off = 18;
  }
  pkt.ethType = ethType;
  if (ethType === 0x0800) {
    decodeIPv4(frame, l3Off, pkt);
  } else if (ethType === 0x86dd) {
    decodeIPv6(frame, l3Off, pkt);
  } else if (ethType === 0x0806) {
    pkt.protoName = "ARP";
  } else {
    pkt.notes.push(`Unhandled EtherType 0x${ethType.toString(16)}`);
  }
  return pkt;
}

function decodeIPv4(frame: Uint8Array, off: number, pkt: DecodedPacket) {
  if (frame.length < off + 20) return;
  const verIhl = frame[off];
  const ihl = (verIhl & 0x0f) * 4;
  if (ihl < 20) return;
  pkt.srcIp = ipv4At(frame, off + 12);
  pkt.dstIp = ipv4At(frame, off + 16);
  pkt.ipProto = frame[off + 9];
  pkt.protoName = PROTO[pkt.ipProto] ?? `IP_PROTO_${pkt.ipProto}`;
  const l4Off = off + ihl;
  if (pkt.ipProto === 6) decodeTCP(frame, l4Off, pkt);
  else if (pkt.ipProto === 17) decodeUDP(frame, l4Off, pkt);
}

function decodeIPv6(frame: Uint8Array, off: number, pkt: DecodedPacket) {
  if (frame.length < off + 40) return;
  pkt.srcIp = ipv6At(frame, off + 8);
  pkt.dstIp = ipv6At(frame, off + 24);
  pkt.ipProto = frame[off + 6]; // Next Header
  pkt.protoName = PROTO[pkt.ipProto] ?? `IPv6_NH_${pkt.ipProto}`;
  const l4Off = off + 40;
  if (pkt.ipProto === 6) decodeTCP(frame, l4Off, pkt);
  else if (pkt.ipProto === 17) decodeUDP(frame, l4Off, pkt);
}

function decodeTCP(frame: Uint8Array, off: number, pkt: DecodedPacket) {
  if (frame.length < off + 20) return;
  pkt.srcPort = u16be(frame, off);
  pkt.dstPort = u16be(frame, off + 2);
  const dataOff = ((frame[off + 12] >> 4) & 0xf) * 4;
  pkt.tcpFlags = frame[off + 13];
  pkt.payloadOffset = off + dataOff;
  pkt.payload = frame.slice(off + dataOff);
}

function decodeUDP(frame: Uint8Array, off: number, pkt: DecodedPacket) {
  if (frame.length < off + 8) return;
  pkt.srcPort = u16be(frame, off);
  pkt.dstPort = u16be(frame, off + 2);
  pkt.payloadOffset = off + 8;
  pkt.payload = frame.slice(off + 8);
}

export function tcpFlagSummary(flags: number): string {
  const f: string[] = [];
  if (flags & 0x01) f.push("FIN");
  if (flags & 0x02) f.push("SYN");
  if (flags & 0x04) f.push("RST");
  if (flags & 0x08) f.push("PSH");
  if (flags & 0x10) f.push("ACK");
  if (flags & 0x20) f.push("URG");
  if (flags & 0x40) f.push("ECE");
  if (flags & 0x80) f.push("CWR");
  return f.join("|") || "—";
}
