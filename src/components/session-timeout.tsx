"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUser } from "@/context/user-context";
import { LogOut, Clock } from "lucide-react";

const TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutos
const WARNING_MS = 60 * 1000;        // avisa 60s antes

export function SessionTimeout() {
  const { userId, logout } = useUser();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warnRef.current) clearTimeout(warnRef.current);
    if (countRef.current) clearInterval(countRef.current);
  }, []);

  const reset = useCallback(() => {
    if (!userId) return;
    clearAll();
    setShowWarning(false);
    setCountdown(60);

    warnRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(60);
      countRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countRef.current) clearInterval(countRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, TIMEOUT_MS - WARNING_MS);

    timerRef.current = setTimeout(() => {
      logout();
    }, TIMEOUT_MS);
  }, [userId, logout, clearAll]);

  useEffect(() => {
    if (!userId) { clearAll(); setShowWarning(false); return; }
    reset();
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const handler = () => { if (!showWarning) reset(); };
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => {
      clearAll();
      events.forEach((e) => window.removeEventListener(e, handler));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-background border rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Clock className="h-7 w-7 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold">Sessão expirando</h2>
          <p className="text-sm text-muted-foreground">
            Você será desconectado por inatividade em
          </p>
          <div className="text-4xl font-bold tabular-nums text-amber-500">{countdown}s</div>
          <div className="flex gap-3 w-full mt-2">
            <button
              type="button"
              onClick={async () => { clearAll(); await logout(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sair agora
            </button>
            <button
              type="button"
              onClick={reset}
              className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
