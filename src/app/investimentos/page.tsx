"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus, Trash2, TrendingUp, ArrowUpCircle, ArrowDownCircle, Sparkles,
  BarChart3, LineChart, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  getInvestmentAccounts, createInvestmentAccount, updateAccountBalance, deleteInvestmentAccount,
  getInvestments, createInvestment, deleteInvestment,
  getStockTrades, createStockTrade, deleteStockTrade,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvestmentAccount, Investment, InvestmentType, StockTrade } from "@/types/database";
import { format } from "date-fns";
import { InvestmentRates } from "@/components/investment-rates";
import { detectCategory, type RateCategory } from "@/lib/investment-rates";
import { getCurrentUser } from "@/lib/user";

const TYPE_CONFIG: Record<InvestmentType, {
  label: string; icon: typeof TrendingUp; color: string; badgeClass: string
}> = {
  deposito: { label: "Depósito", icon: ArrowUpCircle, color: "text-green-600", badgeClass: "bg-green-100 text-green-800" },
  retirada: { label: "Retirada", icon: ArrowDownCircle, color: "text-red-600", badgeClass: "bg-red-100 text-red-800" },
  rendimento: { label: "Rendimento", icon: Sparkles, color: "text-blue-600", badgeClass: "bg-blue-100 text-blue-800" },
};

function accountBalance(investments: Investment[], accountId: string) {
  return investments
    .filter((i) => i.account_id === accountId)
    .reduce((s, inv) => (inv.type === "retirada" ? s - inv.amount : s + inv.amount), 0);
}

function computeStockPositions(trades: StockTrade[]) {
  const map = new Map<string, { qty: number; invested: number }>();
  for (const t of trades) {
    const cur = map.get(t.ticker) ?? { qty: 0, invested: 0 };
    if (t.type === "compra") {
      cur.qty += t.quantity;
      cur.invested += t.total_amount;
    } else {
      cur.qty -= t.quantity;
      cur.invested -= t.total_amount;
    }
    map.set(t.ticker, cur);
  }
  return [...map.entries()]
    .filter(([, v]) => v.qty > 0.0001)
    .map(([ticker, v]) => ({
      ticker,
      quantity: v.qty,
      totalInvested: Math.max(0, v.invested),
      avgPrice: v.qty > 0 ? v.invested / v.qty : 0,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export default function InvestimentosPage() {
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [stockTrades, setStockTrades] = useState<StockTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("total");
  const [invOpen, setInvOpen] = useState(false);
  const [accOpen, setAccOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);

  const now = new Date();

  const [invForm, setInvForm] = useState({
    account_id: "",
    type: "deposito" as InvestmentType,
    amount: "",
    description: "",
    date: format(now, "yyyy-MM-dd"),
  });

  const [accForm, setAccForm] = useState({ name: "", institution: "" });

  const [stockForm, setStockForm] = useState({
    ticker: "",
    quantity: "",
    price_per_share: "",
    notes: "",
    date: format(now, "yyyy-MM-dd"),
  });

  const load = useCallback(async () => {
    try {
      const [loadedAccounts, loadedInvestments, loadedStocks] = await Promise.all([
        getInvestmentAccounts(),
        getInvestments(),
        getStockTrades(),
      ]);
      const accs = Array.isArray(loadedAccounts) ? loadedAccounts : [];
      setAccounts(accs);
      setInvestments(Array.isArray(loadedInvestments) ? loadedInvestments : []);
      setStockTrades(Array.isArray(loadedStocks) ? loadedStocks : []);
      setInvForm((prev) => ({
        ...prev,
        account_id: prev.account_id || (accs[0]?.id ?? ""),
      }));
    } catch (err) {
      console.error("Erro ao carregar investimentos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stockPositions = useMemo(() => computeStockPositions(stockTrades), [stockTrades]);
  const totalStocks = useMemo(
    () => stockPositions.reduce((s, p) => s + p.totalInvested, 0),
    [stockPositions],
  );

  const accountBalances = useMemo(
    () => accounts.map((a) => ({
      account: a,
      balance: accountBalance(investments, a.id),
      deposited: investments.filter((i) => i.account_id === a.id && i.type === "deposito").reduce((s, i) => s + i.amount, 0),
      yields: investments.filter((i) => i.account_id === a.id && i.type === "rendimento").reduce((s, i) => s + i.amount, 0),
    })),
    [accounts, investments],
  );

  const totalFixedIncome = useMemo(
    () => accountBalances.reduce((s, a) => s + a.balance, 0),
    [accountBalances],
  );
  const totalDeposited = useMemo(
    () => accountBalances.reduce((s, a) => s + a.deposited, 0),
    [accountBalances],
  );
  const totalYields = useMemo(
    () => accountBalances.reduce((s, a) => s + a.yields, 0),
    [accountBalances],
  );
  const grandTotal = totalFixedIncome + totalStocks;

  const balancesByCategory = useMemo(
    () => accounts.reduce<Partial<Record<RateCategory, number>>>((acc, a) => {
      const cat = detectCategory(a.name);
      if (!cat) return acc;
      acc[cat] = (acc[cat] ?? 0) + accountBalance(investments, a.id);
      return acc;
    }, {}),
    [accounts, investments],
  );

  const selectedAccountId = activeTab !== "total" && activeTab !== "acoes" ? activeTab : invForm.account_id;
  const activeAccount = accounts.find((a) => a.id === selectedAccountId);
  const accountInvestments = useMemo(
    () => investments.filter((i) => i.account_id === selectedAccountId),
    [investments, selectedAccountId],
  );
  const computedBalance = useMemo(
    () => accountBalance(investments, selectedAccountId),
    [investments, selectedAccountId],
  );

  const chartData = useMemo(() => {
    const sorted = [...accountInvestments].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    return sorted.map((inv) => {
      if (inv.type === "retirada") running -= inv.amount;
      else running += inv.amount;
      return { date: formatDate(inv.date), saldo: running };
    });
  }, [accountInvestments]);

  const stockTotalPreview = useMemo(() => {
    const qty = parseFloat(stockForm.quantity) || 0;
    const price = parseFloat(stockForm.price_per_share) || 0;
    return qty * price;
  }, [stockForm.quantity, stockForm.price_per_share]);

  async function addInvestment() {
    if (!invForm.account_id || !invForm.amount) return;
    const amount = parseFloat(invForm.amount);
    await createInvestment({
      account_id: invForm.account_id,
      type: invForm.type,
      amount,
      description: invForm.description,
      date: invForm.date,
    });
    const acc = accounts.find((a) => a.id === invForm.account_id);
    if (acc) {
      const delta = invForm.type === "retirada" ? -amount : amount;
      await updateAccountBalance(invForm.account_id, acc.current_balance + delta);
    }
    setInvOpen(false);
    setInvForm({ account_id: invForm.account_id, type: "deposito", amount: "", description: "", date: format(now, "yyyy-MM-dd") });
    load();
  }

  async function addAccount() {
    if (!accForm.name) return;
    await createInvestmentAccount({ name: accForm.name, institution: accForm.institution });
    setAccOpen(false);
    setAccForm({ name: "", institution: "" });
    load();
  }

  async function addStockTrade() {
    const quantity = parseFloat(stockForm.quantity);
    const price = parseFloat(stockForm.price_per_share);
    if (!stockForm.ticker.trim() || !quantity || !price) return;
    await createStockTrade({
      ticker: stockForm.ticker.trim().toUpperCase(),
      type: "compra",
      quantity,
      price_per_share: price,
      total_amount: quantity * price,
      notes: stockForm.notes,
      date: stockForm.date,
    });
    setStockOpen(false);
    setStockForm({ ticker: "", quantity: "", price_per_share: "", notes: "", date: format(now, "yyyy-MM-dd") });
    load();
  }

  async function handleDeleteInvestment(inv: Investment) {
    await deleteInvestment(inv.id);
    const delta = inv.type === "retirada" ? inv.amount : -inv.amount;
    const acc = accounts.find((a) => a.id === inv.account_id);
    if (acc) await updateAccountBalance(inv.account_id, acc.current_balance + delta);
    load();
  }

  async function handleDeleteStock(id: string) {
    await deleteStockTrade(id);
    load();
  }

  async function handleDeleteAccount(id: string) {
    await deleteInvestmentAccount(id);
    setActiveTab("total");
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Investimentos</h1>
          <p className="text-muted-foreground">Poupança, renda fixa e ações</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={accOpen} onOpenChange={setAccOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><TrendingUp className="h-4 w-4" />Nova conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar conta de investimento</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome da conta</Label>
                  <Input placeholder="Ex: Poupança Caixa" value={accForm.name}
                    onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Instituição</Label>
                  <Input placeholder="Ex: Caixa Econômica" value={accForm.institution}
                    onChange={(e) => setAccForm({ ...accForm, institution: e.target.value })} />
                </div>
                <Button className="w-full" onClick={addAccount}>Adicionar conta</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={invOpen} onOpenChange={setInvOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={accounts.length === 0}>
                <Plus className="h-4 w-4" />Nova movimentação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar movimentação</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Conta</Label>
                  <Select value={invForm.account_id} onValueChange={(v) => setInvForm({ ...invForm, account_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={invForm.type}
                    onValueChange={(v) => setInvForm({ ...invForm, type: v as InvestmentType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposito">Depósito</SelectItem>
                      <SelectItem value="retirada">Retirada</SelectItem>
                      <SelectItem value="rendimento">Rendimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Valor (R$)</Label>
                  <Input type="number" placeholder="0.00" value={invForm.amount}
                    onChange={(e) => setInvForm({ ...invForm, amount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição (opcional)</Label>
                  <Input placeholder="Ex: Salário de junho" value={invForm.description}
                    onChange={(e) => setInvForm({ ...invForm, description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input type="date" value={invForm.date}
                    onChange={(e) => setInvForm({ ...invForm, date: e.target.value })} />
                </div>
                <Button className="w-full" onClick={addInvestment}>Registrar</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={stockOpen} onOpenChange={setStockOpen}>
            <DialogTrigger asChild>
              <Button><LineChart className="h-4 w-4" />Comprar ações</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar compra de ações</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Ticker</Label>
                  <Input placeholder="Ex: PETR4, VALE3, ITUB4" value={stockForm.ticker}
                    onChange={(e) => setStockForm({ ...stockForm, ticker: e.target.value.toUpperCase() })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Quantidade</Label>
                    <Input type="number" placeholder="100" value={stockForm.quantity}
                      onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço por ação (R$)</Label>
                    <Input type="number" placeholder="0.00" value={stockForm.price_per_share}
                      onChange={(e) => setStockForm({ ...stockForm, price_per_share: e.target.value })} />
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Total da operação</p>
                  <p className="text-lg font-bold tabular-nums">{formatCurrency(stockTotalPreview)}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Observação (opcional)</Label>
                  <Input placeholder="Ex: Compra mensal" value={stockForm.notes}
                    onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input type="date" value={stockForm.date}
                    onChange={(e) => setStockForm({ ...stockForm, date: e.target.value })} />
                </div>
                <Button className="w-full" onClick={addStockTrade}>Registrar compra</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {accounts.length === 0 && stockTrades.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum investimento cadastrado.</p>
            <p className="text-sm text-muted-foreground">Crie uma conta ou registre uma compra de ações.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="total" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Total
            </TabsTrigger>
            {accounts.map((a) => (
              <TabsTrigger key={a.id} value={a.id}>{a.name}</TabsTrigger>
            ))}
            <TabsTrigger value="acoes" className="gap-1.5">
              <LineChart className="h-3.5 w-3.5" />
              Ações
            </TabsTrigger>
          </TabsList>

          {/* ── Aba Total ── */}
          <TabsContent value="total" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-2">
                  <CardDescription>Patrimônio total</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(grandTotal)}</p>
                  <p className="text-xs text-muted-foreground mt-1">renda fixa + ações</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Renda fixa</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600 tabular-nums">{formatCurrency(totalFixedIncome)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{accounts.length} conta{accounts.length !== 1 ? "s" : ""}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Ações</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-600 tabular-nums">{formatCurrency(totalStocks)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stockPositions.length} ativo{stockPositions.length !== 1 ? "s" : ""}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Total de rendimentos</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalYields)}</p>
                  <p className="text-xs text-muted-foreground mt-1">depositado: {formatCurrency(totalDeposited)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contas de renda fixa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {accountBalances.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta cadastrada.</p>
                  ) : (
                    accountBalances.map(({ account, balance }) => (
                      <div key={account.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 cursor-pointer"
                        onClick={() => setActiveTab(account.id)}>
                        <div>
                          <p className="font-medium text-sm">{account.name}</p>
                          {account.institution && (
                            <p className="text-xs text-muted-foreground">{account.institution}</p>
                          )}
                        </div>
                        <p className="font-semibold text-green-600 tabular-nums">{formatCurrency(balance)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Carteira de ações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stockPositions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ação registrada.</p>
                  ) : (
                    stockPositions.map((p) => (
                      <div key={p.ticker}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 cursor-pointer"
                        onClick={() => setActiveTab("acoes")}>
                        <div>
                          <p className="font-bold text-sm">{p.ticker}</p>
                          <p className="text-xs text-muted-foreground">{p.quantity} ações · média {formatCurrency(p.avgPrice)}</p>
                        </div>
                        <p className="font-semibold text-blue-600 tabular-nums">{formatCurrency(p.totalInvested)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {accounts.length > 0 && (
              <InvestmentRates balances={balancesByCategory} userId={getCurrentUser()} />
            )}
          </TabsContent>

          {/* ── Abas por conta ── */}
          {accounts.map((account) => (
            <TabsContent key={account.id} value={account.id} className="space-y-6 mt-4">
              {activeTab === account.id && (
                <>
                  {/* Account header with delete */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-lg">{account.name}</h2>
                      {account.institution && <p className="text-sm text-muted-foreground">{account.institution}</p>}
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5">
                          <Trash2 className="h-3.5 w-3.5" /> Excluir conta
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Excluir conta</DialogTitle></DialogHeader>
                        <p className="text-sm text-muted-foreground">
                          Isso vai excluir a conta <strong>{account.name}</strong> e todos os seus{" "}
                          <strong>{accountInvestments.length} movimentos</strong> permanentemente. Ação irreversível.
                        </p>
                        <div className="flex gap-2 justify-end mt-2">
                          <Button variant="outline" onClick={() => {}}>Cancelar</Button>
                          <Button variant="destructive" onClick={() => handleDeleteAccount(account.id)}>Excluir tudo</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2"><CardDescription>Saldo atual</CardDescription></CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-green-600 tabular-nums">{formatCurrency(computedBalance)}</p>
                        {account.institution && (
                          <p className="text-xs text-muted-foreground mt-1">{account.institution}</p>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardDescription>Total depositado</CardDescription></CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold tabular-nums">
                          {formatCurrency(accountInvestments.filter((i) => i.type === "deposito").reduce((s, i) => s + i.amount, 0))}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardDescription>Total de rendimentos</CardDescription></CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-blue-600 tabular-nums">
                          {formatCurrency(accountInvestments.filter((i) => i.type === "rendimento").reduce((s, i) => s + i.amount, 0))}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <InvestmentRates balances={balancesByCategory} userId={getCurrentUser()} />

                  {chartData.length > 1 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Evolução do saldo</CardTitle>
                        <CardDescription>Histórico acumulado — {account.name}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" angle={-25} textAnchor="end" height={50} />
                            <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} />
                            <Area type="monotone" dataKey="saldo" stroke="hsl(var(--primary))"
                              fill="hsl(var(--primary) / 0.1)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle>Histórico de movimentações</CardTitle>
                      <CardDescription>{accountInvestments.length} registro{accountInvestments.length !== 1 ? "s" : ""}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {accountInvestments.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8 text-sm">Nenhuma movimentação registrada.</p>
                      ) : (
                        <div className="space-y-2">
                          {accountInvestments.map((inv) => {
                            const config = TYPE_CONFIG[inv.type];
                            const Icon = config.icon;
                            return (
                              <div key={inv.id}
                                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <Icon className={`h-5 w-5 shrink-0 ${config.color}`} />
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{inv.description || config.label}</p>
                                    <p className="text-xs text-muted-foreground">{formatDate(inv.date)}</p>
                                  </div>
                                  <Badge className={config.badgeClass}>{config.label}</Badge>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <p className={`font-semibold tabular-nums ${config.color}`}>
                                    {inv.type === "retirada" ? "-" : "+"}{formatCurrency(inv.amount)}
                                  </p>
                                  <Button variant="ghost" size="icon"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeleteInvestment(inv)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          ))}

          {/* ── Aba Ações ── */}
          <TabsContent value="acoes" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardDescription>Total investido em ações</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-600 tabular-nums">{formatCurrency(totalStocks)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Ativos na carteira</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">{stockPositions.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Operações registradas</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">{stockTrades.length}</p>
                </CardContent>
              </Card>
            </div>

            {stockPositions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Posições atuais</CardTitle>
                  <CardDescription>Consolidado por ticker</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stockPositions.map((p) => (
                    <div key={p.ticker} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-bold">{p.ticker}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.quantity} ações · preço médio {formatCurrency(p.avgPrice)}
                        </p>
                      </div>
                      <p className="font-semibold text-blue-600 tabular-nums">{formatCurrency(p.totalInvested)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Histórico de operações</CardTitle>
                <CardDescription>{stockTrades.length} registro{stockTrades.length !== 1 ? "s" : ""}</CardDescription>
              </CardHeader>
              <CardContent>
                {stockTrades.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    Nenhuma operação registrada. Clique em &quot;Comprar ações&quot; para começar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {stockTrades.map((trade) => (
                      <div key={trade.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <LineChart className="h-5 w-5 shrink-0 text-blue-600" />
                          <div className="min-w-0">
                            <p className="font-bold text-sm">{trade.ticker}</p>
                            <p className="text-xs text-muted-foreground">
                              {trade.quantity} ações × {formatCurrency(trade.price_per_share)} · {formatDate(trade.date)}
                            </p>
                            {trade.notes && <p className="text-xs text-muted-foreground truncate">{trade.notes}</p>}
                          </div>
                          <Badge className="bg-blue-100 text-blue-800">Compra</Badge>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="font-semibold text-blue-600 tabular-nums">+{formatCurrency(trade.total_amount)}</p>
                          <Button variant="ghost" size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteStock(trade.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
