"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Printer, Camera, Loader2 } from "lucide-react";
import { getTransactions, getInvestments, getInvestmentAccounts } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Transaction, Investment, InvestmentAccount } from "@/types/database";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORY_COLORS: Record<string, string> = {
  alimentacao: "#3b82f6", transporte: "#10b981", saude: "#f59e0b",
  lazer: "#8b5cf6", educacao: "#06b6d4", moradia: "#ef4444",
  vestuario: "#f97316", outros: "#6b7280",
};
const CATEGORY_LABELS: Record<string, string> = {
  alimentacao: "Alimentação", transporte: "Transporte", saude: "Saúde",
  lazer: "Lazer", educacao: "Educação", moradia: "Moradia",
  vestuario: "Vestuário", outros: "Outros",
};

type Period = 3 | 6 | 12;

export default function RelatoriosPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [period, setPeriod] = useState<Period>(6);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const periodStart = format(startOfMonth(subMonths(now, period - 1)), "yyyy-MM-dd");
  const periodEnd = format(endOfMonth(now), "yyyy-MM-dd");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getTransactions({ start: periodStart, end: periodEnd }),
      getInvestments({ start: periodStart, end: periodEnd }),
      getInvestmentAccounts(),
    ])
      .then(([t, i, a]) => {
        setTransactions(Array.isArray(t) ? t : []);
        setInvestments(Array.isArray(i) ? i : []);
        setAccounts(Array.isArray(a) ? a : []);
      })
      .catch((err) => console.error("Erro ao carregar relatórios:", err))
      .finally(() => setLoading(false));
  }, [periodStart, periodEnd]);

  const monthlySpend = (() => {
    const map: Record<string, number> = {};
    for (let i = period - 1; i >= 0; i--) {
      const m = format(subMonths(now, i), "MMM/yy", { locale: ptBR });
      map[m] = 0;
    }
    transactions.forEach((t) => {
      const m = format(new Date(t.date + "T00:00:00"), "MMM/yy", { locale: ptBR });
      map[m] = (map[m] ?? 0) + t.amount;
    });
    return Object.entries(map).map(([month, total]) => ({ month, total }));
  })();

  const byCategory = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});
  const pieData = Object.entries(byCategory).map(([cat, value]) => ({
    name: CATEGORY_LABELS[cat] ?? cat,
    value,
    color: CATEGORY_COLORS[cat] ?? "#6b7280",
  }));

  const monthlyComparison = (() => {
    const map: Record<string, { mes: string; gastos: number; depositos: number }> = {};
    for (let i = period - 1; i >= 0; i--) {
      const m = format(subMonths(now, i), "MMM/yy", { locale: ptBR });
      map[m] = { mes: m, gastos: 0, depositos: 0 };
    }
    transactions.forEach((t) => {
      const m = format(new Date(t.date + "T00:00:00"), "MMM/yy", { locale: ptBR });
      if (map[m]) map[m].gastos += t.amount;
    });
    investments.filter((i) => i.type === "deposito").forEach((i) => {
      const m = format(new Date(i.date + "T00:00:00"), "MMM/yy", { locale: ptBR });
      if (map[m]) map[m].depositos += i.amount;
    });
    return Object.values(map);
  })();

  const totalSpent = transactions.reduce((s, t) => s + t.amount, 0);
  const totalSaved = accounts.reduce((s, a) => s + a.current_balance, 0);
  const totalDeposited = investments.filter((i) => i.type === "deposito").reduce((s, i) => s + i.amount, 0);

  function handlePrint() {
    window.print();
  }

  async function handleFoto() {
    if (!reportRef.current) return;
    setCapturing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
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

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between" data-no-print>
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Análise dos últimos {period} meses</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {([3, 6, 12] as Period[]).map((p) => (
            <Button key={p} variant={period === p ? "default" : "outline"} size="sm"
              onClick={() => setPeriod(p)}>{p} meses</Button>
          ))}
          <div className="w-px bg-border mx-1" />
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            Exportar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleFoto} disabled={capturing}>
            {capturing
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Camera className="h-4 w-4" />}
            {capturing ? "Capturando..." : "Salvar foto"}
          </Button>
        </div>
      </div>

      {/* Título visível apenas na impressão */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">Relatório IBANK</h1>
        <p className="text-sm text-muted-foreground">
          Período: {period} meses — gerado em {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </div>

      <div ref={reportRef}>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total gasto no período</CardDescription></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(totalSpent)}</p>
            <p className="text-xs text-muted-foreground mt-1">Média: {formatCurrency(totalSpent / period)}/mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Depositado no período</CardDescription></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalDeposited)}</p>
            <p className="text-xs text-muted-foreground mt-1">Média: {formatCurrency(totalDeposited / period)}/mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Saldo total investido</CardDescription></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalSaved)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {accounts.length} conta{accounts.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por mês</CardTitle>
            <CardDescription>Total do cartão de crédito</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlySpend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} />
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
                    paddingAngle={3} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} />
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
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} />
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
              {pieData.sort((a, b) => b.value - a.value).map((item) => (
                <div key={item.name}
                  className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-sm text-muted-foreground">
                      {((item.value / totalSpent) * 100).toFixed(1)}%
                    </span>
                    <span className="font-semibold text-sm">{formatCurrency(item.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>{/* fim reportRef */}
    </div>
  );
}
