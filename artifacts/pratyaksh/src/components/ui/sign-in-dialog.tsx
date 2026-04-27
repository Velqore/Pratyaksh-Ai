import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PratyakshLogo } from "@/components/ui/pratyaksh-logo";
import { authService } from "@/lib/auth";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  AlertCircle,
  Shield,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SignInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SignInDialog({
  isOpen,
  onClose,
  onSuccess,
}: SignInDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // OTP countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [countdown]);

  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const sendOTP = async () => {
    const otpCode = generateOTP();
    // Production OTP sending requires proper backend integration
    console.log(`OTP service not configured for production use`);
    setError(
      "OTP service is not configured. Please contact system administrator.",
    );
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // All accounts require proper authentication
    try {
      // Simulate credential validation
      if (email && password) {
        await sendOTP();
        setStep("otp");
      } else {
        setError("Please enter valid credentials");
      }
    } catch (error) {
      setError("Failed to send OTP. Please try again.");
    }

    setIsLoading(false);
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Production OTP verification requires proper backend integration
      setError(
        "OTP verification service is not configured. Please contact system administrator.",
      );
    } catch (error) {
      setError("Failed to verify OTP. Please try again.");
    }

    setIsLoading(false);
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    await sendOTP();
  };

  const handleBack = () => {
    setStep("credentials");
    setOtp("");
    setOtpSent(false);
    setCountdown(0);
    setError("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-900/95 border-white/10 backdrop-blur-xl">
        <CardHeader className="text-center">
          <div className="mb-4">
            <PratyakshLogo size="lg" className="justify-center" />
          </div>
          <CardTitle className="text-2xl text-white">
            {step === "credentials" ? "Welcome Back" : "Verify OTP"}
          </CardTitle>
          <p className="text-gray-400">
            {step === "credentials"
              ? "Sign in to access Pratyaksh Forensic AI"
              : `Enter the 6-digit code sent to ${email}`}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === "credentials" ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="pl-10 bg-gray-800/50 border-white/10 text-white placeholder-gray-400"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pl-10 pr-10 bg-gray-800/50 border-white/10 text-white placeholder-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 text-sm">{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white border-0"
              >
                {isLoading ? "Verifying..." : "Continue"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOTPSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-gray-300">
                  Verification Code
                </Label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="Enter 6-digit code"
                    className="pl-10 bg-gray-800/50 border-white/10 text-white placeholder-gray-400 text-center text-lg tracking-widest"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 text-sm">{error}</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleBack}
                  variant="outline"
                  className="flex-1 border-white/10 text-gray-300 hover:bg-white/5"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white border-0"
                >
                  {isLoading ? "Verifying..." : "Verify"}
                </Button>
              </div>

              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResendOTP}
                  disabled={countdown > 0}
                  className="text-gray-400 hover:text-white"
                >
                  {countdown > 0 ? (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Resend in {countdown}s
                    </span>
                  ) : (
                    "Resend OTP"
                  )}
                </Button>
              </div>
            </form>
          )}

          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              Cancel
            </Button>
          </div>

          {step === "otp" && (
            <div className="text-xs text-gray-500 text-center mt-4">
              <Shield className="w-4 h-4 inline mr-1" />
              OTP provides additional security for your forensic analysis
              account
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
