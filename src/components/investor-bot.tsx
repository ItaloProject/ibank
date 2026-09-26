"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  X, ArrowUp, PieChart, Building2, Scale, FileDown, Target, RotateCcw,
  Maximize2, Minimize2, AlertTriangle, AlertOctagon, CheckCircle2, MessageCircle, SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { MarketResearchPayload } from "@/lib/market-research";
import { RISK_PROFILES, type RebalancePlan, type RiskProfile } from "@/lib/rebalance";
import { WhatsappPanel } from "@/components/bot/whatsapp-panel";
import { RiskProfilePicker } from "@/components/bot/risk-profile-picker";

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
  score: number;
  totalRendaMensal: number;
  incomeGoal: number;
  grandTotal: number;
  emerTotal: number;
  fiiPctVariavel: number;
  commodityPct: number;
  totalStockValue: number;
  insights: { level: string; title: string; detail: string; action?: string }[];
  nextMoves: { prioridade: number; label: string; valor: string; razao: string }[];
  recommendations: { label: string; atual: number; ideal: number; desc: string }[];
  sources: { nome: string; tipo: string; capital: number; rendaMensal: number }[];
  holdings: { ticker: string; kind: string; value: number }[];
};

/* ── Modelo da conversa ─────────────────────────────────────────── */

type Intent = "visao" | "rebal" | "fiis" | "meta" | "whatsapp" | "perfil" | "pdf" | "help";
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
  | { kind: "profile" };

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "bot"; blocks: Block[]; followups?: Intent[]; ai?: string };

const INTENTS: Record<Exclude<Intent, "help">, { label: string; ask: string; icon: LucideIcon }> = {
  visao: { label: "Visão da carteira", ask: "Quero a visão completa da carteira", icon: PieChart },
  rebal: { label: "Rebalancear carteira", ask: "Como rebalancear minha carteira?", icon: Scale },
  whatsapp: { label: "Enviar no WhatsApp", ask: "Envia o relatório no meu WhatsApp", icon: MessageCircle },
  perfil: { label: "Perfil de risco", ask: "Quero ajustar meu perfil de risco", icon: SlidersHorizontal },
  fiis: { label: "FIIs rentáveis", ask: "Quais FIIs estão mais rentáveis?", icon: Building2 },
  meta: { label: "Quanto falta para a meta", ask: "Quanto falta para a minha meta?", icon: Target },
  pdf: { label: "Baixar PDF", ask: "Gera o PDF do relatório", icon: FileDown },
};

type AnalysisPayload = {
  nome: string;
  profile: RiskProfile;
  profileDefinido: boolean;
  aporte: number;
  aporteOrigem: "meta" | "media" | "padrao";
  gastoMensal: number | null;
  plan: RebalancePlan | null;
  rates: { selic: number; cdi: number; ipca12m: number | null; source: string; focusData: string | null };
};

const STORAGE_CHAT = "muvo_bot_chat_v3";
const STORAGE_EXPANDED = "muvo_bot_expanded";
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
  return `${pct(v, 2)}/mês`;
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
  const blocks: Block[] = [
    { kind: "heading", text: `Rebalanceamento · perfil ${perfil.toLowerCase()}` },
    {
      kind: "stats",
      items: [
        { label: "Patrimônio", value: formatCurrency(plan.total) },
        { label: "Rende em 12 meses", value: pct(plan.retorno12m, 2), hint: "esperado, já sem IR" },
        { label: "Fora do alvo", value: pct(plan.desvio), hint: "da parte investida", tone: plan.desvio < 5 ? "pos" : plan.desvio < 15 ? "warn" : "neg" },
        {
          label: "Reserva",
          value: formatCurrency(plan.reserva.atual),
          hint: `de ${formatCurrency(plan.reserva.alvo)}${plan.reserva.baseadaEmGastos ? ` · ${plan.reserva.meses} meses de gastos` : ""}`,
          tone: reservaOk ? "pos" : "warn",
        },
      ],
    },
    { kind: "bars", title: "Alocação · atual e alvo", items: plan.buckets.map((b) => ({ label: b.label, atual: b.pct, ideal: b.alvoPct })) },
  ];
  if (plan.plano.length > 0) {
    blocks.push({
      kind: "list",
      title: `Onde aportar ${formatCurrency(plan.aporte)} este mês`,
      ordered: true,
      items: plan.plano.map((p) => ({ title: p.label, value: formatCurrency(p.valor) })),
    });
    blocks.push({ kind: "text", muted: true, text: `Aporte ${APORTE_ORIGEM[a.aporteOrigem]}. Sem vender nada: o dinheiro novo corrige a carteira aos poucos.` });
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

function replyFor(intent: Intent, ctx: BotPortfolioContext, research?: MarketResearchPayload | null): Msg {
  const gap = Math.max(0, (ctx.incomeGoal || 0) - ctx.totalRendaMensal);
  const market = research?.rates
    ? `Selic ${pct(research.rates.selicAnual, 2)} · CDI ${pct(research.rates.cdiAnual, 2)} · fonte ${research.rates.source === "bcb" ? "BCB" : "estimada"}`
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
          { label: "Score", value: String(ctx.score), hint: "de 100", tone: ctx.score >= 70 ? "pos" : ctx.score >= 45 ? "warn" : "neg" },
          { label: "Patrimônio", value: formatCurrency(ctx.grandTotal) },
          { label: "Renda passiva", value: formatCurrency(ctx.totalRendaMensal), hint: "por mês" },
          ctx.incomeGoal > 0
            ? { label: "Falta para a meta", value: formatCurrency(gap), hint: `meta ${formatCurrency(ctx.incomeGoal)}`, tone: gap === 0 ? "pos" : undefined }
            : { label: "Reserva", value: formatCurrency(ctx.emerTotal), hint: "emergência" },
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
      { kind: "heading", text: "FIIs por rendimento" },
      {
        kind: "text",
        muted: true,
        text: [owned.size ? `Você já tem ${[...owned].join(", ")}.` : "Você ainda não tem FIIs.", market].filter(Boolean).join(" · "),
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
        : { kind: "text", text: "Sua carteira de FIIs já cobre os principais nomes da lista." },
      gap > 0 && {
        kind: "stats",
        items: [{ label: "Capital para fechar a meta via FIIs", value: formatCurrency(gap / 0.0085), hint: `rendendo ~0,85%/mês para cobrir ${formatCurrency(gap)}` }],
      },
      { kind: "text", muted: true, text: "Ordenado por rendimento; não é recomendação de investimento. Fontes: BCB, Brapi/Yahoo quando disponíveis e estimativas curadas." },
    ], ["rebal", "meta", "whatsapp"]);
  }

  if (intent === "whatsapp") {
    return bot([
      { kind: "heading", text: "Relatório no WhatsApp" },
      { kind: "text", text: "Mando uma **imagem** com a sua carteira e o plano de aporte, e um **texto** com todas as sugestões de rebalanceamento." },
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
    const cdiAnual = (research?.rates?.cdiAnual ?? 14.9) / 100;
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
      gap > 0
        ? {
            kind: "list",
            title: "Capital extra estimado para fechar",
            items: [
              { title: "Via FIIs", meta: "~0,85%/mês", value: formatCurrency(gap / 0.0085) },
              { title: "Via TURBO", meta: "115% do CDI", value: formatCurrency(gap / cdiMensal) },
              { title: "Via dividendos", meta: "~0,4%/mês", value: formatCurrency(gap / 0.004) },
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

/**
 * Atalhos para mensagens curtas e diretas; perguntas abertas vão para a IA ("help").
 */
function detectIntent(raw: string): Intent {
  const t = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (t.split(/\s+/).length > 7) return "help";
  if (/whats|zap|relator/.test(t)) return "whatsapp";
  if (/pdf|baixar|download|imprim/.test(t)) return "pdf";
  if (/perfil|conservador|moderado|arrojado/.test(t)) return "perfil";
  if (/rebalanc|equilibr|onde aportar|aloca/.test(t)) return "rebal";
  if (/^(visao|resumo|diagnostico|score|minha carteira)/.test(t)) return "visao";
  if (/quanto falta|minha meta/.test(t)) return "meta";
  return "help";
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

function BlockView({ block, onPdf, onProfile }: { block: Block; onPdf: () => void; onProfile: () => void }) {
  switch (block.kind) {
    case "md":
      return <Markdown text={block.text} />;
    case "whatsapp":
      return <WhatsappPanel variant="bot" />;
    case "profile":
      return <RiskProfilePicker variant="bot" onChange={onProfile} />;
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

/* ── Componente ─────────────────────────────────────────────────── */

export function InvestorBot({
  context,
  onGeneratePdf,
}: {
  context: BotPortfolioContext;
  onGeneratePdf: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => [welcome()]);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

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

  async function rebalance(): Promise<Msg> {
    const res = await fetch("/api/bot/analysis", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) return errorReply(data?.error ?? "Não consegui analisar a carteira agora. Tente de novo em instantes.");
    return rebalReply(data as AnalysisPayload);
  }

  /** Pergunta aberta: IA com os dados da carteira; sem IA configurada, cai no menu de ajuda. */
  async function askAi(history: Msg[], userText: string): Promise<Msg> {
    const turns: { role: "user" | "assistant"; content: string }[] = [];
    for (let i = 0; i < history.length - 1; i++) {
      const u = history[i];
      const b = history[i + 1];
      if (u.role === "user" && b.role === "bot" && b.ai) turns.push({ role: "user", content: u.text }, { role: "assistant", content: b.ai });
    }
    turns.push({ role: "user", content: userText });
    const res = await fetch("/api/bot/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: turns.slice(-12) }),
    });
    const data = await res.json().catch(() => null);
    if (res.status === 503 && data?.code === "no_llm") return replyFor("help", context, researchCache.current);
    if (!res.ok) return errorReply(data?.error ?? "Não consegui responder agora. Tente de novo em instantes.");
    const reply = String(data?.reply ?? "");
    return { id: uid(), role: "bot", blocks: [{ kind: "md", text: reply }], ai: reply, followups: ["rebal", "whatsapp"] };
  }

  async function ask(userText: string, intent: Intent) {
    if (busy) return;
    const history = messages;
    setMessages((prev) => [...prev, { id: uid(), role: "user", text: userText }]);
    setBusy(true);
    try {
      let reply: Msg;
      if (intent === "rebal") {
        reply = await rebalance();
      } else if (intent === "help") {
        reply = await askAi(history, userText);
      } else {
        const needsMarket = intent === "fiis" || intent === "visao" || intent === "meta";
        const [research] = await Promise.all([
          needsMarket ? loadResearch() : Promise.resolve(researchCache.current),
          new Promise((r) => setTimeout(r, THINK_MS)),
        ]);
        reply = replyFor(intent, context, research);
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
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "fixed z-[120] flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-border shadow-2xl transition-[transform,background-color] duration-150 ease-out touch-manipulation",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "right-[max(1.25rem,var(--safe-right))]",
          "bottom-[calc(var(--bottom-nav-offset)+0.75rem)] md:bottom-5",
          open
            ? "bg-muted text-foreground hover:bg-muted/70"
            : "bg-background hover:scale-105 active:scale-95 motion-reduce:hover:scale-100",
          open && expanded && "md:hidden",
        )}
        aria-label={open ? "Fechar assistente Muvo" : "Abrir assistente Muvo"}
        aria-expanded={open}
        aria-controls="muvo-bot-panel"
      >
        {open ? <X className="h-6 w-6" /> : <BotAvatar className="h-full w-full rounded-none" />}
      </button>

      {open && (
        <section
          id="muvo-bot-panel"
          aria-label="Assistente Muvo"
          className={cn(
            "muvo-panel fixed z-[120] flex flex-col overflow-hidden border border-white/[0.08] bg-[#05050A] text-white shadow-2xl selection:bg-white selection:text-[#0D0D0D]",
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
                          <BlockView block={b} onPdf={onGeneratePdf} onProfile={() => void ask("Refaz o plano com o novo perfil", "rebal")} />
                        </div>
                      ))}
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
