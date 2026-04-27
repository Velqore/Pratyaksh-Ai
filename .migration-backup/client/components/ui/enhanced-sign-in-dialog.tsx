import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth, DEPARTMENTS, JOB_TITLES, UserRegistration } from "@/lib/auth-service";
import { PratyakshLogo } from "@/components/ui/pratyaksh-logo";
import {
  Shield,
  Phone,
  Mail,
  User,
  Building,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Smartphone,
} from "lucide-react";

interface EnhancedSignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EnhancedSignInDialog({ 
  open, 
  onOpenChange, 
  onSuccess 
}: EnhancedSignInDialogProps) {
  const {
    signIn,
    register,
    verifyOTP,
    resendOTP,
    isLoading,
    error,
    otpSent,
    clearError,
    registrationData
  } = useAuth();

  // Form states
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  
  // Registration form state
  const [regForm, setRegForm] = useState<UserRegistration>({
    name: "",
    email: "",
    phone: "",
    department: "",
    title: "",
    location: ""
  });

  // OTP input refs
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Auto-move to OTP step when OTP is sent
  useEffect(() => {
    if (otpSent) {
      setStep("otp");
      setResendTimer(30);
    }
  }, [otpSent]);

  // Resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Clear error when switching tabs or steps
  useEffect(() => {
    clearError();
  }, [activeTab, step]);

  // Handle form submission for credentials
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (activeTab === "login") {
      const success = await signIn(identifier);
      if (success) {
        setStep("otp");
      }
    } else {
      // Validate registration form
      if (!regForm.name || !regForm.email || !regForm.phone || !regForm.department) {
        return;
      }
      
      const success = await register(regForm);
      if (success) {
        setStep("otp");
      }
    }
  };

  // Handle OTP submission
  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (otp.length === 6) {
      const success = await verifyOTP(otp, activeTab);
      if (success) {
        onOpenChange(false);
        onSuccess?.();
        // Reset form
        setStep("credentials");
        setOtp("");
        setIdentifier("");
        setRegForm({
          name: "",
          email: "",
          phone: "",
          department: "",
          title: "",
          location: ""
        });
      }
    }
  };

  // Handle OTP input with auto-focus
  const handleOTPChange = (index: number, value: string) => {
    if (value.length > 1) return; // Prevent multiple characters
    
    const newOTP = otp.split("");
    newOTP[index] = value;
    setOtp(newOTP.join(""));

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  };

  // Handle OTP backspace
  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  // Handle resend OTP
  const handleResendOTP = async () => {
    const success = await resendOTP();
    if (success) {
      setResendTimer(30);
    }
  };

  // Go back from OTP to credentials
  const handleBackToCredentials = () => {
    setStep("credentials");
    setOtp("");
    clearError();
  };

  const isEmailFormat = identifier.includes("@");
  const currentIdentifier = activeTab === "register" ? (regForm.email || regForm.phone) : identifier;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-gray-900 border-gray-700 text-white">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <PratyakshLogo size="lg" />
          </div>
          <DialogTitle className="text-2xl text-white">
            {step === "credentials" 
              ? (activeTab === "login" ? "Welcome Back" : "Join Pratyaksh")
              : "Verify Your Identity"
            }
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {step === "credentials" 
              ? (activeTab === "login" 
                  ? "Sign in to access your forensic analysis dashboard"
                  : "Create your account to start forensic investigations"
                )
              : `Enter the 6-digit code sent to ${isEmailFormat ? "email" : "phone"}`
            }
          </DialogDescription>
        </DialogHeader>

        {step === "credentials" ? (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "register")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-800">
              <TabsTrigger value="login" className="data-[state=active]:bg-cyan-600">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-cyan-600">
                Register
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-6">
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-gray-300">
                    Email or Phone Number
                  </Label>
                  <div className="relative">
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="Enter email or phone number"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white pl-10"
                      required
                    />
                    {identifier.includes("@") ? (
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    ) : (
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-cyan-600 hover:bg-cyan-700"
                  disabled={isLoading || !identifier.trim()}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4 mr-2" />
                      Send OTP
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-4 mt-6">
              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-gray-300">
                      Full Name *
                    </Label>
                    <div className="relative">
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        value={regForm.name}
                        onChange={(e) => setRegForm({...regForm, name: e.target.value})}
                        className="bg-gray-800 border-gray-600 text-white pl-10"
                        required
                      />
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-gray-300">
                      Phone Number *
                    </Label>
                    <div className="relative">
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={regForm.phone}
                        onChange={(e) => setRegForm({...regForm, phone: e.target.value})}
                        className="bg-gray-800 border-gray-600 text-white pl-10"
                        required
                      />
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">
                    Email Address *
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="john.doe@forensics.gov.in"
                      value={regForm.email}
                      onChange={(e) => setRegForm({...regForm, email: e.target.value})}
                      className="bg-gray-800 border-gray-600 text-white pl-10"
                      required
                    />
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department" className="text-gray-300">
                    Department *
                  </Label>
                  <Select value={regForm.department} onValueChange={(value) => setRegForm({...regForm, department: value})}>
                    <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                      <SelectValue placeholder="Select your department" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept} className="text-white hover:bg-gray-700">
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-gray-300">
                      Job Title
                    </Label>
                    <Select value={regForm.title} onValueChange={(value) => setRegForm({...regForm, title: value})}>
                      <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                        <SelectValue placeholder="Select title" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        {JOB_TITLES.map((title) => (
                          <SelectItem key={title} value={title} className="text-white hover:bg-gray-700">
                            {title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-gray-300">
                      Location
                    </Label>
                    <div className="relative">
                      <Input
                        id="location"
                        type="text"
                        placeholder="New Delhi, India"
                        value={regForm.location}
                        onChange={(e) => setRegForm({...regForm, location: e.target.value})}
                        className="bg-gray-800 border-gray-600 text-white pl-10"
                      />
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-cyan-600 hover:bg-cyan-700"
                  disabled={isLoading || !regForm.name || !regForm.email || !regForm.phone || !regForm.department}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Create Account
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        ) : (
          // OTP Verification Step
          <div className="space-y-6">
            <div className="text-center">
              <div className="p-3 bg-cyan-600/20 rounded-full w-16 h-16 mx-auto flex items-center justify-center mb-4">
                <Smartphone className="w-8 h-8 text-cyan-400" />
              </div>
              <p className="text-gray-300 mb-2">
                Verification code sent to:
              </p>
              <Badge variant="secondary" className="bg-gray-800 text-cyan-400">
                {currentIdentifier}
              </Badge>
            </div>

            <form onSubmit={handleOTPSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label className="text-gray-300 text-center block">
                  Enter 6-digit verification code
                </Label>
                <div className="flex gap-2 justify-center">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <Input
                      key={index}
                      ref={otpRefs[index]}
                      type="text"
                      maxLength={1}
                      value={otp[index] || ""}
                      onChange={(e) => handleOTPChange(index, e.target.value)}
                      onKeyDown={(e) => handleOTPKeyDown(index, e)}
                      className="w-12 h-12 text-center text-xl bg-gray-800 border-gray-600 text-white"
                      pattern="[0-9]"
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  type="submit" 
                  className="w-full bg-cyan-600 hover:bg-cyan-700"
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Verify & Continue
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToCredentials}
                    className="text-gray-400 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>

                  {resendTimer > 0 ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-4 h-4" />
                      Resend in {resendTimer}s
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResendOTP}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Resend OTP
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Card className="bg-red-900/20 border-red-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading Progress */}
        {isLoading && (
          <div className="space-y-2">
            <Progress value={45} className="h-1" />
            <p className="text-xs text-center text-gray-400">
              {step === "credentials" ? "Sending verification code..." : "Verifying your identity..."}
            </p>
          </div>
        )}

        {/* Security Notice */}
        <div className="text-center text-xs text-gray-500 border-t border-gray-700 pt-4">
          <Shield className="w-4 h-4 inline mr-1" />
          Your data is encrypted and secure. By continuing, you agree to our Terms of Service.
        </div>
      </DialogContent>
    </Dialog>
  );
}
