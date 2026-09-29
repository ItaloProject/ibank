/**
 * Tradução do plano de rebalanceamento para a tela (Metas, bot e LIVE):
 * nota da carteira, diagnóstico, próximos aportes e alocação por classe.
 * Uma única fonte de regras: tudo sai de buildRebalancePlan.
 */
import { RISK_PROFILES, alocacaoRelevante, type Bucket, type RebalancePlan, type RiskProfile, type Suggestion } from "@/lib/rebalance";
import type { BotAlert } from "@/lib/alerts";

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

export const INVEST_SECTIONS: InvestSection[] = ["hub", "acoes", "fiis", "tesouro", "rendafixa", "turbo", "eme"];

export const SECTION_LABEL: Record<InvestSection, string> = {
  hub: "Investir",
  acoes: "ações",
  fiis: "fundos imobiliários",
  tesouro: "Tesouro Direto",
  rendafixa: "renda fixa",
  turbo: "Caixinha Turbo",
  eme: "Reserva de emergência",
};

/** Ação que o assistente pode oferecer como botão. */
export type BotAction =
  | { kind: "investir"; section: InvestSection; amount?: number }
  | { kind: "vender"; ticker: string };

export function actionHref(a: BotAction): string {
  if (a.kind === "vender") return `/investimentos?vender=${encodeURIComponent(a.ticker)}`;
  const valor = a.amount && a.amount > 0 ? `&valor=${Math.round(a.amount * 100) / 100}` : "";
  return `/investimentos?investir=${a.section}${valor}`;
}

export function actionLabel(a: BotAction): string {
  if (a.kind === "vender") return `Vender ${a.ticker}`;
  if (a.section === "hub") return a.amount ? `Investir ${brl(a.amount)}` : "Abrir Investir";
  const dest = SECTION_LABEL[a.section];
  return a.amount ? `Aplicar ${brl(a.amount)} em ${dest}` : `Abrir ${dest}`;
}

/**
 * Marcadores que a IA escreve no fim da resposta: <<investir:eme:500>> e <<vender:PTR4>>.
 * Remove os marcadores do texto e devolve só as ações válidas (no máximo 3).
 */
export function extractActions(text: string, ownedTickers: string[]): { text: string; actions: BotAction[] } {
  const owned = new Set(ownedTickers.map((t) => t.toUpperCase()));
  const actions: BotAction[] = [];
  const clean = text.replace(/<<\s*(investir|vender)\s*:\s*([a-z0-9]+)\s*(?::\s*([\d.,]+))?\s*>>/gi, (_, kind: string, arg: string, num?: string) => {
    if (actions.length >= 3) return "";
    if (kind.toLowerCase() === "vender") {
      const ticker = arg.toUpperCase();
      if (owned.has(ticker)) actions.push({ kind: "vender", ticker });
      return "";
    }
    const section = arg.toLowerCase() as InvestSection;
    if (!INVEST_SECTIONS.includes(section)) return "";
    const amount = num ? Number(num.replace(/\./g, "").replace(",", ".")) : NaN;
    actions.push({ kind: "investir", section, amount: amount > 0 && amount < 1e9 ? Math.round(amount * 100) / 100 : undefined });
    return "";
  });
  return { text: clean.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), actions };
}

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
  alerts?: BotAlert[];
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
