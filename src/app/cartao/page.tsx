"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Trash2, CreditCard as CardIcon, Eraser, ChevronLeft, ChevronRight,
  FileDown, Receipt, Pencil, ArrowDownCircle, Search, RefreshCw,
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
  createTransactions, deleteTransaction, clearTransactions, updateTransactionCategory,
} from "@/lib/api";
import { generateMonthReport } from "@/lib/generate-report";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CreditCard, Transaction, TransactionCategory } from "@/types/database";
import { NubankImport } from "@/components/nubank-import";
import { format, addMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIES: { value: TransactionCategory; label: string }[] = [
  { value: "alimentacao", label: "Alimentação" },
  { value: "transporte", label: "Transporte" },
  { value: "saude", label: "Saúde" },
  { value: "lazer", label: "Lazer" },
  { value: "educacao", label: "Educação" },
  { value: "moradia", label: "Moradia" },
  { value: "vestuario", label: "Vestuário" },
  { value: "assinatura", label: "Assinatura" },
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
  assinatura: "bg-violet-100 text-violet-800",
  outros: "bg-gray-100 text-gray-800",
};

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
);

function cycleLabel(cycle: string) {
  return format(new Date(`${cycle}-01T12:00:00`), "MMMM yyyy", { locale: ptBR });
}

function prevCycle(cycle: string) {
  const [y, m] = cycle.split("-").map(Number);
  return format(new Date(y, m - 2, 1), "yyyy-MM");
}

function nextCycle(cycle: string) {
  const [y, m] = cycle.split("-").map(Number);
  return format(new Date(y, m, 1), "yyyy-MM");
}

function currentCycleId() {
  return format(new Date(), "yyyy-MM");
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function TxRow({
  tx,
  onDelete,
  onToggleAssinatura,
}: {
  tx: Transaction;
  onDelete: (id: string) => void;
  onToggleAssinatura: (tx: Transaction) => void;
}) {
  const isCredit = tx.amount < 0;
  const isAssinatura = tx.category === "assinatura";
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group/row ${isCredit ? "border-green-200 bg-green-50/40" : isAssinatura ? "border-violet-200 bg-violet-50/30" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {isCredit && <ArrowDownCircle className="h-4 w-4 text-green-600 shrink-0" />}
        {isAssinatura && !isCredit && <RefreshCw className="h-3.5 w-3.5 text-violet-500 shrink-0" />}
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{tx.description}</p>
          <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
        </div>
        {isCredit ? (
          <Badge className="bg-green-100 text-green-700 border-green-200 shrink-0">Crédito</Badge>
        ) : (
          <Badge className={`${CATEGORY_COLORS[tx.category]} shrink-0`}>{CATEGORY_LABELS[tx.category] ?? tx.category}</Badge>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-3">
        <div className="text-right mr-2">
          <p className={`font-semibold ${isCredit ? "text-green-600" : "text-destructive"}`}>
            {isCredit ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
          </p>
          {tx.installments > 1 && (
            <p className="text-xs text-muted-foreground">{tx.installment_current}/{tx.installments}x</p>
          )}
        </div>
        <button
          title={isAssinatura ? "Remover assinatura" : "Marcar como assinatura"}
          onClick={() => onToggleAssinatura(tx)}
          className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors opacity-0 group-hover/row:opacity-100 ${isAssinatura ? "text-violet-600 bg-violet-100 hover:bg-violet-200 opacity-100" : "text-muted-foreground hover:text-violet-600 hover:bg-violet-50"}`}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover/row:opacity-100"
          onClick={() => onDelete(tx.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
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
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedCycle, setSelectedCycle] = useState<string>(currentCycleId());
  const [availableCycles, setAvailableCycles] = useState<string[]>([]);

  // Resumo da fatura fields (stored in localStorage)
  const [faturaAnterior, setFaturaAnterior] = useState(0);
  const [pagamentosRecebidos, setPagamentosRecebidos] = useState(0);
  const [iofInternacional, setIofInternacional] = useState(0);
  const [totalNubank, setTotalNubank] = useState<number | null>(null);
  const [saldoAnterior, setSaldoAnterior] = useState(0);
  const [saldoInput, setSaldoInput] = useState("");
  const [saldoOpen, setSaldoOpen] = useState(false);
  const [faturaAntInput, setFaturaAntInput] = useState("");
  const [faturaAntOpen, setFaturaAntOpen] = useState(false);

  const now = new Date();

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

  // Load fatura fields from localStorage whenever card/cycle changes
  useEffect(() => {
    if (!selectedCard) return;
    try {
      const lsGet = (key: string) => {
        const raw = localStorage.getItem(`ibank_${key}_${selectedCard}_${selectedCycle}`);
        return raw ? (parseFloat(raw) || 0) : 0;
      };
      const saldo = lsGet("saldo_ant");
      setSaldoAnterior(saldo);
      setSaldoInput(saldo !== 0 ? String(saldo) : "");
      setFaturaAnterior(lsGet("fatura_ant"));
      setFaturaAntInput(String(lsGet("fatura_ant") || ""));
      setPagamentosRecebidos(lsGet("pag_rec"));
      setIofInternacional(lsGet("iof_int"));
      const tn = localStorage.getItem(`ibank_total_nubank_${selectedCard}_${selectedCycle}`);
      setTotalNubank(tn ? parseFloat(tn) : null);
    } catch { /* ignore */ }
  }, [selectedCard, selectedCycle]);

  function saveSaldoAnterior() {
    const val = parseFloat(saldoInput) || 0;
    setSaldoAnterior(val);
    if (selectedCard) {
      try { localStorage.setItem(`ibank_saldo_ant_${selectedCard}_${selectedCycle}`, String(val)); } catch { /* ignore */ }
    }
    setSaldoOpen(false);
  }

  function saveFaturaAnterior() {
    const val = parseFloat(faturaAntInput) || 0;
    setFaturaAnterior(val);
    const newSaldo = val - pagamentosRecebidos;
    setSaldoAnterior(newSaldo);
    if (selectedCard) {
      try {
        localStorage.setItem(`ibank_fatura_ant_${selectedCard}_${selectedCycle}`, String(val));
        localStorage.setItem(`ibank_saldo_ant_${selectedCard}_${selectedCycle}`, String(newSaldo));
      } catch { /* ignore */ }
    }
    setFaturaAntOpen(false);
  }

  const loadData = useCallback(async (cardId: string | null, cycle: string) => {
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
      await loadData(activeId, selectedCycle);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedCard, selectedCycle, loadData]);

  useEffect(() => { load(); }, [load]);

  async function addTransaction() {
    if (!selectedCard || !txForm.description || !txForm.amount) return;
    const installments = parseInt(txForm.installments) || 1;
    const baseDate = parseISO(txForm.date);
    const rows = Array.from({ length: installments }, (_, i) => {
      const installDate = format(addMonths(baseDate, i), "yyyy-MM-dd");
      return {
        credit_card_id: selectedCard,
        description: installments > 1 ? `${txForm.description} (${i + 1}/${installments})` : txForm.description,
        amount: parseFloat(txForm.amount) / installments,
        category: txForm.category,
        date: installDate,
        billing_cycle: installDate.slice(0, 7),
        installments,
        installment_current: i + 1,
      };
    });
    await createTransactions(rows);
    setTxOpen(false);
    setTxForm({ description: "", amount: "", category: "outros", date: format(now, "yyyy-MM-dd"), installments: "1" });
    load();
  }

  async function toggleAssinatura(tx: Transaction) {
    const newCategory: TransactionCategory = tx.category === "assinatura" ? "outros" : "assinatura";
    const updated = await updateTransactionCategory(tx.id, newCategory);
    setTransactions((prev) => prev.map((t) => (t.id === tx.id ? updated : t)));
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
      await clearTransactions(selectedCard, undefined, undefined, selectedCycle);
      setTransactions([]);
      setClearOpen(false);
    } finally {
      setClearing(false);
    }
  }

  const activeCard = cards.find((c) => c.id === selectedCard);
  const cardTransactions = transactions.filter((t) => t.credit_card_id === selectedCard);
  const filteredTransactions = searchQuery.trim()
    ? cardTransactions.filter((t) => t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    : cardTransactions;
  const subscriptionTxs = filteredTransactions.filter((t) => t.category === "assinatura");
  const regularTxs = filteredTransactions.filter((t) => t.category !== "assinatura");

  // Totals based on fatura data
  const compras = cardTransactions.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);
  const creditos = cardTransactions.reduce((s, t) => s + (t.amount < 0 ? t.amount : 0), 0);
  const totalFatura = saldoAnterior + compras + creditos;
  const hasFaturaData = cardTransactions.length > 0 || totalNubank !== null || faturaAnterior > 0;
  const limitPercent = activeCard ? (compras / activeCard.limit) * 100 : 0;

  const cycleLabelStr = cycleLabel(selectedCycle);

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

          {/* Cycle navigation */}
          <div className="flex items-center gap-2 mt-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedCycle((c) => prevCycle(c))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground capitalize text-sm font-medium min-w-[180px] text-center">
              Fatura {cycleLabelStr}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSelectedCycle((c) => nextCycle(c))}
              disabled={selectedCycle >= currentCycleId()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Available cycles chips */}
          {availableCycles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {availableCycles.slice(0, 8).map((c) => (
                <button key={c} onClick={() => setSelectedCycle(c)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${c === selectedCycle ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                  {cycleLabel(c)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {activeCard && cardTransactions.length > 0 && (
            <Button variant="outline" onClick={() => generateMonthReport(cardTransactions.filter(t => t.amount > 0), activeCard, cycleLabelStr)}>
              <FileDown className="h-4 w-4" /> Relatório PDF
            </Button>
          )}
          <NubankImport cards={cards} onImported={(cycle) => {
            if (cycle) setSelectedCycle(cycle);
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
                  Vai excluir todas as <strong>{cardTransactions.length} transações</strong> da{" "}
                  <strong className="capitalize">Fatura {cycleLabelStr}</strong>. Ação irreversível.
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

          {/* Summary cards */}
          {activeCard && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardDescription>Total da fatura</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-destructive">
                    {totalNubank !== null ? fmt(totalNubank) : formatCurrency(compras)}
                  </p>
                  {totalNubank !== null && <p className="text-xs text-muted-foreground mt-0.5">oficial Nubank</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardDescription>Limite disponível</CardDescription></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(activeCard.limit - compras)}</p>
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

          {/* Resumo da Fatura */}
          {hasFaturaData && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Resumo da Fatura
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    <button
                      className="w-full flex justify-between items-center py-2.5 px-1 -mx-1 hover:bg-muted/30 rounded transition-colors text-left"
                      onClick={() => { setFaturaAntInput(String(faturaAnterior || "")); setFaturaAntOpen(true); }}
                    >
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        Fatura anterior <Pencil className="h-3 w-3" />
                      </span>
                      <span className="text-sm font-medium tabular-nums">
                        {faturaAnterior > 0 ? fmt(faturaAnterior) : <span className="text-muted-foreground/50">— informar</span>}
                      </span>
                    </button>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-sm text-muted-foreground">Pagamento recebido</span>
                      <span className="text-sm font-medium text-green-600 tabular-nums">
                        {pagamentosRecebidos > 0 ? `− ${fmt(pagamentosRecebidos)}` : "—"}
                      </span>
                    </div>
                    {(faturaAnterior > 0 || pagamentosRecebidos > 0) && (
                      <div className="flex justify-between items-center py-2 bg-muted/30 rounded px-2 -mx-2 my-0.5">
                        <span className="text-xs text-muted-foreground font-medium">= Saldo do período anterior</span>
                        <span className={`text-sm font-semibold tabular-nums ${saldoAnterior < 0 ? "text-green-600" : "text-destructive"}`}>
                          {saldoAnterior < 0 ? `crédito de ${fmt(Math.abs(saldoAnterior))}` : fmt(saldoAnterior)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-sm text-muted-foreground">Total de compras</span>
                      <span className="text-sm font-medium tabular-nums">
                        {compras > 0 ? fmt(iofInternacional > 0 ? compras - iofInternacional : compras) : "—"}
                      </span>
                    </div>
                    {iofInternacional > 0 && (
                      <div className="flex justify-between items-center py-2.5">
                        <span className="text-sm text-muted-foreground">IOF de compras internacionais</span>
                        <span className="text-sm font-medium tabular-nums">{fmt(iofInternacional)}</span>
                      </div>
                    )}
                    {creditos < 0 && (
                      <div className="flex justify-between items-center py-2.5">
                        <span className="text-sm text-muted-foreground">Outros lançamentos</span>
                        <span className="text-sm font-medium text-green-600 tabular-nums">− {fmt(Math.abs(creditos))}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 pb-0.5 border-t-2 border-foreground/20 mt-1">
                      <span className="font-bold text-base">Total a pagar</span>
                      <span className={`text-2xl font-bold tabular-nums ${(totalNubank ?? totalFatura) > 0 ? "text-destructive" : "text-green-600"}`}>
                        {totalNubank !== null ? fmt(totalNubank) : fmt(totalFatura)}
                      </span>
                    </div>
                    {totalNubank !== null && Math.abs(totalNubank - totalFatura) > 0.5 && (
                      <p className="text-[10px] text-muted-foreground text-right pt-1">
                        calculado: {fmt(totalFatura)} · oficial Nubank: {fmt(totalNubank)}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Dialog open={faturaAntOpen} onOpenChange={setFaturaAntOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Fatura anterior — {cycleLabelStr}</DialogTitle></DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Total da fatura do mês anterior (antes de qualquer pagamento).
                    Disponível no PDF da fatura Nubank em &quot;Resumo da Fatura&quot;.
                  </p>
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1.5">
                      <Label>Valor (R$)</Label>
                      <Input type="number" placeholder="0,00" value={faturaAntInput}
                        onChange={(e) => setFaturaAntInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveFaturaAnterior()} autoFocus />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setFaturaAntOpen(false)}>Cancelar</Button>
                      <Button className="flex-1" onClick={saveFaturaAnterior}>Salvar</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={saldoOpen} onOpenChange={setSaldoOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Saldo anterior — {cycleLabelStr}</DialogTitle></DialogHeader>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Valor exibido no resumo da fatura Nubank:</p>
                    <p className="text-xs">• <span className="text-destructive font-medium">Positivo</span> → dívida da fatura anterior</p>
                    <p className="text-xs">• <span className="text-green-600 font-medium">Negativo (ex: -207,90)</span> → crédito por ter pago a mais</p>
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

          {/* Transaction list */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Transações</CardTitle>
                  <CardDescription>
                    {filteredTransactions.length} lançamento{filteredTransactions.length !== 1 ? "s" : ""}{" "}
                    · Fatura {cycleLabelStr}
                    {searchQuery && ` · filtrando "${searchQuery}"`}
                  </CardDescription>
                </div>
                {cardTransactions.length > 0 && (
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar transação..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {cardTransactions.length === 0 ? (
                <div className="text-center py-10">
                  <Receipt className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">Nenhuma transação para {cycleLabelStr}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Importe o CSV do Nubank ou registre uma compra manualmente.
                  </p>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">
                  Nenhuma transação encontrada para &quot;{searchQuery}&quot;.
                </p>
              ) : (
                <div className="space-y-4">
                  {subscriptionTxs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <RefreshCw className="h-3.5 w-3.5 text-violet-600" />
                        <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                          Assinaturas ({subscriptionTxs.length})
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatCurrency(subscriptionTxs.reduce((s, t) => s + Math.abs(t.amount), 0))}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {subscriptionTxs.map((tx) => (
                          <TxRow key={tx.id} tx={tx} onDelete={handleDeleteTransaction} onToggleAssinatura={toggleAssinatura} />
                        ))}
                      </div>
                    </div>
                  )}
                  {regularTxs.length > 0 && (
                    <div>
                      {subscriptionTxs.length > 0 && (
                        <div className="flex items-center gap-2 mb-2 pt-1 border-t">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Compras ({regularTxs.length})
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatCurrency(regularTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
                          </span>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {regularTxs.map((tx) => (
                          <TxRow key={tx.id} tx={tx} onDelete={handleDeleteTransaction} onToggleAssinatura={toggleAssinatura} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
