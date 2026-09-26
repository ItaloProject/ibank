"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "motion/react";
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
  Plus, Pencil, FolderPlus, TrendingUp, TrendingDown,
  ChevronLeft, ChevronRight, Copy, FileDown,
} from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generatePlanReport } from "@/lib/generate-plan-report";
import { USERS } from "@/lib/user";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";
import { SplashScreen } from "@/components/splash-screen";
import { IncomeDialog, type PlanIncome } from "@/components/planejamento/income-dialog";
import { GroupSection, type ExpenseGroup, type ExpenseItem } from "@/components/planejamento/group-section";

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

const COLLAPSED_KEY = "muvo_plan_collapsed";

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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY);
      if (saved) setCollapsed(new Set(JSON.parse(saved) as string[]));
    } catch { /* todos abertos */ }
  }, []);

  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

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

  // Renda: receitas detalhadas; o total é a renda do mês
  const [incomes, setIncomes] = useState<PlanIncome[]>([]);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const salary = incomes.reduce((s, i) => s + i.amount, 0);

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
      const [itemsRes, incomeRes] = await Promise.all([
        fetch(`/api/plan-items?user=${userId}&month=${month}`),
        fetch(`/api/plan-income?month=${month}`),
      ]);
      const data: Record<string, unknown>[] = await itemsRes.json();
      const incomeData = await incomeRes.json();
      if (!incomeRes.ok) throw new Error(incomeData?.error);
      setItems(Array.isArray(data) ? data.map(toItem) : []);
      setIncomes(Array.isArray(incomeData.incomes) ? incomeData.incomes : []);
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
      const data: Record<string, unknown>[] = await res.json();
      const prev = Array.isArray(data) ? data.filter((item) => !item.installment_id) : [];
      if (prev.length === 0) {
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
    return <SplashScreen />;
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

  function exportPdf() {
    const userName = USERS.find(u => u.id === userId)?.name ?? userId;
    generatePlanReport(
      groups.map(g => ({ id: g.id, name: g.name, color: g.color })),
      items.map(i => ({ id: i.id, groupId: i.group_id, name: i.name, type: i.type, planned: i.planned, actual: i.actual })),
      monthLabel, userName, salary, incomes,
    );
  }
  const allCollapsed = groups.length > 0 && groups.every(g => collapsed.has(g.id));

  function setAllCollapsed(value: boolean) {
    const next = value ? new Set(groups.map(g => g.id)) : new Set<string>();
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  }

  return (
    <PageShell>
      {/* Desktop: full page header */}
      <div className="hidden md:block sticky top-0 z-20 bg-background">
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
                <Button variant="ghost" size="sm" className="min-h-11 text-xs" onClick={exportPdf}>
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
            onClick={() => setSalaryOpen(true)}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/55 mb-0.5">Renda do mês</p>
              <p className={`text-2xl font-display font-black tabular-nums leading-none ${salary > 0 ? "text-foreground" : "text-muted-foreground/30"}`}>
                {salary > 0 ? fmt(salary) : "— informar"}
              </p>
            </div>
            <div className="flex items-center gap-1 text-foreground/55 group-hover:text-foreground transition-colors pb-0.5">
              {incomes.length > 0 ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              <span className="text-[11px] font-medium">{incomes.length > 0 ? "detalhar" : "adicionar"}</span>
            </div>
          </button>
          {incomes.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Receitas do mês">
              {incomes.map((income) => (
                <li
                  key={income.id}
                  className="inline-flex items-baseline gap-1.5 rounded-full border bg-background px-2.5 py-1 max-w-full"
                >
                  <span className="text-[11px] text-muted-foreground truncate">{income.description}</span>
                  <span className="text-[11px] font-display font-black tabular-nums">{fmt(income.amount)}</span>
                </li>
              ))}
            </ul>
          )}
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

        {/* ── MOBILE: ações do mês ─────────────────────────────────────────────── */}
        <div className="md:hidden grid grid-cols-3 gap-1 border-b px-2 py-1.5 shrink-0">
          <button
            type="button"
            onClick={openNewGroup}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Novo grupo
          </button>
          <button
            type="button"
            onClick={() => setCopyOpen(true)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar mês
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={items.length === 0}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <FileDown className="h-3.5 w-3.5" />
            PDF
          </button>
        </div>

        {/* ── GRUPOS: lista vertical, todos visíveis ─────────────────────────────── */}
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
          ) : (
            <div className="space-y-3 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground/55">
                  {groups.length} {groups.length === 1 ? "grupo" : "grupos"}
                </p>
                <button
                  type="button"
                  onClick={() => setAllCollapsed(!allCollapsed)}
                  className="min-h-9 rounded-lg px-2.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {allCollapsed ? "Expandir todos" : "Recolher todos"}
                </button>
              </div>
              <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
                {groups.map((group) => (
                  <GroupSection
                    key={group.id}
                    group={group}
                    items={items.filter((i) => i.group_id === group.id)}
                    collapsed={collapsed.has(group.id)}
                    onToggle={() => toggleGroup(group.id)}
                    onAddItem={() => openNewItem(group.id)}
                    onEditGroup={() => openEditGroup(group)}
                    onDeleteGroup={() => openDeleteGroup(group)}
                    onEditItem={openEditItem}
                    onDeleteItem={openDeleteItem}
                    onActual={updateActual}
                  />
                ))}
                <button
                  type="button"
                  onClick={openNewGroup}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-dashed text-xs font-medium text-muted-foreground hover:border-foreground/30 hover:bg-muted/20 hover:text-foreground transition-colors"
                >
                  <FolderPlus className="h-4 w-4" />
                  Novo grupo
                </button>
              </div>
            </div>
          )}
        </div>
      </PageBody>

      {/* ── Dialog: Renda do mês ─────────────────────────────────────────────── */}
      <IncomeDialog
        open={salaryOpen}
        onOpenChange={setSalaryOpen}
        month={currentMonth}
        monthLabel={monthLabel}
        prevMonth={prevMonth}
        prevMonthLabel={prevMonthLabel}
        incomes={incomes}
        onChange={setIncomes}
      />

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
