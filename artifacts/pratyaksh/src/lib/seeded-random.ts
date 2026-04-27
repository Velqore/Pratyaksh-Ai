/**
 * Deterministic Random Number Generator
 * Uses a seed to ensure reproducible results for the same input
 */

export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0; // Ensure it's a 32-bit unsigned integer
  }

  /**
   * Generate next random number between 0 and 1 (deterministic)
   */
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Shuffle array deterministically
   */
  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Generate a numeric seed from file content
 * Same file = same seed = same analysis results
 */
export async function generateSeedFromFile(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result as ArrayBuffer;
      let hash = 0;

      // Create a hash from the first 10KB of the file
      const view = new Uint8Array(data.slice(0, 10240));
      for (let i = 0; i < view.length; i++) {
        hash = ((hash << 5) - hash + view[i]) | 0; // 32-bit hash
      }

      // Also include file metadata in the seed
      hash = ((hash << 5) - hash + file.size) | 0;
      hash = ((hash << 5) - hash + file.lastModified) | 0;

      resolve(Math.abs(hash) >>> 0); // Return as positive 32-bit integer
    };
    reader.readAsArrayBuffer(file);
  });
}
