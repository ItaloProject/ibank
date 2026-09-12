"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot, X, Send, Sparkles, PieChart, Building2, Scale, FileDown, Loader2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { MarketResearchPayload } from "@/lib/market-research";

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

type Msg = {
  id: string;
  role: "bot" | "user";
  text: string;
  pdfReady?: boolean;
};

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

function fmtDy(pct: number | null | undefined) {
  if (pct == null || !Number.isFinite(pct)) return "n/d";
  return `${pct.toFixed(2).replace(".", ",")}%/mês`;
}

function fmtPrice(price: number | null | undefined) {
  if (price == null || !Number.isFinite(price)) return null;
  return formatCurrency(price);
}

const STOCK_PICKS = [
  { ticker: "BBAS3", setor: "Bancos", motivo: "Dividendos sólidos + diversificação vs commodities" },
  { ticker: "ITUB4", setor: "Bancos", motivo: "Liquidez e histórico de proventos" },
  { ticker: "TAEE11", setor: "Energia", motivo: "Utilities com rendimento previsível" },
  { ticker: "EGIE3", setor: "Energia", motivo: "Geração + dividendos estáveis" },
  { ticker: "WEGE3", setor: "Industrial", motivo: "Crescimento de longo prazo" },
  { ticker: "BBSE3", setor: "Seguros", motivo: "Payout elevado e baixa correlação com VALE/PETR" },
];

const QUICK = [
  { id: "visao", label: "Visão da carteira", icon: PieChart },
  { id: "fiis", label: "FIIs rentáveis", icon: Building2 },
  { id: "acoes", label: "Equilibrar ações", icon: Scale },
  { id: "pdf", label: "Baixar PDF", icon: FileDown },
] as const;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function replyFor(
  intent: string,
  ctx: BotPortfolioContext,
  research?: MarketResearchPayload | null,
): Msg {
  const gap = Math.max(0, (ctx.incomeGoal || 0) - ctx.totalRendaMensal);
  const ratesLine = research?.rates
    ? `Selic **${research.rates.selicAnual.toFixed(2).replace(".", ",")}%** · CDI **${research.rates.cdiAnual.toFixed(2).replace(".", ",")}%** (${research.rates.source === "bcb" ? "BCB" : "estimado"})`
    : null;

  if (intent === "visao" || intent === "carteira" || intent === "resumo") {
    const alloc = ctx.recommendations
      .map((r) => `• **${r.label}**: ${r.atual.toFixed(0)}% (ideal ${r.ideal}%)`)
      .join("\n");
    const fontes = ctx.sources.length
      ? ctx.sources.map((s) => `• ${s.nome} (${s.tipo}): +${formatCurrency(s.rendaMensal)}/mês`).join("\n")
      : "• Nenhuma fonte identificada ainda";
    const alerts = ctx.insights
      .filter((i) => i.level === "critical" || i.level === "warning")
      .slice(0, 3)
      .map((i) => `• ${i.title}`)
      .join("\n") || "• Nenhum alerta crítico no momento";

    return {
      id: uid(),
      role: "bot",
      text: [
        `**Visão completa da carteira**`,
        ``,
        ratesLine ? `Mercado: ${ratesLine}` : null,
        `Score: **${ctx.score}/100**`,
        `Patrimônio: **${formatCurrency(ctx.grandTotal)}**`,
        `Renda passiva: **${formatCurrency(ctx.totalRendaMensal)}/mês**`,
        ctx.incomeGoal > 0
          ? `Meta: **${formatCurrency(ctx.incomeGoal)}/mês** · faltam **${formatCurrency(gap)}**`
          : `Meta: ainda não definida`,
        `Reserva de emergência: **${formatCurrency(ctx.emerTotal)}**`,
        `FIIs na variável: **${ctx.fiiPctVariavel.toFixed(0)}%** (ideal 50–60%)`,
        ``,
        `**Fontes de renda**`,
        fontes,
        ``,
        `**Alocação**`,
        alloc,
        ``,
        `**Alertas**`,
        alerts,
        ``,
        `Quer que eu sugira FIIs, rebalanceie ações ou gere o PDF?`,
      ].filter((l) => l != null).join("\n"),
    };
  }

  if (intent === "fiis" || intent === "fii" || intent === "fundos") {
    const owned = new Set(
      ctx.holdings.filter((h) => h.kind === "FII").map((h) => h.ticker.toUpperCase()),
    );
    const universe = (research?.fiis?.length ? research.fiis : FII_FALLBACK)
      .slice()
      .sort((a, b) => (b.dyMensalPct ?? 0) - (a.dyMensalPct ?? 0));
    const picks = universe.filter((f) => !owned.has(f.ticker)).slice(0, 5);
    const ownedLine = owned.size
      ? `Você já tem: ${[...owned].join(", ")}.`
      : "Você ainda não tem FIIs na carteira.";

    const list = picks
      .map((f, i) => {
        const price = fmtPrice(f.price);
        const live = "source" in f && f.source === "brapi" ? " · dados ao vivo" : "";
        return [
          `${i + 1}. **${f.ticker}** · ${f.tipo}${price ? ` · ${price}` : ""}`,
          `   DY ${fmtDy(f.dyMensalPct)}${live} · ${f.perfil} · risco ${f.risco}`,
        ].join("\n");
      })
      .join("\n\n");

    const capitalHint = gap > 0
      ? `\n\nPara fechar ~${formatCurrency(gap)}/mês de gap via FIIs (~0,85%/mês), estimativa de capital adicional: **${formatCurrency(gap / 0.0085)}**.`
      : "";

    return {
      id: uid(),
      role: "bot",
      text: [
        `**Pesquisa de mercado · FIIs**`,
        ``,
        ratesLine ? `${ratesLine}` : null,
        ownedLine,
        ``,
        `Sugestões por DY (não é recomendação CVM):`,
        ``,
        list || "Sua carteira de FIIs já cobre bem os principais nomes da lista.",
        capitalHint,
        ``,
        `Fontes: BCB (Selic/CDI) · Brapi/Yahoo (quando disponíveis) · estimativas curadas.`,
        `Próximo passo: no painel de Ações, registre a compra do ticker escolhido.`,
      ].filter((l) => l != null).join("\n"),
    };
  }

  if (intent === "acoes" || intent === "ação" || intent === "acao" || intent === "equilibrar" || intent === "diversificar") {
    const owned = new Set(ctx.holdings.map((h) => h.ticker.toUpperCase()));
    const picks = STOCK_PICKS.filter((s) => !owned.has(s.ticker)).slice(0, 4);
    const commodityNote = ctx.commodityPct > 40
      ? `\n\n⚠️ Commodities estão em **${ctx.commodityPct.toFixed(0)}%** da renda variável. Priorize bancos/energia/seguros para reduzir correlação.`
      : "";

    const moves = ctx.nextMoves
      .map((m) => `${m.prioridade}. **${m.label}** · ${m.valor}\n   ${m.razao}`)
      .join("\n\n");

    const list = picks
      .map((s) => `• **${s.ticker}** (${s.setor}) — ${s.motivo}`)
      .join("\n");

    return {
      id: uid(),
      role: "bot",
      text: [
        `**Equilíbrio da carteira de ações**`,
        ``,
        `FIIs na variável: **${ctx.fiiPctVariavel.toFixed(0)}%** (meta 50–60%)`,
        commodityNote,
        ``,
        `**Próximos movimentos**`,
        moves || "Carteira estável — continue aportando conforme a meta.",
        ``,
        `**Sugestões de compra (fora da sua carteira)**`,
        list || "Você já cobre bem os setores sugeridos.",
        ``,
        `Posso gerar o PDF completo com esse plano.`,
      ].join("\n"),
    };
  }

  if (intent === "pdf" || intent === "relatorio" || intent === "relatório" || intent === "baixar") {
    return {
      id: uid(),
      role: "bot",
      text: [
        `**Relatório PDF pronto**`,
        ``,
        `Montei a visão completa: score, diagnóstico, fontes de renda, alocação e próximos aportes.`,
        `Clique em **Baixar PDF** abaixo para imprimir/salvar.`,
      ].join("\n"),
      pdfReady: true,
    };
  }

  if (intent === "meta" || intent === "renda") {
    return {
      id: uid(),
      role: "bot",
      text: [
        `Sua renda passiva atual é **${formatCurrency(ctx.totalRendaMensal)}/mês**.`,
        ctx.incomeGoal > 0
          ? `Meta: **${formatCurrency(ctx.incomeGoal)}** · faltam **${formatCurrency(gap)}**.`
          : `Defina a meta em Minha Meta ou no campo do Modo Investidor.`,
        gap > 0
          ? `\nCaminhos estimados:\n• Via FIIs: +${formatCurrency(gap / 0.0085)}\n• Via TURBO 115% CDI: +${formatCurrency(gap / (1.15 * (0.1065 / 12)))}\n• Via dividendos ~0,4%: +${formatCurrency(gap / 0.004)}`
          : `\nParabéns — a meta já está coberta pela renda estimada.`,
      ].join("\n"),
    };
  }

  return {
    id: uid(),
    role: "bot",
    text: [
      `Posso ajudar com:`,
      `• **Visão da carteira** — score, fontes e alertas`,
      `• **FIIs rentáveis** — pesquisa e sugestões`,
      `• **Equilibrar ações** — diversificação e próximos aportes`,
      `• **Baixar PDF** — relatório completo`,
      ``,
      `Digite ou use os atalhos abaixo.`,
    ].join("\n"),
  };
}

function detectIntent(raw: string): string {
  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/pdf|relator|baixar|download|imprim/.test(t)) return "pdf";
  if (/fii|fundo|imobili/.test(t)) return "fiis";
  if (/equilibr|diversif|acoes|acao|rebalanc|comprar ac/.test(t)) return "acoes";
  if (/visao|carteira|resumo|diagnost|score|completo/.test(t)) return "visao";
  if (/meta|renda|passiva|quanto falta/.test(t)) return "meta";
  return "help";
}

function renderMarkdownLite(text: string) {
  return text.split("\n").map((line, i) => {
    const html = line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^• /, "• ");
    return (
      <p
        key={i}
        className={cn("text-sm leading-relaxed", line === "" && "h-2")}
        dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }}
      />
    );
  });
}

export function InvestorBot({
  context,
  onGeneratePdf,
}: {
  context: BotPortfolioContext;
  onGeneratePdf: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "bot",
      text: [
        `Olá! Sou o **MUVO Bot** 🤖`,
        ``,
        `Faço pesquisa de mercado de FIIs, ajudo a equilibrar ações e monto a visão completa da carteira.`,
        `Posso conversar aqui ou gerar um **PDF** com o plano.`,
      ].join("\n"),
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  const researchCache = useRef<MarketResearchPayload | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

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
    } catch {
      /* bot continues with fallbacks */
    }
    return null;
  }

  async function pushReply(intent: string) {
    setBusy(true);
    try {
      const needsMarket = intent === "fiis" || intent === "visao" || intent === "carteira" || intent === "resumo";
      const research = needsMarket ? await loadResearch() : researchCache.current;
      setMessages((prev) => [...prev, replyFor(intent, context, research)]);
    } finally {
      setBusy(false);
    }
  }

  function handleQuick(id: string) {
    const labels: Record<string, string> = {
      visao: "Quero a visão completa da carteira",
      fiis: "Quais FIIs estão mais rentáveis?",
      acoes: "Como equilibrar minha carteira de ações?",
      pdf: "Gera o PDF do relatório",
    };
    setMessages((prev) => [...prev, { id: uid(), role: "user", text: labels[id] ?? id }]);
    void pushReply(id);
  }

  function handleSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((prev) => [...prev, { id: uid(), role: "user", text }]);
    void pushReply(detectIntent(text));
  }

  return (
    <>
      {/* FAB — above BottomNav on mobile */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed z-[120] flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all touch-manipulation",
          "right-[max(1.25rem,var(--safe-right))]",
          "bottom-[calc(var(--bottom-nav-offset)+0.75rem)] md:bottom-5",
          open
            ? "bg-white/10 text-white border border-white/20 hover:bg-white/15"
            : "bg-gradient-to-br from-violet-500 to-blue-500 text-white hover:scale-105",
        )}
        aria-label={open ? "Fechar bot" : "Abrir MUVO Bot"}
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-7 w-7" />}
        {!open && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-400" />
          </span>
        )}
      </button>

      {/* Painel */}
      {open && (
        <div
          className={cn(
            "fixed z-[120] flex w-[min(100vw-1.5rem,380px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b14]/95 shadow-2xl backdrop-blur-xl",
            "left-1/2 -translate-x-1/2 md:left-auto md:right-[max(1.25rem,var(--safe-right))] md:translate-x-0",
            "bottom-[calc(var(--bottom-nav-offset)+5rem)] md:bottom-[5.5rem]",
          )}
          style={{
            height: "min(65dvh, 520px)",
            maxHeight: "calc(100dvh - var(--bottom-nav-offset) - 7rem)",
          }}
        >
          <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">MUVO Bot</p>
              <p className="text-[11px] text-white/45">Pesquisa · carteira · PDF</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[90%] rounded-2xl px-3.5 py-2.5",
                    m.role === "user"
                      ? "bg-violet-600 text-white rounded-br-md"
                      : "bg-white/[0.06] text-white/90 border border-white/10 rounded-bl-md",
                  )}
                >
                  {m.role === "bot" ? renderMarkdownLite(m.text) : <p className="text-sm">{m.text}</p>}
                  {m.pdfReady && (
                    <button
                      type="button"
                      onClick={onGeneratePdf}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Baixar PDF do relatório
                    </button>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-white/40 px-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analisando mercado e carteira...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-white/10 px-3 pt-2 pb-1">
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {QUICK.map((q) => {
                const Icon = q.icon;
                return (
                  <button
                    key={q.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handleQuick(q.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    <Icon className="h-3 w-3" />
                    {q.label}
                  </button>
                );
              })}
            </div>
            <form
              className="flex items-center gap-2 pb-2"
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre FIIs, ações, meta..."
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50 min-h-11"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 touch-manipulation"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
