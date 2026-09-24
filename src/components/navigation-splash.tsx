"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const NAV_SPLASH_MS = 1000;

export function NavigationSplash() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), NAV_SPLASH_MS);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/loading.gif"
        alt=""
        className="w-16 h-16 object-contain drop-shadow-xl"
      />
      <div className="h-0.5 w-24 rounded-full bg-border/60 overflow-hidden">
        <div className="h-full rounded-full bg-amber-400 animate-[loading-bar_1s_ease-in-out_forwards]" />
      </div>
    </div>
  );
}
