// Fingerprint Knowledge Base - Derived from Professional References
// This knowledge will be used to train and enhance the AI analysis

export interface FingerprintPattern {
  type: string;
  characteristics: string[];
  deltaCount: number;
  corePresent: boolean;
  description: string;
}

export interface MinutiaeType {
  name: string;
  description: string;
  identificationMarkers: string[];
  frequency: 'common' | 'moderate' | 'rare';
}

export interface RidgeCharacteristic {
  name: string;
  description: string;
  identificationValue: 'high' | 'medium' | 'low';
}

// Fingerprint Ridge Patterns (from uploaded image 1)
export const FINGERPRINT_PATTERNS: FingerprintPattern[] = [
  // ARCHES
  {
    type: "Plain Arch",
    characteristics: [
      "Ridges flow from one side to the other",
      "No deltas present",
      "No core present",
      "Simple ridge flow pattern",
      "Upward thrust in center"
    ],
    deltaCount: 0,
    corePresent: false,
    description: "Simplest pattern where ridges enter from one side and exit from the other with a gentle upward curve"
  },
  {
    type: "Tented Arch",
    characteristics: [
      "Sharp upward thrust at center",
      "Angular formation in center",
      "No deltas typically",
      "More pronounced ridge angle than plain arch",
      "Spike-like formation at center"
    ],
    deltaCount: 0,
    corePresent: false,
    description: "Arch pattern with sharp angular ridge formation creating tent-like appearance"
  },

  // LOOPS
  {
    type: "Radial Loop",
    characteristics: [
      "Ridges flow toward thumb side",
      "One delta present",
      "Core present",
      "Opens toward radius bone",
      "Less common than ulnar loops"
    ],
    deltaCount: 1,
    corePresent: true,
    description: "Loop pattern opening toward the thumb (radial side) of the hand"
  },
  {
    type: "Ulnar Loop",
    characteristics: [
      "Ridges flow toward little finger side",
      "One delta present",
      "Core present",
      "Opens toward ulnar bone",
      "Most common fingerprint pattern"
    ],
    deltaCount: 1,
    corePresent: true,
    description: "Loop pattern opening toward the little finger (ulnar side) of the hand"
  },

  // WHORLS
  {
    type: "Plain Whorl",
    characteristics: [
      "Circular or spiral ridge formation",
      "Two deltas present",
      "Core present at center",
      "Complete circuit of ridges",
      "Symmetrical pattern"
    ],
    deltaCount: 2,
    corePresent: true,
    description: "Circular ridge pattern with two deltas and a central core"
  },
  {
    type: "Central Pocket Loop",
    characteristics: [
      "Loop with whorl-like center",
      "Two deltas present",
      "Pocket formation in center",
      "Combination of loop and whorl features",
      "Core within central pocket"
    ],
    deltaCount: 2,
    corePresent: true,
    description: "Loop pattern with a whorl-like pocket formation in the center"
  },
  {
    type: "Double Loop",
    characteristics: [
      "Two separate loop formations",
      "Two deltas present",
      "Two cores present",
      "S-shaped ridge pattern",
      "Complex ridge flow"
    ],
    deltaCount: 2,
    corePresent: true,
    description: "Pattern consisting of two loop formations flowing in opposite directions"
  },
  {
    type: "Accidental",
    characteristics: [
      "Combination of two or more patterns",
      "Two or more deltas",
      "Irregular formation",
      "Does not fit other categories",
      "Complex and rare pattern"
    ],
    deltaCount: 2,
    corePresent: true,
    description: "Rare pattern that combines features of multiple pattern types"
  }
];

// Ridge Characteristics (from uploaded image 1)
export const RIDGE_CHARACTERISTICS: RidgeCharacteristic[] = [
  {
    name: "Core",
    description: "Center of the pattern around which ridges flow",
    identificationValue: "high"
  },
  {
    name: "Ending Ridge",
    description: "Ridge that terminates abruptly",
    identificationValue: "high"
  },
  {
    name: "Short Ridge",
    description: "Very short ridge segment",
    identificationValue: "medium"
  },
  {
    name: "Fork or Bifurcation",
    description: "Ridge that splits into two branches",
    identificationValue: "high"
  },
  {
    name: "Delta",
    description: "Triangular ridge formation where three ridge systems meet",
    identificationValue: "high"
  },
  {
    name: "Hook",
    description: "Ridge that curves back on itself",
    identificationValue: "medium"
  },
  {
    name: "Eye",
    description: "Enclosed ridge forming oval shape",
    identificationValue: "medium"
  },
  {
    name: "Dot or Island",
    description: "Very short ridge appearing as a dot",
    identificationValue: "low"
  },
  {
    name: "Crossover",
    description: "Ridge that crosses over another ridge",
    identificationValue: "medium"
  },
  {
    name: "Bridge",
    description: "Ridge connecting two other ridges",
    identificationValue: "medium"
  },
  {
    name: "Enclosure",
    description: "Ridge formation that encloses an area",
    identificationValue: "medium"
  },
  {
    name: "Specialty",
    description: "Unique ridge formation not fitting other categories",
    identificationValue: "high"
  }
];

// Minutiae Types (from uploaded image 2)
export const MINUTIAE_TYPES: MinutiaeType[] = [
  {
    name: "Ridge Ending",
    description: "A ridge that terminates abruptly",
    identificationMarkers: ["Sudden termination", "Clear endpoint", "No branching"],
    frequency: "common"
  },
  {
    name: "Bifurcation",
    description: "A ridge that forks into two branches",
    identificationMarkers: ["Y-shaped formation", "Single ridge becoming two", "Fork point"],
    frequency: "common"
  },
  {
    name: "Dot",
    description: "Very short ridge appearing as a small island",
    identificationMarkers: ["Isolated ridge fragment", "Circular or oval shape", "No connections"],
    frequency: "moderate"
  },
  {
    name: "Enclosure",
    description: "Ridge formation that creates an enclosed area",
    identificationMarkers: ["Closed loop formation", "Enclosed white space", "Complete circuit"],
    frequency: "moderate"
  },
  {
    name: "Short Ridge",
    description: "A ridge that is significantly shorter than surrounding ridges",
    identificationMarkers: ["Limited length", "Isolated segment", "Clear beginning and end"],
    frequency: "moderate"
  },
  {
    name: "Ridge Break",
    description: "A gap or interruption in a ridge line",
    identificationMarkers: ["Discontinuity in ridge", "Gap in ridge flow", "Broken ridge segment"],
    frequency: "moderate"
  },
  {
    name: "Crossover",
    description: "Where one ridge appears to cross over another",
    identificationMarkers: ["Ridge intersection", "Overlapping ridges", "Bridge-like formation"],
    frequency: "rare"
  },
  {
    name: "Over/Under",
    description: "Ridge patterns showing depth relationship",
    identificationMarkers: ["Apparent layering", "Depth perception", "Ridge prominence"],
    frequency: "rare"
  },
  {
    name: "Bridge",
    description: "A ridge connecting two separate ridge lines",
    identificationMarkers: ["Connecting ridge", "Links two ridges", "Bridge formation"],
    frequency: "moderate"
  },
  {
    name: "Divergence",
    description: "Point where ridges spread apart",
    identificationMarkers: ["Ridges separating", "Spreading pattern", "Divergent flow"],
    frequency: "moderate"
  },
  {
    name: "Spur",
    description: "A short ridge branching off from a longer ridge",
    identificationMarkers: ["Short branch", "Protrusion from main ridge", "Spike-like formation"],
    frequency: "moderate"
  },
  {
    name: "Tuning Fork",
    description: "A ridge ending that splits into two short branches",
    identificationMarkers: ["Fork-like ending", "Two-pronged termination", "Tuning fork shape"],
    frequency: "rare"
  },
  {
    name: "Double Bifurcation",
    description: "Two bifurcations occurring close together",
    identificationMarkers: ["Multiple fork points", "Complex branching", "Double Y-formation"],
    frequency: "rare"
  },
  {
    name: "Trifurcation",
    description: "A ridge splitting into three branches",
    identificationMarkers: ["Three-way split", "Triple branch point", "Star-like formation"],
    frequency: "rare"
  }
];

// Professional Analysis Guidelines
export const ANALYSIS_GUIDELINES = {
  minimumMinutiaeForIdentification: 12,
  preferredMinutiaeForCourt: 16,
  qualityThresholds: {
    excellent: { score: 9, confidence: 95 },
    good: { score: 7, confidence: 85 },
    fair: { score: 5, confidence: 75 },
    poor: { score: 3, confidence: 60 }
  },
  patternFrequency: {
    "Ulnar Loop": 0.65,
    "Radial Loop": 0.05,
    "Plain Whorl": 0.25,
    "Central Pocket Loop": 0.02,
    "Double Loop": 0.02,
    "Plain Arch": 0.035,
    "Tented Arch": 0.005,
    "Accidental": 0.001
  }
};

// Enhanced Pattern Recognition
export function analyzePatternFromImage(ridgeFlow: any, deltaCount: number, corePresent: boolean): string {
  if (deltaCount === 0) {
    if (ridgeFlow.angularFormation) {
      return "Tented Arch";
    }
    return "Plain Arch";
  }
  
  if (deltaCount === 1) {
    if (ridgeFlow.direction === "radial") {
      return "Radial Loop";
    }
    return "Ulnar Loop";
  }
  
  if (deltaCount === 2) {
    if (ridgeFlow.spiralCenter) {
      return "Plain Whorl";
    }
    if (ridgeFlow.pocketFormation) {
      return "Central Pocket Loop";
    }
    if (ridgeFlow.doubleLoop) {
      return "Double Loop";
    }
    return "Accidental";
  }
  
  return "Unclassified";
}

// Enhanced Minutiae Detection
export function classifyMinutiae(ridgePattern: any): MinutiaeType[] {
  const detectedMinutiae: MinutiaeType[] = [];
  
  // Use the knowledge base to classify detected minutiae
  for (const minutiaeType of MINUTIAE_TYPES) {
    if (ridgePattern.matches && ridgePattern.matches.includes(minutiaeType.name.toLowerCase())) {
      detectedMinutiae.push(minutiaeType);
    }
  }
  
  return detectedMinutiae;
}

// Quality Assessment Based on Professional Standards
export function assessFingerprintQuality(
  minutiaeCount: number,
  ridgeClarity: number,
  patternDefinition: number
): {
  score: number;
  confidence: number;
  courtAdmissible: boolean;
  recommendations: string[];
} {
  const score = Math.min(10, (minutiaeCount * 0.3) + (ridgeClarity * 3.5) + (patternDefinition * 3.2));
  let confidence = 0;
  let courtAdmissible = false;
  const recommendations: string[] = [];

  if (score >= 9) {
    confidence = 95;
    courtAdmissible = true;
    recommendations.push("Excellent quality for identification");
    recommendations.push("Suitable for court presentation");
  } else if (score >= 7) {
    confidence = 85;
    courtAdmissible = true;
    recommendations.push("Good quality for identification");
    recommendations.push("Recommend expert verification");
  } else if (score >= 5) {
    confidence = 75;
    courtAdmissible = minutiaeCount >= 12;
    recommendations.push("Fair quality - additional samples recommended");
    if (!courtAdmissible) {
      recommendations.push("Below court admissibility threshold");
    }
  } else {
    confidence = 60;
    courtAdmissible = false;
    recommendations.push("Poor quality - enhancement required");
    recommendations.push("Additional samples strongly recommended");
  }

  return { score, confidence, courtAdmissible, recommendations };
}
