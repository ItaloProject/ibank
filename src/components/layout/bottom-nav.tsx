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
  featured: item.featured ?? false,
}));

/** Abas de página + Mais. */
const COLUMNS = TABS.length + 1;

const ITEM =
  "relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium leading-none " +
  "touch-manipulation transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

export function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
      aria-label="Navegação principal"
    >
      <div
        className="mx-auto grid h-[var(--bottom-nav-h)] max-w-lg"
        style={{
          gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
          paddingLeft: "var(--safe-left)",
          paddingRight: "var(--safe-right)",
        }}
      >
        {TABS.map((tab) => {
          const active = isNavItemActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                ITEM,
                "overflow-hidden",
                active ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <span aria-hidden className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-foreground" />
              )}
              {tab.featured && !active && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 animate-[sidebar-sweep_4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent skew-x-[-15deg] motion-reduce:hidden"
                />
              )}
              <span className="relative">
                <Icon className={cn("h-5 w-5", active && "stroke-[2.25px]")} />
                {tab.featured && (
                  <span className="absolute -top-[3px] -right-[3px] flex h-[7px] w-[7px]">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-70 motion-reduce:hidden" />
                    <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-amber-400" />
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          aria-label="Mais páginas"
          aria-haspopup="dialog"
          className={cn(ITEM, "text-muted-foreground hover:text-foreground")}
        >
          <Menu className="h-5 w-5" />
          <span className="max-w-full truncate">Mais</span>
        </button>
      </div>
    </nav>
  );
}
