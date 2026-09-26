import type { Investment, InvestmentAccount, StockTrade } from "@/types/database";
import { isRateIndex } from "@/lib/account-rate";

// Neon retorna numeric como strings e date como ISO datetime — normalizamos na borda.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeDate(raw: any): string {
  if (!raw) return "";
  // "2026-06-01T03:00:00.000Z" → "2026-06-01"
  return String(raw).slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toAccount(r: any): InvestmentAccount {
  return {
    ...r,
    current_balance: Number(r.current_balance),
    is_turbo: Boolean(r.is_turbo),
    cdi_percent: r.cdi_percent != null ? Number(r.cdi_percent) : null,
    max_rendimento: r.max_rendimento != null ? Number(r.max_rendimento) : null,
    valor_liquido: r.valor_liquido != null ? Number(r.valor_liquido) : null,
    rate_index: isRateIndex(r.rate_index) ? r.rate_index : null,
    rate_value: r.rate_value != null ? Number(r.rate_value) : null,
    maturity: r.maturity ? normalizeDate(r.maturity) : null,
    tax_exempt: r.tax_exempt != null ? Boolean(r.tax_exempt) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toInvestment(r: any): Investment {
  return { ...r, amount: Number(r.amount), date: normalizeDate(r.date) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toStockTrade(r: any): StockTrade {
  return {
    ...r,
    quantity: Number(r.quantity),
    price_per_share: Number(r.price_per_share),
    total_amount: Number(r.total_amount),
    date: normalizeDate(r.date),
  };
}
