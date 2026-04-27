// Magic-byte file type detection. Uses the first ~64 bytes of the file
// and matches against well-known signatures. Returns the detected category
// and reports any mismatch with the user-provided file extension so the
// investigator can see attempts to disguise file types.

export interface DetectedFileType {
  detectedType: string;
  detectedCategory:
    | "image"
    | "document"
    | "archive"
    | "executable"
    | "audio"
    | "video"
    | "text"
    | "unknown";
  headerHex: string;
  magicNumbers: string[];
  extension: string;
  extensionMatchesMagic: boolean;
  signatureExplanation: string;
}

interface Signature {
  bytes: number[]; // -1 means wildcard
  offset: number;
  type: string;
  category: DetectedFileType["detectedCategory"];
  extensions: string[];
  explanation: string;
}

const SIGNATURES: Signature[] = [
  // Images
  {
    bytes: [0xff, 0xd8, 0xff],
    offset: 0,
    type: "JPEG image",
    category: "image",
    extensions: ["jpg", "jpeg"],
    explanation: "JPEG SOI marker FF D8 FF",
  },
  {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    offset: 0,
    type: "PNG image",
    category: "image",
    extensions: ["png"],
    explanation: "PNG signature 89 50 4E 47 0D 0A 1A 0A",
  },
  {
    bytes: [0x47, 0x49, 0x46, 0x38],
    offset: 0,
    type: "GIF image",
    category: "image",
    extensions: ["gif"],
    explanation: "GIF8 header",
  },
  {
    bytes: [0x42, 0x4d],
    offset: 0,
    type: "BMP image",
    category: "image",
    extensions: ["bmp"],
    explanation: "BMP 'BM' header",
  },
  {
    bytes: [0x52, 0x49, 0x46, 0x46],
    offset: 0,
    type: "RIFF container (WEBP/WAV/AVI)",
    category: "image",
    extensions: ["webp", "wav", "avi"],
    explanation: "RIFF container header",
  },
  {
    bytes: [0x49, 0x49, 0x2a, 0x00],
    offset: 0,
    type: "TIFF image (little-endian)",
    category: "image",
    extensions: ["tif", "tiff"],
    explanation: "TIFF II*\\0 little-endian header",
  },
  {
    bytes: [0x4d, 0x4d, 0x00, 0x2a],
    offset: 0,
    type: "TIFF image (big-endian)",
    category: "image",
    extensions: ["tif", "tiff"],
    explanation: "TIFF MM\\0* big-endian header",
  },

  // Documents
  {
    bytes: [0x25, 0x50, 0x44, 0x46, 0x2d],
    offset: 0,
    type: "PDF document",
    category: "document",
    extensions: ["pdf"],
    explanation: "PDF %PDF- header",
  },
  {
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    offset: 0,
    type: "OLE Compound Document (legacy Office)",
    category: "document",
    extensions: ["doc", "xls", "ppt", "msi"],
    explanation: "OLE2/CFBF compound document signature",
  },
  {
    bytes: [0x7b, 0x5c, 0x72, 0x74, 0x66],
    offset: 0,
    type: "Rich Text Format",
    category: "document",
    extensions: ["rtf"],
    explanation: "RTF '{\\rtf' header",
  },

  // Archives (DOCX/XLSX/PPTX/JAR/APK are all ZIP underneath)
  {
    bytes: [0x50, 0x4b, 0x03, 0x04],
    offset: 0,
    type: "ZIP archive (or Office Open XML)",
    category: "archive",
    extensions: ["zip", "docx", "xlsx", "pptx", "jar", "apk", "epub"],
    explanation: "ZIP local file header PK\\x03\\x04",
  },
  {
    bytes: [0x50, 0x4b, 0x05, 0x06],
    offset: 0,
    type: "Empty ZIP archive",
    category: "archive",
    extensions: ["zip"],
    explanation: "ZIP end-of-central-dir PK\\x05\\x06",
  },
  {
    bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07],
    offset: 0,
    type: "RAR archive",
    category: "archive",
    extensions: ["rar"],
    explanation: "Rar! header",
  },
  {
    bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c],
    offset: 0,
    type: "7-Zip archive",
    category: "archive",
    extensions: ["7z"],
    explanation: "7z signature",
  },
  {
    bytes: [0x1f, 0x8b],
    offset: 0,
    type: "Gzip compressed",
    category: "archive",
    extensions: ["gz", "tgz"],
    explanation: "Gzip magic 1F 8B",
  },

  // Executables
  {
    bytes: [0x4d, 0x5a],
    offset: 0,
    type: "Windows PE executable",
    category: "executable",
    extensions: ["exe", "dll", "sys"],
    explanation: "MZ DOS header (PE/COFF)",
  },
  {
    bytes: [0x7f, 0x45, 0x4c, 0x46],
    offset: 0,
    type: "ELF executable (Linux)",
    category: "executable",
    extensions: ["elf", "so"],
    explanation: "\\x7FELF header",
  },
  {
    bytes: [0xca, 0xfe, 0xba, 0xbe],
    offset: 0,
    type: "Mach-O Universal binary or Java class",
    category: "executable",
    extensions: ["class"],
    explanation: "CA FE BA BE — Mach-O FAT or Java .class",
  },
  {
    bytes: [0xfe, 0xed, 0xfa, 0xce],
    offset: 0,
    type: "Mach-O 32-bit executable",
    category: "executable",
    extensions: ["macho"],
    explanation: "Mach-O 32-bit signature",
  },
  {
    bytes: [0xfe, 0xed, 0xfa, 0xcf],
    offset: 0,
    type: "Mach-O 64-bit executable",
    category: "executable",
    extensions: ["macho"],
    explanation: "Mach-O 64-bit signature",
  },
  {
    bytes: [0x23, 0x21],
    offset: 0,
    type: "Unix shell script",
    category: "executable",
    extensions: ["sh"],
    explanation: "Shebang #! header",
  },

  // Audio/Video
  {
    bytes: [0x49, 0x44, 0x33],
    offset: 0,
    type: "MP3 audio (ID3)",
    category: "audio",
    extensions: ["mp3"],
    explanation: "ID3 tag header",
  },
  {
    bytes: [0x66, 0x4c, 0x61, 0x43],
    offset: 0,
    type: "FLAC audio",
    category: "audio",
    extensions: ["flac"],
    explanation: "fLaC header",
  },
  {
    bytes: [0x4f, 0x67, 0x67, 0x53],
    offset: 0,
    type: "Ogg container",
    category: "audio",
    extensions: ["ogg", "ogv"],
    explanation: "OggS header",
  },
  {
    bytes: [-1, -1, -1, -1, 0x66, 0x74, 0x79, 0x70],
    offset: 0,
    type: "ISO Base Media (MP4/MOV/M4A)",
    category: "video",
    extensions: ["mp4", "mov", "m4a", "m4v", "3gp"],
    explanation: "ISO BMFF 'ftyp' atom at offset 4",
  },
  {
    bytes: [0x1a, 0x45, 0xdf, 0xa3],
    offset: 0,
    type: "Matroska / WebM",
    category: "video",
    extensions: ["mkv", "webm"],
    explanation: "EBML header",
  },
];

function matches(bytes: Uint8Array, sig: Signature): boolean {
  if (bytes.length < sig.offset + sig.bytes.length) return false;
  for (let i = 0; i < sig.bytes.length; i++) {
    const expected = sig.bytes[i];
    if (expected === -1) continue;
    if (bytes[sig.offset + i] !== expected) return false;
  }
  return true;
}

function isLikelyText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  let printable = 0;
  const sample = Math.min(bytes.length, 512);
  for (let i = 0; i < sample; i++) {
    const b = bytes[i];
    if (
      b === 9 ||
      b === 10 ||
      b === 13 ||
      (b >= 32 && b <= 126) ||
      b >= 0x80
    ) {
      printable++;
    }
  }
  return printable / sample > 0.95;
}

export async function detectFileType(file: File): Promise<DetectedFileType> {
  const headerSize = Math.min(file.size, 64);
  const buf = await file.slice(0, headerSize).arrayBuffer();
  const bytes = new Uint8Array(buf);
  const headerHex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");

  const ext = (file.name.split(".").pop() || "").toLowerCase();

  for (const sig of SIGNATURES) {
    if (matches(bytes, sig)) {
      const matchesExt = ext ? sig.extensions.includes(ext) : true;
      return {
        detectedType: sig.type,
        detectedCategory: sig.category,
        headerHex,
        magicNumbers: [
          sig.bytes
            .map((b) =>
              b === -1 ? "??" : b.toString(16).padStart(2, "0").toUpperCase(),
            )
            .join(""),
        ],
        extension: ext,
        extensionMatchesMagic: matchesExt,
        signatureExplanation: sig.explanation,
      };
    }
  }

  // Fallback: text vs binary
  if (isLikelyText(bytes)) {
    return {
      detectedType: "Plain text or source code",
      detectedCategory: "text",
      headerHex,
      magicNumbers: ["(no magic — printable ASCII detected)"],
      extension: ext,
      extensionMatchesMagic: ["txt", "csv", "json", "xml", "log", "md"].includes(
        ext,
      ),
      signatureExplanation:
        "Heuristic: >95% printable bytes in first 512 bytes",
    };
  }

  return {
    detectedType: "Unknown binary",
    detectedCategory: "unknown",
    headerHex,
    magicNumbers: ["(no signature matched)"],
    extension: ext,
    extensionMatchesMagic: false,
    signatureExplanation: "No known magic bytes matched the file header",
  };
}
