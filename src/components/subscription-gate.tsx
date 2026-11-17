"use client";

import { useState } from "react";
import { BrandLockup } from "@/components/brand-lockup";
import { MessageCircle, LogOut, Sparkles } from "lucide-react";
import { useUser } from "@/context/user-context";

function whatsappUrl() {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP ?? "5500000000000";
  const phone = raw.replace(/\D/g, "");
  const text = encodeURIComponent(
    "Olá! Quero renovar / assinar o MUVO (R$ 30/mês ou R$ 35 com Bot).",
  );
  return `https://wa.me/${phone}?text=${text}`;
}

export function SubscriptionGate() {
  const { user, login, logout } = useUser();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const teste = user?.plan === "teste";

  async function continuarGratis() {
    setBusy(true);
    setErro(null);
    try {
      const res = await fetch("/api/account/continuar-gratis", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Não foi possível ativar o plano grátis.");
        return;
      }
      if (data.user) login(data.user);
    } catch {
      setErro("Falha de rede. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 safe-pt safe-pb">
      <div className="mb-6">
        <BrandLockup className="h-11" priority />
      </div>
      <h1 className="text-xl font-bold text-center">
        {teste ? "Seu teste grátis terminou" : "Escolha como continuar"}
      </h1>
      <p className="text-sm text-muted-foreground text-center mt-2 max-w-sm">
        Olá{user?.name ? `, ${user.name}` : ""}.{" "}
        {teste
          ? `Os 3 dias de teste acabaram. ${
              user?.dataExclusao
                ? `Se não continuar, seus dados ficam guardados até ${new Date(user.dataExclusao).toLocaleDateString("pt-BR")}.`
                : "Seus dados continuam guardados."
            }`
          : "Seu acesso pago expirou. Você pode seguir no Muvo Grátis (com limites) ou assinar de novo."}
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => void continuarGratis()}
        className="mt-6 inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3.5 min-h-12 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 touch-manipulation disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {busy ? "Ativando…" : "Continuar grátis (com limites)"}
      </button>
      <p className="text-[11px] text-muted-foreground text-center mt-2 max-w-sm leading-relaxed">
        Plano gratuito permanente: planejamento e investimentos básicos.
        Bot, IA de mercado e IR completo ficam nos planos pagos.
      </p>

      <a
        href={whatsappUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3.5 min-h-12 text-sm font-semibold text-white hover:bg-green-700 touch-manipulation"
      >
        <MessageCircle className="h-4 w-4" />
        Assinar no WhatsApp — a partir de R$ 30
      </a>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Assinante R$ 30 · Completo (app + bot) R$ 35
      </p>

      {erro && <p className="text-sm text-red-400 mt-3 text-center">{erro}</p>}

      <button
        type="button"
        onClick={() => void logout()}
        className="mt-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </div>
  );
}
