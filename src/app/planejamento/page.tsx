"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/context/user-context";
import { UserSelect } from "@/components/user-select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Copy, FileDown, Loader2, LogOut, DollarSign,
} from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generatePlanReport } from "@/lib/generate-plan-report";
import { USERS } from "@/lib/user";

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
  if (!userId) return <UserSelect />;
  return <PlanejamentoContent userId={userId} />;
}

function PlanejamentoContent({ userId }: { userId: string }) {
  const { switchUser } = useUser();
  const currentUser = USERS.find(u => u.id === userId)!;
  const [currentMonth, setCurrentMonth] = useState(() => format(startOfMonth(new Date()), "yyyy-MM"));
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
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
    const res = await fetch(`/api/plan-groups?user=${userId}`);
    const data: ExpenseGroup[] = await res.json();
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
      setGroups(created);
    } else {
      setGroups(data);
    }
  }, [userId]);

  const loadItems = useCallback(async (month: string) => {
    const [itemsRes, salaryRes] = await Promise.all([
      fetch(`/api/plan-items?user=${userId}&month=${month}`),
      fetch(`/api/plan-salary?user=${userId}&month=${month}`),
    ]);
    const data: Record<string, unknown>[] = await itemsRes.json();
    const salaryData = await salaryRes.json();
    setItems(Array.isArray(data) ? data.map(toItem) : []);
    setSalary(Number(salaryData.salary) || 0);
    setSalaryInput(salaryData.salary > 0 ? String(salaryData.salary) : "");
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

  function toggleCollapse(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
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

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planejamento</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Organize seus gastos por grupo</p>
        </div>
        <div className="flex items-center gap-3">
          {/* User switcher */}
          <button
            onClick={switchUser}
            className="group flex items-center gap-2.5 rounded-xl border border-white/10 px-3 py-2 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${currentUser.color}22 0%, ${currentUser.color}10 100%)`,
              borderColor: `${currentUser.color}40`,
              boxShadow: `0 2px 8px ${currentUser.color}20`,
            }}
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-inner shrink-0 ring-2 ring-white/20"
              style={{
                background: `linear-gradient(135deg, ${currentUser.color} 0%, ${currentUser.color}cc 100%)`,
              }}
            >
              {currentUser.name[0]}
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[11px] font-medium opacity-50 tracking-wide uppercase" style={{ color: currentUser.color }}>usuário</span>
              <span className="text-sm font-semibold mt-0.5">{currentUser.name}</span>
            </div>
            <LogOut className="h-3.5 w-3.5 ml-1 opacity-40 group-hover:opacity-70 transition-opacity" />
          </button>
          {items.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)}>
              <Copy className="h-3.5 w-3.5" />
              Copiar mês anterior
            </Button>
          )}
          {items.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => {
              const userName = USERS.find(u => u.id === userId)?.name ?? userId;
              generatePlanReport(
                groups.map(g => ({ id: g.id, name: g.name, color: g.color })),
                items.map(i => ({ id: i.id, groupId: i.group_id, name: i.name, type: i.type, planned: i.planned, actual: i.actual })),
                monthLabel,
                userName,
              );
            }}>
              <FileDown className="h-3.5 w-3.5" />
              Gerar PDF
            </Button>
          )}
          <Button onClick={openNewGroup} variant="outline">
            <FolderPlus className="h-4 w-4" />
            Novo grupo
          </Button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={goToPrev}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-lg font-semibold capitalize w-44 text-center">{monthLabel}</span>
        <Button variant="ghost" size="icon" onClick={goToNext}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Salário */}
      <div
        className="flex items-center justify-between rounded-xl border px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => { setSalaryInput(salary > 0 ? String(salary) : ""); setSalaryOpen(true); }}
      >
        <div className="flex items-center gap-2.5">
          <DollarSign className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">Salário recebido em {monthLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          {salary > 0 ? (
            <span className="text-lg font-bold text-green-600 tabular-nums">{fmt(salary)}</span>
          ) : (
            <span className="text-sm text-muted-foreground">Clique para informar</span>
          )}
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Gastos Fixos</p>
            </div>
            <p className="text-2xl font-bold">{fmt(totalFixoActual)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">planejado: {fmt(totalFixoPlanned)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-orange-400" />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Gastos Variáveis</p>
            </div>
            <p className="text-2xl font-bold">{fmt(totalVarActual)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">planejado: {fmt(totalVarPlanned)}</p>
          </CardContent>
        </Card>
        <Card className={`border-2 ${sobra >= 0 ? "border-green-200" : "border-red-200"}`}
          style={{ background: sobra >= 0 ? "linear-gradient(135deg,#dcfce708,transparent)" : "linear-gradient(135deg,#fee2e208,transparent)" }}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className={`h-3.5 w-3.5 ${sobra >= 0 ? "text-green-600" : "text-destructive"}`} />
              <p className="text-xs font-bold uppercase tracking-wide"
                style={{ color: sobra >= 0 ? "#16a34a" : "hsl(var(--destructive))" }}>Sobra</p>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${sobra >= 0 ? "text-green-600" : "text-destructive"}`}>
              {salary > 0 ? fmt(sobra) : "—"}
            </p>
            {salary > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                planejado: {fmt(sobraPlanned)}
              </p>
            )}
            {salary === 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">informe o salário acima</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderPlus className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum grupo criado</p>
          <p className="text-sm mt-1">Clique em &quot;Novo grupo&quot; para começar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const groupItems = items.filter(i => i.group_id === group.id);
            const gPlanned = groupItems.reduce((s, i) => s + i.planned, 0);
            const gActual  = groupItems.reduce((s, i) => s + i.actual, 0);
            const over = gPlanned > 0 && gActual > gPlanned;
            const isCollapsed = collapsed[group.id];

            return (
              <Card key={group.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                  onClick={() => toggleCollapse(group.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    <span className="font-bold text-sm tracking-wide uppercase">{group.name}</span>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {groupItems.length} {groupItems.length === 1 ? "item" : "itens"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${over ? "text-destructive" : ""}`}>{fmt(gActual)}</p>
                      {gPlanned > 0 && <p className="text-xs text-muted-foreground">/ {fmt(gPlanned)}</p>}
                    </div>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditGroup(group)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteGroup(group.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {!isCollapsed && (
                  <CardContent className="px-5 pb-4 pt-0">
                    {groupItems.length > 0 && (
                      <div className="grid grid-cols-[1fr_80px_110px_110px_72px] gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2 px-1">
                        <span>Descrição</span><span>Tipo</span>
                        <span className="text-right">Planejado</span>
                        <span className="text-right">Real</span>
                        <span />
                      </div>
                    )}

                    <div className="space-y-1">
                      {groupItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2 px-1">
                          Nenhum item em {monthLabel}. Clique em &quot;Adicionar&quot; para começar.
                        </p>
                      ) : (
                        groupItems.map((item) => (
                          <div key={item.id}
                            className="grid grid-cols-[1fr_80px_110px_110px_72px] gap-2 items-center py-1.5 px-1 rounded-lg hover:bg-muted/40 group/row">
                            <div className="flex items-center gap-2">
                              {item.type === "fixo"
                                ? <TrendingDown className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                : <TrendingUp className="h-3.5 w-3.5 text-orange-400 shrink-0" />}
                              <span className="text-sm font-medium cursor-pointer hover:underline"
                                onClick={() => openEditItem(item)}>
                                {item.name}
                              </span>
                            </div>
                            <Badge className={`text-xs w-fit px-2 py-0 border ${item.type === "fixo" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}>
                              {item.type === "fixo" ? "Fixo" : "Variável"}
                            </Badge>
                            <p className="text-sm text-right text-muted-foreground">
                              {item.planned > 0 ? fmt(item.planned) : "—"}
                            </p>
                            <div className="flex justify-end">
                              <Input
                                type="number"
                                className="h-7 text-xs text-right w-28"
                                defaultValue={item.actual || ""}
                                placeholder="0,00"
                                onBlur={(e) => updateActual(item, e.target.value)}
                              />
                            </div>
                            <div className="flex justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditItem(item)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteItem(item.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {groupItems.length > 0 && (
                      <div className="grid grid-cols-[1fr_80px_110px_110px_72px] gap-2 mt-2 pt-2 border-t px-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Subtotal</span>
                        <span />
                        <span className="text-xs font-semibold text-right text-muted-foreground">{fmt(gPlanned)}</span>
                        <span className={`text-xs font-bold text-right ${over ? "text-destructive" : "text-foreground"}`}>{fmt(gActual)}</span>
                        <span />
                      </div>
                    )}

                    <Button variant="ghost" size="sm"
                      className="mt-3 h-8 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => openNewItem(group.id)}>
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar item
                    </Button>
                  </CardContent>
                )}
              </Card>
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
            <div className="grid grid-cols-2 gap-3">
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
    </div>
  );
}
