"use client";

import Link from "next/link";
import { ChevronDown, Circle, CircleCheck, Layers, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ExpenseGroup { id: string; user_id: string; name: string; color: string; done_months?: string[]; }export interface ExpenseItem {
  id: string; group_id: string; user_id: string; month: string;
  name: string; type: "fixo" | "variavel"; planned: number; actual: number;
  installment_id?: string | null;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ICON_BTN = "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation md:h-9 md:w-9";

export function GroupSection({
  group, items, collapsed, done, onToggle, onToggleDone, onAddItem, onShare, onEditGroup, onDeleteGroup, onEditItem, onDeleteItem, onActual,
}: {
  group: ExpenseGroup;
  items: ExpenseItem[];
  collapsed: boolean;
  done: boolean;
  onToggle: () => void;
  onToggleDone: () => void;
  onAddItem: () => void;
  onShare: () => void;
  onEditGroup: () => void;
  onDeleteGroup: () => void;
  onEditItem: (item: ExpenseItem) => void;
  onDeleteItem: (item: ExpenseItem) => void;
  onActual: (item: ExpenseItem, value: string) => void;
}) {
  const planned = items.reduce((s, i) => s + i.planned, 0);
  const actual = items.reduce((s, i) => s + i.actual, 0);
  const over = planned > 0 && actual > planned;
  const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
  const bodyId = `grupo-${group.id}`;

  return (
    <section
      aria-labelledby={`${bodyId}-titulo`}
      className="overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex items-start gap-1 py-2 pl-3 pr-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg px-1 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              {done ? (
                <CircleCheck className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden="true" />
              ) : (
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} aria-hidden="true" />
              )}
              <h2 id={`${bodyId}-titulo`} className={cn("truncate text-[11px] font-black uppercase tracking-[0.18em]", done && "text-muted-foreground")}>
                {group.name}
              </h2>
            </span>
            <span className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
              <span className={cn("font-display text-xl font-black leading-none tabular-nums", done ? "text-muted-foreground" : over && "text-destructive")}>
                {fmt(actual)}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                gasto{planned > 0 ? ` de ${fmt(planned)} planejado` : ""} · {items.length} {items.length === 1 ? "item" : "itens"}
              </span>
            </span>
          </span>
        </button>
        <button type="button" className={ICON_BTN} onClick={onAddItem} aria-label={`Adicionar item em ${group.name}`} title="Adicionar item">
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" className={ICON_BTN} onClick={onShare} aria-label={`Compartilhar ${group.name} no WhatsApp`} title="Compartilhar">
          <Share2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={ICON_BTN} onClick={onEditGroup} aria-label={`Editar grupo ${group.name}`} title="Editar grupo">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`${ICON_BTN} hover:bg-destructive/10 hover:text-destructive`}
          onClick={onDeleteGroup}
          aria-label={`Excluir grupo ${group.name}`}
          title="Excluir grupo"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-3 pb-3 pl-4 pr-3">
        {planned > 0 ? (
          <div
            className={cn("h-1 flex-1 overflow-hidden rounded-full transition-opacity duration-300", done && "opacity-35")}
            aria-hidden="true"
            style={{ backgroundColor: `${group.color}26` }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%`, backgroundColor: over && !done ? "hsl(var(--destructive))" : group.color }}
            />
          </div>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          onClick={onToggleDone}
          aria-pressed={done}
          aria-label={done ? `${group.name} está feito neste mês. Desmarcar` : `Marcar ${group.name} como feito neste mês`}
          className={cn(
            "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation md:min-h-8",
            done
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400"
              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
          )}
        >
          {done ? <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5" aria-hidden="true" />}
          {done ? "Feito" : "Marcar como feito"}
        </button>
      </div>

      {!collapsed && (
        <div id={bodyId} className="border-t">
          {items.length === 0 ? (
            <button
              type="button"
              onClick={onAddItem}
              className="flex w-full items-center justify-center gap-1.5 px-4 py-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar o primeiro item
            </button>
          ) : (
            <ul className="divide-y divide-border/40">
              <li aria-hidden="true" className="flex items-center justify-between gap-2 pb-1 pl-4 pr-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                <span className="pl-3.5">Item · planejado</span>
                <span className="flex shrink-0 items-center gap-0.5">
                  <span className="w-[5.5rem] pr-3 text-right sm:w-24">Gasto real</span>
                  <span className="w-10 md:w-9" />
                  <span className="w-10 md:w-9" />
                </span>
              </li>
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2 pl-4 pr-2 transition-colors hover:bg-muted/10">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.type === "fixo" ? "bg-blue-500" : "bg-orange-400"}`}
                      title={item.type === "fixo" ? "Fixo" : "Variável"}
                    />
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium leading-snug">{item.name}</span>
                      {item.installment_id ? (
                        <span className="text-[10px] text-muted-foreground/70">Parcelamento · lançado automaticamente</span>
                      ) : item.planned > 0 && (
                        <span className={`text-[10px] tabular-nums ${item.actual > item.planned ? "text-destructive" : "text-muted-foreground/70"}`}>
                          Planejado {fmt(item.planned)}
                          {item.actual > item.planned && ` · ${fmt(item.actual - item.planned)} acima`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Input
                      type="number"
                      inputMode="decimal"
                      aria-label={`Valor real de ${item.name}`}
                      className="h-9 w-[5.5rem] border-border/40 bg-muted/30 text-right text-sm tabular-nums focus:bg-background sm:w-24"
                      defaultValue={item.actual || ""}
                      placeholder="0,00"
                      onBlur={(e) => onActual(item, e.target.value)}
                    />
                    <button type="button" className={ICON_BTN} onClick={() => onEditItem(item)} aria-label={`Editar ${item.name}`}>
                      <Pencil className="h-3 w-3" />
                    </button>
                    {item.installment_id ? (
                      <Link
                        href="/parcelamentos"
                        className={ICON_BTN}
                        aria-label={`Gerenciar ${item.name} em Parcelamentos`}
                        title="Gerenciar em Parcelamentos"
                      >
                        <Layers className="h-3 w-3" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={`${ICON_BTN} hover:bg-destructive/10 hover:text-destructive`}
                        onClick={() => onDeleteItem(item)}
                        aria-label={`Excluir ${item.name}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

