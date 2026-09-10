"use client";

import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { MoreNavSheet } from "./more-nav-sheet";
import { LoginScreen } from "@/components/login-screen";
import { ProfileSelectScreen } from "@/components/profile-select-screen";
import { CarteiraSugeridaScreen } from "@/components/carteira-sugerida-screen";
import { SubscriptionGate } from "@/components/subscription-gate";
import { SessionTimeout } from "@/components/session-timeout";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { useUser } from "@/context/user-context";
import { cn } from "@/lib/utils";

const PUBLIC_PATHS = new Set(["/vender", "/comecar", "/politica-privacidade", "/~offline"]);

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userId, investmentProfile, subscriptionActive, isAdmin } = useUser();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [carteiraSugeridaVista, setCarteiraSugeridaVista] = useState(() => {
    try { return !!localStorage.getItem("ibank_carteira_vista"); } catch { return false; }
  });

  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    const saved = localStorage.getItem("ibank_sidebar");
    if (saved === "collapsed") setCollapsed(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => {
      if (mq.matches) {
        setMobileOpen(false);
        setMoreOpen(false);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setMoreOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMoreOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("ibank_sidebar", next ? "collapsed" : "open");
      return next;
    });
  }

  if (isPublic) return <>{children}</>;

  if (!userId) return <LoginScreen />;
  if (!subscriptionActive && !isAdmin) return <SubscriptionGate />;
  if (!investmentProfile) return <ProfileSelectScreen />;
  if (!carteiraSugeridaVista) return (
    <CarteiraSugeridaScreen
      profile={investmentProfile}
      onContinuar={(_aporte) => {
        try { localStorage.setItem("ibank_carteira_vista", "1"); } catch {}
        setCarteiraSugeridaVista(true);
      }}
    />
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      {!collapsed && (
        <div
          className="fixed inset-0 z-20 hidden md:block"
          onClick={toggle}
          aria-hidden
        />
      )}
      <Sidebar
        collapsed={collapsed}
        onToggle={toggle}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div
        className={cn(
          "flex flex-1 flex-col min-w-0 transition-[margin] duration-150 ease-out",
          collapsed ? "md:ml-[68px]" : "md:ml-60",
        )}
      >
        <header
          className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:hidden safe-pt"
          style={{ height: "calc(3.5rem + var(--safe-top))" }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted active:bg-muted/80 touch-manipulation"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg overflow-hidden shrink-0">
              <Image
                src="/logo.png"
                alt="IBANK"
                width={200}
                height={200}
                className="h-full w-full object-cover"
                style={{ objectPosition: "50% 48%" }}
                priority
              />
            </div>
            <span className="font-bold text-base truncate">IBANK</span>
          </div>
        </header>
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden bg-background pb-bottom-nav scrollbar-thin-dark"
          onClick={() => { if (mobileOpen) setMobileOpen(false); }}
        >
          {children}
        </main>
      </div>
      <BottomNav onMore={() => setMoreOpen(true)} />
      <MoreNavSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onOpenFullMenu={() => setMobileOpen(true)}
      />
      <PwaInstallPrompt />
      <SessionTimeout />
    </div>
  );
}
