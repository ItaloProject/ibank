"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { FOCUS } from "@/components/investimentos/live-ui";

export type SimPoint = { month: number; value: number; aportado: number };
type InicialSource = "patrimonio" | "saldo" | "manual";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Estado do simulador de rendimentos. O capital inicial acompanha o patrimônio ou o saldo até o usuário digitar outro valor. */
export function useSimulation(patrimonio: number, saldo: number) {
  const [source, setSource] = useState<InicialSource>("patrimonio");
  const [manual, setManual] = useState(0);
  const [mensal, setMensal] = useState(300);
  const [meses, setMeses] = useState(24);
  const [taxa, setTaxa] = useState(0.9);

  const inicial = round2(Math.max(0, source === "patrimonio" ? patrimonio : source === "saldo" ? saldo : manual));

  const data = useMemo(() => {
    const rate = taxa / 100;
    const pts: SimPoint[] = [{ month: 0, value: inicial, aportado: inicial }];
    let v = inicial;
    for (let m = 1; m <= meses; m++) {
      v = v * (1 + rate) + mensal;
      pts.push({ month: m, value: v, aportado: inicial + mensal * m });
    }
    return pts;
  }, [inicial, mensal, meses, taxa]);

  const final = data[data.length - 1]?.value ?? 0;
  const aportado = inicial + mensal * meses;
  const rendimento = final - aportado;

  return {
    inicial,
    source,
    setInicial: (v: number) => {
      setSource("manual");
      setManual(v);
    },
    pickSource: (s: Exclude<InicialSource, "manual">) => setSource(s),
    mensal,
    setMensal,
    meses,
    setMeses,
    taxa,
    setTaxa,
    data,
    final,
    aportado,
    rendimento,
    retornoPct: aportado > 0 ? (rendimento / aportado) * 100 : 0,
  };
}

export type SimFormat = "brl" | "meses" | "pct";

function parseNumber(raw: string): number {
  const clean = raw.replace(/[^\d,.]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) ? n : NaN;
}

function inputText(value: number, format: SimFormat): string {
  if (format === "meses") return String(Math.round(value));
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Rótulo dos extremos do controle, sem abreviações. */
export function limitLabel(value: number, format: SimFormat): string {
  if (format === "pct") return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if (format === "meses") {
    const anos = value / 12;
    return value >= 24 && Number.isInteger(anos) ? `${value} meses (${anos} anos)` : `${value} ${value === 1 ? "mês" : "meses"}`;
  }
  if (value >= 1_000_000) {
    const mi = value / 1_000_000;
    return `R$ ${mi.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${mi >= 2 ? "milhões" : "milhão"}`;
  }
  if (value >= 1000) return `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return formatCurrency(value);
}

/**
 * Parâmetro do simulador: campo para digitar o valor exato, botões de mais e menos,
 * controle deslizante e limites visíveis. O valor digitado pode passar do limite do controle até `typedMax`.
 */
export function SimParam({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  nudge = step,
  typedMax = max,
  format,
  children,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  nudge?: number;
  typedMax?: number;
  format: SimFormat;
  children?: React.ReactNode;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (v: number) => {
    const c = Math.min(typedMax, Math.max(min, v));
    return format === "meses" ? Math.round(c) : round2(c);
  };
  const type = (text: string) => {
    setDraft(text);
    const n = parseNumber(text);
    if (!Number.isNaN(n) && n >= min && n <= typedMax) onChange(clamp(n));
  };
  const commit = () => {
    if (draft === null) return;
    const n = parseNumber(draft);
    if (!Number.isNaN(n)) onChange(clamp(n));
    setDraft(null);
  };
  const bump = (dir: 1 | -1) => onChange(clamp(value + dir * nudge));
  const suffix = format === "meses" ? (value === 1 ? "mês" : "meses") : format === "pct" ? "%" : null;
  const stepBtn = cn(
    "h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors",
    FOCUS,
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label htmlFor={`${id}-input`} className="text-sm text-muted-foreground whitespace-nowrap">{label}</label>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => bump(-1)} disabled={value <= min} aria-label={`Diminuir ${label.toLowerCase()}`} className={stepBtn}>
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-1 h-9 rounded-lg border border-border bg-muted/40 px-2.5 focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-ring/30">
            {format === "brl" && <span className="text-xs text-muted-foreground">R$</span>}
            <input
              id={`${id}-input`}
              type="text"
              inputMode="decimal"
              value={draft ?? inputText(value, format)}
              onFocus={(e) => {
                setDraft(inputText(value, format));
                e.currentTarget.select();
              }}
              onChange={(e) => type(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setDraft(null);
                  e.currentTarget.blur();
                }
              }}
              className={cn(
                "bg-transparent text-right text-sm font-bold tabular-nums text-foreground focus:outline-none",
                format === "brl" ? "w-24" : "w-10",
              )}
            />
            {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
          </div>
          <button type="button" onClick={() => bump(1)} disabled={value >= typedMax} aria-label={`Aumentar ${label.toLowerCase()}`} className={stepBtn}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        aria-label={label}
        aria-valuetext={format === "brl" ? formatCurrency(value) : limitLabel(value, format)}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn("w-full h-6 accent-foreground cursor-pointer", FOCUS)}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums" aria-hidden="true">
        <span>{limitLabel(min, format)}</span>
        <span>{limitLabel(max, format)}</span>
      </div>
      {children}
    </div>
  );
}

/** Atalhos para o capital inicial: patrimônio atual, saldo em conta ou começar do zero. */
export function InicialShortcuts({
  sim,
  patrimonio,
  saldo,
}: {
  sim: ReturnType<typeof useSimulation>;
  patrimonio: number;
  saldo: number;
}) {
  const chip = (active: boolean) =>
    cn(
      "min-h-8 rounded-full border px-3 text-[11px] font-semibold transition-colors",
      FOCUS,
      active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted",
    );
  return (
    <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Atalhos para o capital inicial">
      <button type="button" aria-pressed={sim.source === "patrimonio"} onClick={() => sim.pickSource("patrimonio")} className={chip(sim.source === "patrimonio")}>
        Usar meu patrimônio ({formatCurrency(patrimonio)})
      </button>
      {saldo > 0 && (
        <button type="button" aria-pressed={sim.source === "saldo"} onClick={() => sim.pickSource("saldo")} className={chip(sim.source === "saldo")}>
          Usar saldo em conta ({formatCurrency(saldo)})
        </button>
      )}
      <button
        type="button"
        aria-pressed={sim.source === "manual" && sim.inicial === 0}
        onClick={() => sim.setInicial(0)}
        className={chip(sim.source === "manual" && sim.inicial === 0)}
      >
        Começar do zero
      </button>
    </div>
  );
}

/** Legenda do gráfico: dinheiro do bolso e rendimento. */
export function SimLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-foreground/30" aria-hidden="true" />
        Dinheiro que você aportou
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" />
        Rendimento dos juros
      </span>
    </div>
  );
}

/** Barras empilhadas: a parte de baixo é o total aportado; a de cima, o que os juros geraram. */
export function SimChart({ data, maxBars = 30, className }: { data: SimPoint[]; maxBars?: number; className?: string }) {
  const step = Math.max(1, Math.ceil(data.length / maxBars));
  const bars = data.filter((_, i) => i % step === 0 || i === data.length - 1);
  const max = Math.max(1, ...bars.map((p) => p.value));
  return (
    <div className={cn("flex items-end gap-[2px]", className)} aria-hidden="true">
      {bars.map((p) => {
        const juros = Math.max(0, p.value - p.aportado);
        return (
          <div key={p.month} className="flex-1 h-full relative group flex flex-col justify-end">
            <div className="rounded-t-sm bg-emerald-500 group-hover:bg-emerald-400 transition-colors" style={{ height: `${(juros / max) * 100}%` }} />
            <div
              className={cn("bg-foreground/30 group-hover:bg-foreground/45 transition-colors", juros / max < 0.01 && "rounded-t-sm")}
              style={{ height: `${Math.max(1, (Math.min(p.aportado, p.value) / max) * 100)}%` }}
            />
            <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
              <div className="bg-card border border-border text-foreground text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg space-y-0.5">
                <p className="text-muted-foreground">{p.month === 0 ? "Agora" : `Mês ${p.month}`}</p>
                <p className="font-bold tabular-nums">{formatCurrency(p.value)}</p>
                <p className="tabular-nums text-muted-foreground">Aportado: {formatCurrency(p.aportado)}</p>
                <p className="tabular-nums text-emerald-500">Juros: +{formatCurrency(juros)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
