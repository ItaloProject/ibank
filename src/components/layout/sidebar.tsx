"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, CreditCard, TrendingUp, BarChart2, CalendarDays,
  CalendarCheck, Repeat2, Receipt, LogOut, ChevronLeft, X,
  Sun, Moon, Users, Target, Settings, Landmark, LineChart, Scale,
} from "lucide-react";
import Image from "next/image";
import { useUser } from "@/context/user-context";
import { USERS } from "@/lib/user";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { useState, useEffect } from "react";

const NAV_GROUPS = [
  {
    id: "investimentos",
    label: "Investimentos",
    accent: true,
    items: [
      { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
      { href: "/rentabilidade", label: "Rentabilidade", icon: LineChart },
      { href: "/rebalancear",   label: "Rebalancear",   icon: Scale },
      { href: "/proventos",     label: "Proventos",     icon: CalendarCheck },
      { href: "/impostos",      label: "Imposto de Renda", icon: Landmark },
      { href: "/metas",         label: "Metas",         icon: Target },
    ],
  },
  {
    id: "financas",
    label: "Finanças",
    accent: false,
    items: [
      { href: "/",               label: "Dashboard",      icon: Home },
      { href: "/cartao",         label: "Cartão",         icon: CreditCard },
      { href: "/planejamento",   label: "Planejamento",   icon: CalendarDays },
      { href: "/entrada-saida",  label: "Entrada/Saída",  icon: Repeat2 },
      { href: "/parcelamentos",  label: "Parcelamentos",  icon: Receipt },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    accent: false,
    items: [
      { href: "/relatorios", label: "Relatórios", icon: BarChart2 },
    ],
  },
];

const ALWAYS_VISIBLE = new Set(["/", "/configuracoes", "/investimentos"]);

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { userId, isAdmin, logout } = useUser();
  const { theme, toggleTheme } = useTheme();
  const currentUser = USERS.find((u) => u.id === userId);
  const isCollapsed = collapsed && !mobileOpen;

  const [hiddenPages, setHiddenPages] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("ibank_hidden_pages");
      return new Set(saved ? JSON.parse(saved) : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    function refresh() {
      try {
        const saved = localStorage.getItem("ibank_hidden_pages");
        setHiddenPages(new Set(saved ? JSON.parse(saved) : []));
      } catch {}
    }
    window.addEventListener("ibank_hidden_pages_changed", refresh);
    return () => window.removeEventListener("ibank_hidden_pages_changed", refresh);
  }, []);

  function isVisible(href: string) {
    return ALWAYS_VISIBLE.has(href) || !hiddenPages.has(href);
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-[100dvh] flex-col bg-sidebar",
        "transition-[width,transform] duration-150 ease-out",
        "w-60 -translate-x-full md:translate-x-0",
        "pt-[var(--safe-top)] pb-[var(--safe-bottom)]",
        mobileOpen && "translate-x-0",
        isCollapsed && "md:w-[68px]",
      )}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-3 border-b border-sidebar-border/60">
        <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden">
          <Image src="/logo.png" alt="IBANK" width={200} height={200}
            className="h-full w-full object-cover" style={{ objectPosition: "50% 48%" }} priority />
        </div>
        <div className={cn("ml-3 overflow-hidden transition-all duration-150 ease-out", isCollapsed ? "w-0 opacity-0" : "w-36 opacity-100")}>
          <p className="text-[15px] font-bold leading-none text-sidebar-foreground tracking-tight whitespace-nowrap">IBANK</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground whitespace-nowrap">Gestão Financeira</p>
        </div>
        <button type="button" onClick={onMobileClose}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors duration-100 md:hidden"
          aria-label="Fechar menu">
          <X className="h-4 w-4" />
        </button>
        {!mobileOpen && (
          <button type="button" onClick={onToggle} title={isCollapsed ? "Expandir" : "Recolher"}
            className={cn("ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 hidden md:flex", isCollapsed && "rotate-180")}>
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav com grupos */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0 scrollbar-thin-dark">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter((item) => isVisible(item.href));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.id} className={gi > 0 ? "mt-1" : ""}>
              {/* Label do grupo */}
              {!isCollapsed ? (
                <div className={cn(
                  "px-2.5 pt-3 pb-1 flex items-center gap-1.5",
                  gi === 0 ? "pt-2" : "",
                )}>
                  {group.accent && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  )}
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    group.accent ? "text-emerald-500" : "text-muted-foreground/50",
                  )}>
                    {group.label}
                  </span>
                </div>
              ) : gi > 0 ? (
                <div className="mx-3 my-2 h-px bg-sidebar-border/40" />
              ) : null}

              {/* Items */}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href}
                      title={isCollapsed ? item.label : undefined}
                      onClick={onMobileClose}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-medium",
                        "transition-all duration-100 ease-out",
                        isCollapsed ? "justify-center" : "",
                        isActive
                          ? group.accent
                            ? "bg-emerald-500/15 text-emerald-500 shadow-sm"
                            : "bg-primary text-white shadow-sm shadow-primary/30"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      )}>
                      <Icon className={cn(
                        "shrink-0 transition-transform duration-100",
                        isCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                        isActive
                          ? group.accent ? "text-emerald-500" : "text-white"
                          : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
                      )} />
                      <span className={cn(
                        "whitespace-nowrap overflow-hidden transition-all duration-150 leading-none",
                        isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100",
                      )}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Sistema (Configurações + Admin) — sempre visível, sem label quando collapsed */}
        <div className="mt-1">
          {!isCollapsed && (
            <div className="px-2.5 pt-3 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Sistema</span>
            </div>
          )}
          {isCollapsed && <div className="mx-3 my-2 h-px bg-sidebar-border/40" />}
          <div className="space-y-0.5">
            {[
              { href: "/configuracoes", label: "Configurações", icon: Settings },
              ...(isAdmin ? [{ href: "/admin/usuarios", label: "Usuários", icon: Users }] : []),
            ].map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  onClick={onMobileClose}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-medium",
                    "transition-all duration-100 ease-out",
                    isCollapsed ? "justify-center" : "",
                    isActive
                      ? "bg-primary text-white shadow-sm shadow-primary/30"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}>
                  <Icon className={cn(
                    "shrink-0 transition-transform duration-100",
                    isCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                    isActive ? "text-white" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
                  )} />
                  <span className={cn("whitespace-nowrap overflow-hidden transition-all duration-150 leading-none", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-sidebar-border/60 px-2 py-3 space-y-1">
        <button type="button" onClick={toggleTheme}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          className={cn("group flex items-center gap-3 w-full rounded-xl px-2.5 py-2.5 text-[13px] font-medium", "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-100", isCollapsed && "justify-center")}>
          {theme === "dark"
            ? <Sun className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition-colors" />
            : <Moon className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition-colors" />}
          <span className={cn("whitespace-nowrap overflow-hidden transition-all duration-150", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </span>
        </button>

        {currentUser && (
          <div className={cn("flex items-center gap-2 rounded-xl px-2.5 py-2 border border-sidebar-border/40", isCollapsed && "justify-center px-0 border-0")}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: currentUser.color }}>
              {currentUser.name[0]}
            </div>
            <span className={cn("whitespace-nowrap overflow-hidden transition-all duration-150 flex-1 text-[13px] font-medium text-sidebar-foreground/80", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
              {currentUser.name}
            </span>
            <button type="button" onClick={logout} title="Sair"
              className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-all duration-100", isCollapsed && "hidden")}>
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
