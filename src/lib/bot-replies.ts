/**
 * Respostas do assistente da carteira, sem React: o mesmo texto aparece no site e no app
 * (o servidor monta a resposta com o mesmo código).
 */
import type { BotAlert } from "@/lib/alerts";
import { conservativeGoal, projectGoal, type GoalProjection } from "@/lib/goal-projection";
import type { Intent } from "@/lib/bot-intent";
import { formatCurrency } from "@/lib/utils";
import type { MarketResearchPayload } from "@/lib/market-research";
import { FALLBACK_CDI } from "@/lib/investment-rates";
import { RISK_PROFILES, alocacaoRelevante, type RiskProfile } from "@/lib/rebalance";
import { formatMonths as duration, type ProfileTransition } from "@/lib/profile-transition";
import {
  BUCKET_SECTION,
  hasEmergenciaCaixinha,
  reservaAdviceText,
  type AnalysisPayload,
  type BotAction,
} from "@/lib/plan-view";

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
  /** Resultado em bolsa (positivo ou negativo), para responder sem IA. */
  bolsaResultado?: number | null;
  /** Só mencionar caixinha Emergência se o usuário já tiver criado uma. */
  hasEmergenciaCaixinha?: boolean;
};

/* ── Modelo da conversa ─────────────────────────────────────────── */

export type Tone = "pos" | "warn" | "neg";

export type Block =
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

export type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "bot"; blocks: Block[]; followups?: Intent[]; ai?: string; q?: string; rated?: "up" | "down" };

export const FII_FALLBACK = [
  { ticker: "MXRF11", tipo: "Recebíveis", dyMensalPct: 1.1, price: null as number | null, perfil: "Alto rendimento, liquidez", risco: "Médio", source: "estimado" },
  { ticker: "XPML11", tipo: "Shopping", dyMensalPct: 0.75, price: null, perfil: "Renda estável + valorização", risco: "Baixo-médio", source: "estimado" },
  { ticker: "HGLG11", tipo: "Logística", dyMensalPct: 0.7, price: null, perfil: "Qualidade de ativos", risco: "Baixo", source: "estimado" },
  { ticker: "KNCR11", tipo: "Papel (CRI)", dyMensalPct: 1.0, price: null, perfil: "Inflação + CDI", risco: "Médio", source: "estimado" },
  { ticker: "VISC11", tipo: "Shopping", dyMensalPct: 0.8, price: null, perfil: "Dividendos consistentes", risco: "Baixo-médio", source: "estimado" },
  { ticker: "BTLG11", tipo: "Logística", dyMensalPct: 0.75, price: null, perfil: "Crescimento setorial", risco: "Baixo", source: "estimado" },
  { ticker: "TRXF11", tipo: "Híbrido", dyMensalPct: 0.9, price: null, perfil: "Diversificado", risco: "Médio", source: "estimado" },
  { ticker: "IRDM11", tipo: "Papel", dyMensalPct: 1.05, price: null, perfil: "Alto DY, mais volatilidade", risco: "Médio-alto", source: "estimado" },
];

export function pct(n: number, digits = 0) {
  return `${n.toFixed(digits).replace(".", ",")}%`;
}

export function fmtDy(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "n/d";
  return `${pct(v, 2)} ao mês`;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function welcome(): Msg {
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

export const APORTE_ORIGEM: Record<AnalysisPayload["aporteOrigem"], string> = {
  meta: "definido na sua meta",
  media: "sua média dos últimos 6 meses",
  padrao: "valor de referência; defina o aporte no topo de Metas",
};
export function rebalReply(a: AnalysisPayload): Msg {
  const plan = a.plan;
  const id = uid();
  if (!plan) {
    return {
      id, role: "bot", followups: ["perfil", "visao"],
      blocks: [
        { kind: "heading", text: "Como rebalancear" },
        { kind: "text", text: "Ainda não encontrei investimentos cadastrados. Registre contas e ativos no MUVO LIVE e eu monto o passo a passo." },
      ],
    };
  }
  const perfil = RISK_PROFILES[a.profile].label;
  const reservaOk = plan.reserva.atual >= plan.reserva.alvo - 1;
  const faltaReserva = Math.max(0, plan.reserva.alvo - plan.reserva.atual);
  const comAlocacao = alocacaoRelevante(plan);
  const foraDoAlvo = plan.buckets.filter((b) => Math.abs(b.pct - b.alvoPct) >= 2);
  const prioridades = plan.sugestoes.filter((s) => s.prioridade === "alta").slice(0, 3);

  const diagnostico = !reservaOk
    ? `Reserva em ${formatCurrency(plan.reserva.atual)} de ${formatCurrency(plan.reserva.alvo)} — faltam ${formatCurrency(faltaReserva)}. Complete isso antes de espalhar aporte.`
    : comAlocacao
      ? `Perfil ${perfil.toLowerCase()}: ${pct(plan.desvio)} da parte investida está fora do alvo. Sem vender — o aporte novo corrige.`
      : `Reserva ok. Com ${formatCurrency(plan.investido)} fora dela, ainda é cedo para mirar percentuais; foque em aportar com constância.`;

  const blocks: Block[] = [
    { kind: "heading", text: `Faça assim · ${perfil.toLowerCase()}` },
    { kind: "text", text: diagnostico },
  ];

  if (plan.plano.length > 0) {
    const primeiroReserva = plan.plano[0]?.bucket === "reserva";
    blocks.push({
      kind: "list",
      title: `Aporte de ${formatCurrency(plan.aporte)} nesta ordem`,
      ordered: true,
      items: plan.plano.map((p) => ({ title: p.label, value: formatCurrency(p.valor) })),
    });
    if (primeiroReserva) {
      blocks.push({
        kind: "text",
        text: reservaAdviceText(hasEmergenciaCaixinha(a.rows)),
      });
    }
    blocks.push({
      kind: "actions",
      items: plan.plano.slice(0, 3).map((p): BotAction => ({ kind: "investir", section: BUCKET_SECTION[p.bucket], amount: p.valor })),
    });
    blocks.push({
      kind: "text",
      muted: true,
      text: `Aporte ${APORTE_ORIGEM[a.aporteOrigem]}. Toque no botão para abrir o produto certo no LIVE.`,
    });
  } else if (!reservaOk) {
    blocks.push({
      kind: "alert",
      tone: "warn",
      text: `Prioridade: completar a reserva em ${formatCurrency(faltaReserva)}.`,
    });
    blocks.push({
      kind: "text",
      text: reservaAdviceText(hasEmergenciaCaixinha(a.rows)),
    });
    blocks.push({
      kind: "actions",
      items: [{ kind: "investir", section: "tesouro", amount: Math.min(plan.aporte || faltaReserva, faltaReserva) }],
    });
  } else if (prioridades.length > 0) {
    blocks.push({
      kind: "list",
      title: "Próximos passos",
      ordered: true,
      items: prioridades.map((s) => ({ title: s.titulo, detail: s.detalhe })),
    });
  } else {
    blocks.push({ kind: "alert", tone: "pos", text: "Carteira alinhada ao perfil. Continue aportando no ritmo da meta." });
  }

  if (comAlocacao && foraDoAlvo.length > 0) {
    blocks.push({
      kind: "bars",
      title: "Onde está desalinhado",
      items: foraDoAlvo.map((b) => ({ label: b.label, atual: b.pct, ideal: b.alvoPct })),
    });
  }

  if (!a.profileDefinido) {
    blocks.push(
      { kind: "text", text: "Usei o perfil **moderado** como padrão. Escolha o seu e eu refaço o plano:" },
      { kind: "profile" },
    );
  }

  blocks.push({
    kind: "text",
    muted: true,
    text: `Patrimônio ${formatCurrency(plan.total)} · análise educativa, não é recomendação.`,
  });

  return { id, role: "bot", blocks, followups: a.profileDefinido ? ["whatsapp", "perfil", "visao"] : ["whatsapp", "visao"] };
}

/** `hidden`: avisos adiados ou desconsiderados, fora da lista. */
export function alertsReply(alerts: BotAlert[], hidden = 0): Msg {
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

/** Evento disparado pelo botão "Explique" da tela de metas; o bot abre e responde com a explicação. */
export const EXPLAIN_GOAL_EVENT = "muvo:explique-meta";
export const EXPLAIN_GOAL_QUESTION = "Explique minha meta";

export function percentText(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** Explicação direta da meta, com os números da própria conta. */
export function goalExplainReply(ctx: BotPortfolioContext, research?: MarketResearchPayload | null): Msg {
  const g = ctx.goal;
  if (!(ctx.incomeGoal > 0) || !g) {
    return {
      id: uid(),
      role: "bot",
      blocks: [
        { kind: "heading", text: "Como funciona a sua meta" },
        { kind: "text", text: "Defina uma meta de renda no topo desta página. Depois eu explico a conta com os seus números." },
      ],
      followups: ["visao"],
    };
  }
  const cdiAnual = research?.rates?.cdiAnual ?? FALLBACK_CDI;
  const cons = conservativeGoal(g, cdiAnual);
  const prazo = (m: number | null) => (m === null ? "mais de 100 anos" : m === 0 ? "já coberta" : duration(m));
  const pctDaMeta = g.capitalNecessario > 0 ? Math.min(100, (ctx.grandTotal / g.capitalNecessario) * 100) : 0;

  const blocks: Block[] = [
    { kind: "heading", text: "Como a sua meta é calculada" },
    {
      kind: "md",
      text: `Você quer **${formatCurrency(g.metaRendaMensal)} por mês** de renda, em **valores de hoje**. A inflação reduz o poder de compra do dinheiro, então a conta desconta o IPCA de ${percentText(g.ipcaAnualPct)} ao ano. O que sobra é um rendimento real de **${percentText(g.rendimentoRealAnualPct)} ao ano**, já líquido de Imposto de Renda.`,
    },
    {
      kind: "stats",
      items: [
        { label: "Capital necessário", value: formatCurrency(g.capitalNecessario), hint: "valores de hoje" },
        { label: "Você tem", value: formatCurrency(ctx.grandTotal), hint: `${pctDaMeta.toFixed(0)}% do alvo` },
        { label: "Aporte", value: formatCurrency(g.aporteMensal), hint: "por mês" },
      ],
    },
    {
      kind: "text",
      text:
        g.meses === null
          ? "No ritmo atual, o patrimônio não chega à meta em 100 anos. Aumentar o aporte é o que mais encurta o prazo."
          : g.meses === 0
            ? "Seu patrimônio já cobre a meta."
            : `No ritmo de ${formatCurrency(g.aporteMensal)} por mês, a meta fica pronta em ${duration(g.meses)}${g.anoPrevisto ? `, por volta de ${g.anoPrevisto}` : ""}.`,
    },
  ];
  if (g.capitalNominal) {
    blocks.push({
      kind: "text",
      muted: true,
      text: `Sem descontar a inflação, o número seria ${formatCurrency(g.capitalNominal)}: é o valor que aparece na conta, mas cada real vale menos a cada ano.`,
    });
  }
  if (cons) {
    blocks.push({
      kind: "text",
      text: `Se a carteira render só o CDI líquido (cerca de ${percentText(cdiAnual * 0.85)} ao ano), a meta pede ${formatCurrency(cons.capitalNecessario)} e o prazo é ${prazo(cons.meses)}.`,
    });
  }
  blocks.push(
    {
      kind: "list",
      title: "O que mexe no resultado",
      items: [
        { title: "Aporte maior", meta: "encurta o prazo" },
        { title: "Rendimento menor", meta: "aumenta o capital necessário" },
        { title: "Inflação maior", meta: "também aumenta, porque a renda precisa acompanhá-la" },
      ],
    },
    { kind: "alert", tone: "warn", text: "Os números usam o retorno dos últimos 12 meses da carteira. Esse retorno muda com o mercado e não é garantido." },
  );
  return { id: uid(), role: "bot", blocks, followups: ["rebal", "visao"] };
}

/** Aporte mensal para a meta ficar pronta até o fim do ano pedido, em valores de hoje. */
export function aporteDeadlineReply(text: string, ctx: BotPortfolioContext): Msg {
  const g = ctx.goal;
  const ano = Number(text.match(/\b(20\d{2})\b/)?.[1] ?? 0);
  const proximoAno = new Date().getFullYear() + 1;
  const bloco = (texto: string): Block => ({ kind: "text", text: texto });
  const blocks: Block[] = [];

  if (!(ctx.incomeGoal > 0) || !g) {
    blocks.push(bloco("Defina sua meta de renda no topo desta página. Depois eu calculo quanto aportar para chegar no ano que você quer."));
  } else if (!ano) {
    blocks.push(bloco(`Para qual ano? Por exemplo: "aporte para ${proximoAno}".`));
  } else if (ano <= new Date().getFullYear()) {
    blocks.push(bloco(`Esse ano já passou. Diga um ano futuro, por exemplo ${proximoAno}.`));
  } else {
    const plano = projectGoal({
      metaRendaMensal: g.metaRendaMensal,
      patrimonio: g.patrimonio,
      aporteMensal: g.aporteMensal,
      retornoAnualPct: g.retornoNominalAnualPct,
      ipcaAnualPct: g.ipcaAnualPct,
      prazoAno: ano,
    });
    const necessario = plano?.aporteParaPrazo;
    if (necessario === null || necessario === undefined) {
      blocks.push(bloco("Não consegui calcular o aporte para esse ano. Tente outro ano."));
    } else {
      const atual = g.aporteMensal;
      const supera = g.retornoNominalAnualPct > g.ipcaAnualPct;
      blocks.push(
        bloco(
          supera
            ? `A carteira rende ${percentText(g.retornoNominalAnualPct)} ao ano, acima da inflação de ${percentText(g.ipcaAnualPct)}. Ou seja, a inflação já está sendo superada: o que falta é o prazo.`
            : `A carteira rende ${percentText(g.retornoNominalAnualPct)} ao ano, abaixo da inflação de ${percentText(g.ipcaAnualPct)}. Antes de aumentar o aporte, vale rever a carteira.`,
        ),
      );
      blocks.push({
        kind: "stats",
        items: [
          { label: `Aporte para ${ano}`, value: formatCurrency(necessario), hint: "por mês, em valores de hoje" },
          { label: "Aporte atual", value: formatCurrency(atual), hint: "por mês" },
        ],
      });
      blocks.push(
        bloco(
          necessario <= atual
            ? `Seu aporte atual já basta para a meta ficar pronta até o fim de ${ano}.`
            : `Você precisa aportar ${formatCurrency(necessario - atual)} a mais por mês para a meta ficar pronta até o fim de ${ano}.`,
        ),
      );
    }
  }
  return { id: uid(), role: "bot", blocks, followups: ["meta", "explica_meta"] };
}

export function replyFor(intent: Intent, ctx: BotPortfolioContext, research?: MarketResearchPayload | null): Msg {
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

  if (intent === "explica_meta") return goalExplainReply(ctx, research);

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
    { kind: "heading", text: "Posso ajudar sem inteligência artificial" },
    {
      kind: "text",
      text: "Pergunte pelos números da carteira, por um termo (CDB, CDI, FII…), por uma conta de rendimento, ou toque em um atalho:",
    },
    {
      kind: "list",
      items: [
        { title: "Visão da carteira", detail: "Patrimônio, renda e alertas" },
        { title: "Rebalancear carteira", detail: "Onde aportar pelo seu perfil" },
        { title: "Avisos", detail: "Quedas, teto da Turbo, vencimentos" },
        { title: "Meta de renda", detail: "Quanto falta e como fechar" },
        { title: "Fundos imobiliários", detail: "Ideias por rendimento" },
        { title: "Relatório no WhatsApp", detail: "Enviar o resumo" },
      ],
    },
  ], ["visao", "rebal", "avisos", "meta"]);
}

/** Prazo da meta no ritmo atual e aporte para chegar no ano desejado. */
export function goalBlocks(g: NonNullable<BotPortfolioContext["goal"]>): Block[] {
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
    blocks.push({ kind: "text", text: "Defina o **ano da meta** e o **aporte** no topo de Metas e eu calculo quanto aportar por mês para chegar lá." });
  } else if (g.aporteParaPrazo === null) {
    blocks.push({ kind: "alert", tone: "warn", text: `O prazo de ${g.prazoAno} já passou. Atualize o ano da meta no topo de Metas.` });
  } else if (!g.noPrazo && g.aporteParaPrazo > g.aporte) {
    blocks.push(
      { kind: "alert", tone: "warn", text: `Para chegar em ${g.prazoAno}, aumente o aporte em **${formatCurrency(g.aporteParaPrazo - g.aporte)}** por mês ou adie o prazo.` },
      { kind: "actions", items: [{ kind: "investir", section: "hub", amount: g.aporteParaPrazo }] },
    );
  }
  return blocks;
}

export const DIRECAO_TEXTO: Record<ProfileTransition["direcao"], string | null> = {
  mais_risco: "Mais ações e fundos imobiliários, menos renda fixa. A carteira oscila mais no curto prazo em troca de um retorno esperado maior no longo prazo. Faz sentido para dinheiro que você não vai precisar pelos próximos 5 anos.",
  menos_risco: "Mais renda fixa e reserva maior, menos ações. A carteira oscila menos, e o retorno esperado no longo prazo também fica menor.",
  igual: null,
};

/** Caminho da carteira atual até o perfil novo, com o passo a passo e a confirmação no fim. */
export function transitionReply(t: ProfileTransition, profileSalvo: RiskProfile | null): Msg {
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
      : { value: t.aporte > 0 ? "Mais de 20 anos" : "Sem aporte", hint: t.aporte > 0 ? "considere realocar parte da carteira" : "defina um aporte mensal no topo de Metas", tone: "warn" as Tone };
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

/* ── Renderização ───────────────────────────────────────────────── */

