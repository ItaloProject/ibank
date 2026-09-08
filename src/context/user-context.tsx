"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { setCurrentUser, clearCurrentUser } from "@/lib/user";

interface AuthUser {
  id: string;
  name: string;
  color: string;
}

interface UserContextType {
  userId: string | null;
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  // legacy compat
  selectUser: (id: string) => void;
  switchUser: () => void;
}

const UserContext = createContext<UserContextType>({
  userId: null,
  user: null,
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

  if (!ready) return null;

  return (
    <UserContext.Provider value={{
      userId: user?.id ?? null,
      user,
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
