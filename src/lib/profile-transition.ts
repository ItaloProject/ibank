import { RISK_PROFILES, type Allocation, type InvestBucket, type RebalancePlan, type RiskProfile } from "@/lib/rebalance";

export type TransitionClass = {
  bucket: InvestBucket;
  label: string;
  valor: number;
  atualPct: number;
  /** Alvo do perfil anterior; null quando não informado. */
  alvoAntesPct: number | null;
  alvoNovoPct: number;
  /** Quanto falta (positivo) ou sobra (negativo) para o alvo novo, em R$. */
  diff: number;
};

export type TransitionSale = { bucket: InvestBucket; label: string; valor: number; nota: string };

export type ProfileTransition = {
  from: RiskProfile | null;
  to: RiskProfile;
  direcao: "mais_risco" | "menos_risco" | "igual";
  investido: number;
  /** Desvio da carteira atual em relação ao alvo novo, em pontos percentuais. */
  desvio: number;
  classes: TransitionClass[];
  reserva: { atual: number; alvoAntes: number | null; alvoNovo: number; mesesNovo: number; falta: number; liberada: number };
  aporte: number;
  aporteDoMes: Allocation[];
  /** Meses para ficar a até 5 pontos percentuais do alvo só com aportes; null sem aporte ou acima de 20 anos. */
  mesesSoAportes: number | null;
  /** Vendas opcionais para chegar mais rápido, das classes acima do alvo. */
  vendas: TransitionSale[];
  /** Carteira pequena: percentuais ainda não fazem sentido, os aportes já seguem o perfil novo. */
  carteiraPequena: boolean;
};

export function formatMonths(meses: number): string {
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const a = anos ? `${anos} ${anos === 1 ? "ano" : "anos"}` : "";
  const m = resto ? `${resto} ${resto === 1 ? "mês" : "meses"}` : "";
  return [a, m].filter(Boolean).join(" e ");
}

const ORDER: RiskProfile[] = ["conservador", "moderado", "arrojado"];
const MAX_MESES = 240;
const ALINHADO_PP = 5;

const SALE_NOTE: Record<InvestBucket, string> = {
  pos: "Resgate sem perda de valor. Paga Imposto de Renda de 22,5% a 15% sobre o rendimento, conforme o prazo; LCI e LCA são isentas.",
  inflacao: "Vender antes do vencimento pode dar perda se os juros subiram. Paga Imposto de Renda de 22,5% a 15% sobre o ganho.",
  prefixado: "Vender antes do vencimento pode dar perda se os juros subiram. Paga Imposto de Renda de 22,5% a 15% sobre o ganho.",
  fiis: "Paga 20% de Imposto de Renda sobre o lucro da venda, sem isenção.",
  acoes: "Vendas de ações de até R$ 20 mil no mês são isentas de Imposto de Renda; acima disso, 15% sobre o lucro.",
};

function desvioDe(valores: Record<InvestBucket, number>, alvo: Record<InvestBucket, number>): number {
  const total = Object.values(valores).reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  return (Object.keys(alvo) as InvestBucket[]).reduce((s, b) => s + Math.abs(valores[b] / total - alvo[b]) * 100, 0) / 2;
}

/** Simula aportes sempre nas classes mais abaixo do alvo, sem vender e sem contar rendimento. */
function monthsByContributions(start: Record<InvestBucket, number>, alvo: Record<InvestBucket, number>, aporte: number, faltaReserva: number): number | null {
  if (desvioDe(start, alvo) <= ALINHADO_PP) return 0;
  if (!(aporte > 0)) return null;
  const v = { ...start };
  const buckets = Object.keys(alvo) as InvestBucket[];
  let reserva = faltaReserva;
  for (let m = 1; m <= MAX_MESES; m++) {
    let resto = aporte;
    if (reserva > 0) {
      const r = Math.min(resto, reserva);
      reserva -= r;
      resto -= r;
    }
    if (resto > 0) {
      const alvoTotal = buckets.reduce((s, b) => s + v[b], 0) + resto;
      const deficits = buckets.map((b) => Math.max(0, alvo[b] * alvoTotal - v[b]));
      const soma = deficits.reduce((s, d) => s + d, 0);
      buckets.forEach((b, i) => {
        v[b] += soma >= resto ? (resto * deficits[i]) / soma : deficits[i] + (resto - soma) * alvo[b];
      });
    }
    if (reserva <= 0 && desvioDe(v, alvo) <= ALINHADO_PP) return m;
  }
  return null;
}

/**
 * Caminho da carteira atual até o perfil `toPlan.profile`. `toPlan` é o plano calculado com o perfil novo
 * (mesmos dados); `fromPlan`, opcional, é o do perfil anterior para comparar alvos e reserva.
 */
export function buildProfileTransition(toPlan: RebalancePlan, fromPlan: RebalancePlan | null = null): ProfileTransition {
  const to = toPlan.profile;
  const from = fromPlan?.profile ?? null;
  const alvo = RISK_PROFILES[to].alvo;
  const valores = Object.fromEntries(toPlan.buckets.map((b) => [b.id, b.valor])) as Record<InvestBucket, number>;
  const faltaReserva = Math.max(0, toPlan.reserva.alvo - toPlan.reserva.atual);
  const minVenda = Math.max(200, toPlan.investido * 0.05);

  return {
    from,
    to,
    direcao: from === null || from === to ? "igual" : ORDER.indexOf(to) > ORDER.indexOf(from) ? "mais_risco" : "menos_risco",
    investido: toPlan.investido,
    desvio: toPlan.desvio,
    classes: toPlan.buckets.map((b) => ({
      bucket: b.id,
      label: b.label,
      valor: b.valor,
      atualPct: b.pct,
      alvoAntesPct: from ? RISK_PROFILES[from].alvo[b.id] * 100 : null,
      alvoNovoPct: b.alvoPct,
      diff: b.diff,
    })),
    reserva: {
      atual: toPlan.reserva.atual,
      alvoAntes: fromPlan?.reserva.alvo ?? null,
      alvoNovo: toPlan.reserva.alvo,
      mesesNovo: toPlan.reserva.meses,
      falta: faltaReserva,
      liberada: fromPlan ? Math.max(0, fromPlan.reserva.alvo - toPlan.reserva.alvo) : 0,
    },
    aporte: toPlan.aporte,
    aporteDoMes: toPlan.plano,
    mesesSoAportes: monthsByContributions(valores, alvo, toPlan.aporte, faltaReserva),
    vendas: toPlan.buckets
      .filter((b) => -b.diff >= minVenda)
      .sort((a, b) => a.diff - b.diff)
      .map((b) => ({ bucket: b.id, label: b.label, valor: Math.round(-b.diff / 10) * 10, nota: SALE_NOTE[b.id] })),
    carteiraPequena: toPlan.investido < 1000,
  };
}
