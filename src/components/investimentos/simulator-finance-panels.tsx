"use client";

import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, CalendarRange, Layers } from "lucide-react";
import { addMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { SplashScreen } from "@/components/splash-screen";
import { FOCUS, LABEL, MONEY, BTN_SECONDARY, LOSS, BackLink, StatBox } from "@/components/investimentos/live-ui";

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
    <div className="space-y-4">
      <BackLink label="Início" onClick={onBack} />
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-foreground/70" aria-hidden="true" />
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{text}</p>;
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-border p-4 text-center space-y-3" role="alert">
      <p className={`text-sm font-semibold ${LOSS}`}>Não foi possível carregar os dados.</p>
      <button type="button" onClick={onRetry} className={`${BTN_SECONDARY} min-h-11`}>
        Tentar de novo
      </button>
    </div>
  );
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-1 py-0.5">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        className={`h-11 w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted ${FOCUS}`}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="text-sm font-semibold text-foreground capitalize" aria-live="polite">{monthLabel(month)}</p>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        className={`h-11 w-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted ${FOCUS}`}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}


function PlanejamentoPanel({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [salary, setSalary] = useState(0);
  const [items, setItems] = useState<PlanItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const [itemsRes, salaryRes] = await Promise.all([
          fetchJson(`/api/plan-items?month=${month}`),
          fetchJson(`/api/plan-salary?month=${month}`),
        ]);
        if (cancelled) return;
        setItems(Array.isArray(itemsRes) ? itemsRes : []);
        setSalary(Number(salaryRes?.salary ?? 0) || 0);
      } catch (err) {
        console.error("Erro ao carregar planejamento:", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [month, reloadKey]);

  const planned = items.reduce((s, i) => s + Number(i.planned ?? 0), 0);
  const actual = items.reduce((s, i) => s + Number(i.actual ?? 0), 0);
  const sobra = salary - planned;

  return (
    <PanelShell title="Planejamento" icon={CalendarRange} onBack={onBack}>
      <MonthNav month={month} onChange={setMonth} />
      {loading ? (
        <SplashScreen />
      ) : error ? (
        <LoadError onRetry={() => setReloadKey((k) => k + 1)} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Renda do mês">
              <p className={`${MONEY} text-base`}>{formatCurrency(salary)}</p>
            </StatBox>
            <StatBox label="Sobra planejada">
              <p className={`${MONEY} text-base ${sobra < 0 ? LOSS : ""}`}>
                {sobra < 0 ? "−" : ""}
                {formatCurrency(Math.abs(sobra))}
              </p>
            </StatBox>
          </div>
          <div className="rounded-xl border border-border bg-card px-3.5 py-3 flex justify-between gap-3 text-xs">
            <span className="text-muted-foreground">Planejado · Realizado</span>
            <span className="tabular-nums font-semibold text-foreground">
              {formatCurrency(planned)} · {formatCurrency(actual)}
            </span>
          </div>
          {items.length === 0 ? (
            <Empty text="Nenhum item neste mês." />
          ) : (
            <ul className="rounded-xl border border-border bg-card divide-y divide-border">
              {items.slice(0, 30).map((i) => (
                <li key={i.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{i.name}</p>
                    <p className="text-[11px] text-muted-foreground">{i.type}</p>
                  </div>
                  <p className={`${MONEY} text-[13px] shrink-0`}>
                    {formatCurrency(Number(i.actual || i.planned || 0))}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {items.length > 30 && (
            <p className="text-[11px] text-muted-foreground text-center">
              Mostrando 30 de {items.length} itens. Veja todos em Planejamento.
            </p>
          )}
        </div>
      )}
    </PanelShell>
  );
}

function ParcelamentosPanel({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [plans, setPlans] = useState<ParcelPlan[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchJson("/api/parcelamentos");
      setPlans(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao carregar parcelamentos:", err);
      setError(true);
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
        <SplashScreen />
      ) : error ? (
        <LoadError onRetry={load} />
      ) : active.length === 0 ? (
        <Empty text="Nenhum parcelamento ativo." />
      ) : (
        <div className="space-y-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className={LABEL}>Em aberto no total</p>
            <p className={`${MONEY} text-2xl mt-1.5 leading-none`}>
              {formatCurrency(
                active.reduce(
                  (s, p) => s + (p.total_amount / p.installments) * (p.installments - p.paid_installments),
                  0
                )
              )}
            </p>
          </div>
          {active.map((p) => {
            const parcela = p.total_amount / p.installments;
            const restantes = p.installments - p.paid_installments;
            const pct = (p.paid_installments / p.installments) * 100;
            return (
              <div key={p.id} className="rounded-xl border border-border bg-card p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground min-w-0">{p.description}</p>
                  <p className={`${MONEY} text-sm shrink-0`}>
                    {formatCurrency(parcela)}
                    <span className="font-sans text-[11px] font-medium text-muted-foreground">/mês</span>
                  </p>
                </div>
                <div
                  className="h-1.5 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={p.installments}
                  aria-valuenow={p.paid_installments}
                  aria-label={`${p.paid_installments} de ${p.installments} parcelas pagas`}
                >
                  <div className="h-full rounded-full bg-foreground/80" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span>
                    {p.paid_installments} de {p.installments} pagas
                  </span>
                  <span>Em aberto: {formatCurrency(parcela * restantes)}</span>
                </div>
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
