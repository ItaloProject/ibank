"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SplashScreen } from "@/components/splash-screen";

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

  return <SplashScreen />;
}
