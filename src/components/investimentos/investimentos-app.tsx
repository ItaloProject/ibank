"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, TrendingUp, LineChart, Info, Zap, Landmark, PlusCircle, ChevronRight, ChevronLeft, Radio, Target,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getInvestmentAccounts, createInvestmentAccountWithTurbo,
  updateAccountBalance, deleteInvestmentAccount, renameInvestmentAccount, updateTurboSettings,
  getInvestments, createInvestment, deleteInvestment,
  getStockTrades, createStockTrade, deleteStockTrade,
  getStockQuotes, upsertStockQuote, refreshStockQuotes, type StockQuote,
  getPortfolioSnapshots, savePortfolioSnapshot,
  getTurboHistory, saveTurboMonth, deleteTurboRecord,
  getScoreHistory, saveScoreSnapshot,
} from "@/lib/api";
import type { TurboRecord, PortfolioSnapshot, ScoreSnapshot } from "@/types/database";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvestmentAccount, Investment, InvestmentType, StockTrade } from "@/types/database";
import { format } from "date-fns";
import { InvestmentRates } from "@/components/investment-rates";
import { detectCategory, toMonthly, type RateCategory } from "@/lib/investment-rates";
import { useMarketRates } from "@/lib/use-market-rates";
import { getCurrentUser } from "@/lib/user";
import {
  accountBalance, detectAssetType, detectSector, computeStockPositions,
} from "@/lib/stock-utils";
import { InvestorModeView, type PortfolioAnalysis } from "@/components/investimentos/investor-mode-view";
import { useRebalanceAnalysis } from "@/lib/use-rebalance-analysis";
import { planAllocation, planInsights, planMoves, planScore } from "@/lib/plan-view";
import { alocacaoRelevante } from "@/lib/rebalance";
import { InvestorBot, type BotPortfolioContext } from "@/components/investor-bot";
import { InvestorLiveView, type LiveAction } from "@/components/investimentos/investor-live-view";
import type { MarketSection } from "@/components/investimentos/simulator-invest-flow";

const MARKET_SECTIONS = ["hub", "acoes", "fiis", "tesouro", "rendafixa", "turbo", "eme"] as const satisfies readonly MarketSection[];
import { InvestorLiveViewDesktop } from "@/components/investimentos/investor-live-view-desktop";
import { categorizeAccount, isCashAccountName } from "@/lib/account-groups";
import { AccountTab } from "@/components/investimentos/account-tab";
import { AcoesTab } from "@/components/investimentos/acoes-tab";
import { useUser } from "@/context/user-context";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";
import { SplashScreen } from "@/components/splash-screen";
import { InvestimentosSubNav } from "@/components/investimentos/investimentos-sub-nav";

export type InvestimentosSection = "hub" | "contas" | "acoes" | "metas";

function MetasLocked() {
  return (
    <div className="flex min-h-full items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-foreground/70">
          <Target className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight font-display">Metas</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Defina sua meta de renda passiva e acompanhe quanto falta, com score da carteira,
          insights e recomendações de onde investir.
        </p>
        <ul className="mt-6 space-y-2 text-left text-sm text-muted-foreground rounded-2xl border border-border bg-card p-5">
          {["Meta de renda passiva mensal", "Score da carteira com histórico", "Insights, alertas e próximos passos", "Relatório em PDF"].map((f) => (
            <li key={f} className="flex items-center gap-2.5">
              <span className="h-1 w-1 rounded-full bg-foreground/40 shrink-0" aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
        <Link
          href="/vender"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground px-4 text-sm font-bold text-background hover:bg-foreground/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Ativar Metas <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function SubPills({
  items, active, onSelect,
}: {
  items: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-none flex-nowrap pb-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium min-h-9 transition-colors ${
            active === item.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function EmptyCaixinha({
  icon: Icon, iconColor, label, desc, onCreate,
}: {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  desc: string;
  onCreate: () => void;
}) {
  return (
    <div className="text-center py-12 px-4 rounded-xl border border-dashed">
      <Icon className={`h-10 w-10 mx-auto mb-3 ${iconColor}`} />
      <p className="font-medium">{label}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{desc}</p>
      <Button variant="outline" className="mt-4" onClick={onCreate}>
        <PlusCircle className="h-4 w-4" />
        Criar conta
      </Button>
    </div>
  );
}

export function InvestimentosApp({ section }: { section: InvestimentosSection }) {
  const { botEnabled } = useUser();
  const marketRates = useMarketRates();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isMetas = section === "metas";
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [stockTrades, setStockTrades] = useState<StockTrade[]>([]);
  const [stockQuotes, setStockQuotes] = useState<StockQuote[]>([]);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ ticker: "", price: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ibank_inv_tab") ?? "total";
      if (section === "acoes") return "acoes";
      if (section === "contas" && (saved === "acoes" || saved === "total")) return "total";
      return saved;
    }
    return section === "acoes" ? "acoes" : "total";
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
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "account" | "investment" | "stock";
    id: string;
    label: string;
    inv?: Investment;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
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
      if (Array.isArray(loadedStocks) && loadedStocks.length > 0) {
        refreshStockQuotes(loadedStocks, Array.isArray(loadedQuotes) ? loadedQuotes : [])
          .then(({ quotes }) => setStockQuotes(quotes))
          .catch(() => {});
      }
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
      setLoadError("Não foi possível carregar seus investimentos. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Links antigos do BOT (?view=bot | ?modo=investidor) viraram a página Metas
  useEffect(() => {
    if (!isMetas && (searchParams.get("view") === "bot" || searchParams.get("modo") === "investidor")) {
      router.replace("/metas");
      return;
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
  }, [searchParams, isMetas, router]);

  // ?investir=<seção>[&valor=<reais>] | ?vender=<ticker>: vindo do diagnóstico em Metas ou do assistente
  const [liveAction, setLiveAction] = useState<(LiveAction & { desktop: boolean }) | null>(null);
  useEffect(() => {
    if (isMetas) return;
    const investir = searchParams.get("investir");
    const vender = searchParams.get("vender");
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    let action: LiveAction | null = null;
    if (investir && (MARKET_SECTIONS as readonly string[]).includes(investir)) {
      const valor = Number(searchParams.get("valor"));
      action = { kind: "investir", section: investir as MarketSection, amount: valor > 0 && valor < 1e9 ? valor : undefined };
    } else if (vender) {
      action = { kind: "vender", ticker: vender.toUpperCase() };
    }
    if (!action) return;
    setLiveAction({ ...action, desktop });
    router.replace(window.location.pathname, { scroll: false });
  }, [searchParams, isMetas, router]);

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

  const hasStocks = stockPositions.length > 0 || stockTrades.length > 0;

  function belongsToGroup(tabId: string): boolean {
    if (section === "acoes") return tabId === "acoes" && hasStocks;
    if (section === "contas") {
      const acc = accounts.find((a) => a.id === tabId);
      return Boolean(acc);
    }
    if (tabId === "acoes") return hasStocks;
    const acc = accounts.find((a) => a.id === tabId);
    return Boolean(acc);
  }

  function defaultSubTab(): string {
    if (section === "acoes") return "acoes";
    return accountBalances[0]?.account.id ?? (section === "hub" && hasStocks ? "acoes" : "total");
  }

  useEffect(() => {
    if (section === "acoes") {
      setActiveTab("acoes");
      return;
    }
    if (section === "contas" && (activeTab === "acoes" || activeTab === "total")) {
      const def = accountBalances[0]?.account.id ?? "total";
      setActiveTab(def);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  useEffect(() => {
    if (loading || section === "hub") return;
    if (!belongsToGroup(activeTab)) {
      const def = defaultSubTab();
      if (def !== activeTab) {
        setActiveTab(def);
        try { localStorage.setItem("ibank_inv_tab", def); } catch { /* ignore */ }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, accounts, stockPositions, stockTrades, section]);

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
    const CDI_MENSAL = toMonthly(marketRates.cdiAnual) / 100;

    const turboSources = accounts.filter((a) => a.is_turbo).map((a) => ({
      nome: a.name,
      instituicao: a.institution,
      tipo: "TURBO" as const,
      capital: a.current_balance,
      rendaMensal: a.current_balance * ((a.cdi_percent ?? 115) / 100) * CDI_MENSAL,
      cor: "#f5c425",
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
      cor: "#14b8a6",
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
      cor: "#10b981",
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
        cor: "#38bdf8",
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

    return { allSources, totalRendaMensal, chartMonths, fiiCapital, CDI_MENSAL };
  }, [accounts, investments, stockPositions, quoteMap, marketRates.cdiAnual]);

  const portfolioVersion = `${accounts.length}|${investments.length}|${stockTrades.length}|${grandTotal.toFixed(2)}|${incomeGoal}`;
  const analysis = useRebalanceAnalysis(botEnabled && !loading, portfolioVersion);

  const portfolioAnalysis = useMemo<PortfolioAnalysis | null>(() => {
    const plan = analysis?.plan;
    if (!analysis || !plan) return null;
    const go = (query: string) => router.push(`/investimentos?${query}`);
    return {
      profile: analysis.profile,
      profileDefinido: analysis.profileDefinido,
      score: planScore(plan),
      emerTotal: plan.reserva.atual,
      investido: plan.investido,
      alocacaoRelevante: alocacaoRelevante(plan),
      allocation: planAllocation(plan),
      insights: planInsights(plan).map((i) => ({
        ...i,
        onAction: i.sell
          ? () => go(`vender=${encodeURIComponent(i.sell!)}`)
          : i.section ? () => go(`investir=${i.section}`) : undefined,
      })),
      nextMoves: planMoves(plan).map((m) => ({ ...m, valorTexto: formatCurrency(m.valor) })),
    };
  }, [analysis, router]);

  // Salva a nota do dia quando a página Metas é aberta (1x por dia)
  const score = portfolioAnalysis?.score ?? null;
  useEffect(() => {
    if (!isMetas || !botEnabled || loading || score === null) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const existing = scoreHistory.find((s) => s.date === today);
    if (existing && existing.score === score) return;
    saveScoreSnapshot(today, score).then((saved) => {
      setScoreHistory((prev) => [...prev.filter((s) => s.date !== today), saved].sort((a, b) => a.date.localeCompare(b.date)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMetas, botEnabled, loading, score]);

  const botContext = useMemo<BotPortfolioContext>(() => ({
    score,
    totalRendaMensal: investorData.totalRendaMensal,
    incomeGoal,
    grandTotal,
    emerTotal: portfolioAnalysis?.emerTotal ?? null,
    insights: portfolioAnalysis?.insights ?? [],
    sources: investorData.allSources.map((s) => ({ nome: s.nome, tipo: s.tipo, capital: s.capital, rendaMensal: s.rendaMensal })),
    holdings: stockPositions.map((p) => {
      const q = quoteMap.get(p.ticker);
      return { ticker: p.ticker, kind: detectAssetType(p.ticker), value: q !== undefined ? q * p.quantity : p.totalInvested };
    }),
  }), [score, portfolioAnalysis, investorData, incomeGoal, grandTotal, stockPositions, quoteMap]);

  const botDataVersion = portfolioVersion;

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

  function handleDeleteInvestment(inv: Investment) {
    setDeleteConfirm({ type: "investment", id: inv.id, label: inv.description || formatCurrency(inv.amount), inv });
  }

  function handleDeleteStock(id: string) {
    setDeleteConfirm({ type: "stock", id, label: "esta operação" });
  }

  function handleDeleteAccount(id: string) {
    const acc = accounts.find((a) => a.id === id);
    setDeleteConfirm({ type: "account", id, label: acc?.name || "esta conta" });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "account") {
      await deleteInvestmentAccount(deleteConfirm.id);
      setActiveTab("total");
    } else if (deleteConfirm.type === "investment" && deleteConfirm.inv) {
      const inv = deleteConfirm.inv;
      await deleteInvestment(inv.id);
      const delta = inv.type === "retirada" ? inv.amount : -inv.amount;
      const acc = accounts.find((a) => a.id === inv.account_id);
      if (acc) await updateAccountBalance(inv.account_id, acc.current_balance + delta);
    } else if (deleteConfirm.type === "stock") {
      await deleteStockTrade(deleteConfirm.id);
    }
    setDeleteConfirm(null);
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
    return <SplashScreen />;
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <p className="text-destructive font-medium">{loadError}</p>
        <Button type="button" variant="outline" onClick={load}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  function generateReport() {
    window.open("/api/report/pdf", "_blank", "noopener");
  }

  if (isMetas) {
    if (!botEnabled) return <MetasLocked />;
    return (
      <InvestorModeView
        investorData={investorData}
        portfolioAnalysis={portfolioAnalysis}
        incomeGoal={incomeGoal}
        incomeGoalInput={incomeGoalInput}
        setIncomeGoal={setIncomeGoal}
        setIncomeGoalInput={setIncomeGoalInput}
        scoreHistory={scoreHistory}
        grandTotal={grandTotal}
        accountBalances={accountBalances}
        stockTrades={stockTrades}
        investments={investments}
        onGenerateReport={generateReport}
        onRefresh={load}
        botContext={botContext}
        botDataVersion={botDataVersion}
      />
    );
  }

  const toItem = (x: { account: InvestmentAccount; balance: number }) => ({
    id: x.account.id,
    nome: x.account.name,
    instituicao: x.account.institution,
    valor: x.balance,
    isTurbo: x.account.is_turbo,
    cdiPercent: x.account.cdi_percent,
    maxRendimento: x.account.max_rendimento,
  });
  const sortByValor = <T extends { valor: number }>(arr: T[]) => [...arr].sort((a, b) => b.valor - a.valor);
  const cashEntry = accountBalances.find((x) => isCashAccountName(x.account.name));
  const nonCashBalances = accountBalances.filter((x) => x !== cashEntry);
  const liveProps = {
    grandTotal,
    turboAccountsReal: sortByValor(nonCashBalances.filter((x) => categorizeAccount(x.account) === "turbo").map(toItem)),
    emergenciaAccountsReal: sortByValor(nonCashBalances.filter((x) => categorizeAccount(x.account) === "emergencia").map(toItem)),
    investimentosAccountsReal: sortByValor(nonCashBalances.filter((x) => categorizeAccount(x.account) === "investimentos").map(toItem)),
    stockPositions,
    quoteMap,
    stockTrades,
    investments,
    cashAccountId: cashEntry?.account.id ?? null,
    cashBalance: cashEntry?.balance ?? 0,
    onRefresh: load,
  };
  return (
    <>
      {/* Mobile: tela cheia sobre a navegação, por isso precisa de saída própria */}
      <div className="md:hidden">
        <InvestorLiveView
          {...liveProps}
          liveAction={liveAction && !liveAction.desktop ? liveAction : null}
          onClose={() => router.push("/")}
        />
      </div>
      <div className="hidden md:flex flex-col h-full">
        <InvestorLiveViewDesktop {...liveProps} liveAction={liveAction?.desktop ? liveAction : null} />
      </div>
      {botEnabled && (
        <InvestorBot context={botContext} onGeneratePdf={generateReport} overlay dataVersion={botDataVersion} />
      )}
    </>
  );
}
