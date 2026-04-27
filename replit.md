# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Pratyaksh Forensic Pipeline (artifacts/pratyaksh)

The Cyber and Documents labs run a 100% client-side, deterministic forensic pipeline.
No external AI is called for these labs — `aiForensicService.analyzeWithAI()` short-circuits
`type:"cyber"` and `type:"document"` to orchestrators in `src/lib/forensics/`. Only the
Fingerprint lab still uses `evidenceApi`.

- Orchestrators: `src/lib/forensics/cyber.ts`, `src/lib/forensics/documents.ts`
- Primitives: `hashing` (js-md5 + WebCrypto SHA-1/256/512), `file-type` (magic bytes),
  `entropy` (Shannon), `strings` (ASCII + UTF-16), `iocs` (IPv4/IPv6/URL/email/wallet),
  `headers` (PE/ELF), `metadata` (exifr), `stego` (LSB chi-square), `pdf` (pdf-lib),
  `office` (jszip + vbaProject), `zip`, `ocr` (lazy tesseract.js), `handwriting`
  (Otsu + connected-components + slant PCA + tremor + pHash + Hamming).
- Document comparison: optional second upload card on `/documents` triggers a side-by-side
  match (perceptual-hash Hamming + OCR-text Jaccard + slant/stroke-width deltas).
- Real progress: orchestrators emit `onProgress(label, frac)`; the UI shows the live label
  and percentage. Fake `setInterval` progress was removed.
- Graceful failure: corrupt PNGs / malformed PDFs never crash the page. Image-decode, OCR,
  and pHash are wrapped in `try/catch`; the Tesseract worker has an `errorHandler` and a
  safe terminate; `src/lib/monitoring.ts` calls `event.preventDefault()` on the global
  `unhandledrejection` listener for a *narrow* set of known third-party worker signatures
  (Tesseract / pdf-lib / libpng) so Vite's runtime overlay does not block the user.

## Pratyaksh On-Device Forensic Assistant (artifacts/pratyaksh)

The chat assistant is fully self-contained — no external AI service is called. Removed
`src/lib/dolphin-chat-service.ts` and the static `src/lib/ai-responses.ts`.

- Engine: `src/lib/forensic-assistant/` (`engine.ts`, `knowledge-cyber.ts`,
  `knowledge-document.ts`, `knowledge-fingerprint.ts`). Lab-scoped knowledge base, deterministic
  trigger-token scoring, greeting/help/case-summary intents, fallback message, suggested
  prompts and per-response follow-up chips. `typingDelayFor` produces the natural typing pause.
- UI: `src/components/ui/forensic-assistant.tsx` — floating launcher + expandable panel,
  framer-motion animations, react-markdown (+ remark-gfm) rendering, copy/retry/clear,
  per-case `localStorage` history at key `pratyaksh_assistant_history__<lab>__<caseId>`,
  lab-coloured accents (cyan / purple / emerald / blue).
- Mounted on `/cyber`, `/documents`, `/fingerprint`, `/dashboard`. The main `/` page chat
  surface (`Index.tsx`) uses the same engine for both chat replies and post-analysis
  commentary; the Dolphin status pill was replaced with an "Assistant Ready · on-device" pill.

## Pratyaksh Professional PDF Report (artifacts/pratyaksh)

`src/lib/pdf-report-generator.ts` is rebuilt on **bundled jspdf + jspdf-autotable** (no CDN).
Output is an A4 portrait PDF with: cover page (deep-navy brand band + accent rule + case
brief card), chain-of-custody table, methodology paragraph + analysis steps, evidence
summary, lab-specific section (cyber: signature / IOC table with byte offsets / carving;
document: handwriting characteristics / properties + revisions / writer-comparison),
auto-composed conclusions, examiner attestation block, page-numbered footer, and a 6%-opacity
diagonal "PRATYAKSH" watermark on every body page. Robust against missing optional fields.
