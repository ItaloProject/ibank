"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Layers, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface Plan {
  id: string;
  description: string;
  total_amount: number;
  installments: number;
  paid_installments: number;
  start_date: string | null;
  created_at: string;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const USER = "italo";

async function fetchPlans(): Promise<Plan[]> {
  const res = await fetch(`/api/parcelamentos?user=${USER}`);
  return res.json();
}

async function createPlan(body: Partial<Plan>): Promise<Plan> {
  const res = await fetch(`/api/parcelamentos?user=${USER}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

async function deletePlan(id: string): Promise<void> {
  await fetch(`/api/parcelamentos/${id}`, { method: "DELETE" });
}

export default function ParcelamentosPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    description: "",
    total_amount: "",
    installments: "",
    paid_installments: "0",
    start_date: "",
  });

  const load = useCallback(async () => {
    try {
      const data = await fetchPlans();
      setPlans(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.description || !form.total_amount || !form.installments) return;
    await createPlan({
      description: form.description,
      total_amount: parseFloat(form.total_amount),
      installments: parseInt(form.installments),
      paid_installments: parseInt(form.paid_installments) || 0,
      start_date: form.start_date || null,
    });
    setOpen(false);
    setForm({ description: "", total_amount: "", installments: "", paid_installments: "0", start_date: "" });
    load();
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
  const done = plans.filter((p) => p.paid_installments >= p.installments);

  const totalEmAberto = active.reduce((s, p) => {
    const perParcela = p.total_amount / p.installments;
    return s + (p.installments - p.paid_installments) * perParcela;
  }, 0);

  const parcelasMesAtual = active.reduce((s, p) => s + p.total_amount / p.installments, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Parcelamentos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Acompanhe suas compras parceladas</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Novo parcelamento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Adicionar parcelamento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input placeholder="Ex: iPhone 16 Pro" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Valor total (R$)</Label>
                  <Input type="number" placeholder="3.000,00" value={form.total_amount}
                    onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Número de parcelas</Label>
                  <Input type="number" min={1} max={120} placeholder="12" value={form.installments}
                    onChange={(e) => setForm({ ...form, installments: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Parcelas já pagas</Label>
                  <Input type="number" min={0} placeholder="0" value={form.paid_installments}
                    onChange={(e) => setForm({ ...form, paid_installments: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data da 1ª parcela</Label>
                  <Input type="date" value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
              </div>
              {form.total_amount && form.installments && (
                <p className="text-sm text-muted-foreground text-center bg-muted/50 rounded-md py-2">
                  {fmt(parseFloat(form.total_amount) / (parseInt(form.installments) || 1))} / mês
                </p>
              )}
              <Button className="w-full" onClick={handleCreate}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      {plans.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                Total em aberto
              </p>
              <p className="text-xl font-bold text-destructive tabular-nums">{fmt(totalEmAberto)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                Compromisso mensal
              </p>
              <p className="text-xl font-bold tabular-nums">{fmt(parcelasMesAtual)}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                Itens em andamento
              </p>
              <p className="text-xl font-bold tabular-nums">{active.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state */}
      {plans.length === 0 && (
        <Card className="text-center py-16">
          <CardContent>
            <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum parcelamento cadastrado.</p>
            <p className="text-sm text-muted-foreground">Clique em &quot;Novo parcelamento&quot; para começar.</p>
          </CardContent>
        </Card>
      )}

      {/* Em andamento */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Em andamento ({active.length})
          </h2>
          {active.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onPay={handlePay} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Quitados */}
      {done.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Quitados ({done.length})
          </h2>
          {done.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onPay={handlePay} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  onPay,
  onDelete,
}: {
  plan: Plan;
  onPay: (plan: Plan, delta: number) => void;
  onDelete: (id: string) => void;
}) {
  const perParcela = plan.total_amount / plan.installments;
  const remaining = plan.installments - plan.paid_installments;
  const valorRestante = remaining * perParcela;
  const progress = (plan.paid_installments / plan.installments) * 100;
  const isDone = plan.paid_installments >= plan.installments;

  return (
    <Card className={isDone ? "opacity-60" : ""}>
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {isDone
              ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
            }
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{plan.description}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Total: {fmt(plan.total_amount)}
                {plan.start_date && ` · desde ${new Date(plan.start_date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}`}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isDone
              ? <Badge className="bg-green-100 text-green-700 border-green-200">Quitado</Badge>
              : <Badge variant="outline">{remaining}x restante{remaining !== 1 ? "s" : ""}</Badge>
            }
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(plan.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4 space-y-3">
        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>{plan.paid_installments} de {plan.installments} parcelas pagas</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <Progress value={progress}
            className={`h-2 ${isDone ? "[&>div]:bg-green-500" : ""}`} />
        </div>

        {/* Values + controls */}
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Por parcela</p>
              <p className="text-base font-bold tabular-nums">{fmt(perParcela)}</p>
            </div>
            {!isDone && (
              <div>
                <p className="text-xs text-muted-foreground">Restante</p>
                <p className="text-base font-semibold text-destructive tabular-nums">{fmt(valorRestante)}</p>
              </div>
            )}
          </div>

          {/* Pay/unpay controls */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8"
              disabled={plan.paid_installments <= 0}
              onClick={() => onPay(plan, -1)}
              title="Desfazer última parcela">
              <ChevronDown className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold tabular-nums w-10 text-center">
              {plan.paid_installments}/{plan.installments}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8"
              disabled={isDone}
              onClick={() => onPay(plan, +1)}
              title="Marcar próxima parcela como paga">
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
