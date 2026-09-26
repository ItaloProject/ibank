/**
 * Visão completa da carteira de um usuário, montada no servidor para o bot,
 * o relatório e o WhatsApp: posições, curva de juros, cotações e plano de
 * rebalanceamento pelo perfil de risco.
 */
import sql from "@/lib/db";
import { ensureAccountColumns } from "@/lib/account-schema";
import { ensureBotSchema } from "@/lib/bot-schema";
import { toAccount, toInvestment, toStockTrade } from "@/lib/normalize";
import { fetchMarketRates, type MarketRates } from "@/lib/market-research";
import { fetchYahooQuote } from "@/lib/market-quotes";
import { buildCurve, type Curve } from "@/lib/market-curve";
import { buildPortfolio, type Portfolio } from "@/lib/portfolio-return";
import { buildRebalancePlan, isRiskProfile, type Holding, type RebalancePlan, type RiskProfile, type TurboCap } from "@/lib/rebalance";
import { computeStockPositions, detectAssetType } from "@/lib/stock-utils";
import type { Investment, InvestmentAccount, StockTrade } from "@/types/database";

export type AporteOrigem = "meta" | "media" | "padrao";

export type UserSnapshot = {
  userId: string;
  nome: string;
  profile: RiskProfile;
  profileDefinido: boolean;
  metaRenda: number | null;
  aporte: number;
  aporteOrigem: AporteOrigem;
  gastoMensal: number | null;
  portfolio: Portfolio | null;
  plan: RebalancePlan | null;
  holdings: Holding[];
  rates: MarketRates;
  curve: Curve;
  geradoEm: string;
};

const DEFAULT_APORTE = 1000;

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

/** Gasto mensal médio dos últimos meses do Planejamento, sem os grupos de investimento. */
async function monthlySpending(userId: string): Promise<number | null> {
  const month = new Date().toISOString().slice(0, 7);
  const rows = await safe(sql`
    SELECT pi.month, SUM(GREATEST(COALESCE(pi.planned, 0), COALESCE(pi.actual, 0)))::float AS total
    FROM plan_items pi
    LEFT JOIN plan_groups pg ON pg.id = pi.group_id
    WHERE pi.user_id = ${userId} AND pi.month <= ${month}
      AND COALESCE(pg.name, '') NOT ILIKE '%invest%'
    GROUP BY pi.month
    ORDER BY pi.month DESC
    LIMIT 3
  `, [] as Record<string, unknown>[]);
  const totals = rows.map((r) => Number(r.total)).filter((n) => n > 0);
  return totals.length ? totals.reduce((s, n) => s + n, 0) / totals.length : null;
}

/** Média mensal de dinheiro novo (depósitos + compras de ativos) nos últimos 6 meses. */
function averageContribution(investments: Investment[], trades: StockTrade[], today = new Date()): number {
  const from = new Date(today.getFullYear(), today.getMonth() - 6, 1).toISOString().slice(0, 10);
  const to = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const inRange = (d: string) => d >= from && d < to;
  let total = 0;
  for (const i of investments) {
    if (!inRange(i.date)) continue;
    if (i.type === "deposito") total += i.amount;
    else if (i.type === "retirada") total -= i.amount;
  }
  for (const t of trades) {
    if (!inRange(t.date)) continue;
    total += t.type === "compra" ? t.total_amount : -t.total_amount;
  }
  return Math.max(0, total / 6);
}

const cache = new Map<string, { at: number; snap: Promise<UserSnapshot> }>();
const CACHE_MS = 5 * 60 * 1000;

/** Snapshot reaproveitado por alguns minutos (várias perguntas seguidas ao bot). */
export function getCachedSnapshot(userId: string, fresh = false): Promise<UserSnapshot> {
  const hit = cache.get(userId);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.snap;
  const snap = loadUserSnapshot(userId);
  cache.set(userId, { at: Date.now(), snap });
  snap.catch(() => cache.delete(userId));
  return snap;
}

export function invalidateSnapshot(userId: string) {
  cache.delete(userId);
}

export async function loadUserSnapshot(userId: string): Promise<UserSnapshot> {
  await Promise.all([ensureAccountColumns(), ensureBotSchema()]);
  const [users, accRows, invRows, tradeRows, quoteRows, gastoMensal, rates] = await Promise.all([
    sql`SELECT name, risk_profile, goal_target, goal_monthly_contribution FROM app_users WHERE user_id = ${userId}`,
    sql`SELECT * FROM investment_accounts WHERE user_id = ${userId} ORDER BY created_at`,
    sql`SELECT * FROM investments WHERE user_id = ${userId} ORDER BY date`,
    sql`SELECT * FROM stock_trades WHERE user_id = ${userId} ORDER BY date`,
    safe(sql`SELECT ticker, current_price FROM stock_quotes WHERE user_id = ${userId}`, [] as Record<string, unknown>[]),
    monthlySpending(userId),
    fetchMarketRates(),
  ]);
  const user = users[0] ?? {};
  const accounts: InvestmentAccount[] = accRows.map(toAccount);
  const investments: Investment[] = invRows.map(toInvestment);
  const trades: StockTrade[] = tradeRows.map(toStockTrade);

  const positions = computeStockPositions(trades).filter((p) => p.quantity > 0.0001);
  const market = await Promise.all(positions.slice(0, 40).map((p) => fetchYahooQuote(p.ticker)));
  const priceOf = new Map<string, number>(quoteRows.map((q) => [String(q.ticker), Number(q.current_price)]));
  const fiiDy: Record<string, number> = {};
  for (const m of market) {
    if (!m) continue;
    priceOf.set(m.ticker, m.price);
    if (m.dy12m > 0) fiiDy[m.ticker] = m.dy12m;
  }
  const quotes = [...priceOf].map(([ticker, current_price]) => ({ ticker, current_price }));

  const curve = buildCurve({ selic: rates.selicAnual, cdi: rates.cdiAnual, ipca12m: rates.ipca12m ?? 4.5, focus: rates.focus }, 972);
  const portfolio = buildPortfolio(accounts, investments, trades, quotes, curve, fiiDy);

  const holdings: Holding[] = positions.map((p) => {
    const price = priceOf.get(p.ticker);
    return {
      ticker: p.ticker,
      kind: detectAssetType(p.ticker) === "FII" ? "fii" : "acao",
      valor: price != null && price > 0 ? price * p.quantity : p.totalInvested,
    };
  });
  const turbos: TurboCap[] = accounts
    .filter((a) => a.is_turbo && a.max_rendimento && a.max_rendimento > 0)
    .map((a) => ({ nome: a.name, saldo: a.current_balance, teto: a.max_rendimento! }));

  const metaAporte = Number(user.goal_monthly_contribution) || 0;
  const media = averageContribution(investments, trades);
  const [aporte, aporteOrigem]: [number, AporteOrigem] = metaAporte > 0
    ? [metaAporte, "meta"]
    : media >= 50
      ? [Math.round(media / 10) * 10, "media"]
      : [DEFAULT_APORTE, "padrao"];

  const profileDefinido = isRiskProfile(user.risk_profile);
  const profile: RiskProfile = profileDefinido ? (user.risk_profile as RiskProfile) : "moderado";
  const plan = portfolio
    ? buildRebalancePlan({ rows: portfolio.rows, profile, aporte, gastoMensal, holdings, turbos })
    : null;

  return {
    userId,
    nome: String(user.name ?? userId),
    profile,
    profileDefinido,
    metaRenda: Number(user.goal_target) > 0 ? Number(user.goal_target) : null,
    aporte,
    aporteOrigem,
    gastoMensal,
    portfolio,
    plan,
    holdings,
    rates,
    curve,
    geradoEm: new Date().toISOString(),
  };
}
