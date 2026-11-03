"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  currentPushSubscription,
  disablePush,
  enablePush,
  pushSupported,
} from "@/lib/push-client";

type Status = "loading" | "unsupported" | "off" | "on" | "denied";

export function PushToggle({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      const sub = await currentPushSubscription();
      if (!cancelled) setStatus(sub ? "on" : "off");
    })();
    return () => { cancelled = true; };
  }, []);

  async function toggle() {
    if (busy || status === "unsupported" || status === "denied" || status === "loading") return;
    setBusy(true);
    setHint("");
    try {
      if (status === "on") {
        await disablePush();
        setStatus("off");
        setHint("Avisos neste aparelho desligados.");
      } else {
        const r = await enablePush();
        if (r === "ok") {
          setStatus("on");
          setHint("Pronto. Avisos de queda chegam por volta das 18:30.");
        } else if (r === "denied") {
          setStatus("denied");
          setHint("Permissão negada no navegador.");
        } else if (r === "unsupported") {
          setStatus("unsupported");
        } else {
          setHint("Não foi possível ativar agora. Tente de novo.");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Verificando notificações…
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <p className={cn("px-3 py-2 text-xs text-muted-foreground", className)}>
        Este aparelho não recebe notificações push. No iPhone, instale o Muvo na tela inicial.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className={cn("px-3 py-2 text-xs text-muted-foreground", className)}>
        As notificações estão bloqueadas neste navegador. Libere o Muvo nas configurações do site.
      </p>
    );
  }

  const on = status === "on";
  return (
    <div className={cn("space-y-1 px-2 py-2", className)}>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        className={cn(
          "flex w-full min-h-10 items-center gap-2 rounded-xl px-3 text-left text-xs font-medium transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          busy && "opacity-60",
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : on ? (
          <BellRing className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
        ) : (
          <BellOff className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          {on ? "Avisos neste aparelho ligados" : "Receber avisos neste aparelho"}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {on ? "Ligado" : "Desligado"}
        </span>
      </button>
      {hint ? <p className="px-3 text-[11px] text-muted-foreground">{hint}</p> : (
        <p className="px-3 text-[11px] text-muted-foreground">
          Quedas da bolsa e avisos da carteira, por volta das 18:30 de Brasília nos dias úteis.
        </p>
      )}
    </div>
  );
}
