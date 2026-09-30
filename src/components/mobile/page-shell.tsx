"use client";

import { cn } from "@/lib/utils";

/** Largura máxima do conteúdo das páginas (a mesma de Metas), centralizada em telas grandes. */
export const PAGE_CONTENT = "mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8";

export const PAGE_WIDTH = {
  /** Padrão do app: conteúdo limitado e centralizado */
  default: PAGE_CONTENT,
  /** Formulários / configs */
  narrow: "mx-auto w-full max-w-lg px-4 sm:px-6",
  /** Relatórios de investimento, IR, rebalancear */
  medium: "mx-auto w-full max-w-3xl px-4 sm:px-6",
  /** Listas admin */
  cozy: "mx-auto w-full max-w-2xl px-4 sm:px-6",
  /** Vídeos / grade ampla */
  wide: PAGE_CONTENT,
  /** Faixas de ponta a ponta; cada faixa limita o próprio conteúdo com PAGE_CONTENT */
  full: "w-full",
} as const;

export type PageBodyWidth = keyof typeof PAGE_WIDTH;

/** Área de conteúdo abaixo do PageHeader — padding e largura unificados. */
export function PageBody({
  children,
  width = "default",
  className,
}: {
  children: React.ReactNode;
  width?: PageBodyWidth;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-5 sm:space-y-6 pt-4 pb-2",
        PAGE_WIDTH[width],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Container de página autenticada. */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col min-h-full pb-6 sm:pb-8", className)}>
      {children}
    </div>
  );
}
