"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readBotPageContext } from "@/lib/bot-page-context";
import type { BotAlert } from "@/lib/alerts";
import type { GoalProjection } from "@/lib/goal-projection";
import { detectIntent, keywordIntent, profileTarget, type Intent } from "@/lib/bot-intent";
import { askAbout, asksExample, findTerms, holdingsFor, termById, termExample, termMarkdown, type Term } from "@/lib/glossary";
import { financeReply } from "@/lib/genie/local-answer";
import { answerMarkdown } from "@/lib/genie/answer";
import { looksLikeWebQuestion } from "@/lib/genie/chat";
import { SNOOZE_DAYS, alertStatus, parseAlertChoices, snoozeChoice, trimAlertChoices, type AlertChoices } from "@/lib/alert-choices";
import {
  X, ArrowUp, ArrowRight, Bell, PieChart, Building2, Scale, FileDown, Target, RotateCcw,
  Maximize2, Minimize2, AlertTriangle, AlertOctagon, CheckCircle2, MessageCircle, SlidersHorizontal, ThumbsUp, ThumbsDown,
  Clock, EyeOff,
  type LucideIcon,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { MarketResearchPayload } from "@/lib/market-research";
import { FALLBACK_CDI } from "@/lib/investment-rates";
import { RISK_PROFILES, alocacaoRelevante, type RiskProfile } from "@/lib/rebalance";
import { formatMonths as duration, type ProfileTransition } from "@/lib/profile-transition";
import { BUCKET_SECTION, actionHref, actionLabel, type AnalysisPayload, type BotAction } from "@/lib/plan-view";
import { WhatsappPanel } from "@/components/bot/whatsapp-panel";
import { RiskProfilePicker, saveRiskProfile } from "@/components/bot/risk-profile-picker";

/** Mascote do Muvo; o desenho tem fundo claro próprio, então serve nos dois temas. */
function BotAvatar({ className }: { className?: string }) {
  return (
    <span className={cn("block shrink-0 overflow-hidden rounded-full bg-white", className)} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bot/muvo-bot.webp" alt="" width={192} height={192} draggable={false}
        className="h-full w-full object-cover select-none" />
    </span>
  );
}

export type BotPortfolioContext = {
  /** Nota do plano de rebalanceamento; null enquanto o servidor calcula. */
  score: number | null;
  totalRendaMensal: number;
  incomeGoal: number;
  grandTotal: number;
  emerTotal: number | null;
  insights: { level: string; title: string; detail: string }[];
  sources: { nome: string; tipo: string; capital: number; rendaMensal: number }[];
  alerts: BotAlert[];
  /** Projeção do servidor para a meta atual; null se a meta mudou e a análise ainda não voltou. */
  goal: (GoalProjection & { aporte: number; aporteOrigem: AnalysisPayload["aporteOrigem"] }) | null;
  holdings: { ticker: string; kind: string; value: number }[];
};

/* ── Modelo da conversa ─────────────────────────────────────────── */

type Tone = "pos" | "warn" | "neg";

type Block =
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string; muted?: boolean }
  | { kind: "md"; text: string }
  | { kind: "stats"; items: { label: string; value: string; hint?: string; tone?: Tone }[] }
  | { kind: "bars"; title: string; items: { label: string; atual: number; ideal: number }[] }
  | { kind: "list"; title?: string; ordered?: boolean; items: { title: string; meta?: string; detail?: string; value?: string }[] }
  | { kind: "alert"; tone: Tone; text: string }
  | { kind: "pdf" }
  | { kind: "whatsapp" }
  | { kind: "profile" }
  | { kind: "confirmProfile"; to: RiskProfile; from: RiskProfile | null }
  | { kind: "actions"; items: BotAction[] }
  | { kind: "notice"; alert: BotAlert };

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "bot"; blocks: Block[]; followups?: Intent[]; ai?: string; q?: string; rated?: "up" | "down" };

const INTENTS: Partial<Record<Intent, { label: string; ask: string; icon: LucideIcon }>> = {
  avisos: { label: "Avisos", ask: "Tem algum aviso para mim?", icon: Bell },
  visao: { label: "Visão da carteira", ask: "Quero a visão completa da carteira", icon: PieChart },
  rebal: { label: "Rebalancear carteira", ask: "Como rebalancear minha carteira?", icon: Scale },
  whatsapp: { label: "Enviar no WhatsApp", ask: "Envia o relatório no meu WhatsApp", icon: MessageCircle },
  perfil: { label: "Perfil de risco", ask: "Quero ajustar meu perfil de risco", icon: SlidersHorizontal },
  fiis: { label: "Fundos imobiliários", ask: "Quais fundos imobiliários estão rendendo mais?", icon: Building2 },
  meta: { label: "Quanto falta para a meta", ask: "Quanto falta para a minha meta?", icon: Target },
  pdf: { label: "Baixar PDF", ask: "Gera o PDF do relatório", icon: FileDown },
};

const STORAGE_CHAT = "muvo_bot_chat_v3";
const STORAGE_EXPANDED = "muvo_bot_expanded";
const STORAGE_SEEN_ALERTS = "muvo_bot_alerts_seen";
const STORAGE_ALERT_CHOICES = "muvo_bot_alert_choices";
const MAX_STORED = 60;
const THINK_MS = 650;

const FII_FALLBACK = [
  { ticker: "MXRF11", tipo: "Recebíveis", dyMensalPct: 1.1, price: null as number | null, perfil: "Alto rendimento, liquidez", risco: "Médio", source: "estimado" },
  { ticker: "XPML11", tipo: "Shopping", dyMensalPct: 0.75, price: null, perfil: "Renda estável + valorização", risco: "Baixo-médio", source: "estimado" },
  { ticker: "HGLG11", tipo: "Logística", dyMensalPct: 0.7, price: null, perfil: "Qualidade de ativos", risco: "Baixo", source: "estimado" },
  { ticker: "KNCR11", tipo: "Papel (CRI)", dyMensalPct: 1.0, price: null, perfil: "Inflação + CDI", risco: "Médio", source: "estimado" },
  { ticker: "VISC11", tipo: "Shopping", dyMensalPct: 0.8, price: null, perfil: "Dividendos consistentes", risco: "Baixo-médio", source: "estimado" },
  { ticker: "BTLG11", tipo: "Logística", dyMensalPct: 0.75, price: null, perfil: "Crescimento setorial", risco: "Baixo", source: "estimado" },
  { ticker: "TRXF11", tipo: "Híbrido", dyMensalPct: 0.9, price: null, perfil: "Diversificado", risco: "Médio", source: "estimado" },
  { ticker: "IRDM11", tipo: "Papel", dyMensalPct: 1.05, price: null, perfil: "Alto DY, mais volatilidade", risco: "Médio-alto", source: "estimado" },
];

function pct(n: number, digits = 0) {
  return `${n.toFixed(digits).replace(".", ",")}%`;
}

function fmtDy(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "n/d";
  return `${pct(v, 2)} ao mês`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function welcome(): Msg {
  return {
    id: "welcome",
    role: "bot",
    blocks: [
      { kind: "heading", text: "Olá, eu sou o Muvo." },
      { kind: "text", text: "Leio a sua carteira, mostro como **rebalancear** pelo seu perfil, respondo suas dúvidas e mando o relatório no seu **WhatsApp**. Por onde começamos?" },
    ],
    followups: ["visao", "rebal", "whatsapp", "meta"],
  };
}

const APORTE_ORIGEM: Record<AnalysisPayload["aporteOrigem"], string> = {
  meta: "definido na sua meta",
  media: "sua média dos últimos 6 meses",
  padrao: "valor de referência; defina o seu em Metas",
};
const PRIORIDADE: Record<"alta" | "media" | "baixa", string> = { alta: "Prioridade alta", media: "Prioridade média", baixa: "Quando puder" };

function rebalReply(a: AnalysisPayload): Msg {
  const plan = a.plan;
  const id = uid();
  if (!plan) {
    return {
      id, role: "bot", followups: ["perfil", "visao"],
      blocks: [
        { kind: "heading", text: "Rebalanceamento" },
        { kind: "text", text: "Ainda não encontrei investimentos cadastrados. Registre suas contas e ativos no MUVO LIVE e eu monto o plano." },
      ],
    };
  }
  const perfil = RISK_PROFILES[a.profile].label;
  const reservaOk = plan.reserva.atual >= plan.reserva.alvo - 1;
  const comAlocacao = alocacaoRelevante(plan);
  const blocks: Block[] = [
    { kind: "heading", text: `Rebalanceamento · perfil ${perfil.toLowerCase()}` },
    {
      kind: "stats",
      items: [
        { label: "Patrimônio", value: formatCurrency(plan.total) },
        { label: "Rende em 12 meses", value: pct(plan.retorno12m, 2), hint: "esperado, já sem Imposto de Renda" },
        {
          label: "Reserva",
          value: formatCurrency(plan.reserva.atual),
          hint: `de ${formatCurrency(plan.reserva.alvo)}${plan.reserva.baseadaEmGastos ? ` · ${plan.reserva.meses} meses de gastos` : ""}`,
          tone: reservaOk ? "pos" : "warn",
        },
        { label: "Fora da reserva", value: formatCurrency(plan.investido), hint: comAlocacao ? `${pct(plan.desvio)} fora do alvo` : "base da alocação por perfil" },
      ],
    },
    comAlocacao
      ? { kind: "bars", title: `Fora da reserva (${formatCurrency(plan.investido)}) · atual e alvo`, items: plan.buckets.map((b) => ({ label: b.label, atual: b.pct, ideal: b.alvoPct })) }
      : { kind: "text", muted: true, text: `Com ${formatCurrency(plan.investido)} fora da reserva, ainda não faz sentido comparar percentuais com o perfil. Primeiro complete a reserva; depois os aportes seguem a alocação-alvo.` },
  ];
  if (plan.plano.length > 0) {
    blocks.push({
      kind: "list",
      title: `Onde aportar ${formatCurrency(plan.aporte)} este mês`,
      ordered: true,
      items: plan.plano.map((p) => ({ title: p.label, value: formatCurrency(p.valor) })),
    });
    blocks.push({ kind: "text", muted: true, text: `Aporte ${APORTE_ORIGEM[a.aporteOrigem]}. Sem vender nada: o dinheiro novo corrige a carteira aos poucos.` });
    blocks.push({
      kind: "actions",
      items: plan.plano.slice(0, 3).map((p): BotAction => ({ kind: "investir", section: BUCKET_SECTION[p.bucket], amount: p.valor })),
    });
  }
  blocks.push(
    plan.sugestoes.length > 0
      ? { kind: "list", title: "Sugestões", items: plan.sugestoes.slice(0, 6).map((s) => ({ title: s.titulo, meta: PRIORIDADE[s.prioridade], detail: s.detalhe })) }
      : { kind: "alert", tone: "pos", text: "Carteira alinhada ao seu perfil. Continue aportando conforme o plano." },
  );
  if (!a.profileDefinido) {
    blocks.push({ kind: "text", text: "Usei o perfil **moderado** como padrão. Escolha o seu e eu refaço o plano:" }, { kind: "profile" });
  }
  blocks.push({
    kind: "text",
    muted: true,
    text: `Selic ${pct(a.rates.selic, 2)} · CDI ${pct(a.rates.cdi, 2)}${a.rates.focusData ? ` · Focus de ${a.rates.focusData.split("-").reverse().join("/")}` : ""}. Análise educativa, não é recomendação de investimento.`,
  });
  return { id, role: "bot", blocks, followups: a.profileDefinido ? ["whatsapp", "perfil", "visao"] : ["whatsapp", "visao"] };
}

/** `hidden`: avisos adiados ou desconsiderados, fora da lista. */
function alertsReply(alerts: BotAlert[], hidden = 0): Msg {
  if (alerts.length === 0) {
    const text = hidden
      ? `Nenhum aviso novo. ${hidden === 1 ? "Um aviso está adiado ou desconsiderado" : `${hidden} avisos estão adiados ou desconsiderados`}.`
      : "Nenhum aviso agora: nada parado, nenhum vencimento próximo e vendas de ações dentro do limite de isenção.";
    return { id: uid(), role: "bot", followups: ["visao", "rebal"], blocks: [{ kind: "alert", tone: "pos", text }] };
  }
  return {
    id: uid(),
    role: "bot",
    followups: ["rebal", "visao"],
    blocks: [
      { kind: "heading", text: alerts.length === 1 ? "Tenho um aviso para você" : `Tenho ${alerts.length} avisos para você` },
      ...alerts.map((alert): Block => ({ kind: "notice", alert })),
    ],
  };
}

function replyFor(intent: Intent, ctx: BotPortfolioContext, research?: MarketResearchPayload | null): Msg {
  if (intent === "avisos") return alertsReply(ctx.alerts);
  const gap = Math.max(0, (ctx.incomeGoal || 0) - ctx.totalRendaMensal);
  const market = research?.rates
    ? `Selic ${pct(research.rates.selicAnual, 2)} · CDI ${pct(research.rates.cdiAnual, 2)} · fonte ${research.rates.source === "bcb" ? "Banco Central" : "estimada"}`
    : null;
  const bot = (blocks: (Block | null | false)[], followups: Intent[]): Msg => ({
    id: uid(),
    role: "bot",
    blocks: blocks.filter(Boolean) as Block[],
    followups,
  });

  if (intent === "visao") {
    const alerts = ctx.insights
      .filter((i) => i.level === "critical" || i.level === "warning")
      .sort((a, b) => (a.level === "critical" ? 0 : 1) - (b.level === "critical" ? 0 : 1))
      .slice(0, 3);
    return bot([
      { kind: "heading", text: "Visão da carteira" },
      {
        kind: "stats",
        items: [
          ctx.score === null
            ? { label: "Nota da carteira", value: "…", hint: "calculando" }
            : { label: "Nota da carteira", value: String(ctx.score), hint: "de 100", tone: ctx.score >= 70 ? "pos" : ctx.score >= 45 ? "warn" : "neg" },
          { label: "Patrimônio", value: formatCurrency(ctx.grandTotal) },
          { label: "Renda passiva", value: formatCurrency(ctx.totalRendaMensal), hint: "por mês" },
          ctx.incomeGoal > 0
            ? { label: "Falta para a meta", value: formatCurrency(gap), hint: `meta ${formatCurrency(ctx.incomeGoal)}`, tone: gap === 0 ? "pos" : undefined }
            : { label: "Reserva", value: ctx.emerTotal === null ? "…" : formatCurrency(ctx.emerTotal), hint: "emergência" },
        ],
      },
      market ? { kind: "text", text: market, muted: true } : null,
      ctx.sources.length > 0
        ? {
            kind: "list",
            title: "Fontes de renda",
            items: ctx.sources.map((s) => ({ title: s.nome, meta: s.tipo, value: `+${formatCurrency(s.rendaMensal)}` })),
          }
        : { kind: "text", text: "Ainda não identifiquei fontes de renda na carteira.", muted: true },
      ...(alerts.length
        ? alerts.map((a): Block => ({ kind: "alert", tone: a.level === "critical" ? "neg" : "warn", text: a.title }))
        : [{ kind: "alert", tone: "pos", text: "Nenhum alerta crítico no momento." } as Block]),
    ], ["rebal", "whatsapp", "fiis"]);
  }

  if (intent === "fiis") {
    const owned = new Set(ctx.holdings.filter((h) => h.kind === "FII").map((h) => h.ticker.toUpperCase()));
    const universe = (research?.fiis?.length ? research.fiis : FII_FALLBACK)
      .slice()
      .sort((a, b) => (b.dyMensalPct ?? 0) - (a.dyMensalPct ?? 0));
    const picks = universe.filter((f) => !owned.has(f.ticker)).slice(0, 5);
    return bot([
      { kind: "heading", text: "Fundos imobiliários por rendimento" },
      {
        kind: "text",
        muted: true,
        text: [owned.size ? `Você já tem ${[...owned].join(", ")}.` : "Você ainda não tem fundos imobiliários.", market].filter(Boolean).join(" · "),
      },
      picks.length
        ? {
            kind: "list",
            ordered: true,
            items: picks.map((f) => {
              const price = f.price != null && Number.isFinite(f.price) ? formatCurrency(f.price) : null;
              const live = "source" in f && f.source === "brapi";
              return {
                title: f.ticker,
                meta: [f.tipo, price, `risco ${f.risco.toLowerCase()}`, live ? "ao vivo" : null].filter(Boolean).join(" · "),
                detail: f.perfil,
                value: fmtDy(f.dyMensalPct),
              };
            }),
          }
        : { kind: "text", text: "Sua carteira de fundos imobiliários já cobre os principais nomes da lista." },
      gap > 0 && {
        kind: "stats",
        items: [{ label: "Capital para fechar a meta com fundos imobiliários", value: formatCurrency(gap / 0.0085), hint: `rendendo cerca de 0,85% ao mês para cobrir ${formatCurrency(gap)}` }],
      },
      { kind: "text", muted: true, text: "Ordenado por rendimento; não é recomendação de investimento. Fontes: Banco Central, Brapi e Yahoo quando disponíveis, e estimativas curadas." },
    ], ["rebal", "meta", "whatsapp"]);
  }

  if (intent === "whatsapp") {
    return bot([
      { kind: "heading", text: "Relatório no WhatsApp" },
      { kind: "whatsapp" },
    ], ["rebal", "perfil"]);
  }

  if (intent === "perfil") {
    return bot([
      { kind: "heading", text: "Perfil de risco" },
      { kind: "text", text: "O perfil define a alocação-alvo e o tamanho da reserva de emergência usados no rebalanceamento." },
      { kind: "profile" },
    ], ["rebal"]);
  }

  if (intent === "meta") {
    if (!(ctx.incomeGoal > 0)) {
      return bot([
        { kind: "heading", text: "Sua meta de renda" },
        { kind: "stats", items: [{ label: "Renda passiva hoje", value: formatCurrency(ctx.totalRendaMensal), hint: "por mês" }] },
        { kind: "text", text: "Você ainda não definiu uma meta. Use **Definir meta**, no topo desta página, e eu calculo quanto falta." },
      ], ["visao", "fiis"]);
    }
    const cdiAnual = (research?.rates?.cdiAnual ?? FALLBACK_CDI) / 100;
    const cdiMensal = Math.pow(1 + cdiAnual * 1.15, 1 / 12) - 1;
    return bot([
      { kind: "heading", text: "Sua meta de renda" },
      {
        kind: "stats",
        items: [
          { label: "Renda hoje", value: formatCurrency(ctx.totalRendaMensal), hint: "por mês" },
          { label: "Meta", value: formatCurrency(ctx.incomeGoal), hint: "por mês" },
          { label: "Falta", value: formatCurrency(gap), tone: gap === 0 ? "pos" : undefined },
        ],
      },
      ...(ctx.goal && gap > 0 ? goalBlocks(ctx.goal) : []),
      gap > 0
        ? {
            kind: "list",
            title: "Capital extra estimado para fechar",
            items: [
              { title: "Com fundos imobiliários", meta: "cerca de 0,85% ao mês", value: formatCurrency(gap / 0.0085) },
              { title: "Com a caixinha Turbo", meta: "115% do CDI", value: formatCurrency(gap / cdiMensal) },
              { title: "Com dividendos de ações", meta: "cerca de 0,4% ao mês", value: formatCurrency(gap / 0.004) },
            ],
          }
        : { kind: "alert", tone: "pos", text: "A meta já está coberta pela renda estimada." },
    ], ["rebal", "fiis"]);
  }

  if (intent === "pdf") {
    return bot([
      { kind: "heading", text: "Relatório pronto" },
      { kind: "text", text: "Score, diagnóstico, fontes de renda, alocação e próximos aportes em um só documento." },
      { kind: "pdf" },
    ], ["visao"]);
  }

  return bot([
    { kind: "text", text: "Não entendi bem. Posso ajudar com estes assuntos:" },
    {
      kind: "list",
      items: [
        { title: "Visão da carteira", detail: "Score, fontes de renda e alertas" },
        { title: "Rebalancear carteira", detail: "Alocação pelo seu perfil e onde aportar" },
        { title: "Relatório no WhatsApp", detail: "Imagem e texto com as sugestões" },
        { title: "Meta de renda", detail: "Quanto falta e como fechar" },
      ],
    },
  ], ["visao", "rebal", "whatsapp", "meta"]);
}

/** Prazo da meta no ritmo atual e aporte para chegar no ano desejado. */
function goalBlocks(g: NonNullable<BotPortfolioContext["goal"]>): Block[] {
  if (g.meses === 0) {
    return [{ kind: "alert", tone: "pos", text: `Seu patrimônio já passa dos ${formatCurrency(g.capitalNecessario)} que sustentam a meta. Falta levar o dinheiro para aplicações que paguem renda.` }];
  }
  const taxa = g.rendimentoRealAnualPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const items: Extract<Block, { kind: "stats" }>["items"] = [
    { label: "Patrimônio necessário", value: formatCurrency(g.capitalNecessario), hint: `rendendo ${taxa}% ao ano acima da inflação` },
    {
      label: "No ritmo atual",
      value: g.anoPrevisto ? String(g.anoPrevisto) : "Mais de 100 anos",
      hint: g.meses ? `em ${duration(g.meses)}` : "aumente o aporte",
      tone: g.noPrazo === null ? undefined : g.noPrazo ? "pos" : "warn",
    },
  ];
  if (g.prazoAno && g.aporteParaPrazo !== null) {
    items.push({
      label: `Para chegar em ${g.prazoAno}`,
      value: formatCurrency(g.aporteParaPrazo),
      hint: "de aporte por mês",
      tone: g.noPrazo ? "pos" : "warn",
    });
  }
  const blocks: Block[] = [
    { kind: "stats", items },
    {
      kind: "text",
      muted: true,
      text: `Com aporte de ${formatCurrency(g.aporte)} por mês (${APORTE_ORIGEM[g.aporteOrigem]}), em valores de hoje: o rendimento já desconta a inflação esperada.`,
    },
  ];
  if (!g.prazoAno) {
    blocks.push({ kind: "text", text: "Defina o **ano da meta** em Metas e eu calculo quanto aportar por mês para chegar lá." });
  } else if (g.aporteParaPrazo === null) {
    blocks.push({ kind: "alert", tone: "warn", text: `O prazo de ${g.prazoAno} já passou. Atualize o ano da meta em Metas.` });
  } else if (!g.noPrazo && g.aporteParaPrazo > g.aporte) {
    blocks.push(
      { kind: "alert", tone: "warn", text: `Para chegar em ${g.prazoAno}, aumente o aporte em **${formatCurrency(g.aporteParaPrazo - g.aporte)}** por mês ou adie o prazo.` },
      { kind: "actions", items: [{ kind: "investir", section: "hub", amount: g.aporteParaPrazo }] },
    );
  }
  return blocks;
}

const DIRECAO_TEXTO: Record<ProfileTransition["direcao"], string | null> = {
  mais_risco: "Mais ações e fundos imobiliários, menos renda fixa. A carteira oscila mais no curto prazo em troca de um retorno esperado maior no longo prazo. Faz sentido para dinheiro que você não vai precisar pelos próximos 5 anos.",
  menos_risco: "Mais renda fixa e reserva maior, menos ações. A carteira oscila menos, e o retorno esperado no longo prazo também fica menor.",
  igual: null,
};

/** Caminho da carteira atual até o perfil novo, com o passo a passo e a confirmação no fim. */
function transitionReply(t: ProfileTransition, profileSalvo: RiskProfile | null): Msg {
  const bot = (blocks: Block[], followups: Intent[]): Msg => ({ id: uid(), role: "bot", blocks, followups });
  const para = RISK_PROFILES[t.to].label;
  if (profileSalvo === t.to && (t.from === null || t.from === t.to)) {
    return bot([
      { kind: "alert", tone: "pos", text: `Seu perfil já é ${para.toLowerCase()}. O rebalanceamento e os aportes já seguem essa alocação.` },
    ], ["rebal", "perfil"]);
  }
  const de = t.from ? RISK_PROFILES[t.from].label : null;
  const blocks: Block[] = [
    { kind: "heading", text: de ? `De ${de.toLowerCase()} para ${para.toLowerCase()}` : `Caminho para o perfil ${para.toLowerCase()}` },
    { kind: "text", text: DIRECAO_TEXTO[t.direcao] ?? RISK_PROFILES[t.to].descricao },
  ];

  if (t.carteiraPequena) {
    blocks.push({ kind: "text", muted: true, text: `Com ${formatCurrency(t.investido)} fora da reserva, não há o que ajustar: a partir da confirmação, os aportes já seguem a alocação do perfil ${para.toLowerCase()}.` });
  } else {
    blocks.push({
      kind: "bars",
      title: `Sua carteira hoje e o alvo ${para.toLowerCase()}`,
      items: t.classes.map((c) => ({ label: c.label, atual: c.atualPct, ideal: c.alvoNovoPct })),
    });
    const minimo = Math.max(100, t.investido * 0.01);
    const mudancas = t.classes.filter((c) => Math.abs(c.diff) >= minimo).sort((a, b) => b.diff - a.diff);
    if (mudancas.length > 0) {
      blocks.push({
        kind: "list",
        title: "O que muda",
        items: mudancas.map((c) => ({
          title: c.label,
          meta: c.alvoAntesPct !== null ? `Alvo de ${pct(c.alvoAntesPct)} para ${pct(c.alvoNovoPct)}` : `Alvo de ${pct(c.alvoNovoPct)}`,
          value: c.diff > 0 ? `faltam ${formatCurrency(c.diff)}` : `sobram ${formatCurrency(-c.diff)}`,
        })),
      });
    }
  }

  const prazo = t.mesesSoAportes === 0
    ? { value: "Já alinhada", hint: "a carteira já está perto do alvo", tone: "pos" as Tone }
    : t.mesesSoAportes !== null
      ? { value: duration(t.mesesSoAportes), hint: `aportando ${formatCurrency(t.aporte)} por mês, sem vender nada` }
      : { value: t.aporte > 0 ? "Mais de 20 anos" : "Sem aporte", hint: t.aporte > 0 ? "considere realocar parte da carteira" : "defina um aporte mensal em Metas", tone: "warn" as Tone };
  const reservaHint = t.reserva.falta > 0
    ? `faltam ${formatCurrency(t.reserva.falta)}`
    : t.reserva.liberada > 0
      ? `${t.reserva.mesesNovo} meses de gastos · libera ${formatCurrency(t.reserva.liberada)} para investir`
      : `${t.reserva.mesesNovo} meses de gastos · completa`;
  blocks.push({
    kind: "stats",
    items: [
      { label: "Só com aportes", ...prazo },
      { label: "Reserva de emergência", value: formatCurrency(t.reserva.alvoNovo), hint: reservaHint, tone: t.reserva.falta > 0 ? "warn" : "pos" },
    ],
  });

  const passos: Extract<Block, { kind: "list" }>["items"] = [];
  if (t.reserva.falta > 0) {
    passos.push({ title: "Complete a reserva de emergência", value: formatCurrency(t.reserva.falta), detail: `O perfil ${para.toLowerCase()} pede ${t.reserva.mesesNovo} meses de gastos em aplicação com liquidez diária. Os primeiros aportes vão para ela.` });
  }
  if (t.aporteDoMes.length > 0) {
    passos.push({ title: `Aporte ${formatCurrency(t.aporte)} deste mês`, detail: t.aporteDoMes.map((a) => `${a.label}: ${formatCurrency(a.valor)}`).join(" · ") });
  }
  const acima = t.vendas.map((v) => v.label.toLowerCase());
  if (acima.length > 0) {
    passos.push({ title: `Pare de aportar em ${acima.join(" e ")}`, detail: "Deixe os novos aportes equilibrarem a carteira, sem vender e sem pagar Imposto de Renda." });
  }
  passos.push({ title: `Confirme o perfil ${para.toLowerCase()}`, detail: "O rebalanceamento, os avisos e o relatório passam a seguir a nova alocação." });
  blocks.push({ kind: "list", title: "Passo a passo", ordered: true, items: passos });

  if (t.aporteDoMes.length > 0) {
    blocks.push({ kind: "actions", items: t.aporteDoMes.slice(0, 3).map((p): BotAction => ({ kind: "investir", section: BUCKET_SECTION[p.bucket], amount: p.valor })) });
  }
  if (t.vendas.length > 0 && !t.carteiraPequena) {
    blocks.push({
      kind: "list",
      title: "Para chegar mais rápido (opcional)",
      items: t.vendas.map((v) => ({ title: `Realocar de ${v.label.toLowerCase()}`, value: `até ${formatCurrency(v.valor)}`, detail: v.nota })),
    });
  }
  blocks.push(
    { kind: "confirmProfile", to: t.to, from: profileSalvo },
    { kind: "text", muted: true, text: "Valores de hoje, sem contar rendimentos. Análise educativa, não é recomendação de investimento." },
  );
  return bot(blocks, ["rebal", "perfil"]);
}

/** Resumo em texto de uma resposta pronta, para a IA saber o que já foi mostrado na conversa. */
function blocksSummary(blocks: Block[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.kind === "heading" || b.kind === "text" || b.kind === "md" || b.kind === "alert") lines.push(b.text.replace(/\*\*/g, ""));
    else if (b.kind === "stats") lines.push(b.items.map((s) => `${s.label}: ${s.value}`).join("; "));
    else if (b.kind === "bars") lines.push(`${b.title}: ${b.items.map((x) => `${x.label} ${x.atual}% (alvo ${x.ideal}%)`).join("; ")}`);
    else if (b.kind === "list") lines.push(`${b.title ? `${b.title}: ` : ""}${b.items.map((x) => [x.title, x.value, x.detail].filter(Boolean).join(" ")).join("; ")}`);
    else if (b.kind === "actions") lines.push(`Botões oferecidos: ${b.items.map(actionLabel).join("; ")}`);
    else if (b.kind === "notice") lines.push(`Aviso: ${b.alert.titulo}. ${b.alert.detalhe}`);
    else if (b.kind === "confirmProfile") lines.push(`Botão oferecido: mudar para o perfil ${RISK_PROFILES[b.to].label.toLowerCase()}`);
  }
  return lines.join("\n").slice(0, 800);
}

/* ── Renderização ───────────────────────────────────────────────── */

const LABEL = "text-[10px] font-black uppercase tracking-[0.18em] text-white/45";
const TONE_TEXT: Record<Tone, string> = { pos: "text-emerald-400", warn: "text-amber-400", neg: "text-red-400" };
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05050A]";

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>
          : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

/** Texto da IA: parágrafos, listas com "- " ou "1. " e **negrito**. */
function Markdown({ text }: { text: string }) {
  const groups: { type: "p" | "ul" | "ol"; lines: string[] }[] = [];
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line) {
      groups.push({ type: "p", lines: [] });
      continue;
    }
    const ul = /^[-•*]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    const type = ul ? "ul" : ol ? "ol" : "p";
    const content = ul?.[1] ?? ol?.[1] ?? line.replace(/^#+\s*/, "");
    const last = groups[groups.length - 1];
    if (last && last.type === type && (type !== "p" || last.lines.length > 0)) last.lines.push(content);
    else groups.push({ type, lines: [content] });
  }
  return (
    <div className="space-y-2 text-sm leading-relaxed text-white/80">
      {groups.filter((g) => g.lines.length > 0).map((g, i) => {
        if (g.type === "p") return <p key={i}><Inline text={g.lines.join(" ")} /></p>;
        const Tag = g.type;
        return (
          <Tag key={i} className={cn("space-y-1 pl-5", g.type === "ul" ? "list-disc" : "list-decimal", "marker:text-white/35")}>
            {g.lines.map((l, j) => <li key={j}><Inline text={l} /></li>)}
          </Tag>
        );
      })}
    </div>
  );
}

type NoticeHandlers = {
  status: (id: string) => "snoozed" | "dismissed" | null;
  choose: (id: string, choice: "snooze" | "dismiss" | "undo") => void;
};

function NoticeCard({ alert, onAction, notice }: { alert: BotAlert; onAction: (a: BotAction) => void; notice: NoticeHandlers }) {
  const status = notice.status(alert.id);
  const secondary = cn("inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-medium text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white", FOCUS);
  return (
    <section className={cn("rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 transition-opacity", status && "opacity-60")}>
      <p className="text-sm font-semibold text-white">{alert.titulo}</p>
      <p className={cn("mt-0.5 text-[11px]", alert.nivel === "alta" ? "text-amber-400" : "text-white/45")}>
        {alert.nivel === "alta" ? "Importante" : "Atenção"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-white/60">{alert.detalhe}</p>
      {status ? (
        <div className="mt-2.5 flex items-center justify-between gap-2" role="status">
          <span className="text-xs text-white/55">
            {status === "snoozed" ? `Vou te lembrar em ${SNOOZE_DAYS} dias.` : "Aviso desconsiderado. Ele não volta a aparecer."}
          </span>
          <button type="button" className={secondary} onClick={() => notice.choose(alert.id, "undo")}>Desfazer</button>
        </div>
      ) : (
        <div className="mt-2.5 space-y-1.5">
          {alert.acao && <BlockView block={{ kind: "actions", items: [alert.acao] }} onPdf={() => {}} onProfile={() => {}} onAction={onAction} />}
          <div className="flex flex-wrap gap-1">
            <button type="button" className={secondary} onClick={() => notice.choose(alert.id, "snooze")}>
              <Clock className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Lembrar em {SNOOZE_DAYS} dias
            </button>
            <button type="button" className={secondary} onClick={() => notice.choose(alert.id, "dismiss")}>
              <EyeOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Desconsiderar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ConfirmProfile({ to, from }: { to: RiskProfile; from: RiskProfile | null }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "kept" | "error">("idle");
  const para = RISK_PROFILES[to].label.toLowerCase();

  async function confirm() {
    setState("saving");
    try {
      await saveRiskProfile(to);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done" || state === "kept") {
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-white/80">
        <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
        <span>
          {state === "done"
            ? `Pronto, seu perfil agora é ${para}. O rebalanceamento e os próximos aportes já seguem a nova alocação.`
            : `Perfil ${from ? RISK_PROFILES[from].label.toLowerCase() : "atual"} mantido. Nada foi alterado.`}
        </span>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={state === "saving"}
        onClick={() => void confirm()}
        className={cn("inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-[#0D0D0D] transition-colors hover:bg-white/90 disabled:opacity-60", FOCUS)}
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        {state === "saving" ? "Salvando…" : `Mudar para o perfil ${para}`}
      </button>
      {from && from !== to && (
        <button
          type="button"
          disabled={state === "saving"}
          onClick={() => setState("kept")}
          className={cn("inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-medium text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white", FOCUS)}
        >
          Manter o perfil {RISK_PROFILES[from].label.toLowerCase()}
        </button>
      )}
      {state === "error" && <p role="alert" className="text-xs text-red-400">Não consegui salvar o perfil. Tente de novo.</p>}
    </div>
  );
}

function BlockView({ block, onPdf, onProfile, onAction, notice }: {
  block: Block;
  onPdf: () => void;
  onProfile: (p: RiskProfile, prev: RiskProfile | null) => void;
  onAction: (a: BotAction) => void;
  notice?: NoticeHandlers;
}) {
  switch (block.kind) {
    case "confirmProfile":
      return <ConfirmProfile to={block.to} from={block.from} />;
    case "notice":
      return notice ? <NoticeCard alert={block.alert} onAction={onAction} notice={notice} /> : null;
    case "actions":
      if (block.items.length === 0) return null;
      return (
        <div className="flex flex-col gap-1.5">
          {block.items.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onAction(a)}
              className={cn(
                "inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3.5 text-left text-sm font-semibold transition-colors",
                i === 0 ? "bg-white text-[#0D0D0D] hover:bg-white/90" : "border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12]",
                FOCUS,
              )}
            >
              <span className="truncate">{actionLabel(a)}</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      );
    case "md":
      return <Markdown text={block.text} />;
    case "whatsapp":
      return <WhatsappPanel variant="bot" />;
    case "profile":
      return <RiskProfilePicker variant="bot" preview onChange={onProfile} />;
    case "heading":
      return <h3 className="font-display text-[17px] font-semibold leading-tight tracking-tight text-white">{block.text}</h3>;
    case "text":
      return (
        <p className={cn(block.muted ? "text-xs leading-relaxed text-white/45" : "text-sm leading-relaxed text-white/80")}>
          <Inline text={block.text} />
        </p>
      );
    case "stats": {
      const odd = block.items.length % 2 === 1;
      return (
        <dl className={cn("grid gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08]", block.items.length > 1 && "grid-cols-2")}>
          {block.items.map((s, i) => (
            <div key={s.label} className={cn("bg-[#05050A] px-3 py-2.5", odd && i === block.items.length - 1 && block.items.length > 1 && "col-span-2")}>
              <dt className={LABEL}>{s.label}</dt>
              <dd className={cn("mt-1 font-display text-lg font-black leading-none tabular-nums tracking-tight", s.tone ? TONE_TEXT[s.tone] : "text-white")}>
                {s.value}
              </dd>
              {s.hint && <dd className="mt-1 text-[11px] text-white/40">{s.hint}</dd>}
            </div>
          ))}
        </dl>
      );
    }
    case "bars":
      return (
        <section>
          <h4 className={LABEL}>{block.title}</h4>
          <ul className="mt-2.5 space-y-2.5">
            {block.items.map((b) => {
              const off = Math.abs(b.atual - b.ideal) > 10;
              return (
                <li key={b.label}>
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="truncate text-white/75">{b.label}</span>
                    <span className="shrink-0 tabular-nums text-white/45">
                      <span className={cn("font-semibold", off ? "text-amber-400" : "text-white")}>{pct(b.atual)}</span>
                      {" "}· ideal {pct(b.ideal)}
                    </span>
                  </div>
                  <div className="relative mt-1.5 h-1.5 rounded-full bg-white/[0.08]" aria-hidden="true">
                    <div className="h-full rounded-full bg-white/85" style={{ width: `${Math.min(100, Math.max(0, b.atual))}%` }} />
                    <div className="absolute -top-[3px] h-3 w-px bg-white/60" style={{ left: `${Math.min(100, Math.max(0, b.ideal))}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <section>
          {block.title && <h4 className={cn(LABEL, "mb-1")}>{block.title}</h4>}
          <Tag className="divide-y divide-white/[0.06]">
            {block.items.map((it, i) => (
              <li key={`${it.title}-${i}`} className="flex gap-3 py-2">
                {block.ordered && (
                  <span className="w-4 shrink-0 pt-px font-display text-sm font-black tabular-nums text-white/30">{i + 1}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-white">{it.title}</p>
                    {it.value && <p className="shrink-0 font-display text-sm font-bold tabular-nums text-white">{it.value}</p>}
                  </div>
                  {it.meta && <p className="mt-0.5 text-[11px] text-white/45">{it.meta}</p>}
                  {it.detail && <p className="mt-0.5 text-xs leading-relaxed text-white/60">{it.detail}</p>}
                </div>
              </li>
            ))}
          </Tag>
        </section>
      );
    }
    case "alert": {
      const Icon = block.tone === "neg" ? AlertOctagon : block.tone === "warn" ? AlertTriangle : CheckCircle2;
      return (
        <p className="flex items-start gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs leading-relaxed text-white/80">
          <Icon className={cn("mt-px h-3.5 w-3.5 shrink-0", TONE_TEXT[block.tone])} aria-hidden="true" />
          <span>{block.text}</span>
        </p>
      );
    }
    case "pdf":
      return (
        <button
          type="button"
          onClick={onPdf}
          className={cn("inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-[#0D0D0D] transition-colors hover:bg-white/90", FOCUS)}
        >
          <FileDown className="h-4 w-4" aria-hidden="true" />
          Baixar PDF do relatório
        </button>
      );
  }
}

function IconButton({ label, onClick, children, className }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("flex h-10 w-10 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white md:h-9 md:w-9", FOCUS, className)}
    >
      {children}
    </button>
  );
}

function FeedbackRow({ rated, onRate }: { rated?: "up" | "down"; onRate: (r: "up" | "down") => void }) {
  if (rated) {
    return (
      <p className="text-[11px] text-white/45" role="status">
        {rated === "up" ? "Obrigado! Vou manter respostas assim." : "Obrigado. Vou usar isso para responder melhor da próxima vez."}
      </p>
    );
  }
  const btn = cn("flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white", FOCUS);
  return (
    <div className="flex items-center gap-0.5">
      <span className="mr-1 text-[11px] text-white/35">Essa resposta ajudou?</span>
      <button type="button" className={btn} onClick={() => onRate("up")} aria-label="Resposta útil" title="Resposta útil">
        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button type="button" className={btn} onClick={() => onRate("down")} aria-label="Resposta não ajudou" title="Resposta não ajudou">
        <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ── Componente ─────────────────────────────────────────────────── */

export function InvestorBot({
  context,
  onGeneratePdf,
  overlay = false,
  dataVersion,
}: {
  context: BotPortfolioContext;
  onGeneratePdf: () => void;
  /** Acima de telas cheias (MUVO LIVE no celular, z-200) e abaixo das folhas de diálogo (z-300). */
  overlay?: boolean;
  /** Muda quando a carteira muda; a próxima pergunta à IA pede dados novos ao servidor. */
  dataVersion?: string;
}) {
  const askedVersion = useRef<string | null>(null);
  /** Último termo do glossário explicado, para "dá um exemplo". */
  const lastTermRef = useRef<Term | null>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => [welcome()]);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [seenAlerts, setSeenAlerts] = useState<Set<string>>(() => new Set());
  const [alertChoices, setAlertChoices] = useState<AlertChoices>({});
  const visibleAlerts = context.alerts.filter((a) => !alertStatus(alertChoices[a.id]));
  const hiddenAlertIds = context.alerts.filter((a) => alertStatus(alertChoices[a.id])).map((a) => a.id);
  const unseenAlerts = hydrated ? visibleAlerts.filter((a) => !seenAlerts.has(a.id)) : [];
  const botContext = { ...context, alerts: visibleAlerts };

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const researchCache = useRef<MarketResearchPayload | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CHAT);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        const valid = Array.isArray(parsed)
          ? (parsed as Msg[]).filter((m) =>
              m && typeof m.id === "string" &&
              ((m.role === "user" && typeof m.text === "string") || (m.role === "bot" && Array.isArray(m.blocks))))
          : [];
        if (valid.length) setMessages(valid);
      }
      setExpanded(localStorage.getItem(STORAGE_EXPANDED) === "1");
      const seen: unknown = JSON.parse(localStorage.getItem(STORAGE_SEEN_ALERTS) ?? "[]");
      if (Array.isArray(seen)) setSeenAlerts(new Set(seen.filter((s): s is string => typeof s === "string")));
      setAlertChoices(parseAlertChoices(JSON.parse(localStorage.getItem(STORAGE_ALERT_CHOICES) ?? "{}")));
    } catch { /* conversa nova */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_CHAT, JSON.stringify(messages.slice(-MAX_STORED))); } catch { /* cheio */ }
  }, [messages, hydrated]);

  useEffect(() => {
    if (!open) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [messages, busy, open, expanded]);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => fabRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    if (window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function loadResearch(): Promise<MarketResearchPayload | null> {
    if (researchCache.current) return researchCache.current;
    try {
      const res = await fetch("/api/market-research");
      if (!res.ok) return null;
      const data = (await res.json()) as MarketResearchPayload;
      if (data?.fiis || data?.rates) {
        researchCache.current = data;
        return data;
      }
    } catch { /* segue com estimativas */ }
    return null;
  }

  function errorReply(text: string, followups: Intent[] = ["visao", "rebal", "whatsapp"]): Msg {
    return { id: uid(), role: "bot", blocks: [{ kind: "alert", tone: "warn", text }], followups };
  }

  /** Glossário ou conta pronta: a mesma resposta do Gênio, sem chamar a inteligência artificial. */
  function localReply(question: string): Msg | null {
    const prev = lastTermRef.current;
    lastTermRef.current = null;
    if (prev && asksExample(question)) {
      const example = termExample(prev);
      const text = example ? `**${prev.name.replace(/\s*\(.*\)$/, "")} na prática**\n\n${example}` : termMarkdown(prev);
      lastTermRef.current = prev;
      return { id: uid(), role: "bot", blocks: [{ kind: "md", text }], ai: text, q: question, followups: ["visao", "rebal"] };
    }
    const terms = findTerms(question);
    if (terms.length) {
      lastTermRef.current = terms[terms.length - 1];
      return glossaryReply(question, terms);
    }
    const calc = financeReply(question, FALLBACK_CDI);
    if (!calc) return null;
    const text = answerMarkdown(calc);
    return { id: uid(), role: "bot", blocks: [{ kind: "md", text }], ai: text, q: question, followups: ["visao", "rebal"] };
  }

  /** Pergunta geral que o Muvo já aprendeu numa pesquisa anterior do Gênio; perguntas sobre a carteira ficam com a inteligência artificial. */
  async function learnedReply(question: string): Promise<Msg | null> {
    if (!looksLikeWebQuestion(question) || /\b(?:minha|meu|meus|minhas|tenho|carteira|aportei|investi)\b/i.test(question)) return null;
    const res = await fetch("/api/genie/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: question, memoryOnly: true }),
    }).catch(() => null);
    const data = res?.ok ? ((await res.json().catch(() => null)) as { answer?: string } | null) : null;
    if (!data?.answer) return null;
    const text = `${data.answer}\n\nResposta que o Muvo aprendeu numa pesquisa anterior na web: pode conter erros.`;
    return { id: uid(), role: "bot", blocks: [{ kind: "md", text }], ai: text, q: question, followups: ["visao", "rebal"] };
  }

  /** Definição pronta do glossário, ligada ao que a pessoa já tem na carteira. */
  function glossaryReply(question: string, terms: Term[]): Msg {
    const text = terms.map((t) => {
      const own = holdingsFor(t, context.sources, context.holdings);
      const name = t.name.replace(/\s*\(.*\)$/, "");
      return own
        ? `${termMarkdown(t)}\n\n**Na sua carteira:** ${formatCurrency(own.total)} em ${name} (${own.count} ${own.count === 1 ? "aplicação" : "aplicações"}).`
        : termMarkdown(t);
    }).join("\n\n");
    const related = [...new Set(terms.flatMap((t) => t.related ?? []))]
      .filter((id) => !terms.some((t) => t.id === id))
      .map(termById)
      .filter((x): x is Term => !!x)
      .slice(0, 3);
    const blocks: Block[] = [{ kind: "md", text }];
    if (related.length) blocks.push({ kind: "text", muted: true, text: `Pergunte também: ${related.map(askAbout).join(" · ")}` });
    return { id: uid(), role: "bot", blocks, ai: text, q: question, followups: ["visao", "rebal"] };
  }

  async function rebalance(): Promise<Msg> {
    const res = await fetch("/api/bot/analysis", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) return errorReply(data?.error ?? "Não consegui analisar a carteira agora. Tente de novo em instantes.");
    return rebalReply(data as AnalysisPayload);
  }

  async function transition(to: RiskProfile, from?: RiskProfile | null): Promise<Msg> {
    const q = new URLSearchParams({ to });
    if (from) q.set("from", from);
    const res = await fetch(`/api/risk-profile/transition?${q}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.transition) return errorReply(data?.error ?? "Não consegui calcular o caminho agora. Tente de novo em instantes.", ["perfil", "rebal"]);
    return transitionReply(data.transition as ProfileTransition, data.profileSalvo ?? null);
  }

  /** Pergunta aberta: IA com os dados da carteira; sem IA configurada, cai no menu de ajuda. */
  async function askAi(history: Msg[], userText: string): Promise<Msg> {
    const turns: { role: "user" | "assistant"; content: string }[] = [];
    for (let i = 0; i < history.length - 1; i++) {
      const u = history[i];
      const b = history[i + 1];
      if (u.role !== "user" || b.role !== "bot") continue;
      const content = b.ai ?? blocksSummary(b.blocks);
      if (content) turns.push({ role: "user", content: u.text }, { role: "assistant", content });
    }
    turns.push({ role: "user", content: userText });
    const version = dataVersion ?? "";
    const fresh = askedVersion.current !== version;
    const res = await fetch("/api/bot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: turns.slice(-12), fresh, page: readBotPageContext(), hiddenAlerts: hiddenAlertIds }),
    });
    if (res.ok) askedVersion.current = version;
    const data = await res.json().catch(() => null);
    if (res.status === 503 && data?.code === "no_llm") {
      const kw = keywordIntent(userText);
      if (kw === "rebal") return rebalance();
      const alvo = profileTarget(userText);
      if (kw === "transicao" && alvo) return transition(alvo);
      if (kw === "avisos") return alertsReply(visibleAlerts, hiddenAlertIds.length);
      if (kw) return replyFor(kw, botContext, await loadResearch());
      sendFeedback("sem_resposta", userText, "");
      return replyFor("help", botContext, researchCache.current);
    }
    if (!res.ok) return errorReply(data?.error ?? "Não consegui responder agora. Tente de novo em instantes.");
    const reply = String(data?.reply ?? "");
    const actions: BotAction[] = Array.isArray(data?.actions) ? data.actions : [];
    const blocks: Block[] = [{ kind: "md", text: reply }];
    if (actions.length) blocks.push({ kind: "actions", items: actions });
    return { id: uid(), role: "bot", blocks, ai: reply, q: userText, followups: ["rebal", "whatsapp"] };
  }

  function sendFeedback(kind: "up" | "down" | "sem_resposta", question: string, answer: string) {
    void fetch("/api/bot/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, question, answer }),
    }).catch(() => {});
  }

  function rate(id: string, rated: "up" | "down") {
    const m = messages.find((x) => x.id === id);
    if (!m || m.role !== "bot" || !m.q || m.rated) return;
    setMessages((prev) => prev.map((x) => (x.id === id && x.role === "bot" ? { ...x, rated } : x)));
    sendFeedback(rated, m.q, m.ai ?? "");
  }

  async function ask(userText: string, intent: Intent, change?: { to: RiskProfile; from: RiskProfile | null }) {
    if (busy) return;
    const history = messages;
    setMessages((prev) => [...prev, { id: uid(), role: "user", text: userText }]);
    setBusy(true);
    try {
      let reply: Msg;
      const alvo = change?.to ?? (intent === "transicao" ? profileTarget(userText) : null);
      if (alvo) {
        reply = await transition(alvo, change?.from);
      } else if (intent === "rebal") {
        reply = await rebalance();
      } else if (intent === "help") {
        const local = localReply(userText);
        if (local) await new Promise((r) => setTimeout(r, THINK_MS));
        reply = local ?? (await learnedReply(userText)) ?? (await askAi(history, userText));
      } else {
        const needsMarket = intent === "fiis" || intent === "visao" || intent === "meta";
        const [research] = await Promise.all([
          needsMarket ? loadResearch() : Promise.resolve(researchCache.current),
          new Promise((r) => setTimeout(r, THINK_MS)),
        ]);
        reply = intent === "avisos" ? alertsReply(visibleAlerts, hiddenAlertIds.length) : replyFor(intent, botContext, research);
      }
      setRevealId(reply.id);
      setMessages((prev) => [...prev, reply]);
    } catch {
      const reply = errorReply("Sem conexão com o servidor. Verifique a internet e tente de novo.");
      setRevealId(reply.id);
      setMessages((prev) => [...prev, reply]);
    } finally {
      setBusy(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void ask(text, detectIntent(text));
  }

  function resetChat() {
    setMessages([welcome()]);
    setRevealId(null);
    setInput("");
    inputRef.current?.focus();
  }

  /** Ao abrir com avisos novos, o bot já começa por eles. */
  function openPanel() {
    setOpen(true);
    if (unseenAlerts.length === 0) return;
    const reply = alertsReply(unseenAlerts);
    setRevealId(reply.id);
    setMessages((prev) => [...prev, reply]);
    const next = new Set([...seenAlerts, ...unseenAlerts.map((a) => a.id)]);
    setSeenAlerts(next);
    try { localStorage.setItem(STORAGE_SEEN_ALERTS, JSON.stringify([...next].slice(-100))); } catch { /* cheio */ }
  }

  /** Adiar tira o aviso de "visto" para ele voltar com selo quando o prazo acabar. */
  function chooseAlert(id: string, choice: "snooze" | "dismiss" | "undo") {
    const nextChoices = { ...alertChoices };
    const nextSeen = new Set(seenAlerts);
    if (choice === "undo") {
      delete nextChoices[id];
      nextSeen.add(id);
    } else {
      nextChoices[id] = choice === "snooze" ? snoozeChoice() : { kind: "dismiss" };
      if (choice === "snooze") nextSeen.delete(id);
    }
    const trimmed = trimAlertChoices(nextChoices);
    setAlertChoices(trimmed);
    setSeenAlerts(nextSeen);
    try {
      localStorage.setItem(STORAGE_ALERT_CHOICES, JSON.stringify(trimmed));
      localStorage.setItem(STORAGE_SEEN_ALERTS, JSON.stringify([...nextSeen].slice(-100)));
    } catch { /* cheio */ }
  }

  const noticeHandlers: NoticeHandlers = { status: (id) => alertStatus(alertChoices[id]), choose: chooseAlert };

  /** Fecha o painel para a folha de investir/vender ficar livre na tela. */
  function runAction(a: BotAction) {
    if (a.kind === "perfil") {
      void ask(`Quero ver o caminho para o perfil ${RISK_PROFILES[a.to].label.toLowerCase()}`, "transicao", { to: a.to, from: null });
      return;
    }
    setOpen(false);
    router.push(actionHref(a), { scroll: false });
  }

  function toggleExpanded() {
    setExpanded((v) => {
      try { localStorage.setItem(STORAGE_EXPANDED, v ? "0" : "1"); } catch { /* ignore */ }
      return !v;
    });
  }

  const lastBot = [...messages].reverse().find((m) => m.role === "bot");

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => (open ? close() : openPanel())}
        className={cn(
          "fixed flex h-14 w-14 items-center justify-center rounded-full border border-border shadow-2xl transition-[transform,background-color] duration-150 ease-out touch-manipulation",
          overlay ? "z-[210]" : "z-[120]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "right-[max(1.25rem,var(--safe-right))]",
          "bottom-[calc(var(--bottom-nav-offset)+0.75rem)] md:bottom-5",
          open
            ? "bg-muted text-foreground hover:bg-muted/70"
            : "bg-background hover:scale-105 active:scale-95 motion-reduce:hover:scale-100",
          open && expanded && "md:hidden",
        )}
        aria-label={open
          ? "Fechar assistente Muvo"
          : unseenAlerts.length
            ? `Abrir assistente Muvo, ${unseenAlerts.length} ${unseenAlerts.length === 1 ? "aviso novo" : "avisos novos"}`
            : "Abrir assistente Muvo"}
        aria-expanded={open}
        aria-controls="muvo-bot-panel"
      >
        {open ? <X className="h-6 w-6" /> : <BotAvatar className="h-full w-full" />}
        {!open && unseenAlerts.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1 text-[11px] font-bold tabular-nums text-[#05050A] ring-2 ring-background"
          >
            {unseenAlerts.length}
          </span>
        )}
      </button>

      {open && (
        <section
          id="muvo-bot-panel"
          aria-label="Assistente Muvo"
          className={cn(
            overlay ? "z-[210]" : "z-[120]",
            "muvo-panel fixed flex flex-col overflow-hidden border border-white/[0.08] bg-[#05050A] text-white shadow-2xl selection:bg-white selection:text-[#0D0D0D]",
            "w-[min(100vw-1.5rem,400px)] rounded-2xl",
            "h-[min(70dvh,560px)] max-h-[calc(100dvh_-_var(--bottom-nav-offset)_-_7rem)]",
            "left-1/2 -translate-x-1/2 bottom-[calc(var(--bottom-nav-offset)+5rem)]",
            "md:left-auto md:translate-x-0 md:right-[max(1.25rem,var(--safe-right))] md:bottom-[5.5rem]",
            expanded && "md:inset-y-0 md:right-0 md:bottom-0 md:h-[100dvh] md:max-h-none md:w-[440px] md:rounded-none md:border-y-0 md:border-r-0 lg:w-[480px]",
          )}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] py-2.5 pl-4 pr-2">
            <BotAvatar className="h-9 w-9 ring-1 ring-white/15" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-medium leading-none tracking-tight">Muvo</h2>
              <p className="mt-1 truncate text-[11px] text-white/45" aria-live="polite">
                {busy ? "Analisando sua carteira…" : "Carteira · rebalanceamento · WhatsApp"}
              </p>
            </div>
            <IconButton label="Nova conversa" onClick={resetChat}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </IconButton>
            <IconButton label={expanded ? "Recolher painel" : "Expandir painel"} onClick={toggleExpanded} className="hidden md:flex">
              {expanded ? <Minimize2 className="h-4 w-4" aria-hidden="true" /> : <Maximize2 className="h-4 w-4" aria-hidden="true" />}
            </IconButton>
            <IconButton label="Fechar" onClick={close}>
              <X className="h-4 w-4" aria-hidden="true" />
            </IconButton>
          </header>

          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin-dark px-4 py-4" role="log" aria-live="polite" aria-relevant="additions">
            <div className={cn("space-y-5", expanded && "md:mx-auto md:max-w-[26rem]")}>
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-white px-3.5 py-2 text-sm font-medium text-[#0D0D0D]">{m.text}</p>
                  </div>
                ) : (
                  <article key={m.id} className="flex gap-2.5">
                    <BotAvatar className="mt-0.5 h-6 w-6" />
                    <div className="min-w-0 flex-1 space-y-3">
                      {m.blocks.map((b, i) => (
                        <div
                          key={i}
                          className={cn(m.id === revealId && "muvo-reveal")}
                          style={m.id === revealId ? { animationDelay: `${i * 90}ms` } : undefined}
                        >
                          <BlockView
                            block={b}
                            onPdf={onGeneratePdf}
                            onProfile={(p, prev) => void ask(`Quero mudar para o perfil ${RISK_PROFILES[p].label.toLowerCase()}`, "transicao", { to: p, from: prev })}
                            onAction={runAction}
                            notice={noticeHandlers}
                          />
                        </div>
                      ))}
                      {m.ai && m.q && <FeedbackRow rated={m.rated} onRate={(r) => rate(m.id, r)} />}
                      {m === lastBot && !busy && m.followups && m.followups.length > 0 && (
                        <div
                          className={cn("flex flex-wrap gap-1.5 pt-1", m.id === revealId && "muvo-reveal")}
                          style={m.id === revealId ? { animationDelay: `${m.blocks.length * 90}ms` } : undefined}
                        >
                          {m.followups.map((f) => {
                            if (f === "help") return null;
                            const it = INTENTS[f];
                            if (!it) return null;
                            const Icon = it.icon;
                            return (
                              <button
                                key={f}
                                type="button"
                                onClick={() => void ask(it.ask, f)}
                                className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white", FOCUS)}
                              >
                                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                {it.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </article>
                ),
              )}

              {busy && (
                <div className="flex items-center gap-2.5 muvo-reveal">
                  <BotAvatar className="h-6 w-6" />
                  <span className="flex items-center gap-1" aria-hidden="true">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="muvo-dot h-1.5 w-1.5 rounded-full bg-white" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                  <span className="sr-only">Muvo está analisando</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <form
            className="shrink-0 border-t border-white/[0.08] p-3"
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          >
            <div className={cn("flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-1 pl-3.5 pr-1 transition-colors focus-within:border-white/30", expanded && "md:mx-auto md:max-w-[26rem]")}>
              <label htmlFor="muvo-bot-input" className="sr-only">Mensagem para o Muvo</label>
              <input
                id="muvo-bot-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte qualquer coisa sobre sua carteira"
                autoComplete="off"
                enterKeyHint="send"
                className="min-h-10 flex-1 bg-transparent text-sm text-white caret-white placeholder:text-white/35 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Enviar"
                className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#0D0D0D] transition-colors hover:bg-white/90 disabled:bg-white/[0.08] disabled:text-white/35 touch-manipulation md:h-9 md:w-9", FOCUS)}
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
