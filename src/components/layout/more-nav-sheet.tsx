"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { BottomSheet } from "@/components/mobile/bottom-sheet";
import { cn } from "@/lib/utils";
import {
  NAV_GROUPS,
  SYSTEM_NAV_ITEMS,
  isNavItemActive,
  isPageVisible,
  readHiddenPages,
} from "@/lib/nav";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenFullMenu?: () => void;
};

export function MoreNavSheet({ open, onClose, onOpenFullMenu }: Props) {
  const pathname = usePathname();
  const [hiddenPages, setHiddenPages] = useState<Set<string>>(() => readHiddenPages());

  useEffect(() => {
    if (!open) return;
    setHiddenPages(readHiddenPages());
  }, [open]);

  return (
    <BottomSheet open={open} onClose={onClose} title="Todas as páginas" className="md:hidden">
      <div className="space-y-4 pb-2">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => isPageVisible(item.href, hiddenPages));
          if (items.length === 0) return null;
          return (
            <div key={group.id}>
              <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
                {group.accent && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                )}
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    group.accent ? "text-emerald-500" : "text-muted-foreground/60",
                  )}
                >
                  {group.label}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-colors touch-manipulation min-h-[48px]",
                        active
                          ? group.accent
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                            : "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/60 bg-card/40 text-foreground hover:bg-muted/50",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="text-[12px] font-semibold leading-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div>
          <p className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Sistema
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SYSTEM_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-colors touch-manipulation min-h-[48px]",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/60 bg-card/40 text-foreground hover:bg-muted/50",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="text-[12px] font-semibold leading-tight">{item.label}</span>
                </Link>
              );
            })}
            {onOpenFullMenu && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFullMenu();
                }}
                className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/40 px-3 py-3 text-left text-foreground hover:bg-muted/50 touch-manipulation min-h-[48px]"
              >
                <Menu className="h-4 w-4 shrink-0 opacity-80" />
                <span className="text-[12px] font-semibold leading-tight">Menu completo</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
