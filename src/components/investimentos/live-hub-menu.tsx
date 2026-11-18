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
  /** `desktop` = composição wide; `stack` = coluna do app (padrão). */
  variant?: "stack" | "desktop";
  className?: string;
};

function HubPrimario({
  icon: Icon,
  label,
  descricao,
  index,
  onClick,
  size = "stack",
}: {
  icon: IconComp;
  label: string;
  descricao: string;
  index: number;
  onClick: () => void;
  size?: "stack" | "desktop";
}) {
  const prefersReduced = useReducedMotion();
  const desktop = size === "desktop";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={prefersReduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      whileTap={prefersReduced ? undefined : { scale: 0.98 }}
      className={cn(
        "flex w-full items-center text-left transition-colors",
        FOCUS,
        desktop
          ? "min-h-[112px] gap-5 rounded-2xl border border-foreground/20 bg-foreground px-6 py-5 text-background hover:bg-foreground/90"
          : "min-h-[92px] gap-4 rounded-2xl border border-[#3A3A3A] bg-card px-4 py-4 hover:bg-muted/30",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center",
          desktop
            ? "h-[72px] w-[72px] rounded-[20px] bg-background/10"
            : "h-16 w-16 rounded-[18px] bg-[#1A1A1A]",
        )}
      >
        <Icon
          className={cn(desktop ? "h-8 w-8 text-background" : "h-7 w-7 text-foreground")}
          aria-hidden="true"
        />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span
          className={cn(
            "block font-semibold leading-5",
            desktop ? "text-lg text-background" : "text-base text-foreground",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "block text-[12px] leading-4",
            desktop ? "text-background/70" : "text-muted-foreground",
          )}
        >
          {descricao}
        </span>
      </span>
      <ChevronRight
        className={cn(
          "shrink-0",
          desktop ? "h-5 w-5 text-background" : "h-[18px] w-[18px] text-foreground",
        )}
        aria-hidden="true"
      />
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
  size = "stack",
}: {
  icon: IconComp;
  label: string;
  descricao: string;
  badge?: string;
  index: number;
  onClick: () => void;
  size?: "stack" | "desktop";
}) {
  const prefersReduced = useReducedMotion();
  const desktop = size === "desktop";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={prefersReduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      whileTap={prefersReduced ? undefined : { scale: 0.98 }}
      className={cn(
        "flex w-full items-center text-left transition-colors hover:bg-muted/30",
        FOCUS,
        desktop
          ? "min-h-[88px] flex-col items-stretch gap-3 rounded-xl border border-border bg-card p-4"
          : "min-h-[68px] gap-3.5 rounded-[14px] border border-border bg-card px-3.5 py-3",
      )}
    >
      <span className={cn("flex items-center", desktop ? "w-full justify-between gap-3" : "contents")}>
        <span
          className={cn(
            "flex shrink-0 items-center justify-center bg-[#1A1A1A]",
            desktop ? "h-12 w-12 rounded-[14px]" : "h-[52px] w-[52px] rounded-full",
          )}
        >
          <Icon className={cn(desktop ? "h-5 w-5" : "h-6 w-6", "text-foreground")} aria-hidden="true" />
        </span>
        {desktop ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : null}
      </span>
      <span className={cn("min-w-0", desktop ? "space-y-1" : "flex-1 space-y-0.5")}>
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("font-semibold text-foreground", desktop ? "text-[15px]" : "text-sm")}>
            {label}
          </span>
          {badge ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="block text-[12px] text-muted-foreground">{descricao}</span>
      </span>
      {!desktop ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
    </motion.button>
  );
}

/**
 * Hub de Investir — stack = coluna do app Android; desktop = patrimônio + ações em wide.
 */
export function LiveHubMenu({
  patrimonio,
  rendaMensal = 0,
  rebalancePendentes = 0,
  onSelect,
  variant = "stack",
  className,
}: LiveHubMenuProps) {
  const pendentes = rebalancePendentes > 0 ? rebalancePendentes : 0;
  const badge =
    pendentes > 0 ? `${pendentes} pendente${pendentes === 1 ? "" : "s"}` : undefined;
  const rebalanceDesc =
    pendentes > 0 ? "Alocação fora da referência" : "Ajuste a alocação ao perfil";
  const desktop = variant === "desktop";

  const secondary = (
    <>
      <HubLinha
        index={1}
        icon={Wallet}
        label="Carteira"
        descricao="Contas, ações, FIIs e caixinhas"
        size={desktop ? "desktop" : "stack"}
        onClick={() => onSelect("investimentos")}
      />
      <HubLinha
        index={2}
        icon={Scale}
        label="Rebalancear"
        descricao={rebalanceDesc}
        badge={badge}
        size={desktop ? "desktop" : "stack"}
        onClick={() => onSelect("rebalancear")}
      />
      <HubLinha
        index={3}
        icon={Calculator}
        label="Simulador"
        descricao="Simule aportes e metas"
        size={desktop ? "desktop" : "stack"}
        onClick={() => onSelect("simular")}
      />
    </>
  );

  if (desktop) {
    return (
      <nav
        aria-label="Investir"
        className={cn(
          "mx-auto grid w-full max-w-5xl gap-10 px-8 py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:items-end lg:gap-14",
          className,
        )}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Aplique, acompanhe a carteira e simule.
            </p>
            <p className={cn(MONEY, "text-5xl leading-none tracking-tight xl:text-[3.5rem]")}>
              {formatCurrency(patrimonio)}
            </p>
            {rendaMensal > 0.005 ? (
              <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400">
                Renda estimada {formatCurrency(rendaMensal)} / mês
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Patrimônio investido e em conta</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <HubPrimario
            index={0}
            icon={TrendingUp}
            label="Aplicar agora"
            descricao="Tesouro, CDB, ações, FIIs e ETFs"
            size="desktop"
            onClick={() => onSelect("aplicar")}
          />
          <div className="grid gap-3 sm:grid-cols-3">{secondary}</div>
        </div>
      </nav>
    );
  }

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
        {secondary}
      </div>
    </nav>
  );
}
