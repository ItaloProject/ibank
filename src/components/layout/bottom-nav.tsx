"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CreditCard, TrendingUp, CalendarDays, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Início", icon: Home, match: (p: string) => p === "/" },
  { href: "/cartao", label: "Cartão", icon: CreditCard, match: (p: string) => p.startsWith("/cartao") },
  { href: "/investimentos", label: "Investir", icon: TrendingUp, match: (p: string) => p.startsWith("/investimentos") },
  { href: "/planejamento", label: "Plano", icon: CalendarDays, match: (p: string) => p.startsWith("/planejamento") },
] as const;

export function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Navegação principal"
    >
      <div
        className="grid grid-cols-5 h-[var(--bottom-nav-h)]"
        style={{ paddingLeft: "var(--safe-left)", paddingRight: "var(--safe-right)" }}
      >
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                "touch-manipulation min-h-[44px]",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.25px]")} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground touch-manipulation min-h-[44px]"
        >
          <Menu className="h-5 w-5" />
          <span>Mais</span>
        </button>
      </div>
    </nav>
  );
}
