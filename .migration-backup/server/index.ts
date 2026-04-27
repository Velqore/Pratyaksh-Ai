import "dotenv/config";
import express from "express";
import nodemailer from "nodemailer";
import { handleClassifyFingerprint, handleClassifyFingerprintImage, handleGetModelInfo } from "./routes/classify-fingerprint.js";
import { handleSaveFingerprintTrainingFeedback } from "./routes/fingerprint-training-feedback.js";
import { handleStartTraining, handleGetTrainingStatus, handleGetTrainingLogs } from "./routes/train-fingerprint-model.js";
import { handleSaveManualFingerprintAnnotations } from "./routes/manual-fingerprint-annotations.js";
import {
  handleGetFingerprintDatasetImage,
  handleListFingerprintDatasetImages,
} from "./routes/fingerprint-dataset-browser.js";

type OtpRequestBody = {
  email?: string;
  otp?: string;
  template?: "login" | "register";
};

const getEmailTemplate = (otp: string, template?: "login" | "register") => {
  const heading = template === "register" ? "Welcome to Pratyaksh" : "Verification Required";
  const message =
    template === "register"
      ? "Thank you for joining Pratyaksh. Please verify your email to complete registration."
      : "We received a request to sign in. Please verify your identity.";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Pratyaksh Verification Code</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #0f172a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 8px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #0891b2, #0e7490); padding: 28px; text-align: center; }
          .logo { font-size: 22px; font-weight: bold; color: #ffffff; }
          .content { padding: 28px; }
          .otp-box { background-color: #334155; border-radius: 8px; padding: 18px; text-align: center; margin: 18px 0; }
          .otp-code { font-size: 30px; font-weight: bold; color: #22d3ee; letter-spacing: 8px; margin: 8px 0; }
          .footer { background-color: #334155; padding: 18px; text-align: center; font-size: 12px; color: #94a3b8; }
          .notice { background-color: #fef3c7; color: #92400e; padding: 12px; border-radius: 6px; margin: 14px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">PRATYAKSH</div>
            <div style="color:#e2e8f0;">Forensic AI System</div>
          </div>
          <div class="content">
            <h2 style="color:#22d3ee; margin-bottom: 16px;">${heading}</h2>
            <p style="color:#e2e8f0; line-height: 1.6;">${message}</p>
            <div class="otp-box">
              <div style="color:#94a3b8; font-size: 14px;">Your verification code is:</div>
              <div class="otp-code">${otp}</div>
              <div style="color:#94a3b8; font-size: 12px;">This code expires in 5 minutes</div>
            </div>
            <div class="notice">
              <strong>Security Notice:</strong> Never share this code with anyone.
            </div>
          </div>
          <div class="footer">
            <p>This email was sent by Pratyaksh Forensic AI System</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

export function createServer() {
  const app = express();
  
  app.use(express.json());

  app.post("/api/email/send-otp", async (req, res) => {
    const { email, otp, template } = req.body as OtpRequestBody;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpSecure = String(process.env.SMTP_SECURE || "false") === "true";
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
    const fromEmail =
      process.env.SMTP_FROM ||
      process.env.FROM_EMAIL ||
      smtpUser ||
      "noreply@pratyaksh.gov.in";
    const fromName =
      process.env.SMTP_FROM_NAME ||
      process.env.FROM_NAME ||
      "Pratyaksh Forensic AI";

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn("OTP email not configured; logging OTP to server.");
      console.log(`OTP for ${email}: ${otp}`);
      return res.json({
        success: true,
        message: "OTP logged to server. Configure SMTP to send emails.",
      });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: "Pratyaksh Verification Code",
        html: getEmailTemplate(otp, template),
      });

      return res.json({
        success: true,
        message: "Email sent successfully",
        messageId: info.messageId,
      });
    } catch (error) {
      console.error("OTP email send failed:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email",
      });
    }
  });

  app.post("/api/auth/verify-otp", (req, res) => {
    res.json({
      success: true,
      message: "Server verification not configured. Using client verification.",
    });
  });

  // Fingerprint Classification Routes
  app.post("/api/classify/fingerprint", handleClassifyFingerprint);
  app.post("/api/classify/fingerprint/image", handleClassifyFingerprintImage);
  app.get("/api/classify/fingerprint/model", handleGetModelInfo);
  app.post(
    "/api/fingerprint/training-feedback",
    handleSaveFingerprintTrainingFeedback,
  );
  app.post(
    "/api/fingerprint/manual-annotations",
    handleSaveManualFingerprintAnnotations,
  );
  app.get(
    "/api/fingerprint/dataset-images",
    handleListFingerprintDatasetImages,
  );
  app.get(
    "/api/fingerprint/dataset-image",
    handleGetFingerprintDatasetImage,
  );

  // Fingerprint Model Training Routes
  app.post("/api/fingerprint/train", handleStartTraining);
  app.get("/api/fingerprint/training-status", handleGetTrainingStatus);
  app.get("/api/fingerprint/training-status/:trainingId", handleGetTrainingStatus);
  app.get("/api/fingerprint/training-logs/:trainingId", handleGetTrainingLogs);
  
  // API routes here
  app.get("/api/ping", (req, res) => {
    res.json({ message: "pong" });
  });
  
  return app;
}