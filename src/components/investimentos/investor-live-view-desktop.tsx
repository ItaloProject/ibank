"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Plus, ArrowRightLeft, Wallet } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
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
import {
  FOCUS,
  LABEL,
  MONEY,
  BTN_PRIMARY,
  BTN_SECONDARY,
  INPUT_BOX,
  GAIN,
  LOSS,
  LiveSheet,
} from "./live-ui";

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

function formatPct(value: number, digits = 2) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

function formatSignedCurrency(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatCurrency(Math.abs(value))}`;
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

function toneFor(value: number) {
  return value > 0.005 ? GAIN : value < -0.005 ? LOSS : "text-muted-foreground";
}

function PctText({ pct }: { pct: number }) {
  return <span className={cn("text-[11px] font-semibold tabular-nums", toneFor(pct))}>{formatPct(pct)}</span>;
}

function SectionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} className={LABEL}>{children}</h2>;
}

const SMALL_BTN = `inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${FOCUS}`;

/** Tons de cinza para a distribuição: cor aqui não é diagnóstico, só separação de faixas. */
const ALLOCATION_SHADES = ["bg-foreground", "bg-foreground/70", "bg-foreground/45", "bg-foreground/25", "bg-foreground/12"];

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
    toast.success(`Compra de ${qty} ${ticker} concluída`);
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
    toast.success(`Compra de ${product.nome} concluída`);
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
    toast.success(`Aporte em ${acc.nome} concluído`);
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
      toast.success(`Venda de ${fmtQty(sellQty)} ${ticker} concluída`);
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
      toast.success(`${formatCurrency(withdrawAmount)} retirados de ${withdrawAccount.nome}`);
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
      const cdi = parsePercentMask(newCaixinhaCdiMask);
      const teto = parseBRLMask(newCaixinhaTetoMask);
      await createInvestmentAccountWithTurbo({
        name: finalName,
        institution: newCaixinhaInstituicao.trim() || "—",
        is_turbo: newCaixinhaTipo === "turbo",
        cdi_percent: newCaixinhaTipo === "turbo" && cdi > 0 ? cdi : null,
        max_rendimento: newCaixinhaTipo === "turbo" && teto > 0 ? teto : null,
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

  /* ── Derived: movements ───────────────────────────────────────── */
  const movements = useMemo(() => {
    const items: { id: string; title: string; sub: string; amount: number; date: string; iso: string }[] = [];
    const display = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
    for (const t of stockTrades) {
      items.push({ id: `s-${t.id}`, title: `${t.type === "venda" ? "Venda" : "Compra"} ${t.ticker}`, sub: "Bolsa", amount: t.total_amount, date: display(t.date), iso: t.date });
    }
    const lookup = new Map(
      [...turboAccountsReal, ...emergenciaAccountsReal, ...investimentosAccountsReal].map((a) => [a.id, a])
    );
    for (const inv of investments) {
      if (inv.type !== "deposito" || inv.account_id === cashAccountId) continue;
      const acc = lookup.get(inv.account_id);
      if (!acc) continue;
      const group = acc.isTurbo ? "Turbo" : emergenciaAccountsReal.some((e) => e.id === acc.id) ? "Emergência" : "Renda Fixa";
      items.push({ id: `i-${inv.id}`, title: `Aporte · ${acc.nome}`, sub: group, amount: inv.amount, date: display(inv.date), iso: inv.date });
    }
    return items.sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0)).slice(0, 10);
  }, [stockTrades, investments, cashAccountId, turboAccountsReal, emergenciaAccountsReal, investimentosAccountsReal]);

  /* ── Derived: allocation ──────────────────────────────────────── */
  const allocation = useMemo(() => {
    const base = patrimonioTotal || 1;
    return [
      { label: "TURBO", value: turboTotal },
      { label: "Emergência", value: emergenciaTotal },
      { label: "Renda Fixa", value: investimentosTotal },
      { label: "Bolsa", value: investedValue },
      { label: "Saldo em conta", value: cashBalance },
    ]
      .filter((x) => x.value > 0)
      .map((x, i) => ({ ...x, pct: (x.value / base) * 100, shade: ALLOCATION_SHADES[i % ALLOCATION_SHADES.length] }));
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

  function openMarket(section: MarketSection) {
    setMarketSection(section);
    setMarketOpen(true);
  }

  const allAccounts = [
    { title: "TURBO", total: turboTotal, accounts: turboAccountsReal, empty: "Nenhuma conta TURBO.", section: "turbo" as MarketSection, tipo: "turbo" as const, action: "Aportar" },
    { title: "Emergência", total: emergenciaTotal, accounts: emergenciaAccountsReal, empty: "Nenhuma reserva de emergência.", section: "eme" as MarketSection, tipo: "emergencia" as const, action: "Aportar" },
  ];

  return (
    <div className="flex flex-col h-full bg-background text-foreground relative overflow-hidden">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-4 px-7 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-6 min-w-0">
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-foreground shrink-0">MUVO Live</h1>
          <div
            role="tablist"
            aria-label="Seções do MUVO Live"
            onKeyDown={(e) => {
              const idx = tabs.findIndex((t) => t.id === tab);
              if (e.key === "ArrowRight") { e.preventDefault(); setTab(tabs[(idx + 1) % tabs.length].id); }
              if (e.key === "ArrowLeft") { e.preventDefault(); setTab(tabs[(idx - 1 + tabs.length) % tabs.length].id); }
            }}
            className="flex items-center gap-1 rounded-full bg-muted/60 p-1"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`live-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`live-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={cn(
                  "min-h-9 px-4 rounded-full text-sm transition-colors",
                  FOCUS,
                  tab === t.id
                    ? "bg-background text-foreground font-bold shadow-sm"
                    : "text-muted-foreground font-medium hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openMarket("hub")}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-bold text-background hover:bg-foreground/90 transition-colors ${FOCUS}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Investir
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar MUVO Live"
            className={`h-11 w-11 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${FOCUS}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── KPI strip ─────────────────────────────────────────────── */}
      <dl className="grid grid-cols-4 divide-x divide-border border-b border-border shrink-0">
        <div className="px-7 py-4">
          <dt className={LABEL}>Patrimônio</dt>
          <dd className={`${MONEY} mt-1 text-2xl leading-none`}>{formatCurrency(patrimonioTotal)}</dd>
        </div>
        <div className="px-6 py-4">
          <dt className={LABEL}>Saldo em conta</dt>
          <dd className={`${MONEY} mt-1 text-xl leading-none`}>{formatCurrency(cashBalance)}</dd>
        </div>
        <div className="px-6 py-4">
          <dt className={LABEL}>Resultado em bolsa</dt>
          <dd className={cn("font-display font-black tabular-nums mt-1 text-xl leading-none", holdingRows.length ? toneFor(totalGain) : "text-muted-foreground")}>
            {holdingRows.length ? formatSignedCurrency(totalGain) : "—"}
          </dd>
          {holdingRows.length > 0 && <dd className="mt-1"><PctText pct={totalGainPct} /></dd>}
        </div>
        <div className="px-6 py-4">
          <dt className={LABEL}>Posições em bolsa</dt>
          <dd className={`${MONEY} mt-1 text-xl leading-none`}>{holdingRows.length}</dd>
        </div>
      </dl>

      {/* ── Content area ──────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ═══ INÍCIO ═══════════════════════════════════════════════ */}
        {tab === "inicio" && (
          <div
            role="tabpanel"
            id="live-panel-inicio"
            aria-labelledby="live-tab-inicio"
            className="grid grid-cols-[300px_1fr_1fr] h-full divide-x divide-border"
          >
            {/* Distribuição */}
            <section aria-labelledby="dist-heading" className="p-6 overflow-y-auto scrollbar-thin-dark">
              <SectionHeading id="dist-heading">Distribuição</SectionHeading>
              {allocation.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nada investido ainda.</p>
              ) : (
                <>
                  <div className="mt-3 flex h-2.5 rounded-full overflow-hidden gap-px bg-muted" aria-hidden="true">
                    {allocation.map((a) => (
                      <div key={a.label} className={cn("h-full", a.shade)} style={{ width: `${a.pct}%` }} />
                    ))}
                  </div>
                  <ul className="mt-4 space-y-3">
                    {allocation.map((a) => (
                      <li key={a.label} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={cn("h-2.5 w-2.5 rounded-sm shrink-0 ring-1 ring-border", a.shade)} aria-hidden="true" />
                          <span className="text-sm text-foreground truncate">{a.label}</span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-sm font-semibold tabular-nums">{formatCurrency(a.value)}</span>
                          <span className="block text-[11px] text-muted-foreground tabular-nums">
                            {a.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-6 pt-5 border-t border-border">
                <SectionHeading>Saldo em conta</SectionHeading>
                <p className={`${MONEY} mt-1 text-2xl`}>{formatCurrency(cashBalance)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Disponível para novos aportes</p>
                <button type="button" onClick={() => openMarket("hub")} className={`${BTN_PRIMARY} mt-3 inline-flex items-center justify-center gap-2`}>
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  Investir agora
                </button>
              </div>
            </section>

            {/* Posições */}
            <section aria-labelledby="pos-heading" className="p-6 overflow-y-auto scrollbar-thin-dark">
              <div className="flex items-center justify-between mb-3">
                <SectionHeading id="pos-heading">Posições em bolsa</SectionHeading>
                <button type="button" onClick={() => openMarket("acoes")} className={SMALL_BTN}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Comprar ação
                </button>
              </div>
              {holdingRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma posição em bolsa.</p>
                  <button type="button" onClick={() => openMarket("acoes")} className={`${SMALL_BTN} mt-3`}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Comprar a primeira ação
                  </button>
                </div>
              ) : (
                <>
                  <ul className="space-y-1.5">
                    {holdingRows.map((h) => (
                      <li key={h.ticker} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground">{h.ticker}</p>
                          <p className="text-[11px] text-muted-foreground">{h.type} · {fmtQty(h.quantity)} un.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`${MONEY} text-sm`}>{formatCurrency(h.value)}</p>
                            <PctText pct={h.gainPct} />
                          </div>
                          <button type="button" onClick={() => openSell(h.ticker)} aria-label={`Vender ${h.ticker}`} className={SMALL_BTN}>
                            Vender
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 pt-3 border-t border-border flex justify-between items-center px-1">
                    <span className="text-xs text-muted-foreground">Total em bolsa</span>
                    <div className="text-right">
                      <p className={`${MONEY} text-sm`}>{formatCurrency(investedValue)}</p>
                      <PctText pct={totalGainPct} />
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Movimentações */}
            <section aria-labelledby="mov-heading" className="p-6 overflow-y-auto scrollbar-thin-dark">
              <SectionHeading id="mov-heading">Últimas movimentações</SectionHeading>
              {movements.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Sem movimentações ainda.</p>
              ) : (
                <ul className="mt-2">
                  {movements.map((mov) => (
                    <li key={mov.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
                        <ArrowRightLeft className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground truncate">{mov.title}</p>
                        <p className="text-[11px] text-muted-foreground">{mov.sub} · {mov.date}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-foreground shrink-0">{formatCurrency(mov.amount)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {/* ═══ INVESTIMENTOS ════════════════════════════════════════ */}
        {tab === "investimentos" && (
          <div
            role="tabpanel"
            id="live-panel-investimentos"
            aria-labelledby="live-tab-investimentos"
            className="grid grid-cols-3 h-full divide-x divide-border"
          >
            {allAccounts.map((group) => (
              <section key={group.title} aria-label={group.title} className="p-6 overflow-y-auto scrollbar-thin-dark">
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div>
                    <SectionHeading>{group.title}</SectionHeading>
                    <p className={`${MONEY} mt-1 text-lg`}>{formatCurrency(group.total)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => openMarket(group.section)} className={SMALL_BTN}>
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {group.action}
                    </button>
                    <button type="button" onClick={() => openNewCaixinha(group.tipo)} className={SMALL_BTN}>
                      Nova
                    </button>
                  </div>
                </div>
                {group.accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{group.empty}</p>
                ) : (
                  <ul className="space-y-2">
                    {group.accounts.map((acc) => (
                      <li key={acc.id} className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{acc.nome}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{acc.instituicao}</p>
                          </div>
                          <p className={`${MONEY} text-sm shrink-0`}>{formatCurrency(acc.valor)}</p>
                        </div>
                        {acc.cdiPercent ? (
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {acc.cdiPercent}% do CDI
                            {acc.maxRendimento ? ` · teto ${formatCurrency(acc.maxRendimento)}` : ""}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openWithdraw(acc)}
                          aria-label={`Retirar de ${acc.nome}`}
                          className={`${SMALL_BTN} mt-3 w-full justify-center`}
                        >
                          Retirar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            {/* Renda Fixa + Bolsa */}
            <section aria-label="Renda fixa e bolsa" className="p-6 overflow-y-auto scrollbar-thin-dark">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <SectionHeading>Renda fixa e bolsa</SectionHeading>
                  <p className={`${MONEY} mt-1 text-lg`}>{formatCurrency(investimentosTotal + investedValue)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => openMarket("tesouro")} className={SMALL_BTN}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Investir
                  </button>
                  <button type="button" onClick={() => openNewCaixinha("investimentos")} className={SMALL_BTN}>
                    Nova
                  </button>
                </div>
              </div>
              {investimentosAccountsReal.length === 0 && holdingRows.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum investimento em renda fixa ou bolsa.</p>
              )}
              <ul className="space-y-2">
                {investimentosAccountsReal.map((acc) => (
                  <li key={acc.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{acc.nome}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{acc.instituicao}</p>
                      </div>
                      <p className={`${MONEY} text-sm shrink-0`}>{formatCurrency(acc.valor)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openWithdraw(acc)}
                      aria-label={`Retirar de ${acc.nome}`}
                      className={`${SMALL_BTN} mt-3 w-full justify-center`}
                    >
                      Retirar
                    </button>
                  </li>
                ))}
              </ul>
              {holdingRows.length > 0 && (
                <>
                  <p className={`${LABEL} pt-5 pb-2`}>Bolsa</p>
                  <ul className="space-y-2">
                    {holdingRows.map((h) => (
                      <li key={h.ticker} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground">{h.ticker}</p>
                          <p className="text-[11px] text-muted-foreground">{h.type} · {fmtQty(h.quantity)} un.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`${MONEY} text-sm`}>{formatCurrency(h.value)}</p>
                            <PctText pct={h.gainPct} />
                          </div>
                          <button type="button" onClick={() => openSell(h.ticker)} aria-label={`Vender ${h.ticker}`} className={SMALL_BTN}>
                            Vender
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>
        )}

        {/* ═══ SIMULAR ══════════════════════════════════════════════ */}
        {tab === "simular" && (
          <div
            role="tabpanel"
            id="live-panel-simular"
            aria-labelledby="live-tab-simular"
            className="grid grid-cols-[360px_1fr] h-full divide-x divide-border"
          >
            <section aria-labelledby="sim-heading" className="p-6 overflow-y-auto scrollbar-thin-dark space-y-6">
              <div>
                <SectionHeading id="sim-heading">Parâmetros da simulação</SectionHeading>
                <p className="text-[11px] text-muted-foreground mt-1">Projeção hipotética. Não altera sua carteira nem seu saldo.</p>
              </div>

              {[
                {
                  id: "dsim-inicial",
                  label: "Capital inicial",
                  display: formatCurrency(simInicial),
                  min: 0,
                  max: Math.max(200000, Math.ceil(grandTotal * 2 / 10000) * 10000),
                  step: 500,
                  current: simInicial,
                  set: setSimInicial,
                },
                { id: "dsim-mensal", label: "Aporte mensal", display: formatCurrency(simMensal), min: 0, max: 10000, step: 50, current: simMensal, set: setSimMensal },
                { id: "dsim-meses", label: "Período", display: `${simMeses} meses`, min: 6, max: 120, step: 6, current: simMeses, set: setSimMeses },
                {
                  id: "dsim-taxa",
                  label: "Rendimento ao mês",
                  display: `${simTaxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
                  min: 0.1,
                  max: 3,
                  step: 0.05,
                  current: simTaxa,
                  set: setSimTaxa,
                },
              ].map((param) => (
                <div key={param.id}>
                  <div className="flex justify-between text-sm mb-2">
                    <label htmlFor={param.id} className="text-muted-foreground">{param.label}</label>
                    <span className="font-bold tabular-nums text-foreground">{param.display}</span>
                  </div>
                  <input
                    id={param.id}
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={param.current}
                    aria-valuetext={param.display}
                    onChange={(e) => param.set(Number(e.target.value))}
                    className={cn("w-full h-6 accent-foreground cursor-pointer", FOCUS)}
                  />
                </div>
              ))}

              <dl className="grid grid-cols-2 gap-2.5 pt-2">
                {[
                  { label: "Valor final", value: formatCurrency(simFinal), tone: "text-foreground" },
                  { label: "Rendimento", value: formatSignedCurrency(simRendimento), tone: toneFor(simRendimento) },
                  { label: "Total aportado", value: formatCurrency(simAportado), tone: "text-foreground" },
                  {
                    label: "Retorno",
                    value: formatPct(simAportado > 0 ? (simRendimento / simAportado) * 100 : 0, 1),
                    tone: toneFor(simRendimento),
                  },
                ].map((r) => (
                  <div key={r.label} className="rounded-xl border border-border bg-card p-3.5">
                    <dt className={LABEL}>{r.label}</dt>
                    <dd className={cn("mt-1 text-base font-black font-display tabular-nums", r.tone)}>{r.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="proj-heading" className="p-6 flex flex-col min-h-[420px]">
              <SectionHeading id="proj-heading">Projeção patrimonial</SectionHeading>
              <div className="mt-4 flex-1 flex items-end gap-[2px] min-h-0" aria-hidden="true">
                {simData
                  .filter((_, i) => i % barStep === 0 || i === simData.length - 1)
                  .map((p) => (
                    <div
                      key={p.month}
                      className="flex-1 relative group rounded-t-sm bg-foreground/70 hover:bg-foreground transition-colors"
                      style={{ height: `${Math.max(2, (p.value / simMax) * 100)}%` }}
                    >
                      <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                        <div className="bg-card border border-border text-foreground text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                          <p className="text-muted-foreground">Mês {p.month}</p>
                          <p className="font-bold tabular-nums">{formatCurrency(p.value)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-3" aria-hidden="true">
                <span>Agora</span>
                <span>Mês {Math.floor(simMeses / 2)}</span>
                <span>Mês {simMeses}</span>
              </div>
              <p className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                Em {simMeses} meses, rendendo {simTaxa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% ao mês
                e aportando {formatCurrency(simMensal)} por mês, o patrimônio simulado chega a{" "}
                <span className="font-bold text-foreground tabular-nums">{formatCurrency(simFinal)}</span>.
              </p>
            </section>
          </div>
        )}
      </div>

      {/* ── Compra / aporte (sobre o Live inteiro) ─────────────────── */}
      {marketOpen && (
        <div className="absolute inset-0 z-20 bg-background flex flex-col">
          <div className="flex items-center justify-between px-7 py-3 border-b border-border shrink-0">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">Investir</h2>
            <button
              type="button"
              onClick={() => setMarketOpen(false)}
              aria-label="Fechar investir"
              className={`h-11 w-11 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${FOCUS}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin-dark">
            <div className="mx-auto w-full max-w-2xl px-7 pt-4 pb-8">
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
        </div>
      )}

      {/* ── Vender ────────────────────────────────────────────────── */}
      <LiveSheet
        open={!!sellTicker && !!sellHolding}
        onOpenChange={(o) => { if (!o) setSellTicker(null); }}
        dismissible={!sellSubmitting}
        title={sellHolding ? `Vender ${sellHolding.ticker}` : "Vender"}
        description={sellHolding ? `${fmtQty(sellHolding.quantity)} un. · ${formatCurrency(sellHolding.price)} por unidade` : undefined}
      >
        {sellHolding && (
          <form onSubmit={(e) => { e.preventDefault(); void confirmSell(); }} className="space-y-4">
            <div>
              <label htmlFor="sell-qty" className={`${LABEL} block mb-2`}>Quantidade a vender</label>
              <div className="flex gap-2">
                <div className={cn(INPUT_BOX, "flex-1")}>
                  <input
                    id="sell-qty"
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={sellQtyMask}
                    onChange={(e) => onSellQtyChange(e.target.value)}
                    placeholder="0"
                    aria-describedby="sell-qty-hint"
                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base font-semibold tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSellQtyMask(fmtQty(sellHolding.quantity).replace(".", ","))}
                  className={`min-h-12 px-4 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground ${FOCUS}`}
                >
                  Tudo
                </button>
              </div>
              <p id="sell-qty-hint" className={cn("text-xs mt-2", sellQty > sellHolding.quantity + 0.0001 ? LOSS : "text-muted-foreground")}>
                {sellQty > sellHolding.quantity + 0.0001
                  ? "Quantidade maior que a posição atual."
                  : sellQty > 0
                    ? <>Você recebe <span className="font-semibold text-foreground tabular-nums">{formatCurrency(sellProceeds)}</span> no saldo em conta.</>
                    : "O valor da venda entra no saldo em conta."}
              </p>
            </div>
            {sellError && <p role="alert" className={`text-xs ${LOSS} rounded-xl bg-red-500/10 px-3 py-2`}>{sellError}</p>}
            <button type="submit" disabled={!canConfirmSell} className={BTN_PRIMARY}>
              {sellSubmitting ? "Vendendo…" : `Confirmar venda${sellQty > 0 ? ` de ${fmtQty(sellQty)} ${sellHolding.ticker}` : ""}`}
            </button>
          </form>
        )}
      </LiveSheet>

      {/* ── Retirar ───────────────────────────────────────────────── */}
      <LiveSheet
        open={!!withdrawAccount}
        onOpenChange={(o) => { if (!o) setWithdrawAccount(null); }}
        dismissible={!withdrawSubmitting}
        title={withdrawAccount ? `Retirar de ${withdrawAccount.nome}` : "Retirar"}
        description={withdrawAccount ? `Disponível: ${formatCurrency(withdrawAccount.valor)}. O valor volta para o saldo em conta.` : undefined}
      >
        {withdrawAccount && (
          <form onSubmit={(e) => { e.preventDefault(); void confirmWithdraw(); }} className="space-y-4">
            <div>
              <label htmlFor="withdraw-amount" className={`${LABEL} block mb-2`}>Valor a retirar</label>
              <div className="flex gap-2">
                <div className={cn(INPUT_BOX, "flex-1")}>
                  <span className="text-muted-foreground text-sm shrink-0">R$</span>
                  <input
                    id="withdraw-amount"
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={withdrawMask}
                    onChange={(e) => setWithdrawMask(formatBRLMask(e.target.value.replace(/\D/g, "")))}
                    placeholder="0,00"
                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base font-semibold tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setWithdrawMask(formatBRLMask((withdrawAccount.valor * 100).toFixed(0)))}
                  className={`min-h-12 px-4 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground ${FOCUS}`}
                >
                  Tudo
                </button>
              </div>
              {withdrawAmount > withdrawAccount.valor + 0.001 && (
                <p className={`text-xs mt-2 ${LOSS}`}>Valor maior que o saldo disponível.</p>
              )}
            </div>
            {withdrawError && <p role="alert" className={`text-xs ${LOSS} rounded-xl bg-red-500/10 px-3 py-2`}>{withdrawError}</p>}
            <button type="submit" disabled={!canConfirmWithdraw} className={BTN_PRIMARY}>
              {withdrawSubmitting ? "Retirando…" : `Retirar ${withdrawAmount > 0 ? formatCurrency(withdrawAmount) : ""}`.trim()}
            </button>
          </form>
        )}
      </LiveSheet>

      {/* ── Nova caixinha ─────────────────────────────────────────── */}
      <LiveSheet
        open={newCaixinhaOpen}
        onOpenChange={setNewCaixinhaOpen}
        dismissible={!newCaixinhaSubmitting}
        title="Nova caixinha"
      >
        <form onSubmit={(e) => { e.preventDefault(); void confirmNewCaixinha(); }} className="space-y-4">
          <div role="radiogroup" aria-label="Tipo de caixinha" className="grid grid-cols-3 gap-1.5">
            {(["turbo", "emergencia", "investimentos"] as const).map((t) => {
              const labels = { turbo: "TURBO", emergencia: "Emergência", investimentos: "Renda fixa" };
              const active = newCaixinhaTipo === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setNewCaixinhaTipo(t)}
                  className={cn(
                    "min-h-11 rounded-xl border text-xs font-bold transition-colors",
                    FOCUS,
                    active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {labels[t]}
                </button>
              );
            })}
          </div>

          <div>
            <label htmlFor="caixinha-nome" className={`${LABEL} block mb-1.5`}>Nome</label>
            <div className={INPUT_BOX}>
              <input
                id="caixinha-nome"
                type="text"
                autoFocus
                value={newCaixinhaName}
                onChange={(e) => setNewCaixinhaName(e.target.value)}
                placeholder={newCaixinhaTipo === "turbo" ? "Ex: Nubank Turbo" : newCaixinhaTipo === "emergencia" ? "Ex: Reserva" : "Ex: Prefixado 2029"}
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm"
              />
            </div>
            {newCaixinhaTipo === "emergencia" && newCaixinhaName.trim() && !isEmergencyAccountName(newCaixinhaName.trim()) && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Vai ser salva como &quot;{newCaixinhaName.trim()} (Emergência)&quot;
              </p>
            )}
          </div>

          <div>
            <label htmlFor="caixinha-instituicao" className={`${LABEL} block mb-1.5`}>Instituição</label>
            <div className={INPUT_BOX}>
              <input
                id="caixinha-instituicao"
                type="text"
                value={newCaixinhaInstituicao}
                onChange={(e) => setNewCaixinhaInstituicao(e.target.value)}
                placeholder="Ex: Nubank, XP, BTG"
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm"
              />
            </div>
          </div>

          {newCaixinhaTipo === "turbo" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="caixinha-cdi" className={`${LABEL} block mb-1.5`}>% do CDI</label>
                <div className={INPUT_BOX}>
                  <input
                    id="caixinha-cdi"
                    type="text"
                    inputMode="decimal"
                    value={newCaixinhaCdiMask}
                    onChange={(e) => setNewCaixinhaCdiMask(formatPercentMask(e.target.value))}
                    placeholder="Ex: 120"
                    className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm tabular-nums"
                  />
                  <span className="text-muted-foreground text-sm shrink-0">%</span>
                </div>
              </div>
              <div>
                <label htmlFor="caixinha-teto" className={`${LABEL} block mb-1.5`}>Teto de rendimento</label>
                <div className={INPUT_BOX}>
                  <span className="text-muted-foreground text-sm shrink-0">R$</span>
                  <input
                    id="caixinha-teto"
                    type="text"
                    inputMode="numeric"
                    value={newCaixinhaTetoMask}
                    onChange={(e) => setNewCaixinhaTetoMask(formatBRLMask(e.target.value.replace(/\D/g, "")))}
                    placeholder="0,00"
                    className="flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>
          )}

          {newCaixinhaError && <p role="alert" className={`text-xs ${LOSS} rounded-xl bg-red-500/10 px-3 py-2`}>{newCaixinhaError}</p>}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setNewCaixinhaOpen(false)} disabled={newCaixinhaSubmitting} className={BTN_SECONDARY}>
              Cancelar
            </button>
            <button type="submit" disabled={!newCaixinhaName.trim() || newCaixinhaSubmitting} className={BTN_PRIMARY}>
              {newCaixinhaSubmitting ? "Criando…" : "Criar caixinha"}
            </button>
          </div>
        </form>
      </LiveSheet>
    </div>
  );
}
