/**
 * Cálculo de renda passiva mensal — mesma lógica da aba "Fontes de Renda"
 * em Investimentos (TURBO, FIIs, média de RF, dividendos estimados).
 *
 * Proventos cadastrados na página Proventos têm prioridade: tickers com
 * cadastro não entram na estimativa de FII/dividendos (evita contar 2×).
 */

import { FALLBACK_CDI, toMonthly } from "@/lib/investment-rates";
import { detectAssetType } from "@/lib/stock-utils";

export type PassiveIncomeSource = {
  label: string;
  value: number;
  detail?: string;
  /** Cadastrado = veio de Proventos ou rendimento de RF; estimado = heurística. */
  origem: "registrado" | "estimado";
  kind: "turbo" | "fii" | "rf" | "dividendo" | "provento";
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

export type ProventoLike = {
  ticker: string;
  amount: number;
  payment_day?: number;
  type?: string;
};

const FII_MONTHLY_YIELD = 0.0085;
const DIVIDEND_MONTHLY_YIELD = 0.004;

const TYPE_LABEL: Record<string, string> = {
  dividendo: "Dividendo",
  rendimento: "Rendimento",
  juros: "Juros s/ Capital",
};

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

/** Soma proventos do mesmo ticker (vários tipos/dias no mês). */
export function aggregateProventos(proventos: ProventoLike[]): {
  ticker: string;
  amount: number;
  payment_day?: number;
  type?: string;
}[] {
  const map = new Map<string, { ticker: string; amount: number; payment_day?: number; type?: string }>();
  for (const p of proventos) {
    const ticker = String(p.ticker || "").toUpperCase().trim();
    if (!ticker) continue;
    const amount = Number(p.amount) || 0;
    if (amount <= 0) continue;
    const cur = map.get(ticker);
    if (!cur) {
      map.set(ticker, {
        ticker,
        amount,
        payment_day: p.payment_day,
        type: p.type,
      });
    } else {
      cur.amount += amount;
      // Mantém o menor dia de pagamento quando há vários no mês.
      if (p.payment_day != null && (cur.payment_day == null || p.payment_day < cur.payment_day)) {
        cur.payment_day = p.payment_day;
      }
    }
  }
  return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/** Replica FONTES DE RENDA: TURBO + proventos cadastrados + FIIs/RF/dividendos (sem double-count). */
export function computeMonthlyPassiveIncome(
  accounts: AccountLike[],
  investments: InvestmentLike[],
  stockTrades: StockTradeLike[],
  cdiAnual: number = FALLBACK_CDI,
  proventos: ProventoLike[] = [],
): { sources: PassiveIncomeSource[]; total: number } {
  const sources: PassiveIncomeSource[] = [];
  const CDI_MENSAL = toMonthly(cdiAnual) / 100;

  // TURBO — estimativa CDI mensal
  for (const a of accounts.filter((x) => x.is_turbo)) {
    const pct = (a.cdi_percent ?? 115) / 100;
    const value = a.current_balance * pct * CDI_MENSAL;
    if (value > 0) {
      sources.push({
        label: a.name,
        value,
        detail: `TURBO · ${a.cdi_percent ?? 115}% CDI`,
        origem: "estimado",
        kind: "turbo",
      });
    }
  }

  // Proventos cadastrados — fonte da verdade por ticker
  const registered = aggregateProventos(proventos);
  const covered = new Set(registered.map((p) => p.ticker));
  for (const p of registered) {
    const tipo = p.type ? TYPE_LABEL[p.type] ?? p.type : "Provento";
    const dia = p.payment_day != null ? ` · dia ${p.payment_day}` : "";
    sources.push({
      label: p.ticker,
      value: p.amount,
      detail: `Cadastrado · ${tipo}${dia}`,
      origem: "registrado",
      kind: "provento",
    });
  }

  const positions = computePositions(stockTrades);

  // FIIs — ~0,85%/mês só sobre capital sem provento cadastrado
  const fiiPositions = positions.filter(
    (p) => detectAssetType(p.ticker) === "FII" && !covered.has(p.ticker.toUpperCase()),
  );
  const fiiCapital = fiiPositions.reduce((s, p) => s + p.totalInvested, 0);
  if (fiiCapital > 0) {
    sources.push({
      label: "FIIs",
      value: fiiCapital * FII_MONTHLY_YIELD,
      detail: "~0,85%/mês (estimativa)",
      origem: "estimado",
      kind: "fii",
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
      origem: "registrado",
      kind: "rf",
    });
  }

  // Dividendos de ações/BDR/ETF — ~0,4%/mês, excluindo tickers já cadastrados
  const dividendPositions = positions.filter((p) => {
    if (covered.has(p.ticker.toUpperCase())) return false;
    const k = detectAssetType(p.ticker);
    return k === "Ação" || k === "BDR" || k === "ETF";
  });
  const dividendCapital = dividendPositions.reduce((s, p) => s + p.totalInvested, 0);
  if (dividendCapital > 0) {
    sources.push({
      label: "Dividendos de ações",
      value: dividendCapital * DIVIDEND_MONTHLY_YIELD,
      detail: "~0,4%/mês (estimativa)",
      origem: "estimado",
      kind: "dividendo",
    });
  }

  const total = sources.reduce((s, src) => s + src.value, 0);
  return { sources, total };
}
