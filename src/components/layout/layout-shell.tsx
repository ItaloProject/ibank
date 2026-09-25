"use client";

import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
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
import { NavigationSplash } from "@/components/navigation-splash";

const PUBLIC_PATHS = new Set(["/vender", "/comecar", "/politica-privacidade", "/termos-de-uso", "/~offline"]);

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userId, investmentProfile, carteiraVista, markCarteiraVista, subscriptionActive, isAdmin } = useUser();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isPwa, setIsPwa] = useState(false);

  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    const saved = localStorage.getItem("ibank_sidebar");
    if (saved === "collapsed") setCollapsed(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    setIsPwa(mq.matches || !!(navigator as { standalone?: boolean }).standalone);
    const handler = (e: MediaQueryListEvent) => setIsPwa(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
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
  if (!carteiraVista) return (
    <CarteiraSugeridaScreen
      profile={investmentProfile}
      onContinuar={() => { void markCarteiraVista(); }}
    />
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <NavigationSplash />
      {!isPwa && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[45] md:hidden animate-in fade-in-0 duration-200"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      {!isPwa && !collapsed && (
        <div
          className="fixed inset-0 z-20 hidden md:block"
          onClick={toggle}
          aria-hidden
        />
      )}
      {!isPwa && (
        <Sidebar
          collapsed={collapsed}
          onToggle={toggle}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
      )}
      <div
        className={cn(
          "flex flex-1 flex-col min-w-0 transition-[margin] duration-150 ease-out",
          !isPwa && (collapsed ? "md:ml-[68px]" : "md:ml-60"),
        )}
      >
        <header
          className={cn(
            "sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:hidden safe-pt",
            isPwa && "hidden",
          )}
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
          <div className="flex items-center min-w-0">
            <BrandLockup className="h-8" priority />
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
        onOpenFullMenu={isPwa ? undefined : () => setMobileOpen(true)}
      />
      <PwaInstallPrompt />
      <SessionTimeout />
    </div>
  );
}
