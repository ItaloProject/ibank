"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/context/user-context";
import { UserSelect } from "@/components/user-select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, Wallet,
  Target, Loader2, LogOut, TrendingUp, PiggyBank,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency, formatDate } from "@/lib/utils";
import { USERS } from "@/lib/user";

interface CashFlow {
  id: string;
  user_id: string;
  month: string;
  description: string;
  type: "entrada" | "saida";
  amount: number;
  date: string;
}

function toFlow(r: Record<string, unknown>): CashFlow {
  return {
    ...r,
    amount: Number(r.amount),
    date: String(r.date).slice(0, 10),
  } as CashFlow;
}

export default function EntradaSaidaPage() {
  const { userId } = useUser();
  if (!userId) return <UserSelect />;
  return <EntradaSaidaContent userId={userId} />;
}

function EntradaSaidaContent({ userId }: { userId: string }) {
  const { switchUser } = useUser();
  const currentUser = USERS.find((u) => u.id === userId)!;
  const [flows, setFlows] = useState<CashFlow[]>([]);
  const [goal, setGoal] = useState(0);
  const [savedAmount, setSavedAmount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [entryOpen, setEntryOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [editing, setEditing] = useState<CashFlow | null>(null);
  const [form, setForm] = useState({
    description: "",
    type: "entrada" as "entrada" | "saida",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
  });
  const [goalInput, setGoalInput] = useState("");
  const [savedInput, setSavedInput] = useState("");

  const loadData = useCallback(async () => {
    const [flowsRes, goalRes] = await Promise.all([
      fetch(`/api/cash-flows?user=${userId}`),
      fetch(`/api/savings-goals?user=${userId}`),
    ]);
    const flowsData = await flowsRes.json();
    const goalData = await goalRes.json();
    setFlows(Array.isArray(flowsData) ? flowsData.map(toFlow) : []);
    const goalAmount = Number(goalData.goal_amount) || 0;
    const saved = Number(goalData.saved_amount) || 0;
    setGoal(goalAmount);
    setSavedAmount(saved);
    setGoalInput(goalAmount > 0 ? String(goalAmount) : "");
    setSavedInput(saved > 0 ? String(saved) : "");
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const entradas = flows.filter((f) => f.type === "entrada");
  const saidas = flows.filter((f) => f.type === "saida");
  const totalEntradas = entradas.reduce((s, f) => s + f.amount, 0);
  const totalSaidas = saidas.reduce((s, f) => s + f.amount, 0);
  const saldo = totalEntradas - totalSaidas;
  const faltaParaMeta = goal > savedAmount ? goal - savedAmount : 0;
  const metaProgress = goal > 0 ? Math.min(Math.max((savedAmount / goal) * 100, 0), 100) : 0;
  const metaAtingida = goal > 0 && savedAmount >= goal;

  function openNew(type: "entrada" | "saida") {
    setEditing(null);
    setForm({
      description: "",
      type,
      amount: "",
      date: format(new Date(), "yyyy-MM-dd"),
    });
    setEntryOpen(true);
  }

  function openEdit(flow: CashFlow) {
    setEditing(flow);
    setForm({
      description: flow.description,
      type: flow.type,
      amount: flow.amount ? String(flow.amount) : "",
      date: flow.date,
    });
    setEntryOpen(true);
  }

  async function submitEntry() {
    if (!form.description.trim() || !form.amount) return;
    const body = {
      user_id: userId,
      description: form.description.trim(),
      type: form.type,
      amount: parseFloat(form.amount) || 0,
      date: form.date,
    };
    if (editing) {
      await fetch(`/api/cash-flows/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/cash-flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    await loadData();
    setEntryOpen(false);
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/cash-flows/${id}`, { method: "DELETE" });
    setFlows((prev) => prev.filter((f) => f.id !== id));
  }

  async function saveGoal() {
    const value = parseFloat(goalInput) || 0;
    await fetch("/api/savings-goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, goal_amount: value, saved_amount: savedAmount }),
    });
    setGoal(value);
    setGoalOpen(false);
  }

  async function saveSavedAmount() {
    const value = parseFloat(savedInput) || 0;
    await fetch("/api/savings-goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, goal_amount: goal, saved_amount: value }),
    });
    setSavedAmount(value);
    setSavedOpen(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Entra/Saída</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Visão geral de entradas, saídas e meta financeira</p>
        </div>
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
            style={{ background: `linear-gradient(135deg, ${currentUser.color} 0%, ${currentUser.color}cc 100%)` }}
          >
            {currentUser.name[0]}
          </div>
          <div className="flex flex-col items-start leading-none">
            <span className="text-[11px] font-medium opacity-50 tracking-wide uppercase" style={{ color: currentUser.color }}>usuário</span>
            <span className="text-sm font-semibold mt-0.5">{currentUser.name}</span>
          </div>
          <LogOut className="h-3.5 w-3.5 ml-1 opacity-40 group-hover:opacity-70 transition-opacity" />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="h-4 w-4 text-green-600" />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Entradas</p>
            </div>
            <p className="text-2xl font-bold text-green-600 tabular-nums">{formatCurrency(totalEntradas)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{entradas.length} registro{entradas.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saídas</p>
            </div>
            <p className="text-2xl font-bold text-destructive tabular-nums">{formatCurrency(totalSaidas)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{saidas.length} registro{saidas.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className={`border-2 ${saldo >= 0 ? "border-green-200" : "border-red-200"}`}
          style={{ background: saldo >= 0 ? "linear-gradient(135deg,#dcfce708,transparent)" : "linear-gradient(135deg,#fee2e208,transparent)" }}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className={`h-4 w-4 ${saldo >= 0 ? "text-green-600" : "text-destructive"}`} />
              <p className="text-xs font-bold uppercase tracking-wide"
                style={{ color: saldo >= 0 ? "#16a34a" : "hsl(var(--destructive))" }}>Saldo</p>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${saldo >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrency(saldo)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">saldo geral</p>
          </CardContent>
        </Card>
      </div>

      {/* Valor guardado */}
      <div
        className="flex flex-col gap-2 rounded-xl border px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-5"
        onClick={() => { setSavedInput(savedAmount > 0 ? String(savedAmount) : ""); setSavedOpen(true); }}
      >
        <div className="flex items-center gap-2.5">
          <PiggyBank className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Valor guardado</span>
        </div>
        <div className="flex items-center gap-3">
          {savedAmount > 0 ? (
            <span className="text-lg font-bold tabular-nums">{formatCurrency(savedAmount)}</span>
          ) : (
            <span className="text-sm text-muted-foreground">Clique para informar</span>
          )}
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Goal card */}
      <Card
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => { setGoalInput(goal > 0 ? String(goal) : ""); setGoalOpen(true); }}
      >
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Meta financeira</p>
              {metaAtingida && (
                <Badge className="bg-green-100 text-green-700 border-green-200">Meta atingida!</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {goal > 0 ? (
                <span className="text-lg font-bold tabular-nums">{formatCurrency(goal)}</span>
              ) : (
                <span className="text-sm text-muted-foreground">Clique para definir</span>
              )}
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          {goal > 0 && (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Progresso com base no valor guardado: <strong className="text-foreground">{formatCurrency(savedAmount)}</strong>
              </p>
              <Progress value={metaProgress} className="h-2 mb-2" />
          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{metaProgress.toFixed(0)}% da meta</span>
                {metaAtingida ? (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Você superou a meta em {formatCurrency(savedAmount - goal)}
                  </span>
                ) : (
                  <span className="font-medium text-foreground">
                    Faltam <strong className="text-primary">{formatCurrency(faltaParaMeta)}</strong> para atingir a meta
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FlowList
          title="Entradas"
          type="entrada"
          items={entradas}
          onAdd={() => openNew("entrada")}
          onEdit={openEdit}
          onDelete={deleteEntry}
        />
        <FlowList
          title="Saídas"
          type="saida"
          items={saidas}
          onAdd={() => openNew("saida")}
          onEdit={openEdit}
          onDelete={deleteEntry}
        />
      </div>

      {/* Dialog: Entry */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar registro" : form.type === "entrada" ? "Nova entrada" : "Nova saída"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                placeholder={form.type === "entrada" ? "Ex: Salário, Freelance" : "Ex: Aluguel, Mercado"}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                placeholder="0,00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEntryOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={submitEntry}>{editing ? "Salvar" : "Adicionar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Goal */}
      <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Meta financeira</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Defina quanto você quer acumular. O progresso considera apenas o valor guardado.
          </p>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label>Valor da meta (R$)</Label>
              <Input
                type="number"
                placeholder="Ex: 3000,00"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveGoal()}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setGoalOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={saveGoal}>Salvar meta</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Valor guardado */}
      <Dialog open={savedOpen} onOpenChange={setSavedOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Valor guardado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Informe quanto você tem guardado agora. Esse valor será usado para calcular o progresso da meta.
          </p>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label>Quanto tenho guardado (R$)</Label>
              <Input
                type="number"
                placeholder="Ex: 15000,00"
                value={savedInput}
                onChange={(e) => setSavedInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveSavedAmount()}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSavedOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={saveSavedAmount}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlowList({
  title,
  type,
  items,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string;
  type: "entrada" | "saida";
  items: CashFlow[];
  onAdd: () => void;
  onEdit: (f: CashFlow) => void;
  onDelete: (id: string) => void;
}) {
  const isEntrada = type === "entrada";
  const total = items.reduce((s, f) => s + f.amount, 0);

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isEntrada
              ? <ArrowDownCircle className="h-4 w-4 text-green-600" />
              : <ArrowUpCircle className="h-4 w-4 text-destructive" />}
            <h2 className="font-semibold">{title}</h2>
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum registro. Clique em &quot;Adicionar&quot; para começar.
          </p>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/40 group/row"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <p className={`text-sm font-semibold tabular-nums ${isEntrada ? "text-green-600" : "text-destructive"}`}>
                    {isEntrada ? "+" : "-"}{formatCurrency(item.amount)}
                  </p>
                  <div className="flex gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(item)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(item.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-2 mt-2 border-t px-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Total</span>
              <span className={`text-sm font-bold tabular-nums ${isEntrada ? "text-green-600" : "text-destructive"}`}>
                {formatCurrency(total)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
