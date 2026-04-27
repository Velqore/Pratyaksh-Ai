import type { KnowledgeEntry } from "./types";

export const FINGERPRINT_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "fp-patterns",
    intent: "patterns",
    triggers: [
      "pattern",
      "arch",
      "loop",
      "whorl",
      "ulnar",
      "radial",
      "tented",
    ],
    answer:
      "Fingerprints fall into three classical pattern families:\n\n- **Arches** (~5%) — *plain* and *tented*; ridges flow from one side to the other with no delta and no core.\n- **Loops** (~60–65%) — *ulnar* (opens toward little finger) or *radial* (opens toward thumb); one delta, one core.\n- **Whorls** (~30–35%) — *plain*, *central pocket*, *double loop* or *accidental*; two deltas, at least one core.\n\nPattern classification is the first cut in any AFIS comparison; if the patterns disagree, no match is possible regardless of how many minutiae appear similar.",
    followUps: [
      "What are minutiae and how many do we need?",
      "How is ridge clarity measured?",
    ],
    source: "Pratyaksh fingerprint knowledge base",
  },
  {
    id: "fp-minutiae",
    intent: "minutiae",
    triggers: [
      "minutiae",
      "ridge ending",
      "bifurcation",
      "point",
      "level 2",
    ],
    answer:
      "**Minutiae** are the level-2 detail points used for identification — primarily *ridge endings* and *ridge bifurcations*, with *islands*, *spurs*, *crossovers*, *enclosures* and *deltas* as supporting types.\n\nMost jurisdictions require **8–16 corresponding minutiae** in correct relative position before a positive identification can be reported. Pratyaksh extracts each minutia with its `(x, y)` location, ridge orientation in degrees and a confidence value derived from local ridge clarity.",
    followUps: [
      "How is a comparison score computed?",
      "What is a delta and why does it matter?",
    ],
    source: "Pratyaksh fingerprint knowledge base",
  },
  {
    id: "fp-quality",
    intent: "quality",
    triggers: ["quality", "clarity", "noise", "resolution", "dpi", "blurry"],
    answer:
      "Image quality drives every downstream score. We check:\n\n- **Resolution** — at least **500 DPI** for reliable analysis (the FBI EFTS minimum).\n- **Ridge clarity** — local coherence of orientation, reported as a percentage of the print area.\n- **Contrast** — grayscale spread and binarisation margin.\n- **Background noise** — high-frequency content unrelated to ridge flow.\n\nIf overall quality drops below the report threshold, the engine downgrades the case to *latent / partial* analysis and lowers the comparison-confidence ceiling accordingly.",
    followUps: [
      "What enhancement steps does Pratyaksh apply?",
      "When is a print too poor to compare?",
    ],
    source: "Pratyaksh fingerprint knowledge base",
  },
];
