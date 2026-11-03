"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Clock, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SNOOZE_DAYS } from "@/lib/alert-choices";
import { actionHref, actionLabel } from "@/lib/plan-view";
import { useAlerts } from "@/components/notifications/alerts-provider";

export function NotificationBell({ className }: { className?: string }) {
  const { alerts, unseen, loading, error, status, markSeen, choose } = useAlerts();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    markSeen(unseen.map((a) => a.id));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- só marca ao abrir

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = unseen.length;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          open
            ? "Fechar avisos"
            : count
              ? `${count} ${count === 1 ? "aviso novo" : "avisos novos"}`
              : "Abrir avisos"
        }
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-lg text-foreground/70 transition-colors",
          "hover:bg-muted hover:text-foreground active:bg-muted/80 touch-manipulation",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-muted text-foreground",
        )}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold tabular-nums text-[#0D0D0D] ring-2 ring-background"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Avisos"
          className={cn(
            "absolute right-0 z-50 mt-2 flex w-[min(100vw-1.5rem,22rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl",
            "max-h-[min(70dvh,28rem)]",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Avisos</p>
              <p className="text-xs text-muted-foreground">
                {loading
                  ? "Carregando…"
                  : alerts.length === 0
                    ? "Nada pendente agora"
                    : `${alerts.length} ${alerts.length === 1 ? "aviso" : "avisos"}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-2">
            {error && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Não foi possível carregar os avisos agora.
              </p>
            )}
            {!error && !loading && alerts.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Sem avisos. Quando houver queda na bolsa, dinheiro parado ou vencimento próximo, aparece aqui.
              </p>
            )}
            <ul className="space-y-1.5">
              {alerts.map((alert) => {
                const st = status(alert.id);
                const secondary =
                  "inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
                return (
                  <li
                    key={alert.id}
                    className={cn(
                      "rounded-xl border border-border/60 bg-muted/20 p-3",
                      st && "opacity-60",
                    )}
                  >
                    <p className="text-sm font-semibold leading-snug">{alert.titulo}</p>
                    <p
                      className={cn(
                        "mt-0.5 text-[11px] font-medium",
                        alert.nivel === "alta" ? "text-amber-500" : "text-muted-foreground",
                      )}
                    >
                      {alert.nivel === "alta" ? "Importante" : "Atenção"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{alert.detalhe}</p>
                    {st ? (
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {st === "snoozed"
                            ? `Lembro em ${SNOOZE_DAYS} dias.`
                            : "Aviso desconsiderado."}
                        </span>
                        <button type="button" className={secondary} onClick={() => choose(alert.id, "undo")}>
                          Desfazer
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2.5 space-y-1.5">
                        {alert.acao && (
                          <Link
                            href={actionHref(alert.acao)}
                            onClick={() => setOpen(false)}
                            className="inline-flex min-h-9 items-center rounded-lg bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                          >
                            {actionLabel(alert.acao)}
                          </Link>
                        )}
                        <div className="flex flex-wrap gap-1">
                          <button type="button" className={secondary} onClick={() => choose(alert.id, "snooze")}>
                            <Clock className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            Lembrar em {SNOOZE_DAYS} dias
                          </button>
                          <button type="button" className={secondary} onClick={() => choose(alert.id, "dismiss")}>
                            <EyeOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            Desconsiderar
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
