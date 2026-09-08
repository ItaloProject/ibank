"use client";

import { cn } from "@/lib/utils";

export function MobileListRow({
  leading,
  title,
  subtitle,
  value,
  actions,
  onClick,
  className,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left border-b border-border/60 last:border-b-0",
        onClick && "active:bg-muted/50 transition-colors",
        className,
      )}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{title}</div>
        {subtitle ? (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</div>
        ) : null}
      </div>
      {value != null ? (
        <div className="shrink-0 text-sm font-semibold tabular-nums text-right">{value}</div>
      ) : null}
      {actions ? (
        <div className="flex items-center gap-0.5 shrink-0 -mr-1">{actions}</div>
      ) : null}
    </Comp>
  );
}
