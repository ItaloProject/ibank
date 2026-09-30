/** Sobra do Planejamento (renda do mês menos gastos reais) levada para o saldo em conta do LIVE. */

export type PlanLeftover = {
  /** "AAAA-MM" */
  month: string;
  renda: number;
  gastoReal: number;
  sobra: number;
};

const DESC_PREFIX = "Sobra do planejamento de ";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Mês anterior e mês atual, nessa ordem. */
export function leftoverMonths(today = new Date()): [string, string] {
  return [monthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)), monthKey(today)];
}

export function monthName(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}

export function leftoverDescription(month: string): string {
  return `${DESC_PREFIX}${month}`;
}

/** Mês de um lançamento de sobra; null para outros lançamentos. */
export function leftoverMonthOf(description: string | null | undefined): string | null {
  if (!description?.startsWith(DESC_PREFIX)) return null;
  const m = description.slice(DESC_PREFIX.length);
  return /^\d{4}-\d{2}$/.test(m) ? m : null;
}

export function computeLeftover(month: string, rendas: number[], gastosReais: number[]): PlanLeftover {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const renda = r2(rendas.reduce((s, v) => s + (Number(v) || 0), 0));
  const gastoReal = r2(gastosReais.reduce((s, v) => s + (Number(v) || 0), 0));
  return { month, renda, gastoReal, sobra: r2(renda - gastoReal) };
}
