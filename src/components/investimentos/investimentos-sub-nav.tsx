"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/investimentos", label: "Visão geral", exact: true },
  { href: "/investimentos/contas", label: "Contas" },
  { href: "/investimentos/acoes", label: "Ações" },
];

export function InvestimentosSubNav() {
  const pathname = usePathname();

  return (
    <div className="border-b px-4 sm:px-6 lg:px-8">
      <nav className="flex gap-1 overflow-x-auto scrollbar-none -mb-px" aria-label="Seções de investimentos">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "shrink-0 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-colors touch-manipulation min-h-11 inline-flex items-center",
                active
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
