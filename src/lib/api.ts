import type {
  InvestmentAccount,
  Investment,
  InvestmentType,
  StockTrade,
  TurboRecord,
  PortfolioSnapshot,
  ScoreSnapshot,
} from "@/types/database";
import { getCurrentUser } from "@/lib/user";
import type { AccountRate } from "@/lib/account-rate";
import { normalizeDate, toAccount, toInvestment, toStockTrade } from "@/lib/normalize";
import type { MarketQuote } from "@/lib/market-quotes";

function uid() { return getCurrentUser(); }

// POST/PATCH que lança erro de verdade quando o servidor rejeita (400/404/etc),
// em vez de tentar normalizar um corpo de erro como se fosse o registro criado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendJson<T>(url: string, method: "POST" | "PATCH", body: unknown, transform: (r: any) => T): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && typeof data.error === "string" && data.error) || `Erro ${res.status} ao processar a requisição.`);
  }
  return transform(data);
}

// ─── Investment Accounts ──────────────────────────────────────────────────────

export async function getInvestmentAccounts(): Promise<InvestmentAccount[]> {
  const res = await fetch(`/api/investment-accounts?user=${uid()}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toAccount) : [];
}

export async function createInvestmentAccount(data: {
  name: string; institution: string;
} & Partial<AccountRate>): Promise<InvestmentAccount> {
  return sendJson("/api/investment-accounts", "POST", { ...data, user_id: uid() }, toAccount);
}

export async function updateAccountRate(id: string, rate: AccountRate | null): Promise<InvestmentAccount> {
  return sendJson(`/api/investment-accounts/${id}`, "PATCH", rate ?? { rate_index: null }, toAccount);
}

export async function updateAccountBalance(id: string, current_balance: number): Promise<InvestmentAccount> {
  return sendJson(`/api/investment-accounts/${id}`, "PATCH", { current_balance }, toAccount);
}

export async function deleteInvestmentAccount(id: string): Promise<void> {
  const res = await fetch(`/api/investment-accounts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
} & Partial<AccountRate>): Promise<InvestmentAccount> {
  return sendJson("/api/investment-accounts", "POST", { ...data, user_id: uid() }, toAccount);
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
  return sendJson("/api/investments", "POST", { ...data, user_id: uid() }, toInvestment);
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
  return sendJson("/api/stock-trades", "POST", { ...data, user_id: uid() }, toStockTrade);
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

export async function getMarketQuotes(tickers: string[]): Promise<MarketQuote[]> {
  if (tickers.length === 0) return [];
  try {
    const res = await fetch(`/api/market-quotes?tickers=${encodeURIComponent(tickers.join(","))}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Atualiza as cotações salvas dos tickers em carteira com o preço de mercado
 * e devolve a lista já atualizada. Falhas de rede mantêm as cotações salvas.
 */
export async function refreshStockQuotes(trades: StockTrade[], stored: StockQuote[]): Promise<{ quotes: StockQuote[]; market: MarketQuote[] }> {
  const held = new Map<string, number>();
  for (const t of trades) held.set(t.ticker, (held.get(t.ticker) ?? 0) + (t.type === "compra" ? t.quantity : -t.quantity));
  const tickers = [...held].filter(([, q]) => q > 0.0001).map(([t]) => t);
  const market = await getMarketQuotes(tickers);
  if (market.length === 0) return { quotes: stored, market };
  const byTicker = new Map(stored.map((q) => [q.ticker, q]));
  const changed = market.filter((m) => {
    const cur = byTicker.get(m.ticker);
    return !cur || Math.abs(cur.current_price - m.price) >= 0.005;
  });
  await Promise.all(changed.map((m) => upsertStockQuote(m.ticker, m.price).catch(() => null)));
  const now = new Date().toISOString();
  for (const m of changed) byTicker.set(m.ticker, { ticker: m.ticker, current_price: m.price, updated_at: now });
  return { quotes: [...byTicker.values()], market };
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

// ─── Turbo History ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTurboRecord(r: any): TurboRecord {
  return {
    ...r,
    total_bruto: Number(r.total_bruto),
    rendimento: Number(r.rendimento),
    valor_liquido: r.valor_liquido != null ? Number(r.valor_liquido) : null,
  };
}

export async function getTurboHistory(accountId: string): Promise<TurboRecord[]> {
  const res = await fetch(`/api/turbo-history?user=${uid()}&account_id=${accountId}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toTurboRecord) : [];
}

export async function saveTurboMonth(data: {
  account_id: string;
  month: string;
  total_bruto: number;
  rendimento: number;
  valor_liquido?: number | null;
}): Promise<TurboRecord> {
  const res = await fetch(`/api/turbo-history?user=${uid()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return toTurboRecord(await res.json());
}

export async function deleteTurboRecord(id: string): Promise<void> {
  await fetch(`/api/turbo-history/${id}`, { method: "DELETE" });
}

// ─── Portfolio Snapshots ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSnapshot(r: any): PortfolioSnapshot {
  return { ...r, total: Number(r.total), invested: Number(r.invested), date: normalizeDate(r.date) };
}

export async function getPortfolioSnapshots(): Promise<PortfolioSnapshot[]> {
  const res = await fetch(`/api/portfolio-snapshots?user=${uid()}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toSnapshot) : [];
}

export async function savePortfolioSnapshot(data: {
  date: string; total: number; invested: number;
}): Promise<PortfolioSnapshot> {
  const res = await fetch(`/api/portfolio-snapshots?user=${uid()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return toSnapshot(await res.json());
}

// ─── Score History ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toScoreSnapshot(r: any): ScoreSnapshot {
  return { ...r, score: Number(r.score), date: normalizeDate(r.date) };
}

export async function getScoreHistory(): Promise<ScoreSnapshot[]> {
  const res = await fetch(`/api/score-history?user=${uid()}`);
  const data = await res.json();
  return Array.isArray(data) ? data.map(toScoreSnapshot) : [];
}

export async function saveScoreSnapshot(date: string, score: number): Promise<ScoreSnapshot> {
  const res = await fetch(`/api/score-history?user=${uid()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, score }),
  });
  return toScoreSnapshot(await res.json());
}
