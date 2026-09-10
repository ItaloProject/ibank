"use client";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  sticky,
  bordered = true,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  sticky?: boolean;
  /** Separador inferior (padrão do app). */
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        "px-4 sm:px-6 lg:px-8 pt-4 pb-3",
        bordered && "border-b",
        sticky && "sticky top-0 z-10 bg-background/95 backdrop-blur",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight truncate">
          {title}
        </h1>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}
