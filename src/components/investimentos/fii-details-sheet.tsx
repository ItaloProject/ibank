"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { getFiiDetails } from "@/lib/api";
import type { FiiDetails } from "@/lib/fii-details";
import { formatPatrimonio } from "@/lib/fii-details";
import { FOCUS, LABEL, LiveSheet, MONEY } from "@/components/investimentos/live-ui";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3 flex items-start justify-between gap-3">
      <span className={`${LABEL} pt-0.5`}>{label}</span>
      <span className={`${MONEY} text-sm text-right leading-snug`}>{value}</span>
    </div>
  );
}

function dash(value: string | null | undefined): string {
  return value && value.trim() ? value : "—";
}

export function FiiDetailsSheet({
  ticker,
  name,
  onClose,
}: {
  ticker: string | null;
  name?: string;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<FiiDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) {
      setDetails(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetails(null);
    void getFiiDetails(ticker)
      .then((d) => {
        if (cancelled) return;
        if (!d) setError("Não foi possível carregar os dados deste fundo.");
        else setDetails(d);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar os dados deste fundo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const title = ticker ? ticker : "";
  const description = details?.name || name || "Ficha do fundo imobiliário";

  const ultimo =
    details?.ultimoRendimento != null
      ? `${formatCurrency(details.ultimoRendimento)}${details.ultimoRendimentoRef ? ` · ${details.ultimoRendimentoRef}` : ""}`
      : null;

  return (
    <LiveSheet open={!!ticker} onOpenChange={(o) => !o && onClose()} title={title} description={description} layer="over">
      <div className="space-y-2.5">
        {loading && (
          <div className="space-y-2.5" aria-busy="true" aria-live="polite">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-xl border border-border bg-muted/40 animate-pulse" />
            ))}
            <p className="sr-only">Carregando ficha do fundo</p>
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-muted-foreground py-6 text-center">{error}</p>
        )}

        {!loading && details && (
          <>
            <Fact label="Segmento" value={dash(details.segmento)} />
            <Fact label="Tipo de fundo" value={dash(details.tipoFundo)} />
            <Fact
              label="Val. patrimonial p/ cota"
              value={details.valPatrimonialCota != null ? formatCurrency(details.valPatrimonialCota) : "—"}
            />
            <Fact label="Último rendimento" value={dash(ultimo)} />
            <Fact
              label="Valor patrimonial"
              value={details.valorPatrimonial != null ? formatPatrimonio(details.valorPatrimonial) : "—"}
            />
            {details.source !== "brapi" && (
              <p className="text-[11px] text-muted-foreground pt-1 leading-snug">
                Alguns números ainda não chegaram da fonte ao vivo; o segmento e o tipo vêm do catálogo MUVO.
              </p>
            )}
          </>
        )}

        <button type="button" onClick={onClose} className={`mt-2 w-full min-h-12 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors ${FOCUS}`}>
          Fechar
        </button>
      </div>
    </LiveSheet>
  );
}
