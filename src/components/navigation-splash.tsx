"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SplashScreen } from "./splash-screen";

const NAV_SPLASH_MS = 900;

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
  return <SplashScreen />;
}
