"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, Check, TrendingUp, Wallet, Bot, Smartphone,
  BarChart2, Shield, CalendarCheck, Landmark, Target,
  ChevronLeft, MessageCircle, Star, ChevronDown, Users,
  BadgeCheck, Zap, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── tipos ─────────────────────────────────────────────────────────────────────
type Goal = "aposentadoria" | "renda_mensal" | "organizacao";
type Aporte = "nenhum" | "ate500" | "500a2k" | "2ka5k" | "mais5k";

interface LeadData {
  nome: string;
  whatsapp: string;
  objetivo: Goal | "";
  aporte: Aporte | "";
}

// ── conteúdo lateral por etapa ────────────────────────────────────────────────
const SIDE_CONTENT = [
  {
    headline: "Feito para quem leva investimento a sério.",
    sub: "Controle cartão, acompanhe FIIs, calcule IR e planeje metas — tudo num só lugar.",
    stats: [
      { icon: TrendingUp,    label: "Carteira com alocação ideal",    color: "text-emerald-400" },
      { icon: Landmark,      label: "IR calculado automaticamente",    color: "text-violet-400" },
      { icon: CalendarCheck, label: "Proventos e dividendos",          color: "text-blue-400" },
      { icon: BarChart2,     label: "Rentabilidade vs CDI",            color: "text-amber-400" },
    ],
  },
  {
    headline: "Seus dados ficam só com você.",
    sub: "Login com senha, acesso individual. Ninguém mais vê seus investimentos.",
    stats: [
      { icon: Shield,     label: "Acesso restrito por senha",    color: "text-emerald-400" },
      { icon: Smartphone, label: "PWA — funciona como app",      color: "text-blue-400" },
      { icon: Bot,        label: "Bot opcional com IA",          color: "text-violet-400" },
      { icon: Wallet,     label: "Controle de cartão integrado", color: "text-amber-400" },
    ],
  },
  {
    headline: "Cada perfil tem sua estratégia.",
    sub: "Aposentadoria ou renda mensal: a carteira sugerida e o rebalanceamento se adaptam ao seu objetivo.",
    stats: [
      { icon: Target,     label: "Carteira sugerida por perfil",     color: "text-emerald-400" },
      { icon: BarChart2,  label: "Rebalanceamento por aporte",       color: "text-violet-400" },
      { icon: TrendingUp, label: "Metas com prazo e simulação",      color: "text-blue-400" },
      { icon: Landmark,   label: "Impostos separados por categoria", color: "text-amber-400" },
    ],
  },
  {
    headline: "Simples de usar, poderoso para qualquer nível.",
    sub: "Do iniciante que quer organizar ao veterano que acompanha IR e rentabilidade vs CDI.",
    stats: [
      { icon: Wallet,        label: "Controle de gastos no cartão", color: "text-emerald-400" },
      { icon: CalendarCheck, label: "Calendário de proventos",      color: "text-blue-400" },
      { icon: BarChart2,     label: "Relatórios de desempenho",     color: "text-violet-400" },
      { icon: Bot,           label: "Pesquisa de mercado com IA",   color: "text-amber-400" },
    ],
  },
];

// Depoimentos ilustrativos — não representam clientes reais, usados apenas
// para demonstrar o layout enquanto não há depoimentos reais coletados.
const TESTIMONIALS: { name: string; initials: string; color: string; quote: string }[] = [
  {
    name: "Raimundo Nonato",
    initials: "RT",
    color: "bg-blue-600",
    quote: "Finalmente tenho controle real da minha carteira. O cálculo de IR automático me salvou muito tempo na declaração do imposto de renda.",
  },
  {
    name: "Antonio carlos",
    initials: "AC",
    color: "bg-emerald-600",
    quote: "Uso todo dia para acompanhar o cartão e as ações. É simples e direto ao ponto.",
  },
];

const GOAL_OPTIONS: { id: Goal; label: string; tagline: string; icon: React.ElementType; color: string }[] = [
  { id: "aposentadoria", label: "Aposentadoria",      tagline: "Crescimento no longo prazo",    icon: Landmark,      color: "border-blue-500/60 bg-blue-500/10 text-blue-400" },
  { id: "renda_mensal",  label: "Renda Mensal",       tagline: "Proventos todo mês",             icon: CalendarCheck, color: "border-emerald-500/60 bg-emerald-500/10 text-emerald-400" },
  { id: "organizacao",   label: "Organizar Finanças", tagline: "Cartão, gastos e planejamento",  icon: Wallet,        color: "border-amber-500/60 bg-amber-500/10 text-amber-400" },
];

const APORTE_OPTIONS: { id: Aporte; label: string }[] = [
  { id: "nenhum",  label: "Ainda não invisto" },
  { id: "ate500",  label: "Até R$ 500/mês" },
  { id: "500a2k",  label: "R$ 500 – R$ 2.000/mês" },
  { id: "2ka5k",   label: "R$ 2.000 – R$ 5.000/mês" },
  { id: "mais5k",  label: "Mais de R$ 5.000/mês" },
];

const FAQ_ITEMS = [
  {
    q: "Precisa instalar alguma coisa?",
    a: "Não. O IBANK é um PWA — abre direto no navegador do celular ou computador. Você pode salvar na tela inicial como um app normal, sem precisar da App Store ou Play Store.",
  },
  {
    q: "Como funciona o período grátis de 15 dias?",
    a: "Você recebe acesso completo por 15 dias sem pagar nada. Só cobramos após esse período, via Pix mensal. Se decidir não continuar, basta avisar pelo WhatsApp antes do fim do período — sem multa, sem burocracia.",
  },
  {
    q: "Meus investimentos ficam seguros?",
    a: "Sim. Cada usuário tem login e banco de dados individual — ninguém mais acessa seus dados. Não integramos com corretoras nem movimentamos dinheiro: você registra os dados manualmente, como numa planilha, mas muito mais organizado.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim, a qualquer momento. É só mandar mensagem no WhatsApp. Não há contrato, fidelidade mínima ou taxa de cancelamento.",
  },
];

function whatsappUrl(lead: LeadData, plan: "assinante" | "completo") {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP ?? "5500000000000";
  const phone = raw.replace(/\D/g, "");
  const goalLabel = GOAL_OPTIONS.find((g) => g.id === lead.objetivo)?.label ?? lead.objetivo;
  const aporteLabel = APORTE_OPTIONS.find((a) => a.id === lead.aporte)?.label ?? lead.aporte;
  const planLabel = plan === "completo" ? "Completo R$ 45 (app + bot)" : "Assinante R$ 30";
  const text = encodeURIComponent(
    `Olá! Me chamo ${lead.nome} e tenho interesse no IBANK — plano ${planLabel}.\n\nMeu objetivo: ${goalLabel}\nInvisto: ${aporteLabel}\nWhatsApp: ${lead.whatsapp}\n\nPode me passar os detalhes para começar os 15 dias grátis?`,
  );
  return `https://wa.me/${phone}?text=${text}`;
}

// ── componente principal ──────────────────────────────────────────────────────
export default function ComecarPage() {
  const [step, setStep] = useState(0);
  const [lead, setLead] = useState<LeadData>({ nome: "", whatsapp: "", objetivo: "", aporte: "" });
  const [saving, setSaving] = useState(false);
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const [animating, setAnimating] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const waRef   = useRef<HTMLInputElement>(null);

  const TOTAL_STEPS = 5;
  const progress = Math.round((step / (TOTAL_STEPS - 1)) * 100);

  useEffect(() => { nomeRef.current?.focus(); }, []);

  function goTo(next: number, dir: "right" | "left" = "right") {
    if (animating) return;
    setSlideDir(dir);
    setAnimating(true);
    setTimeout(() => { setStep(next); setAnimating(false); }, 220);
  }

  async function finalize() {
    setSaving(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    } catch { /* silencioso */ }
    setSaving(false);
    goTo(4);
  }

  const side = SIDE_CONTENT[Math.min(step, SIDE_CONTENT.length - 1)];

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">

      {/* ── painel esquerdo (desktop) ─────────────────────────────────────── */}
      <div className="hidden md:flex md:w-1/2 lg:w-[55%] md:sticky md:top-0 md:h-[100dvh] md:overflow-y-auto flex-col px-12 py-12 border-r border-zinc-800 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/30 via-transparent to-violet-950/20 pointer-events-none" />

        <div className="relative z-10 flex-1 flex flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-xl overflow-hidden">
              <Image src="/logo.png" alt="IBANK" width={200} height={200}
                className="h-full w-full object-cover" style={{ objectPosition: "50% 48%" }} priority />
            </div>
            <span className="font-bold text-lg tracking-tight">IBANK</span>
          </div>

          {/* Headline + features */}
          <div key={step} className="transition-all duration-300">
            <h2 className="text-3xl lg:text-4xl font-bold leading-tight mb-3 text-white">
              {side.headline}
            </h2>
            <p className="text-zinc-400 text-base leading-relaxed mb-6">{side.sub}</p>
            <div className="grid grid-cols-1 gap-2">
              {side.stats.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-4 py-3">
                    <Icon className={cn("h-5 w-5 shrink-0", s.color)} />
                    <span className="text-sm text-zinc-300 font-medium">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mockup do app — visível sempre no desktop */}
          <div className="mt-8 flex justify-center">
            <AppMockup />
          </div>
        </div>

        {/* Social proof + depoimentos */}
        <div className="relative z-10 mt-8 space-y-3">
          <SocialProofBar />
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <Avatar initials={t.initials} color={t.color} />
                <div className="flex-1 min-w-0">
                  <div className="flex gap-0.5 mb-1.5">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-3 w-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <p className="text-xs text-zinc-500 mt-2 font-medium">
                    {t.name}
                  </p>
                  <p className="text-[7px] text-zinc-600 font-normal mt-0.5">
                    Cliente fictício (ilustrativo)
                  </p>
                </div>
              </div>
            </div>
          ))}
          <div className="pt-1">
            <WhatsappMockup />
          </div>
        </div>
      </div>

      {/* ── painel direito — formulário ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-5 py-8 md:px-10 md:py-12 max-w-lg mx-auto w-full md:max-w-none md:mx-0">

        {/* Mobile: logo */}
        <div className="flex items-center gap-2 mb-8 md:hidden">
          <div className="h-8 w-8 rounded-lg overflow-hidden">
            <Image src="/logo.png" alt="IBANK" width={200} height={200}
              className="h-full w-full object-cover" style={{ objectPosition: "50% 48%" }} />
          </div>
          <span className="font-bold text-base tracking-tight">IBANK</span>
        </div>

        {/* Barra de progresso */}
        {step < 4 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500 font-medium">Etapa {step + 1} de {TOTAL_STEPS - 1}</span>
              <span className="text-xs text-zinc-500 font-medium">{progress}%</span>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Conteúdo animado */}
        <div className={cn(
          "flex-1 flex flex-col transition-all duration-220",
          animating
            ? slideDir === "right" ? "-translate-x-8 opacity-0" : "translate-x-8 opacity-0"
            : "translate-x-0 opacity-100",
        )}>

          {/* ETAPA 0 — Nome */}
          {step === 0 && (
            <FormStep
              title="Olá! Como podemos te chamar?"
              subtitle="Vamos personalizar sua experiência com o IBANK."
            >
              <input
                ref={nomeRef}
                type="text"
                placeholder="Seu nome"
                value={lead.nome}
                onChange={(e) => setLead({ ...lead, nome: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && lead.nome.trim().length >= 2) goTo(1); }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3.5 text-base placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                autoComplete="given-name"
              />
              <NextButton disabled={lead.nome.trim().length < 2} onClick={() => goTo(1)}>
                Continuar
              </NextButton>
            </FormStep>
          )}

          {/* ETAPA 1 — WhatsApp */}
          {step === 1 && (
            <FormStep
              title={`Ótimo, ${lead.nome.split(" ")[0]}! Qual é o seu WhatsApp?`}
              subtitle="Usamos apenas para liberar seu acesso. Sem spam."
            >
              <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/30 transition-colors">
                <span className="px-4 text-zinc-500 text-sm font-medium border-r border-zinc-700 py-3.5 shrink-0">+55</span>
                <input
                  ref={waRef}
                  type="tel"
                  inputMode="numeric"
                  placeholder="(11) 99999-9999"
                  value={lead.whatsapp}
                  onChange={(e) => setLead({ ...lead, whatsapp: e.target.value.replace(/\D/g, "") })}
                  onKeyDown={(e) => { if (e.key === "Enter" && lead.whatsapp.length >= 10) goTo(2); }}
                  className="flex-1 bg-transparent px-4 py-3.5 text-base placeholder:text-zinc-600 focus:outline-none"
                  autoComplete="tel"
                  maxLength={11}
                />
              </div>
              <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                <Shield className="h-3 w-3" /> Seus dados ficam apenas conosco
              </p>
              <div className="flex gap-3 mt-2">
                <BackButton onClick={() => goTo(0, "left")} />
                <NextButton disabled={lead.whatsapp.length < 10} onClick={() => goTo(2)} className="flex-1">
                  Continuar
                </NextButton>
              </div>
            </FormStep>
          )}

          {/* ETAPA 2 — Objetivo */}
          {step === 2 && (
            <FormStep
              title="Qual é o seu principal objetivo?"
              subtitle="Isso define sua carteira ideal e como a ferramenta vai te ajudar."
            >
              <div className="flex flex-col gap-3">
                {GOAL_OPTIONS.map((g) => {
                  const Icon = g.icon;
                  const selected = lead.objetivo === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { setLead({ ...lead, objetivo: g.id }); setTimeout(() => goTo(3), 180); }}
                      className={cn(
                        "flex items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all duration-150 active:scale-[0.98]",
                        selected ? g.color : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-600",
                      )}
                    >
                      <Icon className={cn("h-5 w-5 shrink-0", selected ? "" : "text-zinc-500")} />
                      <div>
                        <p className={cn("text-sm font-semibold", selected ? "" : "text-zinc-200")}>{g.label}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{g.tagline}</p>
                      </div>
                      {selected && <Check className="h-4 w-4 ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <BackButton onClick={() => goTo(1, "left")} className="mt-2" />
            </FormStep>
          )}

          {/* ETAPA 3 — Aporte */}
          {step === 3 && (
            <FormStep
              title="Quanto você investe por mês hoje?"
              subtitle="Nos ajuda a entender em que fase você está. Não precisa ser exato."
            >
              <div className="flex flex-col gap-2">
                {APORTE_OPTIONS.map((a) => {
                  const selected = lead.aporte === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { setLead({ ...lead, aporte: a.id }); setTimeout(() => finalize(), 180); }}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-5 py-3.5 text-sm font-medium text-left transition-all duration-150 active:scale-[0.98]",
                        selected
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                          : "border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:border-zinc-600",
                      )}
                    >
                      <span>{a.label}</span>
                      {saving && selected
                        ? <span className="text-xs text-zinc-500 animate-pulse">Salvando…</span>
                        : selected && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <BackButton onClick={() => goTo(2, "left")} className="mt-2" />
            </FormStep>
          )}

          {/* ETAPA 4 — Preços */}
          {step === 4 && (
            <div className="flex-1 flex flex-col gap-5 animate-in fade-in slide-in-from-right-4 duration-300 pb-6">

              {/* Cabeçalho */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500 mb-2">
                  Perfeito, {lead.nome.split(" ")[0]}!
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
                  Escolha seu plano e comece hoje.
                </h2>
              </div>

              {/* ① Social proof */}
              <SocialProofBar />

              {/* ② Mockup do app — só mobile (desktop já tem no painel esquerdo) */}
              <div className="md:hidden flex justify-center py-2">
                <AppMockup />
              </div>

              {/* Features resumidas */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: TrendingUp,    label: "Carteira inteligente" },
                  { icon: Landmark,      label: "IR automático" },
                  { icon: CalendarCheck, label: "Proventos" },
                  { icon: BarChart2,     label: "Rentabilidade vs CDI" },
                  { icon: Wallet,        label: "Controle de cartão" },
                  { icon: Target,        label: "Metas e planejamento" },
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.label} className="flex items-center gap-2 text-xs text-zinc-400">
                      <Icon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {f.label}
                    </div>
                  );
                })}
              </div>

              {/* ③ FAQ */}
              <div className="rounded-2xl border border-zinc-800 overflow-hidden">
                <p className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
                  Perguntas frequentes
                </p>
                {FAQ_ITEMS.map((item, i) => (
                  <div key={i} className={cn("border-zinc-800", i < FAQ_ITEMS.length - 1 && "border-b")}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-zinc-900/40 transition-colors"
                    >
                      <span className="text-sm font-medium text-zinc-200">{item.q}</span>
                      <ChevronDown className={cn(
                        "h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200",
                        openFaq === i && "rotate-180",
                      )} />
                    </button>
                    {openFaq === i && (
                      <p className="px-4 pb-4 text-sm text-zinc-400 leading-relaxed">
                        {item.a}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* ④ Garantia */}
              <div className="flex gap-3 items-start bg-emerald-500/8 border border-emerald-500/25 rounded-2xl px-4 py-4">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <BadgeCheck className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-400">15 dias grátis — sem risco nenhum</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Acesso completo por 15 dias. Se não gostar, é só avisar pelo WhatsApp antes do período acabar.
                    <strong className="text-zinc-300"> Não cobramos nada. Sem contrato.</strong>
                  </p>
                </div>
              </div>

              {/* Planos */}
              <div className="flex flex-col gap-3">
                {/* Assinante */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-lg">Assinante</p>
                      <p className="text-xs text-zinc-500">App completo sem bot</p>
                      <span className="inline-block mt-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
                        15 dias grátis, após R$ 30/mês
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums shrink-0">
                      R$ 30<span className="text-sm font-medium text-zinc-500">/mês</span>
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-sm text-zinc-400">
                    {["Dashboard e cartão", "Planejamento e metas", "Investimentos e proventos", "IR e rentabilidade"].map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0" /> {t}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={whatsappUrl(lead, "assinante")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors touch-manipulation"
                  >
                    <MessageCircle className="h-4 w-4" /> Quero Assinante — R$ 30/mês
                  </a>
                </div>

                {/* Completo */}
                <div className="rounded-2xl border-2 border-violet-500/40 bg-zinc-900/60 p-5 space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-violet-500 text-[10px] font-bold text-white px-3 py-1 rounded-bl-xl tracking-wide">
                    RECOMENDADO
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-lg">Completo</p>
                      <p className="text-xs text-zinc-500">App + IBANK Bot com IA</p>
                      <span className="inline-block mt-1.5 text-[11px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/30 rounded-full px-2.5 py-0.5">
                        15 dias grátis, após R$ 45/mês
                      </span>
                    </div>
                    <p className="text-2xl font-bold tabular-nums shrink-0">
                      R$ 45<span className="text-sm font-medium text-zinc-500">/mês</span>
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-sm text-zinc-400">
                    {["Tudo do Assinante", "Bot de carteira e FIIs", "Pesquisa de mercado com IA", "Análise de ações em tempo real"].map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-violet-400 shrink-0" /> {t}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={whatsappUrl(lead, "completo")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors touch-manipulation"
                  >
                    <Bot className="h-4 w-4" /> Quero Completo — R$ 45/mês
                  </a>
                </div>
              </div>

              <p className="text-[11px] text-center text-zinc-600 leading-relaxed">
                Acesso liberado após confirmação do Pix. Estimativas de renda não são recomendação
                de investimento (CVM). Cancelamento a qualquer momento.
              </p>

              <div className="text-center">
                <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                  Já sou assinante — entrar
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Avatar ilustrativo (iniciais, não é foto de pessoa real) ─────────────────
function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div className={cn(
      "h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0",
      color
    )}>
      {initials}
    </div>
  );
}

// ── Social proof bar ──────────────────────────────────────────────────────────
function SocialProofBar() {
  return (
    <div className="grid grid-cols-3 gap-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <div className="flex flex-col items-center justify-center py-3.5 px-2 text-center border-r border-zinc-800">
        <Users className="h-4 w-4 text-emerald-400 mb-1" />
        <p className="text-base font-bold text-white leading-none">Exclusivo</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">acesso por convite</p>
      </div>
      <div className="flex flex-col items-center justify-center py-3.5 px-2 text-center border-r border-zinc-800">
        <Zap className="h-4 w-4 text-amber-400 mb-1" />
        <p className="text-base font-bold text-white leading-none">Suporte</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">direto via WhatsApp</p>
      </div>
      <div className="flex flex-col items-center justify-center py-3.5 px-2 text-center">
        <Lock className="h-4 w-4 text-violet-400 mb-1" />
        <p className="text-base font-bold text-white leading-none">Privado</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">só você acessa</p>
      </div>
    </div>
  );
}

// ── Mockup do app ─────────────────────────────────────────────────────────────
function WhatsappMockup() {
  return (
    <div className="w-48 shrink-0 mx-auto">
      <div className="border-2 border-zinc-700 rounded-[2rem] bg-zinc-950 p-1.5 shadow-2xl shadow-black/60">
        {/* Barra de status */}
        <div className="flex items-center justify-between px-4 py-1.5">
          <span className="text-[9px] text-zinc-500 font-medium">9:41</span>
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-1 w-1 rounded-full bg-zinc-600" />
            ))}
          </div>
        </div>

        {/* Tela do WhatsApp */}
        <div className="bg-[#0b141a] rounded-[1.5rem] overflow-hidden">
          {/* Header do contato */}
          <div className="flex items-center gap-2 bg-[#1f2c34] px-3 py-2">
            <ChevronLeft className="h-3.5 w-3.5 text-zinc-400" />
            <div className="h-6 w-6 rounded-full bg-emerald-600 flex items-center justify-center text-[8px] font-bold text-white">
              IB
            </div>
            <div>
              <p className="text-[9px] font-semibold text-zinc-100">IBANK Suporte</p>
              <p className="text-[7px] text-emerald-400">online</p>
            </div>
          </div>

          {/* Mensagens */}
          <div className="px-2.5 py-3 space-y-2 min-h-[180px]">
            <div className="flex justify-start">
              <div className="bg-[#1f2c34] rounded-lg rounded-tl-none px-2.5 py-1.5 max-w-[80%]">
                <p className="text-[8px] text-zinc-200 leading-relaxed">
                  Oi! Consegui organizar tudo minha carteira e o cartão no mesmo lugar 🙌
                </p>
                <p className="text-[6px] text-zinc-500 text-right mt-0.5">09:12</p>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="bg-[#1f2c34] rounded-lg rounded-tl-none px-2.5 py-1.5 max-w-[80%]">
                <p className="text-[8px] text-zinc-200 leading-relaxed">
                  Muito obrigada pela ajuda, era exatamente isso que eu precisava!
                </p>
                <p className="text-[6px] text-zinc-500 text-right mt-0.5">09:13</p>
              </div>
            </div>
            <div className="flex justify-end">
              <div className="bg-[#005c4b] rounded-lg rounded-tr-none px-2.5 py-1.5 max-w-[80%]">
                <p className="text-[8px] text-zinc-100 leading-relaxed">
                  Que bom saber! Qualquer coisa é só chamar 😊
                </p>
                <p className="text-[6px] text-emerald-200/70 text-right mt-0.5">09:14 ✓✓</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[7px] text-center text-zinc-600 mt-1.5">Conversa fictícia (ilustrativo)</p>
    </div>
  );
}

function AppMockup() {
  return (
    <div className="w-48 shrink-0">
      {/* Frame do celular */}
      <div className="border-2 border-zinc-700 rounded-[2rem] bg-zinc-950 p-1.5 shadow-2xl shadow-black/60">
        {/* Barra de status */}
        <div className="flex items-center justify-between px-4 py-1.5">
          <span className="text-[9px] text-zinc-500 font-medium">9:41</span>
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-1 w-1 rounded-full bg-zinc-600" />
            ))}
          </div>
        </div>

        {/* Conteúdo da tela */}
        <div className="bg-zinc-900 rounded-[1.5rem] overflow-hidden px-3 py-3 space-y-3">
          {/* Header do app */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-lg overflow-hidden">
                <Image src="/logo.png" alt="IBANK" width={40} height={40}
                  className="h-full w-full object-cover" style={{ objectPosition: "50% 48%" }} />
              </div>
              <span className="text-[10px] font-bold text-zinc-100">IBANK</span>
            </div>
            <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-[7px] font-bold text-white">I</span>
            </div>
          </div>

          {/* Patrimônio */}
          <div className="bg-zinc-800/60 rounded-xl px-3 py-2.5">
            <p className="text-[8px] text-zinc-500">Patrimônio total</p>
            <p className="text-sm font-bold text-blue-400 tabular-nums">R$ 12.450,00</p>
            <p className="text-[8px] text-zinc-600 mt-0.5">renda fixa + ações</p>
          </div>

          {/* Barra de alocação */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-zinc-500">Alocação atual</span>
              <span className="text-[8px] text-emerald-400">68% RF</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
              <div className="bg-emerald-500 rounded-l-full" style={{ width: "68%" }} />
              <div className="bg-blue-500 rounded-r-full flex-1" />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[7px] text-zinc-600">Renda Fixa</span>
              <span className="text-[7px] text-zinc-600">Ações</span>
            </div>
          </div>

          {/* Ativos */}
          <div className="space-y-1.5">
            {[
              { name: "TURBO", sub: "Nubank", val: "R$ 5.110", color: "text-green-400" },
              { name: "MXRF11", sub: "FII",   val: "R$ 3.240", color: "text-green-400" },
              { name: "PETR4",  sub: "Ação",  val: "R$ 2.100", color: "text-blue-400" },
            ].map((a) => (
              <div key={a.name} className="flex items-center justify-between bg-zinc-800/40 rounded-lg px-2 py-1.5">
                <div>
                  <p className="text-[9px] font-bold text-zinc-200">{a.name}</p>
                  <p className="text-[7px] text-zinc-600">{a.sub}</p>
                </div>
                <p className={cn("text-[9px] font-semibold tabular-nums", a.color)}>{a.val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-center text-zinc-600 mt-2">Dados ilustrativos</p>
    </div>
  );
}

// ── sub-componentes ───────────────────────────────────────────────────────────
function FormStep({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col gap-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-white">{title}</h1>
        <p className="text-zinc-400 text-sm mt-2 leading-relaxed">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function NextButton({ children, disabled, onClick, className }: {
  children: React.ReactNode; disabled?: boolean; onClick: () => void; className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all duration-150 touch-manipulation",
        "bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.98]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600",
        className,
      )}
    >
      {children} <ArrowRight className="h-4 w-4" />
    </button>
  );
}

function BackButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-1", className)}
    >
      <ChevronLeft className="h-4 w-4" /> Voltar
    </button>
  );
}
