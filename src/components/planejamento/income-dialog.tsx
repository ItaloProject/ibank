"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PlanIncome {
  id: string;
  description: string;
  amount: number;
}

const SUGGESTIONS = ["Salário", "Venda", "Freela", "Aluguel", "Dividendos", "Reembolso"];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Máscara em centavos: digitar "123456" mostra "1.234,56". */
function maskMoney(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoney(masked: string) {
  const digits = masked.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}

function toMasked(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function request(url: string, init?: RequestInit): Promise<{ incomes: PlanIncome[]; copied?: number }> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Não foi possível salvar. Tente novamente.");
  return data;
}

interface IncomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  monthLabel: string;
  prevMonth: string;
  prevMonthLabel: string;
  incomes: PlanIncome[];
  onChange: (incomes: PlanIncome[]) => void;
}

export function IncomeDialog({
  open, onOpenChange, month, monthLabel, prevMonth, prevMonthLabel, incomes, onChange,
}: IncomeDialogProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [copying, setCopying] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);

  const total = incomes.reduce((s, i) => s + i.amount, 0);

  useEffect(() => {
    if (!open) {
      setDescription("");
      setAmount("");
      setEditingId(null);
    }
  }, [open]);

  async function addIncome(e: React.FormEvent) {
    e.preventDefault();
    const desc = description.trim();
    const value = parseMoney(amount);
    if (!desc) { toast.error("Informe a referência, por exemplo Salário."); descriptionRef.current?.focus(); return; }
    if (value <= 0) { toast.error("Informe um valor maior que zero."); return; }
    setAdding(true);
    try {
      const data = await request("/api/plan-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, description: desc, amount: value }),
      });
      onChange(data.incomes);
      setDescription("");
      setAmount("");
      descriptionRef.current?.focus();
      toast.success(`${desc} adicionado`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  function startEdit(income: PlanIncome) {
    setEditingId(income.id);
    setEditDescription(income.description);
    setEditAmount(toMasked(income.amount));
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const desc = editDescription.trim();
    const value = parseMoney(editAmount);
    if (!desc) { toast.error("Informe a referência."); return; }
    if (value <= 0) { toast.error("Informe um valor maior que zero."); return; }
    setBusyId(editingId);
    try {
      const data = await request(`/api/plan-income/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc, amount: value }),
      });
      onChange(data.incomes);
      setEditingId(null);
      toast.success("Receita atualizada");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function removeIncome(income: PlanIncome) {
    setBusyId(income.id);
    try {
      const data = await request(`/api/plan-income/${income.id}`, { method: "DELETE" });
      onChange(data.incomes);
      toast.success(`${income.description} removido`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function copyPrevious() {
    setCopying(true);
    try {
      const data = await request("/api/plan-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, copyFrom: prevMonth }),
      });
      onChange(data.incomes);
      toast.success(`${data.copied} ${data.copied === 1 ? "receita copiada" : "receitas copiadas"} de ${prevMonthLabel}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCopying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Renda de {monthLabel}</DialogTitle>
          <DialogDescription>
            Lance cada valor recebido com uma referência. O total vira a renda do mês e entra no cálculo da sobra.
          </DialogDescription>
        </DialogHeader>

        {incomes.length > 0 ? (
          <ul className="divide-y rounded-xl border" aria-label="Receitas do mês">
            {incomes.map((income) => (
              <li key={income.id} className="px-3 py-2">
                {editingId === income.id ? (
                  <form onSubmit={saveEdit} className="flex items-center gap-2">
                    <Input
                      aria-label="Referência"
                      value={editDescription}
                      maxLength={80}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="h-10 flex-1 min-w-0"
                      autoFocus
                    />
                    <Input
                      aria-label="Valor em reais"
                      inputMode="numeric"
                      value={editAmount}
                      onChange={(e) => setEditAmount(maskMoney(e.target.value))}
                      className="h-10 w-28 text-right tabular-nums"
                    />
                    <button
                      type="submit"
                      disabled={busyId === income.id}
                      aria-label="Salvar receita"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {busyId === income.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancelar edição"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 truncate text-sm font-medium">{income.description}</span>
                    <span className="font-display font-black tabular-nums text-sm">{fmt(income.amount)}</span>
                    <button
                      type="button"
                      onClick={() => startEdit(income)}
                      disabled={busyId !== null}
                      aria-label={`Editar ${income.description}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeIncome(income)}
                      disabled={busyId !== null}
                      aria-label={`Excluir ${income.description}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      {busyId === income.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}
              </li>
            ))}
            <li className="flex items-center justify-between px-3 py-3 bg-muted/30">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground/60">Total do mês</span>
              <span className="font-display font-black tabular-nums text-lg">{fmt(total)}</span>
            </li>
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed px-4 py-5 text-center space-y-3">
            <p className="text-sm text-muted-foreground">Nenhuma receita lançada neste mês.</p>
            <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={copyPrevious} disabled={copying}>
              {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
              <span>Copiar receitas de <span className="capitalize">{prevMonthLabel}</span></span>
            </Button>
          </div>
        )}

        <form onSubmit={addIncome} className="space-y-3 pt-1">
          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="income-description">Referência</Label>
              <Input
                id="income-description"
                ref={descriptionRef}
                placeholder="Ex: Salário"
                value={description}
                maxLength={80}
                onChange={(e) => setDescription(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="income-amount">Valor (R$)</Label>
              <Input
                id="income-amount"
                inputMode="numeric"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(maskMoney(e.target.value))}
                className="text-right tabular-nums"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Sugestões de referência">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={description === s}
                onClick={() => { setDescription(s); document.getElementById("income-amount")?.focus(); }}
                className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
                  description === s
                    ? "border-foreground bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:border-foreground/40"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1 min-h-11" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button type="submit" className="flex-1 min-h-11" disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
