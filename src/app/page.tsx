"use client";

import { useEffect, useState } from "react";
import { CreditCard, TrendingUp, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getCards, getTransactions, getInvestmentAccounts, getInvestments } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CreditCard as CreditCardType, Transaction, InvestmentAccount, Investment } from "@/types/database";
import { format, startOfMonth, endOfMonth } from "date-fns";
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

export default function DashboardPage() {
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  useEffect(() => {
    Promise.all([
      getCards(),
      getTransactions({ start: monthStart, end: monthEnd }),
      getInvestmentAccounts(),
      getInvestments({ start: monthStart, end: monthEnd }),
    ])
      .then(([c, t, a, i]) => {
        setCards(Array.isArray(c) ? c : []);
        setTransactions(Array.isArray(t) ? t : []);
        setAccounts(Array.isArray(a) ? a : []);
        setInvestments(Array.isArray(i) ? i : []);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [monthStart, monthEnd]);

  const totalSpent = transactions.reduce((s, t) => s + t.amount, 0);
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0);
  const limitPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
  const totalSaved = accounts.reduce((s, a) => s + a.current_balance, 0);
  const monthDeposits = investments
    .filter((i) => i.type === "deposito")
    .reduce((s, i) => s + i.amount, 0);

  const byCategory = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});
  const pieData = Object.entries(byCategory).map(([cat, value]) => ({
    name: CATEGORY_LABELS[cat] ?? cat,
    value,
    color: CATEGORY_COLORS[cat] ?? "#6b7280",
  }));

  const recentTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const monthLabel = format(now, "MMMM yyyy", { locale: ptBR });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-destructive font-medium">Erro ao carregar dados</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground capitalize">{monthLabel}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Gasto no mês</CardDescription>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
            <Progress value={limitPercent} className={`mt-2 h-2 ${limitPercent > 80 ? "[&>div]:bg-destructive" : ""}`} />
            <p className="text-xs text-muted-foreground mt-1">
              {limitPercent.toFixed(0)}% do limite ({formatCurrency(totalLimit)})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Limite disponível</CardDescription>
            {limitPercent > 80
              ? <AlertTriangle className="h-4 w-4 text-destructive" />
              : <ArrowUpRight className="h-4 w-4 text-green-500" />}
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalLimit - totalSpent)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {cards.length} cartão{cards.length !== 1 ? "ões" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Total investido</CardDescription>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalSaved)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {accounts.length} conta{accounts.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Depósitos no mês</CardDescription>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(monthDeposits)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              em {format(now, "MMMM", { locale: ptBR })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoria</CardTitle>
            <CardDescription>Distribuição no mês atual</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhum gasto registrado este mês
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas transações</CardTitle>
            <CardDescription>5 mais recentes do mês</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTx.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhuma transação este mês
              </p>
            ) : (
              <div className="space-y-3">
                {recentTx.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[tx.category] }} />
                      <div>
                        <p className="text-sm font-medium leading-none">{tx.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(tx.date)} · {CATEGORY_LABELS[tx.category]}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-destructive">-{formatCurrency(tx.amount)}</p>
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

      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contas de investimento</CardTitle>
            <CardDescription>Saldo atual por conta</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={accounts.map((a) => ({ name: a.name, saldo: a.current_balance }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} />
                <Bar dataKey="saldo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
