"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { type UserId, getCurrentUser, setCurrentUser, hasSelectedUser } from "@/lib/user";

interface UserContextType {
  userId: UserId | null;
  selectUser: (id: UserId) => void;
  switchUser: () => void;
}

const UserContext = createContext<UserContextType>({
  userId: null,
  selectUser: () => {},
  switchUser: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<UserId | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (hasSelectedUser()) setUserId(getCurrentUser());
    setReady(true);
  }, []);

  function selectUser(id: UserId) {
    setCurrentUser(id);
    setUserId(id);
  }

  function switchUser() {
    setUserId(null);
  }

  if (!ready) return null;

  return (
    <UserContext.Provider value={{ userId, selectUser, switchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
