"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBottomTabs, isNavItemActive } from "@/lib/nav";
import { useTheme } from "@/components/theme-provider";

const TABS = getBottomTabs().map((item) => ({
  href: item.href,
  label: item.href === "/" ? "Início" : item.href === "/planejamento" ? "Plano" : item.href === "/investimentos" ? "Investir" : item.label,
  icon: item.icon,
  featured: item.featured ?? false,
}));

export function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Navegação principal"
    >
      <div
        className="grid grid-cols-6 h-[var(--bottom-nav-h)]"
        style={{ paddingLeft: "var(--safe-left)", paddingRight: "var(--safe-right)" }}
      >
        {TABS.map((tab) => {
          const active = isNavItemActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                "touch-manipulation min-h-[44px] overflow-hidden",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {/* shimmer sweep — apenas featured, inativo */}
              {tab.featured && !active && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 animate-[sidebar-sweep_4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent skew-x-[-15deg]"
                />
              )}
              {/* ícone com amber dot pulsante */}
              <span className="relative">
                <Icon className={cn("h-5 w-5", active && "stroke-[2.25px]")} />
                {tab.featured && (
                  <span className="absolute -top-[3px] -right-[3px] flex h-[7px] w-[7px]">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-70" />
                    <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-amber-400" />
                  </span>
                )}
              </span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground touch-manipulation min-h-[44px] transition-colors"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span>Tema</span>
        </button>
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
