"use client";

import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface ExpenseGroup { id: string; user_id: string; name: string; color: string; }
export interface ExpenseItem {
  id: string; group_id: string; user_id: string; month: string;
  name: string; type: "fixo" | "variavel"; planned: number; actual: number;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ICON_BTN = "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation md:h-9 md:w-9";

export function GroupSection({
  group, items, collapsed, onToggle, onAddItem, onEditGroup, onDeleteGroup, onEditItem, onDeleteItem, onActual,
}: {
  group: ExpenseGroup;
  items: ExpenseItem[];
  collapsed: boolean;
  onToggle: () => void;
  onAddItem: () => void;
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
    <section aria-labelledby={`${bodyId}-titulo`} className="overflow-hidden rounded-xl border bg-card">
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
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} aria-hidden="true" />
              <h2 id={`${bodyId}-titulo`} className="truncate text-[11px] font-black uppercase tracking-[0.18em]">{group.name}</h2>
            </span>
            <span className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
              <span className={`font-display text-xl font-black leading-none tabular-nums ${over ? "text-destructive" : ""}`}>{fmt(actual)}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {planned > 0 ? `de ${fmt(planned)} · ` : ""}{items.length} {items.length === 1 ? "item" : "itens"}
              </span>
            </span>
          </span>
        </button>
        <button type="button" className={ICON_BTN} onClick={onAddItem} aria-label={`Adicionar item em ${group.name}`} title="Adicionar item">
          <Plus className="h-4 w-4" />
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

      {planned > 0 && (
        <div className="px-4 pb-3" aria-hidden="true">
          <div className="h-1 overflow-hidden rounded-full" style={{ backgroundColor: `${group.color}26` }}>
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%`, backgroundColor: over ? "hsl(var(--destructive))" : group.color }}
            />
          </div>
        </div>
      )}

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
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2 pl-4 pr-2 transition-colors hover:bg-muted/10">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.type === "fixo" ? "bg-blue-500" : "bg-orange-400"}`}
                      title={item.type === "fixo" ? "Fixo" : "Variável"}
                    />
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-medium leading-snug">{item.name}</span>
                      {item.planned > 0 && (
                        <span className="text-[10px] tabular-nums text-muted-foreground/70">plan. {fmt(item.planned)}</span>
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
                    <button
                      type="button"
                      className={`${ICON_BTN} hover:bg-destructive/10 hover:text-destructive`}
                      onClick={() => onDeleteItem(item)}
                      aria-label={`Excluir ${item.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
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

