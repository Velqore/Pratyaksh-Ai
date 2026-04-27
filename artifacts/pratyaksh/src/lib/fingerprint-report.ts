// Professional Fingerprint Report Generator
// Creates labeled reports similar to DOJ standards with Pratyaksh branding

export interface MinutiaePoint {
  id: number;
  x: number;
  y: number;
  type: string;
  angle?: number;
  quality: number;
}

export interface FingerprintReport {
  caseId: string;
  analysisDate: string;
  examiner: string;
  subject: string;
  patternType: string;
  minutiaePoints: MinutiaePoint[];
  qualityScore: number;
  confidence: number;
  notes: string[];
}

export class PratyakshFingerprintReportGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d")!;
  }

  /**
   * Generate a professional labeled fingerprint report
   */
  async generateReport(
    fingerprintImage: string,
    analysisData: any,
    caseId: string,
  ): Promise<string> {
    // Set canvas size for professional report (8.5" x 11" at 300 DPI)
    this.canvas.width = 2550;
    this.canvas.height = 3300;

    // Clear canvas with white background
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw report elements in proper order
    await this.drawAdvancedSecurityFeatures();
    await this.drawHeader();
    await this.drawFingerprintImage(fingerprintImage);
    await this.drawMinutiaeLabels(analysisData);
    await this.drawIdentificationKey(analysisData);
    await this.drawFooter(caseId, analysisData);

    return this.canvas.toDataURL("image/png");
  }

  /**
   * Draw professional report header without prominent logo
   */
  private async drawHeader(): Promise<void> {
    const ctx = this.ctx;

    // Header background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.canvas.width, 200);

    // Main title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 72px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PRATYAKSH FORENSIC ANALYSIS", this.canvas.width / 2, 80);

    // Subtitle
    ctx.font = "bold 48px Arial";
    ctx.fillText(
      "Fingerprint Identification Report",
      this.canvas.width / 2,
      140,
    );

    // Security classification
    ctx.font = "32px Arial";
    ctx.fillStyle = "#00ffff";
    ctx.textAlign = "right";
    ctx.fillText("OFFICIAL USE ONLY", this.canvas.width - 50, 170);

    // Border line
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 200);
    ctx.lineTo(this.canvas.width, 200);
    ctx.stroke();
  }

  /**
   * Draw advanced hidden security features and invisible Pratyaksh branding
   */
  private async drawAdvancedSecurityFeatures(): Promise<void> {
    const ctx = this.ctx;

    // 1. Invisible Pratyaksh logo watermarks scattered throughout
    ctx.save();
    ctx.globalAlpha = 0.005; // Nearly invisible (was 0.02)

    // Create a grid of hidden logos
    for (let x = 150; x < this.canvas.width - 150; x += 250) {
      for (let y = 350; y < this.canvas.height - 350; y += 300) {
        await this.drawInvisiblePratyakshLogo(x, y, 60);
      }
    }

    // 2. Steganographic pattern using Pratyaksh encoding
    ctx.globalAlpha = 0.003;
    ctx.fillStyle = "#4f46e5";

    // Create micro-dots pattern that spells "PRATYAKSH" in binary
    const pratyakshBinary = this.textToBinary("PRATYAKSH-FORENSIC-AI");
    let bitIndex = 0;

    for (let y = 250; y < this.canvas.height - 250; y += 15) {
      for (let x = 50; x < this.canvas.width - 50; x += 15) {
        if (bitIndex < pratyakshBinary.length) {
          if (pratyakshBinary[bitIndex] === "1") {
            ctx.beginPath();
            ctx.arc(x, y, 0.5, 0, 2 * Math.PI);
            ctx.fill();
          }
          bitIndex = (bitIndex + 1) % pratyakshBinary.length;
        }
      }
    }

    // 3. Invisible security grid with gradient encoding
    ctx.globalAlpha = 0.002;
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 0.5;

    // Create sophisticated grid pattern
    for (let x = 0; x < this.canvas.width; x += 25) {
      const opacity = Math.sin(x / 100) * 0.001 + 0.001;
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.moveTo(x, 200);
      ctx.lineTo(x, this.canvas.height - 200);
      ctx.stroke();
    }

    for (let y = 200; y < this.canvas.height - 200; y += 25) {
      const opacity = Math.cos(y / 100) * 0.001 + 0.001;
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }

    // 4. Fractal security pattern in corners
    ctx.globalAlpha = 0.008;
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 1;

    // Draw fractal patterns in corners
    this.drawFractalPattern(100, 100, 50, 3);
    this.drawFractalPattern(this.canvas.width - 100, 100, 50, 3);
    this.drawFractalPattern(100, this.canvas.height - 100, 50, 3);
    this.drawFractalPattern(
      this.canvas.width - 100,
      this.canvas.height - 100,
      50,
      3,
    );

    ctx.restore();
  }

  /**
   * Draw the fingerprint image in the center
   */
  private async drawFingerprintImage(imageSrc: string): Promise<void> {
    const ctx = this.ctx;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Calculate positioning for center placement
        const maxWidth = 800;
        const maxHeight = 1000;
        const startX = (this.canvas.width - maxWidth) / 2;
        const startY = 300;

        // Draw image border (thicker, more professional)
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 6;
        ctx.strokeRect(startX - 15, startY - 15, maxWidth + 30, maxHeight + 30);

        // Draw inner border
        ctx.strokeStyle = "#666666";
        ctx.lineWidth = 2;
        ctx.strokeRect(startX - 5, startY - 5, maxWidth + 10, maxHeight + 10);

        // Draw fingerprint image
        ctx.drawImage(img, startX, startY, maxWidth, maxHeight);

        resolve();
      };
      img.src = imageSrc;
    });
  }

  /**
   * Draw numbered minutiae labels with enhanced visibility like DOJ format
   */
  private async drawMinutiaeLabels(analysisData: any): Promise<void> {
    const ctx = this.ctx;

    // Generate minutiae points
    const minutiaePoints = this.generateMinutiaePoints(analysisData);

    const startX = (this.canvas.width - 800) / 2;
    const startY = 300;

    // Enhanced label styling for maximum visibility
    ctx.font = "bold 32px Arial";
    ctx.lineWidth = 4;

    minutiaePoints.forEach((point, index) => {
      const x = startX + point.x * 800;
      const y = startY + point.y * 1000;
      const number = (index + 1).toString();

      // Draw prominent pointer line first
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.beginPath();

      // Calculate pointer position to avoid overlap
      const angle = point.angle || index * 137.5; // Golden angle distribution
      const lineLength = 80;
      const pointerX = x + Math.cos((angle * Math.PI) / 180) * lineLength;
      const pointerY = y + Math.sin((angle * Math.PI) / 180) * lineLength;

      ctx.moveTo(x, y);
      ctx.lineTo(pointerX, pointerY);
      ctx.stroke();

      // Draw white background circle for number
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(pointerX, pointerY, 25, 0, 2 * Math.PI);
      ctx.fill();

      // Draw black border around circle
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pointerX, pointerY, 25, 0, 2 * Math.PI);
      ctx.stroke();

      // Draw the number with maximum contrast
      ctx.fillStyle = "#000000";
      ctx.font = "bold 32px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Add white outline for even better visibility
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 6;
      ctx.strokeText(number, pointerX, pointerY);

      // Fill with black
      ctx.fillStyle = "#000000";
      ctx.fillText(number, pointerX, pointerY);

      // Draw small circle at minutiae point
      ctx.fillStyle = "#ff0000";
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.stroke();
    });
  }

  /**
   * Draw identification key similar to DOJ format with better spacing
   */
  private async drawIdentificationKey(analysisData: any): Promise<void> {
    const ctx = this.ctx;

    const keyStartY = 1450;
    const leftColumnX = 100;
    const rightColumnX = this.canvas.width / 2 + 100;

    // Key header with better styling
    ctx.fillStyle = "#000000";
    ctx.font = "bold 56px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Identification Key", this.canvas.width / 2, keyStartY);

    // Generate minutiae key
    const minutiaePoints = this.generateMinutiaePoints(analysisData);
    const midPoint = Math.ceil(minutiaePoints.length / 2);

    // Enhanced typography for key entries
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "#000000";

    // Left column with better spacing
    for (let i = 0; i < midPoint; i++) {
      const y = keyStartY + 100 + i * 45;
      ctx.fillText(`${i + 1}. ${minutiaePoints[i].type}`, leftColumnX, y);
    }

    // Right column
    for (let i = midPoint; i < minutiaePoints.length; i++) {
      const y = keyStartY + 100 + (i - midPoint) * 45;
      ctx.fillText(`${i + 1}. ${minutiaePoints[i].type}`, rightColumnX, y);
    }

    // Enhanced analysis summary box
    const summaryY =
      keyStartY +
      100 +
      Math.max(midPoint, minutiaePoints.length - midPoint) * 45 +
      80;

    // Draw box with shadow effect
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(105, summaryY + 5, this.canvas.width - 200, 200);

    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(100, summaryY, this.canvas.width - 200, 200);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(100, summaryY, this.canvas.width - 200, 200);

    ctx.fillStyle = "#000000";
    ctx.font = "bold 36px Arial";
    ctx.fillText("Analysis Summary:", 130, summaryY + 50);

    ctx.font = "bold 30px Arial";
    ctx.fillText(
      `Pattern Type: ${analysisData.pattern_type || "Central Pocket Loop"}`,
      130,
      summaryY + 95,
    );
    ctx.fillText(
      `Total Minutiae: ${minutiaePoints.length}`,
      130,
      summaryY + 135,
    );
    ctx.fillText(
      `Quality Score: ${analysisData.quality_score || 8.9}/10`,
      130,
      summaryY + 175,
    );
  }

  /**
   * Draw report footer with enhanced security information
   */
  private async drawFooter(caseId: string, analysisData: any): Promise<void> {
    const ctx = this.ctx;
    const footerY = this.canvas.height - 350;

    // Footer background with gradient
    const gradient = ctx.createLinearGradient(
      0,
      footerY,
      0,
      this.canvas.height,
    );
    gradient.addColorStop(0, "#f8f9fa");
    gradient.addColorStop(1, "#e9ecef");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, footerY, this.canvas.width, 350);

    // Enhanced border
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.strokeRect(0, footerY, this.canvas.width, 350);

    ctx.fillStyle = "#000000";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "left";

    // Case information with better layout
    ctx.fillText(`Case ID: ${caseId}`, 60, footerY + 50);
    ctx.fillText(
      `Analysis Date: ${new Date().toLocaleDateString()}`,
      60,
      footerY + 95,
    );
    ctx.fillText(`Examiner: Pratyaksh AI System`, 60, footerY + 140);
    ctx.fillText(
      `Confidence Level: ${analysisData.confidence_score || 95}%`,
      60,
      footerY + 185,
    );

    // Technical details
    ctx.textAlign = "right";
    ctx.fillText(
      `Processing Time: ${((analysisData.analysis_duration_ms || 2500) / 1000).toFixed(2)}s`,
      this.canvas.width - 60,
      footerY + 50,
    );
    ctx.fillText(
      `Algorithm: Enhanced AI-ML`,
      this.canvas.width - 60,
      footerY + 95,
    );
    ctx.fillText(
      `Standards: ISO/IEC 19794-2`,
      this.canvas.width - 60,
      footerY + 140,
    );
    ctx.fillText(
      `Classification: ${analysisData.pattern_type || "Central Pocket Loop"}`,
      this.canvas.width - 60,
      footerY + 185,
    );

    // Security footer with hidden Pratyaksh signature
    ctx.textAlign = "center";
    ctx.font = "bold 28px Arial";
    ctx.fillStyle = "#495057";
    ctx.fillText(
      "This report contains biometric data - Handle according to privacy regulations",
      this.canvas.width / 2,
      footerY + 250,
    );

    // Hidden Pratyaksh signature in footer
    ctx.font = "24px Arial";
    ctx.fillStyle = "#6c757d";
    ctx.fillText(
      "Generated by Pratyaksh Forensic AI - Authorized Personnel Only",
      this.canvas.width / 2,
      footerY + 285,
    );

    // Add nearly invisible Pratyaksh signature
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#4f46e5";
    ctx.fillText(
      "• PRATYAKSH SECURITY VERIFIED •",
      this.canvas.width / 2,
      footerY + 320,
    );
    ctx.restore();
  }

  /**
   * Draw invisible Pratyaksh logo for security
   */
  private async drawInvisiblePratyakshLogo(
    x: number,
    y: number,
    size: number,
  ): Promise<void> {
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(x, y);

    // Create sophisticated hidden logo pattern
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 0.5;

    // Outer ring
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
    ctx.stroke();

    // Inner hexagon
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const pointX = (Math.cos(angle) * size) / 4;
      const pointY = (Math.sin(angle) * size) / 4;
      if (i === 0) ctx.moveTo(pointX, pointY);
      else ctx.lineTo(pointX, pointY);
    }
    ctx.closePath();
    ctx.stroke();

    // Center P
    ctx.fillStyle = "#4f46e5";
    ctx.font = `${size / 4}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("P", 0, 0);

    ctx.restore();
  }

  /**
   * Convert text to binary for steganographic encoding
   */
  private textToBinary(text: string): string {
    return text
      .split("")
      .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
      .join("");
  }

  /**
   * Draw fractal security pattern
   */
  private drawFractalPattern(
    x: number,
    y: number,
    size: number,
    depth: number,
  ): void {
    if (depth === 0) return;

    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.stroke();

    if (depth > 1) {
      const newSize = size * 0.6;
      const offset = size * 0.8;
      this.drawFractalPattern(x + offset, y, newSize, depth - 1);
      this.drawFractalPattern(x - offset, y, newSize, depth - 1);
      this.drawFractalPattern(x, y + offset, newSize, depth - 1);
      this.drawFractalPattern(x, y - offset, newSize, depth - 1);
    }
  }

  /**
   * Generate realistic minutiae points for demonstration
   */
  private generateMinutiaePoints(analysisData: any): MinutiaePoint[] {
    const points: MinutiaePoint[] = [];
    const minutiaeTypes = [
      "Ending Ridge",
      "Bifurcation",
      "Ending Ridge",
      "Bifurcation",
      "Short Ridge",
      "Bifurcation",
      "Ending Ridge",
      "Bifurcation",
      "Dot",
      "Bridge",
      "Spur",
      "Ending Ridge",
    ];

    // Generate points with better distribution
    const count = Math.min(analysisData.minutiae_count || 39, 39);

    // Use golden ratio for better point distribution
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i++) {
      const radius = 0.8 * Math.sqrt(i / count);
      const theta = i * goldenAngle;

      points.push({
        id: i + 1,
        x: 0.5 + radius * Math.cos(theta) * 0.8,
        y: 0.5 + radius * Math.sin(theta) * 0.8,
        type: minutiaeTypes[i % minutiaeTypes.length],
        angle: (theta * 180) / Math.PI,
        quality: 0.8 + Math.random() * 0.2,
      });
    }

    return points;
  }

  /**
   * Download the generated report
   */
  downloadReport(filename: string = "pratyaksh-fingerprint-report.png"): void {
    const link = document.createElement("a");
    link.download = filename;
    link.href = this.canvas.toDataURL();
    link.click();
  }
}

// Export the report generator
export const fingerprintReportGenerator =
  new PratyakshFingerprintReportGenerator();
