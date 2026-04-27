import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Github,
  Linkedin,
  Mail,
  Globe,
  Code,
  Coffee,
  Heart,
  ExternalLink,
} from "lucide-react";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const skills = [
    "React",
    "TypeScript",
    "Node.js",
    "Python",
    "AI/ML",
    "Forensic Analysis",
    "Computer Vision",
    "Data Science",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            About the Developer
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600 dark:text-gray-400">
            Meet the mind behind Pratyaksh Forensic AI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Developer Profile */}
          <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Profile Image */}
                <div className="relative">
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-500 p-1">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-gray-900">
                      <img
                        src="https://cdn.builder.io/api/v1/image/assets%2Fe4cf2ee49add4589ade98ad1173db6bf%2Fe7f6252ca9b84c8181715fef75c275f6?format=webp&width=800"
                        alt="Mr. Ayush Tyagi"
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const fallback =
                            target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                      <div
                        className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-2xl md:text-3xl font-bold"
                        style={{ display: "none" }}
                      >
                        AT
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center">
                    <Code className="w-4 h-4 text-white" />
                  </div>
                </div>

                {/* Developer Info */}
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Mr. Ayush Tyagi
                  </h3>
                  <p className="text-lg text-blue-600 dark:text-blue-400 mb-3">
                    AI & Forensic Systems Engineer
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Passionate developer and Forensic student specializing in
                    Cyber Forensics and AI-powered forensic analysis systems.
                    Combining cutting-edge machine learning with practical
                    forensic science to create tools that help law enforcement
                    agencies solve cases more efficiently.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Skills & Technologies */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Code className="w-5 h-5 text-blue-500" />
              Technologies & Skills
            </h4>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          {/* About the Project */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              About Pratyaksh
            </h4>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Pratyaksh is an advanced AI-powered forensic analysis system
              designed to assist law enforcement agencies with fingerprint
              analysis, cyber forensics, and document examination. The system
              leverages machine learning algorithms to provide accurate and fast
              analysis results, helping investigators solve cases more
              efficiently.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>98% Accuracy Rate</span>
              </div>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Real-time Processing</span>
              </div>
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>AI-Enhanced Analysis</span>
              </div>
            </div>
          </div>

          {/* Connect Section */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Coffee className="w-5 h-5 text-orange-500" />
              Get in Touch
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 hover:bg-gray-900 hover:text-white dark:hover:bg-gray-100 dark:hover:text-gray-900"
                onClick={() => window.open("https://github.com", "_blank")}
              >
                <Github className="w-4 h-4" />
                GitHub
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 hover:bg-blue-600 hover:text-white"
                onClick={() => window.open("https://linkedin.com", "_blank")}
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 hover:bg-green-600 hover:text-white"
                onClick={() =>
                  window.open("mailto:developer@pratyaksh.ai", "_blank")
                }
              >
                <Mail className="w-4 h-4" />
                Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 hover:bg-purple-600 hover:text-white"
                onClick={() => window.open("https://pratyaksh.ai", "_blank")}
              >
                <Globe className="w-4 h-4" />
                Website
              </Button>
            </div>
          </div>

          {/* Version Info */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Pratyaksh Forensic AI v1.0.0</span>
              <span>Built with ❤️ for forensic professionals</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
