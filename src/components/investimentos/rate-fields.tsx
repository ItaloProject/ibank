"use client";

import { useId } from "react";
import { FOCUS, INPUT_BOX, LABEL } from "@/components/investimentos/live-ui";
import { HelpTip } from "@/components/ui/help-tip";
import { RATE_INDEXES, type AccountRate, type RateIndex } from "@/lib/account-rate";

export type RateDraft = { index: RateIndex | ""; value: string; maturity: string; exempt: boolean };

export const EMPTY_RATE_DRAFT: RateDraft = { index: "", value: "", maturity: "", exempt: false };

export function draftFromRate(rate: AccountRate | null | undefined): RateDraft {
  if (!rate) return EMPTY_RATE_DRAFT;
  return {
    index: rate.rate_index,
    value: rate.rate_index === "poupanca" ? "" : String(rate.rate_value).replace(".", ","),
    maturity: rate.maturity ?? "",
    exempt: rate.tax_exempt,
  };
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

export function RateFields({ value, onChange }: { value: RateDraft; onChange: (d: RateDraft) => void }) {
  const id = useId();
  const meta = RATE_INDEXES.find((r) => r.id === value.index);
  const set = (patch: Partial<RateDraft>) => onChange({ ...value, ...patch });

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
            onClick={() => set({ index: r.id, exempt: r.id === "poupanca" ? true : value.exempt })}
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
                onChange={(e) => set({ value: e.target.value.replace(/[^\d,.]/g, "").slice(0, 8) })}
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
                onChange={(e) => set({ maturity: e.target.value })}
                className="flex-1 min-w-0 bg-transparent text-sm tabular-nums text-foreground focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>
        </div>
      )}

      {value.index && value.index !== "poupanca" && (
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={value.exempt}
            onChange={(e) => set({ exempt: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-foreground"
          />
          <span className="text-xs">
            <span className="block font-medium text-foreground">Isento de IR</span>
            <span className="block text-muted-foreground">LCI, LCA, CRI, CRA e debêntures incentivadas.</span>
          </span>
        </label>
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
