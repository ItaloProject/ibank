"use client";

import { useEffect, useState, useCallback, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Minus, Trash2, Layers, CheckCircle2, Circle, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpTip } from "@/components/ui/help-tip";
import { useUser } from "@/context/user-context";
import { UserSelect } from "@/components/user-select";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";
import { SplashScreen } from "@/components/splash-screen";

interface Plan {
  id: string;
  description: string;
  total_amount: number;
  installments: number;
  paid_installments: number;
  start_date: string | null;
  plan_group_id: string | null;
  created_at: string;
}

interface PlanGroup {
  id: string;
  name: string;
  color: string;
}

const NO_GROUP = "none";

/** Grupo sugerido para parcelas novas: um de parcelas/fixos, se existir. */
function suggestGroup(groups: PlanGroup[]): string {
  for (const re of [/parcel/i, /fix/i, /compra/i]) {
    const g = groups.find((x) => re.test(x.name));
    if (g) return g.id;
  }
  return groups[0]?.id ?? NO_GROUP;
}

function fmt(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchPlans(userId: string): Promise<Plan[]> {
  const data = await request<unknown>(`/api/parcelamentos?user=${userId}`);
  if (!Array.isArray(data)) throw new Error("Resposta inválida");
  return data as Plan[];
}

async function fetchGroups(): Promise<PlanGroup[]> {
  const data = await request<unknown>("/api/plan-groups");
  return Array.isArray(data) ? (data as PlanGroup[]) : [];
}

function updatePaid(id: string, paid_installments: number): Promise<Plan> {
  return request(`/api/parcelamentos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paid_installments }),
  });
}

function editPlan(id: string, body: Partial<Plan>): Promise<Plan> {
  return request(`/api/parcelamentos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function deletePlan(id: string): Promise<void> {
  await request(`/api/parcelamentos/${id}`, { method: "DELETE" });
}

function createPlan(userId: string, body: Partial<Plan>): Promise<Plan> {
  return request(`/api/parcelamentos?user=${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type FormState = {
  description: string;
  total_amount: string;
  installments: string;
  paid_installments: string;
  start_date: string;
  plan_group_id: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = { description: "", total_amount: "", installments: "", paid_installments: "0", start_date: "", plan_group_id: NO_GROUP };

function parseAmount(raw: string): number {
  const s = raw.trim();
  return parseFloat(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const amount = parseAmount(form.total_amount);
  const installments = Number(form.installments);
  const paid = Number(form.paid_installments || 0);

  if (!form.description.trim()) errors.description = "Informe uma descrição.";
  if (!form.total_amount) errors.total_amount = "Informe o valor total.";
  else if (!(amount > 0)) errors.total_amount = "O valor precisa ser maior que zero.";
  if (!form.installments) errors.installments = "Informe o número de parcelas.";
  else if (!Number.isInteger(installments) || installments < 1 || installments > 120) errors.installments = "Use de 1 a 120 parcelas.";
  if (!Number.isInteger(paid) || paid < 0) errors.paid_installments = "Use um número inteiro a partir de 0.";
  else if (!errors.installments && paid > installments) errors.paid_installments = `No máximo ${installments}.`;
  if (form.plan_group_id !== NO_GROUP && !form.start_date) errors.start_date = "Informe a 1ª parcela para lançar no planejamento.";

  return errors;
}

export default function ParcelamentosPage() {
  const { userId } = useUser();
  if (!userId) return <UserSelect />;
  return <ParcelamentosContent userId={userId} />;
}

function ParcelamentosContent({ userId }: { userId: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [groups, setGroups] = useState<PlanGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedPlans, loadedGroups] = await Promise.all([fetchPlans(userId), fetchGroups().catch(() => [])]);
      setPlans(loadedPlans);
      setGroups(loadedGroups);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  function setField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditingPlan(null);
    setForm({ ...EMPTY_FORM, plan_group_id: suggestGroup(groups) });
    setErrors({});
    setOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    setForm({
      description: plan.description,
      total_amount: Number(plan.total_amount).toFixed(2).replace(".", ","),
      installments: String(plan.installments),
      paid_installments: String(plan.paid_installments),
      start_date: plan.start_date ? String(plan.start_date).slice(0, 10) : "",
      plan_group_id: plan.plan_group_id && groups.some((g) => g.id === plan.plan_group_id) ? plan.plan_group_id : NO_GROUP,
    });
    setErrors({});
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const found = validateForm(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      document.getElementById(`plan-field-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    const body = {
      description: form.description.trim(),
      total_amount: parseAmount(form.total_amount),
      installments: Number(form.installments),
      paid_installments: Number(form.paid_installments || 0),
      start_date: form.start_date || null,
      plan_group_id: form.plan_group_id === NO_GROUP ? null : form.plan_group_id,
    };
    setSaving(true);
    try {
      if (editingPlan) {
        const updated = await editPlan(editingPlan.id, body);
        setPlans((prev) => prev.map((p) => (p.id === editingPlan.id ? updated : p)));
        toast.success("Parcelamento atualizado");
      } else {
        await createPlan(userId, body);
        setPlans(await fetchPlans(userId));
        toast.success("Parcelamento adicionado");
      }
      closeForm();
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePay(plan: Plan, delta: number) {
    const next = Math.min(plan.installments, Math.max(0, plan.paid_installments + delta));
    if (next === plan.paid_installments) return;
    setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, paid_installments: next } : p)));
    try {
      const updated = await updatePaid(plan.id, next);
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
    } catch {
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? plan : p)));
      toast.error("Não foi possível atualizar a parcela.");
    }
  }

  function requestDelete() {
    if (!editingPlan) return;
    const target = { id: editingPlan.id, label: editingPlan.description };
    closeForm();
    setDeleteConfirm(target);
  }

  async function confirmDelete() {
    if (!deleteConfirm || deleting) return;
    setDeleting(true);
    try {
      await deletePlan(deleteConfirm.id);
      setPlans((prev) => prev.filter((p) => p.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      toast.success("Parcelamento excluído");
    } catch {
      toast.error("Não foi possível excluir. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  const active = plans.filter((p) => p.paid_installments < p.installments);
  const done   = plans.filter((p) => p.paid_installments >= p.installments);

  const totalEmAberto    = active.reduce((s, p) => s + (p.installments - p.paid_installments) * (Number(p.total_amount) / p.installments), 0);
  const parcelasMesAtual = active.reduce((s, p) => s + Number(p.total_amount) / p.installments, 0);

  const isFormOpen = open || !!editingPlan;

  if (loading) {
    return <SplashScreen />;
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-muted-foreground">Erro ao carregar parcelamentos.</p>
        <Button type="button" variant="outline" size="sm" onClick={load}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <PageShell>
      {/* Desktop: full page header */}
      <div className="hidden md:block">
        <PageHeader
          title="Parcelamentos"
          description="Compras parceladas em andamento"
          actions={
            <Button size="sm" className="min-h-11" onClick={openNew}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo parcelamento
            </Button>
          }
        />
      </div>

      {/* Mobile: title + add button in one row */}
      <div className="md:hidden flex items-center justify-between px-4 h-14 border-b shrink-0">
        <h1 className="text-lg font-bold">Parcelamentos</h1>
        <button
          type="button"
          aria-label="Novo parcelamento"
          onClick={openNew}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <PageBody>

        {/* ── KPI summary ── */}
        {plans.length > 0 && (
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <div className="min-w-0 rounded-xl bg-card border px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1.5 leading-tight">Em aberto</p>
              <p className="text-sm font-display font-black text-destructive tabular-nums leading-none truncate">{fmt(totalEmAberto)}</p>
            </div>
            <div className="min-w-0 rounded-xl bg-card border px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1.5 leading-tight">Por mês</p>
              <p className="text-sm font-display font-black tabular-nums leading-none truncate">{fmt(parcelasMesAtual)}</p>
            </div>
            <div className="rounded-xl bg-card border px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-1.5 leading-tight">Ativos</p>
              <p className="text-sm font-display font-black tabular-nums leading-none">{active.length}</p>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {plans.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Layers className="h-12 w-12 text-muted-foreground/30" aria-hidden="true" />
            <p className="font-semibold">Nenhum parcelamento</p>
            <p className="text-sm text-muted-foreground max-w-[32ch]">
              Cadastre uma compra parcelada para acompanhar quanto falta e quando termina.
            </p>
            <Button type="button" className="mt-2" onClick={openNew}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo parcelamento
            </Button>
          </div>
        )}

        {/* ── Em andamento ── */}
        {plans.length > 0 && (
          <section className="space-y-2.5" aria-labelledby="plans-active">
            <h2 id="plans-active" className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-0.5">
              Em andamento ({active.length})
            </h2>
            {active.length > 0 ? (
              active.map((plan) => (
                <PlanCard key={plan.id} plan={plan} group={groups.find((g) => g.id === plan.plan_group_id)} onPay={handlePay} onEdit={openEdit} />
              ))
            ) : (
              <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">Tudo quitado</p>
                  <p className="text-xs text-muted-foreground">Nenhuma parcela em aberto.</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Quitados ── */}
        {done.length > 0 && (
          <section className="space-y-2.5" aria-labelledby="plans-done">
            <h2 id="plans-done" className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground px-0.5">
              Quitados ({done.length})
            </h2>
            {done.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onPay={handlePay} onEdit={openEdit} />
            ))}
          </section>
        )}

      </PageBody>

      {/* ── Dialog: criar / editar ── */}
      <Dialog open={isFormOpen} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Editar parcelamento" : "Novo parcelamento"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSave} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="plan-field-description">Descrição</Label>
              <Input
                id="plan-field-description"
                autoFocus
                placeholder="Ex: iPhone 16 Pro"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                {...fieldA11y("description", errors)}
              />
              <FieldError field="description" errors={errors} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-field-total_amount">Valor total (R$)</Label>
                <Input
                  id="plan-field-total_amount"
                  inputMode="decimal"
                  placeholder="3.000,00"
                  value={form.total_amount}
                  onChange={(e) => setField("total_amount", e.target.value)}
                  {...fieldA11y("total_amount", errors)}
                />
                <FieldError field="total_amount" errors={errors} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-field-installments">Parcelas</Label>
                <Input
                  id="plan-field-installments"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={120}
                  placeholder="12"
                  value={form.installments}
                  onChange={(e) => setField("installments", e.target.value)}
                  {...fieldA11y("installments", errors)}
                />
                <FieldError field="installments" errors={errors} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-field-paid_installments" className="flex items-center gap-1.5">
                  Já pagas
                  <HelpTip label="parcelas já pagas">
                    Quantas parcelas você já quitou. Serve para calcular quanto ainda falta pagar. Depois é só usar o + no card a cada parcela paga.
                  </HelpTip>
                </Label>
                <Input
                  id="plan-field-paid_installments"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  value={form.paid_installments}
                  onChange={(e) => setField("paid_installments", e.target.value)}
                  {...fieldA11y("paid_installments", errors)}
                />
                <FieldError field="paid_installments" errors={errors} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-field-start_date" className="flex items-center gap-1.5">
                  1ª parcela em
                  <HelpTip label="data da primeira parcela">
                    Mês em que vence a primeira parcela (na fatura do cartão, geralmente o mês seguinte à compra). Define quando o parcelamento termina e em quais meses a parcela entra no planejamento.
                  </HelpTip>
                </Label>
                <Input
                  id="plan-field-start_date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setField("start_date", e.target.value)}
                  {...fieldA11y("start_date", errors)}
                />
              </div>
            </div>
            <FieldError field="start_date" errors={errors} />
            <div className="space-y-1.5">
              <Label htmlFor="plan-field-plan_group_id" className="flex items-center gap-1.5">
                Lançar no planejamento
                <HelpTip label="lançar no planejamento">
                  Escolha o grupo do Planejamento onde a parcela deve aparecer. Em cada mês do parcelamento, ela entra sozinha como gasto fixo, com o número da parcela (ex.: 3/10). Assim você não precisa digitar todo mês.
                </HelpTip>
              </Label>
              <Select value={form.plan_group_id} onValueChange={(v) => setField("plan_group_id", v)}>
                <SelectTrigger id="plan-field-plan_group_id">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
                        {g.name}
                      </span>
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_GROUP}>Não lançar</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.plan_group_id === NO_GROUP
                  ? "A parcela não aparece no planejamento."
                  : "Cada parcela entra como gasto fixo no mês em que vence."}
              </p>
            </div>
            {parseAmount(form.total_amount) > 0 && Number(form.installments) >= 1 && (
              <p className="text-sm text-center bg-muted/50 rounded-md py-2 text-muted-foreground tabular-nums">
                {fmt(parseAmount(form.total_amount) / Number(form.installments))} / mês
              </p>
            )}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
              {editingPlan ? "Salvar alterações" : "Adicionar"}
            </Button>
            {editingPlan && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={requestDelete}
                disabled={saving}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Excluir parcelamento
              </Button>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: confirmar exclusão ── */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja excluir <span className="font-semibold text-foreground">{deleteConfirm?.label}</span>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancelar</Button>
            <Button type="button" variant="destructive" className="flex-1" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function fieldA11y(field: keyof FormState, errors: FormErrors) {
  return errors[field]
    ? { "aria-invalid": true, "aria-describedby": `plan-field-${field}-error`, className: "border-destructive" }
    : {};
}

function FieldError({ field, errors }: { field: keyof FormState; errors: FormErrors }) {
  if (!errors[field]) return null;
  return (
    <p id={`plan-field-${field}-error`} className="text-xs text-destructive">
      {errors[field]}
    </p>
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
  return base.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const stepButton =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border text-foreground/70 hover:bg-muted hover:text-foreground active:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

function PlanCard({
  plan,
  group,
  onPay,
  onEdit,
}: {
  plan: Plan;
  group?: PlanGroup;
  onPay: (plan: Plan, delta: number) => void;
  onEdit: (plan: Plan) => void;
}) {
  const perParcela    = Number(plan.total_amount) / plan.installments;
  const remaining     = plan.installments - plan.paid_installments;
  const valorRestante = remaining * perParcela;
  const progress      = (plan.paid_installments / plan.installments) * 100;
  const isDone        = plan.paid_installments >= plan.installments;
  const endDate       = calcEndDate(plan);

  return (
    <article className={`rounded-xl border overflow-hidden ${isDone ? "bg-card/50" : "bg-card"}`}>

      {/* ── Row 1: name + edit ── */}
      <div className="flex items-center gap-2 pl-4 pr-1 pt-1">
        <div className="shrink-0" aria-hidden="true">
          {isDone
            ? <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            : <Circle className="h-4 w-4 text-muted-foreground/40" />
          }
        </div>
        <h3 className="font-bold text-base flex-1 min-w-0 truncate leading-snug">{plan.description}</h3>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground/60 hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onEdit(plan)}
          aria-label={`Editar ${plan.description}`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* ── Row 2: subtitle — total + start date ── */}
      <p className="text-[10px] text-muted-foreground tabular-nums pl-10 pr-4 pb-2 -mt-1.5">
        {fmt(plan.total_amount)}{formatStartDate(plan.start_date)}
        {group && plan.start_date && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            {" · "}
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: group.color }} aria-hidden="true" />
            no planejamento em {group.name}
          </span>
        )}
      </p>

      {/* ── Row 3: stepper around progress ── */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <button
          type="button"
          className={stepButton}
          disabled={plan.paid_installments <= 0}
          onClick={() => onPay(plan, -1)}
          aria-label={`Desfazer última parcela de ${plan.description}`}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
            <span aria-live="polite">
              <span className="font-bold text-foreground">{plan.paid_installments}</span> de {plan.installments} pagas
            </span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
            <div
              className={`h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500 ease-out ${isDone ? "bg-emerald-500" : "bg-primary"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          className={stepButton}
          disabled={isDone}
          onClick={() => onPay(plan, +1)}
          aria-label={`Marcar parcela paga de ${plan.description}`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* ── Row 4: financials + end date ── */}
      <div className="flex items-end justify-between gap-2 border-t px-4 py-3">
        <div className="flex items-baseline gap-4 min-w-0">
          <div>
            <p className="text-[10px] text-muted-foreground leading-none mb-1">Por parcela</p>
            <p className="text-sm font-display font-black tabular-nums leading-none">{fmt(perParcela)}</p>
          </div>
          {!isDone && (
            <div>
              <p className="text-[10px] text-muted-foreground leading-none mb-1">Restante</p>
              <p className="text-sm font-display font-black text-destructive tabular-nums leading-none">{fmt(valorRestante)}</p>
            </div>
          )}
        </div>
        {!isDone && endDate && (
          <p className="text-[10px] text-muted-foreground text-right shrink-0">
            até {endDate}
          </p>
        )}
        {isDone && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.18em] shrink-0">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Quitado
          </span>
        )}
      </div>

    </article>
  );
}
