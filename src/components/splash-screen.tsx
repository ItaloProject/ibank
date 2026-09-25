"use client";

import { useEffect, useRef } from "react";

const BAR_MS = 1800;

/**
 * Tela de carregamento única do MUVO (rato correndo). Toda espera de tela usa este
 * componente; instâncias montadas em sequência ficam idênticas, então a troca entre
 * splash de navegação e carregamento da página não pisca.
 */
export function SplashScreen() {
  const barRef = useRef<HTMLDivElement>(null);

  // Fase da barra atrelada ao relógio para que remontagens continuem do mesmo ponto.
  useEffect(() => {
    if (barRef.current) barRef.current.style.animationDelay = `${-(Date.now() % BAR_MS)}ms`;
  }, []);

  return (
    <div
      role="status"
      aria-label="Carregando"
      className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-5"
    >
      {/* dark:invert inverte o GIF: fundo branco→preto, rato preto→branco */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/loading.gif"
        alt=""
        className="w-32 h-32 object-contain invert [mix-blend-mode:multiply] dark:invert-0 dark:[mix-blend-mode:screen]"
      />
      <div className="h-[2px] w-40 rounded-full bg-border overflow-hidden">
        <div
          ref={barRef}
          className="h-full rounded-full bg-foreground"
          style={{ animation: `loading-bar ${BAR_MS}ms ease-in-out infinite` }}
        />
      </div>
    </div>
  );
}
