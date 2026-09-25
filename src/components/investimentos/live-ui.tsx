"use client";

import { useRef, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, X } from "lucide-react";

export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
export const LABEL = "text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground";
export const MONEY = "font-display font-black tabular-nums text-foreground";
const BTN = `w-full min-h-12 rounded-xl px-4 text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`;
export const BTN_PRIMARY = `${BTN} bg-foreground text-background hover:bg-foreground/90`;
export const BTN_SECONDARY = `${BTN} border border-border text-foreground hover:bg-muted`;
export const BTN_DANGER = `${BTN} bg-red-600 text-white hover:bg-red-700`;
export const BTN_DANGER_OUTLINE = `${BTN} border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10`;
export const ROW = `w-full text-left rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors ${FOCUS}`;
export const INPUT_BOX =
  "flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 min-h-12 focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-ring/30";
export const GAIN = "text-emerald-600 dark:text-emerald-400";
export const LOSS = "text-red-600 dark:text-red-400";
export const ATTENTION = "text-amber-600 dark:text-amber-400";

/** Folha modal do MUVO Live: sobe de baixo no celular e vira janela centralizada no desktop. */
export function LiveSheet({
  open,
  onOpenChange,
  title,
  description,
  dismissible = true,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  dismissible?: boolean;
  children: ReactNode;
}) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(open);
  // Captura na renderização da abertura: os efeitos do Radix movem o foco antes de qualquer useEffect daqui.
  if (open && !wasOpenRef.current && typeof document !== "undefined") {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
  }
  wasOpenRef.current = open;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !dismissible) return;
        onOpenChange(next);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[300] bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-[300] max-h-[90dvh] overflow-y-auto overflow-x-hidden rounded-t-2xl border-t border-border bg-card px-5 pt-4 focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom motion-reduce:animate-none md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:animate-none"
          style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))" }}
          onCloseAutoFocus={(e) => {
            const target = returnFocusRef.current;
            if (target && target.isConnected) {
              e.preventDefault();
              target.focus();
            }
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="min-w-0 pt-2">
              <DialogPrimitive.Title className="text-lg font-bold text-foreground leading-snug">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                className={description ? "text-xs text-muted-foreground mt-1" : "sr-only"}
              >
                {description ?? title}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              disabled={!dismissible}
              aria-label="Fechar"
              className={`-mr-2 h-11 w-11 shrink-0 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 ${FOCUS}`}
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function StatBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3">
      <p className={LABEL}>{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:text-foreground ${FOCUS}`}
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
