/** Inflação usada para "valores de hoje" (IPCA de referência, a.a.). */
export const INFLATION_ANNUAL = 0.045;

export type SimInput = {
  inicial: number;
  aporte: number;
  /** Taxa nominal anual, em fração (0.12 = 12% a.a.). */
  taxaAnual: number;
  anos: number;
  /** Desconta a inflação: tudo passa a ser em dinheiro de hoje. */
  reais: boolean;
};

export type YearPoint = {
  ano: number;
  aportado: number;
  juros: number;
  saldo: number;
  jurosNoAno: number;
  rendaMensal: number;
};

export function monthlyRate(taxaAnual: number, reais: boolean): number {
  const anual = reais ? (1 + taxaAnual) / (1 + INFLATION_ANNUAL) - 1 : taxaAnual;
  return Math.pow(1 + anual, 1 / 12) - 1;
}

/** Aporte no início do mês, depois rende. */
export function simulate(input: SimInput): { points: YearPoint[]; rate: number } {
  const rate = monthlyRate(input.taxaAnual, input.reais);
  const points: YearPoint[] = [{ ano: 0, aportado: input.inicial, juros: 0, saldo: input.inicial, jurosNoAno: 0, rendaMensal: input.inicial * rate }];
  let saldo = input.inicial;
  let aportado = input.inicial;
  let jurosAno = 0;
  for (let m = 1; m <= input.anos * 12; m++) {
    saldo += input.aporte;
    aportado += input.aporte;
    const j = saldo * rate;
    saldo += j;
    jurosAno += j;
    if (m % 12 === 0) {
      points.push({ ano: m / 12, aportado, juros: saldo - aportado, saldo, jurosNoAno: jurosAno, rendaMensal: saldo * rate });
      jurosAno = 0;
    }
  }
  return { points, rate };
}

/** Primeiro mês (1-based) em que a condição vale, simulando até `maxYears`. */
function firstMonth(input: SimInput, test: (saldo: number, juros: number) => boolean, maxYears = 80): number | null {
  const rate = monthlyRate(input.taxaAnual, input.reais);
  let saldo = input.inicial;
  if (test(saldo, saldo * rate)) return 0;
  for (let m = 1; m <= maxYears * 12; m++) {
    saldo += input.aporte;
    const j = saldo * rate;
    saldo += j;
    if (test(saldo, j)) return m;
  }
  return null;
}

/** Mês em que os juros de um mês passam a superar o aporte mensal. */
export function turningPoint(input: SimInput): number | null {
  if (input.aporte <= 0) return null;
  return firstMonth(input, (_s, j) => j >= input.aporte);
}

export function monthsToReach(input: SimInput, target: number): number | null {
  return firstMonth(input, (s) => s >= target);
}

/** Aporte mensal necessário para ter `alvo` em `anos`. 0 quando o inicial já basta. */
export function requiredMonthly(input: Omit<SimInput, "aporte">, alvo: number): number {
  const r = monthlyRate(input.taxaAnual, input.reais);
  const n = input.anos * 12;
  const growth = Math.pow(1 + r, n);
  const falta = alvo - input.inicial * growth;
  if (falta <= 0) return 0;
  const factor = r === 0 ? n : (1 + r) * (growth - 1) / r;
  return falta / factor;
}

export function formatDuration(months: number): string {
  if (months <= 0) return "já";
  const a = Math.floor(months / 12);
  const m = months % 12;
  const anos = a === 1 ? "1 ano" : `${a} anos`;
  const meses = m === 1 ? "1 mês" : `${m} meses`;
  if (a === 0) return meses;
  if (m === 0) return anos;
  return `${anos} e ${meses}`;
}

export function formatCompactBRL(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const mi = value / 1_000_000;
    const text = (mi >= 10 ? Math.round(mi) : Math.round(mi * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    return `R$ ${text} ${Math.abs(mi) < 2 ? "milhão" : "milhões"}`;
  }
  if (abs >= 10_000) return `R$ ${Math.round(value / 1_000).toLocaleString("pt-BR")} mil`;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
