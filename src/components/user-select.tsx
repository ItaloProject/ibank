"use client";

import { useUser } from "@/context/user-context";
import { USERS, type UserId } from "@/lib/user";
import { Wallet } from "lucide-react";

export function UserSelect() {
  const { selectUser } = useUser();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-sidebar px-4 py-8">
      <div className="flex items-center gap-3 mb-8 sm:mb-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Wallet className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white leading-none">IBANK</p>
          <p className="text-sm text-white/50 mt-0.5">Gestão Financeira</p>
        </div>
      </div>

      <p className="text-white/70 text-sm mb-6 tracking-wide uppercase text-center">Quem está acessando?</p>

      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:gap-4">
        {USERS.map((u) => (
          <button
            key={u.id}
            onClick={() => selectUser(u.id as UserId)}
            className="group flex flex-1 flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/10 hover:scale-[1.02] active:scale-95"
          >
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-white"
              style={{ backgroundColor: u.color }}
            >
              {u.name[0]}
            </div>
            <span className="text-white font-semibold text-lg">{u.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
