"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, TrendingUp, Landmark } from "lucide-react";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";

const profiles = [
  {
    id: "aposentadoria",
    label: "Aposentadoria",
    icon: Landmark,
    tagline: "Construir patrimônio para o futuro",
    color: "text-blue-500",
    borderActive: "border-blue-500",
    bgActive: "bg-blue-50 dark:bg-blue-950/30",
    sections: [
      { label: "HORIZONTE", items: ["Longo prazo (10, 20 ou 30 anos)"] },
      { label: "ESTRATÉGIA", items: ["Ativos de crescimento", "Aportes regulares", "Reinvestimento dos rendimentos"] },
      { label: "ATIVOS", items: ["Ações", "FIIs", "Tesouro IPCA+"] },
      { label: "DASHBOARD VAI MOSTRAR", items: ["Aporte mensal", "Patrimônio acumulado", "Tempo estimado para a meta", "Simulação de juros compostos"] },
    ],
  },
  {
    id: "renda_mensal",
    label: "Renda Mensal",
    icon: TrendingUp,
    tagline: "Gerar renda passiva todo mês",
    color: "text-emerald-500",
    borderActive: "border-emerald-500",
    bgActive: "bg-emerald-50 dark:bg-emerald-950/30",
    sections: [
      { label: "HORIZONTE", items: ["Curto / médio prazo"] },
      { label: "ESTRATÉGIA", items: ["Geração de proventos constantes", "Viver de renda passiva"] },
      { label: "ATIVOS", items: ["Ações pagadoras de dividendos", "FIIs", "CDBs e Renda Fixa"] },
      { label: "DASHBOARD VAI MOSTRAR", items: ["Renda passiva do mês", "Yield médio da carteira", "Proventos recebidos vs. meta", "Histórico de pagamentos"] },
    ],
  },
];

export function ProfileSelectScreen() {
  const { user, setProfile } = useUser();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSelect(profileId: string) {
    setLoading(profileId);
    await setProfile(profileId);
    setLoading(null);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl overflow-hidden mb-4 shadow-md">
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
          <h1 className="text-2xl font-bold tracking-tight">Olá, {user?.name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm mt-1 text-center">
            Qual é o seu objetivo principal com os investimentos?
          </p>
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-3">
          {profiles.map((p) => {
            const Icon = p.icon;
            const isOpen = expanded === p.id;
            return (
              <div
                key={p.id}
                className={cn(
                  "border rounded-xl overflow-hidden transition-all duration-200",
                  isOpen ? p.borderActive : "border-border",
                  isOpen ? p.bgActive : "bg-card",
                )}
              >
                {/* Header row */}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : p.id)}
                  className="w-full flex items-center gap-3 px-4 py-4 text-left"
                >
                  <div className={cn("shrink-0", p.color)}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{p.tagline}</div>
                  </div>
                  <div className="shrink-0 text-muted-foreground">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Expanded sections */}
                {isOpen && (
                  <div className="px-4 pb-4 flex flex-col gap-3">
                    {p.sections.map((s) => (
                      <div key={s.label}>
                        <span className={cn("text-[10px] font-bold tracking-widest", p.color)}>
                          {s.label}
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {s.items.map((item) => (
                            <span
                              key={item}
                              className="text-xs bg-muted text-foreground rounded-full px-2.5 py-0.5"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={loading !== null}
                      onClick={() => handleSelect(p.id)}
                      className={cn(
                        "w-full py-2.5 rounded-lg text-sm font-semibold transition-colors mt-1",
                        "bg-foreground text-background hover:opacity-90 active:opacity-80",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                    >
                      {loading === p.id ? "Salvando..." : `Escolher ${p.label}`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Você poderá alterar seu perfil nas configurações a qualquer momento.
        </p>
      </div>
    </div>
  );
}
