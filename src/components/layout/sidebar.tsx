"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CreditCard,
  TrendingUp,
  BarChart2,
  Wallet,
  CalendarDays,
  Repeat2,
  Receipt,
  LogOut,
  ChevronLeft,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { useUser } from "@/context/user-context";
import { USERS } from "@/lib/user";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/cartao", label: "Cartão de Crédito", icon: CreditCard },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/planejamento", label: "Planejamento", icon: CalendarDays },
  { href: "/entrada-saida", label: "Entrada/Saída", icon: Repeat2 },
  { href: "/relatorios", label: "Relatórios", icon: BarChart2 },
  { href: "/parcelamentos", label: "Parcelamentos", icon: Receipt },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { userId, switchUser } = useUser();
  const { theme, toggleTheme } = useTheme();
  const currentUser = USERS.find((u) => u.id === userId);
  const isCollapsed = collapsed && !mobileOpen;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-[100dvh] flex-col bg-sidebar",
        "transition-[width,transform] duration-150 ease-out",
        "w-60 -translate-x-full md:translate-x-0",
        mobileOpen && "translate-x-0",
        isCollapsed && "md:w-[68px]",
      )}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-3 border-b border-sidebar-border/60">
        {/* Ícone — sempre visível, nunca clipado */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-md shadow-primary/30">
          <Wallet className="h-[18px] w-[18px] text-white" />
        </div>
        {/* Texto — some com overflow-hidden */}
        <div className={cn(
          "ml-3 overflow-hidden transition-all duration-150 ease-out",
          isCollapsed ? "w-0 opacity-0" : "w-36 opacity-100",
        )}>
          <p className="text-[15px] font-bold leading-none text-sidebar-foreground tracking-tight whitespace-nowrap">IBANK</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground whitespace-nowrap">Gestão Financeira</p>
        </div>

        {/* Fechar (mobile) */}
        <button
          type="button"
          onClick={onMobileClose}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors duration-100 md:hidden"
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Recolher (desktop) */}
        {!mobileOpen && (
          <button
            type="button"
            onClick={onToggle}
            title={isCollapsed ? "Expandir" : "Recolher"}
            className={cn(
              "ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-150 hidden md:flex",
              isCollapsed && "rotate-180",
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              onClick={onMobileClose}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-medium",
                "transition-all duration-100 ease-out",
                isCollapsed ? "justify-center" : "",
                isActive
                  ? "bg-primary text-white shadow-sm shadow-primary/30"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className={cn(
                "shrink-0 transition-transform duration-100",
                isCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
                isActive ? "text-white" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground",
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
      </nav>

      {/* Footer: user + theme */}
      <div className="shrink-0 border-t border-sidebar-border/60 px-2 py-3 space-y-1">
        {/* Tema */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          className={cn(
            "group flex items-center gap-3 w-full rounded-xl px-2.5 py-2.5 text-[13px] font-medium",
            "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-100",
            isCollapsed && "justify-center",
          )}
        >
          {theme === "dark"
            ? <Sun className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition-colors" />
            : <Moon className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition-colors" />}
          <span className={cn("whitespace-nowrap overflow-hidden transition-all duration-150", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </span>
        </button>

        {/* Usuário */}
        {currentUser && (
          <button
            type="button"
            onClick={switchUser}
            title="Trocar usuário"
            className={cn(
              "group flex items-center gap-3 w-full rounded-xl px-2.5 py-2.5 text-[13px] font-medium",
              "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-100",
              isCollapsed && "justify-center",
            )}
          >
            <div
              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: currentUser.color }}
            >
              {currentUser.name[0]}
            </div>
            <span className={cn("whitespace-nowrap overflow-hidden transition-all duration-150 flex-1 text-left", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
              {currentUser.name}
            </span>
            <LogOut className={cn("h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity", isCollapsed && "hidden")} />
          </button>
        )}
      </div>
    </aside>
  );
}
