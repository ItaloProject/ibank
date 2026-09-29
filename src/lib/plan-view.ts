/**
 * Tradução do plano de rebalanceamento para a tela (Metas, bot e LIVE):
 * nota da carteira, diagnóstico, próximos aportes e alocação por classe.
 * Uma única fonte de regras: tudo sai de buildRebalancePlan.
 */
import { RISK_PROFILES, alocacaoRelevante, type Bucket, type RebalancePlan, type RiskProfile, type Suggestion } from "@/lib/rebalance";

/** Seção da tela de investir do LIVE (?investir=<seção>). */
export type InvestSection = "hub" | "acoes" | "fiis" | "tesouro" | "rendafixa" | "turbo" | "eme";

export const BUCKET_SECTION: Record<Bucket, InvestSection> = {
  reserva: "eme",
  pos: "rendafixa",
  inflacao: "tesouro",
  prefixado: "tesouro",
  fiis: "fiis",
  acoes: "acoes",
  caixa: "hub",
};

export const BUCKET_COLOR: Record<Exclude<Bucket, "reserva" | "caixa">, string> = {
  pos: "#38bdf8",
  inflacao: "#a78bfa",
  prefixado: "#f5c425",
  fiis: "#14b8a6",
  acoes: "#10b981",
};

const BUCKET_DESC: Record<Exclude<Bucket, "reserva" | "caixa">, string> = {
  pos: "CDB, caixinhas e Tesouro Selic",
  inflacao: "Tesouro IPCA+ e títulos atrelados à inflação",
  prefixado: "Taxa travada até o vencimento",
  fiis: "Renda mensal de aluguéis e recebíveis",
  acoes: "Crescimento e dividendos",
};

/** Resposta de /api/bot/analysis. */
export type AnalysisPayload = {
  nome: string;
  profile: RiskProfile;
  profileDefinido: boolean;
  aporte: number;
  aporteOrigem: "meta" | "media" | "padrao";
  gastoMensal: number | null;
  metaRenda?: number | null;
  plan: RebalancePlan | null;
  rates: { selic: number; cdi: number; ipca12m: number | null; source: string; focusData: string | null };
};

export type InsightLevel = "critical" | "warning" | "ok" | "suggestion";

export type PlanInsight = {
  level: InsightLevel;
  title: string;
  detail: string;
  section?: InvestSection;
  /** Ticker para abrir a venda (?vender=). */
  sell?: string;
  actionLabel?: string;
};

export type PlanMove = {
  prioridade: number;
  label: string;
  valor: number;
  razao: string;
  section: InvestSection;
};

export type PlanAllocation = { id: string; label: string; atual: number; ideal: number; cor: string; desc: string };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const PENALTY: Record<Suggestion["prioridade"], number> = { alta: 25, media: 10, baixa: 4 };

/** Nota de 0 a 100: desconta cada sugestão pelo peso e o desvio da alocação-alvo. */
export function planScore(plan: RebalancePlan): number {
  let score = 100 - plan.sugestoes.reduce((s, x) => s + PENALTY[x.prioridade], 0);
  if (alocacaoRelevante(plan)) score -= Math.min(20, plan.desvio / 2);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function suggestionInsight(s: Suggestion, plan: RebalancePlan): PlanInsight {
  if (s.id === "reserva") {
    const critico = plan.reserva.atual < plan.reserva.alvo * 0.5;
    return { level: critico ? "critical" : "warning", title: s.titulo, detail: s.detalhe, section: "eme", actionLabel: "Aplicar na reserva" };
  }
  if (s.id === "caixa") return { level: "warning", title: s.titulo, detail: s.detalhe, section: "hub", actionLabel: "Investir o saldo" };
  if (s.id.startsWith("turbo-")) return { level: "warning", title: s.titulo, detail: s.detalhe, section: "rendafixa", actionLabel: "Ver renda fixa" };
  if (s.id.startsWith("dup-")) {
    const sell = s.id.slice(4).split("+")[1];
    return { level: "suggestion", title: s.titulo, detail: s.detalhe, sell, actionLabel: sell ? `Vender ${sell}` : undefined };
  }
  return { level: s.prioridade === "baixa" ? "suggestion" : "warning", title: s.titulo, detail: s.detalhe };
}

export function planInsights(plan: RebalancePlan): PlanInsight[] {
  const out = plan.sugestoes.map((s) => suggestionInsight(s, plan));
  if (plan.reserva.atual >= plan.reserva.alvo - 1) {
    out.push({
      level: "ok",
      title: `Reserva de emergência completa: ${brl(plan.reserva.atual)}`,
      detail: plan.reserva.baseadaEmGastos
        ? `Cobre ${plan.reserva.meses} meses dos seus gastos. Os próximos aportes vão para a alocação do perfil.`
        : "Cadastre seus gastos no Planejamento para ajustar o tamanho ideal da reserva.",
    });
  }
  if (alocacaoRelevante(plan) && plan.desvio < 10) {
    out.push({ level: "ok", title: "Alocação alinhada ao seu perfil", detail: `Só ${Math.round(plan.desvio)}% da parte fora da reserva está fora do alvo.` });
  }
  return out;
}

export function planMoves(plan: RebalancePlan): PlanMove[] {
  const alvo = RISK_PROFILES[plan.profile];
  return plan.plano.map((a, i) => {
    const b = plan.buckets.find((x) => x.id === a.bucket);
    const razao = a.bucket === "reserva"
      ? `Completa a reserva de emergência (${brl(plan.reserva.atual)} de ${brl(plan.reserva.alvo)}) antes de tudo.`
      : b && alocacaoRelevante(plan)
        ? `Hoje em ${Math.round(b.pct)}% da parte fora da reserva; o alvo do perfil ${alvo.label.toLowerCase()} é ${Math.round(b.alvoPct)}%.`
        : `Alvo do perfil ${alvo.label.toLowerCase()}: ${Math.round(b?.alvoPct ?? 0)}% da parte fora da reserva.`;
    return { prioridade: i + 1, label: a.label, valor: a.valor, razao, section: BUCKET_SECTION[a.bucket] };
  });
}

export function planAllocation(plan: RebalancePlan): PlanAllocation[] {
  return plan.buckets.map((b) => ({
    id: b.id,
    label: b.label,
    atual: b.pct,
    ideal: b.alvoPct,
    cor: BUCKET_COLOR[b.id],
    desc: BUCKET_DESC[b.id],
  }));
}
