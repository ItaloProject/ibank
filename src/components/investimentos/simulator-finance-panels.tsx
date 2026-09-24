"use client";

import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, CalendarRange, Layers } from "lucide-react";
import { addMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";

export type FinancePanelId = "planejamento" | "parcelamentos";

type Props = {
  panel: FinancePanelId;
  onBack: () => void;
};

type PlanItem = {
  id: string;
  name: string;
  planned: number;
  actual: number;
  type: string;
};

type ParcelPlan = {
  id: string;
  description: string;
  total_amount: number;
  installments: number;
  paid_installments: number;
};

function PanelShell({
  title,
  icon: Icon,
  onBack,
  children,
}: {
  title: string;
  icon: ElementType;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 pt-1">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground/80"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Voltar
      </button>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-foreground/70" />
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Loading() {
  return <p className="text-sm text-muted-foreground text-center py-10">Carregando…</p>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{text}</p>;
}

function shiftMonth(month: string, delta: number): string {
  const d = parseISO(`${month}-01T12:00:00`);
  return format(addMonths(d, delta), "yyyy-MM");
}

function monthLabel(month: string): string {
  return format(parseISO(`${month}-01T12:00:00`), "MMMM yyyy", { locale: ptBR });
}

function MonthNav({
  month,
  onChange,
}: {
  month: string;
  onChange: (m: string) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-2 py-1.5">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="text-xs font-semibold text-foreground capitalize">{monthLabel(month)}</p>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}


function PlanejamentoPanel({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [salary, setSalary] = useState(0);
  const [items, setItems] = useState<PlanItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [itemsRes, salaryRes] = await Promise.all([
          fetch(`/api/plan-items?month=${month}`).then((r) => r.json()),
          fetch(`/api/plan-salary?month=${month}`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setItems(Array.isArray(itemsRes) ? itemsRes : []);
        setSalary(Number(salaryRes?.salary ?? 0) || 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [month]);

  const planned = items.reduce((s, i) => s + Number(i.planned ?? 0), 0);
  const actual = items.reduce((s, i) => s + Number(i.actual ?? 0), 0);

  return (
    <PanelShell title="Planejamento" icon={CalendarRange} onBack={onBack}>
      <MonthNav month={month} onChange={setMonth} />
      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-border bg-muted/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Salário</p>
              <p className="text-sm font-extrabold tabular-nums text-foreground mt-1">{formatCurrency(salary)}</p>
            </div>
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sobra plan.</p>
              <p className="text-sm font-extrabold tabular-nums text-violet-300 mt-1">
                {formatCurrency(salary - planned)}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted/40 p-3 flex justify-between text-xs">
            <span className="text-muted-foreground">Planejado / Real</span>
            <span className="tabular-nums text-foreground">
              {formatCurrency(planned)} · {formatCurrency(actual)}
            </span>
          </div>
          {items.length === 0 ? (
            <Empty text="Nenhum item neste mês." />
          ) : (
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto scrollbar-thin-dark pr-1">
              {items.slice(0, 30).map((i) => (
                <div
                  key={i.id}
                  className="rounded-xl border border-border bg-muted/30 px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{i.name}</p>
                    <p className="text-[10px] text-muted-foreground">{i.type}</p>
                  </div>
                  <p className="text-xs font-bold tabular-nums text-foreground shrink-0">
                    {formatCurrency(Number(i.actual || i.planned || 0))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PanelShell>
  );
}

function ParcelamentosPanel({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<ParcelPlan[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/parcelamentos");
      const data = await res.json();
      setPlans(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = plans.filter((p) => p.paid_installments < p.installments);

  return (
    <PanelShell title="Parcelamentos" icon={Layers} onBack={onBack}>
      {loading ? (
        <Loading />
      ) : active.length === 0 ? (
        <Empty text="Nenhum parcelamento ativo." />
      ) : (
        <div className="space-y-2.5">
          {active.map((p) => {
            const parcela = p.total_amount / p.installments;
            const restantes = p.installments - p.paid_installments;
            const pct = (p.paid_installments / p.installments) * 100;
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-3.5 space-y-2"
              >
                <p className="text-sm font-semibold text-foreground">{p.description}</p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {p.paid_installments}/{p.installments} pagas
                  </span>
                  <span className="tabular-nums text-foreground">
                    {formatCurrency(parcela)}/mês
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Em aberto: {formatCurrency(parcela * restantes)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}

export function SimulatorFinancePanel({ panel, onBack }: Props) {
  if (panel === "planejamento") return <PlanejamentoPanel onBack={onBack} />;
  return <ParcelamentosPanel onBack={onBack} />;
}
