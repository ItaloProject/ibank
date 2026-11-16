"use client";

import { useUser } from "@/context/user-context";

/** Faixa fina enquanto o teste grátis está valendo: lembra quantos dias faltam. */
export function TrialBanner() {
  const { user } = useUser();
  if (!user?.trialActive) return null;
  const dias = user.trialDaysLeft ?? 0;
  const texto = dias <= 1 ? "Último dia do seu teste grátis" : `Teste grátis: faltam ${dias} dias`;
  return (
    <div role="status" className="shrink-0 bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-1.5 text-center text-xs font-medium text-emerald-400">
      {texto}
    </div>
  );
}
