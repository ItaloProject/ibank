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
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
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
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { userId, switchUser } = useUser();
  const currentUser = USERS.find((u) => u.id === userId);

  return (
    <aside
      className="fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 z-40"
      style={{ width: collapsed ? 64 : 256 }}
    >
      {/* Logo + toggle */}
      <div className="flex items-center border-b border-sidebar-border shrink-0"
        style={{ height: 64, padding: collapsed ? "0 0" : "0 16px" }}>
        {!collapsed && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sidebar-foreground text-lg leading-none">IBANK</p>
              <p className="text-xs text-muted-foreground mt-0.5">Gestão Financeira</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex w-full justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 overflow-hidden"
        style={{ padding: collapsed ? "16px 8px" : "16px 12px" }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      {currentUser && (
        <div
          className="border-t border-sidebar-border shrink-0"
          style={{ padding: collapsed ? "12px 8px" : "12px 16px" }}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: currentUser.color }}
                title={currentUser.name}
              >
                {currentUser.name[0]}
              </div>
              <button
                onClick={switchUser}
                title="Trocar usuário"
                className="text-muted-foreground hover:text-sidebar-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: currentUser.color }}
              >
                {currentUser.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground truncate">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">conta pessoal</p>
              </div>
              <button
                onClick={switchUser}
                title="Trocar usuário"
                className="text-muted-foreground hover:text-sidebar-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={onToggle}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        className={cn(
          "absolute -right-3 top-[72px] flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground hover:text-sidebar-foreground shadow-sm transition-colors z-50"
        )}
      >
        {collapsed
          ? <PanelLeftOpen className="h-3.5 w-3.5" />
          : <PanelLeftClose className="h-3.5 w-3.5" />
        }
      </button>
    </aside>
  );
}
