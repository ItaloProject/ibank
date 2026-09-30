"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, Check } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { monthName, type PlanLeftover } from "@/lib/plan-leftover";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Oferece somar ao saldo em conta a sobra do Planejamento (mês anterior e atual), uma vez por mês. */
export function PlanLeftoverOffer({ open, done, onUse, disabled }: {
  open: boolean;
  done: Set<string>;
  onUse: (month: string, amount: number) => Promise<void>;
  disabled?: boolean;
}) {
  const [months, setMonths] = useState<PlanLeftover[] | null>(null);
  const [using, setUsing] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    fetch("/api/plan-leftover", { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMonths(Array.isArray(d?.months) ? d.months : []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [open]);

  if (months === null) return null;
  if (months.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Informe a renda do mês no{" "}
        <Link href="/planejamento" className={cn("font-semibold text-foreground underline underline-offset-2", FOCUS)}>Planejamento</Link>
        {" "}e a sobra aparece aqui para somar ao saldo.
      </p>
    );
  }

  const offers = months.filter((m) => m.sobra > 0 && !done.has(m.month));
  const trazidos = months.filter((m) => done.has(m.month));
  if (offers.length === 0 && trazidos.length === 0) return null;

  async function use(m: PlanLeftover) {
    setUsing(m.month);
    try {
      await onUse(m.month, m.sobra);
    } finally {
      setUsing(null);
    }
  }

  return (
    <section aria-label="Sobra do Planejamento" className="space-y-2">
      {offers.map((m) => (
        <button
          key={m.month}
          type="button"
          disabled={disabled || using !== null}
          onClick={() => void use(m)}
          className={cn(
            "flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-foreground/40 disabled:opacity-60",
            FOCUS,
          )}
        >
          <ArrowDownToLine className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">
              {using === m.month ? "Somando…" : `Somar a sobra de ${monthName(m.month)}`}
            </span>
            <span className="block text-[11px] tabular-nums text-muted-foreground">
              Renda de {formatCurrency(m.renda)} menos {formatCurrency(m.gastoReal)} de gastos no Planejamento
            </span>
          </span>
          <span className="shrink-0 font-display text-sm font-black tabular-nums text-foreground">+{formatCurrency(m.sobra)}</span>
        </button>
      ))}
      {trazidos.map((m) => (
        <p key={m.month} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          A sobra de {monthName(m.month)} já está no saldo.
        </p>
      ))}
    </section>
  );
}
