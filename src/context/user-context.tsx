"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { setCurrentUser, clearCurrentUser } from "@/lib/user";

interface AuthUser {
  id: string;
  name: string;
  color: string;
  isAdmin?: boolean;
  investmentProfile?: string | null;
}

interface UserContextType {
  userId: string | null;
  user: AuthUser | null;
  isAdmin: boolean;
  investmentProfile: string | null;
  setProfile: (profile: string) => void;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  selectUser: (id: string) => void;
  switchUser: () => void;
}

const UserContext = createContext<UserContextType>({
  userId: null,
  user: null,
  isAdmin: false,
  investmentProfile: null,
  setProfile: () => {},
  login: () => {},
  logout: async () => {},
  selectUser: () => {},
  switchUser: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setCurrentUser(data.user.id);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  function login(u: AuthUser) {
    setUser(u);
    setCurrentUser(u.id);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearCurrentUser();
    setUser(null);
  }

  async function setProfile(profile: string) {
    await fetch("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });
    setUser((prev) => prev ? { ...prev, investmentProfile: profile } : prev);
  }

  if (!ready) return null;

  return (
    <UserContext.Provider value={{
      userId: user?.id ?? null,
      user,
      isAdmin: user?.isAdmin ?? false,
      investmentProfile: user?.investmentProfile ?? null,
      setProfile,
      login,
      logout,
      selectUser: (id) => setCurrentUser(id),
      switchUser: () => { logout(); },
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
