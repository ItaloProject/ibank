"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp, ArrowUpRight, Wallet, Zap, ChevronRight,
  CalendarRange, Layers,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { getInvestmentAccounts, getInvestments, getStockTrades, getStockQuotes } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { accountBalance } from "@/lib/stock-utils";
import { INVESTMENT_TYPE_COLORS } from "@/lib/investment-colors";
import { computeMonthlyPassiveIncome } from "@/lib/passive-income";
import type { InvestmentAccount, Investment, StockTrade } from "@/types/database";
import type { StockQuote } from "@/lib/api";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTheme } from "@/components/theme-provider";
import { useUser } from "@/context/user-context";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";
import { ChartFrame } from "@/components/mobile/chart-frame";

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

interface PlanGroup { id: string; name: string; color: string; }
interface PlanItem  { id: string; name: string; type: string; planned: number; actual: number; group_id: string; }
interface Parcelamento {
  id: string; description: string; total_amount: number;
  installments: number; paid_installments: number; start_date: string | null;
}

const SOURCE_COLORS = INVESTMENT_TYPE_COLORS;

export default function DashboardPage() {
  const { userId } = useUser();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartTextColor  = isDark ? "#94a3b8" : "#6b7280";
  const chartGridColor  = isDark ? "#1e293b"  : "#e5e7eb";
  const tooltipBg       = isDark ? "#0f172a"  : "#ffffff";
  const tooltipBorder   = isDark ? "#1e293b"  : "#e5e7eb";
  const tooltipText     = isDark ? "#f1f5f9"  : "#111827";

  const [accounts,    setAccounts]    = useState<InvestmentAccount[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [stockTrades, setStockTrades] = useState<StockTrade[]>([]);
  const [stockQuotes, setStockQuotes] = useState<StockQuote[]>([]);
  const [planSalary,  setPlanSalary]  = useState(0);
  const [planGroups,  setPlanGroups]  = useState<PlanGroup[]>([]);
  const [planItems,   setPlanItems]   = useState<PlanItem[]>([]);
  const [parcelas,    setParcelas]    = useState<Parcelamento[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");

  const now      = new Date();
  const monthStr = format(now, "yyyy-MM");
  const monthStart = `${monthStr}-01`;
  const monthEnd   = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
  const monthLabel = format(now, "MMMM yyyy", { locale: ptBR });

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      getInvestmentAccounts(),
      getInvestments(),
      getStockTrades(),
      getStockQuotes(),
      fetch(`/api/plan-salary?user=${userId}&month=${monthStr}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/plan-groups?user=${userId}`).then(r => r.json()).catch(() => []),
      fetch(`/api/plan-items?user=${userId}&month=${monthStr}`).then(r => r.json()).catch(() => []),
      fetch(`/api/parcelamentos?user=${userId}`).then(r => r.json()).catch(() => []),
    ])
    .then(([a, i, st, sq, salaryData, groupsData, itemsData, parcData]) => {
      setAccounts(Array.isArray(a) ? (a as InvestmentAccount[]) : []);
      setInvestments(Array.isArray(i) ? (i as Investment[]) : []);
      setStockTrades(Array.isArray(st) ? (st as StockTrade[]) : []);
      setStockQuotes(Array.isArray(sq) ? (sq as StockQuote[]) : []);
      setPlanSalary(Number((salaryData as { salary?: number })?.salary) || 0);
      setPlanGroups(Array.isArray(groupsData) ? (groupsData as PlanGroup[]) : []);
      setPlanItems(Array.isArray(itemsData)
        ? (itemsData as Record<string, unknown>[]).map(i => ({
            ...i,
            planned: Number(i.planned) || 0,
            actual:  Number(i.actual)  || 0,
          } as PlanItem))
        : []);
      setParcelas(Array.isArray(parcData) ? (parcData as Parcelamento[]) : []);
    })
    .catch(err => setError(String(err)))
    .finally(() => setLoading(false));
  }, [userId, monthStr]);

  /* ── Investment calculations ── */
  const rendaFixa = accounts.reduce(
    (s, a) => s + (a.is_turbo ? a.current_balance : accountBalance(investments, a.id)), 0,
  );
  const quoteMap = Object.fromEntries(stockQuotes.map(q => [q.ticker, q.current_price]));
  const netQty = stockTrades.reduce<Record<string, number>>((acc, t) => {
    acc[t.ticker] = (acc[t.ticker] ?? 0) + (t.type === "venda" ? -t.quantity : t.quantity);
    return acc;
  }, {});
  const acoes      = Object.entries(netQty).reduce((s, [tk, qty]) => s + qty * (quoteMap[tk] ?? 0), 0);
  const totalSaved = rendaFixa + acoes;
  const valorFIIs  = Object.entries(netQty).reduce((s, [tk, qty]) => FII_SET.has(tk) ? s + qty * (quoteMap[tk] ?? 0) : s, 0);
  const valorAcoes = acoes - valorFIIs;
  const portfolioPieData = [
    { name: "Renda Fixa", value: rendaFixa,   color: "#3b82f6" },
    { name: "Ações",      value: valorAcoes,  color: "#10b981" },
    { name: "FIIs",       value: valorFIIs,   color: "#f59e0b" },
  ].filter(d => d.value > 0);
  const stockPurchases = stockTrades
    .filter(t => t.type === "compra" && t.date >= monthStart && t.date <= monthEnd)
    .reduce((s, t) => s + t.total_amount, 0);
  const monthDeposits = investments
    .filter(i => (i.type === "deposito" || i.type === "rendimento") && i.date >= monthStart && i.date <= monthEnd)
    .reduce((s, i) => s + i.amount, 0) + stockPurchases;

  const { sources: incomeSources, total: monthlyIncome } = useMemo(
    () => computeMonthlyPassiveIncome(accounts, investments, stockTrades),
    [accounts, investments, stockTrades],
  );

  /* ── Planejamento calculations ── */
  const planTotalActual  = planItems.reduce((s, i) => s + i.actual,  0);
  const planTotalPlanned = planItems.reduce((s, i) => s + i.planned, 0);
  const planRemaining    = planSalary > 0 ? planSalary - planTotalActual : 0;
  const planUsedPct      = planSalary > 0 ? Math.min((planTotalActual / planSalary) * 100, 100) : 0;
  const planOver         = planSalary > 0 && planTotalActual > planSalary;

  const groupBarData = planGroups.map(g => {
    const gItems  = planItems.filter(i => i.group_id === g.id);
    const planned = gItems.reduce((s, i) => s + i.planned, 0);
    const actual  = gItems.reduce((s, i) => s + i.actual,  0);
    return { name: g.name, planejado: planned, gasto: actual, color: g.color };
  }).filter(g => g.planejado > 0 || g.gasto > 0);

  /* ── Parcelamentos ── */
  const activeParcelas = parcelas.filter(p => p.paid_installments < p.installments);
  const nextInstallmentTotal = activeParcelas.reduce(
    (s, p) => s + p.total_amount / p.installments, 0,
  );

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
    <PageShell>
      <PageHeader title="Dashboard" description="Visão geral das suas finanças" />

      <PageBody>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Planejamento do mês */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Planejamento do mês</CardDescription>
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {planSalary > 0 ? (
                <>
                  <p className={`text-2xl font-bold tabular-nums ${planOver ? "text-destructive" : ""}`}>
                    {formatCurrency(planTotalActual)}
                  </p>
                  <Progress
                    value={planUsedPct}
                    className={`mt-2 h-2 ${planOver ? "[&>div]:bg-destructive" : ""}`}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {planUsedPct.toFixed(0)}% de {formatCurrency(planSalary)}
                  </p>
                  {planOver ? (
                    <p className="text-xs text-destructive mt-0.5">
                      Excedeu {formatCurrency(planTotalActual - planSalary)}
                    </p>
                  ) : (
                    <p className="text-xs text-green-600 mt-0.5">
                      Sobra {formatCurrency(planRemaining)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-muted-foreground/30">—</p>
                  <p className="text-xs text-muted-foreground mt-1">Salário não informado</p>
                  <Link href="/planejamento" className="text-xs text-primary hover:underline mt-1 block">
                    Configurar →
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          {/* Total investido */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Total investido</CardDescription>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalSaved)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {accounts.length} conta{accounts.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          {/* Renda passiva */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Renda passiva</CardDescription>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-emerald-500">
                {formatCurrency(monthlyIncome)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">estimativa mensal</p>
            </CardContent>
          </Card>

          {/* Aportes no mês */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>Aportes no mês</CardDescription>
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-green-600">
                {formatCurrency(monthDeposits)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                em {format(now, "MMMM", { locale: ptBR })}
              </p>
            </CardContent>
          </Card>

        </div>

        {/* ── Renda passiva detalhada ── */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-500" />
                Renda passiva mensal
              </CardTitle>
              <CardDescription>Estimativa atual das suas fontes de renda</CardDescription>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-2xl font-bold text-emerald-500 tabular-nums">{formatCurrency(monthlyIncome)}</p>
              <p className="text-xs text-muted-foreground">por mês</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {incomeSources.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma fonte de renda cadastrada. Configure TURBO, renda fixa ou ações em Investimentos.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {incomeSources.map(src => {
                  const color =
                    SOURCE_COLORS[src.label] ??
                    (src.detail?.includes("TURBO") || src.detail?.includes("CDI") ? "#a855f7" :
                      src.detail?.includes("0,85%") ? "#06b6d4" :
                      src.detail?.includes("0,4%")  ? "#10b981" : "#3b82f6");
                  const pct = monthlyIncome > 0 ? (src.value / monthlyIncome) * 100 : 0;
                  return (
                    <div key={src.label + (src.detail ?? "")} className="rounded-xl border p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">{src.label}</p>
                      </div>
                      <p className="text-xl font-bold tabular-nums text-foreground">+{formatCurrency(src.value)}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">{src.detail ?? "/mês"}</p>
                      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                Mesma base da Minha Meta e do Modo Investidor
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/metas" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:underline">
                  Ver meta <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link href="/investimentos?modo=investidor" className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:underline">
                  <Zap className="h-3.5 w-3.5" />
                  Modo Investidor
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Distribuição da carteira */}
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
                <div className="flex flex-col md:flex-row items-center gap-6 w-full min-w-0">
                  <div className="relative w-full max-w-[220px] aspect-square shrink-0">
                    <ChartFrame aspect="square" minHeight={200} className="max-w-[220px]">
                      <PieChart>
                        <Pie data={portfolioPieData} cx="50%" cy="50%" innerRadius="62%" outerRadius="95%" paddingAngle={3} dataKey="value" strokeWidth={0}>
                          {portfolioPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip
                          formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)}
                          contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: tooltipText, fontSize: 12 }}
                        />
                      </PieChart>
                    </ChartFrame>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                      <p className="text-sm sm:text-base font-bold tabular-nums leading-tight px-4 text-center">{formatCurrency(totalSaved)}</p>
                    </div>
                  </div>
                  <div className="flex-1 w-full space-y-1.5 min-w-0">
                    {portfolioPieData.map(entry => {
                      const pct = totalSaved > 0 ? (entry.value / totalSaved) * 100 : 0;
                      return (
                        <div key={entry.name} className="group">
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                            <span className="text-sm flex-1 truncate">{entry.name}</span>
                            <span className="text-sm font-semibold tabular-nums">{formatCurrency(entry.value)}</span>
                            <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
                          <div className="ml-4 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: entry.color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Planejamento do mês — por grupo */}
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
              <div>
                <CardTitle>Planejamento do mês</CardTitle>
                <CardDescription className="capitalize">{monthLabel}</CardDescription>
              </div>
              {planTotalPlanned > 0 && (
                <div className="text-left sm:text-right">
                  <p className={`text-xl font-bold tabular-nums ${planOver ? "text-destructive" : ""}`}>
                    {formatCurrency(planTotalActual)}
                  </p>
                  <p className="text-xs text-muted-foreground">de {formatCurrency(planTotalPlanned)}</p>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {groupBarData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <p className="text-muted-foreground text-sm">Nenhum item cadastrado este mês</p>
                  <Link href="/planejamento" className="text-xs text-primary hover:underline">
                    Ir para Planejamento →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {groupBarData.map(g => {
                    const over = g.planejado > 0 && g.gasto > g.planejado;
                    const pct  = g.planejado > 0 ? Math.min((g.gasto / g.planejado) * 100, 100) : 0;
                    return (
                      <div key={g.name}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                          <span className="text-sm flex-1 font-medium truncate">{g.name}</span>
                          <span className={`text-sm font-semibold tabular-nums shrink-0 ${over ? "text-destructive" : ""}`}>
                            {formatCurrency(g.gasto)}
                          </span>
                          {g.planejado > 0 && (
                            <span className="text-xs text-muted-foreground tabular-nums w-24 text-right shrink-0">
                              de {formatCurrency(g.planejado)}
                            </span>
                          )}
                        </div>
                        {g.planejado > 0 && (
                          <div className="ml-4 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${g.color}25` }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: over ? "hsl(var(--destructive))" : g.color }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-end pt-1">
                    <Link href="/planejamento" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      Ver detalhes <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* ── Parcelamentos ativos ── */}
        {activeParcelas.length > 0 && (
          <Card>
            <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  Parcelamentos ativos
                </CardTitle>
                <CardDescription>
                  {activeParcelas.length} plano{activeParcelas.length !== 1 ? "s" : ""} · próxima parcela total: {formatCurrency(nextInstallmentTotal)}
                </CardDescription>
              </div>
              <Link href="/parcelamentos" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline shrink-0">
                Ver todos <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeParcelas.slice(0, 4).map(p => {
                  const pct = (p.paid_installments / p.installments) * 100;
                  const installmentValue = p.total_amount / p.installments;
                  return (
                    <div key={p.id}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium flex-1 truncate">{p.description}</span>
                        <span className="text-sm font-semibold tabular-nums shrink-0">
                          {formatCurrency(installmentValue)}/mês
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0 w-12 text-right">
                          {p.paid_installments}/{p.installments}x
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
                {activeParcelas.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{activeParcelas.length - 4} mais em <Link href="/parcelamentos" className="text-primary hover:underline">parcelamentos</Link>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Contas de investimento ── */}
        {accounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Contas de investimento</CardTitle>
              <CardDescription>Saldo atual por conta</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={accounts.map(a => ({
                    name: a.name,
                    saldo: a.is_turbo ? a.current_balance : accountBalance(investments, a.id),
                  }))}
                  style={{ background: "transparent" }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                  <XAxis dataKey="name" tick={{ fill: chartTextColor, fontSize: 10 }} axisLine={{ stroke: chartGridColor }} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
                  <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fill: chartTextColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={v => typeof v === "number" ? formatCurrency(v) : String(v)}
                    contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: tooltipText }}
                    cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}
                  />
                  <Bar dataKey="saldo" radius={[4, 4, 0, 0]}>
                    {accounts.map((a, i) => (
                      <Cell key={i} fill={a.is_turbo ? "#a855f7" : "#3b82f6"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

      </PageBody>
    </PageShell>
  );
}
