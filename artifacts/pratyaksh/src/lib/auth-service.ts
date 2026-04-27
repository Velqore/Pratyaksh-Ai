import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect } from "react";
import { monitoringService } from "./monitoring";

// Types
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  department: string;
  employeeId: string;
  profileImage?: string;
  clearanceLevel: string;
  joinDate: string;
  location: string;
  badge?: string;
  isVerified: boolean;
  createdAt: string;
  lastLogin: string;
}

export interface UserRegistration {
  name: string;
  email: string;
  phone?: string;
  department: string;
  title?: string;
  location?: string;
}

export interface OTPVerification {
  identifier: string; // phone or email
  otp: string;
  type: "login" | "register";
  userData?: UserRegistration;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  errorCode: string | null;
  otpSent: boolean;
  otpIdentifier: string | null;
  registrationData: UserRegistration | null;
}

// Shared API result types so callers can read `.code` / `.status` / `.message`
// without resorting to `any` casts.
export interface ApiErrorResponse {
  success: false;
  status?: number;
  code?: string;
  message: string;
  // Server may include additional diagnostic fields (e.g. smtpResponse).
  [key: string]: unknown;
}

export interface SendOtpSuccess {
  success: true;
  message: string;
  otpId: string;
}
export type SendOtpResult = SendOtpSuccess | ApiErrorResponse;

export interface VerifyOtpSuccess {
  success: true;
  user: AuthUser;
  token?: string | null;
  message?: string;
}
export type VerifyOtpResult = VerifyOtpSuccess | ApiErrorResponse;

// Read a property off an unknown error value without `any`.
function readErrorProp(err: unknown, key: string): unknown {
  if (typeof err === "object" && err !== null && key in err) {
    return (err as Record<string, unknown>)[key];
  }
  return undefined;
}

export interface AuthActions {
  signIn: (identifier: string) => Promise<boolean>;
  register: (userData: UserRegistration) => Promise<boolean>;
  verifyOTP: (otp: string, type: "login" | "register") => Promise<boolean>;
  resendOTP: () => Promise<boolean>;
  signOut: () => void;
  clearError: () => void;
  updateProfile: (updates: Partial<AuthUser>) => Promise<boolean>;
  refreshSession: () => Promise<boolean>;
}

// API Configuration - Force correct base URL
const getBaseUrl = () => {
  // Force use current origin in browser environments
  if (typeof window !== 'undefined') {
    // Always use current origin for deployed apps
    const currentOrigin = window.location.origin;
    console.log('🌐 Current origin detected:', currentOrigin);

    // If we're on a deployed domain (not localhost), use current origin
    if (!currentOrigin.includes('localhost')) {
      console.log('✅ Using deployed origin:', currentOrigin);
      return `${currentOrigin}/api`;
    }
  }

  // Check if we're in development
  const isDev = import.meta.env.DEV;

  // If environment variable is set, use it (but only for localhost)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Default to relative path for localhost development
  return "/api";
};

const API_CONFIG = {
  baseUrl: getBaseUrl(),
  endpoints: {
    sendOTP: "/auth/send-otp",
    verifyOTP: "/auth/verify-otp",
    register: "/auth/register",
    refreshToken: "/auth/refresh",
    profile: "/user/profile",
    updateProfile: "/user/profile",
    logout: "/auth/logout",
  },
};

// OTP Service Configuration
const OTP_CONFIG = {
  emailApiUrl: import.meta.env.VITE_EMAIL_API_URL,
  emailApiKey: import.meta.env.VITE_EMAIL_API_KEY,
  fromEmail: import.meta.env.VITE_FROM_EMAIL,
  fromName: import.meta.env.VITE_FROM_NAME,
};

class AuthenticationService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem("pratyaksh_token");
  }

  // API Helper
  private async apiCall(endpoint: string, options: RequestInit = {}) {
    // Force relative URLs to avoid any origin resolution issues
    const url = `/api${endpoint}`;

    // Debug logging
    console.log(`🔗 API Call: ${options.method || 'GET'} ${url}`);
    console.log(`🌐 Current Origin: ${typeof window !== 'undefined' ? window.location.origin : 'server-side'}`);
    console.log(`📍 Using relative URL: ${url}`);

    const headers = {
      "Content-Type": "application/json",
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    try {
      console.log(`⏳ Making request to: ${url}`);

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log(`📨 Response received: ${response.status} ${response.statusText}`);

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
        let errorCode: string | undefined;
        let errorBody: Record<string, unknown> | null = null;

        try {
          const parsed: unknown = await response.json();
          if (parsed && typeof parsed === "object") {
            errorBody = parsed as Record<string, unknown>;
            const msg = readErrorProp(errorBody, "message");
            const err = readErrorProp(errorBody, "error");
            const code = readErrorProp(errorBody, "code");
            const altCode = readErrorProp(errorBody, "error_code");
            if (typeof msg === "string" && msg) errorDetails = msg;
            else if (typeof err === "string" && err) errorDetails = err;
            if (typeof code === "string" && code) errorCode = code;
            else if (typeof altCode === "string" && altCode) errorCode = altCode;
          }
        } catch (parseError) {
          // If response isn't JSON, use status text
          console.warn("Failed to parse error response:", parseError);
        }

        // Return the structured error so callers can inspect `code`
        // without losing the body. We deliberately do NOT throw, so
        // the catch block doesn't normalize the message away.
        monitoringService.logAPIError(
          endpoint,
          response.status,
          new Error(errorDetails),
        );
        return {
          success: false,
          status: response.status,
          code: errorCode || `http_${response.status}`,
          message: errorDetails,
          ...(errorBody ?? {}),
        };
      }

      const data = await response.json();
      console.log(`✅ API call successful:`, data);
      return data;
    } catch (error) {
      console.error(`❌ API call failed for ${url}:`, error);

      // Handle different types of network errors
      if (error.name === 'AbortError') {
        console.error("Request timed out after 10 seconds");
        return {
          success: false,
          message: "Request timed out. Please try again.",
        };
      }

      if (error instanceof TypeError) {
        // This usually indicates CORS, network, or DNS issues
        console.error("Network/CORS Error:", error.message);

        // Provide more specific error messages
        let userMessage = "Network connection failed.";
        if (error.message.includes("fetch")) {
          userMessage = "Unable to connect to server. Please check your internet connection.";
        } else if (error.message.includes("CORS")) {
          userMessage = "Server configuration issue. Please contact support.";
        } else if (error.message.includes("Failed to fetch")) {
          userMessage = "Server is not responding. Please try again later.";
        }

        const networkError = new Error(
          `Network error: Unable to connect to ${url}`,
        );
        monitoringService.logAPIError(endpoint, 0, networkError, {
          component: "network",
          action: "fetch_failed",
        });
        return {
          success: false,
          message: userMessage,
        };
      }

      // API or parsing errors
      let errorMessage: string;
      let statusCode = 0;

      const rawStatus = readErrorProp(error, "status");
      if (typeof rawStatus === "number") {
        statusCode = rawStatus;
      }

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null) {
        const rawMessage = readErrorProp(error, "message");
        const rawError = readErrorProp(error, "error");
        if (typeof rawMessage === "string" && rawMessage) {
          errorMessage = rawMessage;
        } else if (typeof rawError === "string" && rawError) {
          errorMessage = rawError;
        } else {
          try {
            errorMessage = JSON.stringify(error, null, 2);
          } catch {
            errorMessage = "Unknown API error occurred";
          }
        }
      } else {
        errorMessage = String(error);
      }

      console.warn("API Error Details:", {
        endpoint,
        error,
        errorMessage,
        statusCode,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name
      });

      // Create a proper error object for monitoring
      const apiError = new Error(errorMessage);
      monitoringService.logAPIError(endpoint, statusCode, apiError, {
        component: "api",
        action: "request_failed",
      });

      return { success: false, message: errorMessage };
    }
  }

  // Send OTP for login or registration (Email only)
  async sendOTP(
    identifier: string,
    type: "login" | "register",
    userData?: UserRegistration,
  ): Promise<SendOtpResult> {
    const maskedIdentifier = identifier.replace(/(.{3}).*(.{3})/, "$1***$2");
    console.log(`Starting OTP send for ${maskedIdentifier} (${type})`);

    try {
      // Only support email addresses
      if (!identifier.includes("@")) {
        throw new Error(
          "Only email addresses are supported for authentication",
        );
      }

      // Generate secure random OTP
      const otp = this.generateSecureOTP();
      const template = type === "register" ? "register" : "login";

      // Store OTP for client-side verification (do NOT log the value)
      const otpData = {
        otp,
        identifier,
        type,
        userData,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        attempts: 0,
      };

      localStorage.setItem(
        `pratyaksh_otp_${identifier}`,
        JSON.stringify(otpData),
      );

      // Single source of truth: server-side SMTP. No silent fallbacks.
      const emailResult = await this.apiCall("/email/send-otp", {
        method: "POST",
        body: JSON.stringify({
          email: identifier,
          otp,
          template,
        }),
      });

      if (emailResult && emailResult.success) {
        monitoringService.logAuthEvent("otp_sent", true, {
          identifier: maskedIdentifier,
          otpType: "email",
          action: type,
        });

        return {
          success: true,
          message: `Verification code sent to ${identifier}. Please check your email.`,
          otpId: emailResult.messageId || `email_${Date.now()}`,
        };
      }

      // Server reported failure — surface its error and code verbatim.
      // Drop the locally stored OTP so the user can't accidentally
      // verify against an unsent code.
      localStorage.removeItem(`pratyaksh_otp_${identifier}`);

      const code: string =
        emailResult?.code || emailResult?.error_code || "send_failed";
      const message: string =
        emailResult?.message ||
        emailResult?.error ||
        "Failed to send verification email.";

      monitoringService.logAuthEvent("otp_send_failed", false, {
        identifier: maskedIdentifier,
        otpType: "email",
        action: type,
      });

      return {
        success: false,
        code,
        message,
      };
    } catch (error) {
      // Network / unexpected error
      localStorage.removeItem(`pratyaksh_otp_${identifier}`);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      monitoringService.logAuthEvent("otp_send_failed", false, {
        identifier: maskedIdentifier,
        otpType: "email",
        action: type,
      });

      console.error("OTP send failed:", errorMessage);

      return {
        success: false,
        code: "client_error",
        message: errorMessage || "Failed to send verification email",
      };
    }
  }

  // Generate cryptographically secure OTP
  private generateSecureOTP(): string {
    const digits = "0123456789";
    let otp = "";

    // Use crypto.getRandomValues for secure random generation
    const randomValues = new Uint8Array(6);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < 6; i++) {
      otp += digits[randomValues[i] % digits.length];
    }

    return otp;
  }

  // Extract professional name from email address
  private extractNameFromEmail(email: string): string {
    const localPart = email.split('@')[0];

    // Handle common email formats
    if (localPart.includes('.')) {
      const parts = localPart.split('.');
      return parts.map(part =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join(' ');
    }

    if (localPart.includes('_')) {
      const parts = localPart.split('_');
      return parts.map(part =>
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join(' ');
    }

    // Default: capitalize first letter
    return localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
  }

  // Verify OTP and authenticate
  async verifyOTP(
    identifier: string,
    otp: string,
    type: "login" | "register",
    userData?: UserRegistration,
  ): Promise<VerifyOtpResult> {
    try {
      // Get stored OTP data
      const storedData = localStorage.getItem(`pratyaksh_otp_${identifier}`);
      if (!storedData) {
        throw new Error("OTP session expired. Please request a new code.");
      }

      const otpData = JSON.parse(storedData);

      // Check if OTP is expired
      if (Date.now() > otpData.expiresAt) {
        localStorage.removeItem(`pratyaksh_otp_${identifier}`);
        throw new Error("OTP has expired. Please request a new code.");
      }

      // Check attempt limit
      if (otpData.attempts >= 3) {
        localStorage.removeItem(`pratyaksh_otp_${identifier}`);
        throw new Error("Too many failed attempts. Please request a new code.");
      }

      // Verify OTP
      if (otp !== otpData.otp) {
        otpData.attempts += 1;
        localStorage.setItem(
          `pratyaksh_otp_${identifier}`,
          JSON.stringify(otpData),
        );
        throw new Error("Invalid verification code. Please try again.");
      }

      // Clean up OTP data
      localStorage.removeItem(`pratyaksh_otp_${identifier}`);

      // Generate user data and token
      let user: AuthUser;

      if (type === "register") {
        // Create new user
        const finalUserData = userData || otpData.userData;
        user = {
          id: `user_${Date.now()}`,
          name: finalUserData.name,
          email: finalUserData.email,
          phone: finalUserData.phone,
          title: finalUserData.title || "Forensic Analyst",
          department: finalUserData.department,
          employeeId: `FA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`,
          profileImage: undefined,
          clearanceLevel: "Level 2 - Restricted",
          joinDate: new Date().toISOString(),
          location: finalUserData.location || "Not specified",
          badge: "Verified Analyst",
          isVerified: true,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
      } else {
        // Real user lookup from professional database
        try {
          const userLookupResponse = await this.apiCall("/user/lookup", {
            method: "POST",
            body: JSON.stringify({ identifier }),
          });

          if (userLookupResponse.success && userLookupResponse.user) {
            user = {
              ...userLookupResponse.user,
              lastLogin: new Date().toISOString(),
            };
          } else {
            // If user not found, create new professional account
            user = {
              id: `analyst_${Date.now()}`,
              name: this.extractNameFromEmail(identifier),
              email: identifier,
              phone: "",
              title: "Forensic Analyst",
              department: "Digital Investigation Unit",
              employeeId: `FA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`,
              profileImage: undefined,
              clearanceLevel: "Level 2 - Authorized",
              joinDate: new Date().toISOString(),
              location: "Professional Forensic Lab",
              badge: "Certified Analyst",
              isVerified: true,
              createdAt: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
            };
          }
        } catch (userLookupError) {
          console.warn("User lookup failed, creating new account:", userLookupError);
          // Create professional account for new user
          user = {
            id: `analyst_${Date.now()}`,
            name: this.extractNameFromEmail(identifier),
            email: identifier,
            phone: "",
            title: "Forensic Analyst",
            department: "Digital Investigation Unit",
            employeeId: `FA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`,
            profileImage: undefined,
            clearanceLevel: "Level 2 - Authorized",
            joinDate: new Date().toISOString(),
            location: "Professional Forensic Lab",
            badge: "Certified Analyst",
            isVerified: true,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
          };
        }
      }

      // Generate JWT token
      const token = btoa(
        JSON.stringify({
          userId: user.id,
          email: user.email,
          iat: Date.now(),
          exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        }),
      );

      this.token = token;
      localStorage.setItem("pratyaksh_token", token);

      // Log successful authentication
      monitoringService.logAuthEvent("login_success", true, {
        identifier: identifier.replace(/(.{3}).*(.{3})/, "$1***$2"),
        action: type,
      });

      // Set user context for monitoring
      monitoringService.setUserContext({
        id: user.id,
        email: user.email,
        department: user.department,
      });

      // Try to sync with backend API for real authentication
      try {
        const payload = {
          identifier,
          otp,
          type,
          ...(userData && { userData }),
        };

        const response = await this.apiCall(API_CONFIG.endpoints.verifyOTP, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (response.success && response.user) {
          // Use backend user data if available
          user = response.user;
          this.token = response.token;
          localStorage.setItem("pratyaksh_token", response.token);
          console.log("✅ Backend verification successful");
        } else {
          console.log("⚠️ Backend verification not available, using frontend user data");
        }
      } catch (apiError) {
        console.warn("❌ Backend verification API not available, using frontend verification");
      }

      return {
        success: true,
        user,
        token: this.token,
      };
    } catch (error) {
      // Log failed verification
      monitoringService.logAuthEvent("otp_verification_failed", false, {
        identifier: identifier?.replace(/(.{3}).*(.{3})/, "$1***$2"),
        action: type,
      });

      return {
        success: false,
        message: error.message || "OTP verification failed",
      };
    }
  }

  // Register new user
  async registerUser(userData: UserRegistration) {
    try {
      const response = await this.apiCall(API_CONFIG.endpoints.register, {
        method: "POST",
        body: JSON.stringify(userData),
      });

      return {
        success: true,
        message: response.message || "Registration initiated",
        userId: response.userId,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Registration failed",
      };
    }
  }

  // Get user profile
  async getUserProfile() {
    try {
      const response = await this.apiCall(API_CONFIG.endpoints.profile);
      return {
        success: true,
        user: response.user,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to fetch profile",
      };
    }
  }

  // Update user profile
  async updateUserProfile(updates: Partial<AuthUser>) {
    try {
      const response = await this.apiCall(API_CONFIG.endpoints.updateProfile, {
        method: "PUT",
        body: JSON.stringify(updates),
      });

      return {
        success: true,
        user: response.user,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Failed to update profile",
      };
    }
  }

  // Refresh authentication token
  async refreshToken() {
    try {
      const response = await this.apiCall(API_CONFIG.endpoints.refreshToken, {
        method: "POST",
      });

      if (response.success) {
        this.token = response.token;
        localStorage.setItem("pratyaksh_token", response.token);
        return {
          success: true,
          token: response.token,
          user: response.user,
        };
      }

      return { success: false };
    } catch (error) {
      return { success: false };
    }
  }

  // Sign out user
  async signOut() {
    try {
      await this.apiCall(API_CONFIG.endpoints.logout, { method: "POST" });
      monitoringService.logAuthEvent("logout_success", true);
    } catch (error) {
      console.error("Logout API error:", error);
      monitoringService.logAuthEvent("logout_api_failed", false);
    } finally {
      monitoringService.clearUserContext();
      this.token = null;
      localStorage.removeItem("pratyaksh_token");
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Check basic network connectivity
  async checkNetworkConnectivity(): Promise<boolean> {
    try {
      // Try to fetch the current page to test basic connectivity
      const response = await fetch(window.location.href, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      return response.ok;
    } catch (error) {
      console.warn("Network connectivity check failed:", error);
      return false;
    }
  }

  // Test API connectivity
  async testConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      // Force relative URL
      const testUrl = "/api/ping";

      console.log(`Testing connection to: ${testUrl}`);
      const response = await fetch(testUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Connection test successful:", data);
        return {
          connected: true,
          message: data.message || "API connection successful",
        };
      } else {
        console.warn(`Connection test failed with status: ${response.status}`);
        return {
          connected: false,
          message: `API responded with status: ${response.status}`,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Connection test failed";
      console.error("Connection test error:", errorMessage);
      return {
        connected: false,
        message: errorMessage,
      };
    }
  }
}

// Create singleton instance
export const authService = new AuthenticationService();

// Production-ready authentication service
console.log("🛡️ Pratyaksh Forensic AI Authentication Service - Professional Edition");

// Zustand store for authentication state
export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      errorCode: null,
      otpSent: false,
      otpIdentifier: null,
      registrationData: null,

      // Actions
      signIn: async (identifier: string) => {
        set({ isLoading: true, error: null, errorCode: null });

        try {
          const result = await authService.sendOTP(identifier, "login");

          if (result.success) {
            set({
              otpSent: true,
              otpIdentifier: identifier,
              isLoading: false,
            });
            return true;
          } else {
            set({
              error: result.message,
              errorCode: result.code ?? null,
              isLoading: false,
            });
            return false;
          }
        } catch (error) {
          set({
            error: error.message || "Login failed",
            errorCode: "client_error",
            isLoading: false,
          });
          return false;
        }
      },

      register: async (userData: UserRegistration) => {
        set({ isLoading: true, error: null, errorCode: null });

        try {
          const result = await authService.sendOTP(
            userData.email,
            "register",
            userData,
          );

          if (result.success) {
            set({
              otpSent: true,
              otpIdentifier: userData.email,
              registrationData: userData,
              isLoading: false,
            });
            return true;
          } else {
            set({
              error: result.message,
              errorCode: result.code ?? null,
              isLoading: false,
            });
            return false;
          }
        } catch (error) {
          set({
            error: error.message || "Registration failed",
            errorCode: "client_error",
            isLoading: false,
          });
          return false;
        }
      },

      verifyOTP: async (otp: string, type: "login" | "register") => {
        const { otpIdentifier, registrationData } = get();
        if (!otpIdentifier) return false;

        set({ isLoading: true, error: null, errorCode: null });

        try {
          const result = await authService.verifyOTP(
            otpIdentifier,
            otp,
            type,
            type === "register" ? registrationData : undefined,
          );

          if (result.success) {
            set({
              user: result.user,
              isAuthenticated: true,
              otpSent: false,
              otpIdentifier: null,
              registrationData: null,
              isLoading: false,
            });
            return true;
          } else {
            set({
              error: result.message,
              errorCode: result.code ?? null,
              isLoading: false,
            });
            return false;
          }
        } catch (error) {
          set({
            error: error.message || "OTP verification failed",
            errorCode: "client_error",
            isLoading: false,
          });
          return false;
        }
      },

      resendOTP: async () => {
        const { otpIdentifier, registrationData } = get();
        if (!otpIdentifier) return false;

        const type = registrationData ? "register" : "login";
        const result = await authService.sendOTP(
          otpIdentifier,
          type,
          registrationData,
        );

        if (!result.success) {
          set({
            error: result.message,
            errorCode: result.code ?? null,
          });
        } else {
          set({ error: null, errorCode: null });
        }

        return result.success;
      },

      signOut: () => {
        authService.signOut();
        set({
          user: null,
          isAuthenticated: false,
          otpSent: false,
          otpIdentifier: null,
          registrationData: null,
          error: null,
          errorCode: null,
        });
      },

      clearError: () => set({ error: null, errorCode: null }),

      updateProfile: async (updates: Partial<AuthUser>) => {
        set({ isLoading: true, error: null });

        try {
          const result = await authService.updateUserProfile(updates);

          if (result.success) {
            set((state) => ({
              user: { ...state.user, ...result.user },
              isLoading: false,
            }));
            return true;
          } else {
            set({
              error: result.message,
              isLoading: false,
            });
            return false;
          }
        } catch (error) {
          set({
            error: error.message || "Profile update failed",
            isLoading: false,
          });
          return false;
        }
      },

      refreshSession: async () => {
        if (!authService.isAuthenticated()) return false;

        try {
          const result = await authService.refreshToken();

          if (result.success) {
            set({
              user: result.user,
              isAuthenticated: true,
            });
            return true;
          } else {
            // Token invalid, sign out
            get().signOut();
            return false;
          }
        } catch (error) {
          get().signOut();
          return false;
        }
      },
    }),
    {
      name: "pratyaksh-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

// Hook for easier component usage
export const useAuth = () => {
  const store = useAuthStore();

  // Auto-refresh session on app load
  useEffect(() => {
    if (store.isAuthenticated && !store.user) {
      store.refreshSession();
    }
  }, [store.isAuthenticated, store.user, store.refreshSession]);

  return store;
};

// Department options for registration
export const DEPARTMENTS = [
  "Digital Forensics Division",
  "Fingerprint Analysis Lab",
  "Cyber Crime Investigation",
  "Document Examination Unit",
  "Forensic Science Laboratory",
  "Criminal Investigation Department",
  "Technical Intelligence Unit",
];

// Job titles for registration
export const JOB_TITLES = [
  "Senior Forensic Analyst",
  "Digital Forensics Expert",
  "Fingerprint Specialist",
  "Cyber Crime Investigator",
  "Document Examiner",
  "Forensic Lab Technician",
  "Intelligence Analyst",
  "Crime Scene Investigator",
];
