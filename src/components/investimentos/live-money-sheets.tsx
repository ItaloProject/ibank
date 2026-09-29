"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Undo2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { FOCUS, LABEL, MONEY, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, INPUT_BOX, LOSS, LiveSheet } from "./live-ui";
import { formatQty, type FixedIncomeProduct, type LiveAccount, type LiveMovement, type MoneySource } from "./live-actions";
import type { RateIndex } from "@/lib/account-rate";
import { fixedRateLabel, type FixedIncomeEntry } from "@/lib/fixed-income-catalog";

/* ── Máscaras ─────────────────────────────────────────────────────── */

export function formatBRLMask(digits: string): string {
  const cents = parseInt(digits.replace(/\D/g, "").slice(0, 12) || "0", 10);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseBRLMask(masked: string): number {
  return parseInt(masked.replace(/\D/g, "") || "0", 10) / 100;
}

export function toBRLMask(value: number): string {
  return formatBRLMask(String(Math.round(Math.max(0, value) * 100)));
}

function cleanQty(raw: string): string {
  const v = raw.replace(/[^\d,]/g, "");
  const [int = "", ...rest] = v.split(",");
  return rest.length ? `${int.slice(0, 8)},${rest.join("").slice(0, 4)}` : int.slice(0, 8);
}

function parseQty(masked: string): number {
  const n = parseFloat(masked.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function errorText(err: unknown) {
  return err instanceof Error ? err.message : "Não foi possível concluir. Tente novamente.";
}

/* ── Peças ────────────────────────────────────────────────────────── */

function MoneyField({
  id,
  label,
  value,
  onChange,
  autoFocus,
  large,
  trailing,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  large?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={`${LABEL} block mb-1.5`}>{label}</label>
      <div className="flex gap-2">
        <div className={cn(INPUT_BOX, "flex-1")}>
          <span className="text-sm font-bold text-muted-foreground">R$</span>
          <input
            id={id}
            type="text"
            inputMode="numeric"
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => onChange(formatBRLMask(e.target.value))}
            placeholder="0,00"
            className={cn(
              "flex-1 min-w-0 bg-transparent tabular-nums text-foreground placeholder:text-muted-foreground/50 focus:outline-none",
              large ? "font-display text-xl font-black" : "text-base font-bold",
            )}
          />
        </div>
        {trailing}
      </div>
    </div>
  );
}

function AllButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 px-4 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${FOCUS}`}
    >
      Tudo
    </button>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return <p role="alert" className={`text-xs ${LOSS} rounded-xl bg-red-500/10 px-3 py-2`}>{children}</p>;
}

/** Escolha de onde sai o dinheiro. "Dinheiro de fora" registra o investimento sem mexer no saldo em conta. */
export function SourcePicker({
  cash,
  needed,
  value,
  onChange,
}: {
  cash: number;
  needed: number;
  value: MoneySource;
  onChange: (v: MoneySource) => void;
}) {
  const short = needed > cash + 0.001;
  const options: { id: MoneySource; title: string; hint: string }[] = [
    {
      id: "saldo",
      title: "Saldo em conta",
      hint: short && needed > 0 ? `Você tem ${formatCurrency(cash)}, não é suficiente` : `Disponível: ${formatCurrency(cash)}`,
    },
    { id: "fora", title: "Dinheiro de fora", hint: "Pix, salário ou outra conta. Não mexe no saldo em conta." },
  ];
  return (
    <fieldset>
      <legend className={`${LABEL} mb-1.5`}>Pagar com</legend>
      <div role="radiogroup" className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const active = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.id)}
              className={cn(
                "min-h-[4.25rem] flex flex-col justify-start rounded-xl border p-3 text-left transition-colors",
                FOCUS,
                active ? "border-foreground bg-foreground/[0.04]" : "border-border hover:bg-muted/60",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                    active ? "border-foreground bg-foreground shadow-[inset_0_0_0_2px_hsl(var(--card))]" : "border-muted-foreground/50",
                  )}
                />
                <span className="text-sm font-bold text-foreground">{o.title}</span>
              </span>
              <span
                className={cn(
                  "mt-1 block pl-6 text-[11px] leading-snug",
                  o.id === "saldo" && short && needed > 0 && active ? LOSS : "text-muted-foreground",
                )}
              >
                {o.hint}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function defaultSource(cash: number): MoneySource {
  return cash > 0 ? "saldo" : "fora";
}

/* ── Aplicar valor (Tesouro, caixinhas) ───────────────────────────── */

export function AmountSheet({
  open,
  onOpenChange,
  title,
  description,
  cash,
  verb = "Aplicar",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  cash: number;
  verb?: string;
  onConfirm: (amount: number, source: MoneySource) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <LiveSheet open={open} onOpenChange={onOpenChange} dismissible={!busy} title={title} description={description}>
      <AmountForm cash={cash} verb={verb} onBusy={setBusy} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} onDone={() => onOpenChange(false)} />
    </LiveSheet>
  );
}

function AmountForm({
  cash,
  verb,
  onBusy,
  onCancel,
  onConfirm,
  onDone,
}: {
  cash: number;
  verb: string;
  onBusy: (b: boolean) => void;
  onCancel: () => void;
  onConfirm: (amount: number, source: MoneySource) => Promise<void>;
  onDone: () => void;
}) {
  const [mask, setMask] = useState("");
  const [source, setSource] = useState<MoneySource>(defaultSource(cash));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = parseBRLMask(mask);
  const short = source === "saldo" && amount > cash + 0.001;
  const can = amount > 0 && !short && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!can) return;
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      await onConfirm(amount, source);
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <MoneyField id="amount-sheet-value" label="Valor" value={mask} onChange={setMask} autoFocus large />
      <SourcePicker cash={cash} needed={amount} value={source} onChange={setSource} />
      {short && (
        <p className="text-xs text-muted-foreground">
          Escolha &quot;Dinheiro de fora&quot; ou diminua o valor para até {formatCurrency(cash)}.
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="space-y-2">
        <button type="submit" disabled={!can} className={BTN_PRIMARY}>
          {busy ? "Salvando…" : amount > 0 ? `${verb} ${formatCurrency(amount)}` : verb}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className={BTN_SECONDARY}>Cancelar</button>
      </div>
    </form>
  );
}

/* ── Comprar ou vender ações e fundos imobiliários ────────────────── */

export type StockOrder =
  | { mode: "compra"; ticker?: string; name?: string; price?: number }
  | { mode: "venda"; ticker: string; price: number; maxQty: number };

export function StockOrderSheet({
  order,
  onClose,
  cash,
  onBuy,
  onSell,
}: {
  order: StockOrder | null;
  onClose: () => void;
  cash: number;
  onBuy: (ticker: string, price: number, qty: number, source: MoneySource) => Promise<void>;
  onSell: (ticker: string, price: number, qty: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const title = !order
    ? ""
    : order.mode === "venda"
      ? `Vender ${order.ticker}`
      : order.ticker
        ? `Comprar ${order.ticker}`
        : "Comprar ação ou fundo imobiliário";
  const description = !order
    ? undefined
    : order.mode === "venda"
      ? `Você tem ${formatQty(order.maxQty)}. O dinheiro da venda entra no saldo em conta.`
      : order.name && order.name !== order.ticker
        ? order.name
        : "Registre a compra com o preço que você pagou.";
  return (
    <LiveSheet open={!!order} onOpenChange={(o) => !o && onClose()} dismissible={!busy} title={title} description={description}>
      {order && <StockOrderForm order={order} cash={cash} onBusy={setBusy} onClose={onClose} onBuy={onBuy} onSell={onSell} />}
    </LiveSheet>
  );
}

function StockOrderForm({
  order,
  cash,
  onBusy,
  onClose,
  onBuy,
  onSell,
}: {
  order: StockOrder;
  cash: number;
  onBusy: (b: boolean) => void;
  onClose: () => void;
  onBuy: (ticker: string, price: number, qty: number, source: MoneySource) => Promise<void>;
  onSell: (ticker: string, price: number, qty: number) => Promise<void>;
}) {
  const selling = order.mode === "venda";
  const [ticker, setTicker] = useState(order.ticker ?? "");
  const [priceMask, setPriceMask] = useState(order.price ? toBRLMask(order.price) : "");
  const [qtyMask, setQtyMask] = useState("");
  const [source, setSource] = useState<MoneySource>(defaultSource(cash));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickerClean = ticker.trim().toUpperCase();
  const price = parseBRLMask(priceMask);
  const qty = parseQty(qtyMask);
  const total = Math.round(price * qty * 100) / 100;
  const tooMany = selling && qty > order.maxQty + 0.0001;
  const short = !selling && source === "saldo" && total > cash + 0.001;
  const can = tickerClean.length >= 4 && price > 0 && qty > 0 && !tooMany && !short && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!can) return;
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      if (selling) await onSell(tickerClean, price, qty);
      else await onBuy(tickerClean, price, qty, source);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!order.ticker && (
        <div>
          <label htmlFor="order-ticker" className={`${LABEL} block mb-1.5`}>Código na bolsa</label>
          <div className={INPUT_BOX}>
            <input
              id="order-ticker"
              autoFocus
              type="text"
              autoCapitalize="characters"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
              placeholder="Ex: PETR4 ou MXRF11"
              className="flex-1 min-w-0 bg-transparent font-display text-xl font-black tracking-wide text-foreground placeholder:text-muted-foreground/50 placeholder:text-base placeholder:font-sans placeholder:font-medium placeholder:tracking-normal focus:outline-none uppercase"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="order-qty" className={`${LABEL} block mb-1.5`}>Quantidade</label>
          <div className="flex gap-2">
            <div className={cn(INPUT_BOX, "flex-1")}>
              <input
                id="order-qty"
                type="text"
                inputMode="decimal"
                autoFocus={!!order.ticker}
                value={qtyMask}
                onChange={(e) => setQtyMask(cleanQty(e.target.value))}
                placeholder="0"
                className="flex-1 min-w-0 bg-transparent text-base font-bold tabular-nums text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
          </div>
        </div>
        <MoneyField
          id="order-price"
          label={selling ? "Preço de venda" : "Preço pago"}
          value={priceMask}
          onChange={setPriceMask}
        />
      </div>
      {selling && (
        <button
          type="button"
          onClick={() => setQtyMask(formatQty(order.maxQty).replace(/\./g, ""))}
          className={`-mt-2 inline-flex min-h-9 items-center rounded-lg px-2 -ml-2 text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground ${FOCUS}`}
        >
          Vender tudo ({formatQty(order.maxQty)})
        </button>
      )}

      <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3 flex items-center justify-between" aria-live="polite">
        <span className="text-xs text-muted-foreground">{selling ? "Você recebe" : "Total"}</span>
        <span className={`${MONEY} text-base`}>{formatCurrency(total)}</span>
      </div>

      {!selling && <SourcePicker cash={cash} needed={total} value={source} onChange={setSource} />}
      {tooMany && <p className={`text-xs ${LOSS}`}>Você só tem {formatQty(order.maxQty)} para vender.</p>}
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="space-y-2">
        <button type="submit" disabled={!can} className={BTN_PRIMARY}>
          {busy
            ? "Salvando…"
            : selling
              ? qty > 0 ? `Vender ${formatQty(qty)} por ${formatCurrency(total)}` : "Vender"
              : qty > 0 && price > 0 ? `Comprar por ${formatCurrency(total)}` : "Comprar"}
        </button>
        <button type="button" disabled={busy} onClick={onClose} className={BTN_SECONDARY}>Cancelar</button>
      </div>
    </form>
  );
}

/* ── Comprar título do Tesouro ou renda fixa ──────────────────────── */

const RATE_AFFIX: Record<RateIndex, { prefix?: string; suffix: string; max: number }> = {
  cdi: { suffix: "% do CDI", max: 300 },
  pre: { suffix: "% ao ano", max: 60 },
  ipca: { prefix: "Inflação +", suffix: "%", max: 30 },
  selic: { prefix: "Selic +", suffix: "%", max: 30 },
  poupanca: { suffix: "", max: 0 },
};

function rateText(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

function parseRate(raw: string) {
  const n = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function FixedIncomeSheet({
  entry,
  onClose,
  cash,
  onConfirm,
}: {
  entry: FixedIncomeEntry | null;
  onClose: () => void;
  cash: number;
  onConfirm: (product: FixedIncomeProduct, amount: number, source: MoneySource) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <LiveSheet
      open={!!entry}
      onOpenChange={(o) => !o && onClose()}
      dismissible={!busy}
      title={entry ? `Comprar ${entry.nome}` : ""}
      description={entry?.descricao}
    >
      {entry && <FixedIncomeForm key={entry.id} entry={entry} cash={cash} onBusy={setBusy} onClose={onClose} onConfirm={onConfirm} />}
    </LiveSheet>
  );
}

function FixedIncomeForm({
  entry,
  cash,
  onBusy,
  onClose,
  onConfirm,
}: {
  entry: FixedIncomeEntry;
  cash: number;
  onBusy: (b: boolean) => void;
  onClose: () => void;
  onConfirm: (product: FixedIncomeProduct, amount: number, source: MoneySource) => Promise<void>;
}) {
  const privada = !!entry.kind;
  const hasRate = entry.rate_index !== "poupanca";
  const affix = RATE_AFFIX[entry.rate_index];
  const [institution, setInstitution] = useState("");
  const [rateRaw, setRateRaw] = useState(rateText(entry.rate_value));
  const [maturity, setMaturity] = useState("");
  const [mask, setMask] = useState("");
  const [source, setSource] = useState<MoneySource>(defaultSource(cash));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = parseBRLMask(mask);
  const rate = hasRate ? parseRate(rateRaw) : 0;
  const minRate = entry.rate_index === "selic" || entry.rate_index === "ipca" ? 0 : 0.0001;
  const rateOk = !hasRate || (rate >= minRate && rate <= affix.max);
  const short = source === "saldo" && amount > cash + 0.001;
  const can = amount > 0 && rateOk && !short && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!can) return;
    const label = fixedRateLabel(entry.rate_index, rate);
    const inst = institution.trim();
    const product: FixedIncomeProduct = privada
      ? {
          nome: [entry.kind, inst].filter(Boolean).join(" ") + (hasRate ? ` · ${label}` : ""),
          taxa: label,
          instituicao: inst || entry.kind,
          rate: { rate_index: entry.rate_index, rate_value: rate, maturity: maturity || null, tax_exempt: entry.tax_exempt },
        }
      : {
          nome: entry.nome,
          taxa: label,
          rate: { rate_index: entry.rate_index, rate_value: rate, maturity: entry.maturity, tax_exempt: entry.tax_exempt },
        };
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      await onConfirm(product, amount, source);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {privada && (
        <div>
          <label htmlFor="fi-institution" className={`${LABEL} block mb-1.5`}>Banco ou corretora</label>
          <div className={INPUT_BOX}>
            <input
              id="fi-institution"
              type="text"
              autoFocus
              value={institution}
              onChange={(e) => setInstitution(e.target.value.slice(0, 40))}
              placeholder="Ex.: Nubank, Inter, XP"
              className="flex-1 min-w-0 bg-transparent text-base font-bold text-foreground placeholder:text-muted-foreground/50 placeholder:font-medium focus:outline-none"
            />
          </div>
        </div>
      )}

      {hasRate && (
        <div className={privada && !entry.noMaturity ? "grid grid-cols-2 gap-3" : undefined}>
          <div>
            <label htmlFor="fi-rate" className={`${LABEL} block mb-1.5`}>Taxa contratada</label>
            <div className={INPUT_BOX}>
              {affix.prefix && <span className="text-sm font-bold text-muted-foreground shrink-0">{affix.prefix}</span>}
              <input
                id="fi-rate"
                type="text"
                inputMode="decimal"
                value={rateRaw}
                onChange={(e) => setRateRaw(e.target.value.replace(/[^\d,]/g, "").slice(0, 8))}
                className="flex-1 min-w-0 bg-transparent text-base font-bold tabular-nums text-foreground focus:outline-none"
              />
              <span className="text-sm font-bold text-muted-foreground shrink-0">{affix.suffix}</span>
            </div>
          </div>
          {privada && !entry.noMaturity && (
            <div>
              <label htmlFor="fi-maturity" className={`${LABEL} block mb-1.5`}>Vencimento</label>
              <div className={INPUT_BOX}>
                <input
                  id="fi-maturity"
                  type="date"
                  value={maturity}
                  onChange={(e) => setMaturity(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-sm font-bold text-foreground focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>
          )}
        </div>
      )}
      {hasRate && !rateOk && (
        <p className={`-mt-2 text-xs ${LOSS}`}>Confira a taxa: use um número entre 0 e {affix.max}.</p>
      )}
      {hasRate && rateOk && (
        <p className="-mt-2 text-[11px] text-muted-foreground leading-snug">
          {privada
            ? "Já vem com uma taxa típica. Troque pela que aparece no seu banco."
            : "Já vem com a taxa de referência. Troque pela que aparece na sua corretora."}
          {!privada && entry.maturity ? ` Vence em ${entry.maturity.split("-").reverse().join("/")}.` : ""}
        </p>
      )}

      <MoneyField id="fi-amount" label="Valor" value={mask} onChange={setMask} autoFocus={!privada} large />
      <SourcePicker cash={cash} needed={amount} value={source} onChange={setSource} />
      {short && (
        <p className="text-xs text-muted-foreground">
          Escolha &quot;Dinheiro de fora&quot; ou diminua o valor para até {formatCurrency(cash)}.
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="space-y-2">
        <button type="submit" disabled={!can} className={BTN_PRIMARY}>
          {busy ? "Salvando…" : amount > 0 ? `Comprar ${formatCurrency(amount)}` : "Comprar"}
        </button>
        <button type="button" disabled={busy} onClick={onClose} className={BTN_SECONDARY}>Cancelar</button>
      </div>
    </form>
  );
}

/* ── Retirar de uma caixinha ──────────────────────────────────────── */

export function WithdrawSheet({
  account,
  onClose,
  onConfirm,
}: {
  account: LiveAccount | null;
  onClose: () => void;
  onConfirm: (accountId: string, amount: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <LiveSheet
      open={!!account}
      onOpenChange={(o) => !o && onClose()}
      dismissible={!busy}
      title={account ? `Retirar de ${account.nome}` : "Retirar"}
      description={account ? `Disponível: ${formatCurrency(account.valor)}. O valor vai para o saldo em conta.` : undefined}
    >
      {account && <WithdrawForm account={account} onBusy={setBusy} onClose={onClose} onConfirm={onConfirm} />}
    </LiveSheet>
  );
}

function WithdrawForm({
  account,
  onBusy,
  onClose,
  onConfirm,
}: {
  account: LiveAccount;
  onBusy: (b: boolean) => void;
  onClose: () => void;
  onConfirm: (accountId: string, amount: number) => Promise<void>;
}) {
  const [mask, setMask] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = parseBRLMask(mask);
  const tooMuch = amount > account.valor + 0.001;
  const can = amount > 0 && !tooMuch && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!can) return;
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      await onConfirm(account.id, amount);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <MoneyField
        id="withdraw-value"
        label="Valor a retirar"
        value={mask}
        onChange={setMask}
        autoFocus
        large
        trailing={<AllButton onClick={() => setMask(toBRLMask(account.valor))} />}
      />
      {tooMuch && <p className={`text-xs ${LOSS}`}>Valor maior que o disponível na caixinha.</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="space-y-2">
        <button type="submit" disabled={!can} className={BTN_PRIMARY}>
          {busy ? "Retirando…" : amount > 0 ? `Retirar ${formatCurrency(amount)}` : "Retirar"}
        </button>
        <button type="button" disabled={busy} onClick={onClose} className={BTN_SECONDARY}>Cancelar</button>
      </div>
    </form>
  );
}

/* ── Atualizar valor de uma caixinha ──────────────────────────────── */

export function UpdateValueSheet({
  account,
  onClose,
  onConfirm,
}: {
  account: LiveAccount | null;
  onClose: () => void;
  onConfirm: (accountId: string, newValue: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <LiveSheet
      open={!!account}
      onOpenChange={(o) => !o && onClose()}
      dismissible={!busy}
      title={account ? `Atualizar ${account.nome}` : "Atualizar valor"}
      description="Digite o valor que o banco mostra hoje. A diferença é registrada como rendimento e o saldo em conta não muda."
    >
      {account && <UpdateValueForm account={account} onBusy={setBusy} onClose={onClose} onConfirm={onConfirm} />}
    </LiveSheet>
  );
}

function UpdateValueForm({
  account,
  onBusy,
  onClose,
  onConfirm,
}: {
  account: LiveAccount;
  onBusy: (b: boolean) => void;
  onClose: () => void;
  onConfirm: (accountId: string, newValue: number) => Promise<void>;
}) {
  const [mask, setMask] = useState(toBRLMask(account.valor));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = parseBRLMask(mask);
  const delta = Math.round((value - account.valor) * 100) / 100;
  const changed = Math.abs(delta) >= 0.005;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!changed || busy) return;
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      await onConfirm(account.id, value);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <MoneyField id="update-value" label="Valor hoje" value={mask} onChange={setMask} autoFocus large />
      <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {!changed
          ? `Valor registrado: ${formatCurrency(account.valor)}.`
          : delta > 0
            ? `Rendeu ${formatCurrency(delta)} desde o último registro.`
            : `Caiu ${formatCurrency(-delta)} desde o último registro.`}
      </p>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="space-y-2">
        <button type="submit" disabled={!changed || busy} className={BTN_PRIMARY}>
          {busy ? "Salvando…" : "Salvar valor"}
        </button>
        <button type="button" disabled={busy} onClick={onClose} className={BTN_SECONDARY}>Cancelar</button>
      </div>
    </form>
  );
}

/* ── Movimentações ────────────────────────────────────────────────── */

function displayDate(iso: string) {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

const UNDO_EFFECT: Record<LiveMovement["kind"], string> = {
  compra: "A compra é apagada. Se foi paga com o saldo em conta, o valor volta para ele.",
  venda: "A venda é apagada e as cotas voltam para a carteira. O valor sai do saldo em conta.",
  aporte: "O aporte é apagado. Se foi pago com o saldo em conta, o valor volta para ele.",
  retirada: "A retirada é apagada. O valor sai do saldo em conta e volta para a caixinha.",
  rendimento: "O rendimento é apagado e a caixinha volta ao valor anterior.",
  "ajuste-valor": "A correção é apagada e a caixinha volta ao valor anterior.",
  "ajuste-saldo": "O ajuste é apagado e o saldo em conta volta ao valor anterior.",
};

export function MovementsList({
  movements,
  onUndo,
  empty = "Sem movimentações ainda.",
}: {
  movements: LiveMovement[];
  onUndo: (m: LiveMovement) => void;
  empty?: string;
}) {
  if (movements.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul>
      {movements.map((m) => {
        const Icon = m.direction > 0 ? ArrowDownLeft : ArrowUpRight;
        return (
          <li key={m.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate">{m.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{m.subtitle} · {displayDate(m.date)}</p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-foreground shrink-0">{formatCurrency(m.amount)}</p>
            <button
              type="button"
              onClick={() => onUndo(m)}
              aria-label={`Desfazer ${m.title}`}
              title="Desfazer"
              className={`-mr-2 h-10 w-10 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${FOCUS}`}
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function UndoSheet({
  movement,
  onClose,
  onConfirm,
}: {
  movement: LiveMovement | null;
  onClose: () => void;
  onConfirm: (m: LiveMovement) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!movement || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(movement);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <LiveSheet
      open={!!movement}
      onOpenChange={(o) => {
        if (!o) {
          setError(null);
          onClose();
        }
      }}
      dismissible={!busy}
      title={movement ? `Desfazer "${movement.title}"?` : "Desfazer"}
      description={movement ? `${formatCurrency(movement.amount)} · ${displayDate(movement.date)}` : undefined}
    >
      {movement && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{UNDO_EFFECT[movement.kind]}</p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="space-y-2">
            <button type="button" onClick={() => void run()} disabled={busy} className={BTN_DANGER}>
              {busy ? "Desfazendo…" : "Desfazer"}
            </button>
            <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>Manter</button>
          </div>
        </div>
      )}
    </LiveSheet>
  );
}
