"use client";

import { useEffect, useState } from "react";
import type { TesouroLive } from "@/lib/tesouro-rates";

let shared: Promise<TesouroLive | null> | null = null;
let resolved: TesouroLive | null = null;

function fetchLive(): Promise<TesouroLive | null> {
  shared ??= fetch("/api/tesouro-rates")
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { date: string | null; rates: Record<string, number> } | null) => {
      resolved = d?.date ? { date: d.date, rates: d.rates } : null;
      if (!resolved) shared = null;
      return resolved;
    })
    .catch(() => {
      shared = null;
      return null;
    });
  return shared;
}

/** Taxas do Tesouro do dia, buscadas uma vez por sessão; null enquanto carrega ou se falhar. */
export function useTesouroLive(): TesouroLive | null {
  const [live, setLive] = useState<TesouroLive | null>(resolved);
  useEffect(() => {
    if (resolved) return;
    let alive = true;
    fetchLive().then((d) => alive && d && setLive(d));
    return () => {
      alive = false;
    };
  }, []);
  return live;
}
