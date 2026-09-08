/**
 * Rebalanceamento por aporte.
 *
 * Rebalancear vendendo o que subiu gera ganho de capital tributável e custo de
 * corretagem. Direcionar o dinheiro novo para as classes abaixo do alvo chega
 * no mesmo lugar sem fato gerador de imposto — por isso o plano aqui é sempre
 * de compra. Quando uma classe está tão acima do alvo que o aporte não corrige,
 * a UI sinaliza, mas a decisão de vender fica com o usuário.
 */

export type AssetClass = "renda_fixa" | "acoes" | "fii";

export const CLASS_META: Record<AssetClass, { label: string; color: string }> = {
  renda_fixa: { label: "Renda Fixa", color: "#3b82f6" },
  acoes:      { label: "Ações",      color: "#10b981" },
  fii:        { label: "FIIs",       color: "#f59e0b" },
};

/** Alvos por perfil, consolidados nas três classes que o app consegue medir. */
export const PROFILE_TARGETS: Record<string, Record<AssetClass, number>> = {
  // Crescimento: mais bolsa, renda fixa como lastro (Tesouro IPCA+ 20 + RF 15)
  aposentadoria: { acoes: 40, fii: 25, renda_fixa: 35 },
  // Renda: FIIs no topo por pagarem mensalmente (CDB/LCI 20 + Selic 5)
  renda_mensal:  { acoes: 35, fii: 40, renda_fixa: 25 },
};

export const DEFAULT_TARGET = PROFILE_TARGETS.aposentadoria;

export interface RebalanceRow {
  cls: AssetClass;
  label: string;
  color: string;
  current: number;
  currentPct: number;
  targetPct: number;
  /** Valor ideal considerando o patrimônio já somado ao aporte */
  idealValue: number;
  /** Quanto comprar desta classe com o aporte */
  buy: number;
  buyPct: number;
  afterValue: number;
  afterPct: number;
  /** Desvio atual em pontos percentuais (positivo = abaixo do alvo) */
  gap: number;
  /** Acima do alvo — aporte sozinho não corrige */
  overweight: boolean;
}

export interface RebalanceResult {
  rows: RebalanceRow[];
  total: number;
  totalAfter: number;
  /** Maior desvio absoluto atual, em pontos percentuais */
  maxDrift: number;
  /** Alguma classe está acima do alvo mesmo após o aporte */
  needsSelling: boolean;
}

const CLASSES: AssetClass[] = ["renda_fixa", "acoes", "fii"];

export function computeRebalance(
  current: Record<AssetClass, number>,
  targetPct: Record<AssetClass, number>,
  aporte: number,
): RebalanceResult {
  const safeAporte = Math.max(0, aporte);
  const total = CLASSES.reduce((s, c) => s + Math.max(0, current[c] ?? 0), 0);
  const totalAfter = total + safeAporte;

  // Quanto falta para cada classe atingir o alvo no patrimônio pós-aporte
  const ideal: Record<AssetClass, number> = { renda_fixa: 0, acoes: 0, fii: 0 };
  const need: Record<AssetClass, number> = { renda_fixa: 0, acoes: 0, fii: 0 };
  for (const c of CLASSES) {
    ideal[c] = (totalAfter * (targetPct[c] ?? 0)) / 100;
    need[c] = Math.max(0, ideal[c] - Math.max(0, current[c] ?? 0));
  }
  const totalNeed = CLASSES.reduce((s, c) => s + need[c], 0);

  const buy: Record<AssetClass, number> = { renda_fixa: 0, acoes: 0, fii: 0 };
  if (safeAporte > 0) {
    if (totalNeed <= 0) {
      // Já está no alvo: distribui o aporte na proporção do próprio alvo
      for (const c of CLASSES) buy[c] = (safeAporte * (targetPct[c] ?? 0)) / 100;
    } else if (totalNeed <= safeAporte) {
      // Cobre todas as defasagens e espalha o troco conforme o alvo
      const leftover = safeAporte - totalNeed;
      for (const c of CLASSES) buy[c] = need[c] + (leftover * (targetPct[c] ?? 0)) / 100;
    } else {
      // Aporte insuficiente: prioriza quem está mais distante do alvo
      for (const c of CLASSES) buy[c] = (safeAporte * need[c]) / totalNeed;
    }
  }

  const rows: RebalanceRow[] = CLASSES.map((c) => {
    const cur = Math.max(0, current[c] ?? 0);
    const after = cur + buy[c];
    const currentPct = total > 0 ? (cur / total) * 100 : 0;
    const tgt = targetPct[c] ?? 0;
    return {
      cls: c,
      label: CLASS_META[c].label,
      color: CLASS_META[c].color,
      current: cur,
      currentPct,
      targetPct: tgt,
      idealValue: ideal[c],
      buy: buy[c],
      buyPct: safeAporte > 0 ? (buy[c] / safeAporte) * 100 : 0,
      afterValue: after,
      afterPct: totalAfter > 0 ? (after / totalAfter) * 100 : 0,
      gap: tgt - currentPct,
      overweight: total > 0 && currentPct > tgt + 0.5,
    };
  });

  const maxDrift = total > 0
    ? Math.max(...rows.map((r) => Math.abs(r.gap)))
    : 0;

  // Sobra desvio acima do alvo depois do aporte -> só vendendo para corrigir
  const needsSelling = rows.some((r) => r.afterPct > r.targetPct + 1);

  return { rows, total, totalAfter, maxDrift, needsSelling };
}
