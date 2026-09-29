"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BANKS,
  BANK_GROUPS,
  BANK_RATES_REFERENCE,
  bankProductRate,
  findBankByName,
  productsForTipo,
  type Bank,
  type BankProduct,
  type CaixinhaTipo,
} from "@/lib/bank-rates";
import { FOCUS, INPUT_BOX, LABEL } from "@/components/investimentos/live-ui";

const OTHER = "outra";

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
      <div className={cn(INPUT_BOX, "relative pr-9")}>
        <select
          id={`${id}-bank`}
          value={bankId}
          onChange={(e) => choose(e.target.value)}
          className="flex-1 min-w-0 appearance-none bg-transparent text-sm font-semibold text-foreground focus:outline-none [&>option]:bg-card [&>optgroup]:bg-card"
        >
          <option value="">Escolha o banco</option>
          {BANK_GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {BANKS.filter((b) => b.group === g).map((b) => (
                <option key={b.id} value={b.id}>{b.nome}</option>
              ))}
            </optgroup>
          ))}
          <option value={OTHER}>Outra instituição</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>

      {bankId === OTHER && (
        <div className={INPUT_BOX}>
          <input
            id={`${id}-bank-other`}
            aria-label="Nome da instituição"
            type="text"
            autoFocus
            value={institution}
            onChange={(e) => onInstitutionChange(e.target.value)}
            placeholder="Ex.: PicPay, Mercado Pago, Sofisa"
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
            Taxas típicas de {BANK_RATES_REFERENCE}, garantidas pelo {bank.garantia === "FGC" ? "Fundo Garantidor de Créditos" : "fundo garantidor das cooperativas"} até R$ 250 mil. Confira no app do banco e ajuste se precisar.
          </p>
        </div>
      )}
    </div>
  );
}
