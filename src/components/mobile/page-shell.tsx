"use client";

import { cn } from "@/lib/utils";

const WIDTH = {
  /** Conteúdo full-bleed com padding padrão do app */
  default: "px-4 sm:px-6 lg:px-8",
  /** Formulários / configs */
  narrow: "max-w-lg mx-auto px-4 sm:px-6",
  /** Relatórios de investimento, IR, rebalancear */
  medium: "max-w-3xl mx-auto px-4 sm:px-6",
  /** Listas admin */
  cozy: "max-w-2xl mx-auto px-4 sm:px-6",
  /** Vídeos / grade ampla */
  wide: "max-w-5xl mx-auto px-4 sm:px-6 lg:px-8",
} as const;

export type PageBodyWidth = keyof typeof WIDTH;

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
        WIDTH[width],
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
