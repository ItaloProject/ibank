"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import Image from "next/image";
import { toast } from "sonner";
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
  Wallet, ChevronDown, ChevronLeft, ChevronRight,
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
  const prefersReduced = useReducedMotion();
  const currentUser = USERS.find(u => u.id === userId);
  const [currentMonth, setCurrentMonth] = useState(() => format(startOfMonth(new Date()), "yyyy-MM"));
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState("");

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

  // Confirm delete dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "group" | "item";
    id: string;
    name: string;
    warning?: string;
  } | null>(null);

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
    try {
      const res = await fetch(`/api/plan-items?user=${userId}&month=${prevMonth}`);
      const prev: Record<string, unknown>[] = await res.json();
      if (!Array.isArray(prev) || prev.length === 0) {
        toast.error("Nenhum item encontrado no mês anterior.");
        setCopyOpen(false);
        return;
      }
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
      toast.success(`${prev.length} itens copiados do mês anterior`);
    } catch {
      toast.error("Erro ao copiar. Tente novamente.");
    }
    setCopyOpen(false);
  }

  async function saveSalary() {
    const value = parseFloat(salaryInput) || 0;
    try {
      await fetch("/api/plan-salary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, month: currentMonth, salary: value }),
      });
      setSalary(value);
      toast.success("Renda atualizada");
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
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
    try {
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
      toast.success(editingGroup ? "Grupo atualizado" : "Grupo criado");
    } catch {
      toast.error("Erro ao salvar grupo. Tente novamente.");
    }
    setGroupOpen(false);
  }

  function openDeleteGroup(g: ExpenseGroup) {
    const count = items.filter((i) => i.group_id === g.id).length;
    setConfirmDialog({
      type: "group",
      id: g.id,
      name: g.name,
      warning: count > 0 ? `Isso também excluirá ${count} ${count === 1 ? "item" : "itens"}.` : undefined,
    });
  }

  async function confirmDeleteGroup(id: string) {
    try {
      await fetch(`/api/plan-groups/${id}`, { method: "DELETE" });
      await loadGroups();
      setItems((prev) => prev.filter((i) => i.group_id !== id));
      toast.success("Grupo excluído");
    } catch {
      toast.error("Erro ao excluir. Tente novamente.");
    }
    setConfirmDialog(null);
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
    try {
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
      toast.success(editingItem ? "Item atualizado" : "Item adicionado");
    } catch {
      toast.error("Erro ao salvar item. Tente novamente.");
    }
    setItemOpen(false);
  }

  function openDeleteItem(item: ExpenseItem) {
    setConfirmDialog({ type: "item", id: item.id, name: item.name });
  }

  async function confirmDeleteItem(id: string) {
    try {
      await fetch(`/api/plan-items/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Item excluído");
    } catch {
      toast.error("Erro ao excluir. Tente novamente.");
    }
    setConfirmDialog(null);
  }

  async function updateActual(item: ExpenseItem, val: string) {
    const actual = parseFloat(val) || 0;
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, actual } : i));
    try {
      await fetch(`/api/plan-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: item.group_id, name: item.name,
          type: item.type, planned: item.planned, actual,
        }),
      });
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
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
      <div role="status" className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 motion-safe:animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Carregando...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <p className="text-destructive font-medium">{loadError}</p>
        <button
          type="button"
          onClick={() => { loadGroups(); loadItems(currentMonth); }}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  const selectedGroup = groups.find(g => g.id === selectedGroupId) ?? groups[0] ?? null;
  const selectedGroupItems = selectedGroup ? items.filter(i => i.group_id === selectedGroup.id) : [];
  const sgPlanned = selectedGroupItems.reduce((s, i) => s + i.planned, 0);
  const sgActual  = selectedGroupItems.reduce((s, i) => s + i.actual,  0);
  const sgOver    = sgPlanned > 0 && sgActual > sgPlanned;

  return (
    <PageShell>
      {/* Desktop: full page header */}
      <div className="hidden md:block">
        <PageHeader
          title="Planejamento"
          description={undefined}
          actions={
            <>
              <div className="flex items-center gap-0.5 mr-1">
                <button type="button" onClick={goToPrev} aria-label="Mês anterior" className="flex min-h-11 min-w-11 h-9 w-9 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold capitalize tracking-tight min-w-[148px] text-center">{monthLabel}</span>
                <button type="button" onClick={goToNext} aria-label="Próximo mês" className="flex min-h-11 min-w-11 h-9 w-9 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <Button variant="ghost" size="sm" className="min-h-11 text-xs" onClick={() => setCopyOpen(true)}>
                <Copy className="h-3.5 w-3.5" />
                Copiar mês anterior
              </Button>
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
                  Gerar PDF
                </Button>
              )}
              <Button onClick={openNewGroup} size="sm" className="min-h-11 text-xs">
                <FolderPlus className="h-3.5 w-3.5" />
                Novo grupo
              </Button>
            </>
          }
        />
      </div>

      {/* Mobile: month navigation only — clean, no action clutter */}
      <div className="md:hidden flex items-center px-2 h-14 border-b shrink-0">
        <button type="button" onClick={goToPrev} aria-label="Mês anterior"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="flex-1 text-center text-[15px] font-bold capitalize tracking-tight">{monthLabel}</span>
        <button type="button" onClick={goToNext} aria-label="Próximo mês"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <PageBody className="px-0 pt-0 space-y-0 md:flex-1 md:min-h-0 md:flex md:flex-col md:overflow-hidden">

        {/* ── BUDGET OVERVIEW — full width, mobile + desktop ──────────────────── */}
        <div className="px-4 sm:px-6 pt-3 pb-3 space-y-2.5 border-b bg-muted/10 shrink-0">
          <button
            type="button"
            className="flex items-end justify-between w-full text-left group"
            onClick={() => { setSalaryInput(salary > 0 ? String(salary) : ""); setSalaryOpen(true); }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/55 mb-0.5">Renda do mês</p>
              <p className={`text-2xl font-display font-black tabular-nums leading-none ${salary > 0 ? "text-foreground" : "text-muted-foreground/30"}`}>
                {salary > 0 ? fmt(salary) : "— informar"}
              </p>
            </div>
            <div className="flex items-center gap-1 text-foreground/55 group-hover:text-primary transition-colors pb-0.5">
              <Pencil className="h-3 w-3" />
              <span className="text-[11px] font-medium">editar</span>
            </div>
          </button>
          {salary > 0 && (
            <div className="space-y-1">
              <div className="h-1.5 rounded-full bg-border/60 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${totalActual > salary ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, (totalActual / salary) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-foreground/55">
                <span>Gasto {fmt(totalActual)}</span>
                <span className={sobra >= 0 ? "text-green-500 dark:text-green-400" : "text-destructive/70"}>
                  {sobra >= 0 ? `Sobra ${fmt(sobra)}` : `Excedeu ${fmt(Math.abs(sobra))}`}
                </span>
              </div>
            </div>
          )}
          {/* Mobile: compact inline summary */}
          <div className="md:hidden flex items-center gap-x-3 flex-wrap gap-y-0.5">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-[11px] text-muted-foreground">Fixos</span>
              <span className="text-[11px] font-display font-black tabular-nums">{fmt(totalFixoActual)}</span>
            </span>
            <span className="text-border/60 text-xs select-none">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
              <span className="text-[11px] text-muted-foreground">Variáveis</span>
              <span className="text-[11px] font-display font-black tabular-nums">{fmt(totalVarActual)}</span>
            </span>
            {salary > 0 && (
              <>
                <span className="text-border/60 text-xs select-none">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${sobra >= 0 ? "bg-green-500" : "bg-destructive"}`} />
                  <span className="text-[11px] text-muted-foreground">Sobra</span>
                  <span className={`text-[11px] font-display font-black tabular-nums ${sobra >= 0 ? "text-green-500 dark:text-green-400" : "text-destructive"}`}>
                    {fmt(Math.abs(sobra))}
                  </span>
                </span>
              </>
            )}
          </div>
          {/* Desktop: 3-card grid */}
          <div className="hidden md:grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-background border border-blue-500/20 px-3 py-3 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Fixos</p>
              <p className="text-base font-display font-black tabular-nums leading-none">{fmt(totalFixoActual)}</p>
              <p className="text-[10px] text-muted-foreground/65 tabular-nums">de {fmt(totalFixoPlanned)}</p>
            </div>
            <div className="rounded-xl bg-background border border-orange-400/20 px-3 py-3 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Variáveis</p>
              <p className="text-base font-display font-black tabular-nums leading-none">{fmt(totalVarActual)}</p>
              <p className="text-[10px] text-muted-foreground/65 tabular-nums">de {fmt(totalVarPlanned)}</p>
            </div>
            <div className={`rounded-xl bg-background border px-3 py-3 space-y-1.5 ${sobra >= 0 ? "border-green-500/20" : "border-destructive/20"}`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${sobra >= 0 ? "text-green-500 dark:text-green-400" : "text-destructive"}`}>Sobra</p>
              <p className={`text-base font-display font-black tabular-nums leading-none ${sobra >= 0 ? "text-green-500 dark:text-green-400" : "text-destructive"}`}>
                {salary > 0 ? fmt(sobra) : "—"}
              </p>
              {salary > 0 && <p className="text-[10px] text-muted-foreground/65 tabular-nums">de {fmt(sobraPlanned)}</p>}
            </div>
          </div>
        </div>

        {/* ── DESKTOP: horizontal tab bar ─────────────────────────────────────── */}
        {groups.length > 0 && (
          <div
            role="tablist"
            aria-label="Grupos de despesas"
            onKeyDown={(e) => {
              if (!selectedGroup) return;
              const idx = groups.findIndex(g => g.id === selectedGroup.id);
              if (e.key === "ArrowRight") { e.preventDefault(); setSelectedGroupId(groups[(idx + 1) % groups.length].id); }
              if (e.key === "ArrowLeft") { e.preventDefault(); setSelectedGroupId(groups[(idx - 1 + groups.length) % groups.length].id); }
            }}
            className="hidden md:flex items-end border-b shrink-0 px-6 overflow-x-auto"
          >
            {groups.map((group, index) => {
              const gItems   = items.filter(i => i.group_id === group.id);
              const gPlanned = gItems.reduce((s, i) => s + i.planned, 0);
              const gActual  = gItems.reduce((s, i) => s + i.actual,  0);
              const gOver    = gPlanned > 0 && gActual > gPlanned;
              const gPct     = gPlanned > 0 ? Math.min(100, (gActual / gPlanned) * 100) : 0;
              const isSelected = selectedGroup?.id === group.id;
              return (
                <motion.button
                  key={group.id}
                  role="tab"
                  aria-selected={isSelected}
                  initial={{ opacity: 0, y: prefersReduced ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: prefersReduced ? 0 : index * 0.04, duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`relative flex flex-col items-start px-5 pt-3 pb-2.5 min-w-[160px] shrink-0 transition-colors ${
                    isSelected ? "bg-muted/20" : "hover:bg-muted/10"
                  }`}
                >
                  <div className="flex items-center gap-2 w-full mb-1">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    <span className={`text-[10px] font-bold uppercase tracking-widest truncate ${
                      isSelected ? "text-foreground" : "text-foreground/50"
                    }`}>{group.name}</span>
                  </div>
                  <span className={`text-lg font-display font-black tabular-nums leading-none ${
                    gOver ? "text-destructive" : isSelected ? "text-foreground" : "text-foreground/55"
                  }`}>{fmt(gActual)}</span>
                  {gPlanned > 0 && (
                    <>
                      <div className="w-full mt-2 h-0.5 rounded-full" style={{ backgroundColor: `${group.color}30` }}>
                        <div className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${gPct}%`, backgroundColor: gOver ? "hsl(var(--destructive))" : group.color }} />
                      </div>
                      <p className="text-[10px] text-foreground/50 tabular-nums mt-0.5">de {fmt(gPlanned)}</p>
                    </>
                  )}
                  {/* Active indicator */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-200"
                    style={{ backgroundColor: isSelected ? group.color : "transparent" }}
                  />
                </motion.button>
              );
            })}
            <div className="flex-1 min-w-4" />
            <button
              onClick={openNewGroup}
              className="flex items-center gap-1.5 px-3 py-2 self-center shrink-0 text-xs font-medium text-foreground/55 hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Novo grupo
            </button>
          </div>
        )}

        {/* ── MOBILE: horizontal chip row + actions at end ──────────────────────── */}
        <div className="md:hidden border-b shrink-0">
          <div className="flex gap-2 overflow-x-auto px-4 py-2.5" style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
            {groups.map(group => {
              const isSelected = selectedGroup?.id === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full text-xs font-bold uppercase tracking-wide transition-all ${
                    isSelected ? "text-white shadow-sm" : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                  style={isSelected ? { backgroundColor: group.color } : {}}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : group.color }}
                  />
                  {group.name}
                </button>
              );
            })}
            {/* Separator + New Group at end of chip row */}
            {groups.length > 0 && <div className="w-px bg-border/40 shrink-0 self-stretch my-2" />}
            <button
              onClick={openNewGroup}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full text-xs font-medium text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-all"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Novo grupo
            </button>
            <button
              onClick={() => setCopyOpen(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full text-xs font-medium text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-all"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar mês
            </button>
            {items.length > 0 && (
              <button
                onClick={() => {
                  const userName = USERS.find(u => u.id === userId)?.name ?? userId;
                  generatePlanReport(
                    groups.map(g => ({ id: g.id, name: g.name, color: g.color })),
                    items.map(i => ({ id: i.id, groupId: i.group_id, name: i.name, type: i.type, planned: i.planned, actual: i.actual })),
                    monthLabel, userName, salary,
                  );
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full text-xs font-medium text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-all"
              >
                <FileDown className="h-3.5 w-3.5" />
                PDF
              </button>
            )}
          </div>
        </div>

        {/* ── CONTENT AREA: full width ─────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {groups.length === 0 ? (
            <motion.div
              className="flex flex-col items-center justify-center py-20 gap-2"
              initial={{ opacity: 0, scale: prefersReduced ? 1 : 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <Image src="/logo-dark.png" alt="" width={64} height={64} className="h-16 w-16 object-contain opacity-30 dark:hidden" />
              <Image src="/logo-white.png" alt="" width={64} height={64} className="h-16 w-16 object-contain opacity-30 hidden dark:block" />
              <p className="font-semibold text-foreground/70">Nenhum grupo criado</p>
              <p className="text-sm text-muted-foreground/50">Clique em &quot;Novo grupo&quot; para começar</p>
            </motion.div>
          ) : selectedGroup ? (
            <div>
              {/* Group header — mobile: progress + add button in one compact row */}
              <div className="md:hidden flex items-center gap-3 px-4 py-2.5 border-b">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedGroup.color }} />
                {sgPlanned > 0 ? (
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${selectedGroup.color}20` }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (sgActual / sgPlanned) * 100)}%`,
                          backgroundColor: sgOver ? "hsl(var(--destructive))" : selectedGroup.color,
                        }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground/70 tabular-nums">
                      <span>{fmt(sgActual)}</span>
                      <span className={sgOver ? "text-destructive/70" : ""}>de {fmt(sgPlanned)}</span>
                    </div>
                  </div>
                ) : (
                  <span className="flex-1 text-[11px] text-muted-foreground/65 font-medium">
                    {selectedGroupItems.length} {selectedGroupItems.length === 1 ? "item" : "itens"}
                  </span>
                )}
                <button
                  className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
                  onClick={() => openNewItem(selectedGroup.id)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo
                </button>
              </div>

              {/* Group header — desktop: full name + edit/delete + add */}
              <div className="hidden md:flex items-center justify-between px-6 py-3 border-b">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: selectedGroup.color }} />
                  <h2 className="font-bold text-sm uppercase tracking-wide">{selectedGroup.name}</h2>
                  <span className="text-[10px] text-muted-foreground/65 font-medium">
                    {selectedGroupItems.length} {selectedGroupItems.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="flex min-h-9 min-w-9 items-center justify-center rounded-lg hover:bg-muted text-foreground/50 hover:text-foreground transition-colors"
                    onClick={() => openEditGroup(selectedGroup)}
                    aria-label={`Editar grupo ${selectedGroup.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="flex min-h-9 min-w-9 items-center justify-center rounded-lg hover:bg-destructive/10 text-foreground/50 hover:text-destructive transition-colors"
                    onClick={() => openDeleteGroup(selectedGroup)}
                    aria-label={`Excluir grupo ${selectedGroup.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    onClick={() => openNewItem(selectedGroup.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar item
                  </button>
                </div>
              </div>

              {/* Group progress bar — desktop only */}
              {sgPlanned > 0 && (
                <div className="hidden md:block px-6 py-2.5 border-b bg-muted/5 space-y-1">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${selectedGroup.color}20` }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (sgActual / sgPlanned) * 100)}%`,
                        backgroundColor: sgOver ? "hsl(var(--destructive))" : selectedGroup.color,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground/70">
                    <span>Gasto {fmt(sgActual)}</span>
                    <span className={sgOver ? "text-destructive/70" : ""}>de {fmt(sgPlanned)}</span>
                  </div>
                </div>
              )}

              {/* Items */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedGroup.id}
                  initial={{ opacity: 0, y: prefersReduced ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  {selectedGroupItems.length === 0 ? (
                    <p className="px-6 py-10 text-sm text-muted-foreground/60 italic text-center">
                      Sem itens em {monthLabel}.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {selectedGroupItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-4 sm:px-6 py-2.5 gap-2 hover:bg-muted/10 transition-colors">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.type === "fixo" ? "bg-blue-500" : "bg-orange-400"}`} />
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate block leading-snug">{item.name}</span>
                              {item.planned > 0 && (
                                <span className="text-[10px] text-muted-foreground/70 tabular-nums">plan. {fmt(item.planned)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Input
                              type="number"
                              inputMode="decimal"
                              aria-label={`Valor real de ${item.name}`}
                              className="h-8 text-sm text-right w-[4.5rem] sm:w-24 border-border/40 bg-muted/30 focus:bg-background tabular-nums"
                              defaultValue={item.actual || ""}
                              placeholder="0,00"
                              onBlur={(e) => updateActual(item, e.target.value)}
                            />
                            <button type="button"
                              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground/60 hover:text-foreground transition-colors touch-manipulation"
                              onClick={() => openEditItem(item)}
                              aria-label={`Editar ${item.name}`}>
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button type="button"
                              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-colors touch-manipulation"
                              onClick={() => openDeleteItem(item)}
                              aria-label={`Excluir ${item.name}`}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-muted/20">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/65">Subtotal</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground/70 tabular-nums">plan. {fmt(sgPlanned)}</span>
                          <span className={`text-sm font-display font-black tabular-nums ${sgOver ? "text-destructive" : ""}`}>{fmt(sgActual)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Mobile: group edit/delete */}
              <div className="md:hidden flex items-center gap-2 px-4 py-3 border-t border-dashed border-border/30 mt-1">
                <button
                  className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={() => openEditGroup(selectedGroup)}
                >
                  <Pencil className="h-3 w-3" />
                  Editar grupo
                </button>
                <button
                  className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-xs font-medium text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => openDeleteGroup(selectedGroup)}
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir grupo
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </PageBody>

      {/* ── Dialog: Salário ──────────────────────────────────────────────────── */}
      <Dialog open={salaryOpen} onOpenChange={setSalaryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Salário de {monthLabel}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Informe o valor líquido recebido neste mês. A &quot;Sobra&quot; será calculada automaticamente.
          </p>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="salary-input">Valor líquido recebido (R$)</Label>
              <Input
                id="salary-input"
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

      {/* ── Dialog: Copiar mês anterior ─────────────────────────────────────── */}
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

      {/* ── Dialog: Grupo ───────────────────────────────────────────────────── */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingGroup ? "Editar grupo" : "Novo grupo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="group-name-input">Nome do grupo</Label>
              <Input id="group-name-input" placeholder="Ex: CASA, VEÍCULO, LAZER"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && submitGroup()}
                autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {GROUP_COLORS.map((c) => (
                  <button key={c} onClick={() => setGroupColor(c)}
                    aria-label={`Selecionar cor ${c}`}
                    aria-pressed={groupColor === c}
                    className={`h-9 w-9 rounded-full transition-all ${groupColor === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
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

      {/* ── Dialog: Item ────────────────────────────────────────────────────── */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingItem ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="item-group-select">Grupo</Label>
              <Select value={itemForm.groupId} onValueChange={(v) => setItemForm({ ...itemForm, groupId: v })}>
                <SelectTrigger id="item-group-select"><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
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
              <Label htmlFor="item-name-input">Descrição</Label>
              <Input id="item-name-input" placeholder="Ex: Aluguel, Supermercado, Combustível"
                value={itemForm.name}
                autoFocus
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-type-select">Tipo</Label>
              <Select value={itemForm.type} onValueChange={(v) => setItemForm({ ...itemForm, type: v as "fixo" | "variavel" })}>
                <SelectTrigger id="item-type-select"><SelectValue /></SelectTrigger>
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
                <Label htmlFor="item-planned-input">Valor planejado (R$)</Label>
                <Input id="item-planned-input" type="number" placeholder="0,00" value={itemForm.planned}
                  onChange={(e) => setItemForm({ ...itemForm, planned: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-actual-input">Valor real (R$)</Label>
                <Input id="item-actual-input" type="number" placeholder="0,00" value={itemForm.actual}
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

      {/* ── Dialog: Confirmar exclusão ──────────────────────────────────────── */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.type === "group" ? "Excluir grupo" : "Excluir item"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmDialog?.type === "group"
              ? <>Excluir <strong>&quot;{confirmDialog.name}&quot;</strong>?{confirmDialog.warning && <> <span className="text-destructive/80">{confirmDialog.warning}</span></>}</>
              : <>Excluir <strong>&quot;{confirmDialog?.name}&quot;</strong>? Esta ação não pode ser desfeita.</>
            }
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1" onClick={() => {
              if (!confirmDialog) return;
              confirmDialog.type === "group" ? confirmDeleteGroup(confirmDialog.id) : confirmDeleteItem(confirmDialog.id);
            }}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
