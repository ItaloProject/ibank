/**
 * Respostas da carteira no servidor (app Android e iOS): o mesmo contexto e as mesmas funções
 * de resposta do site (investor-bot), montados a partir do snapshot da pessoa.
 */
import type { Intent } from "@/lib/bot-intent";
import { matchLocalPortfolio, type LocalHit } from "@/lib/bot-local";
import { alertsReply, aporteDeadlineReply, goalExplainReply, rebalReply, replyFor, type BotPortfolioContext, type Msg } from "@/lib/bot-replies";
import { buildMarketResearch } from "@/lib/market-research";
import { computeMonthlyPassiveIncome } from "@/lib/passive-income";
import { planInsights, planScore, type AnalysisPayload } from "@/lib/plan-view";
import type { UserSnapshot } from "@/lib/server/portfolio-snapshot";

/** Telas da carteira que o servidor responde com os números. */
export const PORTFOLIO_INTENTS: Intent[] = ["visao", "rebal", "fiis", "meta", "avisos", "explica_meta", "aporte_prazo"];

const TIPO_FONTE: Record<string, string> = {
  turbo: "TURBO",
  fii: "FII",
  rf: "Renda Fixa",
  dividendo: "Ação",
  provento: "Provento",
};

/** Análise da carteira no formato de /api/bot/analysis (usada pela resposta de rebalanceamento). */
export function analysisFromSnapshot(s: UserSnapshot): AnalysisPayload {
  return {
    nome: s.nome,
    profile: s.profile,
    profileDefinido: s.profileDefinido,
    aporte: s.aporte,
    aporteOrigem: s.aporteOrigem,
    gastoMensal: s.gastoMensal,
    metaRenda: s.metaRenda,
    plan: s.plan,
    rows: s.portfolio?.rows ?? [],
    alerts: s.alerts,
    goal: s.goal,
    rates: {
      selic: s.rates.selicAnual,
      cdi: s.rates.cdiAnual,
      ipca12m: s.rates.ipca12m ?? null,
      source: s.rates.source,
      focusData: s.rates.focus?.data ?? null,
    },
  };
}

/** Contexto da carteira igual ao que a tela Investir passa ao assistente. */
export function botContextFromSnapshot(s: UserSnapshot): BotPortfolioContext {
  const plan = s.plan;
  const passive = computeMonthlyPassiveIncome(s.raw.accounts, s.raw.investments, s.raw.trades, s.rates.cdiAnual, s.raw.proventos);
  const covered = new Set(s.raw.proventos.map((p) => p.ticker.toUpperCase()));
  const somaAtual = (lista: { valorAtual: number }[]) => lista.reduce((t, x) => t + x.valorAtual, 0);

  const capitalDe = (kind: string, label: string): number => {
    if (kind === "turbo") return s.raw.accounts.find((a) => a.name === label && a.is_turbo)?.current_balance ?? 0;
    if (kind === "rf") return s.accounts.find((a) => a.nome === label && a.grupo !== "saldo")?.saldo ?? 0;
    if (kind === "provento") return s.stocks.find((p) => p.ticker.toUpperCase() === label.toUpperCase())?.valorAtual ?? 0;
    if (kind === "fii") return somaAtual(s.stocks.filter((p) => p.tipo === "FII" && !covered.has(p.ticker.toUpperCase())));
    return somaAtual(s.stocks.filter((p) => ["Ação", "BDR", "ETF"].includes(p.tipo) && !covered.has(p.ticker.toUpperCase())));
  };

  const sources = passive.sources.map((src) => ({
    nome: src.label,
    tipo: TIPO_FONTE[src.kind] ?? src.kind,
    capital: capitalDe(src.kind, src.label),
    rendaMensal: src.value,
  }));

  // Patrimônio = saldo de todas as contas + valor atual das ações (mesma conta da tela Investir).
  const grandTotal = s.accounts.reduce((t, a) => t + a.saldo, 0) + somaAtual(s.stocks);
  const incomeGoal = s.metaRenda ?? 0;

  return {
    score: plan ? planScore(plan) : null,
    totalRendaMensal: passive.total,
    incomeGoal,
    grandTotal,
    emerTotal: plan ? plan.reserva.atual : null,
    insights: plan
      ? planInsights(plan).map((i) => ({ level: i.level, title: i.title, detail: i.detail }))
      : [],
    sources,
    alerts: s.alerts,
    goal: s.goal && s.metaRenda === incomeGoal ? { ...s.goal, aporte: s.aporte, aporteOrigem: s.aporteOrigem } : null,
    holdings: s.stocks.map((p) => ({ ticker: p.ticker, kind: p.tipo, value: p.valorAtual })),
    bolsaResultado: s.stocks.reduce((t, p) => t + p.resultado, 0),
    hasEmergenciaCaixinha: s.accounts.some((a) => a.grupo === "emergencia"),
  };
}

/** Resposta da tela da carteira, com os números da pessoa. */
export async function portfolioReply(intent: Intent, s: UserSnapshot, text: string): Promise<Msg> {
  if (intent === "rebal") return rebalReply(analysisFromSnapshot(s));
  const ctx = botContextFromSnapshot(s);
  if (intent === "avisos") return alertsReply(ctx.alerts);
  if (intent === "aporte_prazo") return aporteDeadlineReply(text, ctx);
  const research = await buildMarketResearch().catch(() => null);
  if (intent === "explica_meta") return goalExplainReply(ctx, research);
  return replyFor(intent, ctx, research);
}

/** Pergunta que o site responde com os números (matchLocalPortfolio), sem chamar nada externo. */
export function localPortfolioHit(text: string, ctx: BotPortfolioContext): LocalHit | null {
  return matchLocalPortfolio(text, {
    grandTotal: ctx.grandTotal,
    totalRendaMensal: ctx.totalRendaMensal,
    incomeGoal: ctx.incomeGoal,
    holdings: ctx.holdings,
    sources: ctx.sources,
    alerts: ctx.alerts,
    bolsaResultado: ctx.bolsaResultado ?? null,
    hasEmergenciaCaixinha: Boolean(ctx.hasEmergenciaCaixinha),
  });
}
