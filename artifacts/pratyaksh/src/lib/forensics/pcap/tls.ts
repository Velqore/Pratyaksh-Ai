// Best-effort TLS ClientHello SNI extractor + JA3-style fingerprint.
// Reads only what's required to surface the server name and a stable
// hash of (TLSVersion, CipherSuites, Extensions, EllipticCurves, EllipticCurveFormats).

import { u16be } from "../common/byte-reader";

export interface TlsHandshake {
  serverName?: string;
  /** Comma-joined cipher suite IDs as seen on the wire. */
  cipherSuites: number[];
  extensions: number[];
  ellipticCurves: number[];
  curveFormats: number[];
  /** JA3-style string "TLSVersion,Ciphers,Extensions,Curves,Formats". */
  ja3: string;
}

export function parseTlsClientHello(payload: Uint8Array): TlsHandshake | null {
  // Record header: ContentType(0x16) Version(0x0301..0x0303) Length(2)
  if (payload.length < 5 || payload[0] !== 0x16) return null;
  // Handshake header: Type(0x01 ClientHello) Length(3)
  if (payload[5] !== 0x01) return null;
  // Skip to ClientHello body: 5 (record) + 4 (handshake) = 9
  let p = 9;
  // ProtocolVersion (2)
  if (payload.length < p + 2) return null;
  const version = u16be(payload, p);
  p += 2;
  // Random (32)
  p += 32;
  // SessionID
  if (payload.length < p + 1) return null;
  const sidLen = payload[p];
  p += 1 + sidLen;
  // CipherSuites
  if (payload.length < p + 2) return null;
  const csLen = u16be(payload, p);
  p += 2;
  const ciphers: number[] = [];
  for (let i = 0; i < csLen; i += 2) {
    if (p + i + 2 > payload.length) break;
    ciphers.push(u16be(payload, p + i));
  }
  p += csLen;
  // CompressionMethods
  if (payload.length < p + 1) return null;
  const compLen = payload[p];
  p += 1 + compLen;
  // Extensions
  let serverName: string | undefined;
  const extensions: number[] = [];
  const curves: number[] = [];
  const formats: number[] = [];
  if (payload.length >= p + 2) {
    const extLen = u16be(payload, p);
    p += 2;
    const extEnd = Math.min(payload.length, p + extLen);
    while (p + 4 <= extEnd) {
      const extType = u16be(payload, p);
      const extDataLen = u16be(payload, p + 2);
      const dataStart = p + 4;
      const dataEnd = dataStart + extDataLen;
      if (dataEnd > extEnd) break;
      extensions.push(extType);
      if (extType === 0x0000 && dataEnd - dataStart >= 5) {
        // server_name extension: list_len(2) name_type(1) name_len(2) name(...)
        const nameType = payload[dataStart + 2];
        if (nameType === 0) {
          const nameLen = u16be(payload, dataStart + 3);
          let name = "";
          for (let i = 0; i < nameLen; i++) {
            const o = dataStart + 5 + i;
            if (o >= payload.length) break;
            name += String.fromCharCode(payload[o]);
          }
          serverName = name;
        }
      } else if (extType === 0x000a && extDataLen >= 2) {
        // supported_groups
        const listLen = u16be(payload, dataStart);
        for (let i = 0; i < listLen; i += 2) {
          if (dataStart + 2 + i + 2 > payload.length) break;
          curves.push(u16be(payload, dataStart + 2 + i));
        }
      } else if (extType === 0x000b && extDataLen >= 1) {
        const listLen = payload[dataStart];
        for (let i = 0; i < listLen; i++) {
          if (dataStart + 1 + i >= payload.length) break;
          formats.push(payload[dataStart + 1 + i]);
        }
      }
      p = dataEnd;
    }
  }

  const ja3 = `${version},${ciphers.join("-")},${extensions.join("-")},${curves.join("-")},${formats.join("-")}`;
  return {
    serverName,
    cipherSuites: ciphers,
    extensions,
    ellipticCurves: curves,
    curveFormats: formats,
    ja3,
  };
}
