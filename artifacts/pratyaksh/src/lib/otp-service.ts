// OTP Service Integration for Email
// Using API-based email delivery

interface OTPConfig {
  // Email API Configuration
  emailApiUrl?: string;
  emailApiKey?: string;
  fromEmail?: string;
  fromName?: string;

  // Generic API Configuration
  apiUrl?: string;
  apiKey?: string;
}

interface OTPRequest {
  to: string;
  type: "email";
  template?: string;
  data?: Record<string, any>;
}

interface OTPResponse {
  success: boolean;
  message: string;
  otpId?: string;
  expiresIn?: number;
}

class OTPService {
  private config: OTPConfig;

  constructor(config: OTPConfig) {
    this.config = config;
  }

  // Send Email via API
  async sendEmail(
    email: string,
    otp: string,
    template?: string,
  ): Promise<OTPResponse> {
    try {
      const { emailApiUrl, emailApiKey, fromEmail, fromName } = this.config;

      // Check if any email service is configured
      if (!emailApiUrl && !this.config.apiUrl) {
        console.warn("No email service configured, simulating OTP send");
        return {
          success: true,
          message: "OTP service not configured - development simulation",
          otpId: `dev_sim_${Date.now()}`,
          expiresIn: 300,
        };
      }

      // Prepare email data
      const emailData = {
        to: email,
        from: {
          email: fromEmail || "noreply@pratyaksh.gov.in",
          name: fromName || "Pratyaksh Forensic AI",
        },
        subject: "Pratyaksh - Verification Code",
        html: this.getEmailTemplate(otp, template),
        otp,
        template,
      };

      // Try to send via custom email API
      if (emailApiUrl) {
        try {
          const response = await fetch(`${emailApiUrl}/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(emailApiKey && { Authorization: `Bearer ${emailApiKey}` }),
            },
            body: JSON.stringify(emailData),
          });

          if (response.ok) {
            const result = await response.json();
            return {
              success: true,
              message: "Email sent successfully",
              otpId: result.messageId || `email_${Date.now()}`,
              expiresIn: 300, // 5 minutes
            };
          } else {
            let errorMessage = `Email API failed (${response.status})`;
            try {
              const error = await response.json();
              errorMessage = error.message || errorMessage;
            } catch (parseError) {
              console.warn("Failed to parse email API error response");
            }
            throw new Error(errorMessage);
          }
        } catch (networkError) {
          if (
            networkError instanceof TypeError &&
            networkError.message.includes("fetch")
          ) {
            console.warn(
              "Email API network error, falling back to main API or mock",
            );
            // Continue to fallback options instead of throwing
          } else {
            throw networkError;
          }
        }
      }

      // Fallback: Try main API endpoint
      if (this.config.apiUrl) {
        try {
          const response = await fetch(`${this.config.apiUrl}/send-otp-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(this.config.apiKey && {
                Authorization: `Bearer ${this.config.apiKey}`,
              }),
            },
            body: JSON.stringify(emailData),
          });

          if (response.ok) {
            const result = await response.json();
            return {
              success: true,
              message: "Email sent successfully",
              otpId: result.messageId || `email_${Date.now()}`,
              expiresIn: 300,
            };
          } else {
            console.warn(`Main API failed with status: ${response.status}`);
          }
        } catch (networkError) {
          if (
            networkError instanceof TypeError &&
            networkError.message.includes("fetch")
          ) {
            console.warn("Main API network error, falling back to mock");
          } else {
            console.error("Main API error:", networkError);
          }
        }
      }

      // If no API available, use mock for development
      console.log("📧 Development Email OTP:", {
        to: email,
        otp,
        template,
        subject: "Pratyaksh - Verification Code",
      });

      return {
        success: true,
        message: "Development email logged to console",
        otpId: `dev_email_${Date.now()}`,
        expiresIn: 300,
      };
    } catch (error) {
      console.error("Email Error:", error);
      return {
        success: false,
        message: error.message || "Failed to send email",
      };
    }
  }

  // Send OTP via your custom API
  async sendViaAPI(request: OTPRequest): Promise<OTPResponse> {
    try {
      const { apiUrl, apiKey } = this.config;

      if (!apiUrl) {
        throw new Error("API URL not configured");
      }

      const response = await fetch(`${apiUrl}/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        },
        body: JSON.stringify(request),
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        throw new Error(
          `Failed to parse API response: ${response.status} ${response.statusText}`,
        );
      }

      if (response.ok) {
        return {
          success: true,
          message: data.message || "OTP sent successfully",
          otpId: data.otpId,
          expiresIn: data.expiresIn || 300,
        };
      } else {
        throw new Error(data.message || `OTP API failed: ${response.status}`);
      }
    } catch (error) {
      console.error("API Error:", error);
      return {
        success: false,
        message: error.message || "Failed to send OTP",
      };
    }
  }

  // Main send method - only supports email now
  async sendOTP(
    to: string,
    otp: string,
    type: "email",
    template?: string,
  ): Promise<OTPResponse> {
    try {
      // Log for monitoring (Honeybadger integration point)
      console.log(
        `Sending EMAIL OTP to: ${to.replace(/(.{3}).*(.{3})/, "$1***$2")}`,
      );

      if (!to.includes("@")) {
        throw new Error("Only email addresses are supported for OTP");
      }

      return await this.sendEmail(to, otp, template);
    } catch (error) {
      // Error monitoring integration
      if (typeof window !== "undefined" && (window as any).Honeybadger) {
        (window as any).Honeybadger.notify(error, {
          context: {
            service: "OTP",
            type: "email",
            destination: to.replace(/(.{3}).*(.{3})/, "$1***$2"),
          },
        });
      }

      return {
        success: false,
        message: error.message || "OTP sending failed",
      };
    }
  }

  // Generate OTP
  generateOTP(length: number = 6): string {
    const digits = "0123456789";
    let otp = "";
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  // Verify OTP (for client-side validation)
  verifyOTP(inputOTP: string, storedOTP: string, expiryTime: number): boolean {
    const now = Date.now();
    return inputOTP === storedOTP && now < expiryTime;
  }

  // Email Template
  private getEmailTemplate(otp: string, template?: string): string {
    const baseTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pratyaksh - Verification Code</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #0f172a; color: #ffffff; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 8px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #0891b2, #0e7490); padding: 30px; text-align: center; }
          .logo { font-size: 24px; font-weight: bold; color: #ffffff; margin-bottom: 10px; }
          .content { padding: 30px; }
          .otp-box { background-color: #334155; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .otp-code { font-size: 32px; font-weight: bold; color: #22d3ee; letter-spacing: 8px; margin: 10px 0; }
          .footer { background-color: #334155; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
          .security-notice { background-color: #fef3c7; color: #92400e; padding: 15px; border-radius: 6px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🔬 PRATYAKSH</div>
            <div style="color: #e2e8f0;">Forensic AI System</div>
          </div>
          
          <div class="content">
            <h2 style="color: #22d3ee; margin-bottom: 20px;">
              ${template === "registration" ? "Welcome to Pratyaksh!" : "Verification Required"}
            </h2>
            
            <p style="color: #e2e8f0; line-height: 1.6;">
              ${
                template === "registration"
                  ? "Thank you for joining Pratyaksh Forensic AI System. To complete your registration and secure your account, please verify your email address."
                  : "We received a request to sign in to your Pratyaksh account. To continue, please verify your identity."
              }
            </p>
            
            <div class="otp-box">
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Your verification code is:</p>
              <div class="otp-code">${otp}</div>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">This code expires in 5 minutes</p>
            </div>
            
            <div class="security-notice">
              <strong>🔒 Security Notice:</strong> For your protection, never share this code with anyone. Pratyaksh staff will never ask for your verification code.
            </div>
            
            <p style="color: #94a3b8; font-size: 14px;">
              If you didn't request this code, please ignore this email or contact our security team.
            </p>
          </div>
          
          <div class="footer">
            <p>This email was sent by Pratyaksh Forensic AI System</p>
            <p>© ${new Date().getFullYear()} Pratyaksh. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return baseTemplate;
  }
}

// Create OTP service instance with environment configuration
export const otpService = new OTPService({
  // Email API Configuration
  emailApiUrl: import.meta.env.VITE_EMAIL_API_URL,
  emailApiKey: import.meta.env.VITE_EMAIL_API_KEY,
  fromEmail: import.meta.env.VITE_FROM_EMAIL || "noreply@pratyaksh.gov.in",
  fromName: import.meta.env.VITE_FROM_NAME || "Pratyaksh Forensic AI",

  // Custom API Configuration
  apiUrl: import.meta.env.VITE_API_BASE_URL,
  apiKey: import.meta.env.VITE_API_KEY,
});

// Export types for use in other files
export type { OTPRequest, OTPResponse, OTPConfig };

// Development/Testing helpers
export const mockOTPService = {
  // Generate a mock OTP for development
  generateMockOTP: () => "123456",

  // Mock send that always succeeds (for development)
  mockSend: async (to: string, type: "email"): Promise<OTPResponse> => {
    console.log(`Mock EMAIL OTP sent to: ${to}`);
    return {
      success: true,
      message: "Mock email sent successfully",
      otpId: `mock_${Date.now()}`,
      expiresIn: 300,
    };
  },

  // Mock verify that accepts any 6-digit code (for development)
  mockVerify: (otp: string): boolean => {
    return otp.length === 6 && /^\d+$/.test(otp);
  },
};

// Environment detection
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

// Configuration validation
export const validateOTPConfig = (
  config: OTPConfig,
): { valid: boolean; missing: string[] } => {
  const missing: string[] = [];

  // Check for Email API configuration
  if (!config.emailApiUrl && !config.apiUrl) {
    missing.push("VITE_EMAIL_API_URL or VITE_API_BASE_URL");
  }
  if (!config.fromEmail) missing.push("VITE_FROM_EMAIL");

  return {
    valid: missing.length === 0,
    missing,
  };
};

// Log configuration status on load
if (isDevelopment) {
  const validation = validateOTPConfig(otpService["config"]);
  if (!validation.valid) {
    console.warn("OTP Service Configuration Missing:", validation.missing);
    console.info(
      "OTP service requires proper configuration for production use",
    );
  } else {
    console.log("OTP Service configured successfully");
  }
}
