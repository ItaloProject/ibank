"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Target, Check, CheckCircle2, ArrowRight, Pencil, X, ChevronDown } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { EXPLAIN_GOAL_EVENT, InvestorBot, type BotPortfolioContext } from "@/components/investor-bot";
import { ProgressRing, Reveal, useCountUp } from "@/components/motion/reveal";
import { formatCurrency } from "@/lib/utils";
import { maskMoney, toMoneyMask } from "@/lib/money-mask";
import { RISK_PROFILES, type RiskProfile } from "@/lib/rebalance";
import { actionHref, type PlanAllocation, type PlanInsight, type PlanMove } from "@/lib/plan-view";
import { conservativeGoal, projectGoal, type GoalProjection } from "@/lib/goal-projection";
import { formatMonths } from "@/lib/profile-transition";
import Link from "next/link";
import type { ScoreSnapshot, InvestmentAccount, StockTrade, Investment } from "@/types/database";

type IncomeSource = {
  nome: string;
  instituicao: string;
  tipo: string;
  capital: number;
  rendaMensal: number;
  cor: string;
  badge: string;
  origem: "registrado" | "estimado";
};

export type PortfolioAnalysis = {
  profile: RiskProfile;
  profileDefinido: boolean;
  score: number;
  emerTotal: number;
  investido: number;
  total: number;
  retorno12m: number;
  alocacaoRelevante: boolean;
  allocation: PlanAllocation[];
  insights: (PlanInsight & { onAction?: () => void })[];
  nextMoves: (PlanMove & { valorTexto: string })[];
  goal: GoalProjection | null;
  metaRenda: number | null;
  aporteAnalise: number;
  ipca12m: number | null;
};

function HeroValue({ value, active, suffix }: { value: string; active: boolean; suffix?: string }) {
  return (
    <div className={`flex flex-col items-center px-6 transition-opacity duration-700 ${active ? "opacity-100" : "opacity-0"}`}>
      <p className="text-3xl sm:text-4xl font-black tabular-nums text-foreground leading-none text-center font-display">
        {value}
      </p>
      {suffix && <p className="text-xs text-muted-foreground mt-2">{suffix}</p>}
    </div>
  );
}

function ScoreValue({ value, active, color }: { value: number; active: boolean; color: string }) {
  const shown = useCountUp(value, active);
  return (
    <span className="absolute inset-0 flex items-center justify-center text-lg font-black tabular-nums" style={{ color }}>
      <span className="sr-only">Nota {value} de 100</span>
      <span aria-hidden="true">{Math.round(shown)}</span>
    </span>
  );
}

/** Aceita "1.500,50", "1.500", "1500,5" ou "1500.50". */
function parseGoal(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  const v = Number(normalized);
  return Number.isFinite(v) && v < 1e10 ? Math.round(v * 100) / 100 : 0;
}

function monthsLabel(meses: number): string {
  if (meses <= 0) return "já";
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const y = Math.floor(meses / 12);
  const m = meses % 12;
  if (!m) return y === 1 ? "1 ano" : `${y} anos`;
  return `${y} ${y === 1 ? "ano" : "anos"} e ${m} ${m === 1 ? "mês" : "meses"}`;
}

const FIELD =
  "w-full rounded-xl border border-border bg-muted/40 px-3.5 min-h-11 text-sm text-foreground tabular-nums placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:opacity-60";
const LABEL_FIELD = "block text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-1.5 text-left";

export type InvestorModeViewProps = {
  investorData: {
    allSources: IncomeSource[];
    totalRendaMensal: number;
    rendaRegistrada: number;
    rendaEstimada: number;
    chartMonths: { label: string; "Renda recebida": number }[];
    CDI_MENSAL: number;
  };
  /** Null enquanto o plano do servidor carrega. */
  portfolioAnalysis: PortfolioAnalysis | null;
  incomeGoal: number;
  incomeGoalInput: string;
  setIncomeGoal: (v: number) => void;
  setIncomeGoalInput: (v: string) => void;
  goalDeadlineYear: number | null;
  setGoalDeadlineYear: (v: number | null) => void;
  goalMonthlyContribution: number;
  setGoalMonthlyContribution: (v: number) => void;
  scoreHistory: ScoreSnapshot[];
  grandTotal: number;
  accountBalances: { account: InvestmentAccount; balance: number }[];
  stockTrades: StockTrade[];
  investments: Investment[];
  onGenerateReport: () => void;
  onRefresh: () => Promise<void> | void;
  botContext: BotPortfolioContext;
  botDataVersion: string;
};

export function InvestorModeView({
  investorData,
  portfolioAnalysis,
  incomeGoal,
  incomeGoalInput,
  setIncomeGoal,
  setIncomeGoalInput,
  goalDeadlineYear,
  setGoalDeadlineYear,
  goalMonthlyContribution,
  setGoalMonthlyContribution,
  scoreHistory,
  grandTotal,
  onGenerateReport,
  botContext,
  botDataVersion,
}: InvestorModeViewProps) {
  const { allSources, totalRendaMensal, rendaRegistrada, rendaEstimada, chartMonths } = investorData;
  const [editingGoal, setEditingGoal] = useState(false);
  const [showNominal, setShowNominal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState("");
  const [aporteInput, setAporteInput] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const thisYear = new Date().getFullYear();

  const path = useMemo(() => {
    if (!(incomeGoal > 0) || !portfolioAnalysis) return null;
    if (portfolioAnalysis.goal && portfolioAnalysis.metaRenda === incomeGoal) {
      return portfolioAnalysis.goal;
    }
    const aporte = goalMonthlyContribution > 0 ? goalMonthlyContribution : portfolioAnalysis.aporteAnalise;
    return projectGoal({
      metaRendaMensal: incomeGoal,
      patrimonio: portfolioAnalysis.total,
      aporteMensal: aporte,
      retornoAnualPct: portfolioAnalysis.retorno12m,
      ipcaAnualPct: portfolioAnalysis.ipca12m ?? 4.5,
      prazoAno: goalDeadlineYear,
    });
  }, [incomeGoal, portfolioAnalysis, goalMonthlyContribution, goalDeadlineYear]);

  const capitalProgress = path && path.capitalNecessario > 0
    ? Math.min(100, (grandTotal / path.capitalNecessario) * 100)
    : 0;
  const capitalReached = path != null && path.meses === 0;
  /** Mesma meta com o rendimento de um CDI líquido, para comparar com a carteira. */
  const conservador = useMemo(
    () => (path ? conservativeGoal(path, (Math.pow(1 + investorData.CDI_MENSAL, 12) - 1) * 100) : null),
    [path, investorData.CDI_MENSAL],
  );

  function startGoalEdit() {
    setIncomeGoalInput(incomeGoal > 0 ? toMoneyMask(incomeGoal) : "");
    setDeadlineInput(goalDeadlineYear ? String(goalDeadlineYear) : "");
    setAporteInput(goalMonthlyContribution > 0 ? toMoneyMask(goalMonthlyContribution) : "");
    setEditingGoal(true);
  }

  function cancelGoalEdit() {
    setIncomeGoalInput("");
    setDeadlineInput("");
    setAporteInput("");
    setEditingGoal(false);
  }

  async function saveGoal() {
    const v = parseGoal(incomeGoalInput);
    if (!(v > 0) || savingGoal) return;
    const yearRaw = deadlineInput.trim();
    const year = yearRaw ? Number(yearRaw) : null;
    if (yearRaw && (!Number.isInteger(year) || year! < thisYear || year! > thisYear + 50)) {
      toast.error(`Informe um ano entre ${thisYear} e ${thisYear + 50}.`);
      return;
    }
    const aporte = parseGoal(aporteInput);
    setSavingGoal(true);
    try {
      const body: Record<string, number | null> = {
        goal_target: v,
        goal_deadline_year: year,
        goal_monthly_contribution: aporte > 0 ? aporte : null,
      };
      const r = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      setIncomeGoal(v);
      setGoalDeadlineYear(year);
      setGoalMonthlyContribution(aporte > 0 ? aporte : 0);
      try { localStorage.setItem("ibank_income_goal", String(v)); } catch {}
      window.dispatchEvent(new CustomEvent("ibank_goal_changed", { detail: v }));
      setIncomeGoalInput("");
      setDeadlineInput("");
      setAporteInput("");
      setEditingGoal(false);
      toast.success(`Meta de ${formatCurrency(v)} por mês salva`);
    } catch {
      toast.error("Não foi possível salvar a meta. Tente novamente.");
    } finally {
      setSavingGoal(false);
    }
  }

  const goalSummaryBits = [
    incomeGoal > 0 ? formatCurrency(incomeGoal) + "/mês" : null,
    goalDeadlineYear ? `até ${goalDeadlineYear}` : null,
    goalMonthlyContribution > 0 ? `aporte ${formatCurrency(goalMonthlyContribution)}` : null,
  ].filter(Boolean);

  const diagnosis = (() => {
    if (!portfolioAnalysis) {
      return (
        <div className="space-y-3" aria-busy="true">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">O que fazer agora</h2>
          <p className="text-xs text-muted-foreground">Analisando sua carteira pelo seu perfil de risco…</p>
          <div className="h-24 animate-pulse rounded-2xl bg-muted/40" />
          <div className="h-16 animate-pulse rounded-xl bg-muted/30" />
        </div>
      );
    }

    const { insights, nextMoves, score } = portfolioAnalysis;
    const levelColors: Record<string, string> = { critical: "#f87171", warning: "#fbbf24", ok: "#34d399", suggestion: "#a3a3a3" };
    const levelBgs: Record<string, string> = { critical: "border-red-500/20 bg-red-500/[0.06]", warning: "border-amber-500/20 bg-amber-500/[0.06]", ok: "border-emerald-500/20 bg-emerald-500/[0.06]", suggestion: "border-border bg-muted/30" };
    const levelLabels: Record<string, string> = { critical: "CRÍTICO", warning: "ATENÇÃO", ok: "OK", suggestion: "SUGESTÃO" };
    const critico = insights.some((i) => i.level === "critical");
    const saudavel = score >= 70 && !critico;
    const scoreColor = saudavel ? "#34d399" : score >= 40 ? "#fbbf24" : "#f87171";
    const scoreTitle = saudavel ? "Carteira saudável" : score >= 40 ? "Precisa de ajustes" : "Atenção necessária";

    return (
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">O que fazer agora</h2>

        <Reveal className="flex items-center gap-5 mb-8 rounded-2xl border border-border bg-card backdrop-blur-xl p-5">
          <div className="flex-shrink-0">
            <ProgressRing size={64} radius={28} stroke={6} progress={score} color={scoreColor}>
              {(inView) => <ScoreValue value={score} active={inView} color={scoreColor} />}
            </ProgressRing>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{scoreTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Nota pelos pontos de melhoria abaixo e pela distância da alocação-alvo do seu perfil</p>
          </div>
        </Reveal>

        {scoreHistory.length > 1 && (
          <Reveal className="mb-10">
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
          </Reveal>
        )}

        <div className="space-y-3 mb-10">
          {insights.map((ins, i) => (
            <Reveal key={i} delay={Math.min(i, 5) * 0.05} y={20} className={`rounded-xl border ${levelBgs[ins.level]} p-4 backdrop-blur-xl`}>
              <div className="flex items-start gap-2.5">
                <span
                  className="flex-shrink-0 rounded text-[10px] font-black px-1.5 py-0.5 mt-0.5"
                  style={{ background: levelColors[ins.level], color: "#0D0D0D" }}
                >
                  {levelLabels[ins.level]}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground/90 leading-snug">{ins.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ins.detail}</p>
                  </div>
                  {ins.onAction && (
                    <button
                      type="button"
                      onClick={ins.onAction}
                      className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-full px-3.5 py-2 min-h-11 sm:min-h-9 text-xs font-bold transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      style={{ background: levelColors[ins.level], color: "#0D0D0D" }}
                    >
                      {ins.actionLabel}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Onde aportar este mês</h3>
          <div className="rounded-2xl border border-border bg-card backdrop-blur-xl overflow-hidden">
            {nextMoves.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                {goalMonthlyContribution > 0
                  ? "Nenhum ajuste urgente este mês — a carteira já está alinhada ao perfil."
                  : "Defina seu aporte mensal na meta acima para eu distribuir o valor pelas classes do seu perfil."}
              </p>
            )}
            {nextMoves.map((m, i) => (
              <div key={i} className="flex items-start gap-3 p-4 border-b border-border last:border-b-0">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-muted/60 border border-border flex items-center justify-center text-xs font-black text-muted-foreground mt-0.5">
                  {m.prioridade}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground/90 leading-snug">{m.label}</p>
                    <span className="text-sm font-extrabold text-emerald-400 tabular-nums flex-shrink-0">
                      {m.valorTexto}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed break-words">{m.razao}</p>
                  <Link
                    href={actionHref({ kind: "investir", section: m.section, amount: m.valor })}
                    className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Aplicar {m.valorTexto}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    );
  })();

  const heroRingValue = (() => {
    if (!(incomeGoal > 0)) return { value: "—", suffix: "defina a meta de renda" };
    if (!path) return { value: "…", suffix: "calculando caminho" };
    if (capitalReached) return { value: "Pronto", suffix: "patrimônio já cobre a renda" };
    if (path.meses != null) {
      return {
        value: monthsLabel(path.meses),
        suffix: path.anoPrevisto
          ? `para gerar ${formatCurrency(incomeGoal)}/mês · ~${path.anoPrevisto}`
          : `para gerar ${formatCurrency(incomeGoal)}/mês`,
      };
    }
    return { value: "100+ anos", suffix: `para gerar ${formatCurrency(incomeGoal)}/mês neste ritmo` };
  })();

  return (
    <div className="relative min-h-full bg-background text-foreground overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-muted/50 blur-[140px]" />
        <div className="absolute top-1/3 -right-20 h-[400px] w-[400px] rounded-full bg-card blur-[130px]" />
        <div className="absolute bottom-0 left-1/2 h-[350px] w-[350px] rounded-full bg-muted/20 blur-[130px]" />
      </div>

      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-5 py-3 backdrop-blur-xl sm:px-8">
        <h1 className="text-sm font-black uppercase tracking-[0.2em] text-foreground shrink-0">Metas</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGenerateReport}
            className="flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 sm:px-4 text-xs sm:text-sm font-medium text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            PDF
          </button>
        </div>
      </div>

      <div className="relative mx-auto max-w-5xl px-5 sm:px-8 py-8 sm:py-12">
        {/* 1. Caminho até a meta */}
        <div className="flex flex-col items-center text-center mb-14 sm:mb-16">
          {incomeGoal > 0 ? (
            <>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight font-display text-foreground mb-1">
                Renda de {formatCurrency(incomeGoal)}
                <span className="text-base sm:text-lg font-bold text-muted-foreground">/mês</span>
              </h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                {goalMonthlyContribution > 0 ? (
                  <>
                    Com aporte de{" "}
                    <span className="font-bold tabular-nums text-foreground">{formatCurrency(goalMonthlyContribution)}</span>
                    /mês, é o tempo para o patrimônio gerar essa renda
                    {goalDeadlineYear ? <> · prazo {goalDeadlineYear}</> : null}
                  </>
                ) : (
                  <>
                    Tempo para o patrimônio gerar essa renda
                    {goalDeadlineYear ? <> · prazo {goalDeadlineYear}</> : null}
                    {" · "}defina o aporte para estimar
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Defina quanto quer receber por mês — e, se quiser, o ano e o aporte para eu calcular o caminho.
            </p>
          )}

          <div className="mb-4">
            <ProgressRing
              size={280}
              radius={118}
              stroke={6}
              progress={incomeGoal > 0 ? capitalProgress : 0}
              color={capitalReached ? "#34d399" : "hsl(var(--foreground))"}
              duration={1.8}
            >
              {(inView) => <HeroValue value={heroRingValue.value} suffix={heroRingValue.suffix} active={inView} />}
            </ProgressRing>
          </div>

          {incomeGoal > 0 && path && (
            <div className="mb-5 w-full max-w-md space-y-3 text-left">
              {capitalReached ? (
                <p className="text-sm text-muted-foreground">Patrimônio já cobre a renda-meta · alinhe a carteira no diagnóstico abaixo.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Falta acumular</span>
                    <span className="font-bold tabular-nums text-foreground">{capitalProgress.toFixed(0)}% já</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border/60" aria-hidden="true">
                    <div className="h-full rounded-full bg-foreground transition-all duration-500" style={{ width: `${capitalProgress}%` }} />
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-2xl font-black tabular-nums text-foreground">
                      {formatCurrency(showNominal && path.capitalNominal ? path.capitalNominal : path.capitalNecessario)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{showNominal ? "valor nominal" : "em valores de hoje"}</span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between gap-3">
                {path.capitalNominal ? (
                  <div role="group" aria-label="Forma de exibir o capital" className="inline-flex rounded-full border border-border p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      aria-pressed={!showNominal}
                      onClick={() => setShowNominal(false)}
                      className={`min-h-8 rounded-full px-3 transition-colors ${!showNominal ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      aria-pressed={showNominal}
                      onClick={() => setShowNominal(true)}
                      className={`min-h-8 rounded-full px-3 transition-colors ${showNominal ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Nominal
                    </button>
                  </div>
                ) : <span />}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent(EXPLAIN_GOAL_EVENT))}
                  className="inline-flex min-h-8 items-center rounded-full border border-border px-3.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Explique a conta
                </button>
              </div>

              {!capitalReached && (
                <dl className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Rendimento real</dt>
                    <dd className="mt-1 font-display text-base font-black tabular-nums text-foreground">{path.rendimentoRealAnualPct.toLocaleString("pt-BR")}% a.a.</dd>
                    <dd className="mt-0.5 text-[11px] text-muted-foreground">Líquido de IR, IPCA de {path.ipcaAnualPct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</dd>
                  </div>
                  {conservador && (
                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Só CDI líquido</dt>
                      <dd className="mt-1 font-display text-base font-black tabular-nums text-foreground">{formatCurrency(conservador.capitalNecessario)}</dd>
                      <dd className="mt-0.5 text-[11px] text-muted-foreground">
                        {conservador.meses === null ? "passa de 100 anos" : conservador.meses === 0 ? "já coberto" : formatMonths(conservador.meses)}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          )}

          {(rendaRegistrada > 0 || rendaEstimada > 0) && (
            <p className="text-xs text-muted-foreground mb-6 max-w-md leading-relaxed">
              Renda hoje:{" "}
              {rendaRegistrada > 0 && (
                <><span className="font-semibold text-foreground">{formatCurrency(rendaRegistrada)}</span> registrados</>
              )}
              {rendaRegistrada > 0 && rendaEstimada > 0 && " · "}
              {rendaEstimada > 0 && (
                <><span className="font-semibold text-foreground">{formatCurrency(rendaEstimada)}</span> estimados</>
              )}
              {" "}/mês
              {totalRendaMensal > 0 && incomeGoal > 0 && !capitalReached && (
                <> · faltam {formatCurrency(Math.max(0, incomeGoal - totalRendaMensal))} na renda corrente</>
              )}
            </p>
          )}

          {editingGoal ? (
            <form
              className="w-full max-w-md rounded-2xl border border-border bg-card p-4 text-left space-y-3"
              onSubmit={(e) => { e.preventDefault(); void saveGoal(); }}
              onKeyDown={(e) => { if (e.key === "Escape") cancelGoalEdit(); }}
            >
              <div>
                <label htmlFor="income-goal-input" className={LABEL_FIELD}>Meta mensal</label>
                <input
                  id="income-goal-input"
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  autoComplete="off"
                  placeholder="Ex.: 5.000"
                  disabled={savingGoal}
                  className={FIELD}
                  value={incomeGoalInput}
                  onChange={(e) => setIncomeGoalInput(maskMoney(e.target.value))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="goal-deadline-input" className={LABEL_FIELD}>Ano da meta</label>
                  <input
                    id="goal-deadline-input"
                    type="number"
                    inputMode="numeric"
                    min={thisYear}
                    max={thisYear + 50}
                    placeholder={String(thisYear + 10)}
                    disabled={savingGoal}
                    className={FIELD}
                    value={deadlineInput}
                    onChange={(e) => setDeadlineInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                </div>
                <div>
                  <label htmlFor="goal-aporte-input" className={LABEL_FIELD}>Aporte / mês</label>
                  <input
                    id="goal-aporte-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="Ex.: 1.000"
                    disabled={savingGoal}
                    className={FIELD}
                    value={aporteInput}
                    onChange={(e) => setAporteInput(maskMoney(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingGoal || !(parseGoal(incomeGoalInput) > 0)}
                  className="inline-flex flex-1 min-h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-sm font-bold text-background hover:bg-foreground/90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Salvar meta
                </button>
                <button
                  type="button"
                  onClick={cancelGoalEdit}
                  disabled={savingGoal}
                  aria-label="Cancelar edição da meta"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={startGoalEdit}
              className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-2.5 text-left text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Target className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
              {incomeGoal > 0 ? (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Meta</span>
                    <span className="block text-sm font-bold tabular-nums text-foreground">{goalSummaryBits.join(" · ")}</span>
                  </span>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span className="sr-only">Editar meta</span>
                </>
              ) : (
                <span className="text-sm font-medium">Definir meta</span>
              )}
            </button>
          )}
        </div>

        {/* 2. Caminho no perfil — substitui o simulador FII/Turbo/dividendos */}
        {incomeGoal > 0 && path && (
          <Reveal className="mb-14 sm:mb-16">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Caminho no perfil{portfolioAnalysis ? ` ${RISK_PROFILES[portfolioAnalysis.profile].label.toLowerCase()}` : ""}
            </h2>
            {capitalReached ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] backdrop-blur-xl p-6 text-center">
                <p className="flex items-center justify-center gap-2 text-lg font-bold text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  Capital da meta atingido
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  O patrimônio já sustenta {formatCurrency(incomeGoal)}/mês no rendimento real da carteira. Use o diagnóstico abaixo para alinhar a alocação.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border bg-card backdrop-blur-xl p-5 text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-2">Renda da meta em</p>
                  <p className="text-2xl font-extrabold tabular-nums text-foreground font-display">
                    {path.meses != null ? monthsLabel(path.meses) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {path.meses != null && path.anoPrevisto
                      ? `~${path.anoPrevisto} · com o aporte atual`
                      : goalMonthlyContribution > 0
                        ? "mais de 100 anos neste ritmo"
                        : "defina um aporte mensal"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card backdrop-blur-xl p-5 text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    {goalDeadlineYear ? `Aporte para ${goalDeadlineYear}` : "Aporte sugerido"}
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums text-foreground font-display">
                    {path.aporteParaPrazo != null
                      ? formatCurrency(path.aporteParaPrazo)
                      : goalMonthlyContribution > 0
                        ? formatCurrency(goalMonthlyContribution)
                        : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {path.noPrazo === false && path.aporteParaPrazo != null && goalMonthlyContribution > 0
                      ? `faltam ${formatCurrency(Math.max(0, path.aporteParaPrazo - goalMonthlyContribution))}/mês vs seu aporte`
                      : path.noPrazo
                        ? "você chega no prazo com o aporte atual"
                        : "com o retorno real esperado da carteira"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card backdrop-blur-xl p-5 text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-2">Capital necessário</p>
                  <p className="text-2xl font-extrabold tabular-nums text-foreground font-display">
                    {formatCurrency(path.capitalNecessario)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    valores de hoje · ~{path.rendimentoRealAnualPct.toLocaleString("pt-BR")}% a.a. acima da inflação
                  </p>
                </div>
              </div>
            )}
            {path.noPrazo === false && goalDeadlineYear && path.aporteParaPrazo != null && (
              <p className="mt-4 text-center text-xs text-amber-600 dark:text-amber-400">
                No ritmo atual você passa de {goalDeadlineYear}. Aumente o aporte ou ajuste o prazo.
              </p>
            )}
          </Reveal>
        )}

        {/* 3. Diagnóstico / aportes */}
        <Reveal className="mb-14 sm:mb-16">
          {diagnosis}
        </Reveal>

        {/* 4. Detalhes — fontes, evolução, alocação */}
        <Reveal className="mb-14 sm:mb-16">
          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={detailsOpen}
          >
            <div>
              <p className="text-sm font-bold text-foreground">Fontes, evolução e alocação</p>
              <p className="text-xs text-muted-foreground mt-0.5">Detalhes da carteira — abra quando quiser aprofundar</p>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform ${detailsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>

          {detailsOpen && (
            <div className="mt-6 space-y-14">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Fontes de renda</h3>
                {allSources.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">Nenhuma fonte de renda identificada ainda.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {allSources.map((src, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-border bg-card backdrop-blur-xl p-5 transition-colors hover:bg-muted/60 hover:border-border"
                      >
                        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{src.tipo}</p>
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${
                            src.origem === "registrado"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {src.origem === "registrado" ? "Registrado" : "Estimado"}
                          </span>
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

              {chartMonths.length > 0 && (
                <div>
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

              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Alocação atual e alvo{portfolioAnalysis ? ` do perfil ${RISK_PROFILES[portfolioAnalysis.profile].label.toLowerCase()}` : ""}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {portfolioAnalysis
                    ? `Percentuais sobre ${formatCurrency(portfolioAnalysis.investido)} fora da reserva de emergência.${portfolioAnalysis.profileDefinido ? "" : " Perfil moderado usado como padrão; escolha o seu no assistente."}`
                    : "Calculando pelo seu perfil de risco…"}
                </p>
                <div className="rounded-2xl border border-border bg-card backdrop-blur-xl p-5 sm:p-6 space-y-6">
                  {!portfolioAnalysis && <div className="h-40 animate-pulse rounded-xl bg-muted/40" aria-hidden="true" />}
                  {portfolioAnalysis && !portfolioAnalysis.alocacaoRelevante && (
                    <p className="text-sm text-muted-foreground">
                      Com {formatCurrency(portfolioAnalysis.investido)} fora da reserva, ainda não faz sentido comparar percentuais. Complete a reserva primeiro; depois os aportes seguem o alvo do perfil.
                    </p>
                  )}
                  {portfolioAnalysis?.alocacaoRelevante && portfolioAnalysis.allocation.map((r) => (
                    <div key={r.label} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: r.cor }} />
                          <span className="font-semibold text-foreground/90">{r.label}</span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">{r.desc}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="tabular-nums font-bold" style={{ color: r.cor }}>{r.atual.toFixed(1)}%</span>
                          <span className="text-muted-foreground">alvo {Math.round(r.ideal)}%</span>
                          <span className={`inline-flex items-center font-bold ${r.atual >= r.ideal ? "text-emerald-400" : "text-amber-400"}`}>
                            {r.atual >= r.ideal
                              ? <><Check className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">No alvo</span></>
                              : `faltam ${(r.ideal - r.atual).toFixed(0)} pontos`}
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
            </div>
          )}
        </Reveal>

        {/* Espaço para o botão flutuante do Muvo não cobrir o fim da página. */}
        <div className="h-24" />
      </div>

      <InvestorBot
        context={botContext}
        dataVersion={botDataVersion}
        onGeneratePdf={onGenerateReport}
      />
    </div>
  );
}
