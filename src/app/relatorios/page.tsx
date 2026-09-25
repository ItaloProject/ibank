"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Printer, Camera, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { getInvestments, getInvestmentAccounts, getStockTrades } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { accountBalance } from "@/lib/stock-utils";
import type { Investment, InvestmentAccount, StockTrade } from "@/types/database";
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTheme } from "@/components/theme-provider";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";
import { SplashScreen } from "@/components/splash-screen";

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

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [allInvestments, setAllInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [stockTrades, setStockTrades] = useState<StockTrade[]>([]);
  const [period, setPeriod] = useState<Period>(3);
  const [viewMode, setViewMode] = useState<ViewMode>("mes");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const now = new Date();

  const fetchStart = viewMode === "mes"
    ? format(startOfMonth(selectedMonth), "yyyy-MM-dd")
    : format(startOfMonth(subMonths(now, period - 1)), "yyyy-MM-dd");
  const fetchEnd = viewMode === "mes"
    ? format(endOfMonth(selectedMonth), "yyyy-MM-dd")
    : format(endOfMonth(now), "yyyy-MM-dd");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getInvestments({ start: fetchStart, end: fetchEnd }),
      getInvestments(),
      getInvestmentAccounts(),
      getStockTrades(),
    ])
      .then(([i, allInv, a, st]) => {
        setInvestments(Array.isArray(i) ? i : []);
        setAllInvestments(Array.isArray(allInv) ? allInv : []);
        setAccounts(Array.isArray(a) ? a : []);
        setStockTrades(Array.isArray(st) ? st : []);
      })
      .catch((err) => console.error("Erro ao carregar relatórios:", err))
      .finally(() => setLoading(false));
  }, [fetchStart, fetchEnd]);

  const stockDeposited = stockTrades
    .filter((t) => t.type === "compra" && t.date >= fetchStart && t.date <= fetchEnd)
    .reduce((s, t) => s + t.total_amount, 0);
  const totalDeposited = investments
    .filter((i) => i.type === "deposito" || i.type === "rendimento")
    .reduce((s, i) => s + i.amount, 0) + stockDeposited;
  const totalSaved = investments.reduce((s, inv) =>
    inv.type === "retirada" ? s - inv.amount : s + inv.amount, 0);
  const totalBalance = totalSaved > 0
    ? totalSaved
    : accounts.reduce((s, a) => s + (a.is_turbo ? a.current_balance : accountBalance(allInvestments, a.id)), 0);

  // Depósitos por mês (modo período)
  const monthlyDeposits = (() => {
    const map: Record<string, number> = {};
    for (let i = period - 1; i >= 0; i--) {
      const m = format(subMonths(now, i), "MMM/yy", { locale: ptBR });
      map[m] = 0;
    }
    investments.filter((i) => i.type === "deposito" || i.type === "rendimento").forEach((i) => {
      const m = format(new Date(i.date + "T00:00:00"), "MMM/yy", { locale: ptBR });
      if (map[m] !== undefined) map[m] += i.amount;
    });
    stockTrades.filter((t) => t.type === "compra").forEach((t) => {
      const m = format(new Date(t.date + "T00:00:00"), "MMM/yy", { locale: ptBR });
      if (map[m] !== undefined) map[m] += t.total_amount;
    });
    return Object.entries(map).map(([month, total]) => ({ month, total }));
  })();

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
    return <SplashScreen />;
  }

  const tooltipStyle = { background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: tooltipText, fontSize: 12 };

  return (
    <PageShell>
      <PageHeader
        title="Relatórios"
        description={viewMode === "mes" ? `Visão mensal — ${monthLabel}` : `Análise dos últimos ${period} meses`}
        actions={
          <div className="flex gap-2 flex-wrap items-center" data-no-print>
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
        }
      />

      <PageBody>
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
          <div className="hidden print:block mb-4">
            <h1 className="text-2xl font-bold">Relatório MUVO</h1>
            <p className="text-sm text-muted-foreground">
              {viewMode === "mes" ? monthLabel : `Últimos ${period} meses`} — gerado em {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Depositado no {viewMode === "mes" ? "mês" : "período"}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalDeposited)}</p>
                {viewMode === "periodo" && (
                  <p className="text-xs text-muted-foreground mt-1">Média: {formatCurrency(totalDeposited / period)}/mês</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Saldo total investido</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
                <p className="text-xs text-muted-foreground mt-1">{accounts.length} conta{accounts.length !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          </div>

          {/* Modo mês */}
          {viewMode === "mes" && (
            <>
              {investments.filter((i) => i.type === "deposito" || i.type === "rendimento").length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Movimentações no mês</CardTitle>
                    <CardDescription>Depósitos e rendimentos em {monthLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {investments.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                          <div>
                            <p className="text-sm font-medium">{inv.description || (inv.type === "deposito" ? "Depósito" : inv.type === "retirada" ? "Retirada" : "Rendimento")}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(inv.date)}</p>
                          </div>
                          <p className={`text-sm font-semibold tabular-nums ${inv.type === "retirada" ? "text-destructive" : "text-emerald-600"}`}>
                            {inv.type === "retirada" ? "-" : "+"}{formatCurrency(inv.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground text-sm">
                    Nenhuma movimentação em {monthLabel}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Modo período */}
          {viewMode === "periodo" && (
            <Card>
              <CardHeader>
                <CardTitle>Depósitos por mês</CardTitle>
                <CardDescription>Aportes nos últimos {period} meses</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyDeposits}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="month" tick={{ fill: chartText, fontSize: 10 }} axisLine={{ stroke: chartGrid }} tickLine={false} angle={-25} textAnchor="end" height={50} />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fill: chartText, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} contentStyle={tooltipStyle} cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }} />
                    <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} name="Depósitos" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </PageBody>
    </PageShell>
  );
}
