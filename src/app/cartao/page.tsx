"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, CreditCard as CardIcon, Eraser, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getCards, createCard, getTransactions, createTransactions, deleteTransaction, clearTransactions,
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

export default function CartaoPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [txOpen, setTxOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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

  const load = useCallback(async () => {
    try {
      const [loadedCards, loadedTx] = await Promise.all([
        getCards(),
        getTransactions({ start: monthStart, end: monthEnd }),
      ]);
      const cards = Array.isArray(loadedCards) ? loadedCards : [];
      const txs = Array.isArray(loadedTx) ? loadedTx : [];
      setCards(cards);
      setTransactions(txs);
      if (!selectedCard && cards.length > 0) setSelectedCard(cards[0].id);
    } catch (err) {
      console.error("Erro ao carregar cartões:", err);
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd, selectedCard]);

  useEffect(() => { load(); }, [load]);

  async function addTransaction() {
    if (!selectedCard || !txForm.description || !txForm.amount) return;
    const installments = parseInt(txForm.installments) || 1;
    const rows = Array.from({ length: installments }, (_, i) => ({
      credit_card_id: selectedCard,
      description: installments > 1
        ? `${txForm.description} (${i + 1}/${installments})`
        : txForm.description,
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
      await clearTransactions(selectedCard, monthStart, monthEnd);
      setTransactions([]);
      setClearOpen(false);
    } finally {
      setClearing(false);
    }
  }

  const activeCard = cards.find((c) => c.id === selectedCard);
  const cardTransactions = transactions.filter((t) => t.credit_card_id === selectedCard);
  const cardSpent = cardTransactions.reduce((s, t) => s + t.amount, 0);
  const limitPercent = activeCard ? (cardSpent / activeCard.limit) * 100 : 0;

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
          <h1 className="text-3xl font-bold">Cartão de Crédito</h1>
          <div className="flex items-center gap-2 mt-1">
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground capitalize text-sm font-medium min-w-[120px] text-center">
              {monthLabel}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          {activeCard && cardTransactions.length > 0 && (
            <Button variant="outline" onClick={() =>
              generateMonthReport(cardTransactions, activeCard, monthLabel)
            }>
              <FileDown className="h-4 w-4" />
              Relatório PDF
            </Button>
          )}
          <NubankImport cards={cards} onImported={(firstDate) => {
            if (firstDate) {
              const d = new Date(firstDate + "T12:00:00");
              setCurrentMonth(d);
            }
            load();
          }} />
          {cardTransactions.length > 0 && (
            <Dialog open={clearOpen} onOpenChange={setClearOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30">
                  <Eraser className="h-4 w-4" />
                  Limpar mês
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Limpar transações do mês</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Isso vai excluir todas as <strong>{cardTransactions.length} transações</strong> de{" "}
                  <strong className="capitalize">{monthLabel}</strong> do cartão selecionado. Essa ação não pode ser desfeita.
                </p>
                <div className="flex gap-2 justify-end mt-2">
                  <Button variant="outline" onClick={() => setClearOpen(false)} disabled={clearing}>
                    Cancelar
                  </Button>
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

          {activeCard && (
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
                  <Progress value={limitPercent}
                    className={`mt-2 h-2 ${limitPercent > 80 ? "[&>div]:bg-destructive" : ""}`} />
                  <p className="text-xs text-muted-foreground mt-1">de {formatCurrency(activeCard.limit)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Transações</CardTitle>
              <CardDescription>
                {cardTransactions.length} transação{cardTransactions.length !== 1 ? "ões" : ""} em {monthLabel}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cardTransactions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">
                  Nenhuma transação registrada este mês.
                </p>
              ) : (
                <div className="space-y-2">
                  {cardTransactions.map((tx) => (
                    <div key={tx.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-sm">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                        </div>
                        <Badge className={CATEGORY_COLORS[tx.category]}>
                          {CATEGORY_LABELS[tx.category]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-destructive">-{formatCurrency(tx.amount)}</p>
                          {tx.installments > 1 && (
                            <p className="text-xs text-muted-foreground">
                              {tx.installment_current}/{tx.installments}x
                            </p>
                          )}
                        </div>
                        <Button variant="ghost" size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteTransaction(tx.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
