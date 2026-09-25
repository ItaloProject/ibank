"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChevronDown, Target, Wallet } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { MarketResearchPayload } from "@/lib/market-research";
import { getInvestmentAccounts, getInvestments, getStockQuotes, getStockTrades, type StockQuote } from "@/lib/api";
import type { Investment, InvestmentAccount, StockTrade } from "@/types/database";
import { computePortfolioReturn } from "@/lib/portfolio-return";
import { PortfolioRateCard } from "./portfolio-rate-card";
import {
  INFLATION_ANNUAL, formatCompactBRL, formatDuration, monthsToReach, requiredMonthly, simulate, turningPoint,
  type SimInput,
} from "@/lib/simulator";

type Mode = "futuro" | "meta";
type State = {
  mode: Mode;
  inicial: number;
  aporte: number;
  taxa: number;
  anos: number;
  reais: boolean;
  renda: number;
  /** "carteira": taxa calculada da carteira real; "manual": slider/presets. */
  fonte: "carteira" | "manual";
  liquida: boolean;
};

const DEFAULTS: State = {
  mode: "futuro", inicial: 0, aporte: 1000, taxa: 12, anos: 15, reais: false, renda: 5000, fonte: "carteira", liquida: false,
};

type PortfolioData = {
  accounts: InvestmentAccount[];
  investments: Investment[];
  trades: StockTrade[];
  quotes: StockQuote[];
};
const STORAGE_KEY = "muvo_simular_v1";
const MILESTONES = [100_000, 250_000, 500_000, 1_000_000];

const LABEL = "text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

type RatePreset = { id: string; label: string; taxa: number };

function presetsFrom(rates?: MarketResearchPayload["rates"] | null): { presets: RatePreset[]; live: boolean } {
  const selic = rates?.selicAnual ?? 15;
  const cdi = rates?.cdiAnual ?? 14.9;
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    live: rates?.source === "bcb",
    presets: [
      { id: "poupanca", label: "Poupança", taxa: selic > 8.5 ? 6.2 : round(selic * 0.7) },
      { id: "selic", label: "Tesouro Selic", taxa: round(selic) },
      { id: "cdb", label: "CDB 110% CDI", taxa: round(cdi * 1.1) },
      { id: "acoes", label: "Ações (histórico)", taxa: 12 },
    ],
  };
}

function pct(n: number, digits = 1) {
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;
}

function axisBRL(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (v >= 1_000) return `${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return Math.round(v).toLocaleString("pt-BR");
}

function useTween(value: number, ms = 450) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 4);
      const v = a + (value - a) * eased;
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const settle = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      from.current = value;
      setShown(value);
    }, ms + 80);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
    };
  }, [value, ms]);
  return shown;
}

/* ── Controles ─────────────────────────────────────────────────── */

function MoneyField({
  label, value, onChange, max, sliderMax, step, hint, action,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
  sliderMax: number;
  step: number;
  hint?: string;
  action?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={LABEL}>{label}</label>
        {action}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
        <span className="text-sm text-muted-foreground">R$</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={value ? value.toLocaleString("pt-BR") : ""}
          placeholder="0"
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, "")) || 0;
            onChange(Math.min(max, n));
          }}
          className="h-11 min-w-0 flex-1 bg-transparent font-display text-xl font-black tabular-nums tracking-tight focus:outline-none md:h-10"
        />
      </div>
      <input
        type="range"
        min={0}
        max={sliderMax}
        step={step}
        value={Math.min(value, sliderMax)}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} (controle deslizante)`}
        className="mt-3 h-2 w-full cursor-pointer accent-foreground"
      />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Segmented({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const opts: { id: Mode; label: string }[] = [
    { id: "futuro", label: "Quanto vou ter" },
    { id: "meta", label: "Quanto aportar" },
  ];
  return (
    <div role="radiogroup" aria-label="Tipo de simulação" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-10 rounded-md px-2 text-xs font-semibold transition-colors",
            value === o.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            FOCUS,
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Gráfico ───────────────────────────────────────────────────── */

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: { ano: number; aportado: number; juros: number; saldo: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold">{p.ano === 0 ? "Hoje" : `Ano ${p.ano}`}</p>
      <p className="mt-1 font-display text-base font-black tabular-nums">{formatCurrency(p.saldo)}</p>
      <p className="mt-1 tabular-nums text-muted-foreground">Você investiu {formatCurrency(p.aportado)}</p>
      <p className="tabular-nums text-muted-foreground">Juros {formatCurrency(p.juros)}</p>
    </div>
  );
}

/* ── Página ────────────────────────────────────────────────────── */

export function IncomeSimulator() {
  const [s, setS] = useState<State>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [rates, setRates] = useState<MarketResearchPayload["rates"] | null>(null);
  const [fiiDy, setFiiDy] = useState<Record<string, number>>({});
  const [data, setData] = useState<PortfolioData | null>(null);
  const [goal, setGoal] = useState<number | null>(null);
  const [tableOpen, setTableOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setS({ ...DEFAULTS, ...(JSON.parse(saved) as Partial<State>) });
    } catch { /* padrão */ }
    setHydrated(true);
    fetch("/api/market-research").then((r) => (r.ok ? r.json() : null)).then((d: MarketResearchPayload | null) => {
      if (d?.rates) setRates(d.rates);
      const dy: Record<string, number> = {};
      for (const f of d?.fiis ?? []) {
        if (f.source === "brapi" && f.dy12mPct != null && f.dy12mPct > 0) dy[f.ticker] = f.dy12mPct;
      }
      setFiiDy(dy);
    }).catch(() => {});
    Promise.all([getInvestmentAccounts(), getInvestments(), getStockTrades(), getStockQuotes()])
      .then(([accounts, investments, trades, quotes]) => setData({ accounts, investments, trades, quotes }))
      .catch(() => {});
    fetch("/api/goals").then((r) => (r.ok ? r.json() : null)).then((d: { goal_target?: number | string } | null) => {
      const g = Number(d?.goal_target) || 0;
      if (g > 0) setGoal(g);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, [s, hydrated]);

  const set = <K extends keyof State>(k: K, v: State[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const { presets, live } = useMemo(() => presetsFrom(rates), [rates]);

  const cdiHoje = rates?.cdiAnual ?? 14.9;
  const ipca = rates?.ipca12m ?? INFLATION_ANNUAL * 100;
  const portfolio = useMemo(
    () => data
      ? computePortfolioReturn(data.accounts, data.investments, data.trades, data.quotes, {
        cdi: cdiHoje, selic: rates?.selicAnual ?? 15, ipca, fiiDy,
      })
      : null,
    [data, cdiHoje, rates?.selicAnual, ipca, fiiDy],
  );
  const taxaCarteira = portfolio ? Math.round(portfolio.media(s.anos, s.liquida) * 100) / 100 : null;
  const usandoCarteira = s.fonte === "carteira" && taxaCarteira != null;
  const taxa = usandoCarteira ? taxaCarteira : s.taxa;
  const setManual = (v: number) => setS((prev) => ({ ...prev, taxa: v, fonte: "manual" }));

  const base: Omit<SimInput, "aporte"> = { inicial: s.inicial, taxaAnual: taxa / 100, anos: s.anos, reais: s.reais };
  const rate = simulate({ ...base, aporte: 0, anos: 0 }).rate;
  const alvo = rate > 0 ? s.renda / rate : 0;
  const needed = s.mode === "meta" ? requiredMonthly(base, alvo) : 0;
  const aporteSim = s.mode === "meta" ? needed : s.aporte;
  const input: SimInput = { ...base, aporte: aporteSim };

  const { points } = useMemo(() => simulate(input), [input.inicial, input.aporte, input.taxaAnual, input.anos, input.reais]); // eslint-disable-line react-hooks/exhaustive-deps
  const final = points[points.length - 1];
  const virada = useMemo(() => turningPoint(input), [input.inicial, input.aporte, input.taxaAnual, input.reais]); // eslint-disable-line react-hooks/exhaustive-deps
  const ritmoAtual = s.mode === "meta" ? monthsToReach({ ...base, aporte: s.aporte }, alvo) : null;
  const milestones = useMemo(
    () => MILESTONES.map((v) => ({ v, m: monthsToReach(input, v) })),
    [input.inicial, input.aporte, input.taxaAnual, input.reais], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const heroValue = useTween(s.mode === "meta" ? needed : final.saldo);
  const jurosPct = final.saldo > 0 ? (final.juros / final.saldo) * 100 : 0;
  const viradaAno = virada != null ? Math.ceil(virada / 12) : null;
  const moneyWord = s.reais ? "em dinheiro de hoje" : "em valores nominais";

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      {/* Controles */}
      <section aria-label="Parâmetros da simulação" className="space-y-6 rounded-xl border bg-card p-5 lg:sticky lg:top-4">
        <Segmented value={s.mode} onChange={(m) => set("mode", m)} />

        {s.mode === "meta" && (
          <MoneyField
            label="Renda desejada por mês"
            value={s.renda}
            onChange={(v) => set("renda", v)}
            max={1_000_000}
            sliderMax={30_000}
            step={100}
            action={goal ? (
              <button
                type="button"
                onClick={() => set("renda", Math.round(goal))}
                className={cn("inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground", FOCUS)}
              >
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                Usar minha meta ({formatCurrency(goal)})
              </button>
            ) : null}
          />
        )}

        <MoneyField
          label={s.mode === "meta" ? "Seu aporte atual" : "Aporte por mês"}
          value={s.aporte}
          onChange={(v) => set("aporte", v)}
          max={1_000_000}
          sliderMax={10_000}
          step={50}
          hint={s.mode === "meta" ? "Usado para calcular em quanto tempo você chega lá no ritmo de hoje." : undefined}
        />

        <MoneyField
          label="Já tenho investido"
          value={s.inicial}
          onChange={(v) => set("inicial", v)}
          max={100_000_000}
          sliderMax={500_000}
          step={1000}
          action={portfolio && Math.abs(portfolio.total - s.inicial) >= 1 ? (
            <button
              type="button"
              onClick={() => set("inicial", Math.round(portfolio.total))}
              className={cn("inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground", FOCUS)}
            >
              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
              Usar minha carteira ({formatCompactBRL(portfolio.total)})
            </button>
          ) : null}
        />

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="sim-taxa" className={LABEL}>Rentabilidade ao ano</label>
            <span className="font-display text-xl font-black tabular-nums tracking-tight">{pct(taxa, 2)}</span>
          </div>
          <input
            id="sim-taxa"
            type="range"
            min={2}
            max={20}
            step={0.1}
            value={taxa}
            onChange={(e) => setManual(Number(e.target.value))}
            className="mt-3 h-2 w-full cursor-pointer accent-foreground"
          />
          {taxaCarteira != null && (
            <button
              type="button"
              onClick={() => set("fonte", "carteira")}
              aria-pressed={usandoCarteira}
              className={cn(
                "mt-3 flex w-full min-h-12 items-center justify-between gap-3 rounded-md border px-3 text-left transition-colors",
                usandoCarteira
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted",
                FOCUS,
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">Minha carteira</span>
                  <span className={cn("block truncate text-[11px]", usandoCarteira ? "opacity-70" : "text-muted-foreground")}>
                    Média em {s.anos} {s.anos === 1 ? "ano" : "anos"}{s.liquida ? ", líquida de IR" : ""}
                  </span>
                </span>
              </span>
              <span className="font-display text-base font-black tabular-nums">{pct(taxaCarteira, 2)}</span>
            </button>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map((p) => {
              const on = !usandoCarteira && Math.abs(s.taxa - p.taxa) < 0.05;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setManual(p.taxa)}
                  aria-pressed={on}
                  className={cn(
                    "min-h-9 rounded-md border px-2.5 text-[11px] font-semibold transition-colors",
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                    FOCUS,
                  )}
                >
                  {p.label} <span className="tabular-nums opacity-70">{pct(p.taxa)}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {portfolio ? (
              <>
                {usandoCarteira ? "Calculada com o que você tem investido hoje. " : ""}
                <button
                  type="button"
                  onClick={() => document.getElementById("sim-carteira")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  Ver o cálculo
                </button>
              </>
            ) : data ? (
              "Registre seus investimentos no MUVO LIVE para simular com a rentabilidade da sua carteira. "
            ) : null}
            {!portfolio && (live ? "Selic e CDI de hoje, pelo Banco Central. Ações: média histórica, sem garantia." : "Referências aproximadas.")}
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="sim-anos" className={LABEL}>Prazo</label>
            <span className="font-display text-xl font-black tabular-nums tracking-tight">{s.anos} {s.anos === 1 ? "ano" : "anos"}</span>
          </div>
          <input
            id="sim-anos"
            type="range"
            min={1}
            max={40}
            step={1}
            value={s.anos}
            onChange={(e) => set("anos", Number(e.target.value))}
            className="mt-3 h-2 w-full cursor-pointer accent-foreground"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={s.reais}
            onChange={(e) => set("reais", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-foreground"
          />
          <span>
            <span className="block text-sm font-medium">Em dinheiro de hoje</span>
            <span className="block text-[11px] text-muted-foreground">
              Desconta inflação de {pct(INFLATION_ANNUAL * 100)} ao ano, para comparar com o que R$ 1 compra hoje.
            </span>
          </span>
        </label>

        <div className="sticky bottom-[calc(var(--bottom-nav-offset)+0.75rem)] z-10 -mx-2 flex items-center justify-between gap-3 rounded-lg bg-foreground px-4 py-3 text-background shadow-lg lg:hidden">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">
              {s.mode === "meta" ? "Aporte necessário" : `Em ${s.anos} ${s.anos === 1 ? "ano" : "anos"}`}
            </p>
            <p className="truncate font-display text-lg font-black tabular-nums leading-tight">
              {formatCurrency(s.mode === "meta" ? needed : final.saldo)}{s.mode === "meta" && <span className="text-sm opacity-70">/mês</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById("sim-resultado")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex min-h-10 shrink-0 items-center gap-1 rounded-md border border-background/25 px-3 text-xs font-semibold hover:bg-background/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
          >
            Ver resultado <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Resultado */}
      <div className="min-w-0 space-y-6">
        <section id="sim-resultado" aria-live="polite" className="scroll-mt-4 rounded-xl border bg-card p-5 sm:p-7">
          {s.mode === "futuro" ? (
            <>
              <h2 className="text-sm font-medium text-muted-foreground">
                Em {s.anos} {s.anos === 1 ? "ano" : "anos"}, você terá
              </h2>
              <p className="mt-2 font-display text-4xl font-black leading-none tabular-nums tracking-tight sm:text-6xl">
                {formatCurrency(heroValue)}
              </p>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                Isso gera cerca de <strong className="font-semibold text-foreground">{formatCurrency(final.rendaMensal)} por mês</strong> de renda,
                sem tocar no que você juntou. Valores {moneyWord}.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-sm font-medium text-muted-foreground">
                Para viver de {formatCurrency(s.renda)} por mês em {s.anos} {s.anos === 1 ? "ano" : "anos"}, aporte
              </h2>
              <p className="mt-2 font-display text-4xl font-black leading-none tabular-nums tracking-tight sm:text-6xl">
                {needed > 0 ? formatCurrency(heroValue) : "R$ 0,00"}
                <span className="ml-1 text-lg font-bold text-muted-foreground sm:text-2xl">/mês</span>
              </p>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                {needed > 0 ? (
                  <>Você precisa juntar <strong className="font-semibold text-foreground">{formatCurrency(alvo)}</strong>. </>
                ) : (
                  <>O que você já tem investido chega lá sozinho. </>
                )}
                {s.aporte > 0 && (
                  ritmoAtual != null
                    ? <>No ritmo de hoje ({formatCurrency(s.aporte)}/mês), você chega lá em <strong className="font-semibold text-foreground">{formatDuration(ritmoAtual)}</strong>.</>
                    : <>No ritmo de hoje ({formatCurrency(s.aporte)}/mês), a meta fica fora de alcance.</>
                )}
              </p>
            </>
          )}

          {/* Composição */}
          <div className="mt-6">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full bg-foreground/30 transition-[width] duration-500 ease-out" style={{ width: `${100 - jurosPct}%` }} />
              <div className="h-full bg-foreground transition-[width] duration-500 ease-out" style={{ width: `${jurosPct}%` }} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-foreground/30" aria-hidden="true" />
                  Você investiu
                </dt>
                <dd className="mt-0.5 font-display text-lg font-black tabular-nums">{formatCompactBRL(final.aportado)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-foreground" aria-hidden="true" />
                  Os juros fizeram
                </dt>
                <dd className="mt-0.5 font-display text-lg font-black tabular-nums">
                  {formatCompactBRL(final.juros)}
                  <span className="ml-1.5 text-xs font-semibold text-muted-foreground">{pct(jurosPct, 0)} do total</span>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {portfolio && (
          <PortfolioRateCard
            portfolio={portfolio}
            anos={s.anos}
            liquida={s.liquida}
            onLiquida={(v) => set("liquida", v)}
            active={usandoCarteira}
            onUse={() => set("fonte", "carteira")}
            cdi={cdiHoje}
            ipca={ipca}
            updatedAt={rates?.updatedAt}
            live={live}
          />
        )}

        {/* Curva */}
        <section aria-label="Evolução do patrimônio" className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Evolução do patrimônio</h3>
            <p className="text-[11px] text-muted-foreground">Passe o dedo ou o mouse sobre a curva</p>
          </div>
          <div className="mt-4 h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="ano"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: number) => (v === 0 ? "hoje" : `${v}a`)}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  width={64}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={axisBRL}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "hsl(var(--foreground) / 0.3)" }} />
                <Area type="monotone" dataKey="aportado" stackId="1" stroke="hsl(var(--foreground) / 0.35)" fill="hsl(var(--foreground) / 0.12)" strokeWidth={1.5} isAnimationActive={false} />
                <Area type="monotone" dataKey="juros" stackId="1" stroke="hsl(var(--foreground))" fill="hsl(var(--foreground) / 0.45)" strokeWidth={2} isAnimationActive={false} />
                {viradaAno != null && viradaAno > 0 && viradaAno <= s.anos && (
                  <ReferenceLine
                    x={viradaAno}
                    stroke="hsl(var(--foreground) / 0.6)"
                    strokeDasharray="4 4"
                    label={{ value: "Virada", position: "insideTopLeft", fontSize: 11, fill: "hsl(var(--foreground))" }}
                  />
                )}
                {s.mode === "meta" && alvo > 0 && (
                  <ReferenceLine
                    y={alvo}
                    stroke="hsl(var(--foreground) / 0.6)"
                    strokeDasharray="2 4"
                    label={{ value: "Meta", position: "insideTopRight", fontSize: 11, fill: "hsl(var(--foreground))" }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {virada != null && (
            <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
              <strong className="font-semibold text-foreground">Ponto de virada: {virada === 0 ? "desde já" : formatDuration(virada)}.</strong>{" "}
              {virada <= s.anos * 12
                ? `A partir daí, os juros de cada mês rendem mais que o seu aporte de ${formatCurrency(aporteSim)}: o dinheiro passa a trabalhar mais que você.`
                : "Ainda fora do prazo escolhido; aumente o prazo ou o aporte para chegar lá antes."}
            </p>
          )}
        </section>

        {/* Marcos */}
        <section aria-label="Marcos de patrimônio" className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Quando você chega lá</h3>
          <ol className="mt-3 divide-y">
            {milestones.map(({ v, m }) => {
              const within = m != null && m <= s.anos * 12;
              return (
                <li key={v} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cn("h-2.5 w-2.5 shrink-0 rounded-full border-2", within ? "border-foreground bg-foreground" : "border-muted-foreground/50")}
                    aria-hidden="true"
                  />
                  <span className="flex-1 font-display text-base font-black tabular-nums">{formatCompactBRL(v)}</span>
                  <span className={cn("text-sm tabular-nums", within ? "font-semibold" : "text-muted-foreground")}>
                    {m == null ? "mais de 80 anos" : m === 0 ? "você já tem" : `em ${formatDuration(m)}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Ano a ano */}
        <section className="rounded-xl border bg-card">
          <button
            type="button"
            onClick={() => setTableOpen((v) => !v)}
            aria-expanded={tableOpen}
            aria-controls="sim-tabela"
            className={cn("flex w-full items-center justify-between gap-3 rounded-xl p-5 text-left", FOCUS)}
          >
            <span className="text-sm font-semibold">Ver ano a ano</span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", tableOpen && "rotate-180")} aria-hidden="true" />
          </button>
          {tableOpen && (
            <div id="sim-tabela" className="overflow-x-auto px-5 pb-5">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th scope="col" className="py-2 pr-2 text-left font-medium">Ano</th>
                    <th scope="col" className="py-2 px-2 text-right font-medium">Investido</th>
                    <th scope="col" className="py-2 px-2 text-right font-medium">Juros no ano</th>
                    <th scope="col" className="py-2 px-2 text-right font-medium">Saldo</th>
                    <th scope="col" className="py-2 pl-2 text-right font-medium">Renda/mês</th>
                  </tr>
                </thead>
                <tbody>
                  {points.slice(1).map((p) => (
                    <tr key={p.ano} className={cn("border-b border-border/50", p.ano === viradaAno && "bg-muted/60")}>
                      <th scope="row" className="py-2 pr-2 text-left font-medium">{p.ano}</th>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">{formatCurrency(p.aportado)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">+{formatCurrency(p.jurosNoAno)}</td>
                      <td className="py-2 px-2 text-right font-semibold tabular-nums">{formatCurrency(p.saldo)}</td>
                      <td className="py-2 pl-2 text-right tabular-nums">{formatCurrency(p.rendaMensal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-[11px] text-muted-foreground">
          Simulação ilustrativa com aporte no início de cada mês e rentabilidade de {pct(taxa, 2)} ao ano
          {usandoCarteira ? " (média esperada da sua carteira no prazo)" : ""}
          {s.reais ? `, descontada a inflação de ${pct(INFLATION_ANNUAL * 100)}` : ""}.{" "}
          {usandoCarteira && s.liquida ? "Já desconta o IR estimado; não considera taxas." : "Não considera impostos nem taxas."} Não é recomendação de investimento.
        </p>
      </div>
    </div>
  );
}
