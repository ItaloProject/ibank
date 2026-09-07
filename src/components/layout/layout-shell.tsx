"use client";

import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import Image from "next/image";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ibank_sidebar");
    if (saved === "collapsed") setCollapsed(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => { if (mq.matches) setMobileOpen(false); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("ibank_sidebar", next ? "collapsed" : "open");
      return next;
    });
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      {/* Overlay desktop — fecha ao clicar fora */}
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
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted active:bg-muted/80"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg overflow-hidden bg-white shadow-sm">
              <Image
                src="/logo.png"
                alt="IBANK"
                width={32}
                height={32}
                className="h-full w-full object-cover scale-[1.8] translate-y-[-8%]"
                priority
              />
            </div>
            <span className="font-bold text-base">IBANK</span>
          </div>
        </header>
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden bg-background"
          onClick={() => { if (mobileOpen) setMobileOpen(false); }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
