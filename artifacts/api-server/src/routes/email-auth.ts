import { RequestHandler } from "express";
import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "../lib/logger.js";

type OtpRequestBody = {
  email?: string;
  otp?: string;
  template?: "login" | "register";
};

type SendTestBody = {
  email?: string;
  token?: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
};

type SmtpStatus = {
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean | null;
  user: string | null;
  from: string | null;
  verifyOk: boolean | null;
  verifyError: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

const status: SmtpStatus = {
  configured: false,
  host: null,
  port: null,
  secure: null,
  user: null,
  from: null,
  verifyOk: null,
  verifyError: null,
  lastError: null,
  lastErrorAt: null,
};

function getSmtpConfig(): SmtpConfig | null {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = String(process.env.SMTP_SECURE || "false") === "true";
  const fromEmail =
    process.env.SMTP_FROM ||
    process.env.FROM_EMAIL ||
    smtpUser;
  const fromName =
    process.env.SMTP_FROM_NAME ||
    process.env.FROM_NAME ||
    "Pratyaksh Forensic AI";

  return {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: smtpUser,
    pass: smtpPass,
    fromEmail,
    fromName,
  };
}

function maskUser(user: string): string {
  if (!user) return "";
  const [local, domain] = user.split("@");
  if (!domain) {
    return local.length <= 2
      ? `${local[0] ?? ""}***`
      : `${local.slice(0, 2)}***`;
  }
  const maskedLocal =
    local.length <= 2 ? `${local[0] ?? ""}***` : `${local.slice(0, 2)}***`;
  return `${maskedLocal}@${domain}`;
}

function buildTransporter(cfg: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });
}

function describeError(error: unknown): {
  message: string;
  code?: string;
  response?: string;
  responseCode?: number;
} {
  if (error && typeof error === "object") {
    const e = error as {
      message?: string;
      code?: string;
      response?: string;
      responseCode?: number;
    };
    return {
      message: e.message || String(error),
      code: e.code,
      response: e.response,
      responseCode: e.responseCode,
    };
  }
  return { message: String(error) };
}

function recordStatus(cfg: SmtpConfig | null) {
  if (!cfg) {
    status.configured = false;
    status.host = null;
    status.port = null;
    status.secure = null;
    status.user = null;
    status.from = null;
    return;
  }
  status.configured = true;
  status.host = cfg.host;
  status.port = cfg.port;
  status.secure = cfg.secure;
  status.user = maskUser(cfg.user);
  status.from = `${cfg.fromName} <${cfg.fromEmail}>`;
}

export async function verifySmtpOnBoot(): Promise<void> {
  const cfg = getSmtpConfig();
  recordStatus(cfg);

  if (!cfg) {
    logger.warn(
      "SMTP not configured — set SMTP_HOST, SMTP_USER, and SMTP_PASS to enable OTP email delivery.",
    );
    status.verifyOk = false;
    status.verifyError = "SMTP not configured";
    return;
  }

  try {
    const transporter = buildTransporter(cfg);
    await transporter.verify();
    status.verifyOk = true;
    status.verifyError = null;
    logger.info(
      {
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        user: maskUser(cfg.user),
      },
      "SMTP transporter verified successfully",
    );
  } catch (error) {
    const err = describeError(error);
    status.verifyOk = false;
    status.verifyError = err.message;
    status.lastError = err.message;
    status.lastErrorAt = new Date().toISOString();
    logger.error(
      {
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        user: maskUser(cfg.user),
        code: err.code,
        response: err.response,
        responseCode: err.responseCode,
        message: err.message,
      },
      "SMTP transporter verification FAILED",
    );
  }
}

function getEmailTemplate(otp: string, template?: "login" | "register"): string {
  const heading =
    template === "register" ? "Welcome to Pratyaksh" : "Verification Required";
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
}

export const handleSendOtp: RequestHandler = async (req, res) => {
  const { email, otp, template } = req.body as OtpRequestBody;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      code: "missing_fields",
      message: "Email and OTP are required.",
    });
  }

  const cfg = getSmtpConfig();

  if (!cfg) {
    logger.warn(
      { email: maskUser(email) },
      "OTP send rejected: SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing)",
    );
    return res.status(503).json({
      success: false,
      code: "smtp_not_configured",
      message:
        "Email service is not configured. Ask the administrator to set SMTP_HOST, SMTP_USER, and SMTP_PASS.",
    });
  }

  try {
    const transporter = buildTransporter(cfg);

    const info = await transporter.sendMail({
      from: `${cfg.fromName} <${cfg.fromEmail}>`,
      to: email,
      subject: "Pratyaksh Verification Code",
      html: getEmailTemplate(otp, template),
    });

    status.lastError = null;
    status.lastErrorAt = null;

    logger.info(
      { messageId: info.messageId, to: maskUser(email) },
      "OTP email sent",
    );

    return res.json({
      success: true,
      message: "Email sent successfully.",
      messageId: info.messageId,
    });
  } catch (error) {
    const err = describeError(error);
    status.lastError = err.message;
    status.lastErrorAt = new Date().toISOString();

    logger.error(
      {
        to: maskUser(email),
        code: err.code,
        response: err.response,
        responseCode: err.responseCode,
        message: err.message,
      },
      "OTP email send FAILED",
    );

    return res.status(502).json({
      success: false,
      code: err.code || "smtp_send_failed",
      message: `SMTP error: ${err.message}`,
      smtpResponse: err.response,
      smtpResponseCode: err.responseCode,
    });
  }
};

// In production, masked SMTP config (host/user/from/error text) is only
// returned when a caller proves they're authorized via the same
// SMTP_TEST_TOKEN strategy used by /api/email/send-test. Without the
// token, prod callers get a coarse `{ configured, verifyOk }` so the
// in-app "Test email service" button can still tell users the service
// is up/down without leaking infra details. In non-production
// environments (dev/staging), full diagnostics are always returned
// because that's the whole point of the diagnostic.
function isAuthorizedForFullStatus(req: {
  headers: Record<string, unknown>;
  query?: Record<string, unknown>;
}): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const requiredToken = process.env.SMTP_TEST_TOKEN;
  if (!requiredToken) return false; // prod without token = coarse only
  const header = req.headers["x-smtp-test-token"];
  const queryValue = req.query ? req.query.token : undefined;
  if (typeof header === "string" && header === requiredToken) return true;
  if (typeof queryValue === "string" && queryValue === requiredToken) return true;
  return false;
}

export const handleSmtpStatus: RequestHandler = async (req, res) => {
  const cfg = getSmtpConfig();
  recordStatus(cfg);
  const fullDetails = isAuthorizedForFullStatus(req);

  if (!cfg) {
    return res.json({
      configured: false,
      host: null,
      port: null,
      secure: null,
      user: null,
      from: null,
      verifyOk: false,
      verifyError: "SMTP not configured",
      ...(fullDetails
        ? {
            lastError: status.lastError,
            lastErrorAt: status.lastErrorAt,
            missing: [
              ...(process.env.SMTP_HOST ? [] : ["SMTP_HOST"]),
              ...(process.env.SMTP_USER ? [] : ["SMTP_USER"]),
              ...(process.env.SMTP_PASS ? [] : ["SMTP_PASS"]),
            ],
          }
        : {}),
    });
  }

  try {
    const transporter = buildTransporter(cfg);
    await transporter.verify();
    status.verifyOk = true;
    status.verifyError = null;
    return res.json({
      configured: true,
      verifyOk: true,
      verifyError: null,
      ...(fullDetails
        ? {
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            user: maskUser(cfg.user),
            from: `${cfg.fromName} <${cfg.fromEmail}>`,
            lastError: status.lastError,
            lastErrorAt: status.lastErrorAt,
          }
        : {}),
    });
  } catch (error) {
    const err = describeError(error);
    status.verifyOk = false;
    status.verifyError = err.message;
    status.lastError = err.message;
    status.lastErrorAt = new Date().toISOString();
    logger.error(
      {
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        user: maskUser(cfg.user),
        code: err.code,
        response: err.response,
        responseCode: err.responseCode,
        message: err.message,
      },
      "SMTP verify failed (on-demand)",
    );
    return res.status(502).json({
      configured: true,
      verifyOk: false,
      verifyError: fullDetails ? err.message : "Email service is unavailable.",
      ...(fullDetails
        ? {
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            user: maskUser(cfg.user),
            from: `${cfg.fromName} <${cfg.fromEmail}>`,
            verifyCode: err.code,
            smtpResponse: err.response,
            smtpResponseCode: err.responseCode,
            lastError: status.lastError,
            lastErrorAt: status.lastErrorAt,
          }
        : {}),
    });
  }
};

export const handleSendTest: RequestHandler = async (req, res) => {
  const { email, token } = req.body as SendTestBody;

  const requiredToken = process.env.SMTP_TEST_TOKEN;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    if (!requiredToken) {
      return res.status(403).json({
        success: false,
        code: "test_endpoint_disabled",
        message:
          "Test email endpoint is disabled in production. Set SMTP_TEST_TOKEN to enable, then pass it as `token`.",
      });
    }
    if (token !== requiredToken) {
      return res.status(403).json({
        success: false,
        code: "invalid_test_token",
        message: "Invalid SMTP test token.",
      });
    }
  } else if (requiredToken && token !== requiredToken) {
    return res.status(403).json({
      success: false,
      code: "invalid_test_token",
      message: "Invalid SMTP test token.",
    });
  }

  if (!email) {
    return res.status(400).json({
      success: false,
      code: "missing_fields",
      message: "Recipient email is required.",
    });
  }

  const cfg = getSmtpConfig();
  if (!cfg) {
    return res.status(503).json({
      success: false,
      code: "smtp_not_configured",
      message:
        "Email service is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.",
    });
  }

  try {
    const transporter = buildTransporter(cfg);
    // Use the real branded OTP template with a placeholder code so this
    // endpoint also exercises template rendering, not just transport.
    const sampleOtp = "000000";
    const info = await transporter.sendMail({
      from: `${cfg.fromName} <${cfg.fromEmail}>`,
      to: email,
      subject: "Pratyaksh SMTP test (sample OTP email)",
      text: `This is a Pratyaksh SMTP test message. If you received this, your outbound email transport is working. Sample OTP shown for layout: ${sampleOtp}. Do NOT use this code to sign in.`,
      html: getEmailTemplate(sampleOtp, "login"),
    });

    status.lastError = null;
    status.lastErrorAt = null;

    logger.info(
      { messageId: info.messageId, to: maskUser(email) },
      "SMTP test email sent",
    );

    return res.json({
      success: true,
      message: "SMTP test email sent successfully.",
      messageId: info.messageId,
    });
  } catch (error) {
    const err = describeError(error);
    status.lastError = err.message;
    status.lastErrorAt = new Date().toISOString();
    logger.error(
      {
        to: maskUser(email),
        code: err.code,
        response: err.response,
        responseCode: err.responseCode,
        message: err.message,
      },
      "SMTP test email FAILED",
    );
    return res.status(502).json({
      success: false,
      code: err.code || "smtp_send_failed",
      message: `SMTP error: ${err.message}`,
      smtpResponse: err.response,
      smtpResponseCode: err.responseCode,
    });
  }
};

export const handleVerifyOtp: RequestHandler = (_req, res) => {
  res.json({
    success: true,
    message: "Server verification not configured. Using client verification.",
  });
};
