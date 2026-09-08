"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Printer, Camera, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { getTransactions, getInvestments, getInvestmentAccounts, getStockTrades } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Transaction, Investment, InvestmentAccount, StockTrade } from "@/types/database";
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTheme } from "@/components/theme-provider";

const CATEGORY_COLORS: Record<string, string> = {
  alimentacao: "#3b82f6", transporte: "#10b981", saude: "#f59e0b",
  lazer: "#8b5cf6", educacao: "#06b6d4", moradia: "#ef4444",
  vestuario: "#f97316", assinatura: "#7c3aed", outros: "#6b7280",
};
const CATEGORY_LABELS: Record<string, string> = {
  alimentacao: "Alimentação", transporte: "Transporte", saude: "Saúde",
  lazer: "Lazer", educacao: "Educação", moradia: "Moradia",
  vestuario: "Vestuário", assinatura: "Assinatura", outros: "Outros",
};

type Period = 3 | 6 | 12;
type ViewMode = "periodo" | "mes";

export default function RelatoriosPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartGrid = isDark ? "#1e293b" : "#e5e7eb";
  const chartText = isDark ? "#94a3b8" : "#6b7280";
  const tooltipBg = isDark ? "#0f172a" : "#ffffff";
  const tooltipBorder = isDark ? "#1e293b" : "#e5e7eb";
  const tooltipText = isDark ? "#f1f5f9" : "#111827";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [stockTrades, setStockTrades] = useState<StockTrade[]>([]);
  const [period, setPeriod] = useState<Period>(3);
  const [viewMode, setViewMode] = useState<ViewMode>("mes");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const now = new Date();

  // Datas para busca dependendo do modo
  const fetchStart = viewMode === "mes"
    ? format(startOfMonth(selectedMonth), "yyyy-MM-dd")
    : format(startOfMonth(subMonths(now, period - 1)), "yyyy-MM-dd");
  const fetchEnd = viewMode === "mes"
    ? format(endOfMonth(selectedMonth), "yyyy-MM-dd")
    : format(endOfMonth(now), "yyyy-MM-dd");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getTransactions({ start: fetchStart, end: fetchEnd }),
      getInvestments({ start: fetchStart, end: fetchEnd }),
      getInvestmentAccounts(),
      getStockTrades(),
    ])
      .then(([t, i, a, st]) => {
        setTransactions(Array.isArray(t) ? t : []);
        setInvestments(Array.isArray(i) ? i : []);
        setAccounts(Array.isArray(a) ? a : []);
        setStockTrades(Array.isArray(st) ? st : []);
      })
      .catch((err) => console.error("Erro ao carregar relatórios:", err))
      .finally(() => setLoading(false));
  }, [fetchStart, fetchEnd]);

  // --- Cálculos ---
  const totalSpent = transactions.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);
  const stockDeposited = stockTrades
    .filter((t) => t.type === "compra" && t.date >= fetchStart && t.date <= fetchEnd)
    .reduce((s, t) => s + t.total_amount, 0);
  const totalDeposited = investments.filter((i) => i.type === "deposito" || i.type === "rendimento").reduce((s, i) => s + i.amount, 0) + stockDeposited;
  const totalSaved = investments.reduce((s, inv) =>
    inv.type === "retirada" ? s - inv.amount : s + inv.amount, 0);

  const byCategory = transactions.reduce<Record<string, number>>((acc, t) => {
    if (t.amount > 0) acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});
  const pieData = Object.entries(byCategory)
    .map(([cat, value]) => ({ name: CATEGORY_LABELS[cat] ?? cat, value, color: CATEGORY_COLORS[cat] ?? "#6b7280" }))
    .sort((a, b) => b.value - a.value);

  // Dados de período (modo "periodo")
  const monthlySpend = (() => {
    const map: Record<string, number> = {};
    for (let i = period - 1; i >= 0; i--) {
      const m = format(subMonths(now, i), "MMM/yy", { locale: ptBR });
      map[m] = 0;
    }
    transactions.forEach((t) => {
      if (t.amount > 0) {
        const m = format(new Date(t.date + "T00:00:00"), "MMM/yy", { locale: ptBR });
        if (map[m] !== undefined) map[m] += t.amount;
      }
    });
    return Object.entries(map).map(([month, total]) => ({ month, total }));
  })();

  const monthlyComparison = (() => {
    const map: Record<string, { mes: string; gastos: number; depositos: number }> = {};
    for (let i = period - 1; i >= 0; i--) {
      const m = format(subMonths(now, i), "MMM/yy", { locale: ptBR });
      map[m] = { mes: m, gastos: 0, depositos: 0 };
    }
    transactions.forEach((t) => {
      if (t.amount > 0) {
        const m = format(new Date(t.date + "T00:00:00"), "MMM/yy", { locale: ptBR });
        if (map[m]) map[m].gastos += t.amount;
      }
    });
    investments.filter((i) => i.type === "deposito" || i.type === "rendimento").forEach((i) => {
      const m = format(new Date(i.date + "T00:00:00"), "MMM/yy", { locale: ptBR });
      if (map[m]) map[m].depositos += i.amount;
    });
    stockTrades.filter((t) => t.type === "compra").forEach((t) => {
      const m = format(new Date(t.date + "T00:00:00"), "MMM/yy", { locale: ptBR });
      if (map[m]) map[m].depositos += t.total_amount;
    });
    return Object.values(map);
  })();

  // Transações recentes (modo mês)
  const recentTx = [...transactions]
    .filter((t) => t.amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  const monthLabel = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });
  const isCurrentMonth = format(selectedMonth, "yyyy-MM") === format(now, "yyyy-MM");

  function handlePrint() { window.print(); }

  async function handleFoto() {
    if (!reportRef.current) return;
    setCapturing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `relatorio-ibank-${format(new Date(), "yyyy-MM")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setCapturing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const tooltipStyle = { background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: tooltipText, fontSize: 12 };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" data-no-print>
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground text-sm">
            {viewMode === "mes" ? `Visão mensal — ${monthLabel}` : `Análise dos últimos ${period} meses`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Modo toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setViewMode("mes")}
              className={`px-3 py-2.5 min-h-11 transition-colors touch-manipulation ${viewMode === "mes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Mês a mês
            </button>
            <button
              type="button"
              onClick={() => setViewMode("periodo")}
              className={`px-3 py-2.5 min-h-11 transition-colors touch-manipulation ${viewMode === "periodo" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Período
            </button>
          </div>

          {viewMode === "periodo" && ([3, 6, 12] as Period[]).map((p) => (
            <Button key={p} variant={period === p ? "default" : "outline"} size="sm"
              onClick={() => setPeriod(p)}>{p} meses</Button>
          ))}

          <div className="w-px bg-border mx-1 h-6" />
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Exportar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleFoto} disabled={capturing}>
            {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {capturing ? "Capturando..." : "Salvar foto"}
          </Button>
        </div>
      </div>

      {/* Navegador de mês */}
      {viewMode === "mes" && (
        <div className="flex items-center gap-3" data-no-print>
          <button
            onClick={() => setSelectedMonth((m) => subMonths(m, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-base font-semibold capitalize min-w-[160px] text-center">{monthLabel}</span>
          <button
            onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
            disabled={isCurrentMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <div ref={reportRef} className="space-y-4 sm:space-y-6">
        {/* Título impressão */}
        <div className="hidden print:block mb-4">
          <h1 className="text-2xl font-bold">Relatório IBANK</h1>
          <p className="text-sm text-muted-foreground">
            {viewMode === "mes" ? monthLabel : `Últimos ${period} meses`} — gerado em {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Total gasto no {viewMode === "mes" ? "mês" : "período"}</CardDescription></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totalSpent)}</p>
              {viewMode === "periodo" && (
                <p className="text-xs text-muted-foreground mt-1">Média: {formatCurrency(totalSpent / period)}/mês</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Depositado no {viewMode === "mes" ? "mês" : "período"}</CardDescription></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalDeposited)}</p>
              {viewMode === "periodo" && (
                <p className="text-xs text-muted-foreground mt-1">Média: {formatCurrency(totalDeposited / period)}/mês</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Saldo total investido</CardDescription></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totalSaved > 0 ? totalSaved : accounts.reduce((s, a) => s + a.current_balance, 0))}</p>
              <p className="text-xs text-muted-foreground mt-1">{accounts.length} conta{accounts.length !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
        </div>

        {/* ===== MODO MÊS A MÊS ===== */}
        {viewMode === "mes" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Rosca de categorias */}
              <Card>
                <CardHeader>
                  <CardTitle>Gastos por categoria</CardTitle>
                  <CardDescription className="capitalize">{monthLabel}</CardDescription>
                </CardHeader>
                <CardContent>
                  {pieData.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-16">Nenhum gasto registrado</p>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="relative shrink-0">
                        <PieChart width={180} height={180}>
                          <Pie data={pieData} cx={90} cy={90} innerRadius={55} outerRadius={85}
                            paddingAngle={3} dataKey="value" strokeWidth={0}>
                            {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} contentStyle={tooltipStyle} />
                        </PieChart>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Total</p>
                          <p className="text-sm font-bold tabular-nums">{formatCurrency(totalSpent)}</p>
                        </div>
                      </div>
                      <div className="flex-1 w-full space-y-1.5 min-w-0">
                        {pieData.map((entry) => {
                          const pct = totalSpent > 0 ? (entry.value / totalSpent) * 100 : 0;
                          return (
                            <div key={entry.name}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                <span className="text-sm flex-1 truncate">{entry.name}</span>
                                <span className="text-sm font-semibold tabular-nums">{formatCurrency(entry.value)}</span>
                                <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                              </div>
                              <div className="ml-4 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: entry.color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Lista de transações do mês */}
              <Card>
                <CardHeader>
                  <CardTitle>Transações do mês</CardTitle>
                  <CardDescription>{recentTx.length} lançamento{recentTx.length !== 1 ? "s" : ""}</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentTx.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-16">Nenhuma transação</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {recentTx.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[tx.category] }} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{tx.description}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(tx.date)} · {CATEGORY_LABELS[tx.category] ?? tx.category}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="text-sm font-semibold text-destructive tabular-nums">-{formatCurrency(tx.amount)}</p>
                            {tx.installments > 1 && (
                              <p className="text-xs text-muted-foreground">{tx.installment_current}/{tx.installments}x</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Depósitos do mês */}
            {investments.filter((i) => i.type === "deposito" || i.type === "rendimento").length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Investimentos no mês</CardTitle>
                  <CardDescription>Depósitos e movimentações</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {investments.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{inv.description || (inv.type === "deposito" ? "Depósito" : "Retirada")}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(inv.date)}</p>
                        </div>
                        <p className={`text-sm font-semibold tabular-nums ${inv.type === "deposito" ? "text-green-600" : "text-destructive"}`}>
                          {inv.type === "deposito" ? "+" : "-"}{formatCurrency(inv.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ===== MODO PERÍODO ===== */}
        {viewMode === "periodo" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Gastos por mês</CardTitle>
                  <CardDescription>Total do cartão de crédito</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthlySpend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                      <XAxis dataKey="month" tick={{ fill: chartText, fontSize: 10 }} axisLine={{ stroke: chartGrid }} tickLine={false} angle={-25} textAnchor="end" height={50} />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fill: chartText, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} contentStyle={tooltipStyle} cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }} />
                      <Bar dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]} name="Gastos" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gastos por categoria</CardTitle>
                  <CardDescription>Acumulado no período</CardDescription>
                </CardHeader>
                <CardContent>
                  {pieData.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-16">Nenhum dado no período</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                          paddingAngle={3} dataKey="value" strokeWidth={0}>
                          {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} contentStyle={tooltipStyle} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Gastos vs Depósitos</CardTitle>
                <CardDescription>Comparação mensal no período</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="mes" tick={{ fill: chartText, fontSize: 10 }} axisLine={{ stroke: chartGrid }} tickLine={false} angle={-25} textAnchor="end" height={50} />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fill: chartText, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} contentStyle={tooltipStyle} cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }} />
                    <Legend />
                    <Bar dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} name="Gastos" />
                    <Bar dataKey="depositos" fill="#10b981" radius={[4, 4, 0, 0]} name="Depósitos" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {pieData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento por categoria</CardTitle>
                  <CardDescription>Valores acumulados no período</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pieData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-sm font-medium">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-sm text-muted-foreground">{((item.value / totalSpent) * 100).toFixed(1)}%</span>
                          <span className="font-semibold text-sm tabular-nums">{formatCurrency(item.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
