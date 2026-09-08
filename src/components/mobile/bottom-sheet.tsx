"use client";

import { cn } from "@/lib/utils";

/** Lightweight bottom sheet for mobile forms (no Radix dependency). */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-md bg-background border rounded-t-2xl sm:rounded-2xl shadow-2xl",
          "max-h-[min(90dvh,calc(100dvh-var(--safe-top)-1rem))] overflow-y-auto",
          "px-4 pt-3 pb-[max(1rem,var(--safe-bottom))] sm:pb-4",
          className,
        )}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted sm:hidden" aria-hidden />
        {title ? (
          <div className="mb-3 pr-8">
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
