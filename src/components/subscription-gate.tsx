"use client";

import Image from "next/image";
import { MessageCircle, LogOut } from "lucide-react";
import { useUser } from "@/context/user-context";

function whatsappUrl() {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP ?? "5500000000000";
  const phone = raw.replace(/\D/g, "");
  const text = encodeURIComponent(
    "Olá! Quero renovar / assinar o IBANK (R$ 30/mês ou R$ 45 com Bot).",
  );
  return `https://wa.me/${phone}?text=${text}`;
}

export function SubscriptionGate() {
  const { user, logout } = useUser();

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 safe-pt safe-pb">
      <div className="h-16 w-16 rounded-2xl overflow-hidden mb-5">
        <Image
          src="/logo.png"
          alt="IBANK"
          width={200}
          height={200}
          className="h-full w-full object-cover"
          style={{ objectPosition: "50% 48%" }}
          priority
        />
      </div>
      <h1 className="text-xl font-bold text-center">Assinatura necessária</h1>
      <p className="text-sm text-muted-foreground text-center mt-2 max-w-sm">
        Olá{user?.name ? `, ${user.name}` : ""}. Seu acesso está expirado ou ainda não foi
        liberado. Fale conosco no WhatsApp para assinar (R$ 30/mês) ou renovar.
      </p>
      <a
        href={whatsappUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3.5 min-h-12 text-sm font-semibold text-white hover:bg-green-700 touch-manipulation"
      >
        <MessageCircle className="h-4 w-4" />
        Assinar / renovar no WhatsApp
      </a>
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Assinante R$ 30 · Bot opcional +R$ 15 · Total R$ 45
      </p>
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
