import type { StockTrade } from "@/types/database";
import { detectAssetType } from "./stock-utils";

/**
 * Cálculo de IR sobre ganho de capital em renda variável (pessoa física, Brasil).
 *
 * Regras aplicadas:
 *  - Custo de aquisição: custo médio ponderado (critério da Receita Federal).
 *  - Ações/BDR comuns: 15% sobre o lucro. Isenção quando o total VENDIDO no mês
 *    for <= R$ 20.000 (a isenção olha o volume de vendas, não o lucro).
 *  - FIIs: 20% sobre o lucro, SEM isenção de R$ 20 mil.
 *  - ETFs: 15% sobre o lucro, SEM isenção de R$ 20 mil.
 *  - Prejuízo é compensável apenas dentro da mesma categoria, sem prazo.
 *
 * Não cobre day trade (20%), que exige identificar compra e venda do mesmo
 * ativo no mesmo dia — todas as operações aqui são tratadas como swing trade.
 */

export type TaxCategory = "acoes" | "fii" | "etf";

export const CATEGORY_META: Record<TaxCategory, {
  label: string;
  rate: number;
  hasExemption: boolean;
  note: string;
}> = {
  acoes: { label: "Ações",  rate: 0.15, hasExemption: true,  note: "Isento até R$ 20.000 vendidos no mês" },
  fii:   { label: "FIIs",   rate: 0.20, hasExemption: false, note: "Sem isenção — 20% sobre qualquer lucro" },
  etf:   { label: "ETFs",   rate: 0.15, hasExemption: false, note: "Sem isenção — 15% sobre qualquer lucro" },
};

export const EXEMPTION_LIMIT = 20000;

export interface SaleEvent {
  date: string;
  ticker: string;
  category: TaxCategory;
  quantity: number;
  /** Valor bruto recebido na venda */
  proceeds: number;
  /** Custo médio × quantidade vendida */
  costBasis: number;
  /** proceeds - costBasis */
  profit: number;
  /** Preço médio na data da venda */
  avgPrice: number;
}

export interface MonthlyTax {
  month: string;
  category: TaxCategory;
  totalSales: number;
  grossProfit: number;
  /** Prejuízo acumulado disponível antes deste mês */
  lossCarriedIn: number;
  /** Lucro após compensar prejuízo acumulado */
  taxableProfit: number;
  /** Isento pela regra dos R$ 20 mil */
  exempt: boolean;
  taxRate: number;
  taxDue: number;
  /** Prejuízo que segue para os meses seguintes */
  lossCarriedOut: number;
  sales: SaleEvent[];
}

function categoryOf(ticker: string): TaxCategory {
  const t = detectAssetType(ticker);
  if (t === "FII") return "fii";
  if (t === "ETF") return "etf";
  // BDR segue a regra de ações comuns porém sem isenção; tratado como ETF
  if (t === "BDR") return "etf";
  return "acoes";
}

/**
 * Percorre as operações em ordem cronológica mantendo custo médio por ticker
 * e devolve cada venda com seu lucro apurado.
 */
export function computeSaleEvents(trades: StockTrade[]): SaleEvent[] {
  const ordered = [...trades].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.created_at.localeCompare(b.created_at);
  });

  const positions = new Map<string, { qty: number; cost: number }>();
  const sales: SaleEvent[] = [];

  for (const t of ordered) {
    const pos = positions.get(t.ticker) ?? { qty: 0, cost: 0 };

    if (t.type === "compra") {
      pos.qty += t.quantity;
      pos.cost += t.total_amount;
      positions.set(t.ticker, pos);
      continue;
    }

    // Venda — apura lucro contra o custo médio corrente
    const avgPrice = pos.qty > 0 ? pos.cost / pos.qty : 0;
    const soldQty = Math.min(t.quantity, pos.qty);
    const costBasis = avgPrice * soldQty;
    const proceeds = t.total_amount;

    sales.push({
      date: t.date,
      ticker: t.ticker,
      category: categoryOf(t.ticker),
      quantity: t.quantity,
      proceeds,
      costBasis,
      profit: proceeds - costBasis,
      avgPrice,
    });

    pos.qty = Math.max(0, pos.qty - t.quantity);
    pos.cost = Math.max(0, pos.cost - costBasis);
    positions.set(t.ticker, pos);
  }

  return sales;
}

/**
 * Agrupa as vendas por mês e categoria, aplica isenção e compensa prejuízo
 * acumulado dentro de cada categoria.
 */
export function computeMonthlyTax(trades: StockTrade[]): MonthlyTax[] {
  const sales = computeSaleEvents(trades);
  if (sales.length === 0) return [];

  // Agrupa por "mês|categoria"
  const buckets = new Map<string, SaleEvent[]>();
  for (const s of sales) {
    const key = `${s.date.slice(0, 7)}|${s.category}`;
    const list = buckets.get(key) ?? [];
    list.push(s);
    buckets.set(key, list);
  }

  // Ordena cronologicamente para o prejuízo acumular na ordem certa
  const keys = [...buckets.keys()].sort();
  const lossPool: Record<TaxCategory, number> = { acoes: 0, fii: 0, etf: 0 };
  const result: MonthlyTax[] = [];

  for (const key of keys) {
    const [month, cat] = key.split("|") as [string, TaxCategory];
    const list = buckets.get(key)!;
    const meta = CATEGORY_META[cat];

    const totalSales = list.reduce((s, x) => s + x.proceeds, 0);
    const grossProfit = list.reduce((s, x) => s + x.profit, 0);
    const lossCarriedIn = lossPool[cat];
    const exempt = meta.hasExemption && totalSales <= EXEMPTION_LIMIT;

    let taxableProfit = 0;
    let taxDue = 0;
    let lossCarriedOut = lossCarriedIn;

    if (grossProfit < 0) {
      // Mês com prejuízo — acumula para compensar depois
      lossCarriedOut = lossCarriedIn + Math.abs(grossProfit);
    } else if (exempt) {
      // Lucro isento: não paga e não consome prejuízo acumulado
      taxableProfit = 0;
    } else {
      const compensated = Math.min(grossProfit, lossCarriedIn);
      taxableProfit = grossProfit - compensated;
      lossCarriedOut = lossCarriedIn - compensated;
      taxDue = taxableProfit * meta.rate;
    }

    lossPool[cat] = lossCarriedOut;

    result.push({
      month,
      category: cat,
      totalSales,
      grossProfit,
      lossCarriedIn,
      taxableProfit,
      exempt,
      taxRate: meta.rate,
      taxDue,
      lossCarriedOut,
      sales: list.sort((a, b) => a.date.localeCompare(b.date)),
    });
  }

  return result.sort((a, b) => b.month.localeCompare(a.month));
}

/** Prejuízo ainda disponível para compensação, por categoria. */
export function currentLossPool(rows: MonthlyTax[]): Record<TaxCategory, number> {
  const pool: Record<TaxCategory, number> = { acoes: 0, fii: 0, etf: 0 };
  // rows vem em ordem decrescente — o primeiro de cada categoria é o mais recente
  for (const cat of ["acoes", "fii", "etf"] as TaxCategory[]) {
    const latest = rows.find((r) => r.category === cat);
    pool[cat] = latest ? latest.lossCarriedOut : 0;
  }
  return pool;
}

/** Vencimento do DARF: último dia útil do mês seguinte à apuração. */
export function darfDueDate(month: string): string {
  const [y, m] = month.split("-").map(Number);
  // Último dia do mês seguinte
  const d = new Date(y, m + 1, 0);
  // Recua para sexta se cair em fim de semana
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Código DARF para ganho de capital em renda variável — pessoa física. */
export const DARF_CODE = "6015";
/** A Receita dispensa recolhimento de DARF abaixo deste valor. */
export const DARF_MINIMUM = 10;
