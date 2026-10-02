/** Contas de finanças pessoais feitas no aparelho, usadas pelo Gênio e pelo assistente de investimentos. */

const r2 = (v: number) => Math.round(v * 100) / 100;

export type Product = "cdb" | "lci" | "lca" | "tesouro" | "poupanca" | "lc" | "rdb" | "debenture";

export const PRODUCT_LABEL: Record<Product, string> = {
  cdb: "CDB", lci: "LCI", lca: "LCA", tesouro: "Tesouro Selic", poupanca: "poupança", lc: "LC", rdb: "RDB", debenture: "debênture",
};

/** LCI, LCA e poupança não pagam Imposto de Renda para pessoas físicas. */
export const isTaxFree = (p: Product) => p === "lci" || p === "lca" || p === "poupanca";

/** Tabela regressiva do Imposto de Renda da renda fixa, pelo tempo aplicado. */
export function incomeTaxRate(months: number): number {
  const days = months * 30;
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}

/** Poupança com a Selic acima de 8,5% ao ano: 0,5% ao mês, sem contar a TR. */
export const POUPANCA_YEAR = Math.pow(1.005, 12) - 1;

export function netYield(amount: number, annualRate: number, months: number, taxFree: boolean) {
  const gross = r2(amount * (Math.pow(1 + annualRate, months / 12) - 1));
  const taxRate = taxFree ? 0 : incomeTaxRate(months);
  const tax = r2(gross * taxRate);
  return { gross, tax, net: r2(gross - tax), taxRate, final: r2(amount + gross - tax) };
}

/** Percentual do CDI que um produto tributado precisa pagar para empatar com um isento, e o contrário. */
export function taxedEquivalent(taxFreePct: number, months: number): number {
  return r2(taxFreePct / (1 - incomeTaxRate(months)));
}
export function taxFreeEquivalent(taxedPct: number, months: number): number {
  return r2(taxedPct * (1 - incomeTaxRate(months)));
}

/** Rendimento acima da inflação. */
export function realRate(nominal: number, inflation: number): number {
  return (1 + nominal) / (1 + inflation) - 1;
}

/** Regra dos 4%: com 300 vezes o custo mensal, os rendimentos reais pagam as contas sem consumir o patrimônio. */
export const FREEDOM_MULTIPLE = 300;
/** Rendimento real conservador para projeções longas. */
export const REAL_RATE_YEAR = 0.04;

/** Meses para chegar ao alvo com aportes mensais e juros mensais; null se não chega em 100 anos. */
export function monthsToTarget(target: number, monthly: number, rateMonth: number, start = 0): number | null {
  if (start >= target) return 0;
  if (monthly <= 0 && start <= 0) return null;
  let v = start;
  for (let n = 1; n <= 1200; n++) {
    v = v * (1 + rateMonth) + monthly;
    if (v >= target) return n;
  }
  return null;
}

/** Juro do rotativo usado quando a pessoa não informa: média de mercado, confira na fatura. */
export const ROTATIVO_MONTH = 0.14;
/** Teto legal do cheque especial. */
export const CHEQUE_ESPECIAL_MONTH = 0.08;

/** Dívida que cresce sem pagamento; o rotativo tem juros limitados a 100% do valor original por lei. */
export function debtGrowth(amount: number, rateMonth: number, months: number, cappedAtDouble = false): number {
  const grown = amount * Math.pow(1 + rateMonth, months);
  return r2(cappedAtDouble ? Math.min(grown, amount * 2) : grown);
}

/** Tabela Price (parcelas iguais) contra SAC (amortização constante, parcelas que caem). */
export function amortization(principal: number, months: number, rateMonth: number) {
  const pricePmt = rateMonth ? (principal * rateMonth) / (1 - Math.pow(1 + rateMonth, -months)) : principal / months;
  const amort = principal / months;
  const sacFirst = amort + principal * rateMonth;
  const sacLast = amort + amort * rateMonth;
  const sacInterest = (rateMonth * principal * (months + 1)) / 2;
  return {
    price: { pmt: r2(pricePmt), total: r2(pricePmt * months), interest: r2(pricePmt * months - principal) },
    sac: { first: r2(sacFirst), last: r2(sacLast), total: r2(principal + sacInterest), interest: r2(sacInterest) },
  };
}

export const yearToMonth = (y: number) => Math.pow(1 + y, 1 / 12) - 1;
export const monthToYear = (m: number) => Math.pow(1 + m, 12) - 1;
