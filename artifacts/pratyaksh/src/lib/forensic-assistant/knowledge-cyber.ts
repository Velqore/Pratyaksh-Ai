import type { KnowledgeEntry } from "./types";

export const CYBER_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "cyber-hashing-overview",
    intent: "hashing-overview",
    triggers: ["hash", "md5", "sha1", "sha256", "sha512", "checksum", "integrity"],
    answer:
      "**Cryptographic hashing** produces a fixed-length fingerprint of an evidence file. Pratyaksh streams the bytes through `hash-wasm` and computes **MD5, SHA-1, SHA-256 and SHA-512** in a single pass.\n\n- **MD5 / SHA-1** are kept for compatibility with legacy case-management systems but are *not* relied on for tamper detection — both have known collision attacks.\n- **SHA-256** is the working integrity anchor used in our chain-of-custody table and in the comparison fallback (byte-for-byte equality is decided on SHA-256 match).\n- **SHA-512** is recorded for archival and for cross-jurisdiction sharing.\n\nAny later re-hash of the same file must reproduce the SHA-256 exactly; a single bit flip will cascade through the entire digest.",
    followUps: [
      "Explain the chain of custody recorded in the report",
      "How does Pratyaksh detect file-signature mismatches?",
    ],
    source: "Pratyaksh cyber pipeline (lib/forensics/cyber.ts)",
  },
  {
    id: "cyber-signature-detection",
    intent: "signature-mismatch",
    triggers: [
      "signature",
      "magic number",
      "magic bytes",
      "header",
      "extension",
      "mismatch",
      "spoof",
    ],
    answer:
      "**File-signature analysis** reads the first 16 bytes of the upload and matches them against a built-in magic-number table (PNG `89 50 4E 47`, JPEG `FF D8 FF`, PDF `%PDF`, ZIP `50 4B 03 04`, ELF `7F 45 4C 46`, etc.).\n\nIf the detected signature disagrees with the user-supplied extension, the report flags **`potentialDiscrepancy: true`** — a classic indicator of:\n\n1. A renamed payload (e.g. `report.pdf` that is actually a ZIP container).\n2. An archive masquerading as a document to bypass mail filters.\n3. A polyglot file (valid as two formats simultaneously).\n\nThe header bytes themselves are surfaced in the *Signatures* tab for manual verification.",
    followUps: [
      "Show me what the IOC scanner looks for",
      "What does file carving recover in our pipeline?",
    ],
    source: "Pratyaksh cyber pipeline (lib/forensics/cyber.ts → detectSignature)",
  },
  {
    id: "cyber-iocs",
    intent: "iocs",
    triggers: [
      "ioc",
      "indicator",
      "url",
      "ip",
      "domain",
      "email",
      "btc",
      "bitcoin",
      "wallet",
      "registry",
    ],
    answer:
      "Pratyaksh extracts **Indicators of Compromise (IOCs)** by streaming the decoded bytes through deterministic regular expressions:\n\n- **URLs** — `https?://…` with byte-offset capture.\n- **IPv4** — RFC-791 dotted quads (octet-bounded, stateless test to avoid `lastIndex` carry-over).\n- **Email addresses** — RFC-5322 simplified pattern.\n- **BTC wallets** — base58 P2PKH/P2SH and bech32 SegWit.\n- **Windows Registry keys** — `HKLM\\…`, `HKCU\\…` paths.\n- **Suspicious strings** — `cmd.exe`, `powershell -enc`, `mimikatz`, `psexec`, etc.\n\nEach hit is reported with its **byte offset** so an analyst can pivot directly to the location in a hex viewer.",
    followUps: [
      "Open the strings table and explain offsets",
      "How is entropy computed for packed-binary detection?",
    ],
    source: "Pratyaksh cyber pipeline (lib/forensics/iocs.ts)",
  },
  {
    id: "cyber-entropy",
    intent: "entropy",
    triggers: ["entropy", "packed", "encrypted", "compressed", "shannon"],
    answer:
      "We compute **Shannon entropy** in 4 KiB sliding windows during the streaming hash pass. The score lives in `[0, 8]` bits/byte:\n\n- **< 4.5** — typical text / structured data.\n- **4.5 – 7.0** — mixed binary, normal executables.\n- **> 7.2** — packed, compressed or encrypted regions. UPX-packed binaries, AES-encrypted archives and ransomware payloads all live here.\n\nThe per-window scores are aggregated to a global mean and a peak, both surfaced in the *Hashes* tab. Sustained > 7.5 with low variance is one of the strongest single signals for an encrypted payload.",
    followUps: ["Explain the file carving section", "What IOCs flag ransomware?"],
    source: "Pratyaksh cyber pipeline (streaming entropy in cyber.ts)",
  },
  {
    id: "cyber-carving",
    intent: "carving",
    triggers: ["carve", "carving", "deleted", "fragment", "slack", "recover"],
    answer:
      "**File carving** locates embedded or deleted payloads inside a container by scanning for known *header / footer* magic pairs without relying on filesystem metadata.\n\nFor archives (ZIP, OOXML, JAR) we additionally enumerate the **Central Directory** so each contained file is listed with its compressed/uncompressed size and CRC-32. PDFs are walked by stream object so embedded JavaScript and `/Launch` actions can be flagged. Recovered fragments are reported with start offset, length and detected MIME type.",
    followUps: [
      "What does the ZIP listing tell me?",
      "How do I read the recovered-fragments table?",
    ],
    source: "Pratyaksh cyber pipeline (lib/forensics/zip.ts, pdf.ts)",
  },
  {
    id: "cyber-chain-of-custody",
    intent: "chain-of-custody",
    triggers: ["custody", "chain", "audit", "evidence trail", "court"],
    answer:
      "Every analysis writes a **chain-of-custody** record into the case file containing: case ID, original file name & size, MIME type, all four hashes (MD5/SHA-1/SHA-256/SHA-512), the analyst session ID, the wall-clock timestamps of acquisition / analysis / report generation, and the SHA-256 of the generated PDF report itself.\n\nThis record is reproduced verbatim on page 2 of the PDF so a downstream examiner can independently recompute the digests and verify the chain.",
    followUps: [
      "Show me the methodology section of the report",
      "How is the report digitally signed?",
    ],
    source: "Pratyaksh report generator",
  },
];
