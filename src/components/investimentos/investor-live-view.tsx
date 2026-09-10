"use client";

import { useEffect, useRef, useState } from "react";
import { X, Signal, Wifi, BatteryFull } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type IncomeSource = {
  nome: string;
  tipo: string;
  rendaMensal: number;
  cor: string;
};

export type InvestorLiveViewProps = {
  totalRendaMensal: number;
  incomeGoal: number;
  allSources: IncomeSource[];
  chartMonths: { label: string; "Renda recebida": number }[];
  score: number;
  grandTotal: number;
  onClose: () => void;
};

const SLIDE_DURATION_MS = 6000;

function useCountUp(target: number, durationMs = 1400, active = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) { setValue(0); return; }
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, active]);
  return value;
}

function PhoneStatusBar() {
  const [time, setTime] = useState("");
  useEffect(() => {
    function update() {
      setTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    }
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center justify-between px-6 pt-3 pb-1 text-white text-[13px] font-semibold shrink-0">
      <span>{time}</span>
      <div className="flex items-center gap-1.5">
        <Signal className="h-3.5 w-3.5" />
        <Wifi className="h-3.5 w-3.5" />
        <BatteryFull className="h-4 w-4" />
      </div>
    </div>
  );
}

function HeroSlide({ totalRendaMensal, incomeGoal, active }: { totalRendaMensal: number; incomeGoal: number; active: boolean }) {
  const animated = useCountUp(totalRendaMensal, 1400, active);
  const goalProgress = incomeGoal > 0 ? Math.min((totalRendaMensal / incomeGoal) * 100, 100) : 0;
  const circumference = 2 * Math.PI * 88;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 mb-6">
        Sua renda passiva mensal
      </p>
      <div className="relative flex items-center justify-center" style={{ width: 210, height: 210 }}>
        <svg width="210" height="210" className="absolute inset-0 -rotate-90">
          <circle cx="105" cy="105" r="88" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          {incomeGoal > 0 && (
            <>
              <circle
                cx="105" cy="105" r="88" fill="none"
                stroke="url(#liveGoalGradient)" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={active ? circumference - (goalProgress / 100) * circumference : circumference}
                style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.33,1,0.68,1)" }}
              />
              <defs>
                <linearGradient id="liveGoalGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
            </>
          )}
        </svg>
        <div className="flex flex-col items-center px-4">
          <p className="text-[28px] font-black tabular-nums bg-gradient-to-br from-white via-violet-200 to-blue-300 bg-clip-text text-transparent leading-none text-center">
            {formatCurrency(animated)}
          </p>
          <p className="text-[11px] text-white/40 mt-2">por mês</p>
        </div>
      </div>
      {incomeGoal > 0 && (
        <p className="text-[13px] text-white/50 mt-6 text-center">
          <span className="font-bold text-white">{goalProgress.toFixed(0)}%</span> da meta de{" "}
          <span className="font-bold text-white">{formatCurrency(incomeGoal)}</span>
        </p>
      )}
    </div>
  );
}

function SourcesSlide({ allSources, active }: { allSources: IncomeSource[]; active: boolean }) {
  return (
    <div className="flex-1 flex flex-col justify-center px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 mb-5 text-center">
        Fontes de renda
      </p>
      <div className="space-y-3">
        {allSources.slice(0, 4).map((src, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 transition-all"
            style={{
              opacity: active ? 1 : 0,
              transform: active ? "translateY(0)" : "translateY(8px)",
              transitionDelay: `${i * 120}ms`,
              transitionDuration: "500ms",
            }}
          >
            <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full blur-2xl opacity-30" style={{ background: src.cor }} />
            <div className="relative flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: src.cor }} />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 truncate">{src.tipo}</p>
                </div>
                <p className="text-sm font-semibold text-white/90 truncate">{src.nome}</p>
              </div>
              <p className="text-base font-extrabold tabular-nums text-white shrink-0">+{formatCurrency(src.rendaMensal)}</p>
            </div>
          </div>
        ))}
        {allSources.length === 0 && (
          <p className="text-white/40 text-center text-sm py-8">Nenhuma fonte de renda identificada ainda.</p>
        )}
      </div>
    </div>
  );
}

function EvolutionSlide({ chartMonths, active }: { chartMonths: { label: string; "Renda recebida": number }[]; active: boolean }) {
  const max = Math.max(1, ...chartMonths.map((m) => m["Renda recebida"]));
  return (
    <div className="flex-1 flex flex-col justify-center px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 mb-5 text-center">
        Evolução da renda
      </p>
      {chartMonths.length === 0 ? (
        <p className="text-white/40 text-center text-sm py-8">Ainda sem histórico suficiente.</p>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5">
          <div className="flex items-end gap-2.5 h-40">
            {chartMonths.slice(-6).map((m, i) => {
              const pct = (m["Renda recebida"] / max) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 h-full">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-violet-600 to-blue-400"
                    style={{
                      height: active ? `${pct}%` : "0%",
                      transition: "height 900ms cubic-bezier(0.33,1,0.68,1)",
                      transitionDelay: `${i * 80}ms`,
                    }}
                  />
                  <span className="text-[9px] text-white/40">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreSlide({ score, grandTotal, active }: { score: number; grandTotal: number; active: boolean }) {
  const animatedScore = useCountUp(score, 1200, active);
  const scoreColor = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 78;
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 mb-6">
        Score da carteira
      </p>
      <div className="relative flex items-center justify-center" style={{ width: 190, height: 190 }}>
        <svg width="190" height="190" className="absolute inset-0 -rotate-90">
          <circle cx="95" cy="95" r="78" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          <circle
            cx="95" cy="95" r="78" fill="none" stroke={scoreColor} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={active ? circumference * (1 - score / 100) : circumference}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.33,1,0.68,1)" }}
          />
        </svg>
        <span className="text-4xl font-black tabular-nums" style={{ color: scoreColor }}>
          {Math.round(animatedScore)}
        </span>
      </div>
      <p className="text-sm font-bold text-white mt-6">
        {score >= 70 ? "Carteira saudável" : score >= 40 ? "Precisa de ajustes" : "Atenção necessária"}
      </p>
      <p className="text-[13px] text-white/40 mt-2 text-center">
        Patrimônio total: <span className="font-bold text-white/70">{formatCurrency(grandTotal)}</span>
      </p>
    </div>
  );
}

export function InvestorLiveView({
  totalRendaMensal,
  incomeGoal,
  allSources,
  chartMonths,
  score,
  grandTotal,
  onClose,
}: InvestorLiveViewProps) {
  const slides = ["hero", "sources", "evolution", "score"] as const;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>();
  const startRef = useRef<number>(performance.now());

  useEffect(() => {
    setProgress(0);
    startRef.current = performance.now();
  }, [index]);

  useEffect(() => {
    function tick(now: number) {
      if (!paused) {
        const elapsed = now - startRef.current;
        const pct = Math.min(1, elapsed / SLIDE_DURATION_MS);
        setProgress(pct);
        if (pct >= 1) {
          setIndex((prev) => (prev + 1) % slides.length);
        }
      } else {
        startRef.current = now - progress * SLIDE_DURATION_MS;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, slides.length]);

  function goTo(i: number) {
    setIndex((i + slides.length) % slides.length);
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center select-none">
      <div className="relative w-full h-full sm:w-[390px] sm:h-[844px] sm:rounded-[3rem] sm:border-[8px] sm:border-zinc-800 overflow-hidden bg-[#05050a]">
        {/* Mesh de fundo */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-violet-600/25 blur-[90px]" />
          <div className="absolute top-1/3 -right-24 h-64 w-64 rounded-full bg-blue-500/20 blur-[90px]" />
          <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-emerald-500/15 blur-[100px]" />
        </div>

        <div className="relative h-full flex flex-col">
          <PhoneStatusBar />

          {/* Progress bar estilo stories */}
          <div className="flex gap-1.5 px-4 pt-2 shrink-0">
            {slides.map((s, i) => (
              <div key={s} className="flex-1 h-[3px] rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{
                    width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">IBANK · Live</span>
            </div>
            <button
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Tap zones para navegar */}
          <div className="absolute inset-0 top-16 flex z-10">
            <div
              className="w-1/3 h-full"
              onClick={() => goTo(index - 1)}
              onPointerDown={() => setPaused(true)}
              onPointerUp={() => setPaused(false)}
              onPointerLeave={() => setPaused(false)}
            />
            <div className="w-1/3 h-full" />
            <div
              className="w-1/3 h-full"
              onClick={() => goTo(index + 1)}
              onPointerDown={() => setPaused(true)}
              onPointerUp={() => setPaused(false)}
              onPointerLeave={() => setPaused(false)}
            />
          </div>

          {/* Conteúdo do slide */}
          <div className="flex-1 flex flex-col relative z-0">
            {index === 0 && <HeroSlide totalRendaMensal={totalRendaMensal} incomeGoal={incomeGoal} active />}
            {index === 1 && <SourcesSlide allSources={allSources} active />}
            {index === 2 && <EvolutionSlide chartMonths={chartMonths} active />}
            {index === 3 && <ScoreSlide score={score} grandTotal={grandTotal} active />}
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-1 shrink-0">
            <div className="h-1 w-32 rounded-full bg-white/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
