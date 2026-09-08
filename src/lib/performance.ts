import type { PortfolioSnapshot } from "@/types/database";

/**
 * Rentabilidade da carteira comparada ao CDI.
 *
 * Aporte distorce rentabilidade simples: se você aporta R$ 1.000 e a carteira
 * sobe R$ 1.000, não rendeu 100%. Para isolar o desempenho dos aportes usamos
 * TWR (time-weighted return) pelo método Modified Dietz em cada intervalo entre
 * snapshots, encadeando os retornos:
 *
 *   r = (VF - VI - FC) / (VI + 0,5 × FC)
 *
 * O peso 0,5 assume que o aporte entrou no meio do intervalo — padrão de
 * mercado quando não se sabe a data exata de cada movimentação.
 */

export interface CdiPoint {
  date: string;
  rate: number; // % ao dia
}

export interface PerfPoint {
  date: string;
  /** Carteira indexada em base 100 no início do período */
  carteira: number;
  /** CDI indexado em base 100 no início do período */
  cdi: number | null;
  total: number;
  invested: number;
}

export interface Performance {
  series: PerfPoint[];
  /** Rentabilidade da carteira no período (%) */
  twr: number;
  /** CDI acumulado no mesmo período (%) — null se a série não veio */
  cdiReturn: number | null;
  /** Rentabilidade em % do CDI (100 = empatou com o CDI) */
  pctOfCdi: number | null;
  /** Valor atual − total aportado */
  nominalGain: number;
  currentTotal: number;
  currentInvested: number;
  firstDate: string;
  lastDate: string;
}

/**
 * Fator acumulado do CDI por data. Como o CDI só tem cotação em dia útil,
 * guardamos também a lista ordenada para localizar o dia útil anterior.
 */
export interface CdiIndex {
  dates: string[];
  factor: Map<string, number>;
}

export function buildCdiIndex(daily: CdiPoint[]): CdiIndex {
  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const factor = new Map<string, number>();
  const dates: string[] = [];
  let f = 1;
  for (const d of sorted) {
    f *= 1 + d.rate / 100;
    factor.set(d.date, f);
    dates.push(d.date);
  }
  return { dates, factor };
}

/** Fator acumulado na data, ou no dia útil imediatamente anterior. */
function factorAt(idx: CdiIndex, date: string): number | null {
  if (idx.dates.length === 0) return null;
  if (date < idx.dates[0]) return 1;

  // Busca binária pelo maior date <= alvo
  let lo = 0, hi = idx.dates.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (idx.dates[mid] <= date) { best = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return best >= 0 ? idx.factor.get(idx.dates[best])! : 1;
}

export function computePerformance(
  snapshots: PortfolioSnapshot[],
  cdiDaily: CdiPoint[] = [],
): Performance | null {
  const snaps = [...snapshots]
    .map((s) => ({ ...s, total: Number(s.total), invested: Number(s.invested) }))
    .filter((s) => Number.isFinite(s.total) && Number.isFinite(s.invested))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Precisa de ao menos dois pontos para existir "variação".
  if (snaps.length < 2) return null;

  const idx = buildCdiIndex(cdiDaily);
  const hasCdi = idx.dates.length > 0;
  const baseFactor = hasCdi ? factorAt(idx, snaps[0].date) : null;

  const series: PerfPoint[] = [{
    date: snaps[0].date,
    carteira: 100,
    cdi: hasCdi ? 100 : null,
    total: snaps[0].total,
    invested: snaps[0].invested,
  }];

  let chained = 1;

  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1];
    const cur = snaps[i];

    const cashFlow = cur.invested - prev.invested; // aporte (ou resgate, se negativo)
    const denom = prev.total + 0.5 * cashFlow;

    // Denominador não positivo acontece quando a carteira começou zerada
    // ou foi totalmente resgatada — nesse intervalo não há retorno a medir.
    const r = denom > 0 ? (cur.total - prev.total - cashFlow) / denom : 0;
    chained *= 1 + r;

    let cdiIndexed: number | null = null;
    if (hasCdi && baseFactor) {
      const f = factorAt(idx, cur.date);
      cdiIndexed = f ? (f / baseFactor) * 100 : null;
    }

    series.push({
      date: cur.date,
      carteira: chained * 100,
      cdi: cdiIndexed,
      total: cur.total,
      invested: cur.invested,
    });
  }

  const twr = (chained - 1) * 100;

  const last = series[series.length - 1];
  const cdiReturn = last.cdi !== null ? last.cdi - 100 : null;

  // % do CDI só faz sentido com CDI positivo; com carteira negativa o número
  // fica ilegível, então deixamos null e a UI mostra o comparativo cru.
  const pctOfCdi = cdiReturn !== null && cdiReturn > 0 && twr > 0
    ? (twr / cdiReturn) * 100
    : null;

  const cur = snaps[snaps.length - 1];

  return {
    series,
    twr,
    cdiReturn,
    pctOfCdi,
    nominalGain: cur.total - cur.invested,
    currentTotal: cur.total,
    currentInvested: cur.invested,
    firstDate: snaps[0].date,
    lastDate: cur.date,
  };
}

/** Recorta os snapshots para os últimos N meses (null = tudo). */
export function filterByMonths(snapshots: PortfolioSnapshot[], months: number | null): PortfolioSnapshot[] {
  if (months === null) return snapshots;
  const cut = new Date();
  cut.setMonth(cut.getMonth() - months);
  const cutIso = cut.toISOString().slice(0, 10);
  return snapshots.filter((s) => s.date >= cutIso);
}
