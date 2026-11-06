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
  needsRiskQuiz?: boolean;
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
  needsRiskQuiz: boolean;
  botEnabled: boolean;
  subscriptionActive: boolean;
  setProfile: (profile: string) => void;
  /** Questionário respondido ou pulado; `objetivo` atualiza o objetivo salvo. */
  finishRiskQuiz: (objetivo?: string) => void;
  markCarteiraVista: () => Promise<void>;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  selectUser: (id: string) => void;
  switchUser: () => void;
  /** Aviso mostrado no login quando este aparelho foi desconectado por um login em outro lugar. */
  sessionNotice: string | null;
}

const UserContext = createContext<UserContextType>({
  userId: null,
  user: null,
  isAdmin: false,
  investmentProfile: null,
  carteiraVista: false,
  needsRiskQuiz: false,
  botEnabled: false,
  subscriptionActive: true,
  setProfile: () => {},
  finishRiskQuiz: () => {},
  markCarteiraVista: async () => {},
  login: () => {},
  logout: async () => {},
  selectUser: () => {},
  switchUser: () => {},
  sessionNotice: null,
});

const SPLASH_MIN_MS = 2500;
const REPLACED_NOTICE = "Sua conta foi acessada em outro dispositivo, então você foi desconectado daqui.";
const RECHECK_MIN_MS = 30_000;

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  useEffect(() => {
    const start = Date.now();
    const ctrl = new AbortController();
    const kill = setTimeout(() => ctrl.abort(), 8_000);
    fetch("/api/auth/me", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setCurrentUser(data.user.id);
        } else if (data.code === "SESSION_REPLACED") {
          setSessionNotice(REPLACED_NOTICE);
        }
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(kill);
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
        setTimeout(() => setReady(true), remaining);
      });
    return () => {
      clearTimeout(kill);
      ctrl.abort();
    };
  }, []);

  // Quem foi desconectado por outro login descobre ao voltar para a aba ou para o app.
  useEffect(() => {
    if (!user) return;
    let lastCheck = Date.now();
    function recheck() {
      if (document.visibilityState !== "visible" || Date.now() - lastCheck < RECHECK_MIN_MS) return;
      lastCheck = Date.now();
      fetch("/api/auth/me")
        .then(async (r) => {
          if (r.status !== 401) return;
          const data = await r.json().catch(() => ({}));
          if (data.code === "SESSION_REPLACED") setSessionNotice(REPLACED_NOTICE);
          clearCurrentUser();
          setUser(null);
        })
        .catch(() => {});
    }
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [user]);

  function login(u: AuthUser) {
    setSessionNotice(null);
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

  function finishRiskQuiz(objetivo?: string) {
    setUser((prev) =>
      prev
        ? { ...prev, needsRiskQuiz: false, ...(objetivo ? { investmentProfile: objetivo, carteiraVista: true } : {}) }
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
        needsRiskQuiz: user?.needsRiskQuiz ?? false,
        botEnabled: user?.botEnabled ?? false,
        subscriptionActive: user?.subscriptionActive !== false,
        setProfile,
        finishRiskQuiz,
        markCarteiraVista,
        login,
        logout,
        selectUser: (id) => setCurrentUser(id),
        switchUser: () => {
          void logout();
        },
        sessionNotice,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
