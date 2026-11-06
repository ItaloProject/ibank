"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { getStockDetails } from "@/lib/api";
import type { StockDetails } from "@/lib/stock-details";
import { formatMultiple, formatSignedPct } from "@/lib/stock-details";
import { AssetFact } from "@/components/investimentos/asset-fact";
import { FOCUS, LiveSheet } from "@/components/investimentos/live-ui";

function dash(value: string | null | undefined): string {
  return value && value.trim() ? value : "—";
}

export function StockDetailsSheet({
  ticker,
  name,
  onClose,
}: {
  ticker: string | null;
  name?: string;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<StockDetails | null>(null);
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
    void getStockDetails(ticker)
      .then((d) => {
        if (cancelled) return;
        if (!d) setError("Não foi possível carregar os dados desta ação.");
        else setDetails(d);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar os dados desta ação.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const dayTone =
    details?.variacaoDiaPct == null
      ? undefined
      : details.variacaoDiaPct > 0.005
        ? "gain"
        : details.variacaoDiaPct < -0.005
          ? "loss"
          : "muted";

  const ultimo =
    details?.ultimoProvento != null
      ? `${formatCurrency(details.ultimoProvento)}${details.ultimoProventoTipo ? ` · ${details.ultimoProventoTipo}` : ""}`
      : null;

  const faixa =
    details?.minimo52s != null && details?.maximo52s != null
      ? `${formatCurrency(details.minimo52s)} – ${formatCurrency(details.maximo52s)}`
      : null;

  return (
    <LiveSheet
      open={!!ticker}
      onOpenChange={(o) => !o && onClose()}
      title={ticker ?? ""}
      description={details?.name || name || "Ficha da ação"}
      layer="over"
    >
      <div className="space-y-2.5">
        {loading && (
          <div className="space-y-2.5" aria-busy="true" aria-live="polite">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 rounded-xl border border-border bg-muted/40 animate-pulse" />
            ))}
            <p className="sr-only">Carregando ficha da ação</p>
          </div>
        )}

        {!loading && error && <p className="text-sm text-muted-foreground py-6 text-center">{error}</p>}

        {!loading && details && (
          <>
            <AssetFact label="Segmento" value={dash(details.segmento)} />
            <AssetFact
              label="Hoje"
              value={details.variacaoDiaPct != null ? formatSignedPct(details.variacaoDiaPct) : "—"}
              tone={dayTone}
            />
            <AssetFact label="P/L" hint="Preço ÷ lucro" value={details.pl != null ? formatMultiple(details.pl) : "—"} />
            <AssetFact label="P/VP" hint="Preço ÷ patrimônio" value={details.pvp != null ? formatMultiple(details.pvp) : "—"} />
            <AssetFact
              label="Dividendos no ano"
              value={
                details.dividendYieldPct != null
                  ? `${details.dividendYieldPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                  : "—"
              }
            />
            <AssetFact label="Último provento" value={dash(ultimo)} />
            <AssetFact label="No último ano" hint="Mínima – máxima" value={dash(faixa)} />
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
