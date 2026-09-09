"use client";

import { useMemo, useState } from "react";
import { Calculator, CalendarDays, Wallet } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

/** Taxa ilustrativa (~15% a.a. ≈ 1,2% a.m.). */
const MONTHLY_RATE = 0.012;
const PRESETS = [100, 200, 300, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000] as const;
const HORIZONS = [
  { years: 1, months: 12, label: "1 ano" },
  { years: 5, months: 60, label: "5 anos" },
  { years: 15, months: 180, label: "15 anos" },
  { years: 25, months: 300, label: "25 anos" },
] as const;

function futureValueAnnuity(monthly: number, months: number, rate = MONTHLY_RATE) {
  if (monthly <= 0) return 0;
  if (rate === 0) return monthly * months;
  return monthly * (Math.pow(1 + rate, months) - 1) / rate;
}

/** Simula mês a mês: aporte no início do mês, depois rende. */
function buildMonthlySchedule(aporte: number, months: number, rate = MONTHLY_RATE) {
  const rows: { month: number; interest: number; balance: number; contributed: number }[] = [];
  let balance = 0;
  for (let m = 1; m <= months; m++) {
    balance += aporte;
    const interest = balance * rate;
    balance += interest;
    rows.push({
      month: m,
      interest,
      balance,
      contributed: aporte * m,
    });
  }
  return rows;
}

function formatCompactBRL(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const mi = value / 1_000_000;
    const rounded = mi >= 10 ? Math.round(mi) : Math.round(mi * 10) / 10;
    const text = rounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    return `R$ ${text} ${rounded === 1 ? "milhão" : "milhões"}`;
  }
  if (abs >= 10_000) {
    const mil = Math.round(value / 1_000);
    return `R$ ${mil.toLocaleString("pt-BR")} mil`;
  }
  return formatCurrency(value);
}

function clampAporte(n: number) {
  if (!Number.isFinite(n)) return 100;
  return Math.min(5000, Math.max(100, Math.round(n)));
}

export function ContributionSimulator() {
  const [aporte, setAporte] = useState(1000);

  const yearSchedule = useMemo(() => buildMonthlySchedule(aporte, 12), [aporte]);

  const horizons = useMemo(
    () =>
      HORIZONS.map((h) => {
        const patrimonio = futureValueAnnuity(aporte, h.months);
        const rendaMensal = patrimonio * MONTHLY_RATE;
        return {
          ...h,
          patrimonio,
          rendaMensal,
          contributed: aporte * h.months,
        };
      }),
    [aporte],
  );

  const yearInterestTotal = yearSchedule.reduce((s, r) => s + r.interest, 0);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Simulador de renda mensal</h2>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Quanto você consegue aportar por mês?</p>
          <p className="text-xs text-muted-foreground">
            De R$ 100 a R$ 5.000. Taxa ilustrativa de ~1,2% ao mês sobre o saldo.
          </p>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <input
              type="range"
              min={100}
              max={5000}
              step={50}
              value={aporte}
              onChange={(e) => setAporte(clampAporte(Number(e.target.value)))}
              className="w-full accent-primary h-2 cursor-pointer"
              aria-label="Aporte mensal"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>R$ 100</span>
              <span>R$ 5.000</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Aporte</p>
            <p className="text-xl font-bold text-primary tabular-nums">{formatCurrency(aporte)}</p>
            <p className="text-[10px] text-muted-foreground">/mês</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAporte(p)}
              className={cn(
                "h-9 px-2.5 rounded-lg text-xs font-medium border transition-colors",
                aporte === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 hover:bg-muted border-transparent",
              )}
            >
              {formatCurrency(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Renda mensal nos horizontes */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Quanto rende por mês (renda estimada)</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Depois de juntar o patrimônio, o rendimento mensal estimado é o saldo × 1,2%.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {horizons.map((h) => (
            <div key={h.years} className="rounded-lg bg-muted/40 px-3 py-3 space-y-1">
              <p className="text-[11px] text-muted-foreground">Em {h.label}</p>
              <p className="text-lg font-bold text-emerald-500 tabular-nums leading-tight">
                {formatCurrency(h.rendaMensal)}
              </p>
              <p className="text-[10px] text-muted-foreground">/mês de renda</p>
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                Patrimônio {formatCompactBRL(h.patrimonio)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Mês a mês no 1º ano */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Rendimento mês a mês (1º ano)</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada linha mostra quanto o saldo rendeu naquele mês (não o total do ano).
        </p>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[320px]">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left font-medium py-2 px-1">Mês</th>
                <th className="text-right font-medium py-2 px-1">Rendeu no mês</th>
                <th className="text-right font-medium py-2 px-1">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {yearSchedule.map((r) => (
                <tr key={r.month} className="border-b border-border/40">
                  <td className="py-2 px-1 text-muted-foreground">Mês {r.month}</td>
                  <td className="py-2 px-1 text-right tabular-nums font-medium text-emerald-500">
                    +{formatCurrency(r.interest)}
                  </td>
                  <td className="py-2 px-1 text-right tabular-nums">
                    {formatCurrency(r.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 px-1 font-medium">Total do ano</td>
                <td className="pt-3 px-1 text-right tabular-nums font-semibold text-emerald-500">
                  +{formatCurrency(yearInterestTotal)}
                </td>
                <td className="pt-3 px-1 text-right tabular-nums font-medium">
                  {formatCurrency(yearSchedule[11]?.balance ?? 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Simulação ilustrativa com aporte fixo de {formatCurrency(aporte)}/mês e 1,2% a.m. sobre o
        saldo. Não é recomendação de investimento.
      </p>
    </section>
  );
}
