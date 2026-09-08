"use client";

import Image from "next/image";
import { USERS, type UserId } from "@/lib/user";
import { useUser } from "@/context/user-context";

export function LoginScreen() {
  const { selectUser } = useUser();

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4 mb-10">
        <div className="h-24 w-24 rounded-2xl overflow-hidden bg-[#f0ede8] shadow-xl">
          <Image
            src="/logo.png"
            alt="IBANK"
            width={400}
            height={400}
            className="h-full w-full object-cover"
            style={{ objectPosition: "50% 48%" }}
            priority
          />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">IBANK</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão Financeira Inteligente</p>
        </div>
      </div>

      {/* Card de seleção */}
      <div className="w-full max-w-sm">
        <p className="text-center text-sm font-medium text-muted-foreground mb-4">
          Selecione seu perfil para continuar
        </p>

        <div className="space-y-3">
          {USERS.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user.id as UserId)}
              className="w-full flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-left transition-all duration-150 hover:border-primary/40 hover:bg-accent active:scale-[0.98] shadow-sm"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-md"
                style={{ backgroundColor: user.color }}
              >
                {user.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Perfil pessoal</p>
              </div>
              <svg
                className="h-4 w-4 text-muted-foreground/50 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Rodapé */}
      <p className="mt-12 text-xs text-muted-foreground/50 text-center">
        Seus dados são privados e armazenados com segurança.
      </p>
    </div>
  );
}
