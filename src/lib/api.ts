import type {
  CreditCard,
  Transaction,
  TransactionCategory,
  InvestmentAccount,
  Investment,
  InvestmentType,
  StockTrade,
} from "@/types/database";
import { getCurrentUser } from "@/lib/user";

function uid() { return getCurrentUser(); }

// Neon retorna numeric como strings e date como ISO datetime — normalizamos na borda.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeDate(raw: any): string {
  if (!raw) return "";
  // "2026-06-01T03:00:00.000Z" → "2026-06-01"
  return String(raw).slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCard(r: any): CreditCard {
  return { ...r, limit: Number(r.limit), closing_day: Number(r.closing_day), due_day: Number(r.due_day) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTransaction(r: any): Transaction {
  return {
    ...r,
    amount: Number(r.amount),
    installments: Number(r.installments),
    installment_current: Number(r.installment_current),
    date: normalizeDate(r.date),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAccount(r: any): InvestmentAccount {
  return {
    ...r,
    current_balance: Number(r.current_balance),
    is_turbo: Boolean(r.is_turbo),
    cdi_percent: r.cdi_percent != null ? Number(r.cdi_percent) : null,
    max_rendimento: r.max_rendimento != null ? Number(r.max_rendimento) : null,
    valor_liquido: r.valor_liquido != null ? Number(r.valor_liquido) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toInvestment(r: any): Investment {
  return { ...r, amount: Number(r.amount), date: normalizeDate(r.date) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toStockTrade(r: any): StockTrade {
  return {
    ...r,
    quantity: Number(r.quantity),
    price_per_share: Number(r.price_per_share),
    total_amount: Number(r.total_amount),
    date: normalizeDate(r.date),
  };
}

// ─── Cards ────────────────────────────────────────────────────────────────────

export async function getCards(): Promise<CreditCard[]> {
  const res = await fetch(`/api/cards?user=${uid()}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toCard) : [];
}

export async function createCard(data: {
  name: string; limit: number; closing_day: number; due_day: number;
}): Promise<CreditCard> {
  const res = await fetch("/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, user_id: uid() }),
  });
  return toCard(await res.json());
}

export async function deleteCard(id: string): Promise<void> {
  await fetch(`/api/cards/${id}?user=${uid()}`, { method: "DELETE" });
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(params?: {
  start?: string; end?: string; cardId?: string; billingCycle?: string;
}): Promise<Transaction[]> {
  const qs = new URLSearchParams({ user: uid() });
  if (params?.start) qs.set("start", params.start);
  if (params?.end) qs.set("end", params.end);
  if (params?.cardId) qs.set("card_id", params.cardId);
  if (params?.billingCycle) qs.set("billing_cycle", params.billingCycle);
  const res = await fetch(`/api/transactions?${qs}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toTransaction) : [];
}

export async function getAvailableCycles(cardId: string): Promise<string[]> {
  const qs = new URLSearchParams({ user: uid(), card_id: cardId, list_cycles: "true" });
  const res = await fetch(`/api/transactions?${qs}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createTransactions(rows: {
  credit_card_id: string; description: string; amount: number;
  category: TransactionCategory; date: string; installments?: number;
  installment_current?: number; billing_cycle?: string | null;
}[]): Promise<Transaction[]> {
  const res = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows.map((r) => ({ ...r, user_id: uid() }))),
  });
  const data = await res.json();
  return Array.isArray(data) ? data.map(toTransaction) : [];
}

export async function deleteTransaction(id: string): Promise<void> {
  await fetch(`/api/transactions/${id}?user=${uid()}`, { method: "DELETE" });
}

export async function clearTransactions(cardId: string, start?: string, end?: string, billingCycle?: string): Promise<void> {
  const qs = new URLSearchParams({ card_id: cardId, user: uid() });
  if (start) qs.set("start", start);
  if (end) qs.set("end", end);
  if (billingCycle) qs.set("billing_cycle", billingCycle);
  await fetch(`/api/transactions?${qs}`, { method: "DELETE" });
}

// ─── Investment Accounts ──────────────────────────────────────────────────────

export async function getInvestmentAccounts(): Promise<InvestmentAccount[]> {
  const res = await fetch(`/api/investment-accounts?user=${uid()}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toAccount) : [];
}

export async function createInvestmentAccount(data: {
  name: string; institution: string;
}): Promise<InvestmentAccount> {
  const res = await fetch("/api/investment-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, user_id: uid() }),
  });
  return toAccount(await res.json());
}

export async function updateAccountBalance(id: string, current_balance: number): Promise<InvestmentAccount> {
  const res = await fetch(`/api/investment-accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_balance }),
  });
  return toAccount(await res.json());
}

export async function deleteInvestmentAccount(id: string): Promise<void> {
  await fetch(`/api/investment-accounts/${id}`, { method: "DELETE" });
}

export async function renameInvestmentAccount(id: string, name: string, institution: string): Promise<InvestmentAccount> {
  const res = await fetch(`/api/investment-accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, institution }),
  });
  return toAccount(await res.json());
}

export async function updateTurboSettings(
  id: string,
  settings: { is_turbo?: boolean; cdi_percent?: number | null; max_rendimento?: number | null; valor_liquido?: number | null },
): Promise<InvestmentAccount> {
  const res = await fetch(`/api/investment-accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return toAccount(await res.json());
}

export async function createInvestmentAccountWithTurbo(data: {
  name: string; institution: string;
  is_turbo?: boolean; cdi_percent?: number | null; max_rendimento?: number | null; valor_liquido?: number | null;
}): Promise<InvestmentAccount> {
  const res = await fetch("/api/investment-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, user_id: uid() }),
  });
  return toAccount(await res.json());
}

// ─── Investments ──────────────────────────────────────────────────────────────

export async function getInvestments(params?: {
  accountId?: string; start?: string; end?: string;
}): Promise<Investment[]> {
  const qs = new URLSearchParams({ user: uid() });
  if (params?.accountId) qs.set("account_id", params.accountId);
  if (params?.start) qs.set("start", params.start);
  if (params?.end) qs.set("end", params.end);
  const res = await fetch(`/api/investments?${qs}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toInvestment) : [];
}

export async function createInvestment(data: {
  account_id: string; type: InvestmentType; amount: number; description: string; date: string;
}): Promise<Investment> {
  const res = await fetch("/api/investments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, user_id: uid() }),
  });
  return toInvestment(await res.json());
}

export async function deleteInvestment(id: string): Promise<void> {
  await fetch(`/api/investments/${id}?user=${uid()}`, { method: "DELETE" });
}

// ─── Stock Trades ─────────────────────────────────────────────────────────────

export async function getStockTrades(): Promise<StockTrade[]> {
  const res = await fetch(`/api/stock-trades?user=${uid()}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toStockTrade) : [];
}

export async function createStockTrade(data: {
  ticker: string;
  type?: "compra" | "venda";
  quantity: number;
  price_per_share: number;
  total_amount: number;
  notes?: string;
  date: string;
}): Promise<StockTrade> {
  const res = await fetch("/api/stock-trades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, user_id: uid() }),
  });
  return toStockTrade(await res.json());
}

export async function deleteStockTrade(id: string): Promise<void> {
  await fetch(`/api/stock-trades/${id}`, { method: "DELETE" });
}

// ─── Stock Quotes ─────────────────────────────────────────────────────────────

export interface StockQuote { ticker: string; current_price: number; updated_at: string; }

export async function getStockQuotes(): Promise<StockQuote[]> {
  const res = await fetch(`/api/stock-quotes?user=${uid()}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map((r) => ({ ...r, current_price: Number(r.current_price) })) : [];
}

export async function upsertStockQuote(ticker: string, current_price: number): Promise<StockQuote> {
  const res = await fetch(`/api/stock-quotes?user=${uid()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, current_price }),
  });
  const r = await res.json();
  return { ...r, current_price: Number(r.current_price) };
}
