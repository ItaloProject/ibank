"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus, Trash2, TrendingUp, ArrowUpCircle, ArrowDownCircle, Sparkles,
  BarChart3, LineChart, AlertTriangle, Pencil, ChevronDown, Info, Target, Zap, FileText,
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
  PieChart, Pie, Cell, Legend,
  BarChart, Bar, ReferenceLine,
} from "recharts";
import {
  getInvestmentAccounts, createInvestmentAccountWithTurbo,
  updateAccountBalance, deleteInvestmentAccount, renameInvestmentAccount, updateTurboSettings,
  getInvestments, createInvestment, deleteInvestment,
  getStockTrades, createStockTrade, deleteStockTrade,
  getStockQuotes, upsertStockQuote, type StockQuote,
  getPortfolioSnapshots, savePortfolioSnapshot,
  getTurboHistory, saveTurboMonth, deleteTurboRecord,
} from "@/lib/api";
import type { TurboRecord, PortfolioSnapshot } from "@/types/database";
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

// FIIs conhecidos (sufixo 11 que são fundos imobiliários, não ações ou ETFs)
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

// ETFs conhecidos (sufixo 11 que são ETFs de índice)
const ETF_SET = new Set([
  "BOVA11","SMAL11","IVVB11","SPXI11","DIVO11","FIND11","GOVE11","MATB11",
  "ECOO11","ISUS11","TECK11","GOLD11","HASH11","BIT11","ETHE11","NFTF11",
  "ACWI11","NASD11","EURO11","JPUS11","ASIA11","INFR11","AGRI11",
]);

// Setor por ticker — ações brasileiras
const SECTOR_MAP: Record<string, string> = {
  // Bancos / Financeiro
  BBAS3: "Financeiro", BBDC3: "Financeiro", BBDC4: "Financeiro", ITUB3: "Financeiro",
  ITUB4: "Financeiro", SANB11: "Financeiro", SANB3: "Financeiro", SANB4: "Financeiro",
  BPAC11: "Financeiro", BPAC3: "Financeiro", BPAC5: "Financeiro", BRSR6: "Financeiro",
  BMGB4: "Financeiro", IRBR3: "Financeiro", SULA11: "Financeiro", PSSA3: "Financeiro",
  B3SA3: "Financeiro", CIEL3: "Financeiro", WIZC3: "Financeiro", AXIA3: "Financeiro",
  // Energia elétrica
  ELET3: "Energia", ELET6: "Energia", CMIG3: "Energia", CMIG4: "Energia",
  CPFE3: "Energia", ENGI11: "Energia", ENGI3: "Energia", ENGI4: "Energia",
  ENEV3: "Energia", EGIE3: "Energia", TAEE11: "Energia", TAEE3: "Energia",
  TAEE4: "Energia", TRPL4: "Energia", TRPL3: "Energia", COCE5: "Energia",
  EQTL3: "Energia", CESP6: "Energia", AURE3: "Energia", AESB3: "Energia",
  RNEW11: "Energia",
  // Petróleo / Gás
  PETR3: "Petróleo & Gás", PETR4: "Petróleo & Gás", PTR3: "Petróleo & Gás",
  PTR4: "Petróleo & Gás", PRIO3: "Petróleo & Gás", RECV3: "Petróleo & Gás",
  CSAN3: "Petróleo & Gás", RRRP3: "Petróleo & Gás", VBBR3: "Petróleo & Gás",
  // Mineração / Siderurgia
  VALE3: "Mineração", CSNA3: "Siderurgia", GGBR3: "Siderurgia", GGBR4: "Siderurgia",
  GOAU3: "Siderurgia", GOAU4: "Siderurgia", USIM3: "Siderurgia", USIM5: "Siderurgia",
  CMIN3: "Mineração", FESA4: "Mineração",
  // Varejo
  MGLU3: "Varejo", VIIA3: "Varejo", LREN3: "Varejo", AMER3: "Varejo",
  SOMA3: "Varejo", ALPA4: "Varejo", HGTX3: "Varejo", AMAR3: "Varejo", TFCO4: "Varejo",
  // Alimentos & Bebidas / Agro
  ABEV3: "Alimentos & Bebidas", JBSS3: "Alimentos & Bebidas", MRFG3: "Alimentos & Bebidas",
  BEEF3: "Alimentos & Bebidas", BRFS3: "Alimentos & Bebidas",
  SLCE3: "Agronegócio", AGRO3: "Agronegócio", TTEN3: "Agronegócio", SMTO3: "Agronegócio",
  CAML3: "Agronegócio",
  // Papel & Celulose
  SUZB3: "Papel & Celulose", KLBN11: "Papel & Celulose", KLBN3: "Papel & Celulose", KLBN4: "Papel & Celulose",
  // Saúde
  RDOR3: "Saúde", HAPV3: "Saúde", FLRY3: "Saúde", DASA3: "Saúde",
  QUAL3: "Saúde", HYPE3: "Saúde", PGMN3: "Saúde", BLAU3: "Saúde",
  // Telecom / Tecnologia
  VIVT3: "Telecom", TIMS3: "Telecom", OIBR3: "Telecom",
  POSI3: "Tecnologia", LWSA3: "Tecnologia", CASH3: "Tecnologia", TOTVS3: "Tecnologia",
  // Construção Civil
  MRVE3: "Construção Civil", CYRE3: "Construção Civil", TEND3: "Construção Civil",
  DIRR3: "Construção Civil", EVEN3: "Construção Civil", EZTC3: "Construção Civil", PLPL3: "Construção Civil",
  // Logística / Transporte
  RAIL3: "Logística", TGMA3: "Logística", CCRO3: "Logística", ECOR3: "Logística",
  AZUL4: "Aviação", GOLL4: "Aviação", EMBR3: "Aeroespacial",
  // Saneamento
  SBSP3: "Saneamento", CSMG3: "Saneamento",
};

const SECTOR_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#a855f7", "#64748b",
];

type AssetType = "FII" | "ETF" | "BDR" | "Ação";

function detectAssetType(ticker: string): AssetType {
  const upper = ticker.toUpperCase().replace(/\s/g, "");
  if (FII_SET.has(upper)) return "FII";
  if (ETF_SET.has(upper)) return "ETF";
  if (upper.endsWith("34") || upper.endsWith("35")) return "BDR";
  // sufixo 11 desconhecido → assume FII (mais comum)
  if (upper.endsWith("11") && !SECTOR_MAP[upper]) return "FII";
  return "Ação";
}

function detectSector(ticker: string): string {
  const upper = ticker.toUpperCase().replace(/\s/g, "");
  const type = detectAssetType(upper);
  if (type === "FII") return "Fundo Imobiliário";
  if (type === "ETF") return "ETF";
  if (type === "BDR") return "BDR";
  if (SECTOR_MAP[upper]) return SECTOR_MAP[upper];
  return "Outros";
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
    quantity: "",
    price_per_share: "",
    notes: "",
    date: format(now, "yyyy-MM-dd"),
  });

  const load = useCallback(async () => {
    try {
      const [loadedAccounts, loadedInvestments, loadedStocks, loadedQuotes, loadedSnapshots] = await Promise.all([
        getInvestmentAccounts(),
        getInvestments(),
        getStockTrades(),
        getStockQuotes(),
        getPortfolioSnapshots(),
      ]);
      setPortfolioSnapshots(Array.isArray(loadedSnapshots) ? loadedSnapshots : []);
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
      deposited: a.is_turbo ? a.current_balance : investments.filter((i) => i.account_id === a.id && i.type === "deposito").reduce((s, i) => s + i.amount, 0),
      yields: a.is_turbo ? 0 : investments.filter((i) => i.account_id === a.id && i.type === "rendimento").reduce((s, i) => s + i.amount, 0),
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

  const portfolioAnalysis = useMemo(() => {
    const insights: { level: "critical" | "warning" | "ok" | "suggestion"; title: string; detail: string; action?: string }[] = [];

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
      insights.push({ level: "warning", title: `Reserva insuficiente — ${formatCurrency(emerTotal)}`, detail: `Recomendado mínimo R$ 3.000 (3 meses de gastos). Faltam ${formatCurrency(3000 - emerTotal)}.`, action: "Direcionar aportes para emergência até completar" });
    } else {
      insights.push({ level: "ok", title: `Reserva de emergência adequada — ${formatCurrency(emerTotal)}`, detail: "Proteção básica garantida. Continue investindo normalmente." });
    }

    // 2. TURBO no teto
    const turboAccounts = accounts.filter((a) => a.is_turbo);
    for (const t of turboAccounts) {
      if (t.max_rendimento && t.current_balance >= t.max_rendimento * 0.95) {
        insights.push({ level: "warning", title: `${t.name} no teto — ${formatCurrency(t.current_balance)} / ${formatCurrency(t.max_rendimento)}`, detail: "O rendimento extra do TURBO para quando atinge o teto máximo.", action: "Redirecione novos aportes para FIIs ou ações" });
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
        insights.push({ level: "warning", title: `Duplicidade: ${tickers.join(" + ")}`, detail: "Mesma empresa em classes diferentes. Não diversifica — apenas concentra o risco.", action: `Escolha apenas uma classe e venda a outra` });
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
      insights.push({ level: "suggestion", title: `FIIs: apenas ${fiiPctVariavel.toFixed(0)}% da renda variável`, detail: "Para renda passiva consistente, FIIs devem representar 50–60% da carteira variável. Dividendos mensais isentos de IR.", action: "Próximos aportes: MXRF11, XPML11 ou TRXF11" });
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
      valor_liquido: renameForm.is_turbo && renameForm.valor_liquido ? parseFloat(renameForm.valor_liquido) : null,
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
    const { insights, nextMoves, score, emerTotal, fiiPctVariavel } = portfolioAnalysis;
    const { allSources, totalRendaMensal, recommendations } = investorData;
    const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const levelColors: Record<string, string> = { critical: "#ef4444", warning: "#f59e0b", ok: "#10b981", suggestion: "#6366f1" };
    const levelLabels: Record<string, string> = { critical: "CRÍTICO", warning: "ATENÇÃO", ok: "OK", suggestion: "SUGESTÃO" };

    const insightsHtml = insights.map((ins) => `
      <div style="border-left:4px solid ${levelColors[ins.level]};padding:10px 14px;margin-bottom:10px;background:${ins.level === "critical" ? "#fef2f2" : ins.level === "warning" ? "#fffbeb" : ins.level === "ok" ? "#f0fdf4" : "#eef2ff"};border-radius:4px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="background:${levelColors[ins.level]};color:white;font-size:10px;font-weight:bold;padding:2px 6px;border-radius:3px;">${levelLabels[ins.level]}</span>
          <strong style="font-size:13px;">${ins.title}</strong>
        </div>
        <p style="margin:0;color:#555;font-size:12px;">${ins.detail}</p>
        ${ins.action ? `<p style="margin:4px 0 0;color:${levelColors[ins.level]};font-size:12px;font-weight:600;">→ ${ins.action}</p>` : ""}
      </div>`).join("");

    const allocationHtml = recommendations.map((r) => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px 12px;font-weight:600;">${r.label}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:bold;">${r.atual.toFixed(1)}%</td>
        <td style="padding:8px 12px;text-align:right;color:#888;">${r.ideal}%</td>
        <td style="padding:8px 12px;text-align:right;color:${r.atual >= r.ideal ? "#10b981" : "#f59e0b"};font-weight:bold;">${r.atual >= r.ideal ? "✓ OK" : `+${(r.ideal - r.atual).toFixed(0)}%`}</td>
      </tr>`).join("");

    const sourcesHtml = allSources.map((s) => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px 12px;font-weight:600;">${s.nome}</td>
        <td style="padding:8px 12px;color:#888;">${s.tipo}</td>
        <td style="padding:8px 12px;text-align:right;">${formatCurrency(s.capital)}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:bold;color:#10b981;">+${formatCurrency(s.rendaMensal)}/mês</td>
      </tr>`).join("");

    const nextMovesHtml = nextMoves.map((m) => `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px 12px;text-align:center;font-weight:bold;color:#6366f1;">${m.prioridade}</td>
        <td style="padding:8px 12px;font-weight:600;">${m.label}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:bold;color:#10b981;">${m.valor}</td>
        <td style="padding:8px 12px;font-size:12px;color:#666;">${m.razao}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>IBANK — Análise de Carteira</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:white;color:#111;padding:32px;max-width:900px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6366f1;padding-bottom:20px;margin-bottom:28px}
.header h1{font-size:28px;font-weight:900;color:#6366f1}.header p{color:#888;font-size:13px;margin-top:4px}
.score{background:#6366f1;color:white;border-radius:50%;width:72px;height:72px;display:flex;align-items:center;justify-content:center;flex-direction:column;font-weight:900;font-size:22px}
.score small{font-size:9px;font-weight:600;opacity:.8}section{margin-bottom:28px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:12px;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{background:#f8f9fb;border-radius:8px;padding:14px 16px}
.card .lbl{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
.card .val{font-size:20px;font-weight:900}.card .sub{font-size:11px;color:#888;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;padding:8px 12px;background:#f3f4f6;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#666}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa}
@media print{body{padding:16px}}</style></head><body>
<div class="header"><div><h1>IBANK</h1><p>Relatório de Análise de Carteira</p><p style="margin-top:4px;">${dateStr}</p></div>
<div class="score">${score}<small>SCORE</small></div></div>
<section><h2>Resumo do Patrimônio</h2>
<div class="grid">
<div class="card"><div class="lbl">Patrimônio Total</div><div class="val">${formatCurrency(grandTotal)}</div><div class="sub">renda fixa + ações</div></div>
<div class="card"><div class="lbl">Renda Passiva Est.</div><div class="val" style="color:#6366f1;">${formatCurrency(totalRendaMensal)}</div><div class="sub">por mês</div></div>
<div class="card"><div class="lbl">Reserva Emergência</div><div class="val" style="color:${emerTotal >= 3000 ? "#10b981" : "#ef4444"};">${formatCurrency(emerTotal)}</div><div class="sub">${emerTotal >= 3000 ? "adequada" : "insuficiente"}</div></div>
<div class="card"><div class="lbl">FIIs na Variável</div><div class="val" style="color:${fiiPctVariavel >= 50 ? "#10b981" : "#f59e0b"};">${fiiPctVariavel.toFixed(0)}%</div><div class="sub">ideal 50–60%</div></div>
</div></section>
<section><h2>Diagnóstico da Carteira</h2>${insightsHtml}</section>
<section><h2>Fontes de Renda Mensal</h2><table><thead><tr><th>Fonte</th><th>Tipo</th><th style="text-align:right;">Capital</th><th style="text-align:right;">Renda/mês</th></tr></thead><tbody>${sourcesHtml || "<tr><td colspan='4' style='padding:12px;color:#888;text-align:center;'>Nenhuma fonte identificada ainda</td></tr>"}</tbody></table></section>
<section><h2>Alocação Atual vs. Ideal</h2><table><thead><tr><th>Categoria</th><th style="text-align:right;">Atual</th><th style="text-align:right;">Ideal</th><th style="text-align:right;">Status</th></tr></thead><tbody>${allocationHtml}</tbody></table></section>
<section><h2>Próximos Aportes Recomendados</h2><table><thead><tr><th style="text-align:center;">#</th><th>Destino</th><th style="text-align:right;">Valor</th><th>Motivo</th></tr></thead><tbody>${nextMovesHtml}</tbody></table></section>
<div class="footer">Gerado pelo IBANK em ${dateStr} · Estimativas baseadas em taxas de mercado · Não constitui assessoria regulada pela CVM/ANCORD</div>
</body></html>`;

    const win = window.open("", "_blank", "width=1050,height=820");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  }

  if (investorMode) {
    const { allSources, totalRendaMensal, chartMonths, recommendations, CDI_MENSAL } = investorData;
    const goalProgress = incomeGoal > 0 ? Math.min((totalRendaMensal / incomeGoal) * 100, 100) : 0;
    const circumference = 2 * Math.PI * 118;

    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#05050a] text-white">
        {/* Mesh de fundo */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-violet-600/25 blur-[100px]" />
          <div className="absolute top-1/4 -right-32 h-[26rem] w-[26rem] rounded-full bg-blue-500/20 blur-[100px]" />
          <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-500/15 blur-[110px]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }} />
        </div>

        <div className="relative mx-auto max-w-5xl px-5 sm:px-8 py-8 sm:py-12">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-10 sm:mb-16">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 backdrop-blur-xl">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Modo Investidor</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={generateReport}
                className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300 backdrop-blur-xl transition-colors hover:bg-violet-500/20 hover:text-violet-200"
              >
                <FileText className="h-3.5 w-3.5" />
                Gerar PDF
              </button>
              <button
                onClick={() => setInvestorMode(false)}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-white"
              >
                Sair<span className="text-white/40">·</span>voltar ao painel
              </button>
            </div>
          </div>

          {/* Hero central */}
          <div className="flex flex-col items-center text-center mb-14 sm:mb-20">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40 mb-4">Sua renda passiva mensal</p>

            <div className="relative flex items-center justify-center mb-2" style={{ width: 280, height: 280 }}>
              <svg width="280" height="280" className="absolute inset-0 -rotate-90">
                <circle cx="140" cy="140" r="118" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                {incomeGoal > 0 && (
                  <>
                    <circle
                      cx="140" cy="140" r="118" fill="none"
                      stroke="url(#goalGradient)" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (goalProgress / 100) * circumference}
                      style={{ transition: "stroke-dashoffset 1s ease" }}
                    />
                    <defs>
                      <linearGradient id="goalGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                  </>
                )}
              </svg>
              <div className="flex flex-col items-center px-6">
                <p className="text-3xl sm:text-4xl font-black tabular-nums bg-gradient-to-br from-white via-violet-200 to-blue-300 bg-clip-text text-transparent leading-none text-center">
                  {formatCurrency(totalRendaMensal)}
                </p>
                <p className="text-xs text-white/40 mt-2">por mês</p>
              </div>
            </div>

            {incomeGoal > 0 && (
              <p className="text-sm text-white/50 mb-6">
                <span className="font-bold text-white">{goalProgress.toFixed(0)}%</span> da meta de{" "}
                <span className="font-bold text-white">{formatCurrency(incomeGoal)}</span>
                {goalProgress < 100 && <> · faltam <span className="font-bold text-emerald-400">{formatCurrency(incomeGoal - totalRendaMensal)}</span></>}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-white/30" />
              <input
                type="number"
                placeholder="Definir meta mensal (R$)..."
                className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 w-56 text-center focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                value={incomeGoalInput}
                onChange={(e) => setIncomeGoalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && incomeGoalInput) {
                    const v = parseFloat(incomeGoalInput);
                    if (v > 0) {
                      setIncomeGoal(v);
                      try { localStorage.setItem("ibank_income_goal", String(v)); } catch {}
                      setIncomeGoalInput("");
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Fontes de renda */}
          <div className="mb-14 sm:mb-20">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Fontes de renda</h3>
            {allSources.length === 0 ? (
              <p className="text-white/40 text-center py-12 text-sm">Nenhuma fonte de renda identificada ainda.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {allSources.map((src, i) => (
                  <div key={i}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 transition-all hover:bg-white/[0.06] hover:border-white/20"
                  >
                    <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl opacity-30 transition-opacity group-hover:opacity-50" style={{ background: src.cor }} />
                    <div className="relative">
                      <div className="flex items-center gap-1.5 mb-3">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: src.cor }} />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{src.tipo}</p>
                      </div>
                      <p className="text-sm font-semibold text-white/90 mb-0.5">{src.nome}</p>
                      <p className="text-xs text-white/35 mb-4 truncate">{src.badge}</p>
                      <p className="text-2xl font-extrabold tabular-nums text-white">
                        +{formatCurrency(src.rendaMensal)}
                      </p>
                      <p className="text-xs text-white/30 mt-1">/mês · capital {formatCurrency(src.capital)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evolução */}
          {chartMonths.length > 0 && (
            <div className="mb-14 sm:mb-20">
              <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Evolução registrada</h3>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartMonths}>
                    <defs>
                      <linearGradient id="gradInvestorRenda" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} width={52} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="bg-[#0a0a12] border border-white/10 rounded-xl shadow-2xl p-3 min-w-[160px]">
                            <p className="text-xs font-bold border-b border-white/10 pb-1.5 mb-2 text-white/70">{label}</p>
                            <div className="flex justify-between text-sm gap-4">
                              <span className="text-white/50">Rendimento</span>
                              <span className="font-bold text-violet-400 tabular-nums">+{formatCurrency(Number(payload[0].value))}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area type="monotone" dataKey="Renda recebida" stroke="#a855f7" strokeWidth={2.5} fill="url(#gradInvestorRenda)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Alocação */}
          <div className="mb-14 sm:mb-20">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Alocação atual vs. ideal</h3>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 sm:p-6 space-y-6">
              {recommendations.map((r) => (
                <div key={r.label} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: r.cor }} />
                      <span className="font-semibold text-white/90">{r.label}</span>
                      <span className="text-xs text-white/35 hidden sm:inline">{r.desc}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="tabular-nums font-bold" style={{ color: r.cor }}>{r.atual.toFixed(1)}%</span>
                      <span className="text-white/30">alvo {r.ideal}%</span>
                      <span className={`font-bold ${r.atual >= r.ideal ? "text-emerald-400" : "text-amber-400"}`}>
                        {r.atual >= r.ideal ? "✓" : `+${(r.ideal - r.atual).toFixed(0)}%`}
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-full opacity-25" style={{ width: `${r.ideal}%`, background: r.cor }} />
                    <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${Math.min(r.atual, 100)}%`, background: r.cor }} />
                    <div className="absolute inset-y-0 w-0.5 bg-white/50" style={{ left: `${r.ideal}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simulador */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">
              Simulador · para chegar em {formatCurrency(incomeGoal || 1000)}/mês
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] backdrop-blur-xl p-5">
                <p className="text-xs text-purple-300 font-semibold mb-2 uppercase tracking-wide">Via FIIs (~0,85%/mês)</p>
                <p className="text-2xl font-extrabold tabular-nums text-white">{formatCurrency((incomeGoal || 1000) / 0.0085)}</p>
                <p className="text-xs text-white/35 mt-1">investidos em FIIs</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] backdrop-blur-xl p-5">
                <p className="text-xs text-emerald-300 font-semibold mb-2 uppercase tracking-wide">Via TURBO 115% CDI</p>
                <p className="text-2xl font-extrabold tabular-nums text-white">{formatCurrency((incomeGoal || 1000) / (1.15 * CDI_MENSAL))}</p>
                <p className="text-xs text-white/35 mt-1">investidos em CDB TURBO</p>
              </div>
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] backdrop-blur-xl p-5">
                <p className="text-xs text-blue-300 font-semibold mb-2 uppercase tracking-wide">Via dividendos (~0,4%/mês)</p>
                <p className="text-2xl font-extrabold tabular-nums text-white">{formatCurrency((incomeGoal || 1000) / 0.004)}</p>
                <p className="text-xs text-white/35 mt-1">em ações pagadoras</p>
              </div>
            </div>
            <p className="text-xs text-white/30 mt-4 text-center">
              Você já tem {formatCurrency(totalRendaMensal)}/mês · faltam {formatCurrency(Math.max(0, (incomeGoal || 1000) - totalRendaMensal))}/mês para a meta
            </p>
          </div>

          {/* Diagnóstico da carteira */}
          {(() => {
            const { insights, nextMoves, score } = portfolioAnalysis;
            const levelColors: Record<string, string> = { critical: "#ef4444", warning: "#f59e0b", ok: "#10b981", suggestion: "#6366f1" };
            const levelBgs: Record<string, string> = { critical: "border-red-500/20 bg-red-500/[0.06]", warning: "border-amber-500/20 bg-amber-500/[0.06]", ok: "border-emerald-500/20 bg-emerald-500/[0.06]", suggestion: "border-violet-500/20 bg-violet-500/[0.06]" };
            const levelLabels: Record<string, string> = { critical: "CRÍTICO", warning: "ATENÇÃO", ok: "OK", suggestion: "SUGESTÃO" };
            const scoreColor = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#ef4444";
            const circumS = 2 * Math.PI * 28;
            return (
              <div className="mt-14 sm:mt-20">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Diagnóstico da carteira</h3>
                  <button
                    onClick={generateReport}
                    className="flex items-center gap-2 rounded-full bg-violet-600 hover:bg-violet-500 px-5 py-2 text-sm font-semibold text-white transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    Gerar Relatório PDF
                  </button>
                </div>

                {/* Score */}
                <div className="flex items-center gap-5 mb-8 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
                  <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
                    <svg width="64" height="64" className="-rotate-90 absolute inset-0">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                      <circle cx="32" cy="32" r="28" fill="none" stroke={scoreColor} strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={circumS} strokeDashoffset={circumS * (1 - score / 100)}
                        style={{ transition: "stroke-dashoffset 1s ease" }} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-black" style={{ color: scoreColor }}>{score}</span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{score >= 70 ? "Carteira saudável" : score >= 40 ? "Precisa de ajustes" : "Atenção necessária"}</p>
                    <p className="text-xs text-white/40 mt-0.5">Score baseado nos pontos de melhoria identificados abaixo</p>
                  </div>
                </div>

                {/* Insights */}
                <div className="space-y-3 mb-10">
                  {insights.map((ins, i) => (
                    <div key={i} className={`rounded-xl border ${levelBgs[ins.level]} p-4 backdrop-blur-xl`}>
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 rounded text-[10px] font-black px-1.5 py-0.5 mt-0.5" style={{ background: levelColors[ins.level], color: "white" }}>
                          {levelLabels[ins.level]}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-white/90">{ins.title}</p>
                          <p className="text-xs text-white/50 mt-0.5">{ins.detail}</p>
                          {ins.action && <p className="text-xs font-semibold mt-1.5" style={{ color: levelColors[ins.level] }}>→ {ins.action}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Próximos aportes */}
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Próximos aportes recomendados</h3>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                  {nextMoves.map((m, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border-b border-white/5 last:border-b-0">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-black text-violet-300">{m.prioridade}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white/90">{m.label}</p>
                        <p className="text-xs text-white/40 truncate">{m.razao}</p>
                      </div>
                      <span className="text-sm font-extrabold text-emerald-400 tabular-nums flex-shrink-0">{m.valor}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="h-10" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Investimentos</h1>
            <button
              type="button"
              onClick={() => setRatesOpen(true)}
              className="flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Rentabilidade estimada"
            >
              <Info className="h-4.5 w-4.5" />
            </button>
          </div>
          <p className="text-muted-foreground">Poupança, renda fixa e ações</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setInvestorMode(true)}
            className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
          >
            <Zap className="h-4 w-4" />
            Modo Investidor
          </Button>
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
              <DialogHeader><DialogTitle>Registrar compra de ações</DialogTitle></DialogHeader>
              <div className="space-y-4">
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
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); localStorage.setItem("ibank_inv_tab", v); }}>
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

            {/* Rentabilidade via dialog (i) */}
          </TabsContent>

          {/* ── Abas por conta ── */}
          {accounts.map((account) => (
            <TabsContent key={account.id} value={account.id} className="space-y-6 mt-4">
              {activeTab === account.id && (
                <>
                  {/* Account header with rename + delete */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-lg">{account.name}</h2>
                      {account.institution && <p className="text-sm text-muted-foreground">{account.institution}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5"
                        onClick={() => {
                          setRenameForm({
                            id: account.id, name: account.name, institution: account.institution ?? "",
                            is_turbo: account.is_turbo ?? false,
                            cdi_percent: account.cdi_percent ? String(account.cdi_percent) : "",
                            max_rendimento: account.max_rendimento ? String(account.max_rendimento) : "",
                            valor_bruto: account.current_balance ? String(account.current_balance) : "",
                            valor_liquido: account.valor_liquido ? String(account.valor_liquido) : "",
                          });
                          setRenameOpen(true);
                        }}>
                        <Pencil className="h-3.5 w-3.5" /> Renomear
                      </Button>
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
                  </div>

                  {account.is_turbo && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                        ⚡ TURBO
                      </span>
                      {account.cdi_percent && (
                        <span className="text-xs text-muted-foreground">{account.cdi_percent}% CDI</span>
                      )}
                      {account.max_rendimento && (
                        <span className="text-xs text-muted-foreground">· teto {formatCurrency(account.max_rendimento)}</span>
                      )}
                    </div>
                  )}
                  {account.is_turbo ? (
                    /* ── Cards TURBO modernos ── */
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Total bruto */}
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-md">
                        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                        <div className="absolute -right-1 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100 mb-2">Total bruto</p>
                        <p className="text-2xl font-extrabold tabular-nums leading-none">{formatCurrency(account.current_balance)}</p>
                        <p className="text-xs text-emerald-200 mt-1.5">{account.institution}</p>
                      </div>
                      {/* Valor líquido */}
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-md">
                        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                        <div className="absolute -right-1 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-100 mb-2">Valor líquido</p>
                        <p className="text-2xl font-extrabold tabular-nums leading-none">
                          {account.valor_liquido != null ? formatCurrency(account.valor_liquido) : "—"}
                        </p>
                        {account.valor_liquido != null && account.current_balance > 0 && (
                          <p className="text-xs text-blue-200 mt-1.5">IOF/IR est. {formatCurrency(account.current_balance - account.valor_liquido)}</p>
                        )}
                      </div>
                      {/* Líquido real */}
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 p-4 text-white shadow-md">
                        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                        <div className="absolute -right-1 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-100 mb-2">Líquido real</p>
                        <p className="text-2xl font-extrabold tabular-nums leading-none">
                          {account.valor_liquido != null ? formatCurrency(account.valor_liquido - 5000) : "—"}
                        </p>
                        <p className="text-xs text-violet-200 mt-1.5">Líquido − R$ 5.000,00</p>
                      </div>
                      {/* Total de rendimentos */}
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-4 text-white shadow-md">
                        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                        <div className="absolute -right-1 -bottom-4 h-20 w-20 rounded-full bg-white/10" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-100 mb-2">Rendimentos</p>
                        <p className="text-2xl font-extrabold tabular-nums leading-none">
                          +{formatCurrency(turboHistory.reduce((s, r) => s + r.rendimento, 0))}
                        </p>
                        <p className="text-xs text-amber-100 mt-1.5">
                          {turboHistory.length} {turboHistory.length === 1 ? "mês registrado" : "meses registrados"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* ── Cards conta normal ── */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2"><CardDescription>Saldo atual</CardDescription></CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-green-600 tabular-nums">{formatCurrency(computedBalance)}</p>
                          {account.institution && <p className="text-xs text-muted-foreground mt-1">{account.institution}</p>}
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
                  )}

                  {/* ── TURBO: histórico mensal ── */}
                  {account.is_turbo && (
                    <>
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>Evolução mensal TURBO</CardTitle>
                              <CardDescription>Bruto, rendimento e líquido por mês</CardDescription>
                            </div>
                            <Button size="sm" onClick={() => {
                              setTurboMonthForm({ month: format(new Date(), "yyyy-MM"), total_bruto: "", rendimento: "", valor_liquido: "" });
                              setTurboMonthOpen(true);
                            }}>
                              <Plus className="h-4 w-4 mr-1" />Registrar mês
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {turboHistory.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">
                              Nenhum mês registrado ainda. Clique em &quot;Registrar mês&quot; para começar.
                            </p>
                          ) : (() => {
                            const chartData = turboHistory.map((r) => ({
                              id: r.id,
                              mes: r.month,
                              label: new Date(r.month + "-15").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
                              "Total bruto": r.total_bruto,
                              Rendimento: r.rendimento,
                              Líquido: r.valor_liquido ?? 0,
                            }));
                            const selected = selectedTurboMonth
                              ? turboHistory.find((r) => r.month === selectedTurboMonth) ?? null
                              : null;
                            const prevRecord = selected
                              ? turboHistory[turboHistory.findIndex((r) => r.month === selected.month) - 1] ?? null
                              : null;
                            return (
                              <>
                                {/* Gráfico de barras agrupadas */}
                                <div className="relative">
                                  <p className="text-xs text-muted-foreground mb-2">Clique em um mês para ver detalhes</p>
                                  <ResponsiveContainer width="100%" height={260}>
                                    <BarChart
                                      data={chartData}
                                      barCategoryGap="30%"
                                      barGap={3}
                                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                      onClick={(e: any) => {
                                        if (e?.activePayload?.[0]) {
                                          const mes = e.activePayload[0].payload.mes as string;
                                          setSelectedTurboMonth((prev) => prev === mes ? null : mes);
                                        }
                                      }}
                                      style={{ cursor: "pointer" }}
                                    >
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                      <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                      <YAxis
                                        tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`}
                                        width={64} tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                                      />
                                      <Tooltip
                                        cursor={{ fill: "rgba(99,102,241,0.07)" }}
                                        content={({ active, payload, label }) => {
                                          if (!active || !payload?.length) return null;
                                          const descriptions: Record<string, string> = {
                                            "Total bruto": "Saldo total acumulado na caixinha no mês",
                                            "Rendimento": "Quanto a caixinha rendeu neste mês",
                                            "Líquido": "Valor líquido estimado após IOF/IR",
                                          };
                                          const colors: Record<string, string> = {
                                            "Total bruto": "#10b981",
                                            "Rendimento": "#f59e0b",
                                            "Líquido": "#3b82f6",
                                          };
                                          return (
                                            <div className="bg-white dark:bg-zinc-900 border rounded-xl shadow-lg p-3.5 min-w-[220px] space-y-2.5">
                                              <p className="text-xs font-bold text-foreground border-b pb-2">{label}</p>
                                              {payload.map((p, i) => {
                                                const key = String(p.dataKey);
                                                return (
                                                  <div key={i} className="space-y-0.5">
                                                    <div className="flex items-center justify-between gap-4">
                                                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                                                        <span className="inline-block w-3 h-3 rounded" style={{ background: colors[key] ?? p.color }} />
                                                        {key}
                                                      </span>
                                                      <span className="font-bold tabular-nums text-sm">{formatCurrency(Number(p.value))}</span>
                                                    </div>
                                                    {descriptions[key] && (
                                                      <p className="text-xs text-muted-foreground pl-4.5 leading-snug">{descriptions[key]}</p>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          );
                                        }}
                                      />
                                      <Legend
                                        iconType="square"
                                        iconSize={10}
                                        formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                                      />
                                      {selectedTurboMonth && (
                                        <ReferenceLine
                                          x={chartData.find((d) => d.mes === selectedTurboMonth)?.label}
                                          stroke="#6366f1" strokeWidth={2} strokeDasharray="4 2"
                                        />
                                      )}
                                      <Bar dataKey="Total bruto" fill="#10b981" radius={[4, 4, 0, 0]}
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        shape={(props: any) => {
                                          const isSelected = props.mes === selectedTurboMonth;
                                          const { x, y, width, height } = props;
                                          return <rect x={x} y={y} width={width} height={height} rx={4} fill={isSelected ? "#059669" : "#10b981"} opacity={selectedTurboMonth && !isSelected ? 0.4 : 1} />;
                                        }}
                                      />
                                      <Bar dataKey="Rendimento" fill="#f59e0b" radius={[4, 4, 0, 0]}
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        shape={(props: any) => {
                                          const isSelected = props.mes === selectedTurboMonth;
                                          const { x, y, width, height } = props;
                                          return <rect x={x} y={y} width={width} height={height} rx={4} fill={isSelected ? "#d97706" : "#f59e0b"} opacity={selectedTurboMonth && !isSelected ? 0.4 : 1} />;
                                        }}
                                      />
                                      <Bar dataKey="Líquido" fill="#3b82f6" radius={[4, 4, 0, 0]}
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        shape={(props: any) => {
                                          const isSelected = props.mes === selectedTurboMonth;
                                          const { x, y, width, height } = props;
                                          return <rect x={x} y={y} width={width} height={height} rx={4} fill={isSelected ? "#2563eb" : "#3b82f6"} opacity={selectedTurboMonth && !isSelected ? 0.4 : 1} />;
                                        }}
                                      />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>

                                {/* Painel de detalhe do mês selecionado */}
                                {selected && (
                                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/30 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Detalhes do mês</p>
                                        <p className="text-lg font-bold text-indigo-800 dark:text-indigo-300">
                                          {new Date(selected.month + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                                        </p>
                                      </div>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-400 hover:text-indigo-700"
                                        onClick={() => setSelectedTurboMonth(null)}>
                                        ✕
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                      <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/40 p-3 text-center">
                                        <p className="text-xs text-emerald-600 mb-1">Total bruto</p>
                                        <p className="text-base font-bold text-emerald-700 tabular-nums">{formatCurrency(selected.total_bruto)}</p>
                                        {prevRecord && (
                                          <p className={`text-xs mt-0.5 tabular-nums ${selected.total_bruto >= prevRecord.total_bruto ? "text-emerald-500" : "text-red-500"}`}>
                                            {selected.total_bruto >= prevRecord.total_bruto ? "▲" : "▼"} {formatCurrency(Math.abs(selected.total_bruto - prevRecord.total_bruto))}
                                          </p>
                                        )}
                                      </div>
                                      <div className="rounded-lg bg-amber-100 dark:bg-amber-950/40 p-3 text-center">
                                        <p className="text-xs text-amber-600 mb-1">Rendimento</p>
                                        <p className="text-base font-bold text-amber-700 tabular-nums">+{formatCurrency(selected.rendimento)}</p>
                                        {prevRecord && (
                                          <p className={`text-xs mt-0.5 tabular-nums ${selected.rendimento >= prevRecord.rendimento ? "text-emerald-500" : "text-red-500"}`}>
                                            {selected.rendimento >= prevRecord.rendimento ? "▲" : "▼"} {formatCurrency(Math.abs(selected.rendimento - prevRecord.rendimento))} vs mês ant.
                                          </p>
                                        )}
                                      </div>
                                      <div className="rounded-lg bg-blue-100 dark:bg-blue-950/40 p-3 text-center">
                                        <p className="text-xs text-blue-600 mb-1">Valor líquido</p>
                                        <p className="text-base font-bold text-blue-700 tabular-nums">
                                          {selected.valor_liquido != null ? formatCurrency(selected.valor_liquido) : "—"}
                                        </p>
                                        {selected.valor_liquido != null && prevRecord?.valor_liquido != null && (
                                          <p className={`text-xs mt-0.5 tabular-nums ${selected.valor_liquido >= prevRecord.valor_liquido ? "text-emerald-500" : "text-red-500"}`}>
                                            {selected.valor_liquido >= prevRecord.valor_liquido ? "▲" : "▼"} {formatCurrency(Math.abs(selected.valor_liquido - prevRecord.valor_liquido))}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {selected.total_bruto > 0 && (
                                      <div className="text-xs text-indigo-600 pt-1">
                                        Yield do mês: <strong>{((selected.rendimento / (selected.total_bruto - selected.rendimento)) * 100).toFixed(3)}%</strong>
                                        {account.cdi_percent && (
                                          <span className="ml-3 text-muted-foreground">CDI configurado: {account.cdi_percent}%</span>
                                        )}
                                      </div>
                                    )}
                                    <div className="flex justify-end gap-2 pt-1">
                                      <Button variant="outline" size="sm" className="h-7 text-xs text-red-500 border-red-200 hover:bg-red-50"
                                        onClick={() => { handleDeleteTurboRecord(selected.id); setSelectedTurboMonth(null); }}>
                                        <Trash2 className="h-3 w-3 mr-1" />Excluir mês
                                      </Button>
                                      <Button variant="outline" size="sm" className="h-7 text-xs"
                                        onClick={() => {
                                          setTurboMonthForm({ month: selected.month, total_bruto: String(selected.total_bruto), rendimento: String(selected.rendimento), valor_liquido: selected.valor_liquido != null ? String(selected.valor_liquido) : "" });
                                          setTurboMonthOpen(true);
                                        }}>
                                        <Pencil className="h-3 w-3 mr-1" />Editar mês
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {/* Tabela resumo */}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b text-muted-foreground text-xs uppercase">
                                        <th className="text-left py-2 pr-4 font-medium">Mês</th>
                                        <th className="text-right py-2 pr-4 font-medium">Total bruto</th>
                                        <th className="text-right py-2 pr-4 font-medium">Rendimento</th>
                                        <th className="text-right py-2 pr-4 font-medium">Valor líquido</th>
                                        <th className="py-2 w-8" />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {[...turboHistory].reverse().map((r) => (
                                        <tr
                                          key={r.id}
                                          className={`border-b last:border-0 transition-colors cursor-pointer ${r.month === selectedTurboMonth ? "bg-indigo-50 dark:bg-indigo-950/30" : "hover:bg-muted/40"}`}
                                          onClick={() => setSelectedTurboMonth((prev) => prev === r.month ? null : r.month)}
                                        >
                                          <td className="py-2.5 pr-4 font-medium flex items-center gap-2">
                                            {r.month === selectedTurboMonth && <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                                            {new Date(r.month + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                                          </td>
                                          <td className="py-2.5 pr-4 text-right tabular-nums text-green-600 font-semibold">{formatCurrency(r.total_bruto)}</td>
                                          <td className="py-2.5 pr-4 text-right tabular-nums text-amber-600 font-semibold">+{formatCurrency(r.rendimento)}</td>
                                          <td className="py-2.5 pr-4 text-right tabular-nums text-blue-600 font-semibold">
                                            {r.valor_liquido != null ? formatCurrency(r.valor_liquido) : "—"}
                                          </td>
                                          <td className="py-2.5 text-right">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                              onClick={(e) => { e.stopPropagation(); handleDeleteTurboRecord(r.id); }}>
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2">
                                        <td className="py-2 pr-4 text-xs text-muted-foreground font-semibold">Totais</td>
                                        <td className="py-2 pr-4 text-right tabular-nums font-bold text-green-700">
                                          {formatCurrency(turboHistory[turboHistory.length - 1]?.total_bruto ?? 0)}
                                        </td>
                                        <td className="py-2 pr-4 text-right tabular-nums font-bold text-amber-700">
                                          +{formatCurrency(turboHistory.reduce((s, r) => s + r.rendimento, 0))}
                                        </td>
                                        <td className="py-2 pr-4 text-right tabular-nums font-bold text-blue-700">
                                          {turboHistory[turboHistory.length - 1]?.valor_liquido != null
                                            ? formatCurrency(turboHistory[turboHistory.length - 1].valor_liquido!)
                                            : "—"}
                                        </td>
                                        <td />
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </>
                            );
                          })()}
                        </CardContent>
                      </Card>

                      {/* Dialog: registrar mês TURBO */}
                      <Dialog open={turboMonthOpen} onOpenChange={setTurboMonthOpen}>
                        <DialogContent className="max-w-sm">
                          <DialogHeader><DialogTitle>Registrar mês — {account.name}</DialogTitle></DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <Label>Mês de referência</Label>
                              <Input type="month" value={turboMonthForm.month}
                                onChange={(e) => setTurboMonthForm({ ...turboMonthForm, month: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Rendimento do mês (R$)</Label>
                              <Input type="number" placeholder="Ex: 59,30" autoFocus value={turboMonthForm.rendimento}
                                onChange={(e) => setTurboMonthForm({ ...turboMonthForm, rendimento: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Total bruto no mês (R$) <span className="text-muted-foreground text-xs">opcional</span></Label>
                              <Input type="number" placeholder={`Ex: ${(account.current_balance + (parseFloat(turboMonthForm.rendimento) || 0)).toFixed(2)}`} value={turboMonthForm.total_bruto}
                                onChange={(e) => setTurboMonthForm({ ...turboMonthForm, total_bruto: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Valor líquido (R$) <span className="text-muted-foreground text-xs">opcional</span></Label>
                              <Input type="number" placeholder="Ex: 5.086,01" value={turboMonthForm.valor_liquido}
                                onChange={(e) => setTurboMonthForm({ ...turboMonthForm, valor_liquido: e.target.value })} />
                            </div>
                            <Button className="w-full" onClick={handleSaveTurboMonth}>Salvar</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}

                  {!account.is_turbo && (() => {
                    const monthlyRendimentos = accountInvestments
                      .filter((i) => i.type === "rendimento")
                      .reduce((acc, i) => {
                        const m = i.date.slice(0, 7);
                        acc[m] = (acc[m] ?? 0) + i.amount;
                        return acc;
                      }, {} as Record<string, number>);
                    const rendData = Object.entries(monthlyRendimentos)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([m, v]) => ({
                        mes: m,
                        label: new Date(m + "-15").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
                        Rendimento: v,
                      }));
                    const totalRend = rendData.reduce((s, d) => s + d.Rendimento, 0);
                    const lastRend = rendData[rendData.length - 1]?.Rendimento ?? 0;

                    return (
                      <>
                        {/* Card rendimento mensal */}
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle>Rendimentos mensais</CardTitle>
                                <CardDescription>
                                  {rendData.length > 0
                                    ? `${rendData.length} mês${rendData.length !== 1 ? "es" : ""} · total ${formatCurrency(totalRend)}`
                                    : "Registre o rendimento de cada mês"}
                                </CardDescription>
                              </div>
                              <Button size="sm" onClick={() => {
                                setRendMonthForm({ month: format(new Date(), "yyyy-MM"), amount: "", description: "" });
                                setRendMonthOpen(true);
                              }}>
                                <Plus className="h-4 w-4 mr-1" />Registrar rendimento
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {rendData.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                Nenhum rendimento registrado ainda.
                              </p>
                            ) : (
                              <div className="space-y-4">
                                {/* mini-stats */}
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 p-3 text-center">
                                    <p className="text-xs text-amber-600 mb-1">Último mês</p>
                                    <p className="text-base font-bold text-amber-700 tabular-nums">+{formatCurrency(lastRend)}</p>
                                  </div>
                                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 p-3 text-center">
                                    <p className="text-xs text-blue-600 mb-1">Total acumulado</p>
                                    <p className="text-base font-bold text-blue-700 tabular-nums">+{formatCurrency(totalRend)}</p>
                                  </div>
                                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 p-3 text-center">
                                    <p className="text-xs text-emerald-600 mb-1">Média mensal</p>
                                    <p className="text-base font-bold text-emerald-700 tabular-nums">+{formatCurrency(totalRend / rendData.length)}</p>
                                  </div>
                                </div>
                                {/* gráfico de barras */}
                                <ResponsiveContainer width="100%" height={200}>
                                  <BarChart data={rendData} barCategoryGap="35%" barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
                                    <Tooltip
                                      content={({ active, payload, label }) => {
                                        if (!active || !payload?.length) return null;
                                        return (
                                          <div className="bg-white dark:bg-zinc-900 border rounded-xl shadow-lg p-3 min-w-[160px]">
                                            <p className="text-xs font-bold border-b pb-1.5 mb-2">{label}</p>
                                            <div className="flex justify-between text-sm gap-4">
                                              <span className="text-muted-foreground">Rendimento</span>
                                              <span className="font-bold text-amber-600 tabular-nums">+{formatCurrency(Number(payload[0].value))}</span>
                                            </div>
                                          </div>
                                        );
                                      }}
                                    />
                                    <Bar dataKey="Rendimento" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Dialog registrar rendimento */}
                        <Dialog open={rendMonthOpen} onOpenChange={setRendMonthOpen}>
                          <DialogContent className="max-w-sm">
                            <DialogHeader><DialogTitle>Registrar rendimento — {account.name}</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <Label>Mês de referência</Label>
                                <Input type="month" value={rendMonthForm.month}
                                  onChange={(e) => setRendMonthForm({ ...rendMonthForm, month: e.target.value })} />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Valor do rendimento (R$)</Label>
                                <Input type="number" step="0.01" autoFocus placeholder="Ex: 45,30"
                                  value={rendMonthForm.amount}
                                  onChange={(e) => setRendMonthForm({ ...rendMonthForm, amount: e.target.value })} />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Descrição <span className="text-muted-foreground text-xs">opcional</span></Label>
                                <Input placeholder="Ex: Juros prefixado set/26"
                                  value={rendMonthForm.description}
                                  onChange={(e) => setRendMonthForm({ ...rendMonthForm, description: e.target.value })} />
                              </div>
                              <Button className="w-full" onClick={async () => {
                                const amount = parseFloat(rendMonthForm.amount);
                                if (!rendMonthForm.month || !amount) return;
                                const date = rendMonthForm.month + "-01";
                                const desc = rendMonthForm.description.trim() || `Rendimento ${new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
                                await createInvestment({ account_id: account.id, type: "rendimento", amount, description: desc, date });
                                await updateAccountBalance(account.id, computedBalance + amount);
                                setRendMonthOpen(false);
                                setRendMonthForm({ month: format(new Date(), "yyyy-MM"), amount: "", description: "" });
                                load();
                              }}>Salvar</Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Gráfico evolução do saldo */}
                        {chartData.length > 1 && (
                          <Card>
                            <CardHeader>
                              <CardTitle>Evolução do saldo</CardTitle>
                              <CardDescription>Histórico acumulado — {account.name}</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={chartData}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" angle={-25} textAnchor="end" height={50} />
                                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                                  <Tooltip formatter={(v) => typeof v === "number" ? formatCurrency(v) : String(v)} />
                                  <Area type="monotone" dataKey="saldo" stroke="hsl(var(--primary))"
                                    fill="hsl(var(--primary) / 0.1)" strokeWidth={2} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        )}

                        {/* Histórico de movimentações */}
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
                    );
                  })()}
                </>
              )}
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
                    <div className="space-y-1.5">
                      <Label>Valor líquido atual (R$)</Label>
                      <Input type="number" placeholder="Ex: 5086.01" value={renameForm.valor_liquido}
                        onChange={(e) => setRenameForm({ ...renameForm, valor_liquido: e.target.value })} />
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
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Posições atuais</CardTitle>
                      <CardDescription>Clique no lápis individual ou atualize todas as cotações de uma vez</CardDescription>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => {
                      const init: Record<string, string> = {};
                      stockPositions.forEach((p) => { init[p.ticker] = quoteMap.has(p.ticker) ? String(quoteMap.get(p.ticker)) : ""; });
                      setBulkPrices(init);
                      setBulkQuoteOpen(true);
                    }}>
                      <TrendingUp className="h-4 w-4 mr-1.5" />Atualizar cotações
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stockPositions.map((p) => {
                    const curPrice = quoteMap.get(p.ticker);
                    const curValue = curPrice !== undefined ? curPrice * p.quantity : undefined;
                    const gain = curValue !== undefined ? curValue - p.totalInvested : undefined;
                    const gainPct = gain !== undefined && p.totalInvested > 0 ? (gain / p.totalInvested) * 100 : undefined;
                    const assetType = detectAssetType(p.ticker);
                    const assetBadge: Record<AssetType, string> = {
                      FII: "bg-purple-100 text-purple-800",
                      ETF: "bg-yellow-100 text-yellow-800",
                      BDR: "bg-orange-100 text-orange-800",
                      Ação: "bg-blue-100 text-blue-800",
                    };
                    return (
                      <div key={p.ticker} className="flex items-center justify-between p-3 rounded-lg border gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold">{p.ticker}</p>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${assetBadge[assetType]}`}>{assetType}</span>
                            {gain !== undefined && (
                              <span className={`text-xs font-semibold ${gain >= 0 ? "text-green-600" : "text-destructive"}`}>
                                {gain >= 0 ? "+" : ""}{gainPct?.toFixed(2)}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {p.quantity} {assetType === "FII" ? "cotas" : assetType === "ETF" ? "cotas" : p.quantity === 1 ? "ação" : "ações"} · médio {formatCurrency(p.avgPrice)}
                            {curPrice !== undefined && ` · atual ${formatCurrency(curPrice)}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {curValue !== undefined ? (
                            <>
                              <p className="font-semibold text-blue-600 tabular-nums">{formatCurrency(curValue)}</p>
                              <p className="text-xs text-muted-foreground tabular-nums">
                                investido {formatCurrency(p.totalInvested)}
                              </p>
                            </>
                          ) : (
                            <p className="font-semibold text-blue-600 tabular-nums">{formatCurrency(p.totalInvested)}</p>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                          title="Atualizar cotação"
                          onClick={() => { setQuoteForm({ ticker: p.ticker, price: curPrice ? String(curPrice) : "" }); setQuoteOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Evolução do portfólio */}
            {portfolioSnapshots.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Evolução do portfólio</CardTitle>
                      <CardDescription>Valor total vs. investido ao longo do tempo · {portfolioSnapshots.length} snapshot{portfolioSnapshots.length !== 1 ? "s" : ""}</CardDescription>
                    </div>
                    {(() => {
                      const last = portfolioSnapshots[portfolioSnapshots.length - 1];
                      const first = portfolioSnapshots[0];
                      const gain = last.total - first.total;
                      const gainPct = first.total > 0 ? (gain / first.total) * 100 : 0;
                      return (
                        <div className="text-right">
                          <p className={`text-lg font-bold tabular-nums ${gain >= 0 ? "text-green-600" : "text-destructive"}`}>
                            {gain >= 0 ? "+" : ""}{gainPct.toFixed(2)}%
                          </p>
                          <p className="text-xs text-muted-foreground">{gain >= 0 ? "+" : ""}{formatCurrency(gain)} no período</p>
                        </div>
                      );
                    })()}
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={portfolioSnapshots.map((s) => ({
                      data: new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
                      "Valor atual": s.total,
                      "Investido": s.invested,
                    }))}>
                      <defs>
                        <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradInvested" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="data" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`} width={64} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const total = Number(payload.find((p) => p.dataKey === "Valor atual")?.value ?? 0);
                          const invested = Number(payload.find((p) => p.dataKey === "Investido")?.value ?? 0);
                          const diff = total - invested;
                          return (
                            <div className="bg-white dark:bg-zinc-900 border rounded-xl shadow-lg p-3.5 min-w-[200px] space-y-2">
                              <p className="text-xs font-bold border-b pb-2">{label}</p>
                              <div className="flex justify-between text-sm">
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Valor atual</span>
                                <span className="font-bold tabular-nums">{formatCurrency(total)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-400 inline-block" />Investido</span>
                                <span className="font-bold tabular-nums">{formatCurrency(invested)}</span>
                              </div>
                              <div className={`flex justify-between text-sm font-semibold border-t pt-2 ${diff >= 0 ? "text-green-600" : "text-destructive"}`}>
                                <span>Ganho/perda</span>
                                <span className="tabular-nums">{diff >= 0 ? "+" : ""}{formatCurrency(diff)}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend iconType="square" iconSize={10} formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                      <Area type="monotone" dataKey="Investido" stroke="#94a3b8" strokeWidth={1.5} fill="url(#gradInvested)" strokeDasharray="4 2" />
                      <Area type="monotone" dataKey="Valor atual" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Dialog: atualizar cotações em lote */}
            <Dialog open={bulkQuoteOpen} onOpenChange={setBulkQuoteOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Atualizar cotações</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {stockPositions.map((p) => {
                    const assetType = detectAssetType(p.ticker);
                    const assetBadge: Record<AssetType, string> = {
                      FII: "bg-purple-100 text-purple-800",
                      ETF: "bg-yellow-100 text-yellow-800",
                      BDR: "bg-orange-100 text-orange-800",
                      Ação: "bg-blue-100 text-blue-800",
                    };
                    return (
                      <div key={p.ticker} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-semibold text-sm">{p.ticker}</span>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${assetBadge[assetType]}`}>{assetType}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">médio {formatCurrency(p.avgPrice)} · {p.quantity} {assetType === "FII" || assetType === "ETF" ? "cotas" : "ações"}</p>
                        </div>
                        <div className="w-32">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={`Ex: ${p.avgPrice.toFixed(2)}`}
                            value={bulkPrices[p.ticker] ?? ""}
                            onChange={(e) => setBulkPrices((prev) => ({ ...prev, [p.ticker]: e.target.value }))}
                            className="h-8 text-sm text-right"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Ao salvar, um snapshot do portfólio será registrado automaticamente com a data de hoje.</p>
                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" onClick={() => setBulkQuoteOpen(false)}>Cancelar</Button>
                  <Button onClick={handleBulkSaveQuotes}>
                    <TrendingUp className="h-4 w-4 mr-1.5" />Salvar e registrar snapshot
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {sectorData.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>Diversificação por setor</CardTitle>
                      <CardDescription>Distribuição do valor atual da carteira</CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-sm font-bold tabular-nums">{formatCurrency(sectorData.reduce((s, d) => s + d.value, 0))}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col lg:flex-row gap-8 items-start">
                    {/* Donut clicável */}
                    <div className="relative shrink-0" style={{ width: 260, height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sectorData}
                            cx="50%"
                            cy="50%"
                            innerRadius={72}
                            outerRadius={108}
                            paddingAngle={2}
                            dataKey="value"
                            labelLine={false}
                            style={{ cursor: "pointer" }}
                            onClick={(d) => setSelectedSector((prev) => prev === (d as {name: string}).name ? null : (d as {name: string}).name)}
                            label={(props) => {
                              const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props as {
                                cx: number; cy: number; midAngle: number;
                                innerRadius: number; outerRadius: number; percent: number;
                              };
                              if (percent < 0.05) return null;
                              const RADIAN = Math.PI / 180;
                              const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + r * Math.cos(-midAngle * RADIAN);
                              const y = cy + r * Math.sin(-midAngle * RADIAN);
                              return (
                                <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
                                  fontSize={11} fontWeight="700">
                                  {(percent * 100).toFixed(0)}%
                                </text>
                              );
                            }}
                          >
                            {sectorData.map((entry, i) => (
                              <Cell
                                key={i}
                                fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                                opacity={selectedSector && selectedSector !== entry.name ? 0.35 : 1}
                                stroke={selectedSector === entry.name ? "#1e293b" : "none"}
                                strokeWidth={selectedSector === entry.name ? 2 : 0}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                                  <p className="font-semibold">{d.name}</p>
                                  <p className="text-muted-foreground">{formatCurrency(d.value)}</p>
                                  <p className="font-bold text-base">{d.pct.toFixed(1)}%</p>
                                  <p className="text-xs text-muted-foreground mt-1">Clique para ver as ações</p>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-xs text-muted-foreground">{sectorData.length} setores</p>
                        <p className="text-sm font-bold tabular-nums">
                          {formatCurrency(sectorData.reduce((s, d) => s + d.value, 0))}
                        </p>
                      </div>
                    </div>

                    {/* Legenda + painel de detalhe */}
                    <div className="flex-1 w-full space-y-2">
                      {sectorData.map((s, i) => {
                        const color = SECTOR_COLORS[i % SECTOR_COLORS.length];
                        const isSelected = selectedSector === s.name;
                        // ações que compõem esse setor
                        const sectorStocks = stockPositions
                          .filter((p) => detectSector(p.ticker) === s.name)
                          .map((p) => {
                            const cur = quoteMap.get(p.ticker);
                            const curValue = cur !== undefined ? cur * p.quantity : p.totalInvested;
                            const gain = cur !== undefined ? curValue - p.totalInvested : undefined;
                            const gainPct = gain !== undefined && p.totalInvested > 0 ? (gain / p.totalInvested) * 100 : undefined;
                            const assetType = detectAssetType(p.ticker);
                            return { ...p, curValue, gain, gainPct, assetType };
                          });
                        return (
                          <div key={s.name}>
                            <div
                              className={`space-y-1 rounded-lg px-2 py-1.5 transition-colors cursor-pointer ${isSelected ? "bg-muted/60" : "hover:bg-muted/30"}`}
                              onClick={() => setSelectedSector((prev) => prev === s.name ? null : s.name)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                  <span className="text-sm font-medium truncate">{s.name}</span>
                                  <span className="text-xs text-muted-foreground">({sectorStocks.length} ativo{sectorStocks.length !== 1 ? "s" : ""})</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-sm font-bold tabular-nums" style={{ color }}>{s.pct.toFixed(1)}%</span>
                                  <span className="text-xs text-muted-foreground tabular-nums w-24 text-right">{formatCurrency(s.value)}</span>
                                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isSelected ? "rotate-180" : ""}`} />
                                </div>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${s.pct}%`, backgroundColor: color }} />
                              </div>
                            </div>

                            {/* Painel de ações do setor */}
                            {isSelected && (
                              <div className="mt-1 mb-2 ml-4 rounded-xl border bg-background shadow-sm overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
                                      <th className="text-left py-2 px-3 font-medium">Ticker</th>
                                      <th className="text-right py-2 px-3 font-medium">Qtd</th>
                                      <th className="text-right py-2 px-3 font-medium">Preço médio</th>
                                      <th className="text-right py-2 px-3 font-medium">Cotação atual</th>
                                      <th className="text-right py-2 px-3 font-medium">Valor</th>
                                      <th className="text-right py-2 px-3 font-medium">Variação</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sectorStocks.map((p) => {
                                      const assetBadge: Record<AssetType, string> = {
                                        FII: "bg-purple-100 text-purple-800",
                                        ETF: "bg-yellow-100 text-yellow-800",
                                        BDR: "bg-orange-100 text-orange-800",
                                        Ação: "bg-blue-100 text-blue-800",
                                      };
                                      return (
                                        <tr key={p.ticker} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                          <td className="py-2.5 px-3">
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-bold">{p.ticker}</span>
                                              <span className={`text-xs px-1 py-0.5 rounded font-medium ${assetBadge[p.assetType]}`}>{p.assetType}</span>
                                            </div>
                                          </td>
                                          <td className="py-2.5 px-3 text-right tabular-nums">
                                            {p.quantity} {p.assetType === "FII" || p.assetType === "ETF" ? "cotas" : p.quantity === 1 ? "ação" : "ações"}
                                          </td>
                                          <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{formatCurrency(p.avgPrice)}</td>
                                          <td className="py-2.5 px-3 text-right tabular-nums">
                                            {quoteMap.has(p.ticker) ? formatCurrency(quoteMap.get(p.ticker)!) : <span className="text-muted-foreground text-xs">sem cotação</span>}
                                          </td>
                                          <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-blue-600">{formatCurrency(p.curValue)}</td>
                                          <td className="py-2.5 px-3 text-right tabular-nums">
                                            {p.gainPct !== undefined ? (
                                              <span className={`font-semibold ${p.gainPct >= 0 ? "text-green-600" : "text-destructive"}`}>
                                                {p.gainPct >= 0 ? "+" : ""}{p.gainPct.toFixed(2)}%
                                              </span>
                                            ) : <span className="text-muted-foreground text-xs">—</span>}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t bg-muted/20">
                                      <td className="py-2 px-3 text-xs text-muted-foreground font-semibold" colSpan={4}>Total do setor</td>
                                      <td className="py-2 px-3 text-right tabular-nums font-bold text-blue-700">{formatCurrency(s.value)}</td>
                                      <td className="py-2 px-3 text-right tabular-nums font-bold" style={{ color }}>
                                        {s.pct.toFixed(1)}% da carteira
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setHistoryOpen((v) => !v)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Histórico de operações</CardTitle>
                    <CardDescription>{stockTrades.length} registro{stockTrades.length !== 1 ? "s" : ""}</CardDescription>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${historyOpen ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
              {historyOpen && (
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
                              onClick={(e) => { e.stopPropagation(); handleDeleteStock(trade.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
