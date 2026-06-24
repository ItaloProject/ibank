import type {
  CreditCard,
  Transaction,
  TransactionCategory,
  InvestmentAccount,
  Investment,
  InvestmentType,
} from "@/types/database";

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
  return { ...r, current_balance: Number(r.current_balance) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toInvestment(r: any): Investment {
  return { ...r, amount: Number(r.amount), date: normalizeDate(r.date) };
}

// ─── Cards ────────────────────────────────────────────────────────────────────

export async function getCards(): Promise<CreditCard[]> {
  const res = await fetch("/api/cards");
  const data = await res.json();
  return Array.isArray(data) ? data.map(toCard) : [];
}

export async function createCard(data: {
  name: string;
  limit: number;
  closing_day: number;
  due_day: number;
}): Promise<CreditCard> {
  const res = await fetch("/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return toCard(await res.json());
}

export async function deleteCard(id: string): Promise<void> {
  await fetch(`/api/cards/${id}`, { method: "DELETE" });
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getTransactions(params?: {
  start?: string;
  end?: string;
  cardId?: string;
}): Promise<Transaction[]> {
  const qs = new URLSearchParams();
  if (params?.start) qs.set("start", params.start);
  if (params?.end) qs.set("end", params.end);
  if (params?.cardId) qs.set("card_id", params.cardId);
  const res = await fetch(`/api/transactions?${qs}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toTransaction) : [];
}

export async function createTransactions(
  rows: {
    credit_card_id: string;
    description: string;
    amount: number;
    category: TransactionCategory;
    date: string;
    installments?: number;
    installment_current?: number;
  }[]
): Promise<Transaction[]> {
  const res = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows),
  });
  const data = await res.json();
  return Array.isArray(data) ? data.map(toTransaction) : [];
}

export async function deleteTransaction(id: string): Promise<void> {
  await fetch(`/api/transactions/${id}`, { method: "DELETE" });
}

export async function clearTransactions(cardId: string, start?: string, end?: string): Promise<void> {
  const qs = new URLSearchParams({ card_id: cardId });
  if (start) qs.set("start", start);
  if (end) qs.set("end", end);
  await fetch(`/api/transactions?${qs}`, { method: "DELETE" });
}

// ─── Investment Accounts ──────────────────────────────────────────────────────

export async function getInvestmentAccounts(): Promise<InvestmentAccount[]> {
  const res = await fetch("/api/investment-accounts");
  const data = await res.json();
  return Array.isArray(data) ? data.map(toAccount) : [];
}

export async function createInvestmentAccount(data: {
  name: string;
  institution: string;
}): Promise<InvestmentAccount> {
  const res = await fetch("/api/investment-accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return toAccount(await res.json());
}

export async function updateAccountBalance(
  id: string,
  current_balance: number
): Promise<InvestmentAccount> {
  const res = await fetch(`/api/investment-accounts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_balance }),
  });
  return toAccount(await res.json());
}

// ─── Investments ──────────────────────────────────────────────────────────────

export async function getInvestments(params?: {
  accountId?: string;
  start?: string;
  end?: string;
}): Promise<Investment[]> {
  const qs = new URLSearchParams();
  if (params?.accountId) qs.set("account_id", params.accountId);
  if (params?.start) qs.set("start", params.start);
  if (params?.end) qs.set("end", params.end);
  const res = await fetch(`/api/investments?${qs}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toInvestment) : [];
}

export async function createInvestment(data: {
  account_id: string;
  type: InvestmentType;
  amount: number;
  description: string;
  date: string;
}): Promise<Investment> {
  const res = await fetch("/api/investments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return toInvestment(await res.json());
}

export async function deleteInvestment(id: string): Promise<void> {
  await fetch(`/api/investments/${id}`, { method: "DELETE" });
}
