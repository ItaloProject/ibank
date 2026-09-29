"use client";

import { useEffect, useState } from "react";
import type { AnalysisPayload } from "@/lib/plan-view";

/**
 * Plano de rebalanceamento do servidor (mesmo motor do bot, do PDF e do WhatsApp).
 * Recarrega quando `version` muda (carteira alterada) ou quando o perfil de risco é salvo.
 */
export function useRebalanceAnalysis(enabled: boolean, version: string) {
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [profileTick, setProfileTick] = useState(0);

  useEffect(() => {
    const bump = () => setProfileTick((n) => n + 1);
    window.addEventListener("muvo_profile_changed", bump);
    return () => window.removeEventListener("muvo_profile_changed", bump);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/bot/analysis", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AnalysisPayload | null) => {
        if (!cancelled && d) setAnalysis(d);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled, version, profileTick]);

  return analysis;
}
