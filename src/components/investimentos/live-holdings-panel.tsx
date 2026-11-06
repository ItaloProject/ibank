"use client";

import { useMemo, useState, type ElementType } from "react";
import { ChevronDown, Landmark, Layers, Plus, Shield, Trash2, TrendingUp, Zap } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { LiveAccount } from "./live-actions";
import { FOCUS, GAIN, LABEL, LOSS, MONEY } from "./live-ui";
import "./live-holdings.css";

export type HoldingRow = {
  ticker: string;
  quantity: number;
  value: number;
  gainPct: number;
  price: number;
  type: string;
};

type Kind = "turbo" | "emergencia" | "rendafixa" | "bolsa";
type Filter = "all" | Kind;

const KINDS: Record<Kind, { label: string; icon: ElementType; empty: string }> = {
  turbo: { label: "Turbo", icon: Zap, empty: "Você ainda não tem uma caixinha Turbo." },
  emergencia: { label: "Emergência", icon: Shield, empty: "Você ainda não tem reserva de emergência." },
  rendafixa: { label: "Renda fixa", icon: Landmark, empty: "Nenhuma aplicação em renda fixa." },
  bolsa: { label: "Bolsa", icon: TrendingUp, empty: "Nenhuma posição em bolsa." },
};

const ORDER: Kind[] = ["turbo", "emergencia", "rendafixa", "bolsa"];

type Item = {
  key: string;
  kind: Kind;
  title: string;
  detail: string;
  value: number;
  gainPct: number | null;
  account: LiveAccount | null;
  holding: HoldingRow | null;
};

type Handlers = {
  onAporte: (a: LiveAccount) => void;
  onWithdraw: (a: LiveAccount) => void;
  onUpdate: (a: LiveAccount) => void;
  onDelete: (a: LiveAccount) => void;
};

const qty = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace(".", ","));
const pct = (n: number, digits = 1) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${pct(Math.abs(n), 2)}`;

const ACTION_BTN = `inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:pointer-events-none disabled:opacity-40 ${FOCUS}`;

function accountDetail(acc: LiveAccount) {
  return [acc.instituicao, acc.cdiPercent ? `${acc.cdiPercent}% do CDI` : "", acc.maxRendimento ? `teto ${formatCurrency(acc.maxRendimento)}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export function HoldingsPanel({
  turbo,
  emergencia,
  rendaFixa,
  holdings,
  handlers,
  onBuyStock,
  onSell,
  onNewCaixinha,
}: {
  turbo: LiveAccount[];
  emergencia: LiveAccount[];
  rendaFixa: LiveAccount[];
  holdings: HoldingRow[];
  handlers: Handlers;
  onBuyStock: () => void;
  onSell: (ticker: string) => void;
  onNewCaixinha: (tipo: "turbo" | "emergencia" | "investimentos") => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const items = useMemo<Item[]>(() => {
    const fromAccounts = (list: LiveAccount[], kind: Kind): Item[] =>
      list.map((a) => ({ key: `${kind}-${a.id}`, kind, title: a.nome, detail: accountDetail(a), value: a.valor, gainPct: null, account: a, holding: null }));
    const fromHoldings: Item[] = holdings.map((h) => ({
      key: `bolsa-${h.ticker}`,
      kind: "bolsa",
      title: h.ticker,
      detail: `${h.type} · ${qty(h.quantity)} un. · ${formatCurrency(h.price)}`,
      value: h.value,
      gainPct: h.gainPct,
      account: null,
      holding: h,
    }));
    return [...fromAccounts(turbo, "turbo"), ...fromAccounts(emergencia, "emergencia"), ...fromAccounts(rendaFixa, "rendafixa"), ...fromHoldings].sort(
      (a, b) => b.value - a.value,
    );
  }, [turbo, emergencia, rendaFixa, holdings]);

  const totals = useMemo(() => {
    const byKind: Record<Kind, { value: number; count: number }> = {
      turbo: { value: 0, count: 0 },
      emergencia: { value: 0, count: 0 },
      rendafixa: { value: 0, count: 0 },
      bolsa: { value: 0, count: 0 },
    };
    for (const i of items) {
      byKind[i.kind].value += i.value;
      byKind[i.kind].count += 1;
    }
    return { byKind, all: items.reduce((s, i) => s + i.value, 0) };
  }, [items]);

  // Resultado da bolsa em R$ e % sobre o que foi pago (mesma base da Visão geral).
  const bolsaGain = useMemo(() => {
    let value = 0;
    let cost = 0;
    for (const h of holdings) {
      if (h.gainPct <= -99.99) continue;
      value += h.value;
      cost += h.value / (1 + h.gainPct / 100);
    }
    if (cost <= 0) return null;
    const amount = value - cost;
    return { amount, pct: (amount / cost) * 100 };
  }, [holdings]);

  const visible = filter === "all" ? items : items.filter((i) => i.kind === filter);
  const visibleTotal = visible.reduce((s, i) => s + i.value, 0);

  function chooseFilter(next: Filter) {
    setFilter(next);
    setOpenKey(null);
  }

  const tiles: { id: Filter; label: string; icon: ElementType; value: number; count: number }[] = [
    { id: "all", label: "Tudo", icon: Layers, value: totals.all, count: items.length },
    ...ORDER.map((k) => ({ id: k as Filter, label: KINDS[k].label, icon: KINDS[k].icon, value: totals.byKind[k].value, count: totals.byKind[k].count })),
  ];

  const emptyAction =
    filter === "bolsa"
      ? { label: "Comprar ação", onClick: onBuyStock }
      : {
          label: filter === "turbo" ? "Nova caixinha Turbo" : filter === "emergencia" ? "Nova emergência" : "Nova caixinha",
          onClick: () => onNewCaixinha(filter === "turbo" ? "turbo" : filter === "emergencia" ? "emergencia" : "investimentos"),
        };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div role="group" aria-label="Filtrar por tipo" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t) => {
          const active = filter === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => chooseFilter(t.id)}
              className={cn(
                "flex flex-col gap-2.5 rounded-xl border p-4 text-left transition-colors",
                FOCUS,
                active ? "border-foreground bg-card" : "border-border hover:bg-muted/50",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={cn("flex items-center gap-2 text-xs font-bold", active ? "text-foreground" : "text-muted-foreground")}>
                  <t.icon className="h-4 w-4" aria-hidden="true" />
                  {t.label}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{t.count}</span>
              </span>
              <span className="flex flex-col gap-1">
                <span className={`${MONEY} text-lg leading-none`}>{formatCurrency(t.value)}</span>
                {t.id === "bolsa" && bolsaGain !== null && (
                  <span className={cn("flex items-baseline gap-1.5 text-[11px] font-semibold tabular-nums", bolsaGain.pct > 0.005 ? GAIN : bolsaGain.pct < -0.005 ? LOSS : "text-muted-foreground")}>
                    <span>
                      {bolsaGain.amount > 0 ? "+" : bolsaGain.amount < 0 ? "−" : ""}
                      {formatCurrency(Math.abs(bolsaGain.amount))}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{signed(bolsaGain.pct)}</span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <section aria-label="Seus investimentos" className="space-y-3">
        <div>
          <h2 className={LABEL}>{filter === "all" ? "Todos os investimentos" : KINDS[filter].label}</h2>
          {filter !== "all" && (
            <p className="mt-1 text-xs text-muted-foreground">
              {visible.length} {visible.length === 1 ? "item" : "itens"} · {formatCurrency(visibleTotal)}
            </p>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center space-y-4">
            <p className="text-sm text-muted-foreground">{filter === "all" ? "Você ainda não tem investimentos." : KINDS[filter].empty}</p>
            <button type="button" onClick={emptyAction.onClick} className={ACTION_BTN}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {emptyAction.label}
            </button>
          </div>
        ) : (
          <ul key={filter} className="space-y-2">
            {visible.map((item, i) => {
              const open = openKey === item.key;
              const Icon = KINDS[item.kind].icon;
              const share = totals.all > 0 ? (item.value / totals.all) * 100 : 0;
              return (
                <li key={item.key} className="lh-row overflow-hidden rounded-xl border border-border bg-card" style={{ "--i": i } as React.CSSProperties}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenKey(open ? null : item.key)}
                    className={`grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto_1rem] items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40 lg:grid-cols-[2.5rem_minmax(0,1fr)_9rem_9rem_1rem] ${FOCUS}`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {filter === "all" ? `${KINDS[item.kind].label} · ` : ""}
                        {item.detail}
                      </span>
                    </span>
                    <span className="hidden items-center gap-2 lg:flex" aria-hidden="true">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="lh-bar block h-full rounded-full bg-foreground/70" style={{ width: `${Math.max(share, 2)}%`, "--i": i } as React.CSSProperties} />
                      </span>
                      <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">{pct(share, 0)}</span>
                    </span>
                    <span className="text-right">
                      <span className={`${MONEY} block text-sm`}>{formatCurrency(item.value)}</span>
                      {item.gainPct !== null && (
                        <span className={cn("block text-[11px] font-semibold tabular-nums", item.gainPct > 0.005 ? GAIN : item.gainPct < -0.005 ? LOSS : "text-muted-foreground")}>
                          {signed(item.gainPct)}
                        </span>
                      )}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} aria-hidden="true" />
                  </button>

                  <div className="lh-panel" data-open={open} inert={!open}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
                        {item.account && (
                          <>
                            <button type="button" onClick={() => handlers.onAporte(item.account!)} className={ACTION_BTN}>
                              Aplicar
                            </button>
                            <button type="button" onClick={() => handlers.onWithdraw(item.account!)} disabled={item.account.valor <= 0} className={ACTION_BTN}>
                              Retirar
                            </button>
                            <button
                              type="button"
                              onClick={() => handlers.onUpdate(item.account!)}
                              title="Atualizar com o valor que o banco mostra (rendimento)"
                              className={ACTION_BTN}
                            >
                              Atualizar valor
                            </button>
                            <button
                              type="button"
                              onClick={() => handlers.onDelete(item.account!)}
                              aria-label={`Excluir ${item.title}`}
                              className={`${ACTION_BTN} ml-auto hover:!bg-red-500/10 hover:!text-red-500`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir
                            </button>
                          </>
                        )}
                        {item.holding && (
                          <>
                            <button type="button" onClick={onBuyStock} className={ACTION_BTN}>
                              Comprar ação
                            </button>
                            <button type="button" onClick={() => onSell(item.holding!.ticker)} className={ACTION_BTN}>
                              Vender {item.holding.ticker}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
