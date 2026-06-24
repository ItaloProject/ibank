"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, TrendingUp, ArrowUpCircle, ArrowDownCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  getInvestmentAccounts, createInvestmentAccount, updateAccountBalance,
  getInvestments, createInvestment, deleteInvestment,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvestmentAccount, Investment, InvestmentType } from "@/types/database";
import { format } from "date-fns";

const TYPE_CONFIG: Record<InvestmentType, {
  label: string; icon: typeof TrendingUp; color: string; badgeClass: string
}> = {
  deposito: { label: "Depósito", icon: ArrowUpCircle, color: "text-green-600", badgeClass: "bg-green-100 text-green-800" },
  retirada: { label: "Retirada", icon: ArrowDownCircle, color: "text-red-600", badgeClass: "bg-red-100 text-red-800" },
  rendimento: { label: "Rendimento", icon: Sparkles, color: "text-blue-600", badgeClass: "bg-blue-100 text-blue-800" },
};

export default function InvestimentosPage() {
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [invOpen, setInvOpen] = useState(false);
  const [accOpen, setAccOpen] = useState(false);

  const now = new Date();

  const [invForm, setInvForm] = useState({
    type: "deposito" as InvestmentType,
    amount: "",
    description: "",
    date: format(now, "yyyy-MM-dd"),
  });

  const [accForm, setAccForm] = useState({ name: "", institution: "" });

  const load = useCallback(async () => {
    try {
      const [loadedAccounts, loadedInvestments] = await Promise.all([
        getInvestmentAccounts(),
        getInvestments(),
      ]);
      const accs = Array.isArray(loadedAccounts) ? loadedAccounts : [];
      const invs = Array.isArray(loadedInvestments) ? loadedInvestments : [];
      setAccounts(accs);
      setInvestments(invs);
      if (!selectedAccount && accs.length > 0) setSelectedAccount(accs[0].id);
    } catch (err) {
      console.error("Erro ao carregar investimentos:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount]);

  useEffect(() => { load(); }, [load]);

  async function addInvestment() {
    if (!selectedAccount || !invForm.amount) return;
    const amount = parseFloat(invForm.amount);
    await createInvestment({
      account_id: selectedAccount,
      type: invForm.type,
      amount,
      description: invForm.description,
      date: invForm.date,
    });
    const acc = accounts.find((a) => a.id === selectedAccount);
    if (acc) {
      const delta = invForm.type === "retirada" ? -amount : amount;
      await updateAccountBalance(selectedAccount, acc.current_balance + delta);
    }
    setInvOpen(false);
    setInvForm({ type: "deposito", amount: "", description: "", date: format(now, "yyyy-MM-dd") });
    load();
  }

  async function addAccount() {
    if (!accForm.name) return;
    await createInvestmentAccount({ name: accForm.name, institution: accForm.institution });
    setAccOpen(false);
    setAccForm({ name: "", institution: "" });
    load();
  }

  async function handleDeleteInvestment(inv: Investment) {
    await deleteInvestment(inv.id);
    const delta = inv.type === "retirada" ? inv.amount : -inv.amount;
    const acc = accounts.find((a) => a.id === inv.account_id);
    if (acc) await updateAccountBalance(inv.account_id, acc.current_balance + delta);
    load();
  }

  const activeAccount = accounts.find((a) => a.id === selectedAccount);
  const accountInvestments = investments.filter((i) => i.account_id === selectedAccount);

  const chartData = (() => {
    const sorted = [...accountInvestments].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    return sorted.map((inv) => {
      if (inv.type === "retirada") running -= inv.amount;
      else running += inv.amount;
      return { date: formatDate(inv.date), saldo: running };
    });
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Investimentos</h1>
          <p className="text-muted-foreground">Poupança e aplicações financeiras</p>
        </div>
        <div className="flex gap-2">
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
              <Button disabled={accounts.length === 0}><Plus className="h-4 w-4" />Nova movimentação</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar movimentação</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Conta</Label>
                  <Select value={selectedAccount ?? ""} onValueChange={setSelectedAccount}>
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
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma conta cadastrada.</p>
            <p className="text-sm text-muted-foreground">Clique em &quot;Nova conta&quot; para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {accounts.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {accounts.map((a) => (
                <Button key={a.id} variant={selectedAccount === a.id ? "default" : "outline"} size="sm"
                  onClick={() => setSelectedAccount(a.id)}>{a.name}</Button>
              ))}
            </div>
          )}

          {activeAccount && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardDescription>Saldo atual</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(activeAccount.current_balance)}
                  </p>
                  {activeAccount.institution && (
                    <p className="text-xs text-muted-foreground mt-1">{activeAccount.institution}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Total depositado</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatCurrency(accountInvestments.filter((i) => i.type === "deposito").reduce((s, i) => s + i.amount, 0))}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Total de rendimentos</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(accountInvestments.filter((i) => i.type === "rendimento").reduce((s, i) => s + i.amount, 0))}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {chartData.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Evolução do saldo</CardTitle>
                <CardDescription>Histórico acumulado</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
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
                <p className="text-muted-foreground text-center py-8 text-sm">
                  Nenhuma movimentação registrada.
                </p>
              ) : (
                <div className="space-y-2">
                  {accountInvestments.map((inv) => {
                    const config = TYPE_CONFIG[inv.type];
                    const Icon = config.icon;
                    return (
                      <div key={inv.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 shrink-0 ${config.color}`} />
                          <div>
                            <p className="font-medium text-sm">{inv.description || config.label}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(inv.date)}</p>
                          </div>
                          <Badge className={config.badgeClass}>{config.label}</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className={`font-semibold ${config.color}`}>
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
    </div>
  );
}
