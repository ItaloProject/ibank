"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus, Trash2, TrendingUp, ArrowUpCircle, ArrowDownCircle, Sparkles,
  BarChart3, LineChart, AlertTriangle, Pencil, ChevronDown,
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
} from "recharts";
import {
  getInvestmentAccounts, createInvestmentAccountWithTurbo,
  updateAccountBalance, deleteInvestmentAccount, renameInvestmentAccount, updateTurboSettings,
  getInvestments, createInvestment, deleteInvestment,
  getStockTrades, createStockTrade, deleteStockTrade,
  getStockQuotes, upsertStockQuote, type StockQuote,
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
    is_turbo: false, cdi_percent: "", max_rendimento: "", valor_liquido: "",
  });
  const [historyOpen, setHistoryOpen] = useState(false);

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
    is_turbo: false, cdi_percent: "", max_rendimento: "", valor_liquido: "",
  });
  const [invLiquido, setInvLiquido] = useState("");

  const [stockForm, setStockForm] = useState({
    ticker: "",
    quantity: "",
    price_per_share: "",
    notes: "",
    date: format(now, "yyyy-MM-dd"),
  });

  const load = useCallback(async () => {
    try {
      const [loadedAccounts, loadedInvestments, loadedStocks, loadedQuotes] = await Promise.all([
        getInvestmentAccounts(),
        getInvestments(),
        getStockTrades(),
        getStockQuotes(),
      ]);
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
      if (acc.is_turbo && invLiquido) {
        await updateTurboSettings(invForm.account_id, { valor_liquido: parseFloat(invLiquido) });
      }
    }
    setInvOpen(false);
    setInvLiquido("");
    setInvForm({ account_id: invForm.account_id, type: "deposito", amount: "", description: "", date: format(now, "yyyy-MM-dd") });
    load();
  }

  async function addAccount() {
    if (!accForm.name) return;
    await createInvestmentAccountWithTurbo({
      name: accForm.name,
      institution: accForm.institution,
      is_turbo: accForm.is_turbo,
      cdi_percent: accForm.is_turbo && accForm.cdi_percent ? parseFloat(accForm.cdi_percent) : null,
      max_rendimento: accForm.is_turbo && accForm.max_rendimento ? parseFloat(accForm.max_rendimento) : null,
      valor_liquido: accForm.is_turbo && accForm.valor_liquido ? parseFloat(accForm.valor_liquido) : null,
    });
    setAccOpen(false);
    setAccForm({ name: "", institution: "", is_turbo: false, cdi_percent: "", max_rendimento: "", valor_liquido: "" });
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

  async function handleRenameAccount() {
    if (!renameForm.name.trim()) return;
    await renameInvestmentAccount(renameForm.id, renameForm.name.trim(), renameForm.institution.trim());
    await updateTurboSettings(renameForm.id, {
      is_turbo: renameForm.is_turbo,
      cdi_percent: renameForm.is_turbo && renameForm.cdi_percent ? parseFloat(renameForm.cdi_percent) : null,
      max_rendimento: renameForm.is_turbo && renameForm.max_rendimento ? parseFloat(renameForm.max_rendimento) : null,
      valor_liquido: renameForm.is_turbo && renameForm.valor_liquido ? parseFloat(renameForm.valor_liquido) : null,
    });
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
                    <div className="space-y-1.5 p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">TURBO · {selAcc.cdi_percent ? `${selAcc.cdi_percent}% CDI` : ""}</p>
                      <Label className="text-sm">Valor líquido atual (R$)</Label>
                      <Input
                        type="number"
                        placeholder={selAcc.valor_liquido ? String(selAcc.valor_liquido) : "Ex: 5086.01"}
                        value={invLiquido}
                        onChange={(e) => setInvLiquido(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Atualize o valor líquido a cada rendimento mensal</p>
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

            {accounts.length > 0 && (
              <InvestmentRates balances={balancesByCategory} userId={getCurrentUser()} />
            )}
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription>{account.is_turbo ? "Total bruto" : "Saldo atual"}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-green-600 tabular-nums">{formatCurrency(computedBalance)}</p>
                        {account.institution && (
                          <p className="text-xs text-muted-foreground mt-1">{account.institution}</p>
                        )}
                      </CardContent>
                    </Card>
                    {account.is_turbo ? (
                      <Card className="border-blue-200 bg-blue-50/50">
                        <CardHeader className="pb-2"><CardDescription className="text-blue-700">Valor líquido</CardDescription></CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-blue-700 tabular-nums">
                            {account.valor_liquido != null ? formatCurrency(account.valor_liquido) : "—"}
                          </p>
                          {account.valor_liquido != null && computedBalance > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              IOF/IR est. {formatCurrency(computedBalance - account.valor_liquido)}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardHeader className="pb-2"><CardDescription>Total depositado</CardDescription></CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold tabular-nums">
                            {formatCurrency(accountInvestments.filter((i) => i.type === "deposito").reduce((s, i) => s + i.amount, 0))}
                          </p>
                        </CardContent>
                      </Card>
                    )}
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
                  <CardDescription>Consolidado por ticker · clique no lápis para atualizar a cotação</CardDescription>
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

            {sectorData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Diversificação por setor</CardTitle>
                  <CardDescription>Distribuição do valor atual da carteira</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="w-full md:w-64 h-64 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sectorData}
                            cx="50%"
                            cy="50%"
                            innerRadius="55%"
                            outerRadius="80%"
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {sectorData.map((_, i) => (
                              <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [
                              `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      {sectorData.map((s, i) => (
                        <div key={s.name} className="flex items-center gap-3">
                          <span
                            className="inline-block h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                          />
                          <span className="flex-1 text-sm">{s.name}</span>
                          <span className="text-sm font-medium tabular-nums">{s.pct.toFixed(1)}%</span>
                          <span className="text-xs text-muted-foreground tabular-nums w-28 text-right">
                            {formatCurrency(s.value)}
                          </span>
                        </div>
                      ))}
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
