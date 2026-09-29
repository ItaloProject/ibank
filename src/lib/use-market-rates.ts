"use client";

import { useEffect, useState } from "react";
import { FALLBACK_CDI, FALLBACK_SELIC, type MarketRates } from "@/lib/investment-rates";

const FALLBACK: MarketRates = {
  selicAnual: FALLBACK_SELIC,
  cdiAnual: FALLBACK_CDI,
  updatedAt: "",
  source: "fallback",
};

let pending: Promise<MarketRates> | null = null;

function loadRates(): Promise<MarketRates> {
  pending ??= fetch("/api/market-rates")
    .then((r) => (r.ok ? r.json() : FALLBACK))
    .then((r: MarketRates) => (Number.isFinite(r?.cdiAnual) && r.cdiAnual > 0 ? r : FALLBACK))
    .catch(() => {
      pending = null;
      return FALLBACK;
    });
  return pending;
}

/** Selic e CDI vigentes do Banco Central, buscados uma vez por sessão. Enquanto carrega, devolve os últimos valores conhecidos. */
export function useMarketRates(): MarketRates & { loading: boolean } {
  const [rates, setRates] = useState<MarketRates | null>(null);
  useEffect(() => {
    let alive = true;
    loadRates().then((r) => alive && setRates(r));
    return () => {
      alive = false;
    };
  }, []);
  return { ...(rates ?? FALLBACK), loading: rates === null };
}
