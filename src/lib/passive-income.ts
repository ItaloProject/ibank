/**
 * Cálculo de renda passiva mensal — mesma lógica da aba "Fontes de Renda"
 * em Investimentos (TURBO, FIIs, média de RF, dividendos estimados).
 */

export type PassiveIncomeSource = {
  label: string;
  value: number;
  detail?: string;
};

export type AccountLike = {
  id: string;
  name: string;
  is_turbo?: boolean;
  cdi_percent?: number | null;
  current_balance: number;
};

export type InvestmentLike = {
  account_id: string;
  type: string;
  amount: number;
  date: string;
};

export type StockTradeLike = {
  ticker: string;
  type: "compra" | "venda" | string;
  quantity: number;
  total_amount: number;
};

const CDI_ANUAL = 0.1065;
const CDI_MENSAL = CDI_ANUAL / 12;
const FII_MONTHLY_YIELD = 0.0085;
const DIVIDEND_MONTHLY_YIELD = 0.004;

function detectAssetKind(ticker: string): "FII" | "ETF" | "BDR" | "Ação" {
  const upper = ticker.toUpperCase().replace(/\s/g, "");
  if (upper.endsWith("34") || upper.endsWith("35")) return "BDR";
  if (upper.endsWith("11")) return "FII";
  return "Ação";
}

function computePositions(trades: StockTradeLike[]) {
  const map = new Map<string, { qty: number; invested: number }>();
  for (const t of trades) {
    const cur = map.get(t.ticker) ?? { qty: 0, invested: 0 };
    if (t.type === "compra") {
      cur.qty += t.quantity;
      cur.invested += t.total_amount;
    } else {
      cur.qty -= t.quantity;
      cur.invested -= t.total_amount;
    }
    map.set(t.ticker, cur);
  }
  return [...map.entries()]
    .filter(([, v]) => v.qty > 0.0001)
    .map(([ticker, v]) => ({
      ticker,
      quantity: v.qty,
      totalInvested: Math.max(0, v.invested),
    }));
}

/** Replica FONTES DE RENDA: TURBO + FIIs + RF (média mensal) + dividendos. */
export function computeMonthlyPassiveIncome(
  accounts: AccountLike[],
  investments: InvestmentLike[],
  stockTrades: StockTradeLike[],
): { sources: PassiveIncomeSource[]; total: number } {
  const sources: PassiveIncomeSource[] = [];

  // TURBO — estimativa CDI mensal
  for (const a of accounts.filter((x) => x.is_turbo)) {
    const pct = (a.cdi_percent ?? 115) / 100;
    const value = a.current_balance * pct * CDI_MENSAL;
    if (value > 0) {
      sources.push({
        label: a.name,
        value,
        detail: `TURBO · ${a.cdi_percent ?? 115}% CDI`,
      });
    }
  }

  // FIIs — ~0,85%/mês sobre capital
  const positions = computePositions(stockTrades);
  const fiiPositions = positions.filter((p) => detectAssetKind(p.ticker) === "FII");
  const fiiCapital = fiiPositions.reduce((s, p) => s + p.totalInvested, 0);
  if (fiiCapital > 0) {
    sources.push({
      label: "FIIs",
      value: fiiCapital * FII_MONTHLY_YIELD,
      detail: "~0,85%/mês (estimativa)",
    });
  }

  // Renda fixa (não-turbo) — média mensal dos rendimentos registrados
  for (const a of accounts.filter((x) => !x.is_turbo)) {
    const rends = investments.filter((i) => i.account_id === a.id && i.type === "rendimento");
    if (rends.length === 0) continue;
    const byMonth = rends.reduce((acc, i) => {
      const m = String(i.date).slice(0, 7);
      acc[m] = (acc[m] ?? 0) + i.amount;
      return acc;
    }, {} as Record<string, number>);
    const months = Object.values(byMonth);
    if (months.length === 0) continue;
    const avg = months.reduce((s, v) => s + v, 0) / months.length;
    sources.push({
      label: a.name,
      value: avg,
      detail: `${months.length} mês${months.length !== 1 ? "es" : ""} registrado${months.length !== 1 ? "s" : ""}`,
    });
  }

  // Dividendos de ações/BDR/ETF — ~0,4%/mês
  const dividendPositions = positions.filter((p) => {
    const k = detectAssetKind(p.ticker);
    return k === "Ação" || k === "BDR" || k === "ETF";
  });
  const dividendCapital = dividendPositions.reduce((s, p) => s + p.totalInvested, 0);
  if (dividendCapital > 0) {
    sources.push({
      label: "Dividendos de ações",
      value: dividendCapital * DIVIDEND_MONTHLY_YIELD,
      detail: "~0,4%/mês (estimativa)",
    });
  }

  const total = sources.reduce((s, src) => s + src.value, 0);
  return { sources, total };
}
