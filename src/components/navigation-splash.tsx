"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationSplash() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  // Detecta CLIQUE em links internos → mostra imediatamente (antes de navegar)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      // ignora âncoras, links externos e links do mesmo pathname
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto")) return;
      if (href === pathname) return;
      setVisible(true);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  // Quando a nova rota estiver pronta → esconde
  useEffect(() => {
    setVisible(false);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/loading.gif"
        alt=""
        className="w-32 h-32 object-contain dark:invert"
      />
      <div className="h-[2px] w-40 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full bg-amber-400 animate-[loading-bar_0.8s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
