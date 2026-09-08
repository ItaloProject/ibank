"use client";

import { useEffect, useState } from "react";
import { CreditCard, TrendingUp, AlertTriangle, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getCards, getTransactions, getAvailableCycles, getInvestmentAccounts, getInvestments, getStockTrades, getStockQuotes } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CreditCard as CreditCardType, Transaction, InvestmentAccount, Investment, StockTrade } from "@/types/database";
import type { StockQuote } from "@/lib/api";
import { format, addMonths } from "date-fns";
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

const FII_SET = new Set([
  "MXRF11","HGLG11","XPML11","BCFF11","KNRI11","HSML11","BTLG11","IRDM11",
  "RBRF11","VGIP11","VISC11","BRCO11","CPTS11","KNCR11","PVBI11","RBRP11",
  "HGRU11","ALZR11","XPLG11","RECT11","MGFF11","HABT11","RBRR11","TGAR11",
  "HGRE11","VILG11","PATL11","BBFI11B","JSAF11","RZAK11","BPFF11","VRTA11",
  "VINO11","HGPO11","FVPQ11","DEVA11","SNAG11","GGRC11","BCRI11","AFHI11",
  "MCCI11","RCRB11","ARRI11","HCTR11","OUJP11","SARE11","RBVA11","CVBI11",
  "RBRD11","BARI11","RNDP11","VGHF11","TRXF11","XPCI11","FIGS11","HGBS11",
  "FLMA11","HFOF11","TPFT11","BRCR11","CSHG11","SPTW11","GTWR11","MALL11",
  "ABCP11","PQDP11","WPLZ11","DOMC11","SHPH11","FMOF11","EDGA11","CBOP11",
  "IGTI11","BRML3",
]);

export default function DashboardPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartTextColor = isDark ? "#94a3b8" : "#6b7280";
  const chartGridColor = isDark ? "#1e293b" : "#e5e7eb";
  const tooltipBg = isDark ? "#0f172a" : "#ffffff";
  const tooltipBorder = isDark ? "#1e293b" : "#e5e7eb";
  const tooltipText = isDark ? "#f1f5f9" : "#111827";

  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [stockTrades, setStockTrades] = useState<StockTrade[]>([]);
  const [stockQuotes, setStockQuotes] = useState<StockQuote[]>([]);
  const [activeCycle, setActiveCycle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const now = new Date();
  const monthStart = `${format(now, "yyyy-MM")}-01`;
  const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");

  useEffect(() => {
    setLoading(true);
    getCards()
      .then(async (cardList) => {
        const c = Array.isArray(cardList) ? cardList : [];
        setCards(c);
        // Usa o ciclo mais recente do primeiro cartão (igual ao cartão page)
        let cycle = format(addMonths(now, 1), "yyyy-MM");
        if (c.length > 0) {
          const cycles = await getAvailableCycles(c[0].id);
          if (cycles.length > 0) cycle = cycles[0];
        }
        setActiveCycle(cycle);
        return Promise.all([
          getTransactions({ billingCycle: cycle }),
          getInvestmentAccounts(),
          getInvestments({ start: monthStart, end: monthEnd }),
          getStockTrades(),
          getStockQuotes(),
        ]);
      })
      .then(([t, a, i, st, sq]) => {
        setTransactions(Array.isArray(t) ? (t as Transaction[]) : []);
        setAccounts(Array.isArray(a) ? (a as InvestmentAccount[]) : []);
        setInvestments(Array.isArray(i) ? (i as Investment[]) : []);
        setStockTrades(Array.isArray(st) ? (st as StockTrade[]) : []);
        setStockQuotes(Array.isArray(sq) ? (sq as StockQuote[]) : []);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSpent = transactions.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0);
  // Parcelas futuras: só conta a fatura atual, não acumula com ciclos anteriores no dashboard
  const futureFromInstallments = transactions
    .filter((t) => t.amount > 0 && t.installments > 1 && t.installment_current < t.installments)
    .reduce((s, t) => s + t.amount * (t.installments - t.installment_current), 0);
  const totalComprometido = totalSpent + futureFromInstallments;
  const limitPercent = totalLimit > 0 ? (totalComprometido / totalLimit) * 100 : 0;
  // Renda fixa: soma dos saldos das contas
  const rendaFixa = accounts.reduce((s, a) => s + a.current_balance, 0);
  // Ações: quantidade líquida × cotação atual por ticker
  const quoteMap = Object.fromEntries(stockQuotes.map((q) => [q.ticker, q.current_price]));
  const netQty = stockTrades.reduce<Record<string, number>>((acc, t) => {
    const delta = t.type === "venda" ? -t.quantity : t.quantity;
    acc[t.ticker] = (acc[t.ticker] ?? 0) + delta;
    return acc;
  }, {});
  const acoes = Object.entries(netQty).reduce((s, [ticker, qty]) => {
    const price = quoteMap[ticker] ?? 0;
    return s + qty * price;
  }, 0);
  const totalSaved = rendaFixa + acoes;
  // Distribuição da carteira: Renda Fixa / FIIs / Ações
  const valorRendaFixa = rendaFixa;
  const valorFIIs = Object.entries(netQty).reduce((s, [ticker, qty]) => {
    if (!FII_SET.has(ticker)) return s;
    const price = quoteMap[ticker] ?? 0;
    return s + qty * price;
  }, 0);
  const valorAcoes = acoes - valorFIIs;
  const portfolioPieData = [
    { name: "Renda Fixa", value: valorRendaFixa, color: "#3b82f6" },
    { name: "Ações", value: valorAcoes, color: "#10b981" },
    { name: "FIIs", value: valorFIIs, color: "#f59e0b" },
  ].filter((d) => d.value > 0);
  const stockPurchasesMonth = stockTrades
    .filter((t) => t.type === "compra" && t.date >= monthStart && t.date <= monthEnd)
    .reduce((s, t) => s + t.total_amount, 0);
  const monthDeposits = investments
    .filter((i) => i.type === "deposito" || i.type === "rendimento")
    .reduce((s, i) => s + i.amount, 0) + stockPurchasesMonth;

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
  const cycleDate = activeCycle ? new Date(activeCycle + "-01") : addMonths(now, 1);
  const monthLabel = format(cycleDate, "MMMM yyyy", { locale: ptBR });

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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Contas</CardDescription>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
            <Progress value={Math.min(limitPercent, 100)} className={`mt-2 h-2 ${limitPercent > 80 ? "[&>div]:bg-destructive" : ""}`} />
            <p className="text-xs text-muted-foreground mt-1">
              {limitPercent.toFixed(0)}% do limite ({formatCurrency(totalLimit)})
            </p>
            {futureFromInstallments > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">+{formatCurrency(futureFromInstallments)} parcelas futuras</p>
            )}
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
            <p className="text-2xl font-bold">{formatCurrency(Math.max(0, totalLimit - totalComprometido))}</p>
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
            <CardDescription>Fatura {monthLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhum gasto registrado este mês
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Rosca com total no centro */}
                <div className="relative shrink-0">
                  <PieChart width={200} height={200}>
                    <Pie
                      data={pieData}
                      cx={100} cy={100}
                      innerRadius={62} outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)}
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: tooltipText, fontSize: 12 }}
                    />
                  </PieChart>
                  {/* Total no centro */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                    <p className="text-base font-bold tabular-nums leading-tight">{formatCurrency(totalSpent)}</p>
                  </div>
                </div>

                {/* Legenda detalhada */}
                <div className="flex-1 w-full space-y-1.5 min-w-0">
                  {[...pieData].sort((a, b) => b.value - a.value).map((entry) => {
                    const pct = totalSpent > 0 ? (entry.value / totalSpent * 100) : 0;
                    return (
                      <div key={entry.name} className="group">
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-sm flex-1 truncate">{entry.name}</span>
                          <span className="text-sm font-semibold tabular-nums">{formatCurrency(entry.value)}</span>
                          <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="ml-4 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: entry.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição da Carteira</CardTitle>
            <CardDescription>Renda Fixa · Ações · FIIs</CardDescription>
          </CardHeader>
          <CardContent>
            {totalSaved === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhum investimento cadastrado
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative shrink-0">
                  <PieChart width={200} height={200}>
                    <Pie
                      data={portfolioPieData}
                      cx={100} cy={100}
                      innerRadius={62} outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {portfolioPieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)}
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: tooltipText, fontSize: 12 }}
                    />
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                    <p className="text-base font-bold tabular-nums leading-tight">{formatCurrency(totalSaved)}</p>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-1.5 min-w-0">
                  {portfolioPieData.map((entry) => {
                    const pct = totalSaved > 0 ? (entry.value / totalSaved * 100) : 0;
                    return (
                      <div key={entry.name} className="group">
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-sm flex-1 truncate">{entry.name}</span>
                          <span className="text-sm font-semibold tabular-nums">{formatCurrency(entry.value)}</span>
                          <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="ml-4 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: entry.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
              <BarChart data={accounts.map((a) => ({ name: a.name, saldo: a.current_balance }))} style={{ background: "transparent" }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                <XAxis dataKey="name" tick={{ fill: chartTextColor, fontSize: 12 }} axisLine={{ stroke: chartGridColor }} tickLine={false} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fill: chartTextColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)}
                  contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: tooltipText }}
                  cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}
                />
                <Bar dataKey="saldo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
