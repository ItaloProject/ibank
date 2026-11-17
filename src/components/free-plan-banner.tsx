"use client";

import Link from "next/link";
import { useUser } from "@/context/user-context";

/** Faixa discreta para quem está no plano gratuito permanente. */
export function FreePlanBanner() {
  const { user } = useUser();
  if (user?.plan !== "gratuito") return null;

  return (
    <div className="border-b border-amber-500/25 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-100/90">
      Você está no <span className="font-semibold text-amber-300">Muvo Grátis</span>
      {" · "}limites ativos
      {" · "}
      <Link href="/comecar" className="font-semibold underline underline-offset-2 hover:text-white">
        Ver planos pagos
      </Link>
    </div>
  );
}
