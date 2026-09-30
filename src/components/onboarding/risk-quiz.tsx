"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { formatBRLMask, parseBRLMask } from "@/components/investimentos/live-money-sheets";
import type { RefObject } from "react";
import { BUCKET_LABEL, RISK_PROFILES, type InvestBucket, type RiskProfile } from "@/lib/rebalance";
import { OBJETIVO_LABEL, QUIZ_QUESTIONS, scoreQuiz, type QuizAnswers, type QuizResult } from "@/lib/risk-quiz";
import { cn, formatCurrency } from "@/lib/utils";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const BUCKETS: InvestBucket[] = ["pos", "inflacao", "prefixado", "fiis", "acoes"];
const SHADE: Record<InvestBucket, string> = {
  pos: "bg-foreground",
  inflacao: "bg-foreground/70",
  prefixado: "bg-foreground/45",
  fiis: "bg-foreground/25",
  acoes: "bg-foreground/10",
};
const NUMBERS_STEP = QUIZ_QUESTIONS.length;
const TOTAL_STEPS = QUIZ_QUESTIONS.length + 1;

export type RiskQuizDone = { profile: RiskProfile; objetivo: string } | null;

/**
 * Passo a passo que define o perfil de risco usado pelo rebalanceamento.
 * `first`: primeiro acesso, com opção de pular. `retake`: refeito em Configurações.
 */
export function RiskQuiz({ mode, name, onDone }: { mode: "first" | "retake"; name?: string; onDone: (r: RiskQuizDone) => void }) {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [gasto, setGasto] = useState("");
  const [aporte, setAporte] = useState("");
  const [chosen, setChosen] = useState<RiskProfile | null>(null);
  const [changing, setChanging] = useState(false);
  const [saving, setSaving] = useState<"save" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const result: QuizResult | null = useMemo(() => scoreQuiz(answers), [answers]);
  const showResult = step >= TOTAL_STEPS && result;
  const profile = chosen ?? result?.profile ?? "moderado";

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  function pick(qid: string, optionId: string) {
    setAnswers((a) => ({ ...a, [qid]: optionId }));
    window.setTimeout(() => setStep((s) => s + 1), 160);
  }

  async function submit(skip: boolean) {
    setSaving(skip ? "skip" : "save");
    setError(null);
    try {
      const res = await fetch("/api/risk-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          skip
            ? { skip: true }
            : { answers, profile, gasto: parseBRLMask(gasto) || null, aporte: parseBRLMask(aporte) || null },
        ),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Não foi possível salvar. Tente de novo.");
      if (!skip) {
        window.dispatchEvent(new CustomEvent("muvo_profile_changed", { detail: profile }));
        if (parseBRLMask(aporte) > 0) window.dispatchEvent(new Event("ibank_goal_changed"));
      }
      onDone(skip ? null : { profile, objetivo: data.objetivo });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar. Tente de novo.");
      setSaving(null);
    }
  }

  const first = name?.split(" ")[0];
  const progress = step < 0 ? 0 : Math.min(step, TOTAL_STEPS) / TOTAL_STEPS;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground safe-pt safe-pb selection:bg-foreground selection:text-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-5 pb-8 pt-6 md:pt-12">
        <header className="flex items-center justify-between gap-4">
          {step > -1 && !showResult ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className={cn("-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", FOCUS)}
              aria-label="Voltar para a pergunta anterior"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : (
            <BrandLockup className="h-8" priority />
          )}
          {!showResult && (
            <button
              type="button"
              onClick={() => (mode === "first" ? void submit(true) : onDone(null))}
              disabled={saving !== null}
              className={cn("min-h-11 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50", FOCUS)}
            >
              {mode === "retake" ? "Cancelar" : saving === "skip" ? "Pulando…" : "Pular por agora"}
            </button>
          )}
        </header>

        {step > -1 && !showResult && (
          <div className="mt-5 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-out" style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {Math.min(step + 1, TOTAL_STEPS)} de {TOTAL_STEPS}
            </span>
          </div>
        )}

        <main key={showResult ? "resultado" : step} className="muvo-reveal motion-reduce:animate-none flex flex-1 flex-col pt-10 md:pt-14">
          {step === -1 && (
            <>
              <h1 ref={headingRef} tabIndex={-1} className="font-display text-[2.5rem] font-extrabold leading-[1.02] tracking-[-0.03em] outline-none text-balance md:text-5xl">
                {first ? `${first}, vamos montar o seu perfil de investidor.` : "Vamos montar o seu perfil de investidor."}
              </h1>
              <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-muted-foreground">
                São {TOTAL_STEPS} perguntas rápidas. Com elas o MUVO define quanto da sua carteira vai para segurança e quanto para crescimento, e o rebalanceamento passa a seguir o que combina com você.
              </p>
              <div className="mt-auto pt-10">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className={cn("flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-base font-semibold text-background transition-opacity hover:opacity-90 active:opacity-80", FOCUS)}
                >
                  Começar
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
                <p className="mt-3 text-center text-xs text-muted-foreground">Leva cerca de 1 minuto. Dá para refazer em Configurações.</p>
              </div>
            </>
          )}

          {step >= 0 && step < NUMBERS_STEP && (() => {
            const q = QUIZ_QUESTIONS[step];
            return (
              <fieldset className="flex flex-col">
                <legend className="contents">
                  <h1 ref={headingRef} tabIndex={-1} className="font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.03em] outline-none text-balance md:text-[2.5rem]">
                    {q.titulo}
                  </h1>
                </legend>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{q.ajuda}</p>
                <div role="radiogroup" aria-label={q.titulo} className="mt-8 flex flex-col gap-2">
                  {q.opcoes.map((o) => {
                    const on = answers[q.id] === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => pick(q.id, o.id)}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.99]",
                          on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/40",
                          FOCUS,
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold leading-snug">{o.label}</span>
                          {o.detalhe && <span className={cn("mt-0.5 block text-xs", on ? "text-background/70" : "text-muted-foreground")}>{o.detalhe}</span>}
                        </span>
                        <span
                          className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", on ? "border-background bg-background text-foreground" : "border-border")}
                          aria-hidden="true"
                        >
                          {on && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })()}

          {step === NUMBERS_STEP && (
            <form
              className="flex flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                setStep(TOTAL_STEPS);
              }}
            >
              <h1 ref={headingRef} tabIndex={-1} className="font-display text-[2rem] font-extrabold leading-[1.05] tracking-[-0.03em] outline-none text-balance md:text-[2.5rem]">
                Para fechar, dois números.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Servem para calcular o tamanho da sua reserva de emergência e dividir o aporte. Pode deixar em branco e preencher depois.
              </p>
              <div className="mt-8 space-y-5">
                <MoneyField id="quiz-gasto" label="Quanto você gasta por mês?" hint="Contas, mercado, aluguel: o custo de vida." value={gasto} onChange={setGasto} />
                <MoneyField id="quiz-aporte" label="Quanto pode investir por mês?" hint="O valor que sobra para aplicar, em média." value={aporte} onChange={setAporte} />
              </div>
              <div className="mt-auto pt-10">
                <button
                  type="submit"
                  className={cn("flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-base font-semibold text-background transition-opacity hover:opacity-90 active:opacity-80", FOCUS)}
                >
                  Ver meu perfil
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </form>
          )}

          {showResult && result && (
            <ResultView
              result={result}
              profile={profile}
              changing={changing}
              gasto={parseBRLMask(gasto)}
              aporte={parseBRLMask(aporte)}
              headingRef={headingRef}
              onChange={(p) => {
                setChosen(p === result.profile ? null : p);
                setChanging(false);
              }}
              onToggleChange={() => setChanging((v) => !v)}
              onBack={() => setStep(NUMBERS_STEP)}
              onConfirm={() => void submit(false)}
              saving={saving === "save"}
              error={error}
            />
          )}

          {error && !showResult && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        </main>
      </div>
    </div>
  );
}

function MoneyField({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      <p id={`${id}-hint`} className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      <div className="mt-2 flex min-h-14 items-center gap-2 rounded-2xl border border-border bg-card px-4 transition-colors focus-within:border-foreground">
        <span className="text-sm font-medium text-muted-foreground" aria-hidden="true">R$</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          aria-describedby={`${id}-hint`}
          placeholder="0,00"
          value={value}
          onChange={(e) => onChange(formatBRLMask(e.target.value))}
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold tabular-nums caret-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </div>
    </div>
  );
}

function ResultView({
  result, profile, changing, gasto, aporte, headingRef, onChange, onToggleChange, onBack, onConfirm, saving, error,
}: {
  result: QuizResult;
  profile: RiskProfile;
  changing: boolean;
  gasto: number;
  aporte: number;
  headingRef: RefObject<HTMLHeadingElement>;
  onChange: (p: RiskProfile) => void;
  onToggleChange: () => void;
  onBack: () => void;
  onConfirm: () => void;
  saving: boolean;
  error: string | null;
}) {
  const cfg = RISK_PROFILES[profile];
  const trocado = profile !== result.profile;
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-sm text-muted-foreground">
        {trocado ? `O questionário indicou ${RISK_PROFILES[result.profile].label.toLowerCase()}. Você escolheu:` : "Seu perfil de investidor é"}
      </p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-1 font-display text-[3.25rem] font-extrabold leading-none tracking-[-0.035em] outline-none md:text-6xl">
        {cfg.label}
      </h1>
      <p className="mt-3 text-base text-foreground/80">{cfg.descricao} Objetivo: {OBJETIVO_LABEL[result.objetivo].toLowerCase()}.</p>

      {!trocado && result.motivos.length > 0 && (
        <ul className="mt-6 space-y-2">
          {result.motivos.map((m) => (
            <li key={m} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
              <span>{m}</span>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-8" aria-labelledby="quiz-alocacao">
        <h2 id="quiz-alocacao" className="text-sm font-semibold">
          Como o rebalanceamento vai dividir seus investimentos
        </h2>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full" aria-hidden="true">
          {BUCKETS.map((b) => (
            <div key={b} className={cn(SHADE[b], "transition-[width] duration-500 ease-out")} style={{ width: `${cfg.alvo[b] * 100}%` }} />
          ))}
        </div>
        <ul className="mt-3 divide-y divide-border">
          {BUCKETS.map((b) => (
            <li key={b} className="flex items-center gap-3 py-2.5 text-sm">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border", SHADE[b])} aria-hidden="true" />
              <span className="min-w-0 flex-1">{BUCKET_LABEL[b]}</span>
              {aporte > 0 && <span className="tabular-nums text-muted-foreground">{formatCurrency(aporte * cfg.alvo[b])} por mês</span>}
              <span className="w-10 text-right font-semibold tabular-nums">{Math.round(cfg.alvo[b] * 100)}%</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Antes disso, a reserva de emergência: {cfg.reservaMeses} meses de gastos
          {gasto > 0 ? `, ou ${formatCurrency(gasto * cfg.reservaMeses)}` : ""}, em aplicação com resgate diário.
        </p>
      </section>

      {changing && (
        <div role="radiogroup" aria-label="Escolher outro perfil" className="mt-6 grid grid-cols-3 gap-2">
          {(Object.keys(RISK_PROFILES) as RiskProfile[]).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={p === profile}
              onClick={() => onChange(p)}
              className={cn(
                "min-h-12 rounded-xl border text-sm font-semibold transition-colors",
                p === profile ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/40",
                FOCUS,
              )}
            >
              {RISK_PROFILES[p].label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-auto pt-10">
        {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className={cn("flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-base font-semibold text-background transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60", FOCUS)}
        >
          {saving ? "Salvando…" : `Confirmar perfil ${cfg.label.toLowerCase()}`}
        </button>
        <div className="mt-2 flex items-center justify-between gap-2">
          <button type="button" onClick={onBack} className={cn("min-h-11 rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-foreground", FOCUS)}>
            Revisar respostas
          </button>
          <button type="button" onClick={onToggleChange} aria-expanded={changing} className={cn("min-h-11 rounded-full px-3 text-sm font-medium text-muted-foreground hover:text-foreground", FOCUS)}>
            {changing ? "Manter este" : "Prefiro outro perfil"}
          </button>
        </div>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Análise educativa, não é recomendação de investimento.
        </p>
      </div>
    </div>
  );
}
