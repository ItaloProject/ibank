"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Layers, CheckCircle2, Circle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/context/user-context";
import { UserSelect } from "@/components/user-select";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";

interface Plan {
  id: string;
  description: string;
  total_amount: number;
  installments: number;
  paid_installments: number;
  start_date: string | null;
  created_at: string;
}

function fmt(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ucFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function fetchPlans(userId: string): Promise<Plan[]> {
  const res = await fetch(`/api/parcelamentos?user=${userId}`);
  return res.json();
}

async function updatePaid(id: string, paid_installments: number): Promise<Plan> {
  const res = await fetch(`/api/parcelamentos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paid_installments }),
  });
  return res.json();
}

async function editPlan(id: string, body: Partial<Plan>): Promise<Plan> {
  const res = await fetch(`/api/parcelamentos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function deletePlan(id: string): Promise<void> {
  await fetch(`/api/parcelamentos/${id}`, { method: "DELETE" });
}

async function createPlan(userId: string, body: Partial<Plan>): Promise<Plan> {
  const res = await fetch(`/api/parcelamentos?user=${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function ParcelamentosPage() {
  const { userId } = useUser();
  if (!userId) return <UserSelect />;
  return <ParcelamentosContent userId={userId} />;
}

function ParcelamentosContent({ userId }: { userId: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    description: "",
    total_amount: "",
    installments: "",
    paid_installments: "0",
    start_date: "",
  });

  const load = useCallback(async () => {
    try {
      const data = await fetchPlans(userId);
      setPlans(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    setForm({
      description: plan.description,
      total_amount: String(plan.total_amount),
      installments: String(plan.installments),
      paid_installments: String(plan.paid_installments),
      start_date: plan.start_date ? String(plan.start_date).slice(0, 10) : "",
    });
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditingPlan(null);
    setForm({ description: "", total_amount: "", installments: "", paid_installments: "0", start_date: "" });
  }

  async function handleSave() {
    if (!form.description || !form.total_amount || !form.installments) return;
    if (editingPlan) {
      const updated = await editPlan(editingPlan.id, {
        description: form.description,
        total_amount: parseFloat(form.total_amount),
        installments: parseInt(form.installments),
        paid_installments: parseInt(form.paid_installments) || 0,
        start_date: form.start_date || null,
      });
      setPlans((prev) => prev.map((p) => (p.id === editingPlan.id ? updated : p)));
    } else {
      await createPlan(userId, {
        description: form.description,
        total_amount: parseFloat(form.total_amount),
        installments: parseInt(form.installments),
        paid_installments: parseInt(form.paid_installments) || 0,
        start_date: form.start_date || null,
      });
      await load();
    }
    closeForm();
  }

  async function handlePay(plan: Plan, delta: number) {
    const next = Math.min(plan.installments, Math.max(0, plan.paid_installments + delta));
    if (next === plan.paid_installments) return;
    const updated = await updatePaid(plan.id, next);
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
  }

  async function handleDelete(id: string) {
    await deletePlan(id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }

  const active = plans.filter((p) => p.paid_installments < p.installments);
  const done   = plans.filter((p) => p.paid_installments >= p.installments);

  const totalEmAberto      = active.reduce((s, p) => s + (p.installments - p.paid_installments) * (Number(p.total_amount) / p.installments), 0);
  const parcelasMesAtual   = active.reduce((s, p) => s + Number(p.total_amount) / p.installments, 0);

  const isFormOpen = open || !!editingPlan;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Parcelamentos"
        description="Compras parceladas em andamento"
        actions={
          <Button size="sm" className="min-h-11" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo parcelamento</span>
          </Button>
        }
      />

      <PageBody>

        {/* ── KPI summary ── */}
        {plans.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-card border px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1 leading-tight">Em aberto</p>
              <p className="text-sm font-bold text-destructive tabular-nums leading-none">{fmt(totalEmAberto)}</p>
            </div>
            <div className="rounded-xl bg-card border px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1 leading-tight">Por mês</p>
              <p className="text-sm font-bold tabular-nums leading-none">{fmt(parcelasMesAtual)}</p>
            </div>
            <div className="rounded-xl bg-card border px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-1 leading-tight">Ativos</p>
              <p className="text-sm font-bold tabular-nums leading-none">{active.length}</p>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {plans.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Layers className="h-12 w-12 text-muted-foreground/30" />
            <p className="font-semibold text-muted-foreground">Nenhum parcelamento</p>
            <p className="text-sm text-muted-foreground/60">Toque em &ldquo;Novo parcelamento&rdquo; para começar</p>
          </div>
        )}

        {/* ── Em andamento ── */}
        {active.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 px-0.5">
              Em andamento ({active.length})
            </p>
            {active.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onPay={handlePay} onDelete={handleDelete} onEdit={openEdit} />
            ))}
          </div>
        )}

        {/* ── Quitados ── */}
        {done.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/40 px-0.5">
              Quitados ({done.length})
            </p>
            {done.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onPay={handlePay} onDelete={handleDelete} onEdit={openEdit} />
            ))}
          </div>
        )}

      </PageBody>

      {/* ── Dialog: criar / editar ── */}
      <Dialog open={isFormOpen} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Editar parcelamento" : "Novo parcelamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input placeholder="Ex: iPhone 16 Pro"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor total (R$)</Label>
                <Input type="number" placeholder="3000" value={form.total_amount}
                  onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Parcelas</Label>
                <Input type="number" min={1} max={120} placeholder="12" value={form.installments}
                  onChange={(e) => setForm({ ...form, installments: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Já pagas</Label>
                <Input type="number" min={0} placeholder="0" value={form.paid_installments}
                  onChange={(e) => setForm({ ...form, paid_installments: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>1ª parcela em</Label>
                <Input type="date" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
            </div>
            {form.total_amount && form.installments && (
              <p className="text-sm text-center bg-muted/50 rounded-md py-2 text-muted-foreground">
                {fmt(parseFloat(form.total_amount) / (parseInt(form.installments) || 1))} / mês
              </p>
            )}
            <Button className="w-full" onClick={handleSave}>
              {editingPlan ? "Salvar alterações" : "Adicionar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function formatStartDate(raw: string | null): string {
  if (!raw) return "";
  const dateStr = String(raw).slice(0, 10);
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return "";
  return ` · ${d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}`;
}

function calcEndDate(plan: Plan): string {
  const remaining = plan.installments - plan.paid_installments;
  if (remaining <= 0) return "Quitado";
  let base: Date;
  if (plan.start_date) {
    const dateStr = String(plan.start_date).slice(0, 10);
    base = new Date(dateStr + "T12:00:00");
    if (isNaN(base.getTime())) base = new Date();
    base = new Date(base.getFullYear(), base.getMonth() + (plan.installments - 1), 1);
  } else {
    const now = new Date();
    base = new Date(now.getFullYear(), now.getMonth() + remaining - 1, 1);
  }
  return ucFirst(base.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
}

function PlanCard({
  plan,
  onPay,
  onDelete,
  onEdit,
}: {
  plan: Plan;
  onPay: (plan: Plan, delta: number) => void;
  onDelete: (id: string) => void;
  onEdit: (plan: Plan) => void;
}) {
  const perParcela   = Number(plan.total_amount) / plan.installments;
  const remaining    = plan.installments - plan.paid_installments;
  const valorRestante = remaining * perParcela;
  const progress     = (plan.paid_installments / plan.installments) * 100;
  const isDone       = plan.paid_installments >= plan.installments;
  const endDate      = calcEndDate(plan);

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${isDone ? "opacity-60" : ""}`}>

      {/* ── Row 1: name + stepper ── */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
        <div className="shrink-0">
          {isDone
            ? <CheckCircle2 className="h-4 w-4 text-green-500" />
            : <Circle className="h-4 w-4 text-muted-foreground/40" />
          }
        </div>
        <span className="font-bold text-[15px] flex-1 truncate leading-snug">{plan.description}</span>
        {/* Stepper */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
            disabled={plan.paid_installments <= 0}
            onClick={() => onPay(plan, -1)}
            title="Desfazer parcela">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-bold tabular-nums min-w-[2.6rem] text-center">
            {plan.paid_installments}/{plan.installments}
          </span>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
            disabled={isDone}
            onClick={() => onPay(plan, +1)}
            title="Marcar parcela paga">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </div>
        {/* Edit / delete */}
        <div className="flex items-center gap-0 shrink-0">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => onEdit(plan)} title="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={() => onDelete(plan.id)} title="Excluir">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Row 2: subtitle — total + start date ── */}
      <p className="text-[11px] text-muted-foreground/50 tabular-nums px-4 pb-2 pl-10">
        {fmt(plan.total_amount)}{formatStartDate(plan.start_date)}
      </p>

      {/* ── Row 3: progress bar ── */}
      <div className="px-4 pb-2 space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/40 tabular-nums">
          <span>{plan.paid_installments} de {plan.installments} pagas</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isDone ? "bg-green-500" : "bg-primary"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Row 4: financials + end date ── */}
      <div className="flex items-center justify-between px-4 pb-3 pt-0.5">
        <div className="flex items-baseline gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground/40 leading-none mb-0.5">Por parcela</p>
            <p className="text-sm font-bold tabular-nums leading-none">{fmt(perParcela)}</p>
          </div>
          {!isDone && (
            <div>
              <p className="text-[10px] text-muted-foreground/40 leading-none mb-0.5">Restante</p>
              <p className="text-sm font-semibold text-destructive tabular-nums leading-none">{fmt(valorRestante)}</p>
            </div>
          )}
        </div>
        {!isDone && endDate && (
          <p className="text-[10px] text-muted-foreground/40 text-right shrink-0 ml-2">
            até {endDate}
          </p>
        )}
        {isDone && (
          <span className="text-[10px] font-bold text-green-500 uppercase tracking-wide">Quitado ✓</span>
        )}
      </div>

    </div>
  );
}
