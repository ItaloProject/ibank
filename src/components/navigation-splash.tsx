"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MIN_MS = 700; // garante que a animação seja visível antes de sumir

export function NavigationSplash() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const hideAt = useRef<number>(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clique em link interno → mostra imediatamente, agenda tempo mínimo
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto")) return;
      if (href === pathname) return;

      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideAt.current = Date.now() + MIN_MS;
      setVisible(true);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  // Pathname mudou → espera o tempo mínimo restante antes de sumir
  useEffect(() => {
    if (!visible) return;
    const remaining = Math.max(0, hideAt.current - Date.now());
    hideTimer.current = setTimeout(() => setVisible(false), remaining);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/loading.gif"
        alt=""
        className="w-32 h-32 object-contain"
      />
      <div className="h-[2px] w-40 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-400"
          style={{ animation: `loading-bar ${MIN_MS}ms ease-in-out forwards` }}
        />
      </div>
    </div>
  );
}
