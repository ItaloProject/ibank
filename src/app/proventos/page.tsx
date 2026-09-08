"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, CalendarCheck, Loader2 } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Provento {
  id: number;
  user_id: string;
  ticker: string;
  amount: number;
  payment_day: number;
  type: "dividendo" | "rendimento" | "juros";
  created_at: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TYPE_LABELS: Record<string, string> = {
  dividendo: "Dividendo",
  rendimento: "Rendimento",
  juros: "Juros s/ Capital",
};

const TYPE_COLORS: Record<string, string> = {
  dividendo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rendimento: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  juros: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ProventosPage() {
  const [proventos, setProventos] = useState<Provento[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [ticker, setTicker] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [type, setType] = useState<"dividendo" | "rendimento" | "juros">("dividendo");
  const [formOpen, setFormOpen] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/proventos");
      if (!res.ok) throw new Error("Falha ao carregar proventos");
      const data = await res.json();
      setProventos(
        Array.isArray(data)
          ? data.map((r: Record<string, unknown>) => ({
              ...r,
              amount: Number(r.amount),
              payment_day: Number(r.payment_day),
            })) as Provento[]
          : []
      );
    } catch {
      setProventos([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // ── Add provento ───────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!ticker.trim() || !amount || !paymentDay) return;
    const day = parseInt(paymentDay, 10);
    if (isNaN(day) || day < 1 || day > 31) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/proventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.trim().toUpperCase(),
          amount: parseFloat(amount),
          payment_day: day,
          type,
        }),
      });
      if (res.ok) {
        setTicker("");
        setAmount("");
        setPaymentDay("");
        setType("dividendo");
        setFormOpen(false);
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete provento ────────────────────────────────────────────────────────

  async function handleDelete(id: number) {
    setProventos((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/proventos/${id}`, { method: "DELETE" });
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const totalMensal = proventos.reduce((sum, p) => sum + p.amount, 0);

  // Group by payment_day
  const byDay = proventos.reduce<Record<number, Provento[]>>((acc, p) => {
    if (!acc[p.payment_day]) acc[p.payment_day] = [];
    acc[p.payment_day].push(p);
    return acc;
  }, {});
  const sortedDays = Object.keys(byDay)
    .map(Number)
    .sort((a, b) => a - b);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b gap-3">
        <div>
          <h1 className="text-xl font-bold">Calendário de Proventos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Proventos recorrentes por dia do mês
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => setFormOpen((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>

      {/* Add form */}
      {formOpen && (
        <div className="px-4 py-4 border-b bg-muted/20 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Novo provento
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Ticker</Label>
              <Input
                placeholder="Ex: PETR4"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="h-8 text-sm uppercase"
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="number"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-8 text-sm"
                min={0}
                step={0.01}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dia do mês</Label>
              <Input
                type="number"
                placeholder="1–31"
                value={paymentDay}
                onChange={(e) => setPaymentDay(e.target.value)}
                className="h-8 text-sm"
                min={1}
                max={31}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as typeof type)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dividendo">Dividendo</SelectItem>
                  <SelectItem value="rendimento">Rendimento</SelectItem>
                  <SelectItem value="juros">Juros sobre Capital</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setFormOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleAdd}
              disabled={submitting || !ticker.trim() || !amount || !paymentDay}
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Total mensal */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Total mensal estimado</span>
        </div>
        <span className="text-sm font-bold tabular-nums text-green-500">
          {fmt(totalMensal)}
        </span>
      </div>

      {/* Empty state */}
      {proventos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <CalendarCheck className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">Nenhum provento cadastrado</p>
          <p className="text-sm mt-1">
            Clique em &quot;Adicionar&quot; para registrar um provento
          </p>
        </div>
      )}

      {/* List grouped by day */}
      {sortedDays.length > 0 && (
        <div className="divide-y">
          {sortedDays.map((day) => {
            const items = byDay[day];
            const dayTotal = items.reduce((s, p) => s + p.amount, 0);

            return (
              <div key={day}>
                {/* Day header */}
                <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Dia {day}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {fmt(dayTotal)}
                  </span>
                </div>

                {/* Items for this day */}
                <div className="divide-y divide-border/50">
                  {items.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-4 py-3 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-bold tracking-wide">
                          {p.ticker}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[p.type] ?? ""}`}
                        >
                          {TYPE_LABELS[p.type] ?? p.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold tabular-nums">
                          {fmt(p.amount)}
                        </span>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
