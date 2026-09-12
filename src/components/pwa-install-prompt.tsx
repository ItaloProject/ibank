"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ibank_pwa_install_dismissed";

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const isChrome = /CriOS|Chrome/.test(ua);
  return iOS && webkit && !isChrome;
}

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PwaInstallPrompt({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    if (isIosSafari()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function dismiss() {
    setVisible(false);
    setDeferred(null);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-3 z-50 rounded-2xl border bg-card/95 backdrop-blur-xl shadow-xl p-3.5",
        "bottom-[calc(var(--bottom-nav-offset)+0.5rem)] md:bottom-4 md:left-auto md:right-4 md:max-w-sm",
        className,
      )}
      role="dialog"
      aria-label="Instalar MUVO"
    >
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Download className="h-4 w-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">Instalar o MUVO</p>
          {iosHint ? (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              No Safari: toque em <strong className="text-foreground">Compartilhar</strong> e depois em{" "}
              <strong className="text-foreground">Adicionar à Tela de Início</strong>.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Abra como app no celular — mais rápido e com acesso pela tela inicial.
            </p>
          )}
          <div className="mt-2.5 flex items-center gap-2">
            {!iosHint && (
              <button
                type="button"
                onClick={install}
                className="rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-bold text-primary-foreground"
              >
                Instalar
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              Agora não
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
