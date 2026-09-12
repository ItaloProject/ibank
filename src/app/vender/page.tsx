"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, MessageCircle, Bot, TrendingUp, Wallet, Smartphone } from "lucide-react";

function whatsappUrl(plan: "assinante" | "completo") {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP ?? "5500000000000";
  const phone = raw.replace(/\D/g, "");
  const label = plan === "completo"
    ? "Completo R$ 45 (app + bot)"
    : "Assinante R$ 30";
  const text = encodeURIComponent(
    `Olá! Quero assinar o MUVO — plano ${label}. Pode me passar o Pix e liberar o acesso?`,
  );
  return `https://wa.me/${phone}?text=${text}`;
}

export default function VenderPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground safe-pt safe-pb">
      <div className="mx-auto max-w-lg px-5 py-10 space-y-10">
        <header className="flex flex-col items-center text-center gap-3">
          <div className="h-16 w-16 rounded-2xl overflow-hidden">
            <Image
              src="/logo.png"
              alt="MUVO"
              width={200}
              height={200}
              className="h-full w-full object-cover"
              style={{ objectPosition: "50% 48%" }}
              priority
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">MUVO</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1 leading-tight">
              Ferramenta para quem investe
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Organize carteira, cartão, renda passiva e metas num só lugar — no celular.
            </p>
          </div>
        </header>

        <section className="grid gap-3">
          {[
            { icon: Wallet, text: "Cartão, planejamento e entrada/saída" },
            { icon: TrendingUp, text: "Investimentos, FIIs, ações e renda passiva" },
            { icon: Bot, text: "Bot opcional com pesquisa de mercado" },
            { icon: Smartphone, text: "PWA no celular — acesso por pedido" },
          ].map((item) => (
            <div key={item.text} className="flex items-start gap-3 rounded-xl border px-4 py-3">
              <item.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Planos</h2>

          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="font-bold text-lg">Assinante</p>
                <p className="text-xs text-muted-foreground">App completo sem bot</p>
              </div>
              <p className="text-2xl font-bold tabular-nums">R$ 30<span className="text-sm font-medium text-muted-foreground">/mês</span></p>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {["Dashboard e cartão", "Planejamento e metas", "Investimentos e proventos"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" /> {t}
                </li>
              ))}
            </ul>
            <a
              href={whatsappUrl("assinante")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 min-h-12 text-sm font-semibold text-white hover:bg-green-700 touch-manipulation"
            >
              <MessageCircle className="h-4 w-4" /> Pedir Assinante
            </a>
          </div>

          <div className="rounded-2xl border-2 border-violet-500/40 bg-card p-5 space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="font-bold text-lg">Completo</p>
                <p className="text-xs text-muted-foreground">App + MUVO Bot</p>
              </div>
              <p className="text-2xl font-bold tabular-nums">R$ 45<span className="text-sm font-medium text-muted-foreground">/mês</span></p>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {["Tudo do Assinante", "Bot de carteira e FIIs", "Pesquisa de mercado"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-violet-500" /> {t}
                </li>
              ))}
            </ul>
            <a
              href={whatsappUrl("completo")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3.5 min-h-12 text-sm font-semibold text-white hover:bg-violet-500 touch-manipulation"
            >
              <Bot className="h-4 w-4" /> Pedir Completo
            </a>
          </div>
        </section>

        <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
          Venda por pedido: você solicita no WhatsApp, paga via Pix e recebe login no app hospedado na Vercel.
          Estimativas de renda não são recomendação de investimento (CVM).
        </p>

        <div className="text-center">
          <Link href="/" className="text-sm text-primary hover:underline">
            Já sou assinante — entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
