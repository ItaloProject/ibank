"use client";

import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import {
  X, Signal, Wifi, BatteryFull, Landmark, Calculator, Zap, Shield,
  ArrowUpRight, ArrowDownRight, Check, ChevronLeft, Pencil, Home, ChevronRight,
  CreditCard, CalendarRange, Layers, TrendingUp, Wallet, Receipt,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { detectAssetType } from "@/lib/stock-utils";
import { CASH_ACCOUNT_NAME } from "@/lib/account-groups";
import type { StockTrade, Investment } from "@/types/database";
import {
  createStockTrade,
  createInvestment,
  updateAccountBalance,
  createInvestmentAccount,
} from "@/lib/api";
import {
  SimulatorFinancePanel,
  type FinancePanelId,
} from "@/components/investimentos/simulator-finance-panels";
import {
  SimulatorInvestFlow,
  DEFAULT_TESOURO_PRODUCTS,
  type MarketSection,
  type TesouroProduct,
} from "@/components/investimentos/simulator-invest-flow";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type Asset = {
  ticker: string;
  name: string;
  category: "Ação" | "FII" | "Renda Fixa";
  price: number;
  variation: number; // variação simulada desde a compra, ex 0.023 = +2,3%
  color: string;
  isReal?: boolean;
};

type Holding = {
  ticker: string;
  quantity: number;
  avgPrice: number;
};

type RealAccountItem = {
  id: string;
  nome: string;
  instituicao: string;
  valor: number;
  isTurbo: boolean;
  cdiPercent: number | null;
  maxRendimento: number | null;
};

type StockPosition = { ticker: string; quantity: number; totalInvested: number; avgPrice: number };

const ASSETS: Asset[] = [
  { ticker: "PETR4", name: "Petrobras PN",       category: "Ação", price: 38.5,  variation: 0.021,  color: "#22c55e" },
  { ticker: "VALE3", name: "Vale ON",             category: "Ação", price: 61.2,  variation: -0.014, color: "#f97316" },
  { ticker: "ITUB4", name: "Itaú Unibanco PN",    category: "Ação", price: 34.1,  variation: 0.008,  color: "#f59e0b" },
  { ticker: "BBAS3", name: "Banco do Brasil ON",  category: "Ação", price: 22.5,  variation: 0.04,   color: "#3b82f6" },
  { ticker: "WEGE3", name: "WEG ON",              category: "Ação", price: 48.2,  variation: 0.015,  color: "#06b6d4" },
  { ticker: "MXRF11", name: "Maxi Renda",         category: "FII",  price: 10.15, variation: 0.012,  color: "#a855f7" },
  { ticker: "HGLG11", name: "CSHG Logística",     category: "FII",  price: 165.4, variation: 0.019,  color: "#8b5cf6" },
  { ticker: "XPML11", name: "XP Malls",           category: "FII",  price: 98.5,  variation: 0.008,  color: "#ec4899" },
];

/** Máscara BRL: dígitos → centavos → "2.000,00" */
function formatBRLMask(digits: string): string {
  const cleaned = digits.replace(/\D/g, "").slice(0, 12);
  const cents = parseInt(cleaned || "0", 10);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseBRLMask(masked: string): number {
  const cents = parseInt(masked.replace(/\D/g, "") || "0", 10);
  return cents / 100;
}

function cashToMaskDigits(value: number): string {
  return String(Math.round(Math.max(0, value) * 100));
}

function formatQty(qty: number) {
  if (Number.isInteger(qty)) return String(qty);
  return qty.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(target);
  const prevTarget = useRef(target);
  useEffect(() => {
    const start = prevTarget.current;
    prevTarget.current = target;
    let raf: number;
    const t0 = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(start + (target - start) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);
  return value;
}

function PhoneStatusBar() {
  const [time, setTime] = useState("");
  useEffect(() => {
    function update() {
      setTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    }
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center justify-between px-6 pt-3 pb-1 text-white text-[13px] font-semibold shrink-0">
      <span>{time}</span>
      <div className="flex items-center gap-1.5">
        <Signal className="h-3.5 w-3.5" />
        <Wifi className="h-3.5 w-3.5" />
        <BatteryFull className="h-4 w-4" />
      </div>
    </div>
  );
}

function CaixinhaRow({
  title,
  subtitle,
  value,
  icon: Icon,
  tone,
  onClick,
}: {
  title: string;
  subtitle: string;
  value: number;
  icon: ElementType;
  tone: "amber" | "blue" | "emerald" | "rose" | "violet" | "cyan";
  onClick: () => void;
}) {
  const tones = {
    amber: {
      border: "border-amber-500/25",
      bg: "bg-amber-500/[0.07] hover:bg-amber-500/[0.12]",
      iconBg: "bg-amber-500/15",
      icon: "text-amber-400",
    },
    blue: {
      border: "border-blue-500/25",
      bg: "bg-blue-500/[0.07] hover:bg-blue-500/[0.12]",
      iconBg: "bg-blue-500/15",
      icon: "text-blue-400",
    },
    emerald: {
      border: "border-emerald-500/25",
      bg: "bg-emerald-500/[0.07] hover:bg-emerald-500/[0.12]",
      iconBg: "bg-emerald-500/15",
      icon: "text-emerald-400",
    },
    rose: {
      border: "border-rose-500/25",
      bg: "bg-rose-500/[0.07] hover:bg-rose-500/[0.12]",
      iconBg: "bg-rose-500/15",
      icon: "text-rose-400",
    },
    violet: {
      border: "border-violet-500/25",
      bg: "bg-violet-500/[0.07] hover:bg-violet-500/[0.12]",
      iconBg: "bg-violet-500/15",
      icon: "text-violet-400",
    },
    cyan: {
      border: "border-cyan-500/25",
      bg: "bg-cyan-500/[0.07] hover:bg-cyan-500/[0.12]",
      iconBg: "bg-cyan-500/15",
      icon: "text-cyan-400",
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border ${tones.border} ${tones.bg} p-3 grid grid-cols-[2rem_minmax(0,1fr)_auto_1rem] items-center gap-x-2.5 transition-colors`}
    >
      <span className={`h-8 w-8 rounded-full ${tones.iconBg} flex items-center justify-center`}>
        <Icon className={`h-3.5 w-3.5 ${tones.icon}`} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-white leading-tight truncate">{title}</p>
        <p className="text-[10px] text-white/40 leading-tight mt-0.5 truncate">{subtitle}</p>
      </div>
      <p className="text-[13px] font-extrabold tabular-nums text-white text-right whitespace-nowrap">
        {formatCurrency(value)}
      </p>
      <ChevronRight className="h-4 w-4 text-white/25 justify-self-end" />
    </button>
  );
}

function CaixinhaHeader({ label, total }: { label: string; total: number }) {
  const animated = useCountUp(total, 1200);
  return (
    <div className="text-center pt-2 pb-1">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2">{label}</p>
      <p className="text-[30px] font-black tabular-nums bg-gradient-to-br from-white via-violet-200 to-blue-300 bg-clip-text text-transparent leading-none">
        {formatCurrency(animated)}
      </p>
    </div>
  );
}

function isTesouroAccount(name: string) {
  const n = name.toLowerCase();
  return (
    n.includes("tesouro") ||
    n.includes("selic") ||
    n.includes("prefix") ||
    n.includes("ipca") ||
    n.includes("ntn") ||
    n.includes("ltn") ||
    n.includes("lft")
  );
}

function PortfolioSection({
  title,
  children,
  empty,
}: {
  title: string;
  children: ReactNode;
  empty?: boolean;
}) {
  if (empty) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40">{title}</p>
      {children}
    </div>
  );
}

function RealAccountList({
  items,
  onSelect,
}: {
  items: RealAccountItem[];
  onSelect: (item: RealAccountItem) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.07] hover:border-white/20 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{item.nome}</p>
            {item.instituicao && (
              <p className="text-[10px] text-white/40 truncate">{item.instituicao}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <p className="text-sm font-extrabold tabular-nums text-white">
              {formatCurrency(item.valor)}
            </p>
            <ChevronRight className="h-4 w-4 text-white/25" />
          </div>
        </button>
      ))}
    </div>
  );
}

type HoldingRowItem = {
  ticker: string;
  name: string;
  typeLabel: string;
  quantity: number;
  value: number;
  gain: number;
  gainPct: number;
  color: string;
};

function HoldingList({
  items,
  onSelect,
}: {
  items: HoldingRowItem[];
  onSelect: (ticker: string) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button
          key={item.ticker}
          type="button"
          onClick={() => onSelect(item.ticker)}
          className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.07] hover:border-white/20 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: item.color }}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{item.ticker}</p>
              <p className="text-[10px] text-white/40 truncate">
                {item.typeLabel} · {formatQty(item.quantity)} un.
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-extrabold tabular-nums text-white">
              {formatCurrency(item.value)}
            </p>
            <p
              className={`text-[10px] font-semibold tabular-nums ${
                item.gain >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {item.gainPct >= 0 ? "+" : ""}
              {item.gainPct.toFixed(1)}%
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

export type InvestorLiveViewProps = {
  grandTotal: number;
  turboAccountsReal: RealAccountItem[];
  emergenciaAccountsReal: RealAccountItem[];
  investimentosAccountsReal: RealAccountItem[];
  stockPositions: StockPosition[];
  quoteMap: Map<string, number>;
  stockTrades: StockTrade[];
  investments: Investment[];
  cashAccountId: string | null;
  cashBalance: number;
  onRefresh: () => Promise<void> | void;
  onClose: () => void;
};

export function InvestorLiveView({
  grandTotal,
  turboAccountsReal,
  emergenciaAccountsReal,
  investimentosAccountsReal,
  stockPositions,
  quoteMap,
  stockTrades,
  investments,
  cashAccountId,
  cashBalance,
  onRefresh,
  onClose,
}: InvestorLiveViewProps) {
  const [tab, setTab] = useState<"inicio" | "investimentos" | "simular">("inicio");
  const [focusGroup, setFocusGroup] = useState<"all" | "turbo" | "emergencia" | "investimentos">("all");
  const [investSubPage, setInvestSubPage] = useState<"tesouro" | "acoes" | null>(null);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketSection, setMarketSection] = useState<MarketSection>("hub");
  const cash = cashBalance;
  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const [financePanel, setFinancePanel] = useState<FinancePanelId | null>(null);
  const [confirmedFlash, setConfirmedFlash] = useState(false);
  const [selectedFixedIncome, setSelectedFixedIncome] = useState<RealAccountItem | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const holdings: Holding[] = useMemo(
    () =>
      stockPositions
        .filter((p) => p.quantity > 0)
        .map((p) => ({ ticker: p.ticker, quantity: p.quantity, avgPrice: p.avgPrice })),
    [stockPositions]
  );

  const ownedTickers = useMemo(() => new Set(stockPositions.map((p) => p.ticker)), [stockPositions]);

  const turboAccountsLive = turboAccountsReal;
  const emergenciaAccountsLive = emergenciaAccountsReal;
  const investimentosAccountsLive = investimentosAccountsReal;

  function openMarket(section: MarketSection = "hub") {
    setFinancePanel(null);
    setFocusGroup("all");
    setInvestSubPage(null);
    setSelectedFixedIncome(null);
    setSelectedTicker(null);
    setMarketSection(section);
    setMarketOpen(true);
    setTab("investimentos");
  }

  function goToInvestGroup(group: "turbo" | "emergencia" | "investimentos") {
    setFinancePanel(null);
    setMarketOpen(false);
    setMarketSection("hub");
    setInvestSubPage(null);
    setSelectedFixedIncome(null);
    setSelectedTicker(null);
    setFocusGroup(group);
    setTab("investimentos");
  }

  const liveAssets = useMemo(() => {
    const knownTickers = new Set(ASSETS.map((a) => a.ticker));
    const extraColors = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4"];
    const base: Asset[] = ASSETS.map((a) => {
      const realPrice = quoteMap.get(a.ticker);
      return realPrice !== undefined ? { ...a, price: realPrice, variation: 0, isReal: true } : { ...a, isReal: false };
    });

    // Tickers fora do catálogo: posições reais (ex.: compras personalizadas)
    const extraByTicker = new Map<string, number>();
    for (const p of stockPositions) {
      if (!knownTickers.has(p.ticker)) extraByTicker.set(p.ticker, p.avgPrice);
    }

    const extra: Asset[] = [...extraByTicker.entries()].map(([ticker, avgPrice], i) => {
      const kind = detectAssetType(ticker);
      return {
        ticker,
        name: ticker,
        category: kind === "FII" ? ("FII" as const) : ("Ação" as const),
        price: quoteMap.get(ticker) ?? avgPrice,
        variation: 0,
        color: extraColors[i % extraColors.length],
        isReal: quoteMap.has(ticker),
      };
    });
    return [...base, ...extra];
  }, [quoteMap, stockPositions]);

  const investedValue = useMemo(() => {
    return holdings.reduce((sum, h) => {
      const asset = liveAssets.find((a) => a.ticker === h.ticker);
      if (!asset) return sum;
      return sum + h.quantity * asset.price * (1 + asset.variation);
    }, 0);
  }, [holdings, liveAssets]);

  const investedCost = useMemo(
    () => holdings.reduce((sum, h) => sum + h.quantity * h.avgPrice, 0),
    [holdings]
  );
  const totalGain = investedValue - investedCost;
  const totalGainPct = investedCost > 0 ? (totalGain / investedCost) * 100 : 0;

  const selectedHolding = useMemo(() => {
    if (!selectedTicker) return null;
    const h = holdings.find((x) => x.ticker === selectedTicker);
    const asset = liveAssets.find((a) => a.ticker === selectedTicker);
    if (!h || !asset) return null;
    const value = h.quantity * asset.price * (1 + asset.variation);
    const cost = h.quantity * h.avgPrice;
    const gain = value - cost;
    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
    return { h, asset, value, cost, gain, gainPct };
  }, [selectedTicker, holdings, liveAssets]);

  const turboTotal = useMemo(() => turboAccountsLive.reduce((s, x) => s + x.valor, 0), [turboAccountsLive]);
  const emergenciaTotal = useMemo(
    () => emergenciaAccountsLive.reduce((s, x) => s + x.valor, 0),
    [emergenciaAccountsLive]
  );
  const investimentosFixedTotal = useMemo(
    () => investimentosAccountsLive.reduce((s, x) => s + x.valor, 0),
    [investimentosAccountsLive]
  );
  /** Valor da caixinha Investimentos (sem o caixa livre do simulador). */
  const caixinhaInvestimentos = investimentosFixedTotal + investedValue;
  /** Soma das três caixinhas exibidas no Início. */
  const totalCaixinhas = turboTotal + emergenciaTotal + caixinhaInvestimentos;
  /** Conta + investimentos (visão de patrimônio do Início). */
  const patrimonioTotal = cash + totalCaixinhas;

  /** Movimentações reais recentes (compras de ações + aportes em caixinhas). */
  const homeMovements = useMemo(() => {
    type Mov = {
      id: string;
      title: string;
      subtitle: string;
      amount: number;
      date: string;
    };
    const items: Mov[] = [];

    for (const t of stockTrades) {
      if (t.type !== "compra") continue;
      items.push({
        id: `stock-${t.id}`,
        title: `Compra ${t.ticker}`,
        subtitle: `${formatQty(t.quantity)} un. · Ações/FIIs`,
        amount: t.total_amount,
        date: t.date,
      });
    }

    const aporteLookup = new Map(
      [...turboAccountsReal, ...emergenciaAccountsReal, ...investimentosAccountsReal].map((a) => [
        a.id,
        a,
      ])
    );
    for (const inv of investments) {
      if (inv.type !== "deposito" || inv.account_id === cashAccountId) continue;
      const acc = aporteLookup.get(inv.account_id);
      if (!acc) continue;
      const group = acc.isTurbo
        ? "Turbo"
        : emergenciaAccountsReal.some((e) => e.id === inv.account_id)
          ? "EME"
          : "Investimentos";
      items.push({
        id: `inv-${inv.id}`,
        title: `Aporte · ${acc.nome}`,
        subtitle: group,
        amount: inv.amount,
        date: inv.date,
      });
    }

    return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 6);
  }, [stockTrades, investments, cashAccountId, turboAccountsReal, emergenciaAccountsReal, investimentosAccountsReal]);

  const tesouroAccounts = useMemo(
    () => investimentosAccountsLive.filter((a) => isTesouroAccount(a.nome)),
    [investimentosAccountsLive]
  );
  const outrasRendaFixa = useMemo(
    () => investimentosAccountsLive.filter((a) => !isTesouroAccount(a.nome)),
    [investimentosAccountsLive]
  );

  const portfolioHoldings = useMemo((): HoldingRowItem[] => {
    const rows: HoldingRowItem[] = [];
    for (const h of holdings) {
      const asset = liveAssets.find((a) => a.ticker === h.ticker);
      if (!asset) continue;
      const price = asset.price * (1 + asset.variation);
      const value = h.quantity * price;
      const cost = h.quantity * h.avgPrice;
      const gain = value - cost;
      const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
      rows.push({
        ticker: h.ticker,
        name: asset.name,
        typeLabel: detectAssetType(h.ticker),
        quantity: h.quantity,
        value,
        gain,
        gainPct,
        color: asset.color,
      });
    }
    return rows.sort((a, b) => b.value - a.value);
  }, [holdings, liveAssets]);

  const homeTopHoldings = useMemo(() => portfolioHoldings.slice(0, 3), [portfolioHoldings]);

  const acoesHoldings = useMemo(
    () =>
      portfolioHoldings.filter((h) => {
        const t = detectAssetType(h.ticker);
        return t === "Ação" || t === "BDR";
      }),
    [portfolioHoldings]
  );
  const fiiHoldings = useMemo(
    () => portfolioHoldings.filter((h) => detectAssetType(h.ticker) === "FII"),
    [portfolioHoldings]
  );
  const etfHoldings = useMemo(
    () => portfolioHoldings.filter((h) => detectAssetType(h.ticker) === "ETF"),
    [portfolioHoldings]
  );

  const tesouroTotal = useMemo(
    () => tesouroAccounts.reduce((s, a) => s + a.valor, 0) + outrasRendaFixa.reduce((s, a) => s + a.valor, 0),
    [tesouroAccounts, outrasRendaFixa]
  );
  const acoesPageHoldings = useMemo(
    () => [...acoesHoldings, ...fiiHoldings, ...etfHoldings],
    [acoesHoldings, fiiHoldings, etfHoldings]
  );
  const acoesPageTotal = useMemo(
    () => acoesPageHoldings.reduce((s, h) => s + h.value, 0),
    [acoesPageHoldings]
  );

  const caixinhaPageMeta = useMemo(() => {
    if (focusGroup === "turbo") {
      return {
        title: "Turbo",
        subtitle: `${turboAccountsReal.length} conta${turboAccountsReal.length !== 1 ? "s" : ""}`,
        total: turboTotal,
      };
    }
    if (focusGroup === "emergencia") {
      return {
        title: "EME",
        subtitle: `${emergenciaAccountsReal.length} conta${emergenciaAccountsReal.length !== 1 ? "s" : ""}`,
        total: emergenciaTotal,
      };
    }
    if (focusGroup === "investimentos") {
      return {
        title: "Investimentos",
        subtitle: `${investimentosAccountsReal.length + holdings.length} ativo${
          investimentosAccountsReal.length + holdings.length !== 1 ? "s" : ""
        }`,
        total: caixinhaInvestimentos,
      };
    }
    return null;
  }, [
    focusGroup,
    turboAccountsReal.length,
    emergenciaAccountsReal.length,
    investimentosAccountsReal.length,
    holdings.length,
    turboTotal,
    emergenciaTotal,
    caixinhaInvestimentos,
  ]);

  const animatedCash = useCountUp(cash);

  const [savingCash, setSavingCash] = useState(false);

  function startEditCash() {
    setCashInput(formatBRLMask(cashToMaskDigits(cash)));
    setEditingCash(true);
  }

  async function commitEditCash() {
    if (!editingCash) return;
    setEditingCash(false);
    const v = parseBRLMask(cashInput);
    if (isNaN(v) || v < 0 || Math.abs(v - cash) < 0.005) return;
    const delta = v - cash;
    setSavingCash(true);
    try {
      let id = cashAccountId;
      if (!id) {
        const acc = await createInvestmentAccount({ name: CASH_ACCOUNT_NAME, institution: "Carteira" });
        id = acc.id;
      }
      await createInvestment({
        account_id: id,
        type: delta > 0 ? "deposito" : "retirada",
        amount: Math.abs(delta),
        description: "Ajuste de saldo via Simulador",
        date: today(),
      });
      await onRefresh();
    } catch (err) {
      console.error("Erro ao ajustar saldo:", err);
    } finally {
      setSavingCash(false);
    }
  }

  function onCashMaskChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 12);
    setCashInput(formatBRLMask(digits));
  }

  const marketCatalog = useMemo(() => {
    return liveAssets
      .filter((a) => a.category === "Ação" || a.category === "FII")
      .map((a) => ({
        ticker: a.ticker,
        name: a.name,
        category: a.category === "FII" ? ("FII" as const) : ("Ação" as const),
        price: a.price * (1 + a.variation),
        variation: a.variation,
        color: a.color,
      }));
  }, [liveAssets]);

  function flashConfirm() {
    setConfirmedFlash(true);
    setTimeout(() => setConfirmedFlash(false), 1600);
  }

  async function handleBuyStock(ticker: string, _name: string, price: number, amount: number) {
    if (!cashAccountId || amount <= 0 || amount > cash + 0.001 || price <= 0) return;
    const qty = amount / price;
    await createStockTrade({
      ticker,
      type: "compra",
      quantity: qty,
      price_per_share: price,
      total_amount: amount,
      date: today(),
    });
    await createInvestment({
      account_id: cashAccountId,
      type: "retirada",
      amount,
      description: `Compra ${ticker}`,
      date: today(),
    });
    await onRefresh();
    flashConfirm();
  }

  async function handleBuyTesouro(product: TesouroProduct, amount: number) {
    if (!cashAccountId || amount <= 0 || amount > cash + 0.001) return;
    const existing = investimentosAccountsReal.find((a) => a.nome === product.nome);
    let accountId: string;
    if (existing) {
      accountId = existing.id;
      await createInvestment({
        account_id: accountId,
        type: "deposito",
        amount,
        description: "Compra Tesouro Direto",
        date: today(),
      });
      await updateAccountBalance(accountId, existing.valor + amount);
    } else {
      const acc = await createInvestmentAccount({ name: product.nome, institution: product.taxa });
      accountId = acc.id;
      await createInvestment({
        account_id: accountId,
        type: "deposito",
        amount,
        description: "Compra Tesouro Direto",
        date: today(),
      });
      await updateAccountBalance(accountId, amount);
    }
    await createInvestment({
      account_id: cashAccountId,
      type: "retirada",
      amount,
      description: `Compra ${product.nome}`,
      date: today(),
    });
    await onRefresh();
    flashConfirm();
  }

  async function handleAporte(accountId: string, amount: number) {
    if (!cashAccountId || amount <= 0 || amount > cash + 0.001) return;
    const acc = [...turboAccountsReal, ...emergenciaAccountsReal, ...investimentosAccountsReal].find(
      (a) => a.id === accountId
    );
    if (!acc) return;
    await createInvestment({
      account_id: accountId,
      type: "deposito",
      amount,
      description: "Aporte via Simulador",
      date: today(),
    });
    await updateAccountBalance(accountId, acc.valor + amount);
    await createInvestment({
      account_id: cashAccountId,
      type: "retirada",
      amount,
      description: `Aporte · ${acc.nome}`,
      date: today(),
    });
    await onRefresh();
    flashConfirm();
  }

  const [simAporteInicial, setSimAporteInicial] = useState(() => Math.round(grandTotal) || 1000);
  const [simAporteMensal, setSimAporteMensal] = useState(300);
  const [simMeses, setSimMeses] = useState(24);
  const [simTaxa, setSimTaxa] = useState(0.9); // % ao mês
  const simMax = Math.max(20000, Math.ceil((grandTotal * 2) / 1000) * 1000 || 20000);

  const simProjection = useMemo(() => {
    const rate = simTaxa / 100;
    const points: { month: number; value: number }[] = [];
    let value = simAporteInicial;
    points.push({ month: 0, value });
    for (let m = 1; m <= simMeses; m++) {
      value = value * (1 + rate) + simAporteMensal;
      points.push({ month: m, value });
    }
    return points;
  }, [simAporteInicial, simAporteMensal, simMeses, simTaxa]);

  const simFinalValue = simProjection[simProjection.length - 1]?.value ?? 0;
  const simTotalAportado = simAporteInicial + simAporteMensal * simMeses;
  const simTotalRendimento = simFinalValue - simTotalAportado;
  const maxSimValue = Math.max(1, ...simProjection.map((p) => p.value));

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center select-none p-0 sm:p-4">
      <div className="relative w-full h-full sm:h-[min(844px,92dvh)] sm:aspect-[390/844] sm:w-auto sm:max-w-[92vw] sm:rounded-[3rem] sm:border-[8px] sm:border-zinc-800 overflow-hidden bg-[#05050a]">
        {/* Mesh de fundo */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-violet-600/25 blur-[90px]" />
          <div className="absolute top-1/3 -right-24 h-64 w-64 rounded-full bg-blue-500/20 blur-[90px]" />
          <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-emerald-500/15 blur-[100px]" />
        </div>

        <div className="relative h-full flex flex-col">
          <PhoneStatusBar />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">MUVO · Simulador</span>
            </div>
            <button
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Conteúdo scrollável */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin-dark px-5 pb-4 relative">
            {!marketOpen && tab === "investimentos" && focusGroup === "all" && (
              <div className="space-y-4">
                <CaixinhaHeader label="Total das caixinhas" total={totalCaixinhas} />

                <button
                  type="button"
                  onClick={() => openMarket("hub")}
                  className="w-full rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-600/30 via-fuchsia-500/20 to-emerald-500/25 p-4 text-left hover:from-violet-600/40 hover:to-emerald-500/35 transition-colors"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200/80 mb-1">
                    Aplicar saldo
                  </p>
                  <p className="text-lg font-black text-white">
                    Investir {formatCurrency(cash)}
                  </p>
                  <p className="text-[11px] text-white/50 mt-1">
                    Compre ações, Tesouro Direto ou aporte nas caixinhas.
                  </p>
                </button>

                <div className="space-y-2">
                  <CaixinhaRow
                    title="Turbo"
                    subtitle={`${turboAccountsLive.length} conta${turboAccountsLive.length !== 1 ? "s" : ""}`}
                    value={turboTotal}
                    icon={Zap}
                    tone="amber"
                    onClick={() => setFocusGroup("turbo")}
                  />
                  <CaixinhaRow
                    title="EME"
                    subtitle={`${emergenciaAccountsLive.length} conta${emergenciaAccountsLive.length !== 1 ? "s" : ""}`}
                    value={emergenciaTotal}
                    icon={Shield}
                    tone="blue"
                    onClick={() => setFocusGroup("emergencia")}
                  />
                  <CaixinhaRow
                    title="Investimentos"
                    subtitle={`${investimentosAccountsLive.length + holdings.length} ativo${
                      investimentosAccountsLive.length + holdings.length !== 1 ? "s" : ""
                    }`}
                    value={caixinhaInvestimentos}
                    icon={Landmark}
                    tone="emerald"
                    onClick={() => {
                      setInvestSubPage(null);
                      setFocusGroup("investimentos");
                    }}
                  />
                </div>
              </div>
            )}

            {!marketOpen && tab === "investimentos" && caixinhaPageMeta && !investSubPage && (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => {
                    setFocusGroup("all");
                    setInvestSubPage(null);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/55 hover:text-white/80"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Caixinhas
                </button>

                <div className="text-center pt-1 pb-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 mb-1">
                    {caixinhaPageMeta.title}
                  </p>
                  <p className="text-[11px] text-white/35 mb-2">{caixinhaPageMeta.subtitle}</p>
                  <p className="text-[28px] font-black tabular-nums bg-gradient-to-br from-white via-violet-200 to-blue-300 bg-clip-text text-transparent leading-none">
                    {formatCurrency(caixinhaPageMeta.total)}
                  </p>
                </div>

                <div className="space-y-5">
                  {focusGroup === "turbo" && (
                    turboAccountsLive.length > 0 ? (
                      <PortfolioSection title="Contas">
                        <RealAccountList
                          items={turboAccountsLive}
                          onSelect={setSelectedFixedIncome}
                        />
                      </PortfolioSection>
                    ) : (
                      <p className="text-sm text-white/40 text-center py-8">Nenhuma conta turbo.</p>
                    )
                  )}

                  {focusGroup === "emergencia" && (
                    emergenciaAccountsLive.length > 0 ? (
                      <PortfolioSection title="Contas">
                        <RealAccountList
                          items={emergenciaAccountsLive}
                          onSelect={setSelectedFixedIncome}
                        />
                      </PortfolioSection>
                    ) : (
                      <p className="text-sm text-white/40 text-center py-8">
                        Nenhuma conta de emergência.
                      </p>
                    )
                  )}

                  {focusGroup === "investimentos" && (
                    <div className="space-y-2">
                      <CaixinhaRow
                        title="Tesouro Direto"
                        subtitle={`${tesouroAccounts.length + outrasRendaFixa.length} título${
                          tesouroAccounts.length + outrasRendaFixa.length !== 1 ? "s" : ""
                        }`}
                        value={tesouroTotal}
                        icon={Landmark}
                        tone="emerald"
                        onClick={() => setInvestSubPage("tesouro")}
                      />
                      <CaixinhaRow
                        title="Ações"
                        subtitle={`${acoesPageHoldings.length} ativo${
                          acoesPageHoldings.length !== 1 ? "s" : ""
                        }`}
                        value={acoesPageTotal}
                        icon={TrendingUp}
                        tone="violet"
                        onClick={() => setInvestSubPage("acoes")}
                      />
                      <button
                        type="button"
                        onClick={() => openMarket("hub")}
                        className="w-full rounded-xl border border-dashed border-white/20 py-3 text-xs font-bold text-white/60 hover:text-white hover:border-white/35 transition-colors"
                      >
                        + Aplicar saldo disponível
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!marketOpen && tab === "investimentos" && focusGroup === "investimentos" && investSubPage === "tesouro" && (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => setInvestSubPage(null)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/55 hover:text-white/80"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Investimentos
                </button>

                <div className="text-center pt-1 pb-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2">
                    Tesouro Direto
                  </p>
                  <p className="text-[28px] font-black tabular-nums bg-gradient-to-br from-white via-violet-200 to-blue-300 bg-clip-text text-transparent leading-none">
                    {formatCurrency(tesouroTotal)}
                  </p>
                </div>

                {tesouroAccounts.length === 0 && outrasRendaFixa.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-8">Nenhum título cadastrado.</p>
                ) : (
                  <div className="space-y-5">
                    <PortfolioSection title="Títulos" empty={tesouroAccounts.length === 0}>
                      <RealAccountList
                        items={tesouroAccounts}
                        onSelect={setSelectedFixedIncome}
                      />
                    </PortfolioSection>
                    <PortfolioSection title="Renda fixa" empty={outrasRendaFixa.length === 0}>
                      <RealAccountList
                        items={outrasRendaFixa}
                        onSelect={setSelectedFixedIncome}
                      />
                    </PortfolioSection>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => openMarket("tesouro")}
                  className="w-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-bold text-white"
                >
                  Comprar Tesouro com saldo
                </button>
              </div>
            )}

            {!marketOpen && tab === "investimentos" && focusGroup === "investimentos" && investSubPage === "acoes" && (
              <div className="space-y-5">
                <button
                  type="button"
                  onClick={() => setInvestSubPage(null)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/55 hover:text-white/80"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Investimentos
                </button>

                <div className="text-center pt-1 pb-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2">
                    Ações
                  </p>
                  <p className="text-[28px] font-black tabular-nums bg-gradient-to-br from-white via-violet-200 to-blue-300 bg-clip-text text-transparent leading-none">
                    {formatCurrency(acoesPageTotal)}
                  </p>
                </div>

                {acoesPageHoldings.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-8">Nenhuma ação cadastrada.</p>
                ) : (
                  <div className="space-y-5">
                    <PortfolioSection title="Ações" empty={acoesHoldings.length === 0}>
                      <HoldingList items={acoesHoldings} onSelect={setSelectedTicker} />
                    </PortfolioSection>
                    <PortfolioSection title="FIIs" empty={fiiHoldings.length === 0}>
                      <HoldingList items={fiiHoldings} onSelect={setSelectedTicker} />
                    </PortfolioSection>
                    <PortfolioSection title="ETFs" empty={etfHoldings.length === 0}>
                      <HoldingList items={etfHoldings} onSelect={setSelectedTicker} />
                    </PortfolioSection>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => openMarket("acoes")}
                  className="w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-sm font-bold text-white"
                >
                  Comprar ações com saldo
                </button>
              </div>
            )}

            {tab === "inicio" && financePanel && (
              <SimulatorFinancePanel panel={financePanel} onBack={() => setFinancePanel(null)} />
            )}

            {tab === "inicio" && !financePanel && (
              <div className="space-y-4 pt-1 pb-2">
                {/* Hero do saldo — alinhado estilo banco */}
                <div className="pt-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/40 mb-1.5">
                    Saldo na conta
                  </p>
                  <p className="text-[32px] font-black tabular-nums bg-gradient-to-br from-white via-violet-200 to-blue-300 bg-clip-text text-transparent leading-none tracking-tight">
                    {formatCurrency(animatedCash)}
                  </p>
                  <p className="text-[11px] text-white/40 mt-2">
                    Patrimônio{" "}
                    <span className="font-semibold text-white/70 tabular-nums">
                      {formatCurrency(patrimonioTotal)}
                    </span>
                  </p>
                </div>

                {/* CTA primário */}
                <button
                  type="button"
                  onClick={() => openMarket("hub")}
                  className="w-full rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 via-violet-500/15 to-blue-500/20 p-3.5 text-left hover:from-emerald-500/28 hover:to-blue-500/28 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/80 mb-0.5">
                        Usar saldo
                      </p>
                      <p className="text-[15px] font-black text-white">Investir agora</p>
                      <p className="text-[11px] text-white/45 mt-0.5 truncate">
                        Ações, Tesouro Direto ou caixinhas Turbo/EME.
                      </p>
                    </div>
                    <span className="h-9 w-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-4 w-4 text-emerald-300" />
                    </span>
                  </div>
                </button>

                {/* Atalhos compactos */}
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { label: "Cartão", icon: CreditCard, id: "cartao" as const, tone: "rose" as const },
                      { label: "Plano", icon: CalendarRange, id: "planejamento" as const, tone: "violet" as const },
                      { label: "Parcelas", icon: Layers, id: "parcelamentos" as const, tone: "cyan" as const },
                      { label: "Investir", icon: Landmark, id: "investir" as const, tone: "emerald" as const },
                    ] as const
                  ).map((item) => {
                    const tones = {
                      rose: { bg: "bg-rose-500/15", icon: "text-rose-400", border: "border-rose-500/25" },
                      violet: { bg: "bg-violet-500/15", icon: "text-violet-400", border: "border-violet-500/25" },
                      cyan: { bg: "bg-cyan-500/15", icon: "text-cyan-400", border: "border-cyan-500/25" },
                      emerald: { bg: "bg-emerald-500/15", icon: "text-emerald-400", border: "border-emerald-500/25" },
                    }[item.tone];
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (item.id === "investir") {
                            openMarket("hub");
                            return;
                          }
                          setFinancePanel(item.id);
                        }}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border ${tones.border} bg-white/[0.03] px-1 py-2.5 hover:bg-white/[0.06] transition-colors`}
                      >
                        <span className={`h-9 w-9 rounded-full ${tones.bg} flex items-center justify-center`}>
                          <Icon className={`h-4 w-4 ${tones.icon}`} />
                        </span>
                        <span className="text-[9.5px] font-semibold text-white/75 text-center leading-tight">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Meus investimentos */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                      Meus investimentos
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFinancePanel(null);
                        setMarketOpen(false);
                        setFocusGroup("all");
                        setInvestSubPage(null);
                        setTab("investimentos");
                      }}
                      className="text-[10px] font-semibold text-violet-300/80 hover:text-violet-200"
                    >
                      Ver tudo
                    </button>
                  </div>

                  <div className="space-y-2">
                    <CaixinhaRow
                      title="Turbo"
                      subtitle={`${turboAccountsLive.length} conta${turboAccountsLive.length !== 1 ? "s" : ""}`}
                      value={turboTotal}
                      icon={Zap}
                      tone="amber"
                      onClick={() => goToInvestGroup("turbo")}
                    />
                    <CaixinhaRow
                      title="EME"
                      subtitle={`${emergenciaAccountsLive.length} conta${emergenciaAccountsLive.length !== 1 ? "s" : ""}`}
                      value={emergenciaTotal}
                      icon={Shield}
                      tone="blue"
                      onClick={() => goToInvestGroup("emergencia")}
                    />
                    <CaixinhaRow
                      title="Investimentos"
                      subtitle={`${investimentosAccountsLive.length + holdings.length} ativo${
                        investimentosAccountsLive.length + holdings.length !== 1 ? "s" : ""
                      }`}
                      value={caixinhaInvestimentos}
                      icon={Landmark}
                      tone="emerald"
                      onClick={() => goToInvestGroup("investimentos")}
                    />
                  </div>

                  {homeTopHoldings.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] font-semibold text-white/35 px-0.5">Principais posições</p>
                      {homeTopHoldings.map((item) => (
                        <button
                          key={item.ticker}
                          type="button"
                          onClick={() => {
                            goToInvestGroup("investimentos");
                            setInvestSubPage("acoes");
                            setSelectedTicker(item.ticker);
                          }}
                          className="w-full text-left rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-white/[0.06] transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ background: item.color }}
                            />
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-white truncate">{item.ticker}</p>
                              <p className="text-[10px] text-white/40 truncate">{item.typeLabel}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[12px] font-extrabold tabular-nums text-white">
                              {formatCurrency(item.value)}
                            </p>
                            <p
                              className={`text-[10px] font-semibold tabular-nums ${
                                item.gain >= 0 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {item.gain >= 0 ? "+" : ""}
                              {item.gainPct.toFixed(1)}%
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Extrato / últimas movimentações */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 px-0.5">
                    <Receipt className="h-3.5 w-3.5 text-white/40" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">
                      Últimas movimentações
                    </p>
                  </div>

                  {homeMovements.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-6 text-center">
                      <p className="text-sm font-semibold text-white/55">Nenhuma movimentação ainda</p>
                      <p className="text-[11px] text-white/35 mt-1.5 leading-relaxed">
                        Compras e aportes do simulador aparecem aqui.
                      </p>
                      <button
                        type="button"
                        onClick={() => openMarket("hub")}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/[0.09]"
                      >
                        Começar a investir
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden divide-y divide-white/[0.06]">
                      {homeMovements.map((mov) => (
                        <div
                          key={mov.id}
                          className="flex items-center justify-between gap-3 px-3.5 py-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="h-8 w-8 rounded-full bg-rose-500/12 flex items-center justify-center shrink-0">
                              <ArrowDownRight className="h-3.5 w-3.5 text-rose-300" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-white truncate">{mov.title}</p>
                              <p className="text-[10px] text-white/40 truncate">{mov.subtitle}</p>
                            </div>
                          </div>
                          <p className="text-[12px] font-extrabold tabular-nums text-rose-300 shrink-0">
                            −{formatCurrency(mov.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-center text-[11px] text-white/30 px-2 pt-1">
                  Para alterar o saldo disponível, use a aba Simular.
                </p>
              </div>
            )}

            {tab === "simular" && (
              <div className="space-y-5 pt-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Saldo disponível</p>
                  {editingCash ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-white/50">R$</span>
                      <input
                        autoFocus
                        type="text"
                        inputMode="numeric"
                        value={cashInput}
                        onChange={(e) => onCashMaskChange(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEditCash(); if (e.key === "Escape") setEditingCash(false); }}
                        onBlur={commitEditCash}
                        className="min-w-[7.5rem] w-auto bg-transparent border-b border-violet-400 text-lg font-extrabold tabular-nums text-white focus:outline-none"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditCash}
                      disabled={savingCash}
                      className="flex items-center gap-1.5 text-lg font-extrabold tabular-nums text-white hover:text-violet-300 transition-colors disabled:opacity-60"
                    >
                      <span>{formatCurrency(animatedCash)}</span>
                      {savingCash ? (
                        <span className="text-[10px] font-semibold text-white/40">salvando…</span>
                      ) : (
                        <Pencil className="h-3 w-3 text-white/30 shrink-0" />
                      )}
                    </button>
                  )}
                  <p className="text-[11px] text-white/35">
                    Esse saldo aparece na aba Início como “Saldo na conta”.
                  </p>
                </div>

                <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40">Simulador de rendimentos</p>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-white/50 mb-1.5">
                      <span>Valor inicial</span>
                      <span className="font-bold text-white">{formatCurrency(simAporteInicial)}</span>
                    </div>
                    <input
                      type="range" min={0} max={simMax} step={100}
                      value={simAporteInicial}
                      onChange={(e) => setSimAporteInicial(Number(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-white/50 mb-1.5">
                      <span>Aporte mensal</span>
                      <span className="font-bold text-white">{formatCurrency(simAporteMensal)}</span>
                    </div>
                    <input
                      type="range" min={0} max={3000} step={50}
                      value={simAporteMensal}
                      onChange={(e) => setSimAporteMensal(Number(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-white/50 mb-1.5">
                      <span>Prazo</span>
                      <span className="font-bold text-white">{simMeses} meses</span>
                    </div>
                    <input
                      type="range" min={1} max={120} step={1}
                      value={simMeses}
                      onChange={(e) => setSimMeses(Number(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-white/50 mb-1.5">
                      <span>Rendimento ao mês</span>
                      <span className="font-bold text-white">{simTaxa.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range" min={0.1} max={2} step={0.1}
                      value={simTaxa}
                      onChange={(e) => setSimTaxa(Number(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] backdrop-blur-xl p-5 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300/70 mb-1.5">Patrimônio projetado</p>
                  <p className="text-3xl font-black tabular-nums text-white">{formatCurrency(simFinalValue)}</p>
                  <p className="text-xs text-white/40 mt-2">
                    Aportado: <span className="font-semibold text-white/70">{formatCurrency(simTotalAportado)}</span>
                    {" · "}Rendimento: <span className="font-semibold text-emerald-400">+{formatCurrency(simTotalRendimento)}</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4">
                  <div className="flex items-end gap-[3px] h-28">
                    {simProjection.filter((_, i) => i % Math.ceil(simProjection.length / 24 || 1) === 0).map((p, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm bg-gradient-to-t from-violet-600 to-blue-400"
                        style={{ height: `${Math.max(3, (p.value / maxSimValue) * 100)}%` }}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-white/30 text-center mt-2">Evolução simulada ao longo de {simMeses} meses</p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom tab bar */}
          <div className="flex items-center justify-around border-t border-white/10 bg-black/40 backdrop-blur-xl px-1 pt-2 pb-1 shrink-0">
            {[
              { id: "inicio" as const, label: "Início", icon: Home },
              { id: "investimentos" as const, label: "Investir", icon: Landmark },
              { id: "simular" as const, label: "Simular", icon: Calculator },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  setFocusGroup("all");
                  setInvestSubPage(null);
                  setMarketOpen(false);
                  setMarketSection("hub");
                  setFinancePanel(null);
                }}
                className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl transition-colors ${
                  tab === t.id ? "text-white" : "text-white/35"
                }`}
              >
                <t.icon className="h-5 w-5" />
                <span className="text-[9.5px] font-semibold">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-1 shrink-0 bg-black/40">
            <div className="h-1 w-32 rounded-full bg-white/30" />
          </div>

          {/* Simulador de investimentos (overlay sobre o frame inteiro) */}
          {marketOpen && (
            <div className="absolute inset-0 z-10 bg-[#05050a] flex flex-col">
              <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin-dark px-5 pt-4 pb-4">
                <SimulatorInvestFlow
                  cash={cash}
                  catalog={marketCatalog}
                  tesouroProducts={DEFAULT_TESOURO_PRODUCTS}
                  turboAccounts={turboAccountsLive}
                  emergenciaAccounts={emergenciaAccountsLive}
                  section={marketSection}
                  onSectionChange={setMarketSection}
                  onClose={() => setMarketOpen(false)}
                  onBuyStock={handleBuyStock}
                  onBuyTesouro={handleBuyTesouro}
                  onAporte={handleAporte}
                />
              </div>
            </div>
          )}

          {/* Flash de confirmação */}
          {confirmedFlash && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-xl">
              <Check className="h-3.5 w-3.5" />
              Compra confirmada
            </div>
          )}

          {/* Detalhe de conta real (turbo/emergência/renda fixa) */}
          {selectedFixedIncome && (
            <div
              className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end"
              onClick={() => setSelectedFixedIncome(null)}
            >
              <div
                className="w-full rounded-t-3xl bg-[#0a0a12] border-t border-white/10 p-5 pb-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-center mb-4">
                  <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>

                <div className="flex items-start gap-3 mb-5">
                  <span
                    className={`h-3 w-3 rounded-full shrink-0 mt-1.5 ${
                      selectedFixedIncome.isTurbo
                        ? "bg-amber-400"
                        : isTesouroAccount(selectedFixedIncome.nome)
                          ? "bg-emerald-400"
                          : "bg-blue-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-white leading-snug">{selectedFixedIncome.nome}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {[
                        selectedFixedIncome.isTurbo
                          ? "Turbo"
                          : isTesouroAccount(selectedFixedIncome.nome)
                            ? "Tesouro Direto"
                            : "Renda fixa",
                        selectedFixedIncome.instituicao,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 mb-3">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide">Valor investido</p>
                  <p className="text-lg font-black tabular-nums text-white mt-0.5">{formatCurrency(selectedFixedIncome.valor)}</p>
                </div>

                {selectedFixedIncome.isTurbo && (
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {selectedFixedIncome.cdiPercent != null && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
                        <p className="text-[10px] text-amber-300/70 uppercase tracking-wide">% do CDI</p>
                        <p className="text-base font-extrabold tabular-nums text-white mt-0.5">{selectedFixedIncome.cdiPercent}%</p>
                      </div>
                    )}
                    {selectedFixedIncome.maxRendimento != null && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
                        <p className="text-[10px] text-amber-300/70 uppercase tracking-wide">Teto de rendimento</p>
                        <p className="text-base font-extrabold tabular-nums text-white mt-0.5">{formatCurrency(selectedFixedIncome.maxRendimento)}</p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => {
                    const isEme = emergenciaAccountsLive.some(
                      (a) => a.id === selectedFixedIncome.id
                    );
                    setSelectedFixedIncome(null);
                    openMarket(
                      selectedFixedIncome.isTurbo
                        ? "turbo"
                        : isTesouroAccount(selectedFixedIncome.nome)
                          ? "tesouro"
                          : isEme
                            ? "eme"
                            : "hub"
                    );
                  }}
                  className="w-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 py-3 text-sm font-bold text-white mb-2"
                >
                  Aportar com saldo
                </button>
                <button
                  onClick={() => setSelectedFixedIncome(null)}
                  className="w-full rounded-full bg-white/10 hover:bg-white/15 py-3 text-sm font-bold text-white transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* Detalhe de posição em ação/FII */}
          {selectedHolding && (
            <div
              className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end"
              onClick={() => setSelectedTicker(null)}
            >
              <div
                className="w-full rounded-t-3xl bg-[#0a0a12] border-t border-white/10 p-5 pb-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-center mb-4">
                  <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>

                <div className="flex items-start gap-3 mb-5">
                  <span className="h-3 w-3 rounded-full shrink-0 mt-1.5" style={{ background: selectedHolding.asset.color }} />
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-white leading-snug">{selectedHolding.asset.ticker}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {selectedHolding.asset.name} · {detectAssetType(selectedHolding.asset.ticker)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wide">Quantidade</p>
                    <p className="text-base font-extrabold tabular-nums text-white mt-0.5">{formatQty(selectedHolding.h.quantity)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wide">Preço médio</p>
                    <p className="text-base font-extrabold tabular-nums text-white mt-0.5">{formatCurrency(selectedHolding.h.avgPrice)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wide">Cotação atual</p>
                    <p className="text-base font-extrabold tabular-nums text-white mt-0.5">
                      {formatCurrency(selectedHolding.asset.price * (1 + selectedHolding.asset.variation))}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wide">Valor investido</p>
                    <p className="text-base font-extrabold tabular-nums text-white mt-0.5">{formatCurrency(selectedHolding.cost)}</p>
                  </div>
                </div>

                <div className={`rounded-xl border p-3 mb-5 ${selectedHolding.gain >= 0 ? "border-emerald-500/20 bg-emerald-500/[0.06]" : "border-red-500/20 bg-red-500/[0.06]"}`}>
                  <p className="text-[10px] text-white/40 uppercase tracking-wide">Valor atual · rendimento</p>
                  <p className="text-lg font-black tabular-nums text-white mt-0.5">{formatCurrency(selectedHolding.value)}</p>
                  <p className={`text-xs font-semibold mt-1 inline-flex items-center gap-1 ${selectedHolding.gain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {selectedHolding.gain >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {formatCurrency(Math.abs(selectedHolding.gain))} ({selectedHolding.gainPct >= 0 ? "+" : ""}{selectedHolding.gainPct.toFixed(1)}%)
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedTicker(null);
                    openMarket("acoes");
                  }}
                  className="w-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 py-3 text-sm font-bold text-white mb-2"
                >
                  Comprar mais com saldo
                </button>
                <button
                  onClick={() => setSelectedTicker(null)}
                  className="w-full rounded-full bg-white/10 hover:bg-white/15 py-3 text-sm font-bold text-white transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
