"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut, ChevronLeft, X, Sun, Moon, Users,
} from "lucide-react";
import Image from "next/image";
import { useUser } from "@/context/user-context";
import { USERS } from "@/lib/user";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { useState, useEffect } from "react";
import {
  NAV_GROUPS,
  SYSTEM_NAV_ITEMS,
  isNavItemActive,
  isPageVisible,
  readHiddenPages,
} from "@/lib/nav";

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

  const [hiddenPages, setHiddenPages] = useState<Set<string>>(() => readHiddenPages());

  useEffect(() => {
    function refresh() {
      setHiddenPages(readHiddenPages());
    }
    window.addEventListener("ibank_hidden_pages_changed", refresh);
    return () => window.removeEventListener("ibank_hidden_pages_changed", refresh);
  }, []);

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
      <div className="flex h-16 shrink-0 items-center px-3 border-b border-sidebar-border/50">
        <div className="h-10 w-10 shrink-0 flex items-center justify-center">
          <Image src="/logo.png" alt="MUVO" width={200} height={200}
            className="h-full w-full object-contain" priority />
        </div>
        <div className={cn("ml-2 overflow-hidden transition-all duration-150 ease-out", isCollapsed ? "w-0 opacity-0" : "w-36 opacity-100")}>
          <p className="text-[17px] font-bold leading-none text-sidebar-foreground font-display italic whitespace-nowrap">MUVO</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-primary/60 whitespace-nowrap">Financeiro</p>
        </div>
        <button type="button" onClick={onMobileClose}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors duration-100 md:hidden"
          aria-label="Fechar menu">
          <X className="h-4 w-4" />
        </button>
        {!mobileOpen && (
          <button type="button" onClick={onToggle} title={isCollapsed ? "Expandir" : "Recolher"}
            className={cn("ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/30 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 hidden md:flex", isCollapsed && "rotate-180")}>
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 space-y-0 scrollbar-thin-dark">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter((item) => isPageVisible(item.href, hiddenPages));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.id} className={gi > 0 ? "mt-1" : ""}>
              {!isCollapsed ? (
                <div className={cn(
                  "px-2.5 pt-3 pb-1 flex items-center gap-1.5",
                  gi === 0 ? "pt-2" : "",
                )}>
                  {group.accent && (
                    <span className="h-1 w-1 rounded-full bg-sidebar-primary/70 shrink-0" />
                  )}
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    group.accent ? "text-sidebar-primary/70" : "text-sidebar-foreground/30",
                  )}>
                    {group.label}
                  </span>
                </div>
              ) : gi > 0 ? (
                <div className="mx-3 my-2 h-px bg-sidebar-border/30" />
              ) : null}

              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isNavItemActive(pathname, item.href);
                  return (
                    <Link key={item.href} href={item.href}
                      title={isCollapsed ? item.label : undefined}
                      onClick={onMobileClose}
                      className={cn(
                        "group flex items-center rounded-xl px-2.5 py-2.5 text-[13px] font-medium",
                        "transition-all duration-100 ease-out",
                        isCollapsed ? "justify-center gap-0" : "gap-3",
                        isActive
                          ? "bg-sidebar-primary/15 text-sidebar-primary"
                          : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      )}>
                      <Icon className={cn(
                        "shrink-0 transition-colors duration-100",
                        isCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                        isActive
                          ? "text-sidebar-primary"
                          : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
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

        {/* Sistema */}
        <div className="mt-1">
          {!isCollapsed ? (
            <div className="px-2.5 pt-3 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                Sistema
              </span>
            </div>
          ) : (
            <div className="mx-3 my-2 h-px bg-sidebar-border/40" />
          )}
          <div className="space-y-0.5">
            {SYSTEM_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href}
                  title={isCollapsed ? item.label : undefined}
                  onClick={onMobileClose}
                  className={cn(
                    "group flex items-center rounded-xl px-2.5 py-2.5 text-[13px] font-medium transition-all duration-100",
                    isCollapsed ? "justify-center gap-0" : "gap-3",
                    isActive
                      ? "bg-sidebar-primary/15 text-sidebar-primary"
                      : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}>
                  <Icon className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                    isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground")} />
                  <span className={cn("whitespace-nowrap overflow-hidden transition-all duration-150", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
            {isAdmin && (
              <Link href="/admin/usuarios"
                title={isCollapsed ? "Usuários" : undefined}
                onClick={onMobileClose}
                className={cn(
                  "group flex items-center rounded-xl px-2.5 py-2.5 text-[13px] font-medium transition-all duration-100",
                  isCollapsed ? "justify-center gap-0" : "gap-3",
                  isNavItemActive(pathname, "/admin/usuarios")
                    ? "bg-sidebar-primary/15 text-sidebar-primary"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}>
                <Users className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                  isNavItemActive(pathname, "/admin/usuarios") ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground")} />
                <span className={cn("whitespace-nowrap overflow-hidden transition-all duration-150", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                  Usuários
                </span>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border/50 p-2 space-y-0.5">
        <button type="button" onClick={toggleTheme}
          className={cn(
            "flex w-full items-center rounded-xl px-2.5 py-2 text-[13px] font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors",
            isCollapsed ? "justify-center gap-0" : "gap-3",
          )}>
          {theme === "dark" ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
          <span className={cn("whitespace-nowrap overflow-hidden transition-all", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </span>
        </button>

        <div className={cn(
          "flex items-center gap-2.5 rounded-xl px-2.5 py-2 border border-sidebar-border/40 bg-sidebar-accent/30 mt-1",
          isCollapsed ? "justify-center border-transparent bg-transparent px-0" : "",
        )}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/25 ring-1 ring-sidebar-primary/30 text-[11px] font-bold text-sidebar-primary">
            {(currentUser?.name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className={cn("min-w-0 flex-1 overflow-hidden transition-all", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
            <p className="truncate text-[12px] font-semibold text-sidebar-foreground/90 leading-none">{currentUser?.name}</p>
            <p className="text-[10px] text-sidebar-foreground/40 mt-0.5 leading-none">Assinante</p>
          </div>
          {!isCollapsed && (
            <button type="button" onClick={logout}
              title="Sair"
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-sidebar-foreground/30 hover:bg-red-500/15 hover:text-red-400 transition-colors"
              aria-label="Sair">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isCollapsed && (
          <button type="button" onClick={logout}
            className="flex w-full items-center justify-center rounded-xl px-2.5 py-2 text-sidebar-foreground/30 hover:bg-red-500/10 hover:text-red-400 transition-colors">
            <LogOut className="h-[17px] w-[17px]" />
          </button>
        )}
      </div>
    </aside>
  );
}
