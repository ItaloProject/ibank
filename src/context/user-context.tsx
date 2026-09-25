"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { setCurrentUser, clearCurrentUser } from "@/lib/user";
import { SplashScreen } from "@/components/splash-screen";

interface AuthUser {
  id: string;
  name: string;
  color: string;
  isAdmin?: boolean;
  investmentProfile?: string | null;
  carteiraVista?: boolean;
  botEnabled?: boolean;
  subscriptionActive?: boolean;
  paidUntil?: string | null;
  plan?: string | null;
}

interface UserContextType {
  userId: string | null;
  user: AuthUser | null;
  isAdmin: boolean;
  investmentProfile: string | null;
  carteiraVista: boolean;
  botEnabled: boolean;
  subscriptionActive: boolean;
  setProfile: (profile: string) => void;
  markCarteiraVista: () => Promise<void>;
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
  carteiraVista: false,
  botEnabled: false,
  subscriptionActive: true,
  setProfile: () => {},
  markCarteiraVista: async () => {},
  login: () => {},
  logout: async () => {},
  selectUser: () => {},
  switchUser: () => {},
});

const SPLASH_MIN_MS = 2500;

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const start = Date.now();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setCurrentUser(data.user.id);
        }
      })
      .catch(() => {})
      .finally(() => {
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
        setTimeout(() => setReady(true), remaining);
      });
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
    setUser((prev) =>
      prev
        ? { ...prev, investmentProfile: profile, carteiraVista: prev.investmentProfile === profile && prev.carteiraVista }
        : prev,
    );
  }

  async function markCarteiraVista() {
    setUser((prev) => (prev ? { ...prev, carteiraVista: true } : prev));
    try {
      await fetch("/api/auth/carteira-vista", { method: "POST" });
    } catch {
      // A tela volta no próximo acesso se a gravação falhar
    }
  }

  if (!ready) return <SplashScreen />;

  return (
    <UserContext.Provider
      value={{
        userId: user?.id ?? null,
        user,
        isAdmin: user?.isAdmin ?? false,
        investmentProfile: user?.investmentProfile ?? null,
        carteiraVista: user?.carteiraVista ?? false,
        botEnabled: user?.botEnabled ?? false,
        subscriptionActive: user?.subscriptionActive !== false,
        setProfile,
        markCarteiraVista,
        login,
        logout,
        selectUser: (id) => setCurrentUser(id),
        switchUser: () => {
          void logout();
        },
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
