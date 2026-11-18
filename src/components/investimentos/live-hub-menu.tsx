"use client";

import type { ComponentType, SVGProps } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Calculator, ChevronRight, Scale, TrendingUp, Wallet } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { FOCUS, MONEY } from "./live-ui";

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

export type LiveHubDestination =
  | "aplicar"
  | "investimentos"
  | "rebalancear"
  | "simular";

type LiveHubMenuProps = {
  patrimonio: number;
  rendaMensal?: number;
  rebalancePendentes?: number;
  onSelect: (destino: LiveHubDestination) => void;
  className?: string;
};

function HubPrimario({
  icon: Icon,
  label,
  descricao,
  index,
  onClick,
}: {
  icon: IconComp;
  label: string;
  descricao: string;
  index: number;
  onClick: () => void;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={prefersReduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      whileTap={prefersReduced ? undefined : { scale: 0.98 }}
      className={cn(
        "flex w-full min-h-[92px] items-center gap-4 rounded-2xl border border-[#3A3A3A] bg-card px-4 py-4 text-left transition-colors hover:bg-muted/30",
        FOCUS,
      )}
    >
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-[#1A1A1A]">
        <Icon className="h-7 w-7 text-foreground" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-base font-semibold leading-5 text-foreground">{label}</span>
        <span className="block text-[12px] leading-4 text-muted-foreground">{descricao}</span>
      </span>
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-foreground" aria-hidden="true" />
    </motion.button>
  );
}

function HubLinha({
  icon: Icon,
  label,
  descricao,
  badge,
  index,
  onClick,
}: {
  icon: IconComp;
  label: string;
  descricao: string;
  badge?: string;
  index: number;
  onClick: () => void;
}) {
  const prefersReduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={prefersReduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      whileTap={prefersReduced ? undefined : { scale: 0.98 }}
      className={cn(
        "flex w-full min-h-[68px] items-center gap-3.5 rounded-[14px] border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-muted/30",
        FOCUS,
      )}
    >
      <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#1A1A1A]">
        <Icon className="h-6 w-6 text-foreground" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {badge ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="block text-[12px] text-muted-foreground">{descricao}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </motion.button>
  );
}

/**
 * Hub de Investir — mesmo desenho do app Android:
 * título, patrimônio, Aplicar agora em destaque e linhas Carteira / Rebalancear / Simulador.
 */
export function LiveHubMenu({
  patrimonio,
  rendaMensal = 0,
  rebalancePendentes = 0,
  onSelect,
  className,
}: LiveHubMenuProps) {
  const pendentes = rebalancePendentes > 0 ? rebalancePendentes : 0;

  return (
    <nav
      aria-label="Investir"
      className={cn("mx-auto w-full max-w-xl space-y-5 px-5 py-6 sm:px-7 sm:py-8", className)}
    >
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          Investir
        </h1>
        <p className="text-sm text-muted-foreground">
          Aplique, acompanhe a carteira e simule.
        </p>
      </div>

      <div className="space-y-1.5">
        <p className={cn(MONEY, "text-[34px] leading-none tracking-tight")}>
          {formatCurrency(patrimonio)}
        </p>
        {rendaMensal > 0.005 ? (
          <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400">
            Renda estimada {formatCurrency(rendaMensal)} / mês
          </p>
        ) : null}
      </div>

      <div className="space-y-2.5">
        <HubPrimario
          index={0}
          icon={TrendingUp}
          label="Aplicar agora"
          descricao="Tesouro, CDB, ações, FIIs e ETFs"
          onClick={() => onSelect("aplicar")}
        />
        <HubLinha
          index={1}
          icon={Wallet}
          label="Carteira"
          descricao="Contas, ações, FIIs e caixinhas"
          onClick={() => onSelect("investimentos")}
        />
        <HubLinha
          index={2}
          icon={Scale}
          label="Rebalancear"
          descricao={pendentes > 0 ? "Alocação fora da referência" : "Ajuste a alocação ao perfil"}
          badge={pendentes > 0 ? `${pendentes} pendente${pendentes === 1 ? "" : "s"}` : undefined}
          onClick={() => onSelect("rebalancear")}
        />
        <HubLinha
          index={3}
          icon={Calculator}
          label="Simulador"
          descricao="Simule aportes e metas"
          onClick={() => onSelect("simular")}
        />
      </div>
    </nav>
  );
}
