"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  BarChart3,
  Wallet,
  CalendarRange,
  ArrowLeftRight,
  Layers,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useUser } from "@/context/user-context";
import { USERS } from "@/lib/user";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cartao", label: "Cartão de Crédito", icon: CreditCard },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/planejamento", label: "Planejamento", icon: CalendarRange },
  { href: "/entrada-saida", label: "Entra/Saída", icon: ArrowLeftRight },
  { href: "/parcelamentos", label: "Parcelamentos", icon: Layers },
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
  const currentUser = USERS.find((u) => u.id === userId);
  const isCollapsed = collapsed && !mobileOpen;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-[100dvh] flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        "w-64 -translate-x-full md:translate-x-0",
        mobileOpen && "translate-x-0",
        isCollapsed && "md:w-16",
      )}
    >
      {/* Logo */}
      <div
        className="flex shrink-0 items-center border-b border-sidebar-border"
        style={{ height: 64, padding: isCollapsed ? "0" : "0 16px" }}
      >
        {!isCollapsed ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none text-sidebar-foreground">IBANK</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Gestão Financeira</p>
            </div>
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onMobileClose}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent md:hidden"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 space-y-1 overflow-y-auto py-4"
        style={{ padding: isCollapsed ? "16px 8px" : "16px 12px" }}
      >
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
                "flex items-center rounded-lg text-sm font-medium transition-colors",
                isCollapsed ? "mx-auto h-11 w-11 justify-center" : "gap-3 px-3 py-3",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      {currentUser && (
        <div
          className="shrink-0 border-t border-sidebar-border"
          style={{ padding: isCollapsed ? "12px 8px" : "12px 16px" }}
        >
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: currentUser.color }}
                title={currentUser.name}
              >
                {currentUser.name[0]}
              </div>
              <button
                type="button"
                onClick={switchUser}
                title="Trocar usuário"
                className="flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: currentUser.color }}
              >
                {currentUser.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">conta pessoal</p>
              </div>
              <button
                type="button"
                onClick={switchUser}
                title="Trocar usuário"
                className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toggle button — desktop only */}
      <button
        type="button"
        onClick={onToggle}
        title={isCollapsed ? "Expandir menu" : "Recolher menu"}
        className="absolute -right-3 top-[72px] z-50 hidden h-7 w-7 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground shadow-sm transition-colors hover:text-sidebar-foreground md:flex"
      >
        {isCollapsed
          ? <PanelLeftOpen className="h-3.5 w-3.5" />
          : <PanelLeftClose className="h-3.5 w-3.5" />}
      </button>
    </aside>
  );
}
