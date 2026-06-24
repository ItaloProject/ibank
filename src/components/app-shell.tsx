"use client";

import { useUser } from "@/context/user-context";
import { UserSelect } from "@/components/user-select";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { userId } = useUser();

  if (!userId) return <UserSelect />;

  return <>{children}</>;
}
