"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Trash2, CreditCard as CardIcon, Eraser, ChevronLeft, ChevronRight,
  FileDown, Calendar, Receipt, Pencil, ArrowDownCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getCards, createCard, getTransactions, getAvailableCycles,
  createTransactions, deleteTransaction, clearTransactions,
} from "@/lib/api";
import { generateMonthReport } from "@/lib/generate-report";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CreditCard, Transaction, TransactionCategory } from "@/types/database";
import { NubankImport } from "@/components/nubank-import";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIES: { value: TransactionCategory; label: string }[] = [
  { value: "alimentacao", label: "Alimentação" },
  { value: "transporte", label: "Transporte" },
  { value: "saude", label: "Saúde" },
  { value: "lazer", label: "Lazer" },
  { value: "educacao", label: "Educação" },
  { value: "moradia", label: "Moradia" },
  { value: "vestuario", label: "Vestuário" },
  { value: "outros", label: "Outros" },
];

const CATEGORY_COLORS: Record<string, string> = {
  alimentacao: "bg-blue-100 text-blue-800",
  transporte: "bg-green-100 text-green-800",
  saude: "bg-yellow-100 text-yellow-800",
  lazer: "bg-purple-100 text-purple-800",
  educacao: "bg-cyan-100 text-cyan-800",
  moradia: "bg-red-100 text-red-800",
  vestuario: "bg-orange-100 text-orange-800",
  outros: "bg-gray-100 text-gray-800",
};

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
);

type ViewMode = "mensal" | "fatura";

function cycleLabel(cycle: string) {
  return format(new Date(`${cycle}-01T12:00:00`), "MMMM yyyy", { locale: ptBR });
}

function prevCycle(cycle: string) {
  const [y, m] = cycle.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return format(d, "yyyy-MM");
}

function nextCycle(cycle: string) {
  const [y, m] = cycle.split("-").map(Number);
  const d = new Date(y, m, 1);
  return format(d, "yyyy-MM");
}

function currentCycleId() {
  return format(new Date(), "yyyy-MM");
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CartaoPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [txOpen, setTxOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Mensal view
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Fatura view
  const [viewMode, setViewMode] = useState<ViewMode>("mensal");
  const [selectedCycle, setSelectedCycle] = useState<string>(currentCycleId());
  const [availableCycles, setAvailableCycles] = useState<string[]>([]);

  // Saldo anterior (fatura view)
  const [saldoAnterior, setSaldoAnterior] = useState(0);
  const [saldoInput, setSaldoInput] = useState("");
  const [saldoOpen, setSaldoOpen] = useState(false);

  const now = new Date();
  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
  const monthLabel = format(currentMonth, "MMMM yyyy", { locale: ptBR });

  const [txForm, setTxForm] = useState({
    description: "",
    amount: "",
    category: "outros" as TransactionCategory,
    date: format(now, "yyyy-MM-dd"),
    installments: "1",
  });

  const [cardForm, setCardForm] = useState({
    name: "",
    limit: "",
    closing_day: "1",
    due_day: "10",
  });

  // Load saldo anterior from localStorage whenever card/cycle changes
  useEffect(() => {
    if (!selectedCard) return;
    const key = `ibank_saldo_ant_${selectedCard}_${selectedCycle}`;
    try {
      const raw = localStorage.getItem(key);
      const val = raw ? parseFloat(raw) : 0;
      setSaldoAnterior(isNaN(val) ? 0 : val);
      setSaldoInput(val > 0 ? String(val) : "");
    } catch { setSaldoAnterior(0); }
  }, [selectedCard, selectedCycle]);

  function saveSaldoAnterior() {
    const val = parseFloat(saldoInput) || 0;
    setSaldoAnterior(val);
    if (selectedCard) {
      try {
        localStorage.setItem(`ibank_saldo_ant_${selectedCard}_${selectedCycle}`, String(val));
      } catch { /* ignore */ }
    }
    setSaldoOpen(false);
  }

  const loadMensal = useCallback(async (cardId: string | null) => {
    if (!cardId) return;
    try {
      const txs = await getTransactions({ start: monthStart, end: monthEnd, cardId });
      setTransactions(txs);
    } catch (err) {
      console.error(err);
    }
  }, [monthStart, monthEnd]);

  const loadFatura = useCallback(async (cardId: string | null, cycle: string) => {
    if (!cardId) return;
    try {
      const [txs, cycles] = await Promise.all([
        getTransactions({ cardId, billingCycle: cycle }),
        getAvailableCycles(cardId),
      ]);
      setTransactions(txs);
      setAvailableCycles(cycles);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const loadedCards = await getCards();
      const cardList = Array.isArray(loadedCards) ? loadedCards : [];
      setCards(cardList);
      const activeId = selectedCard ?? (cardList.length > 0 ? cardList[0].id : null);
      if (!selectedCard && cardList.length > 0) setSelectedCard(cardList[0].id);

      if (viewMode === "mensal") {
        await loadMensal(activeId);
      } else {
        await loadFatura(activeId, selectedCycle);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedCard, viewMode, selectedCycle, loadMensal, loadFatura]);

  useEffect(() => { load(); }, [load]);

  async function addTransaction() {
    if (!selectedCard || !txForm.description || !txForm.amount) return;
    const installments = parseInt(txForm.installments) || 1;
    const rows = Array.from({ length: installments }, (_, i) => ({
      credit_card_id: selectedCard,
      description: installments > 1 ? `${txForm.description} (${i + 1}/${installments})` : txForm.description,
      amount: parseFloat(txForm.amount) / installments,
      category: txForm.category,
      date: txForm.date,
      installments,
      installment_current: i + 1,
    }));
    await createTransactions(rows);
    setTxOpen(false);
    setTxForm({ description: "", amount: "", category: "outros", date: format(now, "yyyy-MM-dd"), installments: "1" });
    load();
  }

  async function addCard() {
    if (!cardForm.name || !cardForm.limit) return;
    await createCard({
      name: cardForm.name,
      limit: parseFloat(cardForm.limit),
      closing_day: parseInt(cardForm.closing_day),
      due_day: parseInt(cardForm.due_day),
    });
    setCardOpen(false);
    setCardForm({ name: "", limit: "", closing_day: "1", due_day: "10" });
    load();
  }

  async function handleDeleteTransaction(id: string) {
    await deleteTransaction(id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleClearTransactions() {
    if (!selectedCard) return;
    setClearing(true);
    try {
      if (viewMode === "mensal") {
        await clearTransactions(selectedCard, monthStart, monthEnd);
      } else {
        await clearTransactions(selectedCard, undefined, undefined, selectedCycle);
      }
      setTransactions([]);
      setClearOpen(false);
    } finally {
      setClearing(false);
    }
  }

  const activeCard = cards.find((c) => c.id === selectedCard);
  const cardTransactions = transactions.filter((t) => t.credit_card_id === selectedCard);

  // Mensal totals (only positives count as "gasto")
  const cardSpent = cardTransactions.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);
  const limitPercent = activeCard ? (cardSpent / activeCard.limit) * 100 : 0;

  // Fatura totals
  const compras = cardTransactions.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);
  const creditos = cardTransactions.reduce((s, t) => s + (t.amount < 0 ? t.amount : 0), 0); // negative
  const totalFatura = saldoAnterior + compras + creditos;
  const hasFaturaData = cardTransactions.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Cartão de Crédito</h1>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 mt-2 p-0.5 bg-muted rounded-lg w-fit">
            <button
              onClick={() => setViewMode("mensal")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === "mensal" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Calendar className="h-3.5 w-3.5" /> Mensal
            </button>
            <button
              onClick={() => setViewMode("fatura")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors ${viewMode === "fatura" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Receipt className="h-3.5 w-3.5" /> Fatura
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2 mt-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
              if (viewMode === "mensal") setCurrentMonth((m) => subMonths(m, 1));
              else setSelectedCycle((c) => prevCycle(c));
            }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground capitalize text-sm font-medium min-w-[160px] text-center">
              {viewMode === "mensal" ? monthLabel : `Fatura ${cycleLabel(selectedCycle)}`}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
              if (viewMode === "mensal") setCurrentMonth((m) => addMonths(m, 1));
              else setSelectedCycle((c) => nextCycle(c));
            }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Available cycles hint */}
          {viewMode === "fatura" && availableCycles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {availableCycles.slice(0, 6).map((c) => (
                <button key={c} onClick={() => setSelectedCycle(c)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${c === selectedCycle ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                  {cycleLabel(c)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {viewMode === "mensal" && activeCard && cardTransactions.length > 0 && (
            <Button variant="outline" onClick={() => generateMonthReport(cardTransactions.filter(t => t.amount > 0), activeCard, monthLabel)}>
              <FileDown className="h-4 w-4" /> Relatório PDF
            </Button>
          )}
          <NubankImport cards={cards} onImported={(cycle) => {
            if (cycle) {
              setViewMode("fatura");
              setSelectedCycle(cycle);
            }
            load();
          }} />
          {cardTransactions.length > 0 && (
            <Dialog open={clearOpen} onOpenChange={setClearOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30">
                  <Eraser className="h-4 w-4" /> Limpar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Limpar transações</DialogTitle></DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Vai excluir todas as <strong>{cardTransactions.length} transações</strong> de{" "}
                  <strong className="capitalize">
                    {viewMode === "mensal" ? monthLabel : `Fatura ${cycleLabel(selectedCycle)}`}
                  </strong>. Ação irreversível.
                </p>
                <div className="flex gap-2 justify-end mt-2">
                  <Button variant="outline" onClick={() => setClearOpen(false)} disabled={clearing}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleClearTransactions} disabled={clearing}>
                    {clearing ? "Limpando..." : "Confirmar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={cardOpen} onOpenChange={setCardOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><CardIcon className="h-4 w-4" />Novo cartão</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar cartão</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome do cartão</Label>
                  <Input placeholder="Ex: Nubank Roxinho" value={cardForm.name}
                    onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Limite (R$)</Label>
                  <Input type="number" placeholder="5000" value={cardForm.limit}
                    onChange={(e) => setCardForm({ ...cardForm, limit: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Dia de fechamento</Label>
                    <Input type="number" min={1} max={31} value={cardForm.closing_day}
                      onChange={(e) => setCardForm({ ...cardForm, closing_day: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Dia de vencimento</Label>
                    <Input type="number" min={1} max={31} value={cardForm.due_day}
                      onChange={(e) => setCardForm({ ...cardForm, due_day: e.target.value })} />
                  </div>
                </div>
                <Button className="w-full" onClick={addCard}>Adicionar cartão</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={txOpen} onOpenChange={setTxOpen}>
            <DialogTrigger asChild>
              <Button disabled={cards.length === 0}><Plus className="h-4 w-4" />Nova compra</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar compra</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Cartão</Label>
                  <Select value={selectedCard ?? ""} onValueChange={setSelectedCard}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {cards.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Input placeholder="Ex: Mercado" value={txForm.description}
                    onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Valor total (R$)</Label>
                    <Input type="number" placeholder="0.00" value={txForm.amount}
                      onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Parcelas</Label>
                    <Input type="number" min={1} max={36} value={txForm.installments}
                      onChange={(e) => setTxForm({ ...txForm, installments: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={txForm.category}
                    onValueChange={(v) => setTxForm({ ...txForm, category: v as TransactionCategory })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input type="date" value={txForm.date}
                    onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} />
                </div>
                <Button className="w-full" onClick={addTransaction}>Registrar compra</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {cards.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <CardIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum cartão cadastrado.</p>
            <p className="text-sm text-muted-foreground">Clique em &quot;Novo cartão&quot; para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {cards.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {cards.map((c) => (
                <Button key={c.id} variant={selectedCard === c.id ? "default" : "outline"} size="sm"
                  onClick={() => setSelectedCard(c.id)}>{c.name}</Button>
              ))}
            </div>
          )}

          {/* ── VISÃO MENSAL ── */}
          {viewMode === "mensal" && activeCard && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardDescription>Gasto no mês</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(cardSpent)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Limite disponível</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(activeCard.limit - cardSpent)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Uso do limite</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{limitPercent.toFixed(0)}%</p>
                  <Progress value={limitPercent} className={`mt-2 h-2 ${limitPercent > 80 ? "[&>div]:bg-destructive" : ""}`} />
                  <p className="text-xs text-muted-foreground mt-1">de {formatCurrency(activeCard.limit)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── VISÃO FATURA ── */}
          {viewMode === "fatura" && (
            <>
              {!hasFaturaData ? (
                <Card className="text-center py-10">
                  <CardContent>
                    <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium">Nenhuma fatura importada para {cycleLabel(selectedCycle)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Importe o CSV do Nubank referente a este período.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Fatura breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Compras e encargos</p>
                        <p className="text-xl font-bold text-destructive tabular-nums">{fmt(compras)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Créditos e pagamentos</p>
                        <p className="text-xl font-bold text-green-600 tabular-nums">{fmt(Math.abs(creditos))}</p>
                      </CardContent>
                    </Card>

                    {/* Saldo anterior — clicável */}
                    <div
                      className="rounded-lg border p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => { setSaldoInput(saldoAnterior !== 0 ? String(saldoAnterior) : ""); setSaldoOpen(true); }}
                    >
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Saldo anterior</p>
                      <div className="flex items-center gap-2">
                        <p className={`text-xl font-bold tabular-nums ${saldoAnterior < 0 ? "text-green-600" : ""}`}>
                          {saldoAnterior !== 0 ? (saldoAnterior < 0 ? `crédito ${fmt(Math.abs(saldoAnterior))}` : fmt(saldoAnterior)) : "—"}
                        </p>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Total a pagar */}
                    <Card className={`border-2 ${totalFatura > 0 ? "border-destructive/40" : "border-green-300"}`}
                      style={{ background: totalFatura > 0 ? "linear-gradient(135deg,#fee2e208,transparent)" : "linear-gradient(135deg,#dcfce708,transparent)" }}>
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs font-bold uppercase tracking-wide mb-1"
                          style={{ color: totalFatura > 0 ? "hsl(var(--destructive))" : "#16a34a" }}>
                          Total a pagar
                        </p>
                        <p className="text-2xl font-bold tabular-nums"
                          style={{ color: totalFatura > 0 ? "hsl(var(--destructive))" : "#16a34a" }}>
                          {fmt(totalFatura)}
                        </p>
                        {saldoAnterior === 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">informe o saldo anterior ↑</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Dialog: saldo anterior */}
                  <Dialog open={saldoOpen} onOpenChange={setSaldoOpen}>
                    <DialogContent className="max-w-sm">
                      <DialogHeader><DialogTitle>Saldo anterior — {cycleLabel(selectedCycle)}</DialogTitle></DialogHeader>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Valor exibido no resumo da fatura Nubank:</p>
                        <p className="text-xs">• <span className="text-destructive font-medium">Positivo</span> → dívida que veio da fatura anterior</p>
                        <p className="text-xs">• <span className="text-green-600 font-medium">Negativo (ex: -207,90)</span> → crédito por ter pago a mais no mês anterior</p>
                      </div>
                      <div className="space-y-3 pt-1">
                        <div className="space-y-1.5">
                          <Label>Valor (R$) — use negativo para crédito</Label>
                          <Input type="number" placeholder="0,00" value={saldoInput}
                            onChange={(e) => setSaldoInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveSaldoAnterior()} autoFocus />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1" onClick={() => setSaldoOpen(false)}>Cancelar</Button>
                          <Button className="flex-1" onClick={saveSaldoAnterior}>Salvar</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </>
          )}

          {/* ── Lista de transações ── */}
          <Card>
            <CardHeader>
              <CardTitle>Transações</CardTitle>
              <CardDescription>
                {cardTransactions.length} lançamento{cardTransactions.length !== 1 ? "s" : ""}{" "}
                {viewMode === "mensal" ? `em ${monthLabel}` : `· Fatura ${cycleLabel(selectedCycle)}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cardTransactions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">
                  {viewMode === "fatura"
                    ? "Importe o CSV do Nubank para visualizar a fatura aqui."
                    : "Nenhuma transação registrada este mês."}
                </p>
              ) : (
                <div className="space-y-2">
                  {cardTransactions.map((tx) => {
                    const isCredit = tx.amount < 0;
                    return (
                      <div key={tx.id}
                        className={`flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors ${isCredit ? "border-green-200 bg-green-50/40" : ""}`}>
                        <div className="flex items-center gap-3">
                          {isCredit && <ArrowDownCircle className="h-4 w-4 text-green-600 shrink-0" />}
                          <div>
                            <p className="font-medium text-sm">{tx.description}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                          </div>
                          {isCredit ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">Crédito</Badge>
                          ) : (
                            <Badge className={CATEGORY_COLORS[tx.category]}>{CATEGORY_LABELS[tx.category]}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={`font-semibold ${isCredit ? "text-green-600" : "text-destructive"}`}>
                              {isCredit ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
                            </p>
                            {tx.installments > 1 && (
                              <p className="text-xs text-muted-foreground">{tx.installment_current}/{tx.installments}x</p>
                            )}
                          </div>
                          <Button variant="ghost" size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteTransaction(tx.id)}>
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
