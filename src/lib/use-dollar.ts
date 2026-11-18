"use client";

import { useEffect, useState } from "react";

export interface DollarQuote {
  /** Valor de 1 USD em reais; null se a cotação estiver indisponível. */
  bid: number | null;
  /** Variação do dia em R$ (positivo = subiu, negativo = caiu). */
  change: number;
}

const UNAVAILABLE: DollarQuote = { bid: null, change: 0 };

// Uma única busca por carregamento de página, compartilhada entre quem usar o hook.
let pending: Promise<DollarQuote> | null = null;

function fetchDollar(): Promise<DollarQuote> {
  if (!pending) {
    pending = fetch("/api/dollar")
      .then((r) => (r.ok ? r.json() : UNAVAILABLE))
      .then((d): DollarQuote =>
        typeof d?.bid === "number" ? { bid: d.bid, change: Number(d.change) || 0 } : UNAVAILABLE,
      )
      .catch(() => UNAVAILABLE);
  }
  return pending;
}

export function useDollar() {
  const [quote, setQuote] = useState<DollarQuote>(UNAVAILABLE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchDollar().then((q) => {
      if (!alive) return;
      setQuote(q);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { ...quote, loading };
}
