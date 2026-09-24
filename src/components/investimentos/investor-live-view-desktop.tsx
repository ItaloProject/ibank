"use client";

import { useMemo, useState } from "react";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { detectAssetType } from "@/lib/stock-utils";
import type { InvestorLiveViewProps } from "./investor-live-view";

function fmtQty(n: number) {
  return n % 1 === 0 ? n.toString() : n.toFixed(2).replace(".", ",");
}

function PctBadge({ pct }: { pct: number }) {
  const pos = pct >= 0.005;
  const neg = pct <= -0.005;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
        pos ? "text-emerald-400" : neg ? "text-red-400" : "text-white/40"
      }`}
    >
      {pos ? <TrendingUp className="h-3 w-3" /> : neg ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {pos ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35 mb-3">{children}</p>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.04] backdrop-blur-sm p-4 ${className}`}>
      {children}
    </div>
  );
}

export function InvestorLiveViewDesktop({
  grandTotal,
  turboAccountsReal,
  emergenciaAccountsReal,
  investimentosAccountsReal,
  stockPositions,
  quoteMap,
  stockTrades,
  investments,
  cashAccountId,
  cashBalance,
  onClose,
}: InvestorLiveViewProps) {
  const [tab, setTab] = useState<"inicio" | "investimentos" | "simular">("inicio");

  /* ── Derived: holdings ────────────────────────────────────────── */
  const holdingRows = useMemo(() => {
    return stockPositions
      .filter((p) => p.quantity > 0)
      .map((p) => {
        const price = quoteMap.get(p.ticker) ?? p.avgPrice;
        const value = p.quantity * price;
        const cost = p.quantity * p.avgPrice;
        const gain = value - cost;
        const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
        return { ticker: p.ticker, quantity: p.quantity, value, gain, gainPct, type: detectAssetType(p.ticker) };
      })
      .sort((a, b) => b.value - a.value);
  }, [stockPositions, quoteMap]);

  const investedValue = holdingRows.reduce((s, h) => s + h.value, 0);
  const investedCost = useMemo(
    () => stockPositions.filter((p) => p.quantity > 0).reduce((s, p) => s + p.quantity * p.avgPrice, 0),
    [stockPositions]
  );
  const totalGain = investedValue - investedCost;
  const totalGainPct = investedCost > 0 ? (totalGain / investedCost) * 100 : 0;

  const turboTotal = turboAccountsReal.reduce((s, a) => s + a.valor, 0);
  const emergenciaTotal = emergenciaAccountsReal.reduce((s, a) => s + a.valor, 0);
  const investimentosTotal = investimentosAccountsReal.reduce((s, a) => s + a.valor, 0);
  const patrimonioTotal = turboTotal + emergenciaTotal + investimentosTotal + investedValue + cashBalance;

  /* ── Derived: movements ───────────────────────────────────────── */
  const movements = useMemo(() => {
    const items: { id: string; title: string; sub: string; amount: number; date: string }[] = [];
    for (const t of stockTrades) {
      if (t.type !== "compra") continue;
      items.push({ id: `s-${t.id}`, title: `Compra ${t.ticker}`, sub: "Bolsa", amount: t.total_amount, date: t.date });
    }
    const lookup = new Map(
      [...turboAccountsReal, ...emergenciaAccountsReal, ...investimentosAccountsReal].map((a) => [a.id, a])
    );
    for (const inv of investments) {
      if (inv.type !== "deposito" || inv.account_id === cashAccountId) continue;
      const acc = lookup.get(inv.account_id);
      if (!acc) continue;
      const group = acc.isTurbo ? "Turbo" : emergenciaAccountsReal.some((e) => e.id === acc.id) ? "EME" : "Renda Fixa";
      items.push({ id: `i-${inv.id}`, title: `Aporte · ${acc.nome}`, sub: group, amount: inv.amount, date: inv.date });
    }
    return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);
  }, [stockTrades, investments, cashAccountId, turboAccountsReal, emergenciaAccountsReal, investimentosAccountsReal]);

  /* ── Derived: allocation ──────────────────────────────────────── */
  const allocation = useMemo(() => {
    const base = patrimonioTotal || 1;
    return [
      { label: "TURBO", value: turboTotal, color: "#f59e0b", pct: (turboTotal / base) * 100 },
      { label: "Emergência", value: emergenciaTotal, color: "#3b82f6", pct: (emergenciaTotal / base) * 100 },
      { label: "Renda Fixa", value: investimentosTotal, color: "#22c55e", pct: (investimentosTotal / base) * 100 },
      { label: "Bolsa", value: investedValue, color: "#a855f7", pct: (investedValue / base) * 100 },
      { label: "Saldo Livre", value: cashBalance, color: "#64748b", pct: (cashBalance / base) * 100 },
    ].filter((x) => x.value > 0);
  }, [patrimonioTotal, turboTotal, emergenciaTotal, investimentosTotal, investedValue, cashBalance]);

  /* ── Simulator ────────────────────────────────────────────────── */
  const [simInicial, setSimInicial] = useState(() => Math.max(Math.round(grandTotal), 1000));
  const [simMensal, setSimMensal] = useState(300);
  const [simMeses, setSimMeses] = useState(24);
  const [simTaxa, setSimTaxa] = useState(0.9);

  const simData = useMemo(() => {
    const rate = simTaxa / 100;
    const pts: { month: number; value: number }[] = [{ month: 0, value: simInicial }];
    let v = simInicial;
    for (let m = 1; m <= simMeses; m++) {
      v = v * (1 + rate) + simMensal;
      pts.push({ month: m, value: v });
    }
    return pts;
  }, [simInicial, simMensal, simMeses, simTaxa]);

  const simFinal = simData[simData.length - 1]?.value ?? 0;
  const simAportado = simInicial + simMensal * simMeses;
  const simRendimento = simFinal - simAportado;
  const simMax = Math.max(1, ...simData.map((p) => p.value));
  const barStep = Math.max(1, Math.floor(simData.length / 30));

  /* ── Tabs ─────────────────────────────────────────────────────── */
  const tabs = [
    { id: "inicio" as const, label: "Início" },
    { id: "investimentos" as const, label: "Investimentos" },
    { id: "simular" as const, label: "Simular" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#05050a] text-white relative overflow-hidden select-none">
      {/* Ambient mesh */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-violet-600/12 blur-[140px]" />
        <div className="absolute top-1/3 -right-20 h-[400px] w-[400px] rounded-full bg-blue-500/8 blur-[130px]" />
        <div className="absolute bottom-0 left-1/2 h-[350px] w-[350px] rounded-full bg-emerald-500/8 blur-[130px]" />
      </div>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-between px-7 py-4 border-b border-white/[0.07] shrink-0">
        {/* Brand + tabs */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white/55">
              MUVO · LIVE
            </span>
          </div>

          <div className="flex items-center gap-1 bg-white/[0.05] rounded-full p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  tab === t.id
                    ? "bg-white/12 text-white shadow-sm"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-full bg-white/7 text-white/40 hover:bg-white/14 hover:text-white/80 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────── */}
      <div className="relative grid grid-cols-4 divide-x divide-white/[0.06] border-b border-white/[0.07] shrink-0">
        {[
          { label: "Patrimônio total", value: formatCurrency(patrimonioTotal), sub: null, accent: false },
          { label: "Saldo livre", value: formatCurrency(cashBalance), sub: null, accent: true },
          {
            label: "Ganho em bolsa",
            value: (totalGain >= 0 ? "+" : "") + formatCurrency(totalGain),
            sub: (totalGainPct >= 0 ? "+" : "") + totalGainPct.toFixed(2) + "%",
            accent: totalGain !== 0,
            positive: totalGain >= 0,
          },
          { label: "Ativos em bolsa", value: holdingRows.length.toString(), sub: "posições", accent: false },
        ].map((kpi, i) => (
          <div key={i} className="px-7 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30 mb-1">{kpi.label}</p>
            <p
              className={`text-xl font-bold tabular-nums ${
                kpi.accent
                  ? "positive" in kpi
                    ? kpi.positive
                      ? "text-emerald-400"
                      : "text-red-400"
                    : "text-emerald-400"
                  : "text-white"
              }`}
            >
              {kpi.value}
            </p>
            {kpi.sub && (
              <p className={`text-xs mt-0.5 ${
                "positive" in kpi
                  ? kpi.positive ? "text-emerald-400/60" : "text-red-400/60"
                  : "text-white/30"
              }`}>
                {kpi.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Content area ──────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-y-auto">

        {/* ═══ INÍCIO ═══════════════════════════════════════════════ */}
        {tab === "inicio" && (
          <div className="grid grid-cols-[280px_1fr_1fr] gap-0 h-full divide-x divide-white/[0.06]">

            {/* Left: Allocation */}
            <div className="p-6 overflow-y-auto">
              <SectionHeading>Distribuição</SectionHeading>

              {/* Stacked bar */}
              <div className="flex h-2.5 rounded-full overflow-hidden mb-4 gap-px">
                {allocation.map((a) => (
                  <div
                    key={a.label}
                    className="h-full transition-all"
                    style={{ width: `${a.pct}%`, backgroundColor: a.color }}
                  />
                ))}
              </div>

              <div className="space-y-4">
                {allocation.map((a) => (
                  <div key={a.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                        <span className="text-sm text-white/70">{a.label}</span>
                      </div>
                      <span className="text-[11px] text-white/35 tabular-nums">{a.pct.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden mr-3">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${a.pct}%`, backgroundColor: a.color, opacity: 0.7 }}
                        />
                      </div>
                      <span className="text-xs font-medium text-white/50 tabular-nums w-24 text-right">
                        {formatCurrency(a.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Saldo livre */}
              <div className="mt-6 pt-5 border-t border-white/[0.07]">
                <SectionHeading>Saldo disponível</SectionHeading>
                <p className="text-2xl font-bold text-emerald-400 tabular-nums">{formatCurrency(cashBalance)}</p>
                <p className="text-xs text-white/30 mt-0.5">Para novos aportes</p>
              </div>
            </div>

            {/* Center: Holdings */}
            <div className="p-6 overflow-y-auto">
              <SectionHeading>Posições em bolsa</SectionHeading>
              {holdingRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-white/25 text-sm">Nenhuma posição em bolsa</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {holdingRows.map((h) => (
                    <div
                      key={h.ticker}
                      className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.07] flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-white/60">{h.ticker.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{h.ticker}</p>
                          <p className="text-[11px] text-white/35">{h.type} · {fmtQty(h.quantity)} un.</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums">{formatCurrency(h.value)}</p>
                        <PctBadge pct={h.gainPct} />
                      </div>
                    </div>
                  ))}

                  {/* Bolsa total */}
                  <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between items-center px-1">
                    <span className="text-xs text-white/30">Total bolsa</span>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">{formatCurrency(investedValue)}</p>
                      <PctBadge pct={totalGainPct} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Movements */}
            <div className="p-6 overflow-y-auto">
              <SectionHeading>Últimas movimentações</SectionHeading>
              {movements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-white/25 text-sm">Sem movimentações</p>
                </div>
              ) : (
                <div className="space-y-px">
                  {movements.map((mov) => (
                    <div
                      key={mov.id}
                      className="flex items-center justify-between px-1 py-3 border-b border-white/[0.05] last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white/80 truncate">{mov.title}</p>
                        <p className="text-[11px] text-white/30">{mov.sub} · {mov.date}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-white/70 shrink-0 ml-4">
                        {formatCurrency(mov.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ INVESTIMENTOS ════════════════════════════════════════ */}
        {tab === "investimentos" && (
          <div className="grid grid-cols-3 gap-0 h-full divide-x divide-white/[0.06]">

            {/* TURBO */}
            <div className="p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <SectionHeading>TURBO</SectionHeading>
                <span className="text-[11px] font-bold text-amber-400/70 tabular-nums">{formatCurrency(turboTotal)}</span>
              </div>
              {turboAccountsReal.length === 0 ? (
                <p className="text-sm text-white/25">Nenhuma conta TURBO.</p>
              ) : (
                <div className="space-y-2">
                  {turboAccountsReal.map((acc) => (
                    <Card key={acc.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white/90 truncate">{acc.nome}</p>
                          <p className="text-[11px] text-white/35 mt-0.5">{acc.instituicao}</p>
                        </div>
                        <p className="text-sm font-bold tabular-nums text-amber-400 shrink-0">{formatCurrency(acc.valor)}</p>
                      </div>
                      {acc.cdiPercent && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span className="text-[10px] bg-amber-400/10 text-amber-400/80 rounded-full px-2 py-0.5 font-semibold">
                            {acc.cdiPercent}% CDI
                          </span>
                          {acc.maxRendimento && (
                            <span className="text-[10px] bg-white/[0.04] text-white/30 rounded-full px-2 py-0.5">
                              Teto {formatCurrency(acc.maxRendimento)}
                            </span>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Emergência */}
            <div className="p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <SectionHeading>Emergência</SectionHeading>
                <span className="text-[11px] font-bold text-blue-400/70 tabular-nums">{formatCurrency(emergenciaTotal)}</span>
              </div>
              {emergenciaAccountsReal.length === 0 ? (
                <p className="text-sm text-white/25">Nenhuma conta de emergência.</p>
              ) : (
                <div className="space-y-2">
                  {emergenciaAccountsReal.map((acc) => (
                    <Card key={acc.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white/90 truncate">{acc.nome}</p>
                          <p className="text-[11px] text-white/35 mt-0.5">{acc.instituicao}</p>
                        </div>
                        <p className="text-sm font-bold tabular-nums text-blue-400 shrink-0">{formatCurrency(acc.valor)}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Renda Fixa + Bolsa */}
            <div className="p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <SectionHeading>Renda Fixa & Bolsa</SectionHeading>
                <span className="text-[11px] font-bold text-emerald-400/70 tabular-nums">
                  {formatCurrency(investimentosTotal + investedValue)}
                </span>
              </div>
              <div className="space-y-2">
                {investimentosAccountsReal.map((acc) => (
                  <Card key={acc.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white/90 truncate">{acc.nome}</p>
                        <p className="text-[11px] text-white/35 mt-0.5">{acc.instituicao}</p>
                      </div>
                      <p className="text-sm font-bold tabular-nums text-emerald-400 shrink-0">{formatCurrency(acc.valor)}</p>
                    </div>
                  </Card>
                ))}

                {holdingRows.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-400/50 pt-3 pb-1">Bolsa</p>
                    {holdingRows.map((h) => (
                      <Card key={h.ticker}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white/90">{h.ticker}</p>
                            <p className="text-[11px] text-white/35">{h.type} · {fmtQty(h.quantity)} un.</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold tabular-nums text-violet-400">{formatCurrency(h.value)}</p>
                            <PctBadge pct={h.gainPct} />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ SIMULAR ══════════════════════════════════════════════ */}
        {tab === "simular" && (
          <div className="grid grid-cols-[360px_1fr] gap-0 h-full divide-x divide-white/[0.06]">

            {/* Controls */}
            <div className="p-6 overflow-y-auto space-y-6">
              <SectionHeading>Parâmetros da simulação</SectionHeading>

              {[
                {
                  label: "Capital inicial",
                  value: formatCurrency(simInicial),
                  min: 0,
                  max: Math.max(200000, Math.ceil(grandTotal * 2 / 10000) * 10000),
                  step: 500,
                  current: simInicial,
                  set: setSimInicial,
                },
                {
                  label: "Aporte mensal",
                  value: formatCurrency(simMensal),
                  min: 0,
                  max: 10000,
                  step: 50,
                  current: simMensal,
                  set: setSimMensal,
                },
                {
                  label: "Período",
                  value: `${simMeses} meses`,
                  min: 6,
                  max: 120,
                  step: 6,
                  current: simMeses,
                  set: setSimMeses,
                },
                {
                  label: "Taxa mensal",
                  value: `${simTaxa.toFixed(2)}% a.m.`,
                  min: 0.1,
                  max: 3,
                  step: 0.05,
                  current: simTaxa,
                  set: setSimTaxa,
                },
              ].map((param) => (
                <div key={param.label}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/50">{param.label}</span>
                    <span className="font-semibold text-white">{param.value}</span>
                  </div>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={param.current}
                    onChange={(e) => param.set(Number(e.target.value) as never)}
                    className="w-full h-1.5 appearance-none rounded-full bg-white/10 accent-emerald-500 cursor-pointer"
                  />
                </div>
              ))}

              {/* Result KPIs */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                {[
                  { label: "Valor final", value: formatCurrency(simFinal), color: "text-emerald-400" },
                  { label: "Rendimento", value: formatCurrency(simRendimento), color: "text-blue-400" },
                  { label: "Total aportado", value: formatCurrency(simAportado), color: "text-white" },
                  {
                    label: "Retorno %",
                    value: `${simAportado > 0 ? ((simRendimento / simAportado) * 100).toFixed(1) : "0"}%`,
                    color: "text-white",
                  },
                ].map((r) => (
                  <Card key={r.label} className="!p-3.5">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{r.label}</p>
                    <p className={`text-base font-bold tabular-nums ${r.color}`}>{r.value}</p>
                  </Card>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="p-6 flex flex-col">
              <SectionHeading>Projeção patrimonial</SectionHeading>

              {/* Bar chart */}
              <div className="flex-1 flex flex-col">
                <div className="flex-1 flex items-end gap-[2px] min-h-0">
                  {simData
                    .filter((_, i) => i % barStep === 0 || i === simData.length - 1)
                    .map((p) => {
                      const h = (p.value / simMax) * 100;
                      const isLast = p.month === simMeses;
                      return (
                        <div
                          key={p.month}
                          className="flex-1 relative group rounded-t transition-all"
                          style={{
                            height: `${h}%`,
                            background: isLast
                              ? "linear-gradient(to top, #10b981, #34d399)"
                              : "rgba(16,185,129,0.35)",
                          }}
                        >
                          {/* Tooltip */}
                          <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                            <div className="bg-zinc-900/95 border border-white/10 text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap">
                              <p className="text-white/50">Mês {p.month}</p>
                              <p className="font-bold">{formatCurrency(p.value)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* X-axis labels */}
                <div className="flex justify-between text-[11px] text-white/25 mt-3">
                  <span>Agora</span>
                  <span>Mês {Math.floor(simMeses / 2)}</span>
                  <span>Mês {simMeses}</span>
                </div>

                {/* Milestone line */}
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15 px-4 py-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs text-white/50">
                      Em {simMeses} meses, seu patrimônio pode chegar a{" "}
                      <span className="font-bold text-emerald-400">{formatCurrency(simFinal)}</span>
                    </p>
                    <p className="text-[11px] text-white/25 mt-0.5">
                      Rendendo {simTaxa.toFixed(2)}% ao mês · aportando {formatCurrency(simMensal)}/mês
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
