// Authentication service for Pratyaksh

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "investigator" | "analyst";
  department?: string;
  avatar?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

class AuthService {
  private user: User | null = null;
  private listeners: ((user: User | null) => void)[] = [];

  constructor() {
    // Check for stored user session
    const stored = localStorage.getItem("pratyaksh_user");
    if (stored) {
      try {
        this.user = JSON.parse(stored);
      } catch (e) {
        localStorage.removeItem("pratyaksh_user");
      }
    }
  }

  async signIn(
    email: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Production authentication requires proper backend integration
    const user = null;

    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      this.user = userWithoutPassword;
      localStorage.setItem(
        "pratyaksh_user",
        JSON.stringify(userWithoutPassword),
      );
      this.notifyListeners();
      return { success: true };
    } else {
      return { success: false, error: "Invalid email or password" };
    }
  }

  async signOut(): Promise<void> {
    this.user = null;
    localStorage.removeItem("pratyaksh_user");
    this.notifyListeners();
  }

  getCurrentUser(): User | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.user !== null;
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((callback) => callback(this.user));
  }
}

export const authService = new AuthService();

// React hook for using auth in components
import { useState, useEffect } from "react";

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((newUser) => {
      setUser(newUser);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  return {
    user,
    isAuthenticated: user !== null,
    isLoading,
  };
}
