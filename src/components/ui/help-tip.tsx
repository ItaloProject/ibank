"use client";

import { useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

/**
 * "?" ao lado de um termo: abre a explicação ao passar o mouse, ao focar pelo teclado ou ao tocar.
 * `label` é o termo explicado, usado no nome acessível do botão.
 */
export function HelpTip({
  label,
  children,
  className,
  side = "top",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerType = useRef<string | null>(null);

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function hideSoon() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  const hover = {
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === "mouse") show(); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === "mouse") hideSoon(); },
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`O que é ${label}?`}
          onPointerDown={(e) => { pointerType.current = e.pointerType; }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (pointerType.current === "mouse") show();
            else setOpen((v) => !v);
            pointerType.current = null;
          }}
          onFocus={() => { if (pointerType.current === null) show(); }}
          onBlur={hideSoon}
          {...hover}
          className={cn(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current align-middle",
            "text-[10px] font-bold leading-none normal-case tracking-normal text-muted-foreground/70",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "relative before:absolute before:-inset-2 before:content-['']",
            className,
          )}
        >
          ?
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align="center"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          {...hover}
          className={cn(
            "z-[400] max-w-[280px] rounded-lg border border-border bg-popover px-3 py-2.5 shadow-lg",
            "text-xs font-normal normal-case tracking-normal leading-relaxed text-popover-foreground",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none",
          )}
        >
          {children}
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
