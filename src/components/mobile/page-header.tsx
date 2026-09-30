"use client";

import { cn } from "@/lib/utils";
import { PAGE_CONTENT, PAGE_WIDTH, type PageBodyWidth } from "@/components/mobile/page-shell";

/** A linha divisória vai de ponta a ponta; título e ações seguem a largura do PageBody (`width`). */
export function PageHeader({
  title,
  description,
  actions,
  sticky,
  bordered = true,
  width = "default",
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  sticky?: boolean;
  /** Separador inferior (padrão do app). */
  bordered?: boolean;
  width?: PageBodyWidth;
  className?: string;
}) {
  return (
    <div
      className={cn(
        bordered && "border-b",
        sticky && "sticky top-0 z-10 bg-background/95 backdrop-blur",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pt-4 pb-3",
          width === "full" ? PAGE_CONTENT : PAGE_WIDTH[width],
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
    </div>
  );
}
