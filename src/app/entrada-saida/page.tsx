"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/context/user-context";
import { UserSelect } from "@/components/user-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, Wallet,
  Loader2, TrendingUp, PiggyBank, ChevronLeft, ChevronRight,
  CreditCard, BarChart3, CalendarRange,
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/user";

interface CashFlow {
  id: string; user_id: string; month: string;
  description: string; type: "entrada" | "saida";
  amount: number; date: string;
}

function toFlow(r: Record<string, unknown>): CashFlow {
  return { ...r, amount: Number(r.amount), date: String(r.date).slice(0, 10) } as CashFlow;
}

export default function EntradaSaidaPage() {
  const { userId } = useUser();
  if (!userId) return <UserSelect />;
  return <EntradaSaidaContent userId={userId} />;
}

function EntradaSaidaContent({ userId }: { userId: string }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [flows, setFlows] = useState<CashFlow[]>([]);
  const [savedAmount, setSavedAmount] = useState(0);
  const [planejado, setPlanejado] = useState(0);
  const [faturaCartao, setFaturaCartao] = useState(0);
  const [investidoMes, setInvestidoMes] = useState(0);
  const [loading, setLoading] = useState(true);

  const [entryOpen, setEntryOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [editing, setEditing] = useState<CashFlow | null>(null);
  const [form, setForm] = useState({ description: "", type: "entrada" as "entrada" | "saida", amount: "", date: format(new Date(), "yyyy-MM-dd") });
  const [savedInput, setSavedInput] = useState("");

  const monthKey = format(currentMonth, "yyyy-MM");
  const isCurrentMonth = monthKey >= format(new Date(), "yyyy-MM");

  const loadData = useCallback(async () => {
    const uid = getCurrentUser();
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const monthStart = `${monthKey}-01`;
    const monthEnd = `${monthKey}-${String(lastDay).padStart(2, "0")}`;

    const [flowsRes, goalRes, planRes, txRes, invRes, stRes] = await Promise.all([
      fetch(`/api/cash-flows?user=${userId}&month=${monthKey}`),
      fetch(`/api/savings-goals?user=${userId}`),
      fetch(`/api/plan-items?user=${uid}&month=${monthKey}`),
      fetch(`/api/transactions?user=${uid}&billing_cycle=${monthKey}`),
      fetch(`/api/investments?user=${uid}&start=${monthStart}&end=${monthEnd}`),
      fetch(`/api/stock-trades?user=${uid}`),
    ]);
    const [flowsData, goalData, planData, txData, invData, stData] = await Promise.all([
      flowsRes.json(), goalRes.json(), planRes.json(), txRes.json(), invRes.json(), stRes.json(),
    ]);

    setFlows(Array.isArray(flowsData) ? flowsData.map(toFlow) : []);
    const saved = Number(goalData.saved_amount) || 0;
    setSavedAmount(saved);
    setSavedInput(saved > 0 ? String(saved) : "");

    const planItems = Array.isArray(planData) ? planData : [];
    setPlanejado(planItems.reduce((s: number, i: Record<string, unknown>) => s + (Number(i.planned) || 0), 0));

    const txList = Array.isArray(txData) ? txData : [];
    setFaturaCartao(txList.reduce((s: number, t: Record<string, unknown>) => {
      const amt = Number(t.amount) || 0;
      return s + (amt > 0 ? amt : 0);
    }, 0));

    const invList = Array.isArray(invData) ? invData : [];
    const invTotal = invList.reduce((s: number, i: Record<string, unknown>) => {
      const type = String(i.type);
      return type === "deposito" || type === "rendimento" ? s + (Number(i.amount) || 0) : s;
    }, 0);
    const stList = Array.isArray(stData) ? stData : [];
    const acoesMes = stList
      .filter((t: Record<string, unknown>) => t.type === "compra" && String(t.date).slice(0, 7) === monthKey)
      .reduce((s: number, t: Record<string, unknown>) => s + (Number(t.total_amount) || 0), 0);
    setInvestidoMes(invTotal + acoesMes);
  }, [userId, monthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const entradas = flows.filter((f) => f.type === "entrada");
  const saidas = flows.filter((f) => f.type === "saida");
  const totalEntradas = entradas.reduce((s, f) => s + f.amount, 0);
  const totalSaidas = saidas.reduce((s, f) => s + f.amount, 0);
  const saldo = totalEntradas - totalSaidas;
  const sobra = totalEntradas - faturaCartao - investidoMes;

  function openNew(type: "entrada" | "saida") {
    setEditing(null);
    setForm({ description: "", type, amount: "", date: isCurrentMonth ? format(new Date(), "yyyy-MM-dd") : `${monthKey}-01` });
    setEntryOpen(true);
  }
  function openEdit(flow: CashFlow) {
    setEditing(flow);
    setForm({ description: flow.description, type: flow.type, amount: String(flow.amount), date: flow.date });
    setEntryOpen(true);
  }
  async function submitEntry() {
    if (!form.description.trim() || !form.amount) return;
    const body = { user_id: userId, description: form.description.trim(), type: form.type, amount: parseFloat(form.amount) || 0, date: form.date };
    if (editing) {
      await fetch(`/api/cash-flows/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/cash-flows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    await loadData();
    setEntryOpen(false);
  }
  async function deleteEntry(id: string) {
    await fetch(`/api/cash-flows/${id}`, { method: "DELETE" });
    setFlows((prev) => prev.filter((f) => f.id !== id));
  }
  async function saveSavedAmount() {
    const value = parseFloat(savedInput) || 0;
    await fetch("/api/savings-goals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, goal_amount: 0, saved_amount: value }) });
    setSavedAmount(value);
    setSavedOpen(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-2xl font-bold">Entrada/Saída</h1>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 border-b border-border">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-base font-semibold capitalize min-w-[160px] text-center">
          {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
        </span>
        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          disabled={isCurrentMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Resumo 3 colunas */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        <div className="flex flex-col items-center py-4 gap-0.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Entradas</p>
          <p className="text-lg font-bold text-green-600 tabular-nums">{formatCurrency(totalEntradas)}</p>
          <p className="text-[11px] text-muted-foreground">{entradas.length} reg.</p>
        </div>
        <div className="flex flex-col items-center py-4 gap-0.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Saídas</p>
          <p className="text-lg font-bold text-destructive tabular-nums">{formatCurrency(totalSaidas)}</p>
          <p className="text-[11px] text-muted-foreground">{saidas.length} reg.</p>
        </div>
        <div className="flex flex-col items-center py-4 gap-0.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Saldo</p>
          <p className={`text-lg font-bold tabular-nums ${saldo >= 0 ? "text-green-600" : "text-destructive"}`}>{formatCurrency(saldo)}</p>
          <p className="text-[11px] text-muted-foreground">do mês</p>
        </div>
      </div>

      {/* Comparativo automático */}
      <div className="border-b border-border">
        <div className="px-4 pt-4 pb-1 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Comparativo</p>
        </div>
        <div className="px-4 pb-4 space-y-3 mt-2">
          {/* Receita */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4 text-green-600 shrink-0" />
              <span className="text-sm text-muted-foreground">Receita</span>
            </div>
            <span className="text-sm font-bold text-green-600 tabular-nums">{formatCurrency(totalEntradas)}</span>
          </div>

          {[
            { label: "Planejamento", icon: <CalendarRange className="h-4 w-4 text-blue-500 shrink-0" />, value: planejado, color: "bg-blue-500" },
            { label: "Fatura cartão", icon: <CreditCard className="h-4 w-4 text-red-400 shrink-0" />, value: faturaCartao, color: "bg-red-400" },
            { label: "Investido", icon: <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />, value: investidoMes, color: "bg-emerald-500", textColor: "text-emerald-600" },
          ].map(({ label, icon, value, color, textColor }) => {
            const pct = totalEntradas > 0 ? Math.min((value / totalEntradas) * 100, 100) : 0;
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-sm">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{pct.toFixed(0)}%</span>
                    <span className={`text-sm font-semibold tabular-nums ${textColor ?? ""}`}>{formatCurrency(value)}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Wallet className={`h-4 w-4 shrink-0 ${sobra >= 0 ? "text-green-600" : "text-destructive"}`} />
              <span className="text-sm font-medium">Disponível</span>
            </div>
            <span className={`text-base font-bold tabular-nums ${sobra >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrency(sobra)}
            </span>
          </div>
        </div>
      </div>

      {/* Valor guardado */}
      <button
        onClick={() => { setSavedInput(savedAmount > 0 ? String(savedAmount) : ""); setSavedOpen(true); }}
        className="flex items-center justify-between px-4 py-3.5 border-b border-border hover:bg-muted/30 transition-colors w-full text-left"
      >
        <div className="flex items-center gap-2.5">
          <PiggyBank className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Valor guardado</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums">{savedAmount > 0 ? formatCurrency(savedAmount) : <span className="text-muted-foreground font-normal">informar</span>}</span>
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </button>


      {/* Listas de entradas e saídas */}
      <div className="flex-1 divide-y divide-border">
        <FlowSection title="Entradas" type="entrada" items={entradas} onAdd={() => openNew("entrada")} onEdit={openEdit} onDelete={deleteEntry} />
        <FlowSection title="Saídas" type="saida" items={saidas} onAdd={() => openNew("saida")} onEdit={openEdit} onDelete={deleteEntry} />
      </div>

      {/* Dialog: entry */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : form.type === "entrada" ? "Nova entrada" : "Nova saída"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input placeholder={form.type === "entrada" ? "Ex: Salário, Freelance" : "Ex: Aluguel, Mercado"}
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" placeholder="0,00" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEntryOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={submitEntry}>{editing ? "Salvar" : "Adicionar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: saved amount */}
      <Dialog open={savedOpen} onOpenChange={setSavedOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Valor guardado</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Informe quanto você tem guardado agora.</p>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label>Quanto tenho guardado (R$)</Label>
              <Input type="number" placeholder="Ex: 15000,00" value={savedInput}
                onChange={(e) => setSavedInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveSavedAmount()} autoFocus />
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

function FlowSection({ title, type, items, onAdd, onEdit, onDelete }: {
  title: string; type: "entrada" | "saida";
  items: CashFlow[]; onAdd: () => void;
  onEdit: (f: CashFlow) => void; onDelete: (id: string) => void;
}) {
  const isEntrada = type === "entrada";
  const total = items.reduce((s, f) => s + f.amount, 0);
  const [open, setOpen] = useState(true);

  return (
    <div>
      <div className="flex items-center justify-between w-full px-4 py-3.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {isEntrada
            ? <ArrowDownCircle className="h-4 w-4 text-green-600" />
            : <ArrowUpCircle className="h-4 w-4 text-destructive" />}
          <span className="text-sm font-semibold">{title}</span>
          <Badge variant="secondary" className="text-xs px-1.5 h-5">{items.length}</Badge>
          <span className={`ml-auto text-sm font-bold tabular-nums ${isEntrada ? "text-green-600" : "text-destructive"}`}>{formatCurrency(total)}</span>
        </button>
        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs ml-3 shrink-0" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
        </Button>
      </div>

      {open && (
        <div className="pb-1">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-5 px-4">
              Nenhum registro. Toque em &ldquo;Adicionar&rdquo; para começar.
            </p>
          ) : (
            <div>
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 group/row border-t border-border/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <span className={`text-sm font-semibold tabular-nums ${isEntrada ? "text-green-600" : "text-destructive"}`}>
                      {isEntrada ? "+" : "-"}{formatCurrency(item.amount)}
                    </span>
                    <div className="flex gap-0 opacity-0 group-hover/row:opacity-100 transition-opacity ml-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
