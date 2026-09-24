"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { X, TrendingUp, TrendingDown, Minus, Check, Plus, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { detectAssetType } from "@/lib/stock-utils";
import { CASH_ACCOUNT_NAME, isEmergencyAccountName } from "@/lib/account-groups";
import {
  createStockTrade,
  createInvestment,
  updateAccountBalance,
  createInvestmentAccount,
  createInvestmentAccountWithTurbo,
  deleteStockTrade,
  deleteInvestment,
  deleteInvestmentAccount,
} from "@/lib/api";
import {
  SimulatorInvestFlow,
  DEFAULT_TESOURO_PRODUCTS,
  type MarketSection,
  type TesouroProduct,
} from "@/components/investimentos/simulator-invest-flow";
import type { InvestorLiveViewProps } from "./investor-live-view";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatBRLMask(digits: string): string {
  const cleaned = digits.replace(/\D/g, "").slice(0, 12);
  const cents = parseInt(cleaned || "0", 10);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRLMask(masked: string): number {
  const cents = parseInt(masked.replace(/\D/g, "") || "0", 10);
  return cents / 100;
}

async function safeDelete(action: () => Promise<unknown>, label: string) {
  try {
    await action();
  } catch (err) {
    console.error(`Falha ao reverter ${label}:`, err);
  }
}

function fmtQty(n: number) {
  return n % 1 === 0 ? n.toString() : n.toFixed(2).replace(".", ",");
}

function PctBadge({ pct }: { pct: number }) {
  const pos = pct >= 0.005;
  const neg = pct <= -0.005;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
        pos ? "text-emerald-400" : neg ? "text-red-400" : "text-muted-foreground"
      }`}
    >
      {pos ? <TrendingUp className="h-3 w-3" /> : neg ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {pos ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground mb-3">{children}</p>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-muted/50 backdrop-blur-sm p-4 ${className}`}>
      {children}
    </div>
  );
}

export function InvestorLiveViewDesktop({
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

  /* ── Market / buy flow ────────────────────────────────────────── */
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketSection, setMarketSection] = useState<MarketSection>("hub");

  /* ── Sell flow ────────────────────────────────────────────────── */
  const [sellTicker, setSellTicker] = useState<string | null>(null);
  const [sellQtyMask, setSellQtyMask] = useState("");
  const [sellSubmitting, setSellSubmitting] = useState(false);
  const [sellError, setSellError] = useState<string | null>(null);

  /* ── Withdraw flow ────────────────────────────────────────────── */
  type AccountRef = { id: string; nome: string; instituicao: string; valor: number; isTurbo: boolean };
  const [withdrawAccount, setWithdrawAccount] = useState<AccountRef | null>(null);
  const [withdrawMask, setWithdrawMask] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  /* ── New caixinha flow ────────────────────────────────────────── */
  const [newCaixinhaOpen, setNewCaixinhaOpen] = useState(false);
  const [newCaixinhaTipo, setNewCaixinhaTipo] = useState<"turbo" | "emergencia" | "investimentos">("investimentos");
  const [newCaixinhaName, setNewCaixinhaName] = useState("");
  const [newCaixinhaInstituicao, setNewCaixinhaInstituicao] = useState("");
  const [newCaixinhaCdiMask, setNewCaixinhaCdiMask] = useState("");
  const [newCaixinhaTetoMask, setNewCaixinhaTetoMask] = useState("");
  const [newCaixinhaSubmitting, setNewCaixinhaSubmitting] = useState(false);
  const [newCaixinhaError, setNewCaixinhaError] = useState<string | null>(null);

  /* ── Feedback ────────────────────────────────────────────────── */
  const [confirmedFlash, setConfirmedFlash] = useState(false);

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashConfirm() {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setConfirmedFlash(true);
    flashTimerRef.current = setTimeout(() => setConfirmedFlash(false), 1600);
  }

  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); }, []);

  /* ── Derived: holdings ────────────────────────────────────────── */
  const holdingRows = useMemo(() => {
    return stockPositions
      .filter((p) => p.quantity > 0)
      .map((p) => {
        const price = quoteMap.get(p.ticker) ?? p.avgPrice;
        const value = p.quantity * price;
        const cost = p.quantity * p.avgPrice;
        const gain = value - cost;
        const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
        return { ticker: p.ticker, quantity: p.quantity, value, gain, gainPct, price, type: detectAssetType(p.ticker) };
      })
      .sort((a, b) => b.value - a.value);
  }, [stockPositions, quoteMap]);

  const investedValue = holdingRows.reduce((s, h) => s + h.value, 0);
  const investedCost = useMemo(
    () => stockPositions.filter((p) => p.quantity > 0).reduce((s, p) => s + p.quantity * p.avgPrice, 0),
    [stockPositions]
  );
  const totalGain = investedValue - investedCost;
  const totalGainPct = investedCost > 0 ? (totalGain / investedCost) * 100 : 0;

  const turboTotal = turboAccountsReal.reduce((s, a) => s + a.valor, 0);
  const emergenciaTotal = emergenciaAccountsReal.reduce((s, a) => s + a.valor, 0);
  const investimentosTotal = investimentosAccountsReal.reduce((s, a) => s + a.valor, 0);
  const patrimonioTotal = turboTotal + emergenciaTotal + investimentosTotal + investedValue + cashBalance;

  /* ── Market catalog (for SimulatorInvestFlow) ─────────────────── */
  const marketCatalog = useMemo(() => {
    const BASE = [
      { ticker: "PETR4", name: "Petrobras PN",      category: "Ação" as const, price: 38.5,  variation: 0.021,  color: "#e8e8e8" },
      { ticker: "VALE3", name: "Vale ON",            category: "Ação" as const, price: 61.2,  variation: -0.014, color: "#c4c4c4" },
      { ticker: "ITUB4", name: "Itaú Unibanco PN",   category: "Ação" as const, price: 34.1,  variation: 0.008,  color: "#a0a0a0" },
      { ticker: "BBAS3", name: "Banco do Brasil ON", category: "Ação" as const, price: 22.5,  variation: 0.04,   color: "#7c7c7c" },
      { ticker: "WEGE3", name: "WEG ON",             category: "Ação" as const, price: 48.2,  variation: 0.015,  color: "#5c5c5c" },
      { ticker: "MXRF11", name: "Maxi Renda",        category: "FII" as const,  price: 10.15, variation: 0.012,  color: "#444444" },
      { ticker: "HGLG11", name: "CSHG Logística",    category: "FII" as const,  price: 165.4, variation: 0.019,  color: "#303030" },
      { ticker: "XPML11", name: "XP Malls",          category: "FII" as const,  price: 98.5,  variation: 0.008,  color: "#202020" },
    ];
    const knownTickers = new Set(BASE.map((a) => a.ticker));
    const extras = stockPositions
      .filter((p) => p.quantity > 0 && !knownTickers.has(p.ticker))
      .map((p, i) => {
        const extraColors = ["#e8e8e8", "#a0a0a0", "#6c6c6c", "#484848", "#303030", "#1c1c1c"];
        const kind = detectAssetType(p.ticker);
        return {
          ticker: p.ticker,
          name: p.ticker,
          category: kind === "FII" ? ("FII" as const) : ("Ação" as const),
          price: quoteMap.get(p.ticker) ?? p.avgPrice,
          variation: 0,
          color: extraColors[i % extraColors.length],
        };
      });
    return [...BASE.map((a) => ({
      ...a,
      price: quoteMap.get(a.ticker) ?? a.price,
    })), ...extras];
  }, [stockPositions, quoteMap]);

  /* ── Sell helpers ─────────────────────────────────────────────── */
  const sellHolding = useMemo(() => {
    if (!sellTicker) return null;
    const h = holdingRows.find((x) => x.ticker === sellTicker);
    if (!h) return null;
    return h;
  }, [sellTicker, holdingRows]);

  const sellQty = (() => {
    const n = parseFloat(sellQtyMask.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  })();
  const sellProceeds = sellHolding ? sellQty * sellHolding.price : 0;
  const canConfirmSell =
    !!sellHolding && sellQty > 0 && sellQty <= sellHolding.quantity + 0.0001 && !sellSubmitting;

  function openSell(ticker: string) {
    setSellTicker(ticker);
    setSellQtyMask("");
    setSellError(null);
  }

  function onSellQtyChange(raw: string) {
    let v = raw.replace(/[^\d,]/g, "");
    const parts = v.split(",");
    if (parts.length > 2) v = parts[0] + "," + parts.slice(1).join("");
    setSellQtyMask(v);
  }

  /* ── Buy actions ──────────────────────────────────────────────── */
  async function handleBuyStock(ticker: string, _name: string, price: number, amount: number) {
    if (!cashAccountId || amount <= 0 || amount > cashBalance + 0.001 || price <= 0) return;
    const qty = Math.floor(amount / price);
    if (qty < 1) throw new Error(`Valor insuficiente para 1 ação de ${ticker} (${formatCurrency(price)}).`);
    const spent = qty * price;
    const trade = await createStockTrade({
      ticker,
      type: "compra",
      quantity: qty,
      price_per_share: price,
      total_amount: spent,
      date: today(),
    });
    try {
      await createInvestment({
        account_id: cashAccountId,
        type: "retirada",
        amount: spent,
        description: `Compra ${ticker}`,
        date: today(),
      });
    } catch (err) {
      await safeDelete(() => deleteStockTrade(trade.id), "compra de ação");
      throw err;
    }
    await onRefresh();
    flashConfirm();
  }

  async function handleBuyTesouro(product: TesouroProduct, amount: number) {
    if (!cashAccountId || amount <= 0 || amount > cashBalance + 0.001) return;
    const existing = investimentosAccountsReal.find((a) => a.nome === product.nome);
    const previousBalance = existing?.valor ?? 0;
    let accountId: string;
    let createdAccount = false;

    if (existing) {
      accountId = existing.id;
    } else {
      const acc = await createInvestmentAccount({ name: product.nome, institution: product.taxa });
      accountId = acc.id;
      createdAccount = true;
    }

    let depositRecordId: string | null = null;
    try {
      const depositRecord = await createInvestment({
        account_id: accountId,
        type: "deposito",
        amount,
        description: "Compra Tesouro Direto",
        date: today(),
      });
      depositRecordId = depositRecord.id;
      await updateAccountBalance(accountId, previousBalance + amount);
      await createInvestment({
        account_id: cashAccountId,
        type: "retirada",
        amount,
        description: `Compra ${product.nome}`,
        date: today(),
      });
    } catch (err) {
      if (createdAccount) {
        await safeDelete(() => deleteInvestmentAccount(accountId), "conta de Tesouro criada");
      } else {
        await safeDelete(() => updateAccountBalance(accountId, previousBalance), "saldo do Tesouro");
        if (depositRecordId) await safeDelete(() => deleteInvestment(depositRecordId!), "depósito do Tesouro");
      }
      throw err;
    }
    await onRefresh();
    flashConfirm();
  }

  async function handleAporte(accountId: string, amount: number) {
    if (!cashAccountId || amount <= 0 || amount > cashBalance + 0.001) return;
    const acc = [...turboAccountsReal, ...emergenciaAccountsReal, ...investimentosAccountsReal].find(
      (a) => a.id === accountId
    );
    if (!acc) return;
    const depositRecord = await createInvestment({
      account_id: accountId,
      type: "deposito",
      amount,
      description: `Aporte · ${acc.nome}`,
      date: today(),
    });
    try {
      await updateAccountBalance(accountId, acc.valor + amount);
      await createInvestment({
        account_id: cashAccountId,
        type: "retirada",
        amount,
        description: `Aporte · ${acc.nome}`,
        date: today(),
      });
    } catch (err) {
      await safeDelete(() => updateAccountBalance(accountId, acc.valor), "saldo do aporte");
      await safeDelete(() => deleteInvestment(depositRecord.id), "depósito do aporte");
      throw err;
    }
    await onRefresh();
    flashConfirm();
  }

  async function confirmSell() {
    if (!sellHolding || !canConfirmSell) return;
    setSellSubmitting(true);
    setSellError(null);
    const ticker = sellHolding.ticker;
    const price = sellHolding.price;
    const amount = sellQty * price;
    let cid = cashAccountId;
    let cashRecordId: string | null = null;
    try {
      if (!cid) {
        const acc = await createInvestmentAccount({ name: CASH_ACCOUNT_NAME, institution: "Carteira" });
        cid = acc.id;
      }
      const cashRecord = await createInvestment({
        account_id: cid,
        type: "deposito",
        amount,
        description: `Venda ${ticker}`,
        date: today(),
      });
      cashRecordId = cashRecord.id;
      await createStockTrade({
        ticker,
        type: "venda",
        quantity: sellQty,
        price_per_share: price,
        total_amount: amount,
        date: today(),
      });
      await onRefresh();
      flashConfirm();
      setSellTicker(null);
    } catch (err) {
      console.error("Erro ao vender:", err);
      if (cashRecordId) await safeDelete(() => deleteInvestment(cashRecordId!), "crédito da venda");
      setSellError(err instanceof Error ? err.message : "Não foi possível concluir a venda. Tente novamente.");
    } finally {
      setSellSubmitting(false);
    }
  }

  /* ── Withdraw ─────────────────────────────────────────────────── */
  const withdrawAmount = parseBRLMask(withdrawMask);
  const canConfirmWithdraw =
    !!withdrawAccount &&
    withdrawAmount > 0 &&
    withdrawAmount <= withdrawAccount.valor + 0.001 &&
    !withdrawSubmitting;

  function openWithdraw(acc: AccountRef) {
    setWithdrawAccount(acc);
    setWithdrawMask("");
    setWithdrawError(null);
  }

  async function confirmWithdraw() {
    if (!withdrawAccount || !canConfirmWithdraw) return;
    setWithdrawSubmitting(true);
    setWithdrawError(null);
    try {
      let cid = cashAccountId;
      if (!cid) {
        const acc = await createInvestmentAccount({ name: CASH_ACCOUNT_NAME, institution: "Carteira" });
        cid = acc.id;
      }
      await createInvestment({
        account_id: withdrawAccount.id,
        type: "retirada",
        amount: withdrawAmount,
        description: `Retirada · ${withdrawAccount.nome}`,
        date: today(),
      });
      await updateAccountBalance(withdrawAccount.id, withdrawAccount.valor - withdrawAmount);
      await createInvestment({
        account_id: cid,
        type: "deposito",
        amount: withdrawAmount,
        description: `Retirada de ${withdrawAccount.nome}`,
        date: today(),
      });
      await onRefresh();
      flashConfirm();
      setWithdrawAccount(null);
    } catch (err) {
      console.error("Erro ao retirar:", err);
      setWithdrawError(err instanceof Error ? err.message : "Não foi possível retirar. Tente novamente.");
    } finally {
      setWithdrawSubmitting(false);
    }
  }

  /* ── New caixinha ─────────────────────────────────────────────── */
  function openNewCaixinha(tipo: "turbo" | "emergencia" | "investimentos") {
    setNewCaixinhaTipo(tipo);
    setNewCaixinhaName("");
    setNewCaixinhaInstituicao("");
    setNewCaixinhaCdiMask("");
    setNewCaixinhaTetoMask("");
    setNewCaixinhaError(null);
    setNewCaixinhaOpen(true);
  }

  async function confirmNewCaixinha() {
    const name = newCaixinhaName.trim();
    if (!name || newCaixinhaSubmitting) return;
    setNewCaixinhaSubmitting(true);
    setNewCaixinhaError(null);
    try {
      const finalName =
        newCaixinhaTipo === "emergencia" && !isEmergencyAccountName(name)
          ? `${name} (Emergência)`
          : name;
      const cdi = parseBRLMask(newCaixinhaCdiMask);
      const teto = parseBRLMask(newCaixinhaTetoMask);
      await createInvestmentAccountWithTurbo({
        name: finalName,
        institution: newCaixinhaInstituicao.trim() || "—",
        is_turbo: newCaixinhaTipo === "turbo",
        cdi_percent: newCaixinhaTipo === "turbo" && cdi > 0 ? cdi : null,
        max_rendimento: newCaixinhaTipo === "turbo" && teto > 0 ? teto : null,
      });
      await onRefresh();
      flashConfirm();
      setNewCaixinhaOpen(false);
    } catch (err) {
      console.error("Erro ao criar caixinha:", err);
      setNewCaixinhaError("Não foi possível criar a caixinha. Tente novamente.");
    } finally {
      setNewCaixinhaSubmitting(false);
    }
  }

  /* ── Derived: movements ───────────────────────────────────────── */
  const movements = useMemo(() => {
    const items: { id: string; title: string; sub: string; amount: number; date: string }[] = [];
    for (const t of stockTrades) {
      items.push({ id: `s-${t.id}`, title: `${t.type === "venda" ? "Venda" : "Compra"} ${t.ticker}`, sub: "Bolsa", amount: t.total_amount, date: t.date.split("-").reverse().join("/") });
    }
    const lookup = new Map(
      [...turboAccountsReal, ...emergenciaAccountsReal, ...investimentosAccountsReal].map((a) => [a.id, a])
    );
    for (const inv of investments) {
      if (inv.type !== "deposito" || inv.account_id === cashAccountId) continue;
      const acc = lookup.get(inv.account_id);
      if (!acc) continue;
      const group = acc.isTurbo ? "Turbo" : emergenciaAccountsReal.some((e) => e.id === acc.id) ? "Emergência" : "Renda Fixa";
      items.push({ id: `i-${inv.id}`, title: `Aporte · ${acc.nome}`, sub: group, amount: inv.amount, date: inv.date.split("-").reverse().join("/") });
    }
    return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);
  }, [stockTrades, investments, cashAccountId, turboAccountsReal, emergenciaAccountsReal, investimentosAccountsReal]);

  /* ── Derived: allocation ──────────────────────────────────────── */
  const allocation = useMemo(() => {
    const base = patrimonioTotal || 1;
    return [
      { label: "TURBO", value: turboTotal, color: "#a855f7", pct: (turboTotal / base) * 100 },
      { label: "Emergência", value: emergenciaTotal, color: "#06b6d4", pct: (emergenciaTotal / base) * 100 },
      { label: "Renda Fixa", value: investimentosTotal, color: "#3b82f6", pct: (investimentosTotal / base) * 100 },
      { label: "Bolsa", value: investedValue, color: "#10b981", pct: (investedValue / base) * 100 },
      { label: "Saldo Livre", value: cashBalance, color: "#94a3b8", pct: (cashBalance / base) * 100 },
    ].filter((x) => x.value > 0);
  }, [patrimonioTotal, turboTotal, emergenciaTotal, investimentosTotal, investedValue, cashBalance]);

  /* ── Simulator ────────────────────────────────────────────────── */
  const [simInicial, setSimInicial] = useState(() => Math.max(Math.round(grandTotal), 1000));
  const [simMensal, setSimMensal] = useState(300);
  const [simMeses, setSimMeses] = useState(24);
  const [simTaxa, setSimTaxa] = useState(0.9);

  const simData = useMemo(() => {
    const rate = simTaxa / 100;
    const pts: { month: number; value: number }[] = [{ month: 0, value: simInicial }];
    let v = simInicial;
    for (let m = 1; m <= simMeses; m++) {
      v = v * (1 + rate) + simMensal;
      pts.push({ month: m, value: v });
    }
    return pts;
  }, [simInicial, simMensal, simMeses, simTaxa]);

  const simFinal = simData[simData.length - 1]?.value ?? 0;
  const simAportado = simInicial + simMensal * simMeses;
  const simRendimento = simFinal - simAportado;
  const simMax = Math.max(1, ...simData.map((p) => p.value));
  const barStep = Math.max(1, Math.floor(simData.length / 30));

  /* ── Tabs ─────────────────────────────────────────────────────── */
  const tabs = [
    { id: "inicio" as const, label: "Início" },
    { id: "investimentos" as const, label: "Investimentos" },
    { id: "simular" as const, label: "Simular" },
  ];

  return (
    <div className="flex flex-col h-full bg-background text-foreground relative overflow-hidden select-none">
      {/* Ambient mesh */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-muted/50 blur-[140px]" />
        <div className="absolute top-1/3 -right-20 h-[400px] w-[400px] rounded-full bg-card blur-[130px]" />
        <div className="absolute bottom-0 left-1/2 h-[350px] w-[350px] rounded-full bg-muted/20 blur-[130px]" />
      </div>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-between px-7 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-foreground/55">
              MUVO · LIVE
            </span>
          </div>

          <div
            role="tablist"
            onKeyDown={(e) => {
              const idx = tabs.findIndex((t) => t.id === tab);
              if (e.key === "ArrowRight") { e.preventDefault(); setTab(tabs[(idx + 1) % tabs.length].id); }
              if (e.key === "ArrowLeft") { e.preventDefault(); setTab(tabs[(idx - 1 + tabs.length) % tabs.length].id); }
            }}
            className="flex items-center gap-1 bg-muted/40 rounded-full p-1"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  tab === t.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Comprar button */}
          <button
            onClick={() => { setMarketSection("hub"); setMarketOpen(true); }}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-semibold transition-all shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Comprar / Aportar
          </button>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="h-9 w-9 flex items-center justify-center rounded-full bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground/80 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────── */}
      <div className="relative grid grid-cols-4 divide-x divide-border border-b border-border shrink-0">
        {[
          { label: "Patrimônio total", value: formatCurrency(patrimonioTotal), sub: null, accent: false },
          { label: "Saldo livre", value: formatCurrency(cashBalance), sub: null, accent: true },
          {
            label: "Ganho em bolsa",
            value: (totalGain >= 0 ? "+" : "") + formatCurrency(totalGain),
            sub: (totalGainPct >= 0 ? "+" : "") + totalGainPct.toFixed(2) + "%",
            accent: totalGain !== 0,
            positive: totalGain >= 0,
          },
          { label: "Ativos em bolsa", value: holdingRows.length.toString(), sub: "posições", accent: false },
        ].map((kpi, i) => (
          <div key={i} className="px-6 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">{kpi.label}</p>
            <p
              className={`text-xl font-black font-display tabular-nums ${
                kpi.accent
                  ? "positive" in kpi
                    ? kpi.positive
                      ? "text-emerald-400"
                      : "text-red-400"
                    : "text-foreground"
                  : "text-foreground"
              }`}
            >
              {kpi.value}
            </p>
            {kpi.sub && (
              <p className={`text-xs mt-0.5 ${
                "positive" in kpi
                  ? kpi.positive ? "text-emerald-400/60" : "text-red-400/60"
                  : "text-muted-foreground"
              }`}>
                {kpi.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Content area ──────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-y-auto">

        {/* ═══ INÍCIO ═══════════════════════════════════════════════ */}
        {tab === "inicio" && (
          <div className="grid grid-cols-[280px_1fr_1fr] gap-0 h-full divide-x divide-border">

            {/* Left: Allocation */}
            <div className="p-6 overflow-y-auto scrollbar-thin-dark">
              <SectionHeading>Distribuição</SectionHeading>

              <div className="flex h-2.5 rounded-full overflow-hidden mb-4 gap-px">
                {allocation.map((a) => (
                  <div
                    key={a.label}
                    className="h-full transition-all"
                    style={{ width: `${a.pct}%`, backgroundColor: a.color }}
                  />
                ))}
              </div>

              <div className="space-y-4">
                {allocation.map((a) => (
                  <div key={a.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                        <span className="text-sm text-foreground/70">{a.label}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums">{a.pct.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 h-1 bg-muted/50 rounded-full overflow-hidden mr-3">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${a.pct}%`, backgroundColor: a.color, opacity: 0.7 }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground tabular-nums w-24 text-right">
                        {formatCurrency(a.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-5 border-t border-border">
                <SectionHeading>Saldo disponível</SectionHeading>
                <p className="text-2xl font-black font-display text-foreground tabular-nums">{formatCurrency(cashBalance)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Para novos aportes</p>
                <button
                  onClick={() => { setMarketSection("hub"); setMarketOpen(true); }}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-all"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Investir agora
                </button>
              </div>
            </div>

            {/* Center: Holdings */}
            <div className="p-6 overflow-y-auto scrollbar-thin-dark">
              <div className="flex items-center justify-between mb-3">
                <SectionHeading>Posições em bolsa</SectionHeading>
                <button
                  onClick={() => { setMarketSection("acoes"); setMarketOpen(true); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-foreground/70 transition-colors uppercase tracking-wider"
                >
                  <Plus className="h-3 w-3" /> Comprar ação
                </button>
              </div>
              {holdingRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-muted-foreground/60 text-sm">Nenhuma posição em bolsa</p>
                  <button
                    onClick={() => { setMarketSection("acoes"); setMarketOpen(true); }}
                    className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground/70 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Comprar primeira ação
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {holdingRows.map((h) => (
                    <div
                      key={h.ticker}
                      className="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-foreground/60">{h.ticker.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{h.ticker}</p>
                          <p className="text-[11px] text-muted-foreground">{h.type} · {fmtQty(h.quantity)} un.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-black font-display tabular-nums">{formatCurrency(h.value)}</p>
                          <PctBadge pct={h.gainPct} />
                        </div>
                        <button
                          onClick={() => openSell(h.ticker)}
                          aria-label={`Vender ${h.ticker}`}
                          className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-500 dark:text-red-400 text-[11px] font-semibold hover:bg-red-500/25 hover:text-red-600 dark:hover:text-red-300 transition-all"
                        >
                          Vender
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="mt-3 pt-3 border-t border-border flex justify-between items-center px-1">
                    <span className="text-xs text-muted-foreground">Total bolsa</span>
                    <div className="text-right">
                      <p className="text-sm font-black font-display tabular-nums">{formatCurrency(investedValue)}</p>
                      <PctBadge pct={totalGainPct} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Movements */}
            <div className="p-6 overflow-y-auto scrollbar-thin-dark">
              <SectionHeading>Últimas movimentações</SectionHeading>
              {movements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-muted-foreground/60 text-sm">Sem movimentações</p>
                </div>
              ) : (
                <div className="space-y-px">
                  {movements.map((mov) => (
                    <div
                      key={mov.id}
                      className="flex items-center justify-between px-1 py-3 border-b border-border last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-foreground/80 truncate">{mov.title}</p>
                        <p className="text-[11px] text-muted-foreground">{mov.sub} · {mov.date}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-foreground/70 shrink-0 ml-4">
                        {formatCurrency(mov.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ INVESTIMENTOS ════════════════════════════════════════ */}
        {tab === "investimentos" && (
          <div className="grid grid-cols-3 gap-0 h-full divide-x divide-border">

            {/* TURBO */}
            <div className="p-6 overflow-y-auto scrollbar-thin-dark">
              <div className="flex items-center justify-between mb-4">
                <SectionHeading>TURBO</SectionHeading>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{formatCurrency(turboTotal)}</span>
                  <button
                    onClick={() => { setMarketSection("turbo"); setMarketOpen(true); }}
                    className="flex items-center gap-0.5 h-6 px-2 rounded-lg bg-muted/40 border border-border text-muted-foreground text-[10px] font-bold hover:bg-muted/60 hover:text-foreground/70 transition-all"
                  >
                    <Plus className="h-3 w-3" /> Aportar
                  </button>
                  <button
                    onClick={() => openNewCaixinha("turbo")}
                    className="flex items-center gap-0.5 h-6 px-2 rounded-lg bg-muted/40 border border-border text-muted-foreground text-[10px] font-bold hover:bg-muted/60 hover:text-foreground/70 transition-all"
                  >
                    <Plus className="h-3 w-3" /> Nova
                  </button>
                </div>
              </div>
              {turboAccountsReal.length === 0 ? (
                <p className="text-sm text-muted-foreground/60">Nenhuma conta TURBO.</p>
              ) : (
                <div className="space-y-2">
                  {turboAccountsReal.map((acc) => (
                    <Card key={acc.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground/90 truncate">{acc.nome}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{acc.instituicao}</p>
                        </div>
                        <p className="text-sm font-bold tabular-nums text-foreground/80 shrink-0">{formatCurrency(acc.valor)}</p>
                      </div>
                      {acc.cdiPercent && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <span className="text-[10px] bg-muted/50 text-muted-foreground rounded-full px-2 py-0.5 font-semibold">
                            {acc.cdiPercent}% CDI
                          </span>
                          {acc.maxRendimento && (
                            <span className="text-[10px] bg-muted/50 text-muted-foreground rounded-full px-2 py-0.5">
                              Teto {formatCurrency(acc.maxRendimento)}
                            </span>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => openWithdraw(acc)}
                        className="mt-3 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-muted/50 border border-border text-muted-foreground text-[11px] font-semibold hover:bg-muted/70 hover:text-foreground/70 transition-all"
                      >
                        Retirar
                      </button>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Emergência */}
            <div className="p-6 overflow-y-auto scrollbar-thin-dark">
              <div className="flex items-center justify-between mb-4">
                <SectionHeading>Emergência</SectionHeading>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{formatCurrency(emergenciaTotal)}</span>
                  <button
                    onClick={() => { setMarketSection("eme"); setMarketOpen(true); }}
                    className="flex items-center gap-0.5 h-6 px-2 rounded-lg bg-muted/40 border border-border text-muted-foreground text-[10px] font-bold hover:bg-muted/60 hover:text-foreground/70 transition-all"
                  >
                    <Plus className="h-3 w-3" /> Aportar
                  </button>
                  <button
                    onClick={() => openNewCaixinha("emergencia")}
                    className="flex items-center gap-0.5 h-6 px-2 rounded-lg bg-muted/40 border border-border text-muted-foreground text-[10px] font-bold hover:bg-muted/60 hover:text-foreground/70 transition-all"
                  >
                    <Plus className="h-3 w-3" /> Nova
                  </button>
                </div>
              </div>
              {emergenciaAccountsReal.length === 0 ? (
                <p className="text-sm text-muted-foreground/60">Nenhuma conta de emergência.</p>
              ) : (
                <div className="space-y-2">
                  {emergenciaAccountsReal.map((acc) => (
                    <Card key={acc.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground/90 truncate">{acc.nome}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{acc.instituicao}</p>
                        </div>
                        <p className="text-sm font-bold tabular-nums text-foreground/80 shrink-0">{formatCurrency(acc.valor)}</p>
                      </div>
                      <button
                        onClick={() => openWithdraw(acc)}
                        className="mt-3 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-muted/50 border border-border text-muted-foreground text-[11px] font-semibold hover:bg-muted/70 hover:text-foreground/70 transition-all"
                      >
                        Retirar
                      </button>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Renda Fixa + Bolsa */}
            <div className="p-6 overflow-y-auto scrollbar-thin-dark">
              <div className="flex items-center justify-between mb-4">
                <SectionHeading>Renda Fixa & Bolsa</SectionHeading>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                    {formatCurrency(investimentosTotal + investedValue)}
                  </span>
                  <button
                    onClick={() => { setMarketSection("tesouro"); setMarketOpen(true); }}
                    className="flex items-center gap-0.5 h-6 px-2 rounded-lg bg-muted/40 border border-border text-muted-foreground text-[10px] font-bold hover:bg-muted/60 hover:text-foreground/70 transition-all"
                  >
                    <Plus className="h-3 w-3" /> Investir
                  </button>
                  <button
                    onClick={() => openNewCaixinha("investimentos")}
                    className="flex items-center gap-0.5 h-6 px-2 rounded-lg bg-muted/40 border border-border text-muted-foreground text-[10px] font-bold hover:bg-muted/60 hover:text-foreground/70 transition-all"
                  >
                    <Plus className="h-3 w-3" /> Nova
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {investimentosAccountsReal.map((acc) => (
                  <Card key={acc.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground/90 truncate">{acc.nome}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{acc.instituicao}</p>
                      </div>
                      <p className="text-sm font-bold tabular-nums text-foreground/80 shrink-0">{formatCurrency(acc.valor)}</p>
                    </div>
                    <button
                      onClick={() => openWithdraw(acc)}
                      className="mt-3 w-full flex items-center justify-center gap-1 py-1.5 rounded-lg bg-muted/50 border border-border text-muted-foreground text-[11px] font-semibold hover:bg-muted/70 hover:text-foreground/70 transition-all"
                    >
                      Retirar
                    </button>
                  </Card>
                ))}

                {holdingRows.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground pt-3 pb-1">Bolsa</p>
                    {holdingRows.map((h) => (
                      <Card key={h.ticker}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground/90">{h.ticker}</p>
                            <p className="text-[11px] text-muted-foreground">{h.type} · {fmtQty(h.quantity)} un.</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-bold tabular-nums text-foreground/80">{formatCurrency(h.value)}</p>
                              <PctBadge pct={h.gainPct} />
                            </div>
                            <button
                              onClick={() => openSell(h.ticker)}
                              className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition-all"
                            >
                              Vender
                            </button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ SIMULAR ══════════════════════════════════════════════ */}
        {tab === "simular" && (
          <div className="grid grid-cols-[360px_1fr] gap-0 h-full divide-x divide-border">

            {/* Controls */}
            <div className="p-6 overflow-y-auto scrollbar-thin-dark space-y-6">
              <SectionHeading>Parâmetros da simulação</SectionHeading>

              {[
                {
                  label: "Capital inicial",
                  value: formatCurrency(simInicial),
                  min: 0,
                  max: Math.max(200000, Math.ceil(grandTotal * 2 / 10000) * 10000),
                  step: 500,
                  current: simInicial,
                  set: setSimInicial,
                },
                {
                  label: "Aporte mensal",
                  value: formatCurrency(simMensal),
                  min: 0,
                  max: 10000,
                  step: 50,
                  current: simMensal,
                  set: setSimMensal,
                },
                {
                  label: "Período",
                  value: `${simMeses} meses`,
                  min: 6,
                  max: 120,
                  step: 6,
                  current: simMeses,
                  set: setSimMeses,
                },
                {
                  label: "Taxa mensal",
                  value: `${simTaxa.toFixed(2)}% a.m.`,
                  min: 0.1,
                  max: 3,
                  step: 0.05,
                  current: simTaxa,
                  set: setSimTaxa,
                },
              ].map((param) => (
                <div key={param.label}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">{param.label}</span>
                    <span className="font-semibold text-foreground">{param.value}</span>
                  </div>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={param.current}
                    onChange={(e) => param.set(Number(e.target.value) as never)}
                    aria-label={param.label}
                    className="w-full h-1.5 appearance-none rounded-full bg-muted/10 accent-white cursor-pointer"
                  />
                </div>
              ))}

              {/* Result KPIs */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                {[
                  { label: "Valor final", value: formatCurrency(simFinal), color: "text-foreground" },
                  { label: "Rendimento", value: formatCurrency(simRendimento), color: "text-foreground/70" },
                  { label: "Total aportado", value: formatCurrency(simAportado), color: "text-foreground" },
                  {
                    label: "Retorno %",
                    value: `${simAportado > 0 ? ((simRendimento / simAportado) * 100).toFixed(1) : "0"}%`,
                    color: "text-foreground",
                  },
                ].map((r) => (
                  <Card key={r.label} className="!p-3.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{r.label}</p>
                    <p className={`text-base font-black font-display tabular-nums ${r.color}`}>{r.value}</p>
                  </Card>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div className="p-6 flex flex-col">
              <SectionHeading>Projeção patrimonial</SectionHeading>

              <div className="flex-1 flex flex-col">
                <div className="flex-1 flex items-end gap-[2px] min-h-0">
                  {simData
                    .filter((_, i) => i % barStep === 0 || i === simData.length - 1)
                    .map((p) => {
                      const h = (p.value / simMax) * 100;
                      const isLast = p.month === simMeses;
                      return (
                        <div
                          key={p.month}
                          className="flex-1 relative group rounded-t transition-all"
                          style={{
                            height: `${h}%`,
                            background: isLast
                              ? "hsl(var(--foreground) / 0.7)"
                              : "hsl(var(--foreground) / 0.15)",
                          }}
                        >
                          <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                            <div className="bg-card border border-border text-foreground text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap">
                              <p className="text-muted-foreground">Mês {p.month}</p>
                              <p className="font-bold">{formatCurrency(p.value)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="flex justify-between text-[11px] text-muted-foreground/60 mt-3">
                  <span>Agora</span>
                  <span>Mês {Math.floor(simMeses / 2)}</span>
                  <span>Mês {simMeses}</span>
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted/50 border border-border px-4 py-3">
                  <div className="h-2 w-2 rounded-full bg-muted/50 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Em {simMeses} meses, seu patrimônio pode chegar a{" "}
                      <span className="font-bold text-foreground/80">{formatCurrency(simFinal)}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      Rendendo {simTaxa.toFixed(2)}% ao mês · aportando {formatCurrency(simMensal)}/mês
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Market overlay ────────────────────────────────────────── */}
      {marketOpen && (
        <div className="absolute inset-0 z-20 bg-background flex flex-col">
          {/* Header inside overlay */}
          <div className="flex items-center justify-between px-7 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-black uppercase tracking-[0.22em] text-foreground/55">MUVO · LIVE</span>
            </div>
            <button
              onClick={() => setMarketOpen(false)}
              aria-label="Fechar"
              className="h-9 w-9 flex items-center justify-center rounded-full bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground/80 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Flow content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-7 pt-4 pb-6">
            <SimulatorInvestFlow
              cash={cashBalance}
              catalog={marketCatalog}
              tesouroProducts={DEFAULT_TESOURO_PRODUCTS}
              turboAccounts={turboAccountsReal}
              emergenciaAccounts={emergenciaAccountsReal}
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

      {/* ── Sell modal ────────────────────────────────────────────── */}
      {sellTicker && sellHolding && (
        <div
          className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center"
          onClick={() => !sellSubmitting && setSellTicker(null)}
          onKeyDown={(e) => e.key === "Escape" && !sellSubmitting && setSellTicker(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sell-modal-title"
            className="w-full max-w-sm rounded-2xl bg-background border border-border p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-400/60 mb-0.5">Vender posição</p>
                <p id="sell-modal-title" className="text-lg font-bold text-foreground">{sellHolding.ticker}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmtQty(sellHolding.quantity)} un. · {formatCurrency(sellHolding.price)}/un.
                </p>
              </div>
              <button
                onClick={() => !sellSubmitting && setSellTicker(null)}
                aria-label="Fechar"
                className="h-9 w-9 flex items-center justify-center rounded-full bg-muted/40 text-muted-foreground hover:text-foreground/80 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4">
              <label htmlFor="sell-qty" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                Quantidade a vender
              </label>
              <div className="flex gap-2">
                <input
                  id="sell-qty"
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={sellQtyMask}
                  onChange={(e) => onSellQtyChange(e.target.value)}
                  placeholder="0"
                  className="flex-1 rounded-xl border border-border bg-muted/40 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-red-400/40 focus:border-red-400/50 text-sm font-semibold tabular-nums"
                />
                <button
                  onClick={() => sellHolding && setSellQtyMask(fmtQty(sellHolding.quantity).replace(".", ","))}
                  className="px-3 rounded-xl border border-border bg-muted/50 text-muted-foreground text-xs font-semibold hover:text-foreground/70 hover:bg-muted/70 transition-all"
                >
                  Tudo
                </button>
              </div>
              {sellQty > 0 && sellQty <= sellHolding.quantity + 0.0001 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Você receberá{" "}
                  <span className="font-semibold text-foreground/80">{formatCurrency(sellProceeds)}</span>
                </p>
              )}
              {sellQty > sellHolding.quantity + 0.0001 && (
                <p className="text-xs text-red-400 mt-2">Quantidade maior que a posição atual.</p>
              )}
            </div>

            {sellError && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded-xl px-3 py-2 mb-3">{sellError}</p>
            )}

            <button
              disabled={!canConfirmSell}
              onClick={confirmSell}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 text-foreground text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-400 transition-all"
            >
              {sellSubmitting ? (
                <span className="h-4 w-4 rounded-full border-2 border-border border-t-white animate-spin" />
              ) : null}
              {sellSubmitting ? "Vendendo..." : `Confirmar venda de ${sellQty > 0 ? fmtQty(sellQty) : "—"} ${sellHolding.ticker}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Withdraw modal ───────────────────────────────────────── */}
      {withdrawAccount && (
        <div
          className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center"
          onClick={() => !withdrawSubmitting && setWithdrawAccount(null)}
          onKeyDown={(e) => e.key === "Escape" && !withdrawSubmitting && setWithdrawAccount(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-modal-title"
            className="w-full max-w-sm rounded-2xl bg-background border border-border p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-0.5">Retirar da caixinha</p>
                <p id="withdraw-modal-title" className="text-lg font-bold text-foreground">{withdrawAccount.nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Disponível: {formatCurrency(withdrawAccount.valor)}
                </p>
              </div>
              <button
                onClick={() => !withdrawSubmitting && setWithdrawAccount(null)}
                aria-label="Fechar"
                className="h-9 w-9 flex items-center justify-center rounded-full bg-muted/40 text-muted-foreground hover:text-foreground/80 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4">
              <label htmlFor="withdraw-amount" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                Valor a retirar
              </label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 focus-within:ring-1 focus-within:ring-foreground/30">
                  <span className="text-muted-foreground text-sm shrink-0">R$</span>
                  <input
                    id="withdraw-amount"
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={withdrawMask}
                    onChange={(e) => setWithdrawMask(formatBRLMask(e.target.value.replace(/\D/g, "")))}
                    placeholder="0,00"
                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm font-semibold tabular-nums"
                  />
                </div>
                <button
                  onClick={() => setWithdrawMask(formatBRLMask((withdrawAccount.valor * 100).toFixed(0)))}
                  className="px-3 rounded-xl border border-border bg-muted/50 text-muted-foreground text-xs font-semibold hover:text-foreground/70 hover:bg-muted/70 transition-all"
                >
                  Tudo
                </button>
              </div>
              {withdrawAmount > withdrawAccount.valor + 0.001 && (
                <p className="text-xs text-red-400 mt-2">Valor maior que o saldo disponível.</p>
              )}
            </div>

            {withdrawError && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded-xl px-3 py-2 mb-3">{withdrawError}</p>
            )}

            <button
              disabled={!canConfirmWithdraw}
              onClick={confirmWithdraw}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-muted/50 text-foreground text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/65 transition-all"
            >
              {withdrawSubmitting ? (
                <span className="h-4 w-4 rounded-full border-2 border-border border-t-white animate-spin" />
              ) : null}
              {withdrawSubmitting ? "Retirando..." : `Retirar ${withdrawAmount > 0 ? formatCurrency(withdrawAmount) : "—"}`}
            </button>
          </div>
        </div>
      )}

      {/* ── New caixinha modal ────────────────────────────────────── */}
      {newCaixinhaOpen && (
        <div
          className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center"
          onClick={() => !newCaixinhaSubmitting && setNewCaixinhaOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && !newCaixinhaSubmitting && setNewCaixinhaOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="caixinha-modal-title"
            className="w-full max-w-sm rounded-2xl bg-background border border-border p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-0.5">Nova caixinha</p>
                <p id="caixinha-modal-title" className="text-lg font-bold text-foreground">Criar caixinha</p>
              </div>
              <button
                onClick={() => !newCaixinhaSubmitting && setNewCaixinhaOpen(false)}
                aria-label="Fechar"
                className="h-9 w-9 flex items-center justify-center rounded-full bg-muted/40 text-muted-foreground hover:text-foreground/80 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tipo */}
            <div className="flex gap-1.5 mb-4">
              {(["turbo", "emergencia", "investimentos"] as const).map((t) => {
                const labels = { turbo: "TURBO", emergencia: "Emergência", investimentos: "Renda Fixa" };
                const active = newCaixinhaTipo === t;
                return (
                  <button
                    key={t}
                    onClick={() => setNewCaixinhaTipo(t)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                      active
                        ? "bg-muted/60 border-border text-foreground"
                        : "bg-muted/50 border-border text-muted-foreground hover:text-foreground/60"
                    }`}
                  >
                    {labels[t]}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label htmlFor="caixinha-nome" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Nome</label>
                <input
                  id="caixinha-nome"
                  type="text"
                  autoFocus
                  value={newCaixinhaName}
                  onChange={(e) => setNewCaixinhaName(e.target.value)}
                  placeholder={newCaixinhaTipo === "turbo" ? "Ex: Nubank Turbo" : newCaixinhaTipo === "emergencia" ? "Ex: Reserva" : "Ex: Prefixado 2029"}
                  className="w-full rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30 focus:border-border text-sm"
                />
              </div>
              <div>
                <label htmlFor="caixinha-instituicao" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Instituição</label>
                <input
                  id="caixinha-instituicao"
                  type="text"
                  value={newCaixinhaInstituicao}
                  onChange={(e) => setNewCaixinhaInstituicao(e.target.value)}
                  placeholder="Ex: Nubank, XP, BTG..."
                  className="w-full rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30 focus:border-border text-sm"
                />
              </div>

              {newCaixinhaTipo === "turbo" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="caixinha-cdi" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">% CDI</label>
                    <input
                      id="caixinha-cdi"
                      type="text"
                      inputMode="decimal"
                      value={newCaixinhaCdiMask}
                      onChange={(e) => setNewCaixinhaCdiMask(formatBRLMask(e.target.value.replace(/\D/g, "")))}
                      placeholder="0,00"
                      className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30 focus:border-border text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="caixinha-teto" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Teto (R$)</label>
                    <input
                      id="caixinha-teto"
                      type="text"
                      inputMode="decimal"
                      value={newCaixinhaTetoMask}
                      onChange={(e) => setNewCaixinhaTetoMask(formatBRLMask(e.target.value.replace(/\D/g, "")))}
                      placeholder="0,00"
                      className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30 focus:border-border text-sm tabular-nums"
                    />
                  </div>
                </div>
              )}

              {newCaixinhaTipo === "emergencia" && newCaixinhaName.trim() && !isEmergencyAccountName(newCaixinhaName.trim()) && (
                <p className="text-[11px] text-muted-foreground">
                  Vai ser salva como &quot;{newCaixinhaName.trim()} (Emergência)&quot;
                </p>
              )}
            </div>

            {newCaixinhaError && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded-xl px-3 py-2 mb-3">{newCaixinhaError}</p>
            )}

            <button
              disabled={!newCaixinhaName.trim() || newCaixinhaSubmitting}
              onClick={confirmNewCaixinha}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-foreground/90 transition-all"
            >
              {newCaixinhaSubmitting ? (
                <span className="h-4 w-4 rounded-full border-2 border-background/30 border-t-background animate-spin" />
              ) : null}
              {newCaixinhaSubmitting ? "Criando…" : "Criar caixinha"}
            </button>
          </div>
        </div>
      )}

      {/* ── Flash confirmação ─────────────────────────────────────── */}
      {confirmedFlash && (
        <div role="status" aria-live="polite" className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background shadow-xl shadow-foreground/30 pointer-events-none">
          <Check className="h-4 w-4" />
          Operação confirmada
        </div>
      )}
    </div>
  );
}
