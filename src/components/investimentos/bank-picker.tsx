"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BANKS,
  BANK_RATES_CHECKED_LABEL,
  BANK_RATES_STALE_DAYS,
  bankProductRate,
  bankRatesAgeDays,
  findBankByName,
  productsForTipo,
  type Bank,
  type BankProduct,
  type CaixinhaTipo,
} from "@/lib/bank-rates";
import { FOCUS, INPUT_BOX, LABEL } from "@/components/investimentos/live-ui";

const OTHER = "outra";
const SORTED_BANKS = [...BANKS].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

function bestCdi(bank: Bank, tipo: CaixinhaTipo): number | null {
  const rates = productsForTipo(bank, tipo).filter((x) => x.rate_index === "cdi").map((x) => x.rate_value);
  return rates.length ? Math.max(...rates) : null;
}

function BankSelect({
  id,
  tipo,
  value,
  onChange,
}: {
  id: string;
  tipo: CaixinhaTipo;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = [...SORTED_BANKS.map((b) => b.id), OTHER];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = SORTED_BANKS.find((b) => b.id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function show() {
    setActive(Math.max(0, options.indexOf(value)));
    setOpen(true);
  }

  function pick(i: number) {
    onChange(options[i]);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    const moves: Record<string, number> = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: options.length - 1 };
    if (e.key in moves) {
      e.preventDefault();
      setActive(Math.min(options.length - 1, Math.max(0, moves[e.key])));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={`${id}-bank`}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={cn(INPUT_BOX, "w-full justify-between text-left", FOCUS)}
      >
        <span className={cn("min-w-0 truncate text-sm font-semibold", value ? "text-foreground" : "text-muted-foreground")}>
          {selected?.nome ?? (value === OTHER ? "Outra instituição" : "Escolha o banco")}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Bancos"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-72 overflow-y-auto scrollbar-thin-dark [scrollbar-gutter:stable] rounded-xl border border-border bg-card p-1 shadow-xl"
        >
          {options.map((opt, i) => {
            const bank = SORTED_BANKS.find((b) => b.id === opt);
            const rate = bank ? bestCdi(bank, tipo) : null;
            const isSelected = opt === value;
            return (
              <li
                key={opt}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={cn(
                  "grid grid-cols-[1fr_auto_1rem] items-center gap-3 rounded-lg px-2.5 min-h-10 cursor-pointer text-sm",
                  i === active ? "bg-muted" : "",
                  opt === OTHER && "mt-1 border-t border-border rounded-t-none",
                )}
              >
                <span className={cn("truncate", isSelected ? "font-bold text-foreground" : "font-medium text-foreground/90")}>
                  {bank?.nome ?? "Outra instituição"}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground text-right whitespace-nowrap">
                  {rate !== null ? `até ${rate.toLocaleString("pt-BR")}% do CDI` : ""}
                </span>
                <Check className={cn("h-4 w-4 text-foreground", !isSelected && "invisible")} aria-hidden="true" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Escolha do banco com as taxas típicas de cada produto. Ao escolher o banco,
 * o produto mais indicado para o tipo de caixinha já é aplicado no formulário.
 */
export function BankPicker({
  id,
  tipo,
  institution,
  onInstitutionChange,
  onApply,
}: {
  id: string;
  tipo: CaixinhaTipo;
  institution: string;
  onInstitutionChange: (name: string) => void;
  onApply: (bank: Bank, product: BankProduct) => void;
}) {
  const [bankId, setBankId] = useState(() => findBankByName(institution)?.id ?? (institution.trim() ? OTHER : ""));
  const [productId, setProductId] = useState<string | null>(null);
  const bank = BANKS.find((b) => b.id === bankId);
  const products = bank ? productsForTipo(bank, tipo) : [];

  function apply(b: Bank, prod: BankProduct | undefined) {
    setProductId(prod?.id ?? null);
    if (prod) onApply(b, prod);
  }

  const firstTipo = useRef(true);
  useEffect(() => {
    if (firstTipo.current) {
      firstTipo.current = false;
      return;
    }
    if (bank) apply(bank, productsForTipo(bank, tipo)[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  function choose(value: string) {
    setBankId(value);
    const b = BANKS.find((x) => x.id === value);
    if (b) {
      onInstitutionChange(b.nome);
      apply(b, productsForTipo(b, tipo)[0]);
    } else {
      setProductId(null);
      onInstitutionChange("");
    }
  }

  const noTurbo = tipo === "turbo" && bank && !bank.products.some((x) => x.kind === "turbo");

  return (
    <div className="space-y-2">
      <label htmlFor={`${id}-bank`} className={`${LABEL} block`}>Instituição</label>
      <BankSelect id={id} tipo={tipo} value={bankId} onChange={choose} />

      {bankId === OTHER && (
        <div className={INPUT_BOX}>
          <input
            id={`${id}-bank-other`}
            aria-label="Nome da instituição"
            type="text"
            autoFocus
            value={institution}
            onChange={(e) => onInstitutionChange(e.target.value)}
            placeholder="Ex.: Mercado Pago, Sofisa, Banco Original"
            className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      )}

      {bank && products.length > 0 && (
        <div role="radiogroup" aria-label={`Produtos do ${bank.nome}`} className="space-y-1.5 pt-1">
          {noTurbo && (
            <p className="text-[11px] text-muted-foreground leading-snug">
              O {bank.nome} não tem caixinha turbinada. Veja as opções com resgate diário:
            </p>
          )}
          {products.map((prod) => {
            const active = productId === prod.id;
            return (
              <button
                key={prod.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => apply(bank, prod)}
                className={cn(
                  "w-full rounded-xl border px-3 py-2.5 text-left flex items-start justify-between gap-3 transition-colors",
                  FOCUS,
                  active ? "border-foreground bg-foreground/[0.04]" : "border-border hover:bg-muted/60",
                )}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-foreground">{prod.nome}</span>
                  <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {prod.liquidez}
                    {prod.tax_exempt ? " · sem Imposto de Renda" : ""}
                    {prod.condicao ? ` · ${prod.condicao}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">{bankProductRate(prod)}</span>
              </button>
            );
          })}
          <p className="text-[11px] text-muted-foreground leading-snug">
            Taxas típicas conferidas em {BANK_RATES_CHECKED_LABEL}, garantidas pelo {bank.garantia === "FGC" ? "Fundo Garantidor de Créditos" : "fundo garantidor das cooperativas"} até R$ 250 mil. Confira no app do banco e ajuste se precisar.
          </p>
          {bankRatesAgeDays() > BANK_RATES_STALE_DAYS && (
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 leading-snug">
              Essas taxas têm mais de {BANK_RATES_STALE_DAYS} dias e podem ter mudado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
