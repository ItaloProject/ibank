"use client";

import { useEffect, useId, useRef } from "react";
import { FOCUS, INPUT_BOX, LABEL } from "@/components/investimentos/live-ui";
import { HelpTip } from "@/components/ui/help-tip";
import { RATE_INDEXES, taxRuleFromName, type AccountRate, type RateIndex, type TaxRule } from "@/lib/account-rate";
import { rateHintFromName, type RateHint } from "@/lib/rate-hints";
import { useTesouroLive } from "@/lib/use-tesouro-live";

function TaxBadge({ exempt, text }: { exempt: boolean; text: string }) {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground" aria-live="polite">
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
          exempt ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-foreground/80"
        }`}
      >
        {exempt ? "Isento de Imposto de Renda" : "Paga Imposto de Renda"}
      </span>
      <span className="min-w-0">{text}</span>
    </p>
  );
}

/** Campos `*Manual`: o usuário mexeu no campo e ele não deve mais seguir o nome do produto. */
export type RateDraft = {
  index: RateIndex | "";
  value: string;
  maturity: string;
  exempt: boolean;
  exemptManual?: boolean;
  indexManual?: boolean;
  valueManual?: boolean;
  maturityManual?: boolean;
};

export const EMPTY_RATE_DRAFT: RateDraft = { index: "", value: "", maturity: "", exempt: false };

export function draftFromRate(rate: AccountRate | null | undefined): RateDraft {
  if (!rate) return EMPTY_RATE_DRAFT;
  return {
    index: rate.rate_index,
    value: rate.rate_index === "poupanca" ? "" : String(rate.rate_value).replace(".", ","),
    maturity: rate.maturity ?? "",
    exempt: rate.tax_exempt,
    exemptManual: true,
    indexManual: true,
    valueManual: true,
    maturityManual: true,
  };
}

const valueText = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 4, useGrouping: false });

/** Aplica ao rascunho o que o nome indica, sem tocar nos campos que o usuário ajustou. */
function applyHint(d: RateDraft, hint: RateHint | null): RateDraft {
  if (!hint) return d;
  const next = { ...d };
  if (hint.index && !d.indexManual && (!hint.weakIndex || !d.index)) {
    if (next.index !== hint.index) {
      next.value = "";
      next.valueManual = false;
    }
    next.index = hint.index;
  }
  if (hint.value !== undefined && !next.valueManual && next.index === hint.index) next.value = valueText(hint.value);
  if (hint.maturity && !d.maturityManual && next.index !== "poupanca") next.maturity = hint.maturity;
  return next;
}

/** null = nada informado; string = erro para mostrar. */
export function rateFromDraft(d: RateDraft): AccountRate | null | string {
  if (!d.index) return null;
  const meta = RATE_INDEXES.find((r) => r.id === d.index)!;
  const value = meta.valueLabel ? Number(d.value.replace(/\./g, "").replace(",", ".")) : 0;
  if (meta.valueLabel && (!d.value.trim() || !Number.isFinite(value) || value < 0)) return `Informe ${meta.valueLabel.toLowerCase()}.`;
  if (d.index === "cdi" && (value <= 0 || value > 300)) return "O percentual do CDI deve ficar entre 0 e 300.";
  if (d.index === "pre" && (value <= 0 || value > 60)) return "A taxa prefixada deve ficar entre 0 e 60% ao ano.";
  if ((d.index === "ipca" || d.index === "selic") && value > 30) return "O spread deve ficar abaixo de 30% ao ano.";
  return {
    rate_index: d.index,
    rate_value: value,
    maturity: d.maturity || null,
    tax_exempt: d.index === "poupanca" ? true : d.exempt,
  };
}

/**
 * `productName`: nome da aplicação. Quando ele indica o tipo (LCI, CDB, Tesouro…), a isenção de
 * Imposto de Renda é preenchida sozinha e o checkbox vira só um ajuste manual.
 */
export function RateFields({ value, onChange, productName = "" }: { value: RateDraft; onChange: (d: RateDraft) => void; productName?: string }) {
  const id = useId();
  const meta = RATE_INDEXES.find((r) => r.id === value.index);
  const set = (patch: Partial<RateDraft>) => onChange({ ...value, ...patch });
  const rule: TaxRule | null = value.index === "poupanca" ? { exempt: true, produto: "Poupança" } : taxRuleFromName(productName);
  const followsRule = rule !== null && value.exempt === rule.exempt;
  const tesouroLive = useTesouroLive();
  const hint = rateHintFromName(productName, tesouroLive);
  const hintKey = hint ? JSON.stringify([hint.index, hint.weakIndex, hint.value, hint.maturity]) : "";

  const lastProduto = useRef(rule?.produto ?? null);
  const lastHint = useRef("");
  useEffect(() => {
    let next = value;
    if (hintKey !== lastHint.current) {
      lastHint.current = hintKey;
      next = applyHint(next, hint);
    }
    const nextRule: TaxRule | null = next.index === "poupanca" ? { exempt: true, produto: "Poupança" } : taxRuleFromName(productName);
    const produto = nextRule?.produto ?? null;
    const produtoChanged = produto !== lastProduto.current;
    lastProduto.current = produto;
    if (nextRule && (produtoChanged || !next.exemptManual) && next.exempt !== nextRule.exempt) {
      next = { ...next, exempt: nextRule.exempt, exemptManual: false };
    } else if (nextRule && produtoChanged && next.exemptManual) {
      next = { ...next, exemptManual: false };
    }
    if (next !== value) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintKey, rule?.produto, rule?.exempt, value.index, value.exemptManual, value.exempt]);

  const hintApplied =
    hint !== null &&
    ((hint.index !== undefined && !hint.weakIndex && value.index === hint.index && !value.indexManual) ||
      (hint.maturity !== undefined && value.maturity === hint.maturity && !value.maturityManual));

  return (
    <fieldset className="space-y-3">
      <legend className={`${LABEL} mb-1.5 flex items-center gap-1.5`}>
        Rentabilidade contratada
        <HelpTip label="rentabilidade contratada">
          Como a aplicação rende, conforme o contrato ou o app do banco. <strong>% do CDI</strong>: acompanha o CDI (ex.: CDB 110% do CDI).{" "}
          <strong>Selic +</strong> e <strong>IPCA +</strong>: o índice mais uma taxa fixa (ex.: IPCA + 6,5%).{" "}
          <strong>Prefixado</strong>: taxa travada ao ano. Com isso o app calcula o rendimento e a projeção da carteira.
        </HelpTip>
      </legend>
      <div role="radiogroup" aria-label="Indexador" className="grid grid-cols-3 gap-1.5">
        {RATE_INDEXES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={value.index === r.id}
            onClick={() => set({ index: r.id, indexManual: true, exempt: r.id === "poupanca" ? true : value.index === "poupanca" ? false : value.exempt })}
            className={`min-h-10 rounded-lg border px-2 text-xs font-semibold transition-colors ${FOCUS} ${
              value.index === r.id
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {hintApplied && hint && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] leading-snug text-emerald-700 dark:text-emerald-300" aria-live="polite">
          Lido do nome: {hint.fonte}.
          {hint.maturityApprox && value.maturity === hint.maturity && " Confira o dia do vencimento."} Você pode ajustar qualquer campo.
        </p>
      )}

      {meta?.valueLabel && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${id}-valor`} className={`${LABEL} block mb-1.5`}>{meta.valueLabel}</label>
            <div className={INPUT_BOX}>
              <input
                id={`${id}-valor`}
                type="text"
                inputMode="decimal"
                value={value.value}
                onChange={(e) => set({ value: e.target.value.replace(/[^\d,.]/g, "").slice(0, 8), valueManual: true })}
                placeholder={meta.placeholder}
                className="flex-1 min-w-0 bg-transparent text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <span className="shrink-0 text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <label htmlFor={`${id}-venc`} className={LABEL}>Vencimento</label>
              <HelpTip label="vencimento">
                Data em que a aplicação termina e o dinheiro volta para você. É opcional. Depois dela, o app considera o valor reaplicado a 100% do CDI.
              </HelpTip>
            </div>
            <div className={INPUT_BOX}>
              <input
                id={`${id}-venc`}
                type="date"
                value={value.maturity}
                onChange={(e) => set({ maturity: e.target.value, maturityManual: true })}
                className="flex-1 min-w-0 bg-transparent text-sm tabular-nums text-foreground focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>
        </div>
      )}

      {value.index === "poupanca" && <TaxBadge exempt text="A poupança é isenta de Imposto de Renda." />}

      {value.index && value.index !== "poupanca" && (
        <div className="rounded-xl border border-border px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <TaxBadge
              exempt={value.exempt}
              text={
                followsRule
                  ? `Automático: ${rule!.produto}`
                  : rule
                    ? "Ajustado por você"
                    : value.exempt
                      ? "Marcado por você"
                      : "Escreva o tipo no nome (LCI, CDB…) para preencher sozinho"
              }
            />
            {rule && !followsRule && (
              <button
                type="button"
                onClick={() => set({ exempt: rule.exempt, exemptManual: false })}
                className={`shrink-0 rounded-md px-1.5 py-1 text-[11px] font-semibold text-foreground underline underline-offset-2 hover:no-underline ${FOCUS}`}
              >
                Usar automático
              </button>
            )}
          </div>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={value.exempt}
              onChange={(e) => set({ exempt: e.target.checked, exemptManual: true })}
              className="mt-0.5 h-4 w-4 accent-foreground"
            />
            <span className="text-xs">
              <span className="block font-medium text-foreground">Isento de Imposto de Renda</span>
              <span className="block text-muted-foreground">
                {rule ? "Ajuste só se o seu caso for diferente." : "LCI, LCA, CRI, CRA, debêntures incentivadas e poupança."}
              </span>
            </span>
          </label>
        </div>
      )}
      {meta?.valueLabel && (
        <p className="text-[11px] text-muted-foreground">
          {value.index === "pre"
            ? "Sem vencimento, a taxa vale por todo o prazo simulado."
            : "O vencimento é opcional; depois dele, o valor é reaplicado a 100% do CDI."}
        </p>
      )}
    </fieldset>
  );
}
