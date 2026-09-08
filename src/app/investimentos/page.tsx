"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, TrendingUp, BarChart3, LineChart, Info, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getInvestmentAccounts, createInvestmentAccountWithTurbo,
  updateAccountBalance, deleteInvestmentAccount, renameInvestmentAccount, updateTurboSettings,
  getInvestments, createInvestment, deleteInvestment,
  getStockTrades, createStockTrade, deleteStockTrade,
  getStockQuotes, upsertStockQuote, type StockQuote,
  getPortfolioSnapshots, savePortfolioSnapshot,
  getTurboHistory, saveTurboMonth, deleteTurboRecord,
  getScoreHistory, saveScoreSnapshot,
} from "@/lib/api";
import type { TurboRecord, PortfolioSnapshot, ScoreSnapshot } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvestmentAccount, Investment, InvestmentType, StockTrade } from "@/types/database";
import { format } from "date-fns";
import { InvestmentRates } from "@/components/investment-rates";
import { detectCategory, type RateCategory } from "@/lib/investment-rates";
import { getCurrentUser } from "@/lib/user";
import {
  accountBalance, detectAssetType, detectSector, computeStockPositions,
} from "@/lib/stock-utils";
import { printInvestorReport } from "@/lib/generate-investor-report";
import { InvestorModeView } from "@/components/investimentos/investor-mode-view";
import { TotalTab } from "@/components/investimentos/total-tab";
import { AccountTab } from "@/components/investimentos/account-tab";
import { AcoesTab } from "@/components/investimentos/acoes-tab";
import { useUser } from "@/context/user-context";

export default function InvestimentosPage() {
  const { botEnabled } = useUser();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [stockTrades, setStockTrades] = useState<StockTrade[]>([]);
  const [stockQuotes, setStockQuotes] = useState<StockQuote[]>([]);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ ticker: "", price: "" });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ibank_inv_tab") ?? "total";
    }
    return "total";
  });
  const [invOpen, setInvOpen] = useState(false);
  const [accOpen, setAccOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameForm, setRenameForm] = useState({
    id: "", name: "", institution: "",
    is_turbo: false, cdi_percent: "", max_rendimento: "", valor_bruto: "", valor_liquido: "",
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [investorMode, setInvestorMode] = useState(false);
  const [incomeGoal, setIncomeGoal] = useState<number>(() => {
    try { return Number(localStorage.getItem("ibank_income_goal") ?? 0) || 0; } catch { return 0; }
  });
  const [incomeGoalInput, setIncomeGoalInput] = useState("");

  const now = new Date();

  const [invForm, setInvForm] = useState({
    account_id: "",
    type: "deposito" as InvestmentType,
    amount: "",
    description: "",
    date: format(now, "yyyy-MM-dd"),
  });

  const [accForm, setAccForm] = useState({
    name: "", institution: "",
    is_turbo: false, cdi_percent: "", max_rendimento: "", valor_bruto: "", valor_liquido: "",
  });
  const [invLiquido, setInvLiquido] = useState("");
  const [invBruto, setInvBruto] = useState("");
  const [turboHistory, setTurboHistory] = useState<TurboRecord[]>([]);
  const [turboMonthOpen, setTurboMonthOpen] = useState(false);
  const [selectedTurboMonth, setSelectedTurboMonth] = useState<string | null>(null);
  const [portfolioSnapshots, setPortfolioSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [bulkQuoteOpen, setBulkQuoteOpen] = useState(false);
  const [bulkPrices, setBulkPrices] = useState<Record<string, string>>({});
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [rendMonthOpen, setRendMonthOpen] = useState(false);
  const [rendMonthForm, setRendMonthForm] = useState({ month: format(new Date(), "yyyy-MM"), amount: "", description: "" });
  const [turboMonthForm, setTurboMonthForm] = useState({
    month: format(new Date(), "yyyy-MM"),
    total_bruto: "",
    rendimento: "",
    valor_liquido: "",
  });

  const [stockForm, setStockForm] = useState({
    ticker: "",
    type: "compra" as "compra" | "venda",
    quantity: "",
    price_per_share: "",
    notes: "",
    date: format(now, "yyyy-MM-dd"),
  });
  const [scoreHistory, setScoreHistory] = useState<ScoreSnapshot[]>([]);

  const load = useCallback(async () => {
    try {
      const [loadedAccounts, loadedInvestments, loadedStocks, loadedQuotes, loadedSnapshots, loadedScores] = await Promise.all([
        getInvestmentAccounts(),
        getInvestments(),
        getStockTrades(),
        getStockQuotes(),
        getPortfolioSnapshots(),
        getScoreHistory(),
      ]);
      setPortfolioSnapshots(Array.isArray(loadedSnapshots) ? loadedSnapshots : []);
      setScoreHistory(Array.isArray(loadedScores) ? loadedScores : []);
      setStockQuotes(Array.isArray(loadedQuotes) ? loadedQuotes : []);
      const accs = Array.isArray(loadedAccounts) ? loadedAccounts : [];
      setAccounts(accs);
      setInvestments(Array.isArray(loadedInvestments) ? loadedInvestments : []);
      setStockTrades(Array.isArray(loadedStocks) ? loadedStocks : []);
      setInvForm((prev) => ({
        ...prev,
        account_id: prev.account_id || (accs[0]?.id ?? ""),
      }));
      // Restore saved tab (validate it still exists)
      const saved = localStorage.getItem("ibank_inv_tab");
      if (saved && saved !== "total" && saved !== "acoes") {
        if (!accs.find((a) => a.id === saved)) {
          localStorage.removeItem("ibank_inv_tab");
          setActiveTab("total");
        }
      }
    } catch (err) {
      console.error("Erro ao carregar investimentos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Abre Modo Investidor via link (?modo=investidor) e sincroniza meta salva
  useEffect(() => {
    if (botEnabled && searchParams.get("modo") === "investidor") {
      setInvestorMode(true);
    }
    fetch("/api/goals")
      .then((r) => r.json())
      .then((data) => {
        const goal = Number(data.goal_target) || 0;
        if (goal > 0) {
          setIncomeGoal(goal);
          try { localStorage.setItem("ibank_income_goal", String(goal)); } catch {}
        }
      })
      .catch(() => {});
  }, [searchParams, botEnabled]);

  // Load turbo history when active account changes to a turbo account
  useEffect(() => {
    const acc = accounts.find((a) => a.id === activeTab);
    if (acc?.is_turbo) {
      getTurboHistory(acc.id).then(setTurboHistory).catch(() => setTurboHistory([]));
    } else {
      setTurboHistory([]);
    }
  }, [activeTab, accounts]);

  const stockPositions = useMemo(() => computeStockPositions(stockTrades), [stockTrades]);

  const quoteMap = useMemo(
    () => new Map(stockQuotes.map((q) => [q.ticker, q.current_price])),
    [stockQuotes],
  );

  const totalStocks = useMemo(
    () => stockPositions.reduce((s, p) => {
      const cur = quoteMap.get(p.ticker);
      return s + (cur !== undefined ? cur * p.quantity : p.totalInvested);
    }, 0),
    [stockPositions, quoteMap],
  );

  const sectorData = useMemo(() => {
    const sectorMap = new Map<string, number>();
    for (const p of stockPositions) {
      const cur = quoteMap.get(p.ticker);
      const value = cur !== undefined ? cur * p.quantity : p.totalInvested;
      const sector = detectSector(p.ticker);
      sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + value);
    }
    const total = [...sectorMap.values()].reduce((s, v) => s + v, 0);
    return [...sectorMap.entries()]
      .map(([name, value]) => ({ name, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [stockPositions, quoteMap]);

  const accountBalances = useMemo(
    () => accounts.map((a) => ({
      account: a,
      // TURBO: saldo real em current_balance (não há movimentações normais)
      balance: a.is_turbo ? a.current_balance : accountBalance(investments, a.id),
    })),
    [accounts, investments],
  );

  const totalFixedIncome = useMemo(
    () => accountBalances.reduce((s, a) => s + a.balance, 0),
    [accountBalances],
  );
  const grandTotal = totalFixedIncome + totalStocks;

  const balancesByCategory = useMemo(
    () => accounts.reduce<Partial<Record<RateCategory, number>>>((acc, a) => {
      const cat = detectCategory(a.name);
      if (!cat) return acc;
      acc[cat] = (acc[cat] ?? 0) + (a.is_turbo ? a.current_balance : accountBalance(investments, a.id));
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
  const computedBalance = useMemo(() => {
    const acc = accounts.find((a) => a.id === selectedAccountId);
    return acc?.is_turbo ? acc.current_balance : accountBalance(investments, selectedAccountId);
  }, [accounts, investments, selectedAccountId]);

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

  const investorData = useMemo(() => {
    const CDI_ANUAL = 0.1065; // CDI ~10.65% ao ano
    const CDI_MENSAL = CDI_ANUAL / 12;

    const turboSources = accounts.filter((a) => a.is_turbo).map((a) => ({
      nome: a.name,
      instituicao: a.institution,
      tipo: "TURBO" as const,
      capital: a.current_balance,
      rendaMensal: a.current_balance * ((a.cdi_percent ?? 115) / 100) * CDI_MENSAL,
      cor: "#10b981",
      badge: "TURBO · " + (a.cdi_percent ?? 115) + "% CDI",
    }));

    const fiiPositions = stockPositions.filter((p) => detectAssetType(p.ticker) === "FII");
    const fiiCapital = fiiPositions.reduce((s, p) => {
      const cur = quoteMap.get(p.ticker);
      return s + (cur !== undefined ? cur * p.quantity : p.totalInvested);
    }, 0);
    const fiiSources = fiiCapital > 0 ? [{
      nome: "FIIs",
      instituicao: fiiPositions.map((p) => p.ticker).join(", "),
      tipo: "FII" as const,
      capital: fiiCapital,
      rendaMensal: fiiCapital * 0.0085,
      cor: "#a855f7",
      badge: "~0,85%/mês (estimativa)",
    }] : [];

    const dividendPositions = stockPositions.filter((p) => {
      const t = detectAssetType(p.ticker);
      return t === "Ação" || t === "BDR" || t === "ETF";
    });
    const dividendCapital = dividendPositions.reduce((s, p) => {
      const cur = quoteMap.get(p.ticker);
      return s + (cur !== undefined ? cur * p.quantity : p.totalInvested);
    }, 0);
    const dividendSources = dividendCapital > 0 ? [{
      nome: "Dividendos de ações",
      instituicao: dividendPositions.map((p) => p.ticker).join(", "),
      tipo: "Ação" as const,
      capital: dividendCapital,
      rendaMensal: dividendCapital * 0.004,
      cor: "#3b82f6",
      badge: "~0,4%/mês (estimativa)",
    }] : [];

    const rfAccounts = accounts.filter((a) => !a.is_turbo);
    const rfSources = rfAccounts.flatMap((a) => {
      const rends = investments.filter((i) => i.account_id === a.id && i.type === "rendimento");
      if (rends.length === 0) return [];
      const byMonth = rends.reduce((acc, i) => {
        const m = i.date.slice(0, 7);
        acc[m] = (acc[m] ?? 0) + i.amount;
        return acc;
      }, {} as Record<string, number>);
      const months = Object.values(byMonth);
      const avg = months.reduce((s, v) => s + v, 0) / months.length;
      const capital = accountBalance(investments, a.id);
      return [{
        nome: a.name,
        instituicao: a.institution ?? "",
        tipo: "Renda Fixa" as const,
        capital,
        rendaMensal: avg,
        cor: "#f59e0b",
        badge: `${months.length} mês${months.length !== 1 ? "es" : ""} registrado${months.length !== 1 ? "s" : ""}`,
      }];
    });

    const allSources = [...turboSources, ...fiiSources, ...rfSources, ...dividendSources];
    const totalRendaMensal = allSources.reduce((s, src) => s + src.rendaMensal, 0);

    const allRendimentos = investments.filter((i) => i.type === "rendimento");
    const rendByMonth = allRendimentos.reduce((acc, i) => {
      const m = i.date.slice(0, 7);
      acc[m] = (acc[m] ?? 0) + i.amount;
      return acc;
    }, {} as Record<string, number>);
    const chartMonths = Object.entries(rendByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, v]) => ({
        label: new Date(m + "-15").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        "Renda recebida": v,
      }));

    const totalPortfolio = grandTotal;
    const fiiPct = totalPortfolio > 0 ? (fiiCapital / totalPortfolio) * 100 : 0;
    const turboPct = totalPortfolio > 0 ? (turboSources.reduce((s, t) => s + t.capital, 0) / totalPortfolio) * 100 : 0;
    const rfPct = totalPortfolio > 0 ? (rfSources.reduce((s, r) => s + r.capital, 0) / totalPortfolio) * 100 : 0;
    const divPct = totalPortfolio > 0 ? (dividendCapital / totalPortfolio) * 100 : 0;

    const recommendations = [
      { label: "FIIs", atual: fiiPct, ideal: 40, cor: "#a855f7", desc: "Melhor renda mensal (~0,85%/mês)" },
      { label: "TURBO/CDB", atual: turboPct + rfPct, ideal: 30, cor: "#10b981", desc: "Segurança + rendimento CDI" },
      { label: "Ações/Dividendos", atual: divPct, ideal: 30, cor: "#3b82f6", desc: "Crescimento + dividendos" },
    ];

    return { allSources, totalRendaMensal, chartMonths, recommendations, fiiCapital, CDI_MENSAL };
  }, [accounts, investments, stockPositions, quoteMap, grandTotal]);

  function goToStockDialog(ticker: string, type: "compra" | "venda") {
    setInvestorMode(false);
    setActiveTab("acoes");
    setStockForm({ ticker, type, quantity: "", price_per_share: "", notes: "", date: format(new Date(), "yyyy-MM-dd") });
    setStockOpen(true);
  }

  function goToDepositDialog(accountId: string) {
    setInvestorMode(false);
    setActiveTab(accountId);
    setInvForm({ account_id: accountId, type: "deposito", amount: "", description: "", date: format(new Date(), "yyyy-MM-dd") });
    setInvOpen(true);
  }

  const portfolioAnalysis = useMemo(() => {
    const insights: { level: "critical" | "warning" | "ok" | "suggestion"; title: string; detail: string; action?: string; onAction?: () => void; actionLabel?: string }[] = [];

    // 1. Reserva de emergência
    const emerAccounts = accounts.filter((a) => !a.is_turbo && (
      a.name.toLowerCase().includes("eme") || a.name.toLowerCase().includes("emergên") ||
      a.name.toLowerCase().includes("emergencia") || a.name.toLowerCase().includes("reserva") ||
      a.name.toLowerCase().includes("caixinha")
    ));
    const emerTotal = emerAccounts.reduce((s, a) => s + accountBalance(investments, a.id), 0);
    if (emerAccounts.length === 0) {
      insights.push({ level: "critical", title: "Sem reserva de emergência identificada", detail: "Crie uma conta com 'EME' ou 'Reserva' no nome e deposite mínimo R$ 3.000.", action: "Prioridade máxima antes de qualquer aporte variável" });
    } else if (emerTotal < 3000) {
      insights.push({
        level: "warning", title: `Reserva insuficiente — ${formatCurrency(emerTotal)}`,
        detail: `Recomendado mínimo R$ 3.000 (3 meses de gastos). Faltam ${formatCurrency(3000 - emerTotal)}.`,
        action: "Direcionar aportes para emergência até completar",
        onAction: () => goToDepositDialog(emerAccounts[0].id), actionLabel: `Depositar em ${emerAccounts[0].name}`,
      });
    } else {
      insights.push({ level: "ok", title: `Reserva de emergência adequada — ${formatCurrency(emerTotal)}`, detail: "Proteção básica garantida. Continue investindo normalmente." });
    }

    // 2. TURBO no teto
    const turboAccounts = accounts.filter((a) => a.is_turbo);
    for (const t of turboAccounts) {
      if (t.max_rendimento && t.current_balance >= t.max_rendimento * 0.95) {
        insights.push({
          level: "warning", title: `${t.name} no teto — ${formatCurrency(t.current_balance)} / ${formatCurrency(t.max_rendimento)}`,
          detail: "O rendimento extra do TURBO para quando atinge o teto máximo.",
          action: "Redirecione novos aportes para FIIs ou ações",
          onAction: () => goToStockDialog("", "compra"), actionLabel: "Ir para Ações/FIIs",
        });
      }
    }

    // 3. Duplicidade de empresa (PTR3 + PTR4, BBDC3 + BBDC4, etc.)
    const companyMap = new Map<string, string[]>();
    for (const p of stockPositions) {
      const base = p.ticker.replace(/\d+$/, "");
      if (!companyMap.has(base)) companyMap.set(base, []);
      companyMap.get(base)!.push(p.ticker);
    }
    for (const [, tickers] of companyMap) {
      if (tickers.length > 1) {
        const [, ...extra] = tickers;
        insights.push({
          level: "warning", title: `Duplicidade: ${tickers.join(" + ")}`,
          detail: "Mesma empresa em classes diferentes. Não diversifica — apenas concentra o risco.",
          action: "Escolha apenas uma classe e venda a outra",
          onAction: () => goToStockDialog(extra[0], "venda"), actionLabel: `Vender ${extra[0]}`,
        });
      }
    }

    // 4. Concentração em commodities
    const totalStockValue = stockPositions.reduce((s, p) => {
      const q = quoteMap.get(p.ticker);
      return s + (q !== undefined ? q * p.quantity : p.totalInvested);
    }, 0);
    const commodityValue = stockPositions
      .filter((p) => { const u = p.ticker.toUpperCase(); return u.startsWith("VALE") || u.startsWith("PETR") || u.startsWith("PTR") || u.startsWith("PRIO") || u.startsWith("RECV"); })
      .reduce((s, p) => { const q = quoteMap.get(p.ticker); return s + (q !== undefined ? q * p.quantity : p.totalInvested); }, 0);
    const commodityPct = totalStockValue > 0 ? (commodityValue / totalStockValue) * 100 : 0;
    if (commodityPct > 50) {
      insights.push({ level: "warning", title: `Commodities representam ${commodityPct.toFixed(0)}% da renda variável`, detail: "VALE + Petrobras são correlacionadas (China + petróleo). Uma crise afeta as duas ao mesmo tempo.", action: "Diversifique para bancos, energia elétrica ou saúde" });
    }

    // 5. Proporção FIIs na renda variável
    const fiiValue = stockPositions
      .filter((p) => detectAssetType(p.ticker) === "FII")
      .reduce((s, p) => { const q = quoteMap.get(p.ticker); return s + (q !== undefined ? q * p.quantity : p.totalInvested); }, 0);
    const fiiPctVariavel = totalStockValue > 0 ? (fiiValue / totalStockValue) * 100 : 0;
    if (stockPositions.length > 0 && fiiPctVariavel < 30) {
      insights.push({
        level: "suggestion", title: `FIIs: apenas ${fiiPctVariavel.toFixed(0)}% da renda variável`,
        detail: "Para renda passiva consistente, FIIs devem representar 50–60% da carteira variável. Dividendos mensais isentos de IR.",
        action: "Próximos aportes: MXRF11, XPML11 ou TRXF11",
        onAction: () => goToStockDialog("MXRF11", "compra"), actionLabel: "Comprar MXRF11",
      });
    } else if (fiiPctVariavel >= 50) {
      insights.push({ level: "ok", title: `Boa exposição a FIIs — ${fiiPctVariavel.toFixed(0)}%`, detail: "Proporção ideal para renda passiva mensal com isenção de IR." });
    }

    // Próximos movimentos recomendados
    const nextMoves: { prioridade: number; label: string; valor: string; razao: string }[] = [];
    if (emerTotal < 3000) {
      nextMoves.push({ prioridade: 1, label: "Completar Reserva de Emergência", valor: formatCurrency(Math.min(3000 - emerTotal, 1300)), razao: "Proteção base antes de qualquer variável" });
    }
    const turboAtCap = turboAccounts.some((t) => t.max_rendimento && t.current_balance >= t.max_rendimento * 0.95);
    if (!turboAtCap && turboAccounts.length > 0 && emerTotal >= 3000) {
      nextMoves.push({ prioridade: nextMoves.length + 1, label: "TURBO (complementar até o teto)", valor: "R$ 300–400", razao: "Melhor custo-benefício em renda fixa, 115% CDI" });
    }
    if (fiiPctVariavel < 50 || nextMoves.length === 0) {
      nextMoves.push({ prioridade: nextMoves.length + 1, label: "FIIs — MXRF11 ou XPML11", valor: emerTotal >= 3000 ? "R$ 650" : "R$ 500", razao: "Renda mensal isenta de IR, dividendo consistente" });
    }
    if (nextMoves.length < 3) {
      nextMoves.push({ prioridade: nextMoves.length + 1, label: "Ações — BBAS3 ou TAEE11", valor: "R$ 300–500", razao: "Crescimento + dividendos de longo prazo" });
    }

    const criticalCount = insights.filter((i) => i.level === "critical").length;
    const warningCount = insights.filter((i) => i.level === "warning").length;
    const score = Math.max(0, 100 - criticalCount * 30 - warningCount * 15);

    return { insights, nextMoves, score, emerTotal, fiiPctVariavel, commodityPct, totalStockValue };
  }, [accounts, investments, stockPositions, quoteMap]);

  // Salva o score do dia automaticamente quando o Modo Investidor é aberto (1x por dia)
  useEffect(() => {
    if (!investorMode) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const existing = scoreHistory.find((s) => s.date === today);
    if (existing && existing.score === portfolioAnalysis.score) return;
    saveScoreSnapshot(today, portfolioAnalysis.score).then((saved) => {
      setScoreHistory((prev) => [...prev.filter((s) => s.date !== today), saved].sort((a, b) => a.date.localeCompare(b.date)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investorMode, portfolioAnalysis.score]);

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
      if (acc.is_turbo && invBruto) {
        await updateAccountBalance(invForm.account_id, parseFloat(invBruto));
      } else {
        const delta = invForm.type === "retirada" ? -amount : amount;
        await updateAccountBalance(invForm.account_id, acc.current_balance + delta);
      }
      if (acc.is_turbo && invLiquido) {
        await updateTurboSettings(invForm.account_id, { valor_liquido: parseFloat(invLiquido) });
      }
    }
    setInvOpen(false);
    setInvBruto("");
    setInvLiquido("");
    setInvForm({ account_id: invForm.account_id, type: "deposito", amount: "", description: "", date: format(now, "yyyy-MM-dd") });
    load();
  }

  async function addAccount() {
    if (!accForm.name) return;
    const created = await createInvestmentAccountWithTurbo({
      name: accForm.name,
      institution: accForm.institution,
      is_turbo: accForm.is_turbo,
      cdi_percent: accForm.is_turbo && accForm.cdi_percent ? parseFloat(accForm.cdi_percent) : null,
      max_rendimento: accForm.is_turbo && accForm.max_rendimento ? parseFloat(accForm.max_rendimento) : null,
      valor_liquido: accForm.is_turbo && accForm.valor_liquido ? parseFloat(accForm.valor_liquido) : null,
    });
    if (accForm.is_turbo && accForm.valor_bruto && created?.id) {
      await updateAccountBalance(created.id, parseFloat(accForm.valor_bruto));
    }
    setAccOpen(false);
    setAccForm({ name: "", institution: "", is_turbo: false, cdi_percent: "", max_rendimento: "", valor_bruto: "", valor_liquido: "" });
    load();
  }

  async function addStockTrade() {
    const quantity = parseFloat(stockForm.quantity);
    const price = parseFloat(stockForm.price_per_share);
    if (!stockForm.ticker.trim() || !quantity || !price) return;
    await createStockTrade({
      ticker: stockForm.ticker.trim().toUpperCase(),
      type: stockForm.type,
      quantity,
      price_per_share: price,
      total_amount: quantity * price,
      notes: stockForm.notes,
      date: stockForm.date,
    });
    setStockOpen(false);
    setStockForm({ ticker: "", type: "compra", quantity: "", price_per_share: "", notes: "", date: format(now, "yyyy-MM-dd") });
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

  async function handleSaveQuote() {
    const price = parseFloat(quoteForm.price);
    if (!quoteForm.ticker || !price) return;
    const updated = await upsertStockQuote(quoteForm.ticker, price);
    setStockQuotes((prev) => {
      const rest = prev.filter((q) => q.ticker !== quoteForm.ticker);
      return [...rest, updated];
    });
    setQuoteOpen(false);
  }

  async function handleSaveTurboMonth() {
    if (!turboMonthForm.month) return;
    const acc = accounts.find((a) => a.id === activeTab);
    if (!acc?.is_turbo) return;
    const rendimento = parseFloat(turboMonthForm.rendimento) || 0;
    // total_bruto: use informed value or fall back to current balance
    const total_bruto = turboMonthForm.total_bruto
      ? parseFloat(turboMonthForm.total_bruto)
      : acc.current_balance + rendimento;
    const valor_liquido = turboMonthForm.valor_liquido ? parseFloat(turboMonthForm.valor_liquido) : null;

    const record = await saveTurboMonth({
      account_id: acc.id,
      month: turboMonthForm.month,
      total_bruto,
      rendimento,
      valor_liquido,
    });
    // Update the account's current bruto and (optionally) liquido
    await updateAccountBalance(acc.id, total_bruto);
    if (valor_liquido != null) {
      await updateTurboSettings(acc.id, { valor_liquido });
    }
    setTurboHistory((prev) => {
      const rest = prev.filter((r) => r.month !== record.month);
      return [...rest, record].sort((a, b) => a.month.localeCompare(b.month));
    });
    setTurboMonthOpen(false);
    setTurboMonthForm({ month: format(new Date(), "yyyy-MM"), total_bruto: "", rendimento: "", valor_liquido: "" });
    load();
  }

  async function handleDeleteTurboRecord(id: string) {
    await deleteTurboRecord(id);
    setTurboHistory((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleBulkSaveQuotes() {
    const entries = Object.entries(bulkPrices).filter(([, v]) => v !== "");
    if (entries.length === 0) return;
    await Promise.all(entries.map(([ticker, price]) => upsertStockQuote(ticker, parseFloat(price))));
    const updatedQuotes = await getStockQuotes();
    setStockQuotes(Array.isArray(updatedQuotes) ? updatedQuotes : []);
    // Auto-snapshot: calcula total atual da carteira com as novas cotações
    const newQuoteMap = new Map((Array.isArray(updatedQuotes) ? updatedQuotes : []).map((q: StockQuote) => [q.ticker, q.current_price]));
    const computedPositions = computeStockPositions(stockTrades);
    let total = 0;
    let invested = 0;
    for (const p of computedPositions) {
      const cur = newQuoteMap.get(p.ticker);
      total += cur !== undefined ? cur * p.quantity : p.totalInvested;
      invested += p.totalInvested;
    }
    const today = format(new Date(), "yyyy-MM-dd");
    const snap = await savePortfolioSnapshot({ date: today, total, invested });
    setPortfolioSnapshots((prev) => {
      const rest = prev.filter((s) => s.date !== snap.date);
      return [...rest, snap].sort((a, b) => a.date.localeCompare(b.date));
    });
    setBulkQuoteOpen(false);
    setBulkPrices({});
  }

  async function handleRenameAccount() {
    if (!renameForm.name.trim()) return;
    await renameInvestmentAccount(renameForm.id, renameForm.name.trim(), renameForm.institution.trim());
    await updateTurboSettings(renameForm.id, {
      is_turbo: renameForm.is_turbo,
      cdi_percent: renameForm.is_turbo && renameForm.cdi_percent ? parseFloat(renameForm.cdi_percent) : null,
      max_rendimento: renameForm.is_turbo && renameForm.max_rendimento ? parseFloat(renameForm.max_rendimento) : null,
      valor_liquido: renameForm.valor_liquido ? parseFloat(renameForm.valor_liquido) : null,
    });
    if (renameForm.is_turbo && renameForm.valor_bruto) {
      await updateAccountBalance(renameForm.id, parseFloat(renameForm.valor_bruto));
    }
    setRenameOpen(false);
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  function generateReport() {
    printInvestorReport({
      portfolioAnalysis,
      investorData,
      grandTotal,
    });
  }

  if (investorMode && botEnabled) {
    return (
      <InvestorModeView
        investorData={investorData}
        portfolioAnalysis={portfolioAnalysis}
        incomeGoal={incomeGoal}
        incomeGoalInput={incomeGoalInput}
        setIncomeGoal={setIncomeGoal}
        setIncomeGoalInput={setIncomeGoalInput}
        setInvestorMode={setInvestorMode}
        scoreHistory={scoreHistory}
        grandTotal={grandTotal}
        stockPositions={stockPositions}
        quoteMap={quoteMap}
        onGenerateReport={generateReport}
      />
    );
  }
  return (
    <div className="space-y-4 sm:space-y-6 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between px-4 sm:px-6 lg:px-8 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">Investimentos</h1>
            <button
              type="button"
              onClick={() => setRatesOpen(true)}
              className="flex items-center justify-center h-11 w-11 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation"
              title="Rentabilidade estimada"
            >
              <Info className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">Poupança, renda fixa e ações</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {botEnabled ? (
            <Button
              variant="outline"
              onClick={() => setInvestorMode(true)}
              className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40 min-h-11"
            >
              <Zap className="h-4 w-4" />
              Modo Investidor
            </Button>
          ) : (
            <a
              href="/vender"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-violet-300/50 px-4 text-sm font-medium text-violet-700/80 dark:text-violet-300/80 min-h-11 hover:bg-violet-50 dark:hover:bg-violet-950/30"
            >
              <Zap className="h-4 w-4" />
              Bot (+R$ 15)
            </a>
          )}
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
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 select-none">
                  <input
                    type="checkbox"
                    checked={accForm.is_turbo}
                    onChange={(e) => setAccForm({ ...accForm, is_turbo: e.target.checked })}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div>
                    <p className="font-medium text-sm">TURBO</p>
                    <p className="text-xs text-muted-foreground">Caixinha com CDI acima de 100% e teto de rendimento</p>
                  </div>
                </label>
                {accForm.is_turbo && (
                  <div className="space-y-3 pl-2 border-l-2 border-blue-400">
                    <div className="space-y-1.5">
                      <Label>% do CDI contratado</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" placeholder="Ex: 115" value={accForm.cdi_percent}
                          onChange={(e) => setAccForm({ ...accForm, cdi_percent: e.target.value })} />
                        <span className="text-sm text-muted-foreground shrink-0">% CDI</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor máximo de rendimento (R$)</Label>
                      <Input type="number" placeholder="Ex: 5000.00" value={accForm.max_rendimento}
                        onChange={(e) => setAccForm({ ...accForm, max_rendimento: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor bruto atual (R$)</Label>
                      <Input type="number" placeholder="Ex: 5110.96" value={accForm.valor_bruto}
                        onChange={(e) => setAccForm({ ...accForm, valor_bruto: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor líquido atual (R$)</Label>
                      <Input type="number" placeholder="Ex: 5086.01" value={accForm.valor_liquido}
                        onChange={(e) => setAccForm({ ...accForm, valor_liquido: e.target.value })} />
                    </div>
                  </div>
                )}
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
            <DialogContent
              onPointerDownOutside={(e) => {
                const target = e.target as Element;
                if (target?.closest?.("[data-radix-popper-content-wrapper]")) e.preventDefault();
              }}
              onInteractOutside={(e) => {
                const target = e.target as Element;
                if (target?.closest?.("[data-radix-popper-content-wrapper]")) e.preventDefault();
              }}
            >
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
                {(() => {
                  const selAcc = accounts.find((a) => a.id === invForm.account_id);
                  if (!selAcc?.is_turbo) return null;
                  return (
                    <div className="space-y-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                        ⚡ TURBO {selAcc.cdi_percent ? `· ${selAcc.cdi_percent}% CDI` : ""}
                        {selAcc.max_rendimento ? ` · teto ${formatCurrency(selAcc.max_rendimento)}` : ""}
                      </p>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Novo valor bruto (R$)</Label>
                        <Input
                          type="number"
                          placeholder={selAcc.current_balance ? String(selAcc.current_balance) : "Ex: 5110.96"}
                          value={invBruto}
                          onChange={(e) => setInvBruto(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Novo valor líquido (R$)</Label>
                        <Input
                          type="number"
                          placeholder={selAcc.valor_liquido ? String(selAcc.valor_liquido) : "Ex: 5086.01"}
                          value={invLiquido}
                          onChange={(e) => setInvLiquido(e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Atualize bruto e líquido a cada rendimento mensal</p>
                    </div>
                  );
                })()}
                <Button className="w-full" onClick={addInvestment}>Registrar</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={stockOpen} onOpenChange={setStockOpen}>
            <DialogTrigger asChild>
              <Button><LineChart className="h-4 w-4" />Comprar ações</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar operação de ações</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setStockForm({ ...stockForm, type: "compra" })}
                    className={`rounded-lg border py-2 text-sm font-semibold transition-colors ${stockForm.type === "compra" ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-muted text-muted-foreground hover:bg-muted/50"}`}>
                    Compra
                  </button>
                  <button type="button" onClick={() => setStockForm({ ...stockForm, type: "venda" })}
                    className={`rounded-lg border py-2 text-sm font-semibold transition-colors ${stockForm.type === "venda" ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "border-muted text-muted-foreground hover:bg-muted/50"}`}>
                    Venda
                  </button>
                </div>
                <div className="space-y-1.5">
                  <Label>Ticker</Label>
                  <Input
                    list="ticker-suggestions"
                    placeholder="Ex: PETR4, VALE3, ITUB4"
                    value={stockForm.ticker}
                    onChange={(e) => setStockForm({ ...stockForm, ticker: e.target.value.toUpperCase() })}
                  />
                  <datalist id="ticker-suggestions">
                    {stockPositions.map((p) => (
                      <option key={p.ticker} value={p.ticker} />
                    ))}
                  </datalist>
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
                <Button className="w-full" onClick={addStockTrade}>
                  Registrar {stockForm.type === "compra" ? "compra" : "venda"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {accounts.length === 0 && stockTrades.length === 0 ? (
        <div className="text-center py-16 px-4 sm:px-6 lg:px-8">
          <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum investimento cadastrado.</p>
          <p className="text-sm text-muted-foreground">Crie uma conta ou registre uma compra de ações.</p>
        </div>
      ) : (
        <div className="px-4 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); localStorage.setItem("ibank_inv_tab", v); }}>
          <TabsList className="flex h-auto flex-wrap gap-1 w-full justify-start overflow-x-auto scrollbar-none">
            <TabsTrigger value="total" className="gap-1.5 min-h-10">
              <BarChart3 className="h-3.5 w-3.5" />
              Total
            </TabsTrigger>
            {accounts.map((a) => (
              <TabsTrigger key={a.id} value={a.id} className="min-h-10">{a.name}</TabsTrigger>
            ))}
            <TabsTrigger value="acoes" className="gap-1.5 min-h-10">
              <LineChart className="h-3.5 w-3.5" />
              Ações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="total" className="mt-4">
            <TotalTab
              grandTotal={grandTotal}
              totalFixedIncome={totalFixedIncome}
              totalStocks={totalStocks}
              accounts={accounts}
              stockPositions={stockPositions}
              accountBalances={accountBalances}
              totalRendaMensal={investorData.totalRendaMensal}
              setActiveTab={setActiveTab}
            />
          </TabsContent>

          {accounts.map((account) => (
            <TabsContent key={account.id} value={account.id} className="space-y-6 mt-4">
              <AccountTab
                account={account}
                activeTab={activeTab}
                accountInvestments={accountInvestments}
                computedBalance={computedBalance}
                chartData={chartData}
                turboHistory={turboHistory}
                selectedTurboMonth={selectedTurboMonth}
                setSelectedTurboMonth={setSelectedTurboMonth}
                turboMonthOpen={turboMonthOpen}
                setTurboMonthOpen={setTurboMonthOpen}
                turboMonthForm={turboMonthForm}
                setTurboMonthForm={setTurboMonthForm}
                rendMonthOpen={rendMonthOpen}
                setRendMonthOpen={setRendMonthOpen}
                rendMonthForm={rendMonthForm}
                setRendMonthForm={setRendMonthForm}
                setRenameForm={setRenameForm}
                setRenameOpen={setRenameOpen}
                handleDeleteAccount={handleDeleteAccount}
                handleDeleteTurboRecord={handleDeleteTurboRecord}
                handleSaveTurboMonth={handleSaveTurboMonth}
                handleDeleteInvestment={handleDeleteInvestment}
                load={load}
              />
            </TabsContent>
          ))}
          {/* ── Dialog: renomear conta ── */}
          <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Editar conta</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome da conta</Label>
                  <Input placeholder="Ex: Tesouro Selic" value={renameForm.name}
                    onChange={(e) => setRenameForm({ ...renameForm, name: e.target.value })}
                    autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label>Instituição (opcional)</Label>
                  <Input placeholder="Ex: NuInvest" value={renameForm.institution}
                    onChange={(e) => setRenameForm({ ...renameForm, institution: e.target.value })} />
                </div>
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 select-none">
                  <input
                    type="checkbox"
                    checked={renameForm.is_turbo}
                    onChange={(e) => setRenameForm({ ...renameForm, is_turbo: e.target.checked })}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <div>
                    <p className="font-medium text-sm">⚡ TURBO</p>
                    <p className="text-xs text-muted-foreground">CDI acima de 100% com teto de rendimento</p>
                  </div>
                </label>
                <div className="space-y-1.5">
                  <Label>Valor líquido após IR/taxas (R$) <span className="text-muted-foreground text-xs">opcional</span></Label>
                  <Input type="number" step="0.01" placeholder="Ex: 399.90" value={renameForm.valor_liquido}
                    onChange={(e) => setRenameForm({ ...renameForm, valor_liquido: e.target.value })} />
                </div>
                {renameForm.is_turbo && (
                  <div className="space-y-3 pl-2 border-l-2 border-blue-400">
                    <div className="space-y-1.5">
                      <Label>% do CDI contratado</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" placeholder="Ex: 115" value={renameForm.cdi_percent}
                          onChange={(e) => setRenameForm({ ...renameForm, cdi_percent: e.target.value })} />
                        <span className="text-sm text-muted-foreground shrink-0">% CDI</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor máximo de rendimento (R$)</Label>
                      <Input type="number" placeholder="Ex: 5000.00" value={renameForm.max_rendimento}
                        onChange={(e) => setRenameForm({ ...renameForm, max_rendimento: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor bruto atual (R$)</Label>
                      <Input type="number" placeholder="Ex: 5110.96" value={renameForm.valor_bruto}
                        onChange={(e) => setRenameForm({ ...renameForm, valor_bruto: e.target.value })} />
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setRenameOpen(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={handleRenameAccount}>Salvar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* ── Dialog: atualizar cotação ── */}
          <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Atualizar cotação — {quoteForm.ticker}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Preço atual por ação (R$)</Label>
                  <Input type="number" step="0.01" placeholder="0,00" value={quoteForm.price}
                    onChange={(e) => setQuoteForm({ ...quoteForm, price: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveQuote()}
                    autoFocus />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setQuoteOpen(false)}>Cancelar</Button>
                  <Button className="flex-1" onClick={handleSaveQuote}>Atualizar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* ── Dialog: rentabilidade estimada ── */}
          <Dialog open={ratesOpen} onOpenChange={setRatesOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Rentabilidade estimada · Nubank</DialogTitle>
              </DialogHeader>
              <InvestmentRates balances={balancesByCategory} userId={getCurrentUser()} />
            </DialogContent>
          </Dialog>

          <TabsContent value="acoes" className="mt-4">
            <AcoesTab
              totalStocks={totalStocks}
              stockPositions={stockPositions}
              stockTrades={stockTrades}
              quoteMap={quoteMap}
              portfolioSnapshots={portfolioSnapshots}
              sectorData={sectorData}
              selectedSector={selectedSector}
              setSelectedSector={setSelectedSector}
              historyOpen={historyOpen}
              setHistoryOpen={setHistoryOpen}
              bulkQuoteOpen={bulkQuoteOpen}
              setBulkQuoteOpen={setBulkQuoteOpen}
              bulkPrices={bulkPrices}
              setBulkPrices={setBulkPrices}
              setQuoteForm={setQuoteForm}
              setQuoteOpen={setQuoteOpen}
              handleBulkSaveQuotes={handleBulkSaveQuotes}
              handleDeleteStock={handleDeleteStock}
            />
          </TabsContent>
        </Tabs>
        </div>
      )}
    </div>
  );
}
