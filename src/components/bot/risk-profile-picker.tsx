"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUCKET_LABEL, RISK_PROFILES, type InvestBucket, type RiskProfile } from "@/lib/rebalance";

type Variant = "bot" | "app";

const SHORT: Record<InvestBucket, string> = { pos: "Pós", inflacao: "IPCA+", prefixado: "Pré", fiis: "FIIs", acoes: "Ações" };

export function allocationSummary(p: RiskProfile): string {
  const alvo = RISK_PROFILES[p].alvo;
  return (Object.keys(alvo) as InvestBucket[]).map((b) => `${SHORT[b]} ${Math.round(alvo[b] * 100)}%`).join(" · ");
}

export async function saveRiskProfile(profile: RiskProfile): Promise<void> {
  const res = await fetch("/api/risk-profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  if (!res.ok) throw new Error("Não foi possível salvar o perfil.");
}

export function RiskProfilePicker({
  variant = "app", value: controlled, onChange,
}: {
  variant?: Variant;
  value?: RiskProfile | null;
  onChange?: (p: RiskProfile) => void;
}) {
  const [value, setValue] = useState<RiskProfile | null>(controlled ?? null);
  const [saving, setSaving] = useState<RiskProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (controlled !== undefined) {
      setValue(controlled);
      return;
    }
    fetch("/api/risk-profile").then((r) => (r.ok ? r.json() : null)).then((d) => setValue(d?.profile ?? null)).catch(() => {});
  }, [controlled]);

  async function pick(p: RiskProfile) {
    if (p === value || saving) return;
    setSaving(p);
    setError(null);
    try {
      await saveRiskProfile(p);
      setValue(p);
      onChange?.(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(null);
    }
  }

  const bot = variant === "bot";
  return (
    <div>
      <div role="radiogroup" aria-label="Perfil de risco" className="flex flex-col gap-2">
        {(Object.keys(RISK_PROFILES) as RiskProfile[]).map((p) => {
          const on = value === p;
          const cfg = RISK_PROFILES[p];
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={saving != null}
              onClick={() => void pick(p)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:opacity-60",
                bot
                  ? on ? "border-white bg-white text-[#0D0D0D]" : "border-white/15 text-white hover:bg-white/[0.06]"
                  : on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted/50",
                bot
                  ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05050A]"
                  : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{cfg.label}</span>
                <span className={cn("block text-[11px]", on ? "opacity-70" : bot ? "text-white/50" : "text-muted-foreground")}>
                  {cfg.descricao} Reserva de {cfg.reservaMeses} meses.
                </span>
                <span className={cn("mt-0.5 block text-[11px] tabular-nums", on ? "opacity-70" : bot ? "text-white/40" : "text-muted-foreground")}>
                  {allocationSummary(p)}
                </span>
              </span>
              {on && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}
      <p className={cn("mt-2 text-[11px]", bot ? "text-white/40" : "text-muted-foreground")}>
        Alocação-alvo da parte investida, sem contar a {BUCKET_LABEL.reserva.toLowerCase()}.
      </p>
    </div>
  );
}
