"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBottomTabs, isNavItemActive } from "@/lib/nav";

const TABS = getBottomTabs().map((item) => ({
  href: item.href,
  label: item.href === "/" ? "Início" : item.href === "/planejamento" ? "Plano" : item.href === "/investimentos" ? "Investir" : item.label,
  icon: item.icon,
}));

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
          const active = isNavItemActive(pathname, tab.href);
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
