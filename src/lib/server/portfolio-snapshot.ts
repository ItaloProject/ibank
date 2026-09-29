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
import { accountBalance, computeStockPositions, detectAssetType } from "@/lib/stock-utils";
import { categorizeAccount, isCashAccountName, type AccountGroupId } from "@/lib/account-groups";
import { buildAlerts, type BotAlert } from "@/lib/alerts";
import { projectGoal, type GoalProjection } from "@/lib/goal-projection";
import type { Investment, InvestmentAccount, StockTrade } from "@/types/database";

export type AporteOrigem = "meta" | "media" | "padrao";

export type SnapshotAccount = {
  nome: string;
  instituicao: string;
  grupo: AccountGroupId | "saldo";
  saldo: number;
  turbo: { cdiPct: number | null; tetoRendimento: number | null } | null;
  taxa: { indexador: string; valor: number | null; vencimento: string | null; isentoIr: boolean | null } | null;
};

export type SnapshotStock = {
  ticker: string;
  tipo: string;
  quantidade: number;
  precoMedio: number;
  precoAtual: number | null;
  investido: number;
  valorAtual: number;
  resultado: number;
  resultadoPct: number;
};

export type SnapshotMovement = { data: string; descricao: string; valor: number };

export type SnapshotProvento = { ticker: string; valor: number; diaPagamento: number; tipo: string };

/** Patrimônio no último registro de cada mês. */
export type SnapshotHistoryPoint = { mes: string; patrimonio: number; investido: number };

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
  accounts: SnapshotAccount[];
  saldoEmConta: number;
  stocks: SnapshotStock[];
  movements: SnapshotMovement[];
  alerts: BotAlert[];
  proventos: SnapshotProvento[];
  history: SnapshotHistoryPoint[];
  goal: GoalProjection | null;
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

const r2 = (n: number) => Math.round(n * 100) / 100;

const MOVEMENT_LABEL: Record<Investment["type"], string> = {
  deposito: "Aporte",
  retirada: "Retirada",
  rendimento: "Rendimento",
};

function snapshotAccounts(accounts: InvestmentAccount[], investments: Investment[]): SnapshotAccount[] {
  return accounts.map((a) => ({
    nome: a.name,
    instituicao: a.institution ?? "",
    grupo: isCashAccountName(a.name) ? "saldo" : categorizeAccount(a),
    saldo: r2(a.is_turbo ? Number(a.current_balance) || 0 : accountBalance(investments, a.id)),
    turbo: a.is_turbo ? { cdiPct: a.cdi_percent, tetoRendimento: a.max_rendimento } : null,
    taxa: a.rate_index
      ? { indexador: a.rate_index, valor: a.rate_value ?? null, vencimento: a.maturity ?? null, isentoIr: a.tax_exempt ?? null }
      : null,
  }));
}

/** Últimos lançamentos de contas e da bolsa, do mais recente para o mais antigo. */
function recentMovements(accounts: InvestmentAccount[], investments: Investment[], trades: StockTrade[], limit = 20): SnapshotMovement[] {
  const nameOf = new Map(accounts.map((a) => [a.id, a.name]));
  const rows: (SnapshotMovement & { at: string })[] = [
    ...investments.map((i) => ({
      at: `${i.date}|${i.created_at}`,
      data: i.date,
      descricao: [MOVEMENT_LABEL[i.type], nameOf.get(i.account_id), i.description].filter(Boolean).join(" · "),
      valor: r2(i.type === "retirada" ? -i.amount : i.amount),
    })),
    ...trades.map((t) => ({
      at: `${t.date}|${t.created_at}`,
      data: t.date,
      descricao: `${t.type === "compra" ? "Compra" : "Venda"} de ${t.quantity} ${t.ticker} a ${r2(t.price_per_share)}`,
      valor: r2(t.type === "compra" ? -t.total_amount : t.total_amount),
    })),
  ];
  return rows
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map(({ data, descricao, valor }) => ({ data, descricao, valor }));
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
  const [users, accRows, invRows, tradeRows, quoteRows, gastoMensal, rates, proventoRows, historyRows] = await Promise.all([
    sql`SELECT name, risk_profile, goal_target, goal_deadline_year, goal_monthly_contribution FROM app_users WHERE user_id = ${userId}`,
    sql`SELECT * FROM investment_accounts WHERE user_id = ${userId} ORDER BY created_at`,
    sql`SELECT * FROM investments WHERE user_id = ${userId} ORDER BY date`,
    sql`SELECT * FROM stock_trades WHERE user_id = ${userId} ORDER BY date`,
    safe(sql`SELECT ticker, current_price FROM stock_quotes WHERE user_id = ${userId}`, [] as Record<string, unknown>[]),
    monthlySpending(userId),
    fetchMarketRates(),
    safe(sql`SELECT ticker, amount, payment_day, type FROM proventos WHERE user_id = ${userId} ORDER BY payment_day`, [] as Record<string, unknown>[]),
    safe(sql`
      SELECT DISTINCT ON (to_char(date, 'YYYY-MM')) to_char(date, 'YYYY-MM') AS mes, total::float AS total, invested::float AS invested
      FROM portfolio_snapshots
      WHERE user_id = ${userId} AND date > CURRENT_DATE - INTERVAL '13 months'
      ORDER BY to_char(date, 'YYYY-MM'), date DESC
    `, [] as Record<string, unknown>[]),
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
  const stocks: SnapshotStock[] = positions.map((p) => {
    const price = priceOf.get(p.ticker);
    const atual = price != null && price > 0 ? price * p.quantity : p.totalInvested;
    const resultado = atual - p.totalInvested;
    return {
      ticker: p.ticker,
      tipo: detectAssetType(p.ticker),
      quantidade: p.quantity,
      precoMedio: r2(p.avgPrice),
      precoAtual: price != null && price > 0 ? r2(price) : null,
      investido: r2(p.totalInvested),
      valorAtual: r2(atual),
      resultado: r2(resultado),
      resultadoPct: p.totalInvested > 0 ? r2((resultado / p.totalInvested) * 100) : 0,
    };
  });
  const snapAccounts = snapshotAccounts(accounts, investments);
  const saldoEmConta = snapAccounts.filter((a) => a.grupo === "saldo").reduce((s, a) => s + a.saldo, 0);

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

  const metaRenda = Number(user.goal_target) > 0 ? Number(user.goal_target) : null;
  const goal = metaRenda && plan
    ? projectGoal({
        metaRendaMensal: metaRenda,
        patrimonio: plan.total,
        aporteMensal: aporte,
        retornoAnualPct: plan.retorno12m,
        ipcaAnualPct: rates.focus?.ipca[1]?.valor ?? rates.focus?.ipca[0]?.valor ?? rates.ipca12m ?? 4.5,
        prazoAno: Number(user.goal_deadline_year) || null,
      })
    : null;

  return {
    userId,
    nome: String(user.name ?? userId),
    profile,
    profileDefinido,
    metaRenda,
    aporte,
    aporteOrigem,
    gastoMensal,
    portfolio,
    plan,
    holdings,
    accounts: snapAccounts,
    saldoEmConta: r2(saldoEmConta),
    stocks,
    movements: recentMovements(accounts, investments, trades),
    alerts: buildAlerts({ accounts, investments, trades }),
    proventos: proventoRows.map((p) => ({ ticker: String(p.ticker), valor: r2(Number(p.amount)), diaPagamento: Number(p.payment_day), tipo: String(p.type) })),
    history: historyRows.map((h) => ({ mes: String(h.mes), patrimonio: r2(Number(h.total)), investido: r2(Number(h.invested)) })),
    goal,
    rates,
    curve,
    geradoEm: new Date().toISOString(),
  };
}
