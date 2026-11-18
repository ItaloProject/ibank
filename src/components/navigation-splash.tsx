"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SplashScreen } from "@/components/splash-screen";

const MIN_MS = 700; // garante que a animação seja visível antes de sumir
const MAX_MS = 8000; // trava de segurança: nunca deixa o rato preso na tela

/** Caminho de destino se o clique em `anchor` for uma navegação interna para outra página; senão null. */
function internalTarget(anchor: HTMLAnchorElement): string | null {
  const raw = anchor.getAttribute("href") ?? "";
  if (!raw || raw.startsWith("#")) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null; // http(s) externo, mailto:, tel:...
  return url.pathname;
}

export function NavigationSplash() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const hideAt = useRef<number>(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failSafe = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clique em link interno → mostra imediatamente, agenda tempo mínimo
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // abre em nova aba/janela
      const anchor = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const target = internalTarget(anchor);
      // Mesma página (ainda que com ?query ou #hash): o pathname não muda, então nunca fecharia.
      if (!target || target === pathname) return;

      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (failSafe.current) clearTimeout(failSafe.current);
      hideAt.current = Date.now() + MIN_MS;
      setVisible(true);
      failSafe.current = setTimeout(() => setVisible(false), MAX_MS);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  // Pathname mudou → espera o tempo mínimo restante antes de sumir
  useEffect(() => {
    if (!visible) return;
    const remaining = Math.max(0, hideAt.current - Date.now());
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      if (failSafe.current) clearTimeout(failSafe.current);
    }, remaining);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (failSafe.current) clearTimeout(failSafe.current);
    },
    [],
  );

  if (!visible) return null;

  return <SplashScreen />;
}
