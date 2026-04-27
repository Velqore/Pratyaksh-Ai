import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ForensicAssistant } from "@/components/ui/forensic-assistant";
import {
  ArrowLeft,
  User,
  Settings,
  FileText,
  BarChart3,
  Shield,
  Clock,
  Award,
  Download,
  Eye,
  Fingerprint,
  Monitor,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Edit,
  Key,
  Bell,
  Activity,
  TrendingUp,
  Users,
  Database,
} from "lucide-react";

export default function UserDashboard() {
  const { user, isAuthenticated, signOut, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [editingProfile, setEditingProfile] = useState(false);

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated]);

  // Use real user data or fallback
  const userData = user ? {
    name: user.name,
    title: user.title,
    department: user.department,
    employeeId: user.employeeId,
    email: user.email,
    phone: user.phone,
    location: user.location,
    joinDate: new Date(user.joinDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    clearanceLevel: user.clearanceLevel,
    badge: user.badge || "Verified Analyst",
    profileImage: user.profileImage || "/placeholder.svg"
  } : {
    name: "Loading...",
    title: "Loading...",
    department: "Loading...",
    employeeId: "Loading...",
    email: "Loading...",
    phone: "Loading...",
    location: "Loading...",
    joinDate: "Loading...",
    clearanceLevel: "Loading...",
    badge: "Loading...",
    profileImage: "/placeholder.svg"
  };

  // Handle profile update
  const handleProfileUpdate = async (updates: any) => {
    const success = await updateProfile(updates);
    if (success) {
      setEditingProfile(false);
    }
  };

  const caseStats = {
    totalCases: 247,
    activeCases: 12,
    completedThisMonth: 18,
    accuracy: 98.7,
    specializations: [
      "Fingerprint Analysis",
      "Cyber Forensics",
      "Digital Evidence",
    ],
  };

  const recentCases = [
    {
      id: "FP-2024-089",
      type: "Fingerprint",
      status: "Completed",
      accuracy: 99.2,
      date: "2024-01-15",
    },
    {
      id: "CY-2024-156",
      type: "Cyber",
      status: "In Progress",
      accuracy: 97.8,
      date: "2024-01-14",
    },
    {
      id: "FP-2024-087",
      type: "Fingerprint",
      status: "Completed",
      accuracy: 98.9,
      date: "2024-01-13",
    },
    {
      id: "CY-2024-154",
      type: "Cyber",
      status: "Under Review",
      accuracy: 96.5,
      date: "2024-01-12",
    },
    {
      id: "FP-2024-085",
      type: "Fingerprint",
      status: "Completed",
      accuracy: 99.7,
      date: "2024-01-11",
    },
  ];

  const certifications = [
    {
      name: "Certified Forensic Computer Examiner (CFCE)",
      issued: "2023",
      expires: "2026",
    },
    { name: "Advanced Fingerprint Analysis", issued: "2022", expires: "2025" },
    { name: "Digital Evidence Specialist", issued: "2023", expires: "2026" },
    { name: "Cybersecurity Forensics Expert", issued: "2024", expires: "2027" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Console
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-600/20">
                  <User className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">
                    User Dashboard
                  </h1>
                  <p className="text-sm text-gray-400">
                    Profile & Account Management
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="secondary"
                className="bg-cyan-600/20 text-cyan-300"
              >
                {userData.clearanceLevel}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-green-600/20 text-green-300"
              >
                Active
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="text-center">
                <Avatar className="w-24 h-24 mx-auto mb-4">
                  <AvatarImage src={userData.profileImage} />
                  <AvatarFallback className="bg-cyan-600/20 text-cyan-300 text-2xl">
                    {userData.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-white">{userData.name}</CardTitle>
                <p className="text-cyan-400 text-sm">{userData.title}</p>
                <p className="text-gray-400 text-xs">{userData.department}</p>
                <Badge className="mt-2 bg-orange-600/20 text-orange-300">
                  {userData.badge}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>{userData.employeeId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    <span className="truncate">{userData.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Phone className="w-4 h-4 text-cyan-400" />
                    <span>{userData.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <span>{userData.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span>Joined {userData.joinDate}</span>
                  </div>
                </div>
                <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-5 bg-gray-800 border-gray-700">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:bg-cyan-600"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="cases"
                  className="data-[state=active]:bg-cyan-600"
                >
                  Cases
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="data-[state=active]:bg-cyan-600"
                >
                  Analytics
                </TabsTrigger>
                <TabsTrigger
                  value="certifications"
                  className="data-[state=active]:bg-cyan-600"
                >
                  Certifications
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="data-[state=active]:bg-cyan-600"
                >
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Total Cases</p>
                          <p className="text-2xl font-bold text-white">
                            {caseStats.totalCases}
                          </p>
                        </div>
                        <FileText className="w-8 h-8 text-cyan-400" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Active Cases</p>
                          <p className="text-2xl font-bold text-orange-400">
                            {caseStats.activeCases}
                          </p>
                        </div>
                        <Activity className="w-8 h-8 text-orange-400" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">This Month</p>
                          <p className="text-2xl font-bold text-green-400">
                            {caseStats.completedThisMonth}
                          </p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-green-400" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-sm">Accuracy</p>
                          <p className="text-2xl font-bold text-cyan-400">
                            {caseStats.accuracy}%
                          </p>
                        </div>
                        <Award className="w-8 h-8 text-cyan-400" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Specializations */}
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Award className="w-5 h-5 text-cyan-400" />
                      Specializations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {caseStats.specializations.map((spec, index) => (
                        <Badge
                          key={index}
                          className="bg-cyan-600/20 text-cyan-300"
                        >
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Clock className="w-5 h-5 text-cyan-400" />
                      Recent Cases
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {recentCases.slice(0, 3).map((case_, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {case_.type === "Fingerprint" ? (
                              <Fingerprint className="w-5 h-5 text-cyan-400" />
                            ) : (
                              <Monitor className="w-5 h-5 text-purple-400" />
                            )}
                            <div>
                              <p className="text-white font-medium">
                                {case_.id}
                              </p>
                              <p className="text-gray-400 text-sm">
                                {case_.date}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge
                              className={
                                case_.status === "Completed"
                                  ? "bg-green-600/20 text-green-300"
                                  : case_.status === "In Progress"
                                    ? "bg-orange-600/20 text-orange-300"
                                    : "bg-blue-600/20 text-blue-300"
                              }
                            >
                              {case_.status}
                            </Badge>
                            <p className="text-gray-400 text-sm mt-1">
                              {case_.accuracy}% accuracy
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cases" className="space-y-6 mt-6">
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle className="text-white">Case History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentCases.map((case_, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            {case_.type === "Fingerprint" ? (
                              <div className="p-2 bg-cyan-600/20 rounded-lg">
                                <Fingerprint className="w-5 h-5 text-cyan-400" />
                              </div>
                            ) : (
                              <div className="p-2 bg-purple-600/20 rounded-lg">
                                <Monitor className="w-5 h-5 text-purple-400" />
                              </div>
                            )}
                            <div>
                              <p className="text-white font-medium">
                                {case_.id}
                              </p>
                              <p className="text-gray-400 text-sm">
                                {case_.type} Analysis
                              </p>
                              <p className="text-gray-500 text-xs">
                                {case_.date}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge
                              className={
                                case_.status === "Completed"
                                  ? "bg-green-600/20 text-green-300"
                                  : case_.status === "In Progress"
                                    ? "bg-orange-600/20 text-orange-300"
                                    : "bg-blue-600/20 text-blue-300"
                              }
                            >
                              {case_.status}
                            </Badge>
                            <p className="text-gray-400 text-sm mt-1">
                              {case_.accuracy}% accuracy
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 text-cyan-400 hover:text-cyan-300"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Performance Trends
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">
                              Fingerprint Analysis
                            </span>
                            <span className="text-cyan-400">98.9%</span>
                          </div>
                          <Progress value={98.9} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">
                              Cyber Forensics
                            </span>
                            <span className="text-purple-400">97.2%</span>
                          </div>
                          <Progress value={97.2} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-400">
                              Report Quality
                            </span>
                            <span className="text-green-400">99.5%</span>
                          </div>
                          <Progress value={99.5} className="h-2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Case Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">
                            Fingerprint Cases
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-2 bg-cyan-600 rounded"></div>
                            <span className="text-white">65%</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Cyber Cases</span>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-2 bg-purple-600 rounded"></div>
                            <span className="text-white">35%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="certifications" className="space-y-6 mt-6">
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Professional Certifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {certifications.map((cert, index) => (
                        <div key={index} className="p-4 bg-gray-800 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-white font-medium mb-2">
                                {cert.name}
                              </h3>
                              <div className="space-y-1 text-sm">
                                <p className="text-gray-400">
                                  Issued: {cert.issued}
                                </p>
                                <p className="text-gray-400">
                                  Expires: {cert.expires}
                                </p>
                              </div>
                            </div>
                            <Award className="w-6 h-6 text-cyan-400" />
                          </div>
                          <Badge className="mt-3 bg-green-600/20 text-green-300">
                            Valid
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Account Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-gray-400">Display Name</Label>
                        <Input
                          defaultValue={userData.name}
                          className="mt-1 bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400">Email</Label>
                        <Input
                          defaultValue={userData.email}
                          className="mt-1 bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-400">Phone</Label>
                        <Input
                          defaultValue={userData.phone}
                          className="mt-1 bg-gray-800 border-gray-700 text-white"
                        />
                      </div>
                      <Button
                        className="w-full bg-cyan-600 hover:bg-cyan-700"
                        onClick={() => handleProfileUpdate({
                          name: (document.getElementById('name') as HTMLInputElement)?.value,
                          email: (document.getElementById('email') as HTMLInputElement)?.value,
                          phone: (document.getElementById('phone') as HTMLInputElement)?.value
                        })}
                      >
                        Update Profile
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-900 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">Security</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button
                        variant="outline"
                        className="w-full border-gray-700 text-white hover:bg-gray-800"
                      >
                        <Key className="w-4 h-4 mr-2" />
                        Change Password
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-gray-700 text-white hover:bg-gray-800"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Two-Factor Authentication
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-gray-700 text-white hover:bg-gray-800"
                      >
                        <Bell className="w-4 h-4 mr-2" />
                        Notification Settings
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-gray-700 text-white hover:bg-gray-800"
                      >
                        <Database className="w-4 h-4 mr-2" />
                        Export Data
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <ForensicAssistant lab="general" title="Pratyaksh Assistant" />
    </div>
  );
}
