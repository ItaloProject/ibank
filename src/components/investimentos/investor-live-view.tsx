"use client";

import { useEffect, useMemo, useRef, useState, type ElementType, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  X, Landmark, Calculator, Zap, Shield,
  ArrowUpRight, ArrowDownRight, ArrowRight, Check, Pencil, Home, ChevronRight,
  CalendarRange, Layers, TrendingUp, Receipt, Scale, Plus, Trash2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CdiHelp, TetoHelp, TipoCaixinhaHelp } from "./help-texts";
import {
  FOCUS, LABEL, MONEY, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, BTN_DANGER_OUTLINE,
  ROW, INPUT_BOX, GAIN, LOSS, ATTENTION, LiveSheet, StatBox, BackLink,
} from "@/components/investimentos/live-ui";
import { detectAssetType } from "@/lib/stock-utils";
import { catalogName } from "@/lib/market-catalog";
import { isEmergencyAccountName } from "@/lib/account-groups";
import type { StockTrade, Investment } from "@/types/database";
import { createInvestmentAccountWithTurbo, deleteInvestmentAccount } from "@/lib/api";
import {
  SimulatorFinancePanel,
  type FinancePanelId,
} from "@/components/investimentos/simulator-finance-panels";
import {
  SimulatorInvestFlow,
  type MarketSection,
} from "@/components/investimentos/simulator-invest-flow";
import { EMPTY_RATE_DRAFT, RateFields, rateFromDraft, type RateDraft } from "@/components/investimentos/rate-fields";
import { BankPicker } from "@/components/investimentos/bank-picker";
import { InicialShortcuts, SimChart, SimLegend, SimParam, SimRateParam, simRateText, useSimulation } from "@/components/investimentos/sim-controls";
import { liveBotContext } from "@/components/investimentos/live-bot-context";
import { useBotPageContext } from "@/lib/bot-page-context";
import { AskMuvoInline } from "@/components/bot/ask-muvo-inline";
import type { Bank, BankProduct } from "@/lib/bank-rates";
import { useLiveActions, type LiveAccount, type LiveMovement } from "@/components/investimentos/live-actions";
import {
  StockOrderSheet,
  WithdrawSheet,
  UpdateValueSheet,
  AmountSheet,
  MovementsList,
  UndoSheet,
  type StockOrder,
} from "@/components/investimentos/live-money-sheets";

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
  return qty.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
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

function formatPct(value: number, digits = 1) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/** Máscara de percentual: até 3 dígitos inteiros e 2 decimais, vírgula como separador. */
function formatPercentMask(raw: string): string {
  const v = raw.replace(/[^\d,]/g, "");
  const [int = "", ...rest] = v.split(",");
  const dec = rest.join("").slice(0, 2);
  return rest.length > 0 ? `${int.slice(0, 3)},${dec}` : int.slice(0, 3);
}

function parsePercentMask(masked: string): number {
  const n = parseFloat(masked.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function CaixinhaRow({
  title,
  subtitle,
  value,
  icon: Icon,
  onClick,
}: {
  title: string;
  subtitle: string;
  value: number;
  icon: ElementType;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${ROW} min-h-14 px-3 py-2.5 grid grid-cols-[2.25rem_minmax(0,1fr)_auto_1rem] items-center gap-x-2.5`}
    >
      <span className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
        <Icon className="h-4 w-4 text-foreground/70" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground leading-tight truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">{subtitle}</p>
      </div>
      <p className={`${MONEY} text-sm text-right whitespace-nowrap`}>{formatCurrency(value)}</p>
      <ChevronRight className="h-4 w-4 text-muted-foreground justify-self-end" aria-hidden="true" />
    </button>
  );
}

function CaixinhaHeader({ label, total }: { label: string; total: number }) {
  const animated = useCountUp(total, 1200);
  return (
    <div className="text-center pt-2 pb-1">
      <p className={`${LABEL} mb-2`}>{label}</p>
      <p className={`${MONEY} text-[30px] leading-none tracking-tight`}>{formatCurrency(animated)}</p>
    </div>
  );
}

function SubPageHeader({
  backLabel,
  onBack,
  title,
  subtitle,
  total,
}: {
  backLabel: string;
  onBack: () => void;
  title: string;
  subtitle?: string;
  total: number;
}) {
  return (
    <>
      <BackLink label={backLabel} onClick={onBack} />
      <div className="text-center pb-1">
        <h2 className={`${LABEL} mb-1`}>{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground mb-2">{subtitle}</p>}
        <p className={`${MONEY} text-[28px] leading-none tracking-tight`}>{formatCurrency(total)}</p>
      </div>
    </>
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
      <h3 className={LABEL}>{title}</h3>
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
          className={`${ROW} min-h-14 p-3.5 flex items-center justify-between gap-3`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{item.nome}</p>
            {item.instituicao && (
              <p className="text-[11px] text-muted-foreground truncate">{item.instituicao}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <p className={`${MONEY} text-sm`}>{formatCurrency(item.valor)}</p>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
          className={`${ROW} min-h-14 p-3.5 flex items-center justify-between gap-3`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{item.ticker}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {item.typeLabel} · {formatQty(item.quantity)} un.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`${MONEY} text-sm`}>{formatCurrency(item.value)}</p>
            <p className={`text-[11px] font-semibold tabular-nums ${item.gain >= 0 ? GAIN : LOSS}`}>
              {formatPct(item.gainPct)}
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
  /** Sem onClose, o botão de fechar não aparece. */
  onClose?: () => void;
  /** Ação pedida por outra tela (ex.: diagnóstico em Metas), executada ao chegar. */
  liveAction?: LiveAction | null;
};

export type LiveAction =
  | { kind: "investir"; section: MarketSection; amount?: number }
  | { kind: "vender"; ticker: string };

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
  liveAction,
}: InvestorLiveViewProps) {
  const [tab, setTab] = useState<"inicio" | "investimentos" | "rebalancear" | "simular">("inicio");
  const [focusGroup, setFocusGroup] = useState<"all" | "turbo" | "emergencia" | "investimentos">("all");
  const [investSubPage, setInvestSubPage] = useState<"tesouro" | "acoes" | null>(null);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketSection, setMarketSection] = useState<MarketSection>("hub");
  const [suggestedAmount, setSuggestedAmount] = useState<number | undefined>();
  useEffect(() => {
    if (!marketOpen) setSuggestedAmount(undefined);
  }, [marketOpen]);
  const cash = cashBalance;
  const [cashSheetOpen, setCashSheetOpen] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const [financePanel, setFinancePanel] = useState<FinancePanelId | null>(null);
  const [selectedFixedIncome, setSelectedFixedIncome] = useState<RealAccountItem | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<RealAccountItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const [newCaixinhaOpen, setNewCaixinhaOpen] = useState(false);
  const [newCaixinhaName, setNewCaixinhaName] = useState("");
  const [newCaixinhaInstituicao, setNewCaixinhaInstituicao] = useState("");
  const [newCaixinhaTipo, setNewCaixinhaTipo] = useState<"turbo" | "emergencia" | "investimentos">("investimentos");
  const [newCaixinhaCdiMask, setNewCaixinhaCdiMask] = useState("");
  const [newCaixinhaRate, setNewCaixinhaRate] = useState<RateDraft>(EMPTY_RATE_DRAFT);
  const [newCaixinhaTetoMask, setNewCaixinhaTetoMask] = useState("");
  const [newCaixinhaSubmitting, setNewCaixinhaSubmitting] = useState(false);
  const [newCaixinhaError, setNewCaixinhaError] = useState<string | null>(null);

  const actions = useLiveActions({
    cashAccountId,
    cashBalance,
    turboAccounts: turboAccountsReal,
    emergenciaAccounts: emergenciaAccountsReal,
    investimentosAccounts: investimentosAccountsReal,
    stockTrades,
    investments,
    onRefresh,
  });
  const [order, setOrder] = useState<StockOrder | null>(null);
  const [aporteAccount, setAporteAccount] = useState<LiveAccount | null>(null);
  const [withdrawAccount, setWithdrawAccount] = useState<LiveAccount | null>(null);
  const [updateAccount, setUpdateAccount] = useState<LiveAccount | null>(null);
  const [undoMovement, setUndoMovement] = useState<LiveMovement | null>(null);

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
        name: catalogName(ticker) ?? ticker,
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

  function openSell(ticker: string) {
    const h = holdings.find((x) => x.ticker === ticker);
    const asset = liveAssets.find((a) => a.ticker === ticker);
    if (!h || !asset) return;
    setSelectedTicker(null);
    setOrder({ mode: "venda", ticker, price: asset.price * (1 + asset.variation), maxQty: h.quantity });
  }

  useEffect(() => {
    if (!liveAction) return;
    if (liveAction.kind === "investir") {
      setSuggestedAmount(liveAction.amount);
      openMarket(liveAction.section);
    }
    else if (holdings.some((h) => h.ticker === liveAction.ticker)) {
      setTab("investimentos");
      openSell(liveAction.ticker);
    } else openMarket(detectAssetType(liveAction.ticker) === "FII" ? "fiis" : "acoes");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveAction]);



  function openNewCaixinha(tipo: "turbo" | "emergencia" | "investimentos" = "investimentos") {
    setNewCaixinhaName("");
    setNewCaixinhaInstituicao("");
    setNewCaixinhaTipo(tipo);
    setNewCaixinhaCdiMask("");
    setNewCaixinhaTetoMask("");
    setNewCaixinhaRate(tipo === "emergencia" ? { ...EMPTY_RATE_DRAFT, index: "cdi", value: "100" } : EMPTY_RATE_DRAFT);
    setNewCaixinhaError(null);
    setNewCaixinhaOpen(true);
  }

  const autoCaixinhaName = useRef("");
  function applyBankProduct(bank: Bank, prod: BankProduct) {
    const auto = `${prod.nome} · ${bank.nome}`;
    setNewCaixinhaName((cur) => (!cur.trim() || cur === autoCaixinhaName.current ? auto : cur));
    autoCaixinhaName.current = auto;
    const value = prod.rate_index === "poupanca" ? "" : String(prod.rate_value).replace(".", ",");
    if (newCaixinhaTipo === "turbo") setNewCaixinhaCdiMask(formatPercentMask(value));
    else setNewCaixinhaRate({ index: prod.rate_index, value, maturity: "", exempt: prod.tax_exempt });
  }

  async function confirmNewCaixinha() {
    const name = newCaixinhaName.trim();
    if (!name || newCaixinhaSubmitting) return;
    const rate = newCaixinhaTipo === "turbo" ? null : rateFromDraft(newCaixinhaRate);
    if (typeof rate === "string") {
      setNewCaixinhaError(rate);
      return;
    }
    setNewCaixinhaSubmitting(true);
    setNewCaixinhaError(null);
    try {
      const finalName =
        newCaixinhaTipo === "emergencia" && !isEmergencyAccountName(name)
          ? `${name} (Emergência)`
          : name;
      const cdi = parsePercentMask(newCaixinhaCdiMask);
      const teto = parseBRLMask(newCaixinhaTetoMask);
      await createInvestmentAccountWithTurbo({
        name: finalName,
        institution: newCaixinhaInstituicao.trim() || "—",
        is_turbo: newCaixinhaTipo === "turbo",
        cdi_percent: newCaixinhaTipo === "turbo" && cdi > 0 ? cdi : null,
        max_rendimento: newCaixinhaTipo === "turbo" && teto > 0 ? teto : null,
        ...(rate ?? {}),
      });
      await onRefresh();
      toast.success(`Caixinha "${finalName}" criada`);
      setNewCaixinhaOpen(false);
    } catch (err) {
      console.error("Erro ao criar caixinha:", err);
      setNewCaixinhaError("Não foi possível criar a caixinha. Tente novamente.");
    } finally {
      setNewCaixinhaSubmitting(false);
    }
  }

  async function confirmDeleteAccount() {
    if (!deleteAccount || deleteSubmitting) return;
    setDeleteSubmitting(true);
    try {
      await deleteInvestmentAccount(deleteAccount.id);
      await onRefresh();
      toast.success(`Caixinha "${deleteAccount.nome}" excluída`);
      setDeleteAccount(null);
    } catch (err) {
      console.error("Erro ao excluir caixinha:", err);
      toast.error("Não foi possível excluir a caixinha. Tente novamente.");
    } finally {
      setDeleteSubmitting(false);
    }
  }

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

  /** Valor em FIIs dentro da carteira de ações/FIIs (para separar de ações). */
  const fiiValue = useMemo(() => {
    return holdings.reduce((sum, h) => {
      if (detectAssetType(h.ticker) !== "FII") return sum;
      const asset = liveAssets.find((a) => a.ticker === h.ticker);
      if (!asset) return sum;
      return sum + h.quantity * asset.price * (1 + asset.variation);
    }, 0);
  }, [holdings, liveAssets]);
  const acoesValue = investedValue - fiiValue;

  /** Alocação atual vs. ideal (mesma referência de 40/30/30 usada no Modo Investidor). */
  const allocationRecommendations = useMemo(() => {
    const total = patrimonioTotal;
    const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
    return [
      {
        id: "fii",
        label: "Fundos imobiliários",
        atual: pct(fiiValue),
        ideal: 40,
        desc: "Renda mensal sem Imposto de Renda",
        action: "fiis" as MarketSection,
      },
      {
        id: "turbo",
        label: "Turbo e renda fixa",
        atual: pct(turboTotal + investimentosFixedTotal),
        ideal: 30,
        desc: "Segurança e rendimento do CDI",
        action: "turbo" as MarketSection,
      },
      {
        id: "acoes",
        label: "Ações",
        atual: pct(acoesValue),
        ideal: 30,
        desc: "Crescimento e dividendos",
        action: "acoes" as MarketSection,
      },
    ];
  }, [patrimonioTotal, fiiValue, turboTotal, investimentosFixedTotal, acoesValue]);


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
        title: "Emergência",
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
  const animatedPatrimonio = useCountUp(patrimonioTotal, 1200);

  const [savingCash, setSavingCash] = useState(false);
  const cashInputValue = parseBRLMask(cashInput);
  const cashDelta = cashInputValue - cash;
  const cashChanged = Math.abs(cashDelta) >= 0.005;

  function openCashSheet() {
    setCashInput(formatBRLMask(cashToMaskDigits(cash)));
    setCashSheetOpen(true);
  }

  async function saveCash(e?: FormEvent) {
    e?.preventDefault();
    if (!cashChanged || savingCash) return;
    setSavingCash(true);
    try {
      await actions.setCash(cashInputValue);
      setCashSheetOpen(false);
    } catch (err) {
      console.error("Erro ao ajustar saldo:", err);
      toast.error("Não foi possível salvar o saldo. Tente novamente.");
    } finally {
      setSavingCash(false);
    }
  }

  function onCashMaskChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 12);
    setCashInput(formatBRLMask(digits));
  }

  const sim = useSimulation(patrimonioTotal, cash);
  useBotPageContext("live:mobile", liveBotContext({
    tab,
    marketOpen,
    marketSection,
    newCaixinha: { open: newCaixinhaOpen, tipo: newCaixinhaTipo, nome: newCaixinhaName, instituicao: newCaixinhaInstituicao, rate: newCaixinhaRate, cdiMask: newCaixinhaCdiMask },
    sim,
  }));
  const simInicialMax = Math.max(20000, Math.ceil((patrimonioTotal * 2) / 1000) * 1000);

  const REBALANCE_TOLERANCE = 2;
  const allocationOutside = Math.max(
    0,
    100 - allocationRecommendations.reduce((s, r) => s + r.atual, 0)
  );

  function goToTab(id: typeof tab) {
    setTab(id);
    setFocusGroup("all");
    setInvestSubPage(null);
    setMarketOpen(false);
    setMarketSection("hub");
    setFinancePanel(null);
  }

  const caixinhaRows = (onSelect: (group: "turbo" | "emergencia" | "investimentos") => void) => (
    <>
      <CaixinhaRow
        title="Turbo"
        subtitle={`${turboAccountsLive.length} conta${turboAccountsLive.length !== 1 ? "s" : ""}`}
        value={turboTotal}
        icon={Zap}
        onClick={() => onSelect("turbo")}
      />
      <CaixinhaRow
        title="Emergência"
        subtitle={`${emergenciaAccountsLive.length} conta${emergenciaAccountsLive.length !== 1 ? "s" : ""}`}
        value={emergenciaTotal}
        icon={Shield}
        onClick={() => onSelect("emergencia")}
      />
      <CaixinhaRow
        title="Investimentos"
        subtitle={`${investimentosAccountsLive.length + holdings.length} ativo${
          investimentosAccountsLive.length + holdings.length !== 1 ? "s" : ""
        }`}
        value={caixinhaInvestimentos}
        icon={Landmark}
        onClick={() => onSelect("investimentos")}
      />
    </>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="MUVO Live"
      className="fixed inset-0 z-[200] bg-background text-foreground select-none"
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <header
          className="flex items-center justify-between pl-5 pr-3 pb-2 shrink-0 border-b border-border"
          style={{ paddingTop: "calc(0.5rem + var(--safe-top))" }}
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className={LABEL}>MUVO · Live</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar MUVO Live"
              className={`h-11 w-11 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground ${FOCUS}`}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </header>

        {/* Conteúdo scrollável */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin-dark px-5 pt-4 pb-6">
          {!marketOpen && tab === "investimentos" && focusGroup === "all" && (
            <div className="space-y-4">
              <CaixinhaHeader label="Total das caixinhas" total={totalCaixinhas} />

              <button type="button" onClick={() => openMarket("hub")} className={`${BTN_PRIMARY} flex items-center justify-between`}>
                <span>Investir saldo · {formatCurrency(cash)}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="space-y-2">
                {caixinhaRows((group) => {
                  setInvestSubPage(null);
                  setFocusGroup(group);
                })}
                <button
                  type="button"
                  onClick={() => openNewCaixinha()}
                  className={`w-full min-h-12 rounded-xl border border-dashed border-border flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors ${FOCUS}`}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Nova caixinha
                </button>
              </div>
            </div>
          )}

          {!marketOpen && tab === "investimentos" && caixinhaPageMeta && !investSubPage && (
            <div className="space-y-5">
              <SubPageHeader
                backLabel="Caixinhas"
                onBack={() => {
                  setFocusGroup("all");
                  setInvestSubPage(null);
                }}
                title={caixinhaPageMeta.title}
                subtitle={caixinhaPageMeta.subtitle}
                total={caixinhaPageMeta.total}
              />

              <div className="space-y-5">
                {focusGroup === "turbo" && (
                  turboAccountsLive.length > 0 ? (
                    <PortfolioSection title="Contas">
                      <RealAccountList items={turboAccountsLive} onSelect={setSelectedFixedIncome} />
                      <p className="text-[11px] text-muted-foreground mt-2">Toque numa conta para aplicar, retirar ou atualizar o valor.</p>
                    </PortfolioSection>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conta Turbo.</p>
                  )
                )}
                {focusGroup === "turbo" && (
                  <button type="button" onClick={() => openNewCaixinha("turbo")} className={BTN_SECONDARY}>
                    Nova caixinha Turbo
                  </button>
                )}

                {focusGroup === "emergencia" && (
                  emergenciaAccountsLive.length > 0 ? (
                    <PortfolioSection title="Contas">
                      <RealAccountList items={emergenciaAccountsLive} onSelect={setSelectedFixedIncome} />
                      <p className="text-[11px] text-muted-foreground mt-2">Toque numa conta para aplicar, retirar ou atualizar o valor.</p>
                    </PortfolioSection>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conta de emergência.</p>
                  )
                )}
                {focusGroup === "emergencia" && (
                  <button type="button" onClick={() => openNewCaixinha("emergencia")} className={BTN_SECONDARY}>
                    Nova reserva de emergência
                  </button>
                )}

                {focusGroup === "investimentos" && (
                  <div className="space-y-2">
                    <CaixinhaRow
                      title="Tesouro e renda fixa"
                      subtitle={`${tesouroAccounts.length + outrasRendaFixa.length} título${
                        tesouroAccounts.length + outrasRendaFixa.length !== 1 ? "s" : ""
                      }`}
                      value={tesouroTotal}
                      icon={Landmark}
                      onClick={() => setInvestSubPage("tesouro")}
                    />
                    <CaixinhaRow
                      title="Ações e fundos imobiliários"
                      subtitle={`${acoesPageHoldings.length} ativo${acoesPageHoldings.length !== 1 ? "s" : ""}`}
                      value={acoesPageTotal}
                      icon={TrendingUp}
                      onClick={() => setInvestSubPage("acoes")}
                    />
                    <button
                      type="button"
                      onClick={() => openMarket("hub")}
                      className={`w-full min-h-12 rounded-xl border border-dashed border-border flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors ${FOCUS}`}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Investir
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {!marketOpen && tab === "investimentos" && focusGroup === "investimentos" && investSubPage === "tesouro" && (
            <div className="space-y-5">
              <SubPageHeader
                backLabel="Investimentos"
                onBack={() => setInvestSubPage(null)}
                title="Tesouro e renda fixa"
                total={tesouroTotal}
              />

              {tesouroAccounts.length === 0 && outrasRendaFixa.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum título cadastrado.</p>
              ) : (
                <div className="space-y-5">
                  <PortfolioSection title="Tesouro Direto" empty={tesouroAccounts.length === 0}>
                    <RealAccountList items={tesouroAccounts} onSelect={setSelectedFixedIncome} />
                  </PortfolioSection>
                  <PortfolioSection title="Renda fixa" empty={outrasRendaFixa.length === 0}>
                    <RealAccountList items={outrasRendaFixa} onSelect={setSelectedFixedIncome} />
                  </PortfolioSection>
                  <p className="text-[11px] text-muted-foreground -mt-2">Toque num título para aplicar, retirar ou atualizar o valor.</p>
                </div>
              )}

              <div className="space-y-2">
                <button type="button" onClick={() => openMarket("tesouro")} className={BTN_PRIMARY}>
                  Aplicar em Tesouro ou renda fixa
                </button>
                <button type="button" onClick={() => openNewCaixinha("investimentos")} className={BTN_SECONDARY}>
                  Cadastrar outra renda fixa
                </button>
              </div>
            </div>
          )}

          {!marketOpen && tab === "investimentos" && focusGroup === "investimentos" && investSubPage === "acoes" && (
            <div className="space-y-5">
              <SubPageHeader
                backLabel="Investimentos"
                onBack={() => setInvestSubPage(null)}
                title="Ações e fundos imobiliários"
                total={acoesPageTotal}
              />

              {acoesPageHoldings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ação cadastrada.</p>
              ) : (
                <div className="space-y-5">
                  <PortfolioSection title="Ações" empty={acoesHoldings.length === 0}>
                    <HoldingList items={acoesHoldings} onSelect={setSelectedTicker} />
                  </PortfolioSection>
                  <PortfolioSection title="Fundos imobiliários" empty={fiiHoldings.length === 0}>
                    <HoldingList items={fiiHoldings} onSelect={setSelectedTicker} />
                  </PortfolioSection>
                  <PortfolioSection title="ETFs" empty={etfHoldings.length === 0}>
                    <HoldingList items={etfHoldings} onSelect={setSelectedTicker} />
                  </PortfolioSection>
                  <p className="text-[11px] text-muted-foreground -mt-2">Toque num ativo para comprar mais ou vender.</p>
                </div>
              )}

              <button type="button" onClick={() => setOrder({ mode: "compra" })} className={BTN_PRIMARY}>
                Registrar compra
              </button>
            </div>
          )}

          {tab === "inicio" && financePanel && (
            <SimulatorFinancePanel panel={financePanel} onBack={() => setFinancePanel(null)} />
          )}

          {tab === "inicio" && !financePanel && (
            <div className="space-y-5 pb-2">
              {/* Patrimônio + saldo em conta */}
              <section aria-labelledby="live-patrimonio">
                <h2 id="live-patrimonio" className={LABEL}>Patrimônio</h2>
                <p className={`${MONEY} text-[34px] leading-none tracking-tight mt-2`}>
                  {formatCurrency(animatedPatrimonio)}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card pl-3.5 pr-1.5 py-1.5">
                  <div className="min-w-0 py-1">
                    <p className={LABEL}>Saldo em conta</p>
                    <p className={`${MONEY} text-base mt-0.5`}>{formatCurrency(animatedCash)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={openCashSheet}
                    disabled={savingCash}
                    className={`min-h-11 shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-foreground/80 hover:bg-muted disabled:opacity-40 ${FOCUS}`}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Ajustar
                  </button>
                </div>
              </section>

              {/* CTA primário */}
              <button
                type="button"
                onClick={() => openMarket("hub")}
                className={`w-full min-h-14 rounded-xl bg-foreground text-background px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-foreground/90 transition-colors ${FOCUS}`}
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold">Investir agora</span>
                  <span className="block text-[11px] text-background/70 mt-0.5 truncate">
                    Ações, Tesouro Direto ou caixinhas
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
              </button>

              {/* Atalhos */}
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { label: "Planejamento", icon: CalendarRange, id: "planejamento" as const },
                    { label: "Parcelamentos", icon: Layers, id: "parcelamentos" as const },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFinancePanel(item.id)}
                    className={`${ROW} min-h-12 px-3 flex items-center gap-2.5`}
                  >
                    <item.icon className="h-4 w-4 text-foreground/70 shrink-0" aria-hidden="true" />
                    <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Meus investimentos */}
              <section className="space-y-2.5" aria-labelledby="live-investimentos">
                <div className="flex items-center justify-between">
                  <h2 id="live-investimentos" className={LABEL}>Meus investimentos</h2>
                  <button
                    type="button"
                    onClick={() => goToTab("investimentos")}
                    className={`-mr-2 min-h-11 rounded-lg px-2 text-xs font-semibold text-foreground/70 hover:text-foreground ${FOCUS}`}
                  >
                    Ver tudo
                  </button>
                </div>

                <div className="space-y-2">{caixinhaRows(goToInvestGroup)}</div>

                {homeTopHoldings.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h3 className={LABEL}>Principais posições</h3>
                    <HoldingList
                      items={homeTopHoldings}
                      onSelect={(ticker) => {
                        goToInvestGroup("investimentos");
                        setInvestSubPage("acoes");
                        setSelectedTicker(ticker);
                      }}
                    />
                  </div>
                )}
              </section>

              {/* Últimas movimentações */}
              <section className="space-y-2.5" aria-labelledby="live-movimentacoes">
                <div className="flex items-center gap-2">
                  <Receipt className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <h2 id="live-movimentacoes" className={LABEL}>Últimas movimentações</h2>
                </div>

                {actions.movements.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-foreground/70">Nenhuma movimentação ainda</p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      Compras, vendas, aplicações e retiradas aparecem aqui. Dá para desfazer qualquer uma.
                    </p>
                    <button
                      type="button"
                      onClick={() => openMarket("hub")}
                      className={`mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-4 text-xs font-bold text-foreground hover:bg-muted ${FOCUS}`}
                    >
                      Começar a investir
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card px-3.5">
                    <MovementsList movements={actions.movements.slice(0, 8)} onUndo={setUndoMovement} />
                  </div>
                )}
              </section>
            </div>
          )}

          {tab === "rebalancear" && !marketOpen && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className={LABEL}>Alocação atual vs. referência</h2>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 space-y-5">
                {allocationRecommendations.map((r) => {
                  const gap = r.ideal - r.atual;
                  const status =
                    gap > REBALANCE_TOLERANCE ? "falta" : gap < -REBALANCE_TOLERANCE ? "excede" : "ok";
                  const gapPts = Math.abs(gap).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
                  return (
                    <div key={r.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-foreground truncate">{r.label}</span>
                        <div className="flex items-baseline gap-2 text-xs shrink-0">
                          <span className={`${MONEY} text-sm`}>
                            {r.atual.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
                          </span>
                          <span className="text-muted-foreground">alvo {r.ideal}%</span>
                        </div>
                      </div>
                      <div
                        className="relative h-2 rounded-full bg-muted"
                        role="img"
                        aria-label={`${r.label}: ${r.atual.toFixed(0)}% atual, alvo ${r.ideal}%`}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-foreground/80 transition-[width] duration-700 motion-reduce:transition-none"
                          style={{ width: `${Math.min(r.atual, 100)}%` }}
                        />
                        <div
                          className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground ring-2 ring-card"
                          style={{ left: `${Math.min(r.ideal, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-muted-foreground">{r.desc}</p>
                        {status === "ok" && (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${GAIN}`}>
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            No alvo
                          </span>
                        )}
                        {status === "falta" && (
                          <span className="text-[11px] font-bold text-foreground/80">Faltam {gapPts} pontos</span>
                        )}
                        {status === "excede" && (
                          <span className={`text-[11px] font-bold ${ATTENTION}`}>
                            {gapPts} pontos acima
                          </span>
                        )}
                      </div>
                      {status === "falta" && (
                        <button
                          type="button"
                          onClick={() => openMarket(r.action)}
                          className={`${BTN_SECONDARY} min-h-11 text-xs`}
                        >
                          Investir em {r.label}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-center text-[11px] text-muted-foreground px-2 leading-relaxed">
                Referência: fundos imobiliários 40% · Turbo e renda fixa 30% · ações 30% do patrimônio.
                {allocationOutside >= 1 && (
                  <>
                    {" "}Saldo em conta e Emergência somam{" "}
                    {allocationOutside.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% e ficam fora da referência.
                  </>
                )}
              </p>
            </div>
          )}

          {tab === "simular" && (
            <div className="space-y-5">
              <div>
                <h2 className={LABEL}>Simulador de rendimentos</h2>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Digite o valor exato ou arraste. Projeção hipotética: não altera sua carteira nem seu saldo.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 space-y-6">
                <SimParam
                  id="sim-inicial"
                  label="Valor inicial"
                  format="brl"
                  value={sim.inicial}
                  onChange={sim.setInicial}
                  min={0}
                  max={simInicialMax}
                  step={100}
                  typedMax={100_000_000}
                >
                  <InicialShortcuts sim={sim} patrimonio={patrimonioTotal} saldo={cash} />
                </SimParam>
                <SimParam id="sim-mensal" label="Aporte mensal" format="brl" value={sim.mensal} onChange={sim.setMensal} min={0} max={3000} step={50} typedMax={10_000_000} />
                <SimParam id="sim-prazo" label="Prazo" format="meses" value={sim.meses} onChange={sim.setMeses} min={1} max={120} step={1} typedMax={600} />
                <SimRateParam id="sim-rend" sim={sim} manualMax={2} />
              </div>

              <div className="rounded-xl border border-border bg-card p-5 text-center" aria-live="polite">
                <p className={`${LABEL} mb-2`}>Patrimônio em {sim.meses} {sim.meses === 1 ? "mês" : "meses"}</p>
                <p className={`${MONEY} text-4xl leading-none tracking-tight`}>{formatCurrency(sim.final)}</p>
                <span className="mt-3 inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black tabular-nums text-emerald-500">
                  +{sim.retornoPct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% de retorno sobre o que você aportou
                </span>
                <div className="grid grid-cols-2 gap-2 mt-4 text-left">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
                    <p className={LABEL}>Juros</p>
                    <p className={`mt-1 text-base font-black font-display tabular-nums ${GAIN}`}>+{formatCurrency(Math.max(0, sim.rendimento))}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className={LABEL}>Aportado</p>
                    <p className="mt-1 text-base font-black font-display tabular-nums text-foreground">{formatCurrency(sim.aportado)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <SimLegend />
                <SimChart data={sim.data} maxBars={24} className="mt-3 h-40" />
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  Evolução em {sim.meses} {sim.meses === 1 ? "mês" : "meses"} rendendo {simRateText(sim)}, antes do Imposto de Renda
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Barra de abas */}
        <nav
          aria-label="Seções do MUVO Live"
          className="grid grid-cols-4 border-t border-border bg-background px-2 pt-1 shrink-0"
          style={{ paddingBottom: "calc(0.25rem + var(--safe-bottom))" }}
        >
          {[
            { id: "inicio" as const, label: "Início", icon: Home },
            { id: "investimentos" as const, label: "Investir", icon: Landmark },
            { id: "rebalancear" as const, label: "Rebalancear", icon: Scale },
            { id: "simular" as const, label: "Simular", icon: Calculator },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => goToTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl transition-colors ${FOCUS} ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-5 w-5" aria-hidden="true" />
                <span className={`text-[11px] ${active ? "font-bold" : "font-medium"}`}>{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Compra/aporte via Live (sobre a tela inteira) */}
        {marketOpen && (
          <div className="absolute inset-0 z-10 bg-background flex flex-col">
            <div
              className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin-dark px-5 pb-4"
              style={{ paddingTop: "calc(1rem + var(--safe-top))" }}
            >
              <SimulatorInvestFlow
                suggestedAmount={suggestedAmount}
                cash={cash}
                knownPrices={quoteMap}
                turboAccounts={turboAccountsLive}
                emergenciaAccounts={emergenciaAccountsLive}
                rendaFixaAccounts={investimentosAccountsLive}
                section={marketSection}
                onSectionChange={setMarketSection}
                onClose={() => setMarketOpen(false)}
                onBuyStock={actions.buyStock}
                onBuyFixedIncome={actions.buyFixedIncome}
                onAporte={actions.aporte}
                onCreateAccount={openNewCaixinha}
                onAdjustCash={openCashSheet}
              />
            </div>
          </div>
        )}
      </div>

      {/* Ajuste do saldo em conta */}
      <LiveSheet
        open={cashSheetOpen}
        onOpenChange={setCashSheetOpen}
        dismissible={!savingCash}
        title="Ajustar saldo em conta"
        description="Informe quanto você tem hoje na conta. A diferença é registrada como um lançamento de ajuste."
      >
        <form onSubmit={saveCash}>
          <label htmlFor="live-cash" className={LABEL}>Saldo atual</label>
          <div className={`${INPUT_BOX} mt-1.5`}>
            <span className="text-sm font-bold text-muted-foreground">R$</span>
            <input
              id="live-cash"
              autoFocus
              type="text"
              inputMode="numeric"
              value={cashInput}
              onChange={(e) => onCashMaskChange(e.target.value)}
              className="flex-1 min-w-0 bg-transparent font-display text-xl font-black tabular-nums text-foreground focus:outline-none"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 mb-5 min-h-4 tabular-nums" aria-live="polite">
            {cashChanged
              ? `Ajuste de ${cashDelta > 0 ? "+" : "−"}${formatCurrency(Math.abs(cashDelta))} em relação ao saldo registrado.`
              : "Sem alteração."}
          </p>
          <div className="space-y-2">
            <button type="submit" disabled={!cashChanged || savingCash} className={BTN_PRIMARY}>
              {savingCash ? "Salvando…" : "Salvar saldo"}
            </button>
            <button type="button" disabled={savingCash} onClick={() => setCashSheetOpen(false)} className={BTN_SECONDARY}>
              Cancelar
            </button>
          </div>
        </form>
      </LiveSheet>

      {/* Detalhe de conta real (turbo/emergência/renda fixa) */}
      <LiveSheet
        open={!!selectedFixedIncome}
        onOpenChange={(o) => !o && setSelectedFixedIncome(null)}
        title={selectedFixedIncome?.nome ?? "Conta"}
        description={
          selectedFixedIncome
            ? [
                selectedFixedIncome.isTurbo
                  ? "Turbo"
                  : emergenciaAccountsLive.some((a) => a.id === selectedFixedIncome.id)
                    ? "Reserva de emergência"
                    : isTesouroAccount(selectedFixedIncome.nome)
                    ? "Tesouro Direto"
                    : "Renda fixa",
                selectedFixedIncome.instituicao,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      >
        {selectedFixedIncome && (
          <>
            <div className="space-y-3 mb-5">
              <StatBox label="Valor investido">
                <p className={`${MONEY} text-xl`}>{formatCurrency(selectedFixedIncome.valor)}</p>
              </StatBox>
              {selectedFixedIncome.isTurbo &&
                (selectedFixedIncome.cdiPercent != null || selectedFixedIncome.maxRendimento != null) && (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedFixedIncome.cdiPercent != null && (
                      <StatBox label="% do CDI">
                        <p className={`${MONEY} text-base`}>
                          {selectedFixedIncome.cdiPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                        </p>
                      </StatBox>
                    )}
                    {selectedFixedIncome.maxRendimento != null && (
                      <StatBox label="Teto de rendimento">
                        <p className={`${MONEY} text-base`}>{formatCurrency(selectedFixedIncome.maxRendimento)}</p>
                      </StatBox>
                    )}
                  </div>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAporteAccount(selectedFixedIncome);
                  setSelectedFixedIncome(null);
                }}
                className={`${BTN_PRIMARY} col-span-2`}
              >
                Aplicar
              </button>
              <button
                type="button"
                disabled={selectedFixedIncome.valor <= 0}
                onClick={() => {
                  setWithdrawAccount(selectedFixedIncome);
                  setSelectedFixedIncome(null);
                }}
                className={BTN_SECONDARY}
              >
                Retirar
              </button>
              <button
                type="button"
                onClick={() => {
                  setUpdateAccount(selectedFixedIncome);
                  setSelectedFixedIncome(null);
                }}
                className={BTN_SECONDARY}
              >
                Atualizar valor
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteAccount(selectedFixedIncome);
                  setSelectedFixedIncome(null);
                }}
                className={`${BTN_DANGER_OUTLINE} col-span-2 inline-flex items-center justify-center gap-2`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Excluir caixinha
              </button>
            </div>
          </>
        )}
      </LiveSheet>

      {/* Excluir caixinha */}
      <LiveSheet
        open={!!deleteAccount}
        onOpenChange={(o) => !o && setDeleteAccount(null)}
        dismissible={!deleteSubmitting}
        title={deleteAccount ? `Excluir "${deleteAccount.nome}"?` : "Excluir caixinha"}
        description={
          deleteAccount && deleteAccount.valor > 0
            ? `O saldo de ${formatCurrency(deleteAccount.valor)} e todo o histórico desta caixinha serão apagados. Para manter o dinheiro, retire antes para o saldo em conta.`
            : "A caixinha e o histórico dela serão apagados. Esta ação não pode ser desfeita."
        }
      >
        <div className="space-y-2">
          <button type="button" disabled={deleteSubmitting} onClick={() => void confirmDeleteAccount()} className={BTN_DANGER}>
            {deleteSubmitting ? "Excluindo…" : "Excluir caixinha"}
          </button>
          <button type="button" disabled={deleteSubmitting} onClick={() => setDeleteAccount(null)} className={BTN_SECONDARY}>
            Cancelar
          </button>
        </div>
      </LiveSheet>

      {/* Detalhe de posição em ação/FII */}
      <LiveSheet
        open={!!selectedHolding}
        onOpenChange={(o) => !o && setSelectedTicker(null)}
        title={selectedHolding?.asset.ticker ?? "Posição"}
        description={
          selectedHolding
            ? `${selectedHolding.asset.name} · ${detectAssetType(selectedHolding.asset.ticker)}`
            : undefined
        }
      >
        {selectedHolding && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <StatBox label="Quantidade">
                <p className={`${MONEY} text-base`}>{formatQty(selectedHolding.h.quantity)}</p>
              </StatBox>
              <StatBox label="Preço médio">
                <p className={`${MONEY} text-base`}>{formatCurrency(selectedHolding.h.avgPrice)}</p>
              </StatBox>
              <StatBox label={selectedHolding.asset.isReal ? "Cotação atual" : "Preço de referência"}>
                <p className={`${MONEY} text-base`}>
                  {formatCurrency(selectedHolding.asset.price * (1 + selectedHolding.asset.variation))}
                </p>
              </StatBox>
              <StatBox label="Valor investido">
                <p className={`${MONEY} text-base`}>{formatCurrency(selectedHolding.cost)}</p>
              </StatBox>
            </div>
            {!selectedHolding.asset.isReal && (
              <p className="text-[11px] text-muted-foreground mb-3">
                Sem cotação ao vivo para este ativo. O valor usa o preço de referência.
              </p>
            )}

            <div className="mb-5">
              <StatBox label="Valor atual · resultado">
                <p className={`${MONEY} text-xl`}>{formatCurrency(selectedHolding.value)}</p>
                <p
                  className={`text-xs font-semibold mt-1 inline-flex items-center gap-1 tabular-nums ${
                    selectedHolding.gain >= 0 ? GAIN : LOSS
                  }`}
                >
                  {selectedHolding.gain >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {selectedHolding.gain >= 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(selectedHolding.gain))} ({formatPct(selectedHolding.gainPct)})
                </p>
              </StatBox>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  const { asset } = selectedHolding;
                  setSelectedTicker(null);
                  setOrder({ mode: "compra", ticker: asset.ticker, name: asset.name, price: asset.price * (1 + asset.variation) });
                }}
                className={BTN_PRIMARY}
              >
                Comprar mais
              </button>
              <button type="button" onClick={() => openSell(selectedHolding.asset.ticker)} className={BTN_DANGER_OUTLINE}>
                Vender
              </button>
            </div>
          </>
        )}
      </LiveSheet>

      <StockOrderSheet order={order} onClose={() => setOrder(null)} cash={cash} onBuy={actions.buyStock} onSell={actions.sellStock} />
      <AmountSheet
        open={!!aporteAccount}
        onOpenChange={(o) => !o && setAporteAccount(null)}
        title={aporteAccount ? `Aplicar em ${aporteAccount.nome}` : ""}
        description={aporteAccount ? `Hoje: ${formatCurrency(aporteAccount.valor)}` : undefined}
        cash={cash}
        onConfirm={(amount, source) => (aporteAccount ? actions.aporte(aporteAccount.id, amount, source) : Promise.resolve())}
      />
      <WithdrawSheet account={withdrawAccount} onClose={() => setWithdrawAccount(null)} onConfirm={actions.withdraw} />
      <UpdateValueSheet account={updateAccount} onClose={() => setUpdateAccount(null)} onConfirm={actions.updateValue} />
      <UndoSheet movement={undoMovement} onClose={() => setUndoMovement(null)} onConfirm={actions.undo} />

      {/* Nova caixinha */}
      <LiveSheet
        open={newCaixinhaOpen}
        onOpenChange={setNewCaixinhaOpen}
        dismissible={!newCaixinhaSubmitting}
        title="Nova caixinha"
        description="Crie uma conta de investimento para organizar seu dinheiro."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void confirmNewCaixinha();
          }}
        >
          <label htmlFor="live-cx-nome" className={LABEL}>Nome</label>
          <div className={`${INPUT_BOX} mt-1.5 mb-3`}>
            <input
              id="live-cx-nome"
              autoFocus
              type="text"
              value={newCaixinhaName}
              onChange={(e) => setNewCaixinhaName(e.target.value)}
              placeholder="Ex: CDB Banco Inter"
              className="flex-1 min-w-0 bg-transparent text-base font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </div>

          <p id="live-cx-tipo" className={`${LABEL} mb-2 flex items-center gap-1.5`}>Tipo de caixinha <TipoCaixinhaHelp /></p>
          <div role="radiogroup" aria-labelledby="live-cx-tipo" className="grid grid-cols-3 gap-2 mb-4">
            {(
              [
                { id: "turbo" as const, label: "Turbo", icon: Zap },
                { id: "emergencia" as const, label: "Emergência", icon: Shield },
                { id: "investimentos" as const, label: "Investimentos", icon: Landmark },
              ]
            ).map((opt) => {
              const active = newCaixinhaTipo === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setNewCaixinhaTipo(opt.id)}
                  className={`min-h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-colors ${FOCUS} ${
                    active
                      ? "border-foreground bg-muted text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <opt.icon className="h-4 w-4" aria-hidden="true" />
                  <span className="text-[11px] font-bold">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mb-4">
            <BankPicker
              id="live-cx"
              tipo={newCaixinhaTipo}
              institution={newCaixinhaInstituicao}
              onInstitutionChange={setNewCaixinhaInstituicao}
              onApply={applyBankProduct}
            />
          </div>

          {newCaixinhaTipo === "emergencia" &&
            newCaixinhaName.trim() &&
            !isEmergencyAccountName(newCaixinhaName.trim()) && (
              <p className="text-[11px] text-muted-foreground mb-4">
                Vai ser salva como{" "}
                <span className="font-semibold text-foreground/80">
                  &quot;{newCaixinhaName.trim()} (Emergência)&quot;
                </span>{" "}
                para entrar na caixinha Emergência.
              </p>
            )}

          {newCaixinhaTipo === "turbo" && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <label htmlFor="live-cx-cdi" className={LABEL}>% do CDI</label>
                  <CdiHelp />
                </div>
                <div className={`${INPUT_BOX} mt-1.5`}>
                  <input
                    id="live-cx-cdi"
                    type="text"
                    inputMode="decimal"
                    value={newCaixinhaCdiMask}
                    onChange={(e) => setNewCaixinhaCdiMask(formatPercentMask(e.target.value))}
                    placeholder="100"
                    className="flex-1 min-w-0 bg-transparent text-base font-bold tabular-nums text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">%</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <label htmlFor="live-cx-teto" className={LABEL}>Teto rendimento</label>
                  <TetoHelp />
                </div>
                <div className={`${INPUT_BOX} mt-1.5`}>
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">R$</span>
                  <input
                    id="live-cx-teto"
                    type="text"
                    inputMode="numeric"
                    value={newCaixinhaTetoMask}
                    onChange={(e) => setNewCaixinhaTetoMask(formatBRLMask(e.target.value.replace(/\D/g, "")))}
                    placeholder="0,00"
                    className="flex-1 min-w-0 bg-transparent text-base font-bold tabular-nums text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {newCaixinhaTipo !== "turbo" && (
            <div className="mb-4">
              <RateFields value={newCaixinhaRate} onChange={setNewCaixinhaRate} productName={newCaixinhaName} />
            </div>
          )}

          {(newCaixinhaInstituicao || newCaixinhaName.trim()) && (
            <div className="mb-3">
              <AskMuvoInline
                label="Perguntar ao Muvo se essa taxa está boa"
                question="Essa aplicação que estou cadastrando tem uma boa taxa? Compare com os outros bancos e diga se paga Imposto de Renda."
                resetKey={`${newCaixinhaTipo}|${newCaixinhaInstituicao}|${newCaixinhaName}|${newCaixinhaCdiMask}|${newCaixinhaRate.index}|${newCaixinhaRate.value}`}
              />
            </div>
          )}

          {newCaixinhaError && <p className={`text-xs mb-3 ${LOSS}`} role="alert">{newCaixinhaError}</p>}

          <div className="space-y-2">
            <button type="submit" disabled={!newCaixinhaName.trim() || newCaixinhaSubmitting} className={BTN_PRIMARY}>
              {newCaixinhaSubmitting ? "Criando…" : "Criar caixinha"}
            </button>
            <button
              type="button"
              disabled={newCaixinhaSubmitting}
              onClick={() => setNewCaixinhaOpen(false)}
              className={BTN_SECONDARY}
            >
              Cancelar
            </button>
          </div>
        </form>
      </LiveSheet>
    </div>
  );
}

