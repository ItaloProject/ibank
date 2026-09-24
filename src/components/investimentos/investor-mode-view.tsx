"use client";

import { useState } from "react";
import { FileText, Target, Radio } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { InvestorBot } from "@/components/investor-bot";
import { InvestorLiveView } from "@/components/investimentos/investor-live-view";
import { formatCurrency } from "@/lib/utils";
import { detectAssetType } from "@/lib/stock-utils";
import { categorizeAccount, isCashAccountName } from "@/lib/account-groups";
import type { ScoreSnapshot, InvestmentAccount, StockTrade, Investment } from "@/types/database";

type IncomeSource = {
  nome: string;
  instituicao: string;
  tipo: string;
  capital: number;
  rendaMensal: number;
  cor: string;
  badge: string;
};

type Recommendation = {
  label: string;
  atual: number;
  ideal: number;
  cor: string;
  desc: string;
};

type Insight = {
  level: "critical" | "warning" | "ok" | "suggestion";
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
  actionLabel?: string;
};

type NextMove = {
  prioridade: number;
  label: string;
  valor: string;
  razao: string;
};

type StockPosition = {
  ticker: string;
  quantity: number;
  totalInvested: number;
  avgPrice: number;
};

export type InvestorModeViewProps = {
  investorData: {
    allSources: IncomeSource[];
    totalRendaMensal: number;
    chartMonths: { label: string; "Renda recebida": number }[];
    recommendations: Recommendation[];
    CDI_MENSAL: number;
  };
  portfolioAnalysis: {
    insights: Insight[];
    nextMoves: NextMove[];
    score: number;
    emerTotal: number;
    fiiPctVariavel: number;
    commodityPct: number;
    totalStockValue: number;
  };
  incomeGoal: number;
  incomeGoalInput: string;
  setIncomeGoal: (v: number) => void;
  setIncomeGoalInput: (v: string) => void;
  setInvestorMode: (v: boolean) => void;
  scoreHistory: ScoreSnapshot[];
  grandTotal: number;
  stockPositions: StockPosition[];
  quoteMap: Map<string, number>;
  accountBalances: { account: InvestmentAccount; balance: number }[];
  stockTrades: StockTrade[];
  investments: Investment[];
  onGenerateReport: () => void;
  onRefresh: () => Promise<void> | void;
};

export function InvestorModeView({
  investorData,
  portfolioAnalysis,
  incomeGoal,
  incomeGoalInput,
  setIncomeGoal,
  setIncomeGoalInput,
  setInvestorMode,
  scoreHistory,
  grandTotal,
  stockPositions,
  quoteMap,
  accountBalances,
  stockTrades,
  investments,
  onGenerateReport,
  onRefresh,
}: InvestorModeViewProps) {
  const { allSources, totalRendaMensal, chartMonths, recommendations, CDI_MENSAL } = investorData;
  const goalProgress = incomeGoal > 0 ? Math.min((totalRendaMensal / incomeGoal) * 100, 100) : 0;
  const circumference = 2 * Math.PI * 118;
  const [liveMode, setLiveModeState] = useState(() => {
    try { return localStorage.getItem("ibank_live_mode") === "1"; } catch { return false; }
  });
  function setLiveMode(v: boolean) {
    setLiveModeState(v);
    try {
      if (v) localStorage.setItem("ibank_live_mode", "1");
      else localStorage.removeItem("ibank_live_mode");
    } catch { /* ignore */ }
  }

  if (liveMode) {
    const toItem = (x: { account: InvestmentAccount; balance: number }) => ({
      id: x.account.id,
      nome: x.account.name,
      instituicao: x.account.institution,
      valor: x.balance,
      isTurbo: x.account.is_turbo,
      cdiPercent: x.account.cdi_percent,
      maxRendimento: x.account.max_rendimento,
    });
    const sortByValor = <T extends { valor: number }>(arr: T[]) => [...arr].sort((a, b) => b.valor - a.valor);

    const cashEntry = accountBalances.find((x) => isCashAccountName(x.account.name));
    const nonCashBalances = accountBalances.filter((x) => x !== cashEntry);

    const turboAccountsReal = sortByValor(
      nonCashBalances.filter((x) => categorizeAccount(x.account) === "turbo").map(toItem)
    );
    const emergenciaAccountsReal = sortByValor(
      nonCashBalances.filter((x) => categorizeAccount(x.account) === "emergencia").map(toItem)
    );
    const investimentosAccountsReal = sortByValor(
      nonCashBalances.filter((x) => categorizeAccount(x.account) === "investimentos").map(toItem)
    );

    return (
      <InvestorLiveView
        grandTotal={grandTotal}
        turboAccountsReal={turboAccountsReal}
        emergenciaAccountsReal={emergenciaAccountsReal}
        investimentosAccountsReal={investimentosAccountsReal}
        stockPositions={stockPositions}
        quoteMap={quoteMap}
        stockTrades={stockTrades}
        investments={investments}
        cashAccountId={cashEntry?.account.id ?? null}
        cashBalance={cashEntry?.balance ?? 0}
        onRefresh={onRefresh}
        onClose={() => setLiveMode(false)}
      />
    );
  }

  return (
        <div className="relative min-h-full bg-background text-foreground overflow-hidden">
          {/* Ambient mesh — MUVO neutral */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-muted/50 blur-[140px]" />
            <div className="absolute top-1/3 -right-20 h-[400px] w-[400px] rounded-full bg-card blur-[130px]" />
            <div className="absolute bottom-0 left-1/2 h-[350px] w-[350px] rounded-full bg-muted/20 blur-[130px]" />
          </div>

          {/* Sticky top bar — anchored to the layout scroll area */}
          <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-5 py-3 backdrop-blur-xl sm:px-8">
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-black uppercase tracking-[0.22em] text-foreground/55">
                MUVO · BOT
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLiveMode(true)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <Radio className="h-3.5 w-3.5" />
                Live
              </button>
              <button
                onClick={onGenerateReport}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <FileText className="h-3.5 w-3.5" />
                PDF
              </button>
              <button
                onClick={() => setInvestorMode(false)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground/80"
              >
                Sair
              </button>
            </div>
          </div>

          <div className="relative mx-auto max-w-5xl px-5 sm:px-8 py-8 sm:py-12">
            {/* spacing placeholder — topbar takes its own row now */}

            {/* Hero central */}
            <div className="flex flex-col items-center text-center mb-14 sm:mb-20">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground mb-4">Sua renda passiva mensal</p>

              <div className="relative flex items-center justify-center mb-2" style={{ width: 280, height: 280 }}>
                <svg width="280" height="280" className="absolute inset-0 -rotate-90">
                  <circle cx="140" cy="140" r="118" fill="none" strokeWidth="6"
                    style={{ stroke: "hsl(var(--foreground) / 0.12)" }} />
                  {incomeGoal > 0 && (
                    <circle
                      cx="140" cy="140" r="118" fill="none"
                      strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (goalProgress / 100) * circumference}
                      style={{ stroke: "hsl(var(--foreground))", transition: "stroke-dashoffset 1s ease" }}
                    />
                  )}
                </svg>
                <div className="flex flex-col items-center px-6">
                  <p className="text-3xl sm:text-4xl font-black tabular-nums text-foreground leading-none text-center font-display">
                    {formatCurrency(totalRendaMensal)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">por mês</p>
                </div>
              </div>

              {incomeGoal > 0 && (
                <p className="text-sm text-muted-foreground mb-6">
                  <span className="font-bold text-foreground">{goalProgress.toFixed(0)}%</span> da meta de{" "}
                  <span className="font-bold text-foreground">{formatCurrency(incomeGoal)}</span>
                  {goalProgress < 100 && <> · faltam <span className="font-bold text-emerald-400">{formatCurrency(incomeGoal - totalRendaMensal)}</span></>}
                </p>
              )}

              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <input
                  type="number"
                  placeholder="Definir meta mensal (R$)..."
                  className="bg-muted/40 border border-border rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground w-56 text-center focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-border transition-all"
                  value={incomeGoalInput}
                  onChange={(e) => setIncomeGoalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && incomeGoalInput) {
                      const v = parseFloat(incomeGoalInput);
                      if (v > 0) {
                        setIncomeGoal(v);
                        try { localStorage.setItem("ibank_income_goal", String(v)); } catch {}
                        setIncomeGoalInput("");
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Fontes de renda */}
            <div className="mb-14 sm:mb-20">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Fontes de renda</h3>
              {allSources.length === 0 ? (
                <p className="text-muted-foreground text-center py-12 text-sm">Nenhuma fonte de renda identificada ainda.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {allSources.map((src, i) => (
                    <div key={i}
                      className="rounded-2xl border border-border bg-card backdrop-blur-xl p-5 transition-all hover:bg-muted/60 hover:border-border"
                    >
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{src.tipo}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground/90 mb-0.5 truncate">{src.nome}</p>
                      <p className="text-xs text-muted-foreground mb-4 truncate">{src.badge}</p>
                      <p className="text-2xl font-extrabold tabular-nums text-foreground">
                        +{formatCurrency(src.rendaMensal)}
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">/mês · capital {formatCurrency(src.capital)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Evolução */}
            {chartMonths.length > 0 && (
              <div className="mb-14 sm:mb-20">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Evolução registrada</h3>
                <div className="rounded-2xl border border-border bg-card backdrop-blur-xl p-5">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartMonths}>
                      <defs>
                        <linearGradient id="gradInvestorRenda" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={52} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-card border border-border rounded-xl shadow-2xl p-3 min-w-[160px]">
                              <p className="text-xs font-bold border-b border-border pb-1.5 mb-2 text-muted-foreground">{label}</p>
                              <div className="flex justify-between text-sm gap-4">
                                <span className="text-muted-foreground">Rendimento</span>
                                <span className="font-bold text-foreground tabular-nums">+{formatCurrency(Number(payload[0].value))}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area type="monotone" dataKey="Renda recebida" stroke="hsl(var(--foreground) / 0.6)" strokeWidth={2} fill="url(#gradInvestorRenda)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Alocação */}
            <div className="mb-14 sm:mb-20">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Alocação atual vs. ideal</h3>
              <div className="rounded-2xl border border-border bg-card backdrop-blur-xl p-5 sm:p-6 space-y-6">
                {recommendations.map((r) => (
                  <div key={r.label} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: r.cor }} />
                        <span className="font-semibold text-foreground/90">{r.label}</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">{r.desc}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="tabular-nums font-bold" style={{ color: r.cor }}>{r.atual.toFixed(1)}%</span>
                        <span className="text-muted-foreground">alvo {r.ideal}%</span>
                        <span className={`font-bold ${r.atual >= r.ideal ? "text-emerald-400" : "text-amber-400"}`}>
                          {r.atual >= r.ideal ? "✓" : `+${(r.ideal - r.atual).toFixed(0)}%`}
                        </span>
                      </div>
                    </div>
                    <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded-full opacity-25" style={{ width: `${r.ideal}%`, background: r.cor }} />
                      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${Math.min(r.atual, 100)}%`, background: r.cor }} />
                      <div className="absolute inset-y-0 w-0.5 bg-muted/50" style={{ left: `${r.ideal}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulador */}
            {(() => {
              const goalValue = incomeGoal || 1000;
              const remainingGap = Math.max(0, goalValue - totalRendaMensal);
              const goalReached = remainingGap === 0;
              return (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                    Simulador · capital adicional para chegar em {formatCurrency(goalValue)}/mês
                  </h3>
                  {goalReached ? (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] backdrop-blur-xl p-6 text-center">
                      <p className="text-lg font-bold text-emerald-400">🎉 Meta já atingida!</p>
                      <p className="text-xs text-muted-foreground mt-1">Sua renda passiva atual já cobre essa meta. Defina uma meta maior para continuar simulando.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { label: "Via FIIs (~0,85%/mês)", value: formatCurrency(remainingGap / 0.0085), sub: "a mais investidos em FIIs" },
                          { label: "Via TURBO 115% CDI", value: formatCurrency(remainingGap / (1.15 * CDI_MENSAL)), sub: "a mais em CDB TURBO" },
                          { label: "Via dividendos (~0,4%/mês)", value: formatCurrency(remainingGap / 0.004), sub: "a mais em ações pagadoras" },
                        ].map((item) => (
                          <div key={item.label} className="rounded-2xl border border-border bg-card backdrop-blur-xl p-5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{item.label}</p>
                            <p className="text-2xl font-extrabold tabular-nums text-foreground">{item.value}</p>
                            <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-4 text-center">
                        Você já tem {formatCurrency(totalRendaMensal)}/mês · faltam {formatCurrency(remainingGap)}/mês para a meta
                      </p>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Diagnóstico da carteira */}
            {(() => {
              const { insights, nextMoves, score } = portfolioAnalysis;
              const levelColors: Record<string, string> = { critical: "#f87171", warning: "#fbbf24", ok: "#34d399", suggestion: "#818cf8" };
              const levelBgs: Record<string, string> = { critical: "border-red-500/20 bg-red-500/[0.06]", warning: "border-amber-500/20 bg-amber-500/[0.06]", ok: "border-emerald-500/20 bg-emerald-500/[0.06]", suggestion: "border-amber-500/20 bg-amber-500/[0.06]" };
              const levelLabels: Record<string, string> = { critical: "CRÍTICO", warning: "ATENÇÃO", ok: "OK", suggestion: "SUGESTÃO" };
              const scoreColor = score >= 70 ? "#34d399" : score >= 40 ? "#fbbf24" : "#f87171";
              const circumS = 2 * Math.PI * 28;
              return (
                <div className="mt-14 sm:mt-20">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground min-w-0">
                      Diagnóstico da carteira
                    </h3>
                    <button
                      onClick={onGenerateReport}
                      className="flex items-center justify-center gap-2 rounded-full bg-white hover:bg-muted/90 px-4 py-2 text-sm font-semibold text-black transition-colors shrink-0 w-fit whitespace-nowrap"
                    >
                      <FileText className="h-4 w-4" />
                      Gerar PDF
                    </button>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-5 mb-8 rounded-2xl border border-border bg-card backdrop-blur-xl p-5">
                    <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
                      <svg width="64" height="64" className="-rotate-90 absolute inset-0">
                        <circle cx="32" cy="32" r="28" fill="none" strokeWidth="6" style={{ stroke: "hsl(var(--foreground) / 0.12)" }} />
                        <circle cx="32" cy="32" r="28" fill="none" stroke={scoreColor} strokeWidth="6" strokeLinecap="round"
                          strokeDasharray={circumS} strokeDashoffset={circumS * (1 - score / 100)}
                          style={{ transition: "stroke-dashoffset 1s ease" }} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-black" style={{ color: scoreColor }}>{score}</span>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-foreground">{score >= 70 ? "Carteira saudável" : score >= 40 ? "Precisa de ajustes" : "Atenção necessária"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Score baseado nos pontos de melhoria identificados abaixo</p>
                    </div>
                  </div>

                  {/* Evolução do score */}
                  {scoreHistory.length > 1 && (
                    <div className="mb-10">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Evolução do score</h3>
                      <div className="rounded-2xl border border-border bg-card backdrop-blur-xl p-5">
                        <ResponsiveContainer width="100%" height={160}>
                          <AreaChart data={scoreHistory.map((s) => ({
                            label: new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
                            Score: s.score,
                          }))}>
                            <defs>
                              <linearGradient id="gradScoreHistory" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={scoreColor} stopOpacity={0.5} />
                                <stop offset="95%" stopColor={scoreColor} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="bg-card border border-border rounded-xl shadow-2xl p-3 min-w-[120px]">
                                    <p className="text-xs font-bold border-b border-border pb-1.5 mb-2 text-foreground/70">{label}</p>
                                    <div className="flex justify-between text-sm gap-4">
                                      <span className="text-muted-foreground">Score</span>
                                      <span className="font-bold tabular-nums" style={{ color: scoreColor }}>{payload[0].value}</span>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Area type="monotone" dataKey="Score" stroke={scoreColor} strokeWidth={2.5} fill="url(#gradScoreHistory)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Insights */}
                  <div className="space-y-3 mb-10">
                    {insights.map((ins, i) => (
                      <div key={i} className={`rounded-xl border ${levelBgs[ins.level]} p-4 backdrop-blur-xl`}>
                        <div className="flex items-start gap-2.5">
                          <span
                            className="flex-shrink-0 rounded text-[10px] font-black px-1.5 py-0.5 mt-0.5"
                            style={{ background: levelColors[ins.level], color: "white" }}
                          >
                            {levelLabels[ins.level]}
                          </span>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground/90 leading-snug">{ins.title}</p>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ins.detail}</p>
                              {ins.action && (
                                <p className="text-xs font-semibold mt-1.5 leading-snug" style={{ color: levelColors[ins.level] }}>
                                  → {ins.action}
                                </p>
                              )}
                            </div>
                            {ins.onAction && (
                              <button
                                onClick={ins.onAction}
                                className="w-full sm:w-auto rounded-full px-3.5 py-2 text-xs font-bold text-foreground transition-opacity hover:opacity-85"
                                style={{ background: levelColors[ins.level] }}
                              >
                                {ins.actionLabel} →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Próximos aportes */}
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Próximos aportes recomendados</h3>
                  <div className="rounded-2xl border border-border bg-card backdrop-blur-xl overflow-hidden">
                    {nextMoves.map((m, i) => (
                      <div key={i} className="flex items-start gap-3 p-4 border-b border-border last:border-b-0">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted/60 border border-border flex items-center justify-center text-xs font-black text-muted-foreground mt-0.5">
                          {m.prioridade}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground/90 leading-snug">{m.label}</p>
                            <span className="text-sm font-extrabold text-emerald-400 tabular-nums flex-shrink-0">
                              {m.valor}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed break-words">{m.razao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="h-10" />
          </div>

          <InvestorBot
            context={{
              score: portfolioAnalysis.score,
              totalRendaMensal,
              incomeGoal,
              grandTotal,
              emerTotal: portfolioAnalysis.emerTotal,
              fiiPctVariavel: portfolioAnalysis.fiiPctVariavel,
              commodityPct: portfolioAnalysis.commodityPct,
              totalStockValue: portfolioAnalysis.totalStockValue,
              insights: portfolioAnalysis.insights,
              nextMoves: portfolioAnalysis.nextMoves,
              recommendations,
              sources: allSources.map((s) => ({
                nome: s.nome,
                tipo: s.tipo,
                capital: s.capital,
                rendaMensal: s.rendaMensal,
              })),
              holdings: stockPositions.map((p) => ({
                ticker: p.ticker,
                kind: detectAssetType(p.ticker),
                value: (() => {
                  const q = quoteMap.get(p.ticker);
                  return q !== undefined ? q * p.quantity : p.totalInvested;
                })(),
              })),
            }}
            onGeneratePdf={onGenerateReport}
          />
        </div>
  );
}
