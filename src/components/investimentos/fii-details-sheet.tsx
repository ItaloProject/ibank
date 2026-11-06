"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { getFiiDetails } from "@/lib/api";
import type { FiiDetails } from "@/lib/fii-details";
import { formatPatrimonio } from "@/lib/fii-details";
import { AssetFact } from "@/components/investimentos/asset-fact";
import { FOCUS, LiveSheet } from "@/components/investimentos/live-ui";

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

  const ultimo =
    details?.ultimoRendimento != null
      ? `${formatCurrency(details.ultimoRendimento)}${details.ultimoRendimentoRef ? ` · ${details.ultimoRendimentoRef}` : ""}`
      : null;

  return (
    <LiveSheet
      open={!!ticker}
      onOpenChange={(o) => !o && onClose()}
      title={ticker ?? ""}
      description={details?.name || name || "Ficha do fundo imobiliário"}
      layer="over"
    >
      <div className="space-y-2.5">
        {loading && (
          <div className="space-y-2.5" aria-busy="true" aria-live="polite">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-xl border border-border bg-muted/40 animate-pulse" />
            ))}
            <p className="sr-only">Carregando ficha do fundo</p>
          </div>
        )}

        {!loading && error && <p className="text-sm text-muted-foreground py-6 text-center">{error}</p>}

        {!loading && details && (
          <>
            <AssetFact label="Segmento" value={dash(details.segmento)} />
            <AssetFact label="Tipo de fundo" value={dash(details.tipoFundo)} />
            <AssetFact
              label="Val. patrimonial p/ cota"
              value={details.valPatrimonialCota != null ? formatCurrency(details.valPatrimonialCota) : "—"}
            />
            <AssetFact label="Último rendimento" value={dash(ultimo)} />
            <AssetFact
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

        <button
          type="button"
          onClick={onClose}
          className={`mt-2 w-full min-h-12 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors ${FOCUS}`}
        >
          Fechar
        </button>
      </div>
    </LiveSheet>
  );
}
