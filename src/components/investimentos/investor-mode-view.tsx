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
import { categorizeAccount } from "@/lib/account-groups";
import type { ScoreSnapshot, InvestmentAccount } from "@/types/database";

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
  onGenerateReport: () => void;
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
  onGenerateReport,
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

    const turboAccountsReal = sortByValor(
      accountBalances.filter((x) => categorizeAccount(x.account) === "turbo").map(toItem)
    );
    const emergenciaAccountsReal = sortByValor(
      accountBalances.filter((x) => categorizeAccount(x.account) === "emergencia").map(toItem)
    );
    const investimentosAccountsReal = sortByValor(
      accountBalances.filter((x) => categorizeAccount(x.account) === "investimentos").map(toItem)
    );

    return (
      <InvestorLiveView
        grandTotal={grandTotal}
        turboAccountsReal={turboAccountsReal}
        emergenciaAccountsReal={emergenciaAccountsReal}
        investimentosAccountsReal={investimentosAccountsReal}
        stockPositions={stockPositions}
        quoteMap={quoteMap}
        onClose={() => setLiveMode(false)}
      />
    );
  }

  return (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#05050a] text-white">
          {/* Mesh de fundo */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-violet-600/25 blur-[100px]" />
            <div className="absolute top-1/4 -right-32 h-[26rem] w-[26rem] rounded-full bg-blue-500/20 blur-[100px]" />
            <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-500/15 blur-[110px]" />
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }} />
          </div>

          <div className="relative mx-auto max-w-5xl px-5 sm:px-8 py-8 sm:py-12">
            {/* Top bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-10 sm:mb-16">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 backdrop-blur-xl w-fit">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white/70">
                  Modo Investidor
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setLiveMode(true)}
                  className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-red-300 backdrop-blur-xl transition-colors hover:bg-red-500/20 hover:text-red-200"
                >
                  <Radio className="h-3.5 w-3.5" />
                  Live
                </button>
                <button
                  onClick={onGenerateReport}
                  className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-violet-300 backdrop-blur-xl transition-colors hover:bg-violet-500/20 hover:text-violet-200"
                >
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </button>
                <button
                  onClick={() => setInvestorMode(false)}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-white/70 backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white"
                >
                  Sair
                </button>
              </div>
            </div>

            {/* Hero central */}
            <div className="flex flex-col items-center text-center mb-14 sm:mb-20">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40 mb-4">Sua renda passiva mensal</p>

              <div className="relative flex items-center justify-center mb-2" style={{ width: 280, height: 280 }}>
                <svg width="280" height="280" className="absolute inset-0 -rotate-90">
                  <circle cx="140" cy="140" r="118" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                  {incomeGoal > 0 && (
                    <>
                      <circle
                        cx="140" cy="140" r="118" fill="none"
                        stroke="url(#goalGradient)" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - (goalProgress / 100) * circumference}
                        style={{ transition: "stroke-dashoffset 1s ease" }}
                      />
                      <defs>
                        <linearGradient id="goalGradient" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#a855f7" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                    </>
                  )}
                </svg>
                <div className="flex flex-col items-center px-6">
                  <p className="text-3xl sm:text-4xl font-black tabular-nums bg-gradient-to-br from-white via-violet-200 to-blue-300 bg-clip-text text-transparent leading-none text-center">
                    {formatCurrency(totalRendaMensal)}
                  </p>
                  <p className="text-xs text-white/40 mt-2">por mês</p>
                </div>
              </div>

              {incomeGoal > 0 && (
                <p className="text-sm text-white/50 mb-6">
                  <span className="font-bold text-white">{goalProgress.toFixed(0)}%</span> da meta de{" "}
                  <span className="font-bold text-white">{formatCurrency(incomeGoal)}</span>
                  {goalProgress < 100 && <> · faltam <span className="font-bold text-emerald-400">{formatCurrency(incomeGoal - totalRendaMensal)}</span></>}
                </p>
              )}

              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-white/30" />
                <input
                  type="number"
                  placeholder="Definir meta mensal (R$)..."
                  className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 w-56 text-center focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
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
              <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Fontes de renda</h3>
              {allSources.length === 0 ? (
                <p className="text-white/40 text-center py-12 text-sm">Nenhuma fonte de renda identificada ainda.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {allSources.map((src, i) => (
                    <div key={i}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 transition-all hover:bg-white/[0.06] hover:border-white/20"
                    >
                      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl opacity-30 transition-opacity group-hover:opacity-50" style={{ background: src.cor }} />
                      <div className="relative">
                        <div className="flex items-center gap-1.5 mb-3">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: src.cor }} />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{src.tipo}</p>
                        </div>
                        <p className="text-sm font-semibold text-white/90 mb-0.5">{src.nome}</p>
                        <p className="text-xs text-white/35 mb-4 truncate">{src.badge}</p>
                        <p className="text-2xl font-extrabold tabular-nums text-white">
                          +{formatCurrency(src.rendaMensal)}
                        </p>
                        <p className="text-xs text-white/30 mt-1">/mês · capital {formatCurrency(src.capital)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Evolução */}
            {chartMonths.length > 0 && (
              <div className="mb-14 sm:mb-20">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Evolução registrada</h3>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartMonths}>
                      <defs>
                        <linearGradient id="gradInvestorRenda" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} width={52} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-[#0a0a12] border border-white/10 rounded-xl shadow-2xl p-3 min-w-[160px]">
                              <p className="text-xs font-bold border-b border-white/10 pb-1.5 mb-2 text-white/70">{label}</p>
                              <div className="flex justify-between text-sm gap-4">
                                <span className="text-white/50">Rendimento</span>
                                <span className="font-bold text-violet-400 tabular-nums">+{formatCurrency(Number(payload[0].value))}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area type="monotone" dataKey="Renda recebida" stroke="#a855f7" strokeWidth={2.5} fill="url(#gradInvestorRenda)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Alocação */}
            <div className="mb-14 sm:mb-20">
              <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Alocação atual vs. ideal</h3>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 space-y-6">
                {recommendations.map((r) => (
                  <div key={r.label} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: r.cor }} />
                        <span className="font-semibold text-white/90">{r.label}</span>
                        <span className="text-xs text-white/35 hidden sm:inline">{r.desc}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="tabular-nums font-bold" style={{ color: r.cor }}>{r.atual.toFixed(1)}%</span>
                        <span className="text-white/30">alvo {r.ideal}%</span>
                        <span className={`font-bold ${r.atual >= r.ideal ? "text-emerald-400" : "text-amber-400"}`}>
                          {r.atual >= r.ideal ? "✓" : `+${(r.ideal - r.atual).toFixed(0)}%`}
                        </span>
                      </div>
                    </div>
                    <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded-full opacity-25" style={{ width: `${r.ideal}%`, background: r.cor }} />
                      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${Math.min(r.atual, 100)}%`, background: r.cor }} />
                      <div className="absolute inset-y-0 w-0.5 bg-white/50" style={{ left: `${r.ideal}%` }} />
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
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">
                    Simulador · capital adicional para chegar em {formatCurrency(goalValue)}/mês
                  </h3>
                  {goalReached ? (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] backdrop-blur-xl p-6 text-center">
                      <p className="text-lg font-bold text-emerald-400">🎉 Meta já atingida!</p>
                      <p className="text-xs text-white/40 mt-1">Sua renda passiva atual já cobre essa meta. Defina uma meta maior para continuar simulando.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] backdrop-blur-xl p-5">
                          <p className="text-xs text-purple-300 font-semibold mb-2 uppercase tracking-wide">Via FIIs (~0,85%/mês)</p>
                          <p className="text-2xl font-extrabold tabular-nums text-white">{formatCurrency(remainingGap / 0.0085)}</p>
                          <p className="text-xs text-white/35 mt-1">a mais investidos em FIIs</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] backdrop-blur-xl p-5">
                          <p className="text-xs text-emerald-300 font-semibold mb-2 uppercase tracking-wide">Via TURBO 115% CDI</p>
                          <p className="text-2xl font-extrabold tabular-nums text-white">{formatCurrency(remainingGap / (1.15 * CDI_MENSAL))}</p>
                          <p className="text-xs text-white/35 mt-1">a mais investidos em CDB TURBO</p>
                        </div>
                        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] backdrop-blur-xl p-5">
                          <p className="text-xs text-blue-300 font-semibold mb-2 uppercase tracking-wide">Via dividendos (~0,4%/mês)</p>
                          <p className="text-2xl font-extrabold tabular-nums text-white">{formatCurrency(remainingGap / 0.004)}</p>
                          <p className="text-xs text-white/35 mt-1">a mais em ações pagadoras</p>
                        </div>
                      </div>
                      <p className="text-xs text-white/30 mt-4 text-center">
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
              const levelColors: Record<string, string> = { critical: "#ef4444", warning: "#f59e0b", ok: "#10b981", suggestion: "#6366f1" };
              const levelBgs: Record<string, string> = { critical: "border-red-500/20 bg-red-500/[0.06]", warning: "border-amber-500/20 bg-amber-500/[0.06]", ok: "border-emerald-500/20 bg-emerald-500/[0.06]", suggestion: "border-violet-500/20 bg-violet-500/[0.06]" };
              const levelLabels: Record<string, string> = { critical: "CRÍTICO", warning: "ATENÇÃO", ok: "OK", suggestion: "SUGESTÃO" };
              const scoreColor = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
              const circumS = 2 * Math.PI * 28;
              return (
                <div className="mt-14 sm:mt-20">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 min-w-0">
                      Diagnóstico da carteira
                    </h3>
                    <button
                      onClick={onGenerateReport}
                      className="flex items-center justify-center gap-2 rounded-full bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition-colors shrink-0 w-fit whitespace-nowrap"
                    >
                      <FileText className="h-4 w-4" />
                      Gerar PDF
                    </button>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-5 mb-8 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
                    <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
                      <svg width="64" height="64" className="-rotate-90 absolute inset-0">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                        <circle cx="32" cy="32" r="28" fill="none" stroke={scoreColor} strokeWidth="6" strokeLinecap="round"
                          strokeDasharray={circumS} strokeDashoffset={circumS * (1 - score / 100)}
                          style={{ transition: "stroke-dashoffset 1s ease" }} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-lg font-black" style={{ color: scoreColor }}>{score}</span>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">{score >= 70 ? "Carteira saudável" : score >= 40 ? "Precisa de ajustes" : "Atenção necessária"}</p>
                      <p className="text-xs text-white/40 mt-0.5">Score baseado nos pontos de melhoria identificados abaixo</p>
                    </div>
                  </div>

                  {/* Evolução do score */}
                  {scoreHistory.length > 1 && (
                    <div className="mb-10">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Evolução do score</h3>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
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
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} width={30} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="bg-[#0a0a12] border border-white/10 rounded-xl shadow-2xl p-3 min-w-[120px]">
                                    <p className="text-xs font-bold border-b border-white/10 pb-1.5 mb-2 text-white/70">{label}</p>
                                    <div className="flex justify-between text-sm gap-4">
                                      <span className="text-white/50">Score</span>
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
                              <p className="text-sm font-semibold text-white/90 leading-snug">{ins.title}</p>
                              <p className="text-xs text-white/50 mt-1 leading-relaxed">{ins.detail}</p>
                              {ins.action && (
                                <p className="text-xs font-semibold mt-1.5 leading-snug" style={{ color: levelColors[ins.level] }}>
                                  → {ins.action}
                                </p>
                              )}
                            </div>
                            {ins.onAction && (
                              <button
                                onClick={ins.onAction}
                                className="w-full sm:w-auto rounded-full px-3.5 py-2 text-xs font-bold text-white transition-opacity hover:opacity-85"
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
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Próximos aportes recomendados</h3>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                    {nextMoves.map((m, i) => (
                      <div key={i} className="flex items-start gap-3 p-4 border-b border-white/5 last:border-b-0">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-black text-violet-300 mt-0.5">
                          {m.prioridade}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-white/90 leading-snug">{m.label}</p>
                            <span className="text-sm font-extrabold text-emerald-400 tabular-nums flex-shrink-0">
                              {m.valor}
                            </span>
                          </div>
                          <p className="text-xs text-white/40 mt-1 leading-relaxed break-words">{m.razao}</p>
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
