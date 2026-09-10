"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Trash2, CreditCard as CardIcon, Eraser, ChevronLeft, ChevronRight,
  FileDown, Receipt, Pencil, ArrowDownCircle, Search, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { PageHeader, PageShell } from "@/components/mobile";
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

const CATEGORY_DOT_COLORS: Record<string, string> = {
  alimentacao: "bg-blue-500",
  transporte: "bg-green-500",
  saude: "bg-yellow-500",
  lazer: "bg-purple-500",
  educacao: "bg-cyan-500",
  moradia: "bg-red-500",
  vestuario: "bg-orange-500",
  assinatura: "bg-violet-500",
  outros: "bg-gray-400",
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
  onSelect,
}: {
  tx: Transaction;
  onDelete: (id: string) => void;
  onToggleAssinatura: (tx: Transaction) => void;
  onSelect: (tx: Transaction) => void;
}) {
  const isCredit = tx.amount < 0;
  const isAssinatura = tx.category === "assinatura";
  const dotColor = isCredit ? "bg-green-500" : (CATEGORY_DOT_COLORS[tx.category] ?? "bg-gray-400");

  return (
    <div className="flex items-center gap-1 py-1 px-2">
      <button
        type="button"
        onClick={() => onSelect(tx)}
        className="flex items-center gap-3 flex-1 min-w-0 py-2 px-2 rounded-lg text-left active:bg-muted/60 transition-colors touch-manipulation"
      >
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{tx.description}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(tx.date)}
            {isCredit && (
              <span className="ml-1.5 text-green-600">· crédito</span>
            )}
            {isAssinatura && !isCredit && (
              <span className="ml-1.5 text-violet-500">· assinatura</span>
            )}
            {tx.installments > 1 && (
              <span className="ml-1.5">· {tx.installment_current}/{tx.installments}x</span>
            )}
          </p>
        </div>
        <span className={`text-sm font-semibold tabular-nums shrink-0 ${isCredit ? "text-green-600" : "text-destructive"}`}>
          {isCredit ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
        </span>
      </button>
      <button
        type="button"
        title={isAssinatura ? "Remover assinatura" : "Marcar como assinatura"}
        onClick={() => onToggleAssinatura(tx)}
        className={`h-11 w-11 flex items-center justify-center rounded-lg touch-manipulation transition-colors ${
          isAssinatura
            ? "text-violet-500"
            : "text-muted-foreground/40 hover:text-violet-500"
        }`}
      >
        <RefreshCw className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Excluir"
        onClick={() => onDelete(tx.id)}
        className="h-11 w-11 flex items-center justify-center rounded-lg text-muted-foreground/40 hover:text-destructive touch-manipulation transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function TxDetailSheet({
  tx,
  onClose,
  onDelete,
  onToggleAssinatura,
}: {
  tx: Transaction | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onToggleAssinatura: (tx: Transaction) => void;
}) {
  if (!tx) return null;
  const isCredit = tx.amount < 0;
  const isAssinatura = tx.category === "assinatura";
  const dotColor = isCredit ? "bg-green-500" : (CATEGORY_DOT_COLORS[tx.category] ?? "bg-gray-400");

  return (
    <>
      {/* overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-background border-t shadow-xl pb-safe">
        {/* handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* descrição completa */}
          <div className="flex items-start gap-3">
            <span className={`h-3 w-3 rounded-full shrink-0 mt-1 ${dotColor}`} />
            <p className="text-base font-semibold leading-snug">{tx.description}</p>
          </div>

          {/* detalhes */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Valor</p>
              <p className={`font-bold tabular-nums ${isCredit ? "text-green-600" : "text-destructive"}`}>
                {isCredit ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Data</p>
              <p className="font-medium">{formatDate(tx.date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Categoria</p>
              <p className="font-medium">{CATEGORY_LABELS[tx.category] ?? tx.category}</p>
            </div>
            {tx.installments > 1 && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Parcelas</p>
                <p className="font-medium">{tx.installment_current}/{tx.installments}x</p>
              </div>
            )}
          </div>

          {/* ações */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { onToggleAssinatura(tx); onClose(); }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-colors ${
                isAssinatura
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              {isAssinatura ? "Remover assinatura" : "Marcar assinatura"}
            </button>
            <button
              type="button"
              onClick={() => { onDelete(tx.id); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium bg-destructive/10 text-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </button>
          </div>
        </div>
      </div>
    </>
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
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const [selectedCycle, setSelectedCycle] = useState<string>(() => {
    try { return localStorage.getItem("ibank_cartao_cycle") || currentCycleId(); } catch { return currentCycleId(); }
  });
  const [availableCycles, setAvailableCycles] = useState<string[]>([]);

  function changeCycle(cycle: string) {
    setSelectedCycle(cycle);
    try { localStorage.setItem("ibank_cartao_cycle", cycle); } catch { /* ignore */ }
  }

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
  // Parcelas futuras calculadas diretamente dos metadados de parcelamento da fatura atual
  // (funciona mesmo sem linhas futuras no banco, pois installments e installment_current já dizem quantas restam)
  const futureFromInstallments = cardTransactions
    .filter((t) => t.amount > 0 && t.installments > 1 && t.installment_current < t.installments)
    .reduce((s, t) => s + t.amount * (t.installments - t.installment_current), 0);
  const totalComprometido = compras + futureFromInstallments;
  const limiteReal = activeCard ? activeCard.limit - totalComprometido : 0;
  const limitPercent = activeCard ? (totalComprometido / activeCard.limit) * 100 : 0;

  const cycleLabelStr = cycleLabel(selectedCycle);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Cartão de Crédito"
        description={`Fatura ${cycleLabelStr}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {activeCard && cardTransactions.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground shrink-0"
                title="Relatório PDF"
                onClick={() => generateMonthReport(cardTransactions.filter(t => t.amount > 0), activeCard, cycleLabelStr)}
              >
                <FileDown className="h-4 w-4" />
              </Button>
            )}
            <NubankImport cards={cards} onImported={(cycle) => {
              if (cycle) changeCycle(cycle);
              load();
            }} />
            {cardTransactions.length > 0 && (
              <Dialog open={clearOpen} onOpenChange={setClearOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive shrink-0" title="Limpar transações">
                    <Eraser className="h-4 w-4" />
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
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground shrink-0" title="Novo cartão">
                  <CardIcon className="h-4 w-4" />
                </Button>
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
                <Button size="sm" disabled={cards.length === 0} className="min-h-10 shrink-0">
                  <Plus className="h-4 w-4" />
                  <span className="sm:hidden">Compra</span>
                  <span className="hidden sm:inline">Nova compra</span>
                </Button>
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
        }
      />

      <div className="border-b px-4 sm:px-6 pb-3">
        {/* Cycle navigation */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="shrink-0 h-11 w-11" onClick={() => changeCycle(prevCycle(selectedCycle))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex-1 text-center text-sm text-muted-foreground capitalize font-medium">
            Fatura {cycleLabelStr}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-11 w-11"
            onClick={() => changeCycle(nextCycle(selectedCycle))}
            disabled={selectedCycle >= currentCycleId()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Available cycles chips */}
        {availableCycles.length > 0 && (
          <div className="relative mt-2">
            <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none pr-6">
              {availableCycles.slice(0, 8).map((c) => (
                <button
                  key={c}
                  onClick={() => changeCycle(c)}
                  className={`text-[11px] px-3 py-1.5 rounded-full border shrink-0 transition-colors min-h-9 touch-manipulation ${
                    c === selectedCycle
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {cycleLabel(c)}
                </button>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
          </div>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 px-4">
          <CardIcon className="h-12 w-12 text-muted-foreground/30" />
          <div className="text-center">
            <p className="font-medium text-muted-foreground">Nenhum cartão cadastrado</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Clique no ícone de cartão para começar.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Card selector tabs */}
          {cards.length > 1 && (
            <div className="flex gap-1 px-4 py-2 border-b overflow-x-auto">
              {cards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCard(c.id)}
                  className={`text-sm px-3 py-1 rounded-full border shrink-0 transition-colors ${
                    selectedCard === c.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {/* Summary strip */}
          {activeCard && (
            <div className="flex divide-x border-b">
              <div className="flex-1 px-2 sm:px-4 py-3 min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Total da fatura</p>
                <p className="text-sm sm:text-base font-bold text-destructive mt-0.5 tabular-nums truncate">
                  {totalNubank !== null ? fmt(totalNubank) : formatCurrency(compras)}
                </p>
                {futureFromInstallments > 0 && (
                  <p className="text-[10px] sm:text-[11px] text-amber-600 mt-0.5 tabular-nums truncate">
                    +{formatCurrency(futureFromInstallments)} futuras
                  </p>
                )}
              </div>
              <div className="flex-1 px-2 sm:px-4 py-3 min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Disponível real</p>
                <p className={`text-sm sm:text-base font-bold mt-0.5 tabular-nums truncate ${limiteReal >= 0 ? "text-green-600" : "text-destructive"}`}>
                  {formatCurrency(Math.max(0, limiteReal))}
                </p>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
                  de {formatCurrency(activeCard.limit)}
                </p>
              </div>
              <div className="flex-1 px-2 sm:px-4 py-3 min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Comprometido</p>
                <p className={`text-sm sm:text-base font-bold mt-0.5 tabular-nums ${limitPercent > 80 ? "text-destructive" : ""}`}>
                  {Math.min(limitPercent, 100).toFixed(0)}%
                </p>
                <Progress
                  value={Math.min(limitPercent, 100)}
                  className={`mt-1.5 h-1.5 ${limitPercent > 80 ? "[&>div]:bg-destructive" : ""}`}
                />
              </div>
            </div>
          )}

          {/* Resumo da Fatura */}
          {hasFaturaData && (
            <>
              <div className="border-b">
                <div className="px-4 py-2.5 flex items-center gap-2 bg-muted/30 border-b">
                  <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumo da fatura</span>
                </div>
                <div className="divide-y divide-border/50">
                  <button
                    className="w-full flex justify-between items-center py-2.5 px-4 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => { setFaturaAntInput(String(faturaAnterior || "")); setFaturaAntOpen(true); }}
                  >
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      Fatura anterior <Pencil className="h-3 w-3" />
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {faturaAnterior > 0 ? fmt(faturaAnterior) : <span className="text-muted-foreground/50">— informar</span>}
                    </span>
                  </button>
                  <div className="flex justify-between items-center py-2.5 px-4">
                    <span className="text-sm text-muted-foreground">Pagamento recebido</span>
                    <span className="text-sm font-medium text-green-600 tabular-nums">
                      {pagamentosRecebidos > 0 ? `− ${fmt(pagamentosRecebidos)}` : "—"}
                    </span>
                  </div>
                  {(faturaAnterior > 0 || pagamentosRecebidos > 0) && (
                    <div className="flex justify-between items-center py-2.5 px-4 bg-muted/20">
                      <span className="text-xs text-muted-foreground font-medium">= Saldo do período anterior</span>
                      <span className={`text-sm font-semibold tabular-nums ${saldoAnterior < 0 ? "text-green-600" : "text-destructive"}`}>
                        {saldoAnterior < 0 ? `crédito de ${fmt(Math.abs(saldoAnterior))}` : fmt(saldoAnterior)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2.5 px-4">
                    <span className="text-sm text-muted-foreground">Total de compras</span>
                    <span className="text-sm font-medium tabular-nums">
                      {compras > 0 ? fmt(iofInternacional > 0 ? compras - iofInternacional : compras) : "—"}
                    </span>
                  </div>
                  {iofInternacional > 0 && (
                    <div className="flex justify-between items-center py-2.5 px-4">
                      <span className="text-sm text-muted-foreground">IOF de compras internacionais</span>
                      <span className="text-sm font-medium tabular-nums">{fmt(iofInternacional)}</span>
                    </div>
                  )}
                  {creditos < 0 && (
                    <div className="flex justify-between items-center py-2.5 px-4">
                      <span className="text-sm text-muted-foreground">Outros lançamentos</span>
                      <span className="text-sm font-medium text-green-600 tabular-nums">− {fmt(Math.abs(creditos))}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-3 px-4 border-t-2 border-foreground/10">
                    <span className="font-bold text-base">Total a pagar</span>
                    <span className={`text-xl font-bold tabular-nums ${(totalNubank ?? totalFatura) > 0 ? "text-destructive" : "text-green-600"}`}>
                      {totalNubank !== null ? fmt(totalNubank) : fmt(totalFatura)}
                    </span>
                  </div>
                  {totalNubank !== null && Math.abs(totalNubank - totalFatura) > 0.5 && (
                    <p className="text-[10px] text-muted-foreground text-right px-4 pb-2">
                      calculado: {fmt(totalFatura)} · oficial Nubank: {fmt(totalNubank)}
                    </p>
                  )}
                </div>
              </div>

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
          <div>
            {/* List header with search */}
            <div className="px-4 py-2.5 border-b flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
                {filteredTransactions.length} lançamento{filteredTransactions.length !== 1 ? "s" : ""}
                {searchQuery && ` · "${searchQuery}"`}
              </span>
              {cardTransactions.length > 0 && (
                <div className="relative max-w-[180px] w-full">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 h-7 text-xs"
                  />
                </div>
              )}
            </div>

            {cardTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
                <Receipt className="h-10 w-10 text-muted-foreground/30" />
                <div className="text-center">
                  <p className="font-medium text-muted-foreground">Nenhuma transação para {cycleLabelStr}</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Importe o CSV do Nubank ou registre uma compra manualmente.
                  </p>
                </div>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-10 text-sm px-4">
                Nenhuma transação encontrada para &quot;{searchQuery}&quot;.
              </p>
            ) : (
              <>
                {/* Assinaturas */}
                {subscriptionTxs.length > 0 && (
                  <div className="border-b">
                    <div className="px-4 py-2 flex items-center gap-2 bg-violet-50/50 dark:bg-violet-950/20 border-b border-violet-100 dark:border-violet-900/30">
                      <RefreshCw className="h-3 w-3 text-violet-500 shrink-0" />
                      <span className="text-xs font-medium text-violet-700 dark:text-violet-400">
                        Assinaturas ({subscriptionTxs.length})
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                        {formatCurrency(subscriptionTxs.reduce((s, t) => s + Math.abs(t.amount), 0))}
                      </span>
                    </div>
                    <div className="divide-y divide-border/50">
                      {subscriptionTxs.map((tx) => (
                        <TxRow key={tx.id} tx={tx} onDelete={handleDeleteTransaction} onToggleAssinatura={toggleAssinatura} onSelect={setSelectedTx} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Compras regulares */}
                {regularTxs.length > 0 && (
                  <div>
                    {subscriptionTxs.length > 0 && (
                      <div className="px-4 py-2 flex items-center gap-2 bg-muted/30 border-b">
                        <span className="text-xs font-medium text-muted-foreground">
                          Compras ({regularTxs.length})
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                          {formatCurrency(regularTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
                        </span>
                      </div>
                    )}
                    <div className="divide-y divide-border/50">
                      {regularTxs.map((tx) => (
                        <TxRow key={tx.id} tx={tx} onDelete={handleDeleteTransaction} onToggleAssinatura={toggleAssinatura} onSelect={setSelectedTx} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      <TxDetailSheet
        tx={selectedTx}
        onClose={() => setSelectedTx(null)}
        onDelete={handleDeleteTransaction}
        onToggleAssinatura={toggleAssinatura}
      />
    </PageShell>
  );
}
