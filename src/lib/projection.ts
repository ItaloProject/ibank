/**
 * Projeção mês a mês de uma carteira, posição por posição.
 *
 * - Cada posição rende pela própria regra sobre a curva mensal (lib/market-curve).
 * - % do CDI incide sobre a taxa diária (252 dias úteis), como nos bancos.
 * - Aporte no início do mês, dividido entre as posições por `pesoAporte`.
 * - IR por lote de aporte: tabela regressiva da renda fixa (22,5% a 15% conforme
 *   o prazo), 15% sobre o ganho em ações, isento quando indicado. O líquido de cada
 *   mês é o valor que sobraria se tudo fosse resgatado naquele mês.
 * - No vencimento, o IR é pago e o líquido é reaplicado a 100% do CDI.
 */
import type { Curve } from "@/lib/market-curve";

export type Rule =
  | { k: "cdi"; pct: number }
  | { k: "selic"; spread: number }
  | { k: "pre"; taxa: number }
  | { k: "ipca"; spread: number }
  | { k: "poupanca" }
  /** Taxa nominal fixa (% a.a.): dinheiro parado (0), DY de FIIs, média observada. */
  | { k: "fixa"; taxa: number };

export type TaxMode = "regressivo" | "acoes" | "isento";

export type Position = {
  id: string;
  /** Valor hoje. */
  valor: number;
  /** Quanto foi aplicado para chegar nesse valor (base do IR). */
  custo: number;
  /** Há quantos meses, em média, o valor atual foi aplicado. */
  idadeMeses: number;
  rule: Rule;
  /** Mês (a partir de hoje) em que vence; null = sem vencimento. */
  vencimento: number | null;
  /** Turbo: saldo máximo que rende `pct` do CDI; o excedente rende 100%. */
  teto?: number | null;
  tax: TaxMode;
  /** Fração dos novos aportes que vai para esta posição (a soma deve dar 1). */
  pesoAporte: number;
};

export type ProjectionInput = {
  positions: Position[];
  /** Aporte mensal (em dinheiro de hoje quando `aporteCorrigido`). */
  aporte: number;
  meses: number;
  curve: Curve;
  /** Corrige o aporte pela inflação da curva (aporte constante em dinheiro de hoje). */
  aporteCorrigido?: boolean;
};

export type MonthPoint = {
  /** Valor de mercado no fim do mês (índice 0 = hoje). */
  bruto: number;
  /** Valor se tudo fosse resgatado no fim do mês, já sem IR. */
  liquido: number;
  /** Soma nominal do que foi aportado (inclui o valor inicial). */
  aportado: number;
  /** Aporte nominal feito neste mês. */
  aporteMes: number;
  /** Rendimento bruto do mês (queda por IR pago em vencimento entra aqui). */
  jurosMes: number;
  /** Taxa mensal média ponderada da carteira no mês. */
  taxaMes: number;
  /** Mesma taxa, descontando a alíquota de longo prazo de cada posição. */
  taxaMesLiquida: number;
  /** Inflação acumulada desde hoje (1 = hoje). */
  deflator: number;
};

const LONG_TERM = 0.15;
const DAYS_PER_MONTH = 365.25 / 12;

export function regressiveRate(months: number): number {
  const days = months * DAYS_PER_MONTH;
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}

export function longTermRate(tax: TaxMode): number {
  return tax === "isento" ? 0 : LONG_TERM;
}

const at = (arr: number[], t: number) => arr[Math.min(t, arr.length - 1)];
const monthlyFromAnnual = (a: number) => Math.pow(1 + a / 100, 1 / 12) - 1;

export function cdiMonthly(cdiAnnual: number, pct: number): number {
  const daily = Math.pow(1 + cdiAnnual / 100, 1 / 252) - 1;
  return Math.pow(1 + (daily * pct) / 100, 21) - 1;
}

/** Taxa mensal de uma regra no mês `t`. */
export function ruleMonthly(rule: Rule, curve: Curve, t: number, matured = false): number {
  const cdi = at(curve.cdi, t);
  if (matured) return cdiMonthly(cdi, 100);
  switch (rule.k) {
    case "cdi":
      return cdiMonthly(cdi, rule.pct);
    case "selic":
      return (1 + cdiMonthly(cdi, 100)) * (1 + monthlyFromAnnual(rule.spread)) - 1;
    case "pre":
      return monthlyFromAnnual(rule.taxa);
    case "ipca":
      return (1 + monthlyFromAnnual(at(curve.ipca, t))) * (1 + monthlyFromAnnual(rule.spread)) - 1;
    case "poupanca": {
      const selic = at(curve.selic, t);
      return selic > 8.5 ? 0.005 : monthlyFromAnnual(selic * 0.7);
    }
    case "fixa":
      return monthlyFromAnnual(rule.taxa);
  }
}

/** Taxa anual equivalente (% a.a.) de uma regra nos 12 meses a partir de `from`. */
export function ruleAnnual(rule: Rule, curve: Curve, from = 0, vencimento: number | null = null): number {
  let g = 1;
  for (let t = from; t < from + 12; t++) g *= 1 + ruleMonthly(rule, curve, t, vencimento != null && t >= vencimento);
  return (g - 1) * 100;
}

type Lot = { s: number; base: number; custo: number; idade0: number };

type PosState = {
  p: Position;
  G: number[];
  S: number;
  custo: number;
  lots: Lot[];
  matured: boolean;
};

function positionValue(st: PosState, t: number) {
  return st.S * st.G[t];
}

function positionTax(st: PosState, t: number): number {
  if (st.p.tax === "isento") return 0;
  const value = positionValue(st, t);
  let tax = LONG_TERM * Math.max(0, value - st.custo);
  if (st.p.tax === "acoes") return tax;
  for (let i = st.lots.length - 1; i >= 0; i--) {
    const lot = st.lots[i];
    const idade = lot.idade0 + (t - lot.s);
    const extra = regressiveRate(idade) - LONG_TERM;
    if (extra <= 0) break;
    const lotValue = (lot.base * st.G[t]) / st.G[lot.s];
    tax += extra * Math.max(0, lotValue - lot.custo);
  }
  return tax;
}

export function project(input: ProjectionInput): MonthPoint[] {
  const { curve, meses } = input;
  const states: PosState[] = input.positions
    .filter((p) => p.valor > 0 || p.pesoAporte > 0)
    .map((p) => {
      const G = new Array<number>(meses + 1);
      G[0] = 1;
      const lots: Lot[] = p.valor > 0 ? [{ s: 0, base: p.valor, custo: Math.max(0, p.custo), idade0: Math.max(0, p.idadeMeses) }] : [];
      return { p, G, S: Math.max(0, p.valor), custo: p.valor > 0 ? Math.max(0, p.custo) : 0, lots, matured: p.vencimento != null && p.vencimento <= 0 };
    });

  const inicial = states.reduce((s, st) => s + st.S, 0);
  const inicialLiq = inicial - states.reduce((s, st) => s + positionTax(st, 0), 0);
  const out: MonthPoint[] = [{
    bruto: inicial, liquido: inicialLiq, aportado: inicial, aporteMes: 0, jurosMes: 0, taxaMes: 0, taxaMesLiquida: 0, deflator: 1,
  }];

  let aportado = inicial;
  let deflator = 1;
  for (let t = 0; t < meses; t++) {
    const aporteMes = input.aporte > 0 ? input.aporte * (input.aporteCorrigido ? deflator : 1) : 0;
    let antes = 0;
    let pesoTaxa = 0;
    let somaTaxa = 0;
    let somaTaxaLiq = 0;

    for (const st of states) {
      if (aporteMes > 0 && st.p.pesoAporte > 0) {
        const base = aporteMes * st.p.pesoAporte;
        st.lots.push({ s: t, base, custo: base, idade0: 0 });
        st.S += base / st.G[t];
        st.custo += base;
      }
      const value = positionValue(st, t);
      let r = ruleMonthly(st.p.rule, curve, t, st.matured);
      if (!st.matured && st.p.rule.k === "cdi" && st.p.teto && value > st.p.teto) {
        const acima = value - st.p.teto;
        r = (st.p.teto * r + acima * cdiMonthly(at(curve.cdi, t), 100)) / value;
      }
      st.G[t + 1] = st.G[t] * (1 + r);
      antes += value;
      pesoTaxa += value;
      somaTaxa += value * r;
      somaTaxaLiq += value * r * (1 - longTermRate(st.p.tax));

      if (!st.matured && st.p.vencimento != null && t + 1 >= st.p.vencimento) {
        const bruto = positionValue(st, t + 1);
        const liquido = bruto - positionTax(st, t + 1);
        st.matured = true;
        st.S = liquido / st.G[t + 1];
        st.custo = liquido;
        st.lots = [{ s: t + 1, base: liquido, custo: liquido, idade0: 0 }];
      }
    }

    aportado += aporteMes;
    deflator *= 1 + monthlyFromAnnual(at(curve.ipca, t));
    let bruto = 0;
    let tax = 0;
    for (const st of states) {
      bruto += positionValue(st, t + 1);
      tax += positionTax(st, t + 1);
    }
    out.push({
      bruto,
      liquido: bruto - tax,
      aportado,
      aporteMes,
      jurosMes: bruto - antes,
      taxaMes: pesoTaxa > 0 ? somaTaxa / pesoTaxa : 0,
      taxaMesLiquida: pesoTaxa > 0 ? somaTaxaLiq / pesoTaxa : 0,
      deflator,
    });
  }
  return out;
}

/** Aporte mensal necessário para que `pick(último mês)` chegue a `alvo` (a projeção é linear no aporte). */
export function solveAporte(
  base: Omit<ProjectionInput, "aporte">,
  alvo: number,
  pick: (m: MonthPoint) => number,
): number {
  const last = (a: MonthPoint[]) => a[a.length - 1];
  const f0 = pick(last(project({ ...base, aporte: 0 })));
  if (f0 >= alvo) return 0;
  const f1 = pick(last(project({ ...base, aporte: 1000 })));
  const k = (f1 - f0) / 1000;
  return k > 0 ? (alvo - f0) / k : Infinity;
}
