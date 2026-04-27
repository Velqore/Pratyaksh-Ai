// Extract printable ASCII / UTF-16LE strings from a binary blob.
// Mimics the behavior of the unix `strings` utility, but also records the
// byte offset of each extracted string so an examiner can locate it inside
// the original file.

export interface StringHit {
  offset: number; // byte offset in the file where the string begins
  text: string;
  encoding: "ASCII" | "UTF-16LE";
}

export interface ExtractedStrings {
  ascii: StringHit[];
  utf16: StringHit[];
  totalAscii: number;
  totalUtf16: number;
  minLength: number;
}

function extractAscii(bytes: Uint8Array, minLength: number): StringHit[] {
  const out: StringHit[] = [];
  let cur = "";
  let curStart = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 0x20 && b <= 0x7e) || b === 0x09) {
      if (cur.length === 0) curStart = i;
      cur += String.fromCharCode(b);
    } else {
      if (cur.length >= minLength)
        out.push({ offset: curStart, text: cur, encoding: "ASCII" });
      cur = "";
    }
  }
  if (cur.length >= minLength)
    out.push({ offset: curStart, text: cur, encoding: "ASCII" });
  return out;
}

function extractUtf16Le(bytes: Uint8Array, minLength: number): StringHit[] {
  const out: StringHit[] = [];
  let cur = "";
  let curStart = 0;
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const lo = bytes[i];
    const hi = bytes[i + 1];
    if (hi === 0 && ((lo >= 0x20 && lo <= 0x7e) || lo === 0x09)) {
      if (cur.length === 0) curStart = i;
      cur += String.fromCharCode(lo);
    } else {
      if (cur.length >= minLength)
        out.push({ offset: curStart, text: cur, encoding: "UTF-16LE" });
      cur = "";
    }
  }
  if (cur.length >= minLength)
    out.push({ offset: curStart, text: cur, encoding: "UTF-16LE" });
  return out;
}

export async function extractStrings(
  file: File,
  options: { minLength?: number; maxResults?: number } = {},
): Promise<ExtractedStrings> {
  const minLength = options.minLength ?? 6;
  const maxResults = options.maxResults ?? 500;
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);

  const allAscii = extractAscii(bytes, minLength);
  const allUtf16 = extractUtf16Le(bytes, minLength);

  return {
    ascii: allAscii.slice(0, maxResults),
    utf16: allUtf16.slice(0, maxResults),
    totalAscii: allAscii.length,
    totalUtf16: allUtf16.length,
    minLength,
  };
}
