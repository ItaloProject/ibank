"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/context/user-context";
import { UserSelect } from "@/components/user-select";
import {
  Pencil, Loader2, TrendingUp, PiggyBank, ChevronLeft, ChevronRight,
  CreditCard, CalendarRange, Wallet, ArrowDownCircle, X, Check,
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/utils";
import { getCurrentUser } from "@/lib/user";

export default function EntradaSaidaPage() {
  const { userId } = useUser();
  if (!userId) return <UserSelect />;
  return <EntradaSaidaContent userId={userId} />;
}

function EntradaSaidaContent({ userId }: { userId: string }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [receita, setReceita] = useState(0);
  const [receitaFlowId, setReceitaFlowId] = useState<string | null>(null);
  const [savedAmount, setSavedAmount] = useState(0);
  const [planejado, setPlanejado] = useState(0);
  const [faturaCartao, setFaturaCartao] = useState(0);
  const [investidoMes, setInvestidoMes] = useState(0);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [receitaOpen, setReceitaOpen] = useState(false);
  const [receitaInput, setReceitaInput] = useState("");
  const [receitaSaving, setReceitaSaving] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
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

    // Receita: soma de todos os cash-flows de entrada do mês
    const entradas = Array.isArray(flowsData)
      ? (flowsData as Record<string, unknown>[]).filter((f) => f.type === "entrada")
      : [];
    const totalReceita = entradas.reduce((s, f) => s + (Number(f.amount) || 0), 0);
    setReceita(totalReceita);
    // Guarda o id da entrada principal para editar depois (pega a primeira)
    const firstEntrada = entradas[0];
    setReceitaFlowId(firstEntrada ? String(firstEntrada.id) : null);

    setSavedAmount(Number(goalData.saved_amount) || 0);
    setSavedInput(goalData.saved_amount > 0 ? String(goalData.saved_amount) : "");

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
      return (type === "deposito" || type === "rendimento") ? s + (Number(i.amount) || 0) : s;
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

  // Saídas totais = fatura + investido (automático)
  const totalSaidas = faturaCartao + investidoMes;
  const disponivel = receita - faturaCartao - investidoMes;
  const pctFatura = receita > 0 ? Math.min((faturaCartao / receita) * 100, 100) : 0;
  const pctInvestido = receita > 0 ? Math.min((investidoMes / receita) * 100, 100) : 0;
  const pctPlanejado = receita > 0 ? Math.min((planejado / receita) * 100, 100) : 0;

  async function saveReceita() {
    const value = parseFloat(receitaInput) || 0;
    setReceitaSaving(true);
    const body = {
      user_id: userId,
      description: "Receita mensal",
      type: "entrada",
      amount: value,
      date: `${monthKey}-01`,
      month: monthKey,
    };
    if (receitaFlowId) {
      await fetch(`/api/cash-flows/${receitaFlowId}`, {
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
    setReceitaSaving(false);
    setReceitaOpen(false);
  }

  async function saveSavedAmount() {
    const value = parseFloat(savedInput) || 0;
    await fetch("/api/savings-goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, goal_amount: 0, saved_amount: value }),
    });
    setSavedAmount(value);
    setSavedOpen(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const monthLabel = format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="flex flex-col min-h-full">
      {/* Header + month nav */}
      <div className="px-4 pt-5 pb-2 border-b border-border">
        <h1 className="text-xl sm:text-2xl font-bold mb-3">Entrada/Saída</h1>
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <button type="button" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors touch-manipulation">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm sm:text-base font-semibold capitalize flex-1 text-center truncate px-1">{monthLabel}</span>
          <button type="button" onClick={() => setCurrentMonth((m) => addMonths(m, 1))} disabled={isCurrentMonth}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30 touch-manipulation">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Resumo 3 colunas */}
      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        <div className="flex flex-col items-center py-4 px-1 gap-0.5 min-w-0">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Receita</p>
          <p className="text-sm sm:text-lg font-bold text-green-600 tabular-nums truncate max-w-full">{formatCurrency(receita)}</p>
          <p className="text-[10px] text-muted-foreground">do mês</p>
        </div>
        <div className="flex flex-col items-center py-4 px-1 gap-0.5 min-w-0">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Saídas</p>
          <p className="text-sm sm:text-lg font-bold text-destructive tabular-nums truncate max-w-full">{formatCurrency(totalSaidas)}</p>
          <p className="text-[10px] text-muted-foreground">automático</p>
        </div>
        <div className="flex flex-col items-center py-4 px-1 gap-0.5 min-w-0">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Disponível</p>
          <p className={`text-sm sm:text-lg font-bold tabular-nums truncate max-w-full ${disponivel >= 0 ? "text-green-600" : "text-destructive"}`}>
            {formatCurrency(disponivel)}
          </p>
          <p className="text-[10px] text-muted-foreground">calculado</p>
        </div>
      </div>

      {/* Receita mensal — único campo manual */}
      <button
        onClick={() => { setReceitaInput(receita > 0 ? String(receita) : ""); setReceitaOpen(true); }}
        className="flex items-center justify-between px-4 py-4 border-b border-border hover:bg-muted/30 transition-colors w-full text-left"
      >
        <div className="flex items-center gap-2.5">
          <ArrowDownCircle className="h-4 w-4 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium">Receita mensal</p>
            <p className="text-[11px] text-muted-foreground">Salário, freelance, etc.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {receita > 0
            ? <span className="text-sm font-bold text-green-600 tabular-nums">{formatCurrency(receita)}</span>
            : <span className="text-sm text-muted-foreground">informar</span>}
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </button>

      {/* Saídas automáticas */}
      <div className="border-b border-border">
        <div className="px-4 pt-3 pb-0.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Saídas automáticas</p>
        </div>
        <div className="px-4 pb-4 space-y-3 mt-2">
          {[
            {
              label: "Fatura cartão",
              icon: <CreditCard className="h-4 w-4 text-red-400 shrink-0" />,
              value: faturaCartao,
              pct: pctFatura,
              barColor: "bg-red-400",
              valueColor: "text-destructive",
            },
            {
              label: "Investido",
              icon: <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />,
              value: investidoMes,
              pct: pctInvestido,
              barColor: "bg-emerald-500",
              valueColor: "text-emerald-600",
            },
            {
              label: "Planejamento",
              icon: <CalendarRange className="h-4 w-4 text-blue-500 shrink-0" />,
              value: planejado,
              pct: pctPlanejado,
              barColor: "bg-blue-500",
              valueColor: "",
            },
          ].map(({ label, icon, value, pct, barColor, valueColor }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {icon}
                  <span className="text-sm">{label}</span>
                  <span className="text-[9px] font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wide">auto</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{pct.toFixed(0)}%</span>
                  <span className={`text-sm font-semibold tabular-nums ${valueColor}`}>{formatCurrency(value)}</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}

          {/* Disponível */}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
            <div className="flex items-center gap-2">
              <Wallet className={`h-4 w-4 shrink-0 ${disponivel >= 0 ? "text-green-600" : "text-destructive"}`} />
              <span className="text-sm font-semibold">Disponível</span>
            </div>
            <span className={`text-base font-bold tabular-nums ${disponivel >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatCurrency(disponivel)}
            </span>
          </div>
        </div>
      </div>

      {/* Valor guardado */}
      <button
        onClick={() => { setSavedInput(savedAmount > 0 ? String(savedAmount) : ""); setSavedOpen(true); }}
        className="flex items-center justify-between px-4 py-4 border-b border-border hover:bg-muted/30 transition-colors w-full text-left"
      >
        <div className="flex items-center gap-2.5">
          <PiggyBank className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">Valor guardado</p>
            <p className="text-[11px] text-muted-foreground">Total acumulado</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedAmount > 0
            ? <span className="text-sm font-bold tabular-nums">{formatCurrency(savedAmount)}</span>
            : <span className="text-sm text-muted-foreground">informar</span>}
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </button>

      {/* Info */}
      {receita === 0 && (
        <p className="text-xs text-muted-foreground text-center px-4 py-5">
          Informe sua receita mensal para ver o comparativo completo.
        </p>
      )}

      {/* Modal: receita */}
      {receitaOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-[max(1rem,var(--safe-bottom))] sm:pb-0">
          <div className="w-full max-w-sm bg-background border rounded-2xl shadow-2xl overflow-hidden max-h-[min(90dvh,calc(100dvh-var(--safe-top)-1rem))] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="h-4 w-4 text-green-600" />
                <h2 className="font-bold text-sm">Receita de {format(currentMonth, "MMMM", { locale: ptBR })}</h2>
              </div>
              <button type="button" onClick={() => setReceitaOpen(false)} className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground touch-manipulation -mr-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-muted-foreground">Informe o total de renda recebida no mês (salário, freelance, etc.).</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={receitaInput}
                  onChange={(e) => setReceitaInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveReceita()}
                  autoFocus
                  className="w-full border rounded-xl pl-9 pr-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 tabular-nums"
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setReceitaOpen(false)}
                className="flex-1 rounded-xl border py-2.5 text-sm text-muted-foreground hover:bg-muted transition-all">
                Cancelar
              </button>
              <button onClick={saveReceita} disabled={receitaSaving}
                className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 transition-all flex items-center justify-center gap-1.5">
                {receitaSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {receitaSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: valor guardado */}
      {savedOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-[max(1rem,var(--safe-bottom))] sm:pb-0">
          <div className="w-full max-w-sm bg-background border rounded-2xl shadow-2xl overflow-hidden max-h-[min(90dvh,calc(100dvh-var(--safe-top)-1rem))] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-primary" />
                <h2 className="font-bold text-sm">Valor guardado</h2>
              </div>
              <button type="button" onClick={() => setSavedOpen(false)} className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground touch-manipulation -mr-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-muted-foreground">Total acumulado em poupança, reserva de emergência, etc.</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={savedInput}
                  onChange={(e) => setSavedInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveSavedAmount()}
                  autoFocus
                  className="w-full border rounded-xl pl-9 pr-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 tabular-nums"
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setSavedOpen(false)}
                className="flex-1 rounded-xl border py-2.5 text-sm text-muted-foreground hover:bg-muted transition-all">
                Cancelar
              </button>
              <button onClick={saveSavedAmount}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5">
                <Check className="h-4 w-4" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
