"use client";

import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCards, getTransactions, getAvailableCycles, getInvestmentAccounts, getStockTrades, getStockQuotes } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { addMonths } from "date-fns";
import type { CreditCard, Transaction, InvestmentAccount, StockTrade } from "@/types/database";
import type { StockQuote } from "@/lib/api";
import { Printer, X } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  alimentacao: "Alimentação", transporte: "Transporte", saude: "Saúde",
  lazer: "Lazer", educacao: "Educação", moradia: "Moradia",
  vestuario: "Vestuário", assinatura: "Assinatura", outros: "Outros",
};

export default function ImprimirRelatorioPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [stockTrades, setStockTrades] = useState<StockTrade[]>([]);
  const [stockQuotes, setStockQuotes] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesLabel, setMesLabel] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    getCards().then(async (cardList) => {
      const c = Array.isArray(cardList) ? cardList as CreditCard[] : [];
      setCards(c);
      let cycle = format(addMonths(now, 1), "yyyy-MM");
      if (c.length > 0) {
        const cycles = await getAvailableCycles(c[0].id);
        if (cycles.length > 0) cycle = cycles[0];
      }
      setMesLabel(format(new Date(cycle + "-01"), "MMMM 'de' yyyy", { locale: ptBR }));
      const [t, a, st, sq] = await Promise.all([
        getTransactions({ billingCycle: cycle }),
        getInvestmentAccounts(),
        getStockTrades(),
        getStockQuotes(),
      ]);
      setTransactions(Array.isArray(t) ? t as Transaction[] : []);
      setAccounts(Array.isArray(a) ? a as InvestmentAccount[] : []);
      setStockTrades(Array.isArray(st) ? st as StockTrade[] : []);
      setStockQuotes(Array.isArray(sq) ? sq as StockQuote[] : []);
    }).finally(() => setLoading(false));
  }, []);

  const totalGasto = transactions.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0);
  const rendaFixa = accounts.reduce((s, a) => s + a.current_balance, 0);
  const quoteMap = Object.fromEntries(stockQuotes.map((q) => [q.ticker, q.current_price]));
  const netQty = stockTrades.reduce<Record<string, number>>((acc, t) => {
    acc[t.ticker] = (acc[t.ticker] ?? 0) + (t.type === "venda" ? -t.quantity : t.quantity);
    return acc;
  }, {});
  const acoes = Object.entries(netQty).reduce((s, [ticker, qty]) => s + qty * (quoteMap[ticker] ?? 0), 0);
  const totalPatrimonio = rendaFixa + acoes;

  const byCategory = transactions.reduce<Record<string, number>>((acc, t) => {
    if (t.amount > 0) acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});
  const categorias = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  function handlePrint() { window.print(); }

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">Preparando relatório...</div>;
  }

  return (
    <>
      {/* Barra de ações — some ao imprimir */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
        <h1 className="font-semibold text-sm">Relatório — {mesLabel}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" /> Fechar
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-sm font-medium bg-foreground text-background px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      {/* Conteúdo do relatório */}
      <div ref={printRef} className="max-w-2xl mx-auto px-6 py-8 space-y-8 print:px-0 print:py-0 print:space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-2xl font-bold">IBANK</h2>
            <p className="text-sm text-muted-foreground">Relatório Financeiro — {mesLabel}</p>
          </div>
          <p className="text-xs text-muted-foreground">{format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</p>
        </div>

        {/* Resumo geral */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Resumo Geral</h3>
          <div className="grid grid-cols-3 divide-x border rounded-xl overflow-hidden">
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">Total Gasto</p>
              <p className="text-lg font-bold mt-0.5">{formatCurrency(totalGasto)}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">Limite Cartões</p>
              <p className="text-lg font-bold mt-0.5">{formatCurrency(totalLimit)}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">Patrimônio</p>
              <p className="text-lg font-bold mt-0.5">{formatCurrency(totalPatrimonio)}</p>
            </div>
          </div>
        </section>

        {/* Gastos por categoria */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Gastos por Categoria</h3>
          <div className="divide-y border rounded-xl overflow-hidden">
            {categorias.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum gasto registrado</p>
            )}
            {categorias.map(([cat, val]) => (
              <div key={cat} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm">{CATEGORY_LABELS[cat] ?? cat}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">{totalGasto > 0 ? ((val / totalGasto) * 100).toFixed(1) : 0}%</span>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(val)}</span>
                </div>
              </div>
            ))}
            {categorias.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-sm font-bold">{formatCurrency(totalGasto)}</span>
              </div>
            )}
          </div>
        </section>

        {/* Investimentos */}
        <section>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Carteira de Investimentos</h3>
          <div className="divide-y border rounded-xl overflow-hidden">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm">{a.name}</span>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(a.current_balance)}</span>
              </div>
            ))}
            {Object.entries(netQty).filter(([, qty]) => qty > 0).map(([ticker, qty]) => (
              <div key={ticker} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm">{ticker} ({qty.toFixed(0)} un.)</span>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(qty * (quoteMap[ticker] ?? 0))}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-sm font-bold">{formatCurrency(totalPatrimonio)}</span>
            </div>
          </div>
        </section>

        <p className="text-[10px] text-center text-muted-foreground print:block">
          Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · IBANK Gestão Financeira
        </p>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}
