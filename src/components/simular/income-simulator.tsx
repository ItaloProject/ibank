"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChevronDown, Target, Wallet } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { MarketResearchPayload } from "@/lib/market-research";
import { getInvestmentAccounts, getInvestments, getStockQuotes, getStockTrades, refreshStockQuotes, type StockQuote } from "@/lib/api";
import type { Investment, InvestmentAccount, StockTrade } from "@/types/database";
import { EQUITY_REAL_RETURN, buildPortfolio, scalePositions } from "@/lib/portfolio-return";
import { buildCurve, type Curve } from "@/lib/market-curve";
import { project, solveAporte, type MonthPoint, type Position, type Rule, type TaxMode } from "@/lib/projection";
import { PortfolioRateCard, type CurveInfo } from "./portfolio-rate-card";
import { INFLATION_ANNUAL, formatCompactBRL, formatDuration } from "@/lib/simulator";

type Mode = "futuro" | "meta";
type PresetId = "poupanca" | "selic" | "cdb" | "acoes";
type State = {
  mode: Mode;
  inicial: number;
  aporte: number;
  /** Taxa bruta (% a.a.) usada quando `fonte` é "manual". */
  taxa: number;
  anos: number;
  reais: boolean;
  renda: number;
  /** "carteira": posições reais do usuário; preset: produto de referência; "manual": taxa fixa do controle. */
  fonte: "carteira" | "manual" | PresetId;
  liquida: boolean;
};

const DEFAULTS: State = {
  mode: "futuro", inicial: 0, aporte: 1000, taxa: 12, anos: 15, reais: false, renda: 5000, fonte: "carteira", liquida: true,
};

type PortfolioData = {
  accounts: InvestmentAccount[];
  investments: Investment[];
  trades: StockTrade[];
  quotes: StockQuote[];
};
const STORAGE_KEY = "muvo_simular_v2";
const LEGACY_STORAGE_KEY = "muvo_simular_v1";
const MILESTONES = [100_000, 250_000, 500_000, 1_000_000];
/** Horizonte das buscas de marcos e ponto de virada. */
const HORIZON = 80 * 12;

const LABEL = "text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const PRESETS: { id: PresetId; label: string; rule: Rule; tax: TaxMode }[] = [
  { id: "poupanca", label: "Poupança", rule: { k: "poupanca" }, tax: "isento" },
  { id: "selic", label: "Tesouro Selic", rule: { k: "selic", spread: 0 }, tax: "regressivo" },
  { id: "cdb", label: "CDB 110% CDI", rule: { k: "cdi", pct: 110 }, tax: "regressivo" },
  { id: "acoes", label: "Ações", rule: { k: "ipca", spread: EQUITY_REAL_RETURN }, tax: "acoes" },
];

function single(rule: Rule, tax: TaxMode, valor: number): Position {
  return { id: "sim", valor, custo: valor, idadeMeses: 0, rule, vencimento: null, tax, pesoAporte: 1 };
}

/** Rentabilidade média anual (bruta e líquida) de manter as posições por `meses`, sem aportes. */
function averageReturn(positions: Position[], meses: number, curve: Curve): { bruta: number; liquida: number } {
  const r = project({ positions, aporte: 0, meses, curve });
  const a = r[0];
  const b = r[r.length - 1];
  const anual = (from: number, to: number) => (from > 0 && to > 0 ? (Math.pow(to / from, 12 / meses) - 1) * 100 : 0);
  return { bruta: anual(a.bruto, b.bruto), liquida: anual(a.liquido, b.liquido) };
}

function monthlyFromAnnual(a: number) {
  return Math.pow(1 + a / 100, 1 / 12) - 1;
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
  const [brapiDy, setBrapiDy] = useState<Record<string, number>>({});
  const [marketDy, setMarketDy] = useState<Record<string, number>>({});
  const [data, setData] = useState<PortfolioData | null>(null);
  const [goal, setGoal] = useState<number | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const autoInicial = useRef(false);

  const loadPortfolio = useCallback(() => {
    Promise.all([getInvestmentAccounts(), getInvestments(), getStockTrades(), getStockQuotes()])
      .then(([accounts, investments, trades, quotes]) => {
        setData({ accounts, investments, trades, quotes });
        refreshStockQuotes(trades, quotes)
          .then(({ quotes: fresh, market }) => {
            setData((prev) => (prev ? { ...prev, quotes: fresh } : prev));
            const dy: Record<string, number> = {};
            for (const q of market) if (q.dy12m > 0) dy[q.ticker] = q.dy12m;
            setMarketDy(dy);
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setS({ ...DEFAULTS, ...(JSON.parse(saved) as Partial<State>) });
      } else {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          const { liquida: _liquida, ...rest } = JSON.parse(legacy) as Partial<State>;
          setS({ ...DEFAULTS, ...rest });
        }
      }
    } catch { /* padrão */ }
    setHydrated(true);
    fetch("/api/market-research").then((r) => (r.ok ? r.json() : null)).then((d: MarketResearchPayload | null) => {
      if (d?.rates) setRates(d.rates);
      const dy: Record<string, number> = {};
      for (const f of d?.fiis ?? []) {
        if (f.source === "brapi" && f.dy12mPct != null && f.dy12mPct > 0) dy[f.ticker] = f.dy12mPct;
      }
      setBrapiDy(dy);
    }).catch(() => {});
    loadPortfolio();
    fetch("/api/goals").then((r) => (r.ok ? r.json() : null)).then((d: { goal_target?: number | string } | null) => {
      const g = Number(d?.goal_target) || 0;
      if (g > 0) setGoal(g);
    }).catch(() => {});
  }, [loadPortfolio]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, [s, hydrated]);

  const set = <K extends keyof State>(k: K, v: State[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const live = rates?.source === "bcb";

  const curve = useMemo(
    () => buildCurve({
      selic: rates?.selicAnual ?? 15,
      cdi: rates?.cdiAnual ?? 14.9,
      ipca12m: rates?.ipca12m ?? INFLATION_ANNUAL * 100,
      focus: rates?.focus,
    }, HORIZON + 12),
    [rates],
  );
  const fiiDy = useMemo(() => ({ ...brapiDy, ...marketDy }), [brapiDy, marketDy]);
  const portfolio = useMemo(
    () => (data ? buildPortfolio(data.accounts, data.investments, data.trades, data.quotes, curve, fiiDy) : null),
    [data, curve, fiiDy],
  );

  useEffect(() => {
    if (!hydrated || !portfolio || autoInicial.current) return;
    autoInicial.current = true;
    if (s.fonte === "carteira" && s.inicial === 0) set("inicial", Math.round(portfolio.total));
  }, [hydrated, portfolio]); // eslint-disable-line react-hooks/exhaustive-deps

  const N = s.anos * 12;
  const usandoCarteira = s.fonte === "carteira" && portfolio != null;
  const preset = PRESETS.find((p) => p.id === s.fonte) ?? null;
  const setManual = (v: number) => setS((prev) => ({ ...prev, taxa: v, fonte: "manual" }));

  const positions = useMemo<Position[]>(() => {
    if (usandoCarteira) return scalePositions(portfolio.positions, portfolio.total > 0 ? s.inicial / portfolio.total : 0);
    if (preset) return [single(preset.rule, preset.tax, s.inicial)];
    return [single({ k: "fixa", taxa: s.taxa }, "regressivo", s.inicial)];
  }, [usandoCarteira, portfolio, preset, s.inicial, s.taxa]);

  const mediaCarteira = useMemo(
    () => (portfolio ? averageReturn(portfolio.positions, N, curve) : null),
    [portfolio, N, curve],
  );
  const mediaPresets = useMemo(
    () => Object.fromEntries(PRESETS.map((p) => [p.id, averageReturn([single(p.rule, p.tax, 1000)], N, curve)])) as Record<PresetId, { bruta: number; liquida: number }>,
    [N, curve],
  );
  const mediaManual = useMemo(() => averageReturn([single({ k: "fixa", taxa: s.taxa }, "regressivo", 1000)], N, curve), [s.taxa, N, curve]);
  const media = usandoCarteira && mediaCarteira ? mediaCarteira : preset ? mediaPresets[preset.id] : mediaManual;
  const taxaBruta = s.fonte === "manual" || (!usandoCarteira && !preset) ? s.taxa : media.bruta;

  const unit = useCallback(
    (m: MonthPoint) => (s.liquida ? m.liquido : m.bruto) / (s.reais ? m.deflator : 1),
    [s.liquida, s.reais],
  );
  /** Taxa mensal que pode ser sacada como renda no mês `t`, sem reduzir o patrimônio (real quando `reais`). */
  const rendaTaxa = useCallback((arr: MonthPoint[], t: number) => {
    const i = Math.min(Math.max(1, t), arr.length - 1);
    let r = s.liquida ? arr[i].taxaMesLiquida : arr[i].taxaMes;
    if (s.reais) r = (1 + r) / (1 + monthlyFromAnnual(curve.ipca[Math.min(i - 1, curve.ipca.length - 1)])) - 1;
    return Math.max(0, r);
  }, [s.liquida, s.reais, curve]);

  const probe = useMemo(
    () => (s.mode === "meta"
      ? project({ positions, aporte: s.aporte > 0 ? s.aporte : 1000, meses: s.aporte > 0 ? HORIZON : N, curve, aporteCorrigido: s.reais })
      : null),
    [s.mode, positions, s.aporte, N, curve, s.reais],
  );
  const alvo = probe ? (rendaTaxa(probe, N) > 0 ? s.renda / rendaTaxa(probe, N) : 0) : 0;
  const neededRaw = useMemo(
    () => (s.mode === "meta" ? solveAporte({ positions, meses: N, curve, aporteCorrigido: s.reais }, alvo, unit) : 0),
    [s.mode, positions, N, curve, s.reais, alvo, unit],
  );
  const alcancavel = Number.isFinite(neededRaw);
  const needed = alcancavel ? Math.max(0, neededRaw) : 0;
  const aporteSim = s.mode === "meta" ? needed : s.aporte;

  const long = useMemo(
    () => project({ positions, aporte: aporteSim, meses: HORIZON, curve, aporteCorrigido: s.reais }),
    [positions, aporteSim, curve, s.reais],
  );

  const points = useMemo(() => {
    const inicial = long[0].aportado;
    const out: { ano: number; saldo: number; aportado: number; juros: number; jurosNoAno: number; rendaMensal: number; chartAportado: number; chartJuros: number }[] = [];
    for (let ano = 0; ano <= s.anos; ano++) {
      const t = ano * 12;
      const saldo = unit(long[t]);
      const aportado = s.reais ? inicial + aporteSim * t : long[t].aportado;
      const prev = out[ano - 1];
      const chartAportado = Math.min(aportado, saldo);
      out.push({
        ano,
        saldo,
        aportado,
        juros: saldo - aportado,
        jurosNoAno: prev ? saldo - prev.saldo - (aportado - prev.aportado) : 0,
        rendaMensal: saldo * rendaTaxa(long, t),
        chartAportado,
        chartJuros: saldo - chartAportado,
      });
    }
    return out;
  }, [long, s.anos, s.reais, aporteSim, unit, rendaTaxa]);
  const final = points[points.length - 1];

  const virada = useMemo(() => {
    if (!(aporteSim > 0)) return null;
    for (let t = 1; t < long.length; t++) if (long[t].jurosMes >= long[t].aporteMes) return t === 1 ? 0 : t;
    return null;
  }, [long, aporteSim]);
  const firstReach = (arr: MonthPoint[], v: number) => {
    for (let t = 0; t < arr.length; t++) if (unit(arr[t]) >= v) return t;
    return null;
  };
  const ritmoAtual = s.mode === "meta" && probe && s.aporte > 0 ? firstReach(probe, alvo) : null;
  const milestones = useMemo(
    () => MILESTONES.map((v) => ({ v, m: firstReach(long, v) })),
    [long, unit], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const hoje12m = portfolio
    ? portfolio.rows.reduce((acc, r) => acc + r.peso * r.taxa12m * (s.liquida ? 1 - r.irLongo : 1), 0)
    : 0;
  const curveInfo: CurveInfo = {
    source: curve.source,
    focusDate: rates?.focus?.data,
    selicHoje: curve.selic[0],
    cdiHoje: curve.cdi[0],
    selicLonga: curve.selic[curve.selic.length - 1],
    ipcaAno: curve.ipca[0],
    ipcaLongo: curve.ipca[curve.ipca.length - 1],
    live,
  };

  const heroValue = useTween(s.mode === "meta" ? needed : final.saldo);
  const jurosPct = final.saldo > 0 ? (Math.max(0, final.juros) / final.saldo) * 100 : 0;
  const viradaAno = virada != null ? Math.ceil(virada / 12) : null;
  const moneyWord = `${s.reais ? "em dinheiro de hoje" : "nominais"}${s.liquida ? ", já sem o imposto de renda" : ", antes do imposto de renda"}`;

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
            <span className="font-display text-xl font-black tabular-nums tracking-tight">{pct(taxaBruta, 2)}</span>
          </div>
          <input
            id="sim-taxa"
            type="range"
            min={0}
            max={20}
            step={0.1}
            value={Math.min(20, Math.max(0, Math.round(taxaBruta * 10) / 10))}
            onChange={(e) => setManual(Number(e.target.value))}
            aria-valuetext={`${pct(taxaBruta, 2)} ao ano, antes do imposto`}
            className="mt-3 h-2 w-full cursor-pointer accent-foreground"
          />
          {s.liquida && (
            <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
              Antes do IR. Líquida: <strong className="font-semibold text-foreground">{pct(media.liquida, 2)} ao ano</strong> em média no prazo.
            </p>
          )}
          {mediaCarteira != null && (
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
                    Média em {s.anos} {s.anos === 1 ? "ano" : "anos"}, posição por posição
                  </span>
                </span>
              </span>
              <span className="font-display text-base font-black tabular-nums">{pct(mediaCarteira.bruta, 2)}</span>
            </button>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const on = s.fonte === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set("fonte", p.id)}
                  aria-pressed={on}
                  className={cn(
                    "min-h-9 rounded-md border px-2.5 text-[11px] font-semibold transition-colors",
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                    FOCUS,
                  )}
                >
                  {p.label} <span className="tabular-nums opacity-70">{pct(mediaPresets[p.id].bruta)}</span>
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
            {!portfolio && (live
              ? `Juros e inflação futuros pelo ${curve.source === "focus" ? "Boletim Focus" : "Banco Central"}. Ações: IPCA + ${EQUITY_REAL_RETURN}%, sem garantia.`
              : "Referências aproximadas.")}
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
              Desconta a inflação projetada ({pct(curveInfo.ipcaAno)} este ano, {pct(curveInfo.ipcaLongo)} no longo prazo) e reajusta o aporte por ela.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={s.liquida}
            onChange={(e) => set("liquida", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-foreground"
          />
          <span>
            <span className="block text-sm font-medium">Descontar imposto de renda</span>
            <span className="block text-[11px] text-muted-foreground">
              Valor que sobraria no resgate: tabela regressiva de 22,5% a 15% por aporte; ações 15%; poupança, LCI, LCA e FIIs isentos.
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
                {!alcancavel ? "Fora de alcance" : needed > 0 ? formatCurrency(heroValue) : "R$ 0,00"}
                {alcancavel && <span className="ml-1 text-lg font-bold text-muted-foreground sm:text-2xl">/mês</span>}
              </p>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground">
                {!alcancavel ? (
                  <>Com essa rentabilidade, nenhum aporte chega lá no prazo. Aumente o prazo ou escolha outra rentabilidade. </>
                ) : needed > 0 ? (
                  <>Você precisa juntar <strong className="font-semibold text-foreground">{formatCurrency(alvo)}</strong>. </>
                ) : (
                  <>O que você já tem investido chega lá sozinho. </>
                )}
                {s.aporte > 0 && (
                  ritmoAtual != null
                    ? <>No ritmo de hoje ({formatCurrency(s.aporte)}/mês), você chega lá em <strong className="font-semibold text-foreground">{formatDuration(ritmoAtual)}</strong>.</>
                    : <>No ritmo de hoje ({formatCurrency(s.aporte)}/mês), a meta fica fora de alcance.</>
                )}{" "}
                Valores {moneyWord}.
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
            media={mediaCarteira ? (s.liquida ? mediaCarteira.liquida : mediaCarteira.bruta) : 0}
            hoje={hoje12m}
            active={usandoCarteira}
            onUse={() => set("fonte", "carteira")}
            curve={curveInfo}
            onRatesChanged={loadPortfolio}
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
                <Area type="monotone" dataKey="chartAportado" stackId="1" stroke="hsl(var(--foreground) / 0.35)" fill="hsl(var(--foreground) / 0.12)" strokeWidth={1.5} isAnimationActive={false} />
                <Area type="monotone" dataKey="chartJuros" stackId="1" stroke="hsl(var(--foreground))" fill="hsl(var(--foreground) / 0.45)" strokeWidth={2} isAnimationActive={false} />
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
                      <td className="py-2 px-2 text-right tabular-nums">{p.jurosNoAno >= 0 ? "+" : "−"}{formatCurrency(Math.abs(p.jurosNoAno))}</td>
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
          Simulação mês a mês{usandoCarteira ? ", posição por posição da sua carteira" : ""}, com aporte no início de cada mês
          {s.reais ? " reajustado pela inflação" : ""}. Juros e inflação futuros{" "}
          {curve.source === "focus" ? "seguem as expectativas do Boletim Focus (Banco Central)" : "convergem ao juro neutro em 3 anos"}.{" "}
          {s.liquida ? "Valores líquidos de IR, como se tudo fosse resgatado na data; " : "Valores antes do IR; "}
          não considera taxas de administração ou custódia. Não é recomendação de investimento.
        </p>
      </div>
    </div>
  );
}
