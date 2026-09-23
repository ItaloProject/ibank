"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/context/user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, FolderPlus, TrendingUp, TrendingDown,
  Wallet, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Copy, FileDown, Loader2, DollarSign,
} from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generatePlanReport } from "@/lib/generate-plan-report";
import { USERS } from "@/lib/user";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpenseGroup { id: string; user_id: string; name: string; color: string; }
interface ExpenseItem {
  id: string; group_id: string; user_id: string; month: string;
  name: string; type: "fixo" | "variavel"; planned: number; actual: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_COLORS = [
  "#3b82f6", "#ec4899", "#10b981", "#f59e0b",
  "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16",
];
const DEFAULT_GROUPS = [
  { name: "COMPRAS",    color: "#3b82f6" },
  { name: "ALIMENTAÇÃO",color: "#ec4899" },
  { name: "VEÍCULO",   color: "#10b981" },
  { name: "CASA",       color: "#f59e0b" },
];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toItem(r: Record<string, unknown>): ExpenseItem {
  return { ...r, planned: Number(r.planned), actual: Number(r.actual) } as ExpenseItem;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlanejamentoPage() {
  const { userId } = useUser();
  if (!userId) return null;
  return <PlanejamentoContent userId={userId} />;
}

function PlanejamentoContent({ userId }: { userId: string }) {
  const currentUser = USERS.find(u => u.id === userId);
  const [currentMonth, setCurrentMonth] = useState(() => format(startOfMonth(new Date()), "yyyy-MM"));
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Group form
  const [groupOpen, setGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ExpenseGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupColor, setGroupColor] = useState(GROUP_COLORS[0]);

  // Item form
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItem | null>(null);
  const [itemForm, setItemForm] = useState({
    groupId: "", name: "", type: "fixo" as "fixo" | "variavel", planned: "", actual: "",
  });

  // Copy dialog
  const [copyOpen, setCopyOpen] = useState(false);

  // Salary
  const [salary, setSalary] = useState(0);
  const [salaryInput, setSalaryInput] = useState("");
  const [salaryOpen, setSalaryOpen] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch(`/api/plan-groups?user=${userId}`);
      const data = await res.json();
      if (!Array.isArray(data)) {
        setGroups([]);
        return;
      }
      if (data.length === 0) {
        // Cria grupos padrão na primeira vez
        const created = await Promise.all(
          DEFAULT_GROUPS.map((g) =>
            fetch("/api/plan-groups", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: userId, name: g.name, color: g.color }),
            }).then((r) => r.json())
          )
        );
        setGroups(created.filter((g): g is ExpenseGroup => Boolean(g?.id)));
      } else {
        setGroups(data);
      }
      setLoadError(null);
    } catch (err) {
      console.error("Erro ao carregar grupos de planejamento:", err);
      setLoadError("Não foi possível carregar seu planejamento. Verifique sua conexão.");
    }
  }, [userId]);

  const loadItems = useCallback(async (month: string) => {
    try {
      const [itemsRes, salaryRes] = await Promise.all([
        fetch(`/api/plan-items?user=${userId}&month=${month}`),
        fetch(`/api/plan-salary?user=${userId}&month=${month}`),
      ]);
      const data: Record<string, unknown>[] = await itemsRes.json();
      const salaryData = await salaryRes.json();
      setItems(Array.isArray(data) ? data.map(toItem) : []);
      setSalary(Number(salaryData.salary) || 0);
      setSalaryInput(salaryData.salary > 0 ? String(salaryData.salary) : "");
      setLoadError(null);
    } catch (err) {
      console.error("Erro ao carregar itens de planejamento:", err);
      setLoadError("Não foi possível carregar seu planejamento. Verifique sua conexão.");
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    loadGroups().finally(() => setLoading(false));
  }, [loadGroups]);

  useEffect(() => {
    loadItems(currentMonth);
  }, [currentMonth, loadItems]);

  // ── Month navigation ───────────────────────────────────────────────────────

  const prevMonth = format(subMonths(parseISO(currentMonth + "-01"), 1), "yyyy-MM");
  const monthLabel = format(parseISO(currentMonth + "-01"), "MMMM yyyy", { locale: ptBR });
  const prevMonthLabel = format(parseISO(prevMonth + "-01"), "MMMM yyyy", { locale: ptBR });

  function goToPrev() { setCurrentMonth((m) => format(subMonths(parseISO(m + "-01"), 1), "yyyy-MM")); }
  function goToNext() { setCurrentMonth((m) => format(addMonths(parseISO(m + "-01"), 1), "yyyy-MM")); }

  // ── Copy from previous month ───────────────────────────────────────────────

  async function copyFromPrevious() {
    const res = await fetch(`/api/plan-items?user=${userId}&month=${prevMonth}`);
    const prev: Record<string, unknown>[] = await res.json();
    if (!Array.isArray(prev) || prev.length === 0) return;
    await Promise.all(
      prev.map((item) =>
        fetch("/api/plan-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            group_id: item.group_id,
            month: currentMonth,
            name: item.name,
            type: item.type,
            planned: item.planned,
            actual: 0,
          }),
        })
      )
    );
    await loadItems(currentMonth);
    setCopyOpen(false);
  }

  async function saveSalary() {
    const value = parseFloat(salaryInput) || 0;
    await fetch("/api/plan-salary", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, month: currentMonth, salary: value }),
    });
    setSalary(value);
    setSalaryOpen(false);
  }

  // ── Group actions ──────────────────────────────────────────────────────────

  function openNewGroup() {
    setEditingGroup(null);
    setGroupName("");
    setGroupColor(GROUP_COLORS[groups.length % GROUP_COLORS.length]);
    setGroupOpen(true);
  }

  function openEditGroup(g: ExpenseGroup) {
    setEditingGroup(g);
    setGroupName(g.name);
    setGroupColor(g.color);
    setGroupOpen(true);
  }

  async function submitGroup() {
    if (!groupName.trim()) return;
    if (editingGroup) {
      await fetch(`/api/plan-groups/${editingGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim(), color: groupColor }),
      });
    } else {
      await fetch("/api/plan-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, name: groupName.trim(), color: groupColor }),
      });
    }
    await loadGroups();
    setGroupOpen(false);
  }

  async function deleteGroup(id: string) {
    const group = groups.find((g) => g.id === id);
    const count = items.filter((i) => i.group_id === id).length;
    const itemsWarning = count > 0 ? ` e ${count} ${count === 1 ? "item" : "itens"} dentro dele` : "";
    if (!confirm(`Excluir o grupo "${group?.name ?? ""}"${itemsWarning}? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/plan-groups/${id}`, { method: "DELETE" });
    await loadGroups();
    setItems((prev) => prev.filter((i) => i.group_id !== id));
  }

  // ── Item actions ───────────────────────────────────────────────────────────

  function openNewItem(groupId: string) {
    setEditingItem(null);
    setItemForm({ groupId, name: "", type: "fixo", planned: "", actual: "" });
    setItemOpen(true);
  }

  function openEditItem(item: ExpenseItem) {
    setEditingItem(item);
    setItemForm({
      groupId: item.group_id,
      name: item.name,
      type: item.type,
      planned: item.planned ? String(item.planned) : "",
      actual: item.actual ? String(item.actual) : "",
    });
    setItemOpen(true);
  }

  async function submitItem() {
    if (!itemForm.name.trim() || !itemForm.groupId) return;
    const body = {
      user_id: userId,
      group_id: itemForm.groupId,
      month: currentMonth,
      name: itemForm.name.trim(),
      type: itemForm.type,
      planned: parseFloat(itemForm.planned) || 0,
      actual: parseFloat(itemForm.actual) || 0,
    };
    if (editingItem) {
      await fetch(`/api/plan-items/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/plan-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    await loadItems(currentMonth);
    setItemOpen(false);
  }

  async function deleteItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!confirm(`Excluir "${item?.name ?? "este item"}"? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/plan-items/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function updateActual(item: ExpenseItem, val: string) {
    const actual = parseFloat(val) || 0;
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, actual } : i));
    await fetch(`/api/plan-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_id: item.group_id, name: item.name,
        type: item.type, planned: item.planned, actual,
      }),
    });
  }

  function isGroupCollapsed(id: string) {
    return collapsed[id] !== false;
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !isGroupCollapsed(id) }));
  }

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totalFixoPlanned = items.filter(i => i.type === "fixo").reduce((s, i) => s + i.planned, 0);
  const totalFixoActual  = items.filter(i => i.type === "fixo").reduce((s, i) => s + i.actual, 0);
  const totalVarPlanned  = items.filter(i => i.type === "variavel").reduce((s, i) => s + i.planned, 0);
  const totalVarActual   = items.filter(i => i.type === "variavel").reduce((s, i) => s + i.actual, 0);
  const totalPlanned = totalFixoPlanned + totalVarPlanned;
  const totalActual  = totalFixoActual  + totalVarActual;
  const sobra        = salary - totalActual;
  const sobraPlanned = salary - totalPlanned;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <p className="text-destructive font-medium">{loadError}</p>
        <button
          onClick={() => { loadGroups(); loadItems(currentMonth); }}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Planejamento"
        description={<span className="capitalize">{monthLabel}</span>}
        actions={
          <>
            {items.length === 0 && (
              <Button variant="ghost" size="sm" className="min-h-11 text-xs" onClick={() => setCopyOpen(true)}>
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copiar mês anterior</span>
              </Button>
            )}
            {items.length > 0 && (
              <Button variant="ghost" size="sm" className="min-h-11 text-xs" onClick={() => {
                const userName = USERS.find(u => u.id === userId)?.name ?? userId;
                generatePlanReport(
                  groups.map(g => ({ id: g.id, name: g.name, color: g.color })),
                  items.map(i => ({ id: i.id, groupId: i.group_id, name: i.name, type: i.type, planned: i.planned, actual: i.actual })),
                  monthLabel, userName, salary,
                );
              }}>
                <FileDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Gerar PDF</span>
              </Button>
            )}
            <Button onClick={openNewGroup} size="sm" className="min-h-11 text-xs">
              <FolderPlus className="h-3.5 w-3.5" />
              Novo grupo
            </Button>
          </>
        }
      />

      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-2.5 border-b">
        <button onClick={goToPrev} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold capitalize tracking-tight">{monthLabel}</span>
        <button onClick={goToNext} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <PageBody className="px-0 sm:px-0 lg:px-0 pt-0 space-y-0">

      {/* ── Budget overview ─────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4 pb-3 space-y-3 border-b bg-muted/10">
        {/* Renda do mês */}
        <div
          className="flex items-end justify-between cursor-pointer group"
          onClick={() => { setSalaryInput(salary > 0 ? String(salary) : ""); setSalaryOpen(true); }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50 mb-0.5">Renda do mês</p>
            <p className={`text-2xl font-bold tabular-nums leading-none ${salary > 0 ? "text-foreground" : "text-muted-foreground/30"}`}>
              {salary > 0 ? fmt(salary) : "— informar"}
            </p>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground/30 group-hover:text-primary transition-colors pb-0.5">
            <Pencil className="h-3 w-3" />
            <span className="text-[11px] font-medium">editar</span>
          </div>
        </div>

        {/* Barra de orçamento */}
        {salary > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-border/60 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${totalActual > salary ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${Math.min(100, (totalActual / salary) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground/50">
              <span>Gasto {fmt(totalActual)}</span>
              <span className={sobra >= 0 ? "text-green-500/70" : "text-destructive/70"}>
                {sobra >= 0 ? `Sobra ${fmt(sobra)}` : `Excedeu ${fmt(Math.abs(sobra))}`}
              </span>
            </div>
          </div>
        )}

        {/* Chips de resumo */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-background border border-blue-500/20 px-3 py-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Fixos</p>
            <p className="text-base font-bold tabular-nums leading-none">{fmt(totalFixoActual)}</p>
            <p className="text-[10px] text-muted-foreground/50 tabular-nums">de {fmt(totalFixoPlanned)}</p>
          </div>
          <div className="rounded-xl bg-background border border-orange-400/20 px-3 py-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Variáveis</p>
            <p className="text-base font-bold tabular-nums leading-none">{fmt(totalVarActual)}</p>
            <p className="text-[10px] text-muted-foreground/50 tabular-nums">de {fmt(totalVarPlanned)}</p>
          </div>
          <div className={`rounded-xl bg-background border px-3 py-3 space-y-1.5 ${sobra >= 0 ? "border-green-500/20" : "border-destructive/20"}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${sobra >= 0 ? "text-green-500" : "text-destructive"}`}>Sobra</p>
            <p className={`text-base font-bold tabular-nums leading-none ${sobra >= 0 ? "text-green-500" : "text-destructive"}`}>
              {salary > 0 ? fmt(sobra) : "—"}
            </p>
            {salary > 0 && <p className="text-[10px] text-muted-foreground/50 tabular-nums">de {fmt(sobraPlanned)}</p>}
          </div>
        </div>
      </div>

      {/* ── Groups ──────────────────────────────────────────────────────────── */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <FolderPlus className="h-9 w-9 text-muted-foreground/20" />
          <p className="font-semibold text-foreground/70">Nenhum grupo criado</p>
          <p className="text-sm text-muted-foreground/50">Clique em &quot;Novo grupo&quot; para começar</p>
        </div>
      ) : (
        <div className="divide-y">
          {groups.map((group) => {
            const groupItems = items.filter(i => i.group_id === group.id);
            const gPlanned = groupItems.reduce((s, i) => s + i.planned, 0);
            const gActual  = groupItems.reduce((s, i) => s + i.actual, 0);
            const over = gPlanned > 0 && gActual > gPlanned;
            const pct = gPlanned > 0 ? Math.min(100, (gActual / gPlanned) * 100) : 0;
            const groupCollapsed = isGroupCollapsed(group.id);

            return (
              <div key={group.id} className={groupItems.length === 0 ? "opacity-60" : ""}>
                {/* Group header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-muted/20 transition-colors"
                  style={{ borderLeft: `4px solid ${group.color}` }}
                  onClick={() => toggleCollapse(group.id)}
                >
                  {/* Esquerda: nome + contagem + barra de progresso */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm tracking-wide uppercase truncate ${groupItems.length === 0 ? "text-muted-foreground" : ""}`}>
                        {group.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40 shrink-0 font-medium">
                        {groupItems.length} {groupItems.length === 1 ? "item" : "itens"}
                      </span>
                    </div>
                    {gPlanned > 0 && (
                      <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${group.color}20` }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: over ? "hsl(var(--destructive))" : group.color }}
                        />
                      </div>
                    )}
                    {groupItems.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/40 mt-0.5">Sem itens neste mês</p>
                    )}
                  </div>

                  {/* Direita: valor + actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <div className="text-right mr-1" onClick={e => e.stopPropagation()}>
                      <p className={`text-sm font-bold tabular-nums ${over ? "text-destructive" : ""}`}>{fmt(gActual)}</p>
                      {gPlanned > 0 && <p className="text-[10px] text-muted-foreground/40 tabular-nums">de {fmt(gPlanned)}</p>}
                    </div>
                    <div className="flex" onClick={e => e.stopPropagation()}>
                      <button type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors touch-manipulation"
                        onClick={() => openEditGroup(group)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors touch-manipulation"
                        onClick={() => deleteGroup(group.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {groupCollapsed
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                      : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" />}
                  </div>
                </div>

                {!groupCollapsed && (
                  <div style={{ borderLeft: `3px solid ${group.color}30` }}>
                    {groupItems.length === 0 ? (
                      <p className="px-5 py-3 text-sm text-muted-foreground/40 italic">
                        Sem itens em {monthLabel}.
                      </p>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {groupItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between px-5 py-2.5 gap-2 hover:bg-muted/10 transition-colors">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.type === "fixo" ? "bg-blue-500" : "bg-orange-400"}`} />
                              <div className="min-w-0">
                                <span className="text-sm font-medium truncate block leading-snug">{item.name}</span>
                                {item.planned > 0 && (
                                  <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                                    plan. {fmt(item.planned)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <Input
                                type="number"
                                inputMode="decimal"
                                className="h-8 text-sm text-right w-[4.5rem] sm:w-24 border-border/40 bg-muted/30 focus:bg-background tabular-nums"
                                defaultValue={item.actual || ""}
                                placeholder="0,00"
                                onBlur={(e) => updateActual(item, e.target.value)}
                              />
                              <button type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground/30 hover:text-foreground transition-colors touch-manipulation"
                                onClick={() => openEditItem(item)}
                                aria-label="Editar item">
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive transition-colors touch-manipulation"
                                onClick={() => deleteItem(item.id)}
                                aria-label="Excluir item">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {/* Subtotal */}
                        <div className="flex items-center justify-between px-5 py-2 bg-muted/20">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">Subtotal</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground/40 tabular-nums">plan. {fmt(gPlanned)}</span>
                            <span className={`text-sm font-bold tabular-nums ${over ? "text-destructive" : ""}`}>{fmt(gActual)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      className="flex items-center gap-2 w-full px-5 py-3 text-xs font-medium text-muted-foreground/40 hover:text-primary border-t border-dashed border-border/30 hover:bg-primary/5 transition-colors"
                      onClick={() => openNewItem(group.id)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar item
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dialog: Salário ────────────────────────────────────────────────── */}
      <Dialog open={salaryOpen} onOpenChange={setSalaryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Salário de {monthLabel}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Informe o valor líquido recebido neste mês. A &quot;Sobra&quot; será calculada automaticamente.
          </p>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label>Valor líquido recebido (R$)</Label>
              <Input
                type="number"
                placeholder="Ex: 5000,00"
                value={salaryInput}
                onChange={(e) => setSalaryInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveSalary()}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSalaryOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={saveSalary}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Copiar mês anterior ────────────────────────────────────── */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Copiar do mês anterior</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Copia todos os itens de <strong className="capitalize">{prevMonthLabel}</strong> para{" "}
            <strong className="capitalize">{monthLabel}</strong>, zerando os valores reais.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setCopyOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={copyFromPrevious}>Copiar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Grupo ──────────────────────────────────────────────────── */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingGroup ? "Editar grupo" : "Novo grupo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do grupo</Label>
              <Input placeholder="Ex: CASA, VEÍCULO, LAZER"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && submitGroup()} />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {GROUP_COLORS.map((c) => (
                  <button key={c} onClick={() => setGroupColor(c)}
                    className={`h-7 w-7 rounded-full transition-all ${groupColor === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setGroupOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={submitGroup}>{editingGroup ? "Salvar" : "Criar grupo"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Item ───────────────────────────────────────────────────── */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingItem ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Grupo</Label>
              <Select value={itemForm.groupId} onValueChange={(v) => setItemForm({ ...itemForm, groupId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: g.color }} />
                        {g.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input placeholder="Ex: Aluguel, Supermercado, Combustível"
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={itemForm.type} onValueChange={(v) => setItemForm({ ...itemForm, type: v as "fixo" | "variavel" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-3.5 w-3.5 text-blue-500" />
                      Fixo — mesmo valor todo mês
                    </div>
                  </SelectItem>
                  <SelectItem value="variavel">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-orange-400" />
                      Variável — valor muda todo mês
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor planejado (R$)</Label>
                <Input type="number" placeholder="0,00" value={itemForm.planned}
                  onChange={(e) => setItemForm({ ...itemForm, planned: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor real (R$)</Label>
                <Input type="number" placeholder="0,00" value={itemForm.actual}
                  onChange={(e) => setItemForm({ ...itemForm, actual: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setItemOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={submitItem}>{editingItem ? "Salvar" : "Adicionar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </PageBody>
    </PageShell>
  );
}
