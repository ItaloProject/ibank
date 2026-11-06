"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Plus, Wallet, LayoutDashboard, Calculator } from "lucide-react";
import { Icon3D } from "@/components/investimentos/live-icons-3d";
import { HoldingsPanel } from "@/components/investimentos/live-holdings-panel";
import { PlanLeftoverOffer } from "@/components/investimentos/plan-leftover-offer";
import { cn, formatCurrency } from "@/lib/utils";
import { detectAssetType } from "@/lib/stock-utils";
import { isEmergencyAccountName } from "@/lib/account-groups";
import { createInvestmentAccountWithTurbo, deleteInvestmentAccount } from "@/lib/api";
import {
  SimulatorInvestFlow,
  type MarketSection,
} from "@/components/investimentos/simulator-invest-flow";
import type { InvestorLiveViewProps } from "./investor-live-view";
import { useLiveActions, type LiveAccount, type LiveMovement } from "./live-actions";
import {
  StockOrderSheet,
  WithdrawSheet,
  UpdateValueSheet,
  AmountSheet,
  MovementsList,
  UndoSheet,
  type StockOrder,
} from "./live-money-sheets";
import { EMPTY_RATE_DRAFT, RateFields, rateFromDraft, type RateDraft } from "@/components/investimentos/rate-fields";
import { BankPicker } from "@/components/investimentos/bank-picker";
import type { Bank, BankProduct } from "@/lib/bank-rates";
import { InicialShortcuts, SimChart, SimLegend, SimParam, SimRateParam, simRateText, useSimulation } from "@/components/investimentos/sim-controls";
import { liveBotContext } from "@/components/investimentos/live-bot-context";
import { useBotPageContext } from "@/lib/bot-page-context";
import { AskMuvoInline } from "@/components/bot/ask-muvo-inline";
import {
  FOCUS,
  LABEL,
  MONEY,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  INPUT_BOX,
  GAIN,
  LOSS,
  LiveSheet,
} from "./live-ui";
import { CdiHelp, SaldoEmContaHelp, TetoHelp, TipoCaixinhaHelp } from "./help-texts";

function formatBRLMask(digits: string): string {
  const cleaned = digits.replace(/\D/g, "").slice(0, 12);
  const cents = parseInt(cleaned || "0", 10);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRLMask(masked: string): number {
  const cents = parseInt(masked.replace(/\D/g, "") || "0", 10);
  return cents / 100;
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
  liveAction,
}: InvestorLiveViewProps) {
  // Começa sem seção: só aparece algo depois que o usuário escolhe um grupo.
  const [tab, setTab] = useState<"inicio" | "investimentos" | "simular" | null>(null);

  /* ── Market / buy flow ────────────────────────────────────────── */
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketSection, setMarketSection] = useState<MarketSection>("hub");
  const [suggestedAmount, setSuggestedAmount] = useState<number | undefined>();
  useEffect(() => {
    if (!marketOpen) setSuggestedAmount(undefined);
  }, [marketOpen]);

  /* ── Operações (compartilhadas com o celular) ─────────────────── */
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
  const [showAllMovements, setShowAllMovements] = useState(false);
  type AccountRef = LiveAccount;

  /* ── New caixinha flow ────────────────────────────────────────── */
  const [newCaixinhaOpen, setNewCaixinhaOpen] = useState(false);
  const [newCaixinhaTipo, setNewCaixinhaTipo] = useState<"turbo" | "emergencia" | "investimentos">("investimentos");
  const [newCaixinhaName, setNewCaixinhaName] = useState("");
  const [newCaixinhaInstituicao, setNewCaixinhaInstituicao] = useState("");
  const [newCaixinhaCdiMask, setNewCaixinhaCdiMask] = useState("");
  const [newCaixinhaRate, setNewCaixinhaRate] = useState<RateDraft>(EMPTY_RATE_DRAFT);
  const [newCaixinhaTetoMask, setNewCaixinhaTetoMask] = useState("");
  const [newCaixinhaSubmitting, setNewCaixinhaSubmitting] = useState(false);
  const [newCaixinhaError, setNewCaixinhaError] = useState<string | null>(null);

  /* ── Delete caixinha ──────────────────────────────────────────── */
  const [deleteAccount, setDeleteAccount] = useState<AccountRef | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  /* ── Cash adjust ──────────────────────────────────────────────── */
  const [cashSheetOpen, setCashSheetOpen] = useState(false);
  const [cashMask, setCashMask] = useState("");
  const [cashSaving, setCashSaving] = useState(false);

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

  function openSell(ticker: string) {
    const h = holdingRows.find((x) => x.ticker === ticker);
    if (h) setOrder({ mode: "venda", ticker, price: h.price, maxQty: h.quantity });
  }

  /* ── New caixinha ─────────────────────────────────────────────── */
  function openNewCaixinha(tipo: "turbo" | "emergencia" | "investimentos") {
    setNewCaixinhaTipo(tipo);
    setNewCaixinhaName("");
    setNewCaixinhaInstituicao("");
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

  const cashInputValue = parseBRLMask(cashMask);
  const cashDelta = cashInputValue - cashBalance;
  const cashChanged = Math.abs(cashDelta) >= 0.005;

  function openCashSheet() {
    setCashMask(formatBRLMask(Math.round(Math.max(0, cashBalance) * 100).toString()));
    setCashSheetOpen(true);
  }

  async function saveCash() {
    if (!cashChanged || cashSaving) return;
    setCashSaving(true);
    try {
      await actions.setCash(cashInputValue);
      setCashSheetOpen(false);
    } catch (err) {
      console.error("Erro ao ajustar saldo:", err);
      toast.error("Não foi possível salvar o saldo. Tente novamente.");
    } finally {
      setCashSaving(false);
    }
  }

  async function takeLeftover(month: string, amount: number) {
    try {
      await actions.addLeftover(month, amount);
      setCashSheetOpen(false);
    } catch (err) {
      console.error("Erro ao somar a sobra:", err);
      toast.error("Não foi possível somar a sobra. Tente novamente.");
    }
  }

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
  const sim = useSimulation(patrimonioTotal, cashBalance);
  const simInicialMax = Math.max(200000, Math.ceil((patrimonioTotal * 2) / 10000) * 10000);

  useBotPageContext("live:desktop", liveBotContext({
    tab: tab ?? "menu",
    marketOpen,
    marketSection,
    newCaixinha: { open: newCaixinhaOpen, tipo: newCaixinhaTipo, nome: newCaixinhaName, instituicao: newCaixinhaInstituicao, rate: newCaixinhaRate, cdiMask: newCaixinhaCdiMask },
    sim,
  }));

  /* ── Tabs ─────────────────────────────────────────────────────── */
  const tabs = [
    { id: "inicio" as const, label: "Visão geral", kind: "overview" as const, icon: LayoutDashboard },
    { id: "investimentos" as const, label: "Investimentos", kind: "wallet" as const, icon: Wallet },
    { id: "simular" as const, label: "Simulador", kind: "calculator" as const, icon: Calculator },
  ];

  function openMarket(section: MarketSection) {
    setMarketSection(section);
    setMarketOpen(true);
  }

  useEffect(() => {
    if (!liveAction) return;
    if (liveAction.kind === "investir") {
      setSuggestedAmount(liveAction.amount);
      openMarket(liveAction.section);
    }
    else if (holdingRows.some((h) => h.ticker === liveAction.ticker)) {
      setTab("investimentos");
      openSell(liveAction.ticker);
    } else openMarket(detectAssetType(liveAction.ticker) === "FII" ? "fiis" : "acoes");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveAction]);


  const accountHandlers = {
    onAporte: setAporteAccount,
    onWithdraw: setWithdrawAccount,
    onUpdate: setUpdateAccount,
    onDelete: setDeleteAccount,
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground relative overflow-hidden">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-4 px-7 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-6 min-w-0">
          <h1 className="text-sm font-black uppercase tracking-[0.2em] text-foreground shrink-0">
            {tab === null ? (
              "MUVO Live"
            ) : (
              <button
                type="button"
                onClick={() => setTab(null)}
                aria-label="MUVO Live: voltar ao menu"
                className={`rounded-md uppercase tracking-[0.2em] hover:text-muted-foreground transition-colors ${FOCUS}`}
              >
                MUVO Live
              </button>
            )}
          </h1>
          {tab !== null && (
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
                aria-label={t.label}
                onClick={() => setTab(t.id)}
                className={cn(
                  "group relative inline-flex h-11 w-14 items-center justify-center rounded-full transition-colors",
                  FOCUS,
                  tab === t.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-background opacity-0 shadow-lg transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  {t.label}
                </span>
              </button>
            ))}
          </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tab !== null && (
          <>
          <button
            type="button"
            onClick={() => openNewCaixinha("investimentos")}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-bold text-foreground hover:bg-muted transition-colors ${FOCUS}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova caixinha
          </button>
          <button
            type="button"
            onClick={() => openMarket("hub")}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-bold text-background hover:bg-foreground/90 transition-colors ${FOCUS}`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Investir
          </button>
          </>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar MUVO Live"
              className={`h-11 w-11 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${FOCUS}`}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {/* ── Content area ──────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ═══ MENU: escolha da seção ═══════════════════════════════ */}
        {tab === null && (
          <nav aria-label="Escolha uma seção do MUVO Live" className="flex h-full items-center justify-center p-8">
            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {tabs.map((t, i) => (
                <li key={t.id}>
                  <Icon3D kind={t.kind} label={t.label} index={i} onSelect={() => setTab(t.id)} />
                </li>
              ))}
            </ul>
          </nav>
        )}

        {/* ═══ INÍCIO ═══════════════════════════════════════════════ */}
        {tab === "inicio" && (
          <div
            role="tabpanel"
            id="live-panel-inicio"
            aria-labelledby="live-tab-inicio"
            className="grid grid-cols-[340px_1fr] h-full divide-x divide-border"
          >
            {/* Resumo + distribuição — cards no mesmo idioma dos filtros de Investimentos */}
            <section aria-labelledby="dist-heading" className="space-y-5 p-6 overflow-y-auto scrollbar-thin-dark">
              <div className="rounded-xl border border-border bg-card p-4">
                <SectionHeading>Patrimônio</SectionHeading>
                <p className={`${MONEY} mt-2 text-3xl leading-none tracking-tight`}>{formatCurrency(patrimonioTotal)}</p>
                <dl className="mt-4 space-y-2.5 border-t border-border pt-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Investido</dt>
                    <dd className="font-semibold tabular-nums text-foreground">{formatCurrency(patrimonioTotal - cashBalance)}</dd>
                  </div>
                  {holdingRows.length > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Resultado em bolsa</dt>
                      <dd className="flex items-baseline gap-1.5">
                        <span className={cn("font-semibold tabular-nums", toneFor(totalGain))}>{formatSignedCurrency(totalGain)}</span>
                        <PctText pct={totalGainPct} />
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-1.5">
                  <SectionHeading>Saldo em conta</SectionHeading>
                  <SaldoEmContaHelp />
                </div>
                <p className={`${MONEY} mt-2 text-2xl leading-none`}>{formatCurrency(cashBalance)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Disponível para novos aportes</p>
                <button type="button" onClick={() => openMarket("hub")} className={`${BTN_PRIMARY} mt-4 inline-flex w-full items-center justify-center gap-2`}>
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  Investir agora
                </button>
                <button type="button" onClick={openCashSheet} className={`${BTN_SECONDARY} mt-2 w-full`}>
                  {cashBalance > 0 ? "Ajustar saldo" : "Informar saldo"}
                </button>
              </div>

              <div>
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
              </div>
            </section>

            {/* Movimentações */}
            <section aria-labelledby="mov-heading" className="p-6 overflow-y-auto scrollbar-thin-dark">
              <SectionHeading id="mov-heading">Últimas movimentações</SectionHeading>
              <p className="text-[11px] text-muted-foreground mt-1">Lançou algo errado? Use o botão de desfazer ao lado.</p>
              <div className="mt-2">
                <MovementsList
                  movements={showAllMovements ? actions.movements : actions.movements.slice(0, 8)}
                  onUndo={setUndoMovement}
                />
              </div>
              {actions.movements.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllMovements((v) => !v)}
                  className={`${SMALL_BTN} mt-3 w-full justify-center`}
                >
                  {showAllMovements ? "Mostrar menos" : `Ver todas (${actions.movements.length})`}
                </button>
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
          >
            <HoldingsPanel
              turbo={turboAccountsReal}
              emergencia={emergenciaAccountsReal}
              rendaFixa={investimentosAccountsReal}
              holdings={holdingRows}
              handlers={accountHandlers}
              onBuyStock={() => openMarket("acoes")}
              onSell={openSell}
              onNewCaixinha={openNewCaixinha}
            />
          </div>
        )}

        {/* ═══ SIMULAR ══════════════════════════════════════════════ */}
        {tab === "simular" && (
          <div
            role="tabpanel"
            id="live-panel-simular"
            aria-labelledby="live-tab-simular"
            className="grid grid-cols-[380px_1fr] h-full divide-x divide-border"
          >
            <section aria-labelledby="sim-heading" className="p-6 overflow-y-auto scrollbar-thin-dark space-y-7">
              <div>
                <SectionHeading id="sim-heading">Parâmetros da simulação</SectionHeading>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Digite o valor exato ou arraste. Projeção hipotética: não altera sua carteira nem seu saldo.
                </p>
              </div>

              <SimParam
                id="dsim-inicial"
                label="Capital inicial"
                format="brl"
                value={sim.inicial}
                onChange={sim.setInicial}
                min={0}
                max={simInicialMax}
                step={500}
                nudge={100}
                typedMax={100_000_000}
              >
                <InicialShortcuts sim={sim} patrimonio={patrimonioTotal} saldo={cashBalance} />
              </SimParam>
              <SimParam
                id="dsim-mensal"
                label="Aporte mensal"
                format="brl"
                value={sim.mensal}
                onChange={sim.setMensal}
                min={0}
                max={10000}
                step={50}
                typedMax={10_000_000}
              />
              <SimParam
                id="dsim-meses"
                label="Período"
                format="meses"
                value={sim.meses}
                onChange={sim.setMeses}
                min={1}
                max={120}
                step={1}
                typedMax={600}
              />
              <SimRateParam id="dsim-rend" sim={sim} />
            </section>

            <section aria-labelledby="proj-heading" className="p-6 flex flex-col gap-5 min-h-0 overflow-y-auto scrollbar-thin-dark">
              <SectionHeading id="proj-heading">Resultado da simulação</SectionHeading>

              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4" aria-live="polite">
                <div>
                  <p className={LABEL}>Valor final em {sim.meses} {sim.meses === 1 ? "mês" : "meses"}</p>
                  <p className={`${MONEY} mt-1.5 text-5xl leading-none tracking-tight`}>{formatCurrency(sim.final)}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-black tabular-nums text-emerald-500">
                    {formatPct(sim.retornoPct, 1)} de retorno sobre o que você aportou
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-2.5 min-w-[320px]">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5">
                    <dt className={LABEL}>Rendimento dos juros</dt>
                    <dd className="mt-1 text-xl font-black font-display tabular-nums text-emerald-500">{formatSignedCurrency(sim.rendimento)}</dd>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3.5">
                    <dt className={LABEL}>Total aportado</dt>
                    <dd className="mt-1 text-xl font-black font-display tabular-nums text-foreground">{formatCurrency(sim.aportado)}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex-1 min-h-[240px] flex flex-col">
                <SimLegend />
                <SimChart data={sim.data} className="mt-3 flex-1 min-h-0" />
                <div className="flex justify-between text-[11px] text-muted-foreground mt-3" aria-hidden="true">
                  <span>Agora</span>
                  <span>Mês {Math.floor(sim.meses / 2)}</span>
                  <span>Mês {sim.meses}</span>
                </div>
              </div>

              <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                Em {sim.meses} {sim.meses === 1 ? "mês" : "meses"}, rendendo{" "}
                {simRateText(sim)} e aportando{" "}
                {formatCurrency(sim.mensal)} por mês, você tira do bolso{" "}
                <span className="font-semibold text-foreground tabular-nums">{formatCurrency(sim.aportado)}</span> e os juros somam{" "}
                <span className="font-semibold text-emerald-500 tabular-nums">{formatCurrency(Math.max(0, sim.rendimento))}</span>, chegando a{" "}
                <span className="font-bold text-foreground tabular-nums">{formatCurrency(sim.final)}</span>. Valores antes do Imposto de Renda.
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
                suggestedAmount={suggestedAmount}
                cash={cashBalance}
                knownPrices={quoteMap}
                turboAccounts={turboAccountsReal}
                emergenciaAccounts={emergenciaAccountsReal}
                rendaFixaAccounts={investimentosAccountsReal}
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
        </div>
      )}

      <StockOrderSheet order={order} onClose={() => setOrder(null)} cash={cashBalance} onBuy={actions.buyStock} onSell={actions.sellStock} />
      <AmountSheet
        open={!!aporteAccount}
        onOpenChange={(o) => !o && setAporteAccount(null)}
        title={aporteAccount ? `Aplicar em ${aporteAccount.nome}` : ""}
        description={aporteAccount ? `Hoje: ${formatCurrency(aporteAccount.valor)}` : undefined}
        cash={cashBalance}
        onConfirm={(amount, source) => (aporteAccount ? actions.aporte(aporteAccount.id, amount, source) : Promise.resolve())}
      />
      <WithdrawSheet account={withdrawAccount} onClose={() => setWithdrawAccount(null)} onConfirm={actions.withdraw} />
      <UpdateValueSheet account={updateAccount} onClose={() => setUpdateAccount(null)} onConfirm={actions.updateValue} />
      <UndoSheet movement={undoMovement} onClose={() => setUndoMovement(null)} onConfirm={actions.undo} />

      {/* ── Nova caixinha ─────────────────────────────────────────── */}
      <LiveSheet
        open={newCaixinhaOpen}
        onOpenChange={setNewCaixinhaOpen}
        dismissible={!newCaixinhaSubmitting}
        title="Nova caixinha"
      >
        <form onSubmit={(e) => { e.preventDefault(); void confirmNewCaixinha(); }} className="space-y-4">
          <p id="caixinha-tipo" className={`${LABEL} -mb-2 flex items-center gap-1.5`}>
            Tipo de caixinha <TipoCaixinhaHelp />
          </p>
          <div role="radiogroup" aria-labelledby="caixinha-tipo" className="grid grid-cols-3 gap-1.5">
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

          <BankPicker
            id="caixinha"
            tipo={newCaixinhaTipo}
            institution={newCaixinhaInstituicao}
            onInstitutionChange={setNewCaixinhaInstituicao}
            onApply={applyBankProduct}
          />

          {newCaixinhaTipo === "turbo" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <label htmlFor="caixinha-cdi" className={LABEL}>% do CDI</label>
                  <CdiHelp />
                </div>
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
                <div className="mb-1.5 flex items-center gap-1.5">
                  <label htmlFor="caixinha-teto" className={LABEL}>Teto de rendimento</label>
                  <TetoHelp />
                </div>
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

          {newCaixinhaTipo !== "turbo" && <RateFields value={newCaixinhaRate} onChange={setNewCaixinhaRate} productName={newCaixinhaName} />}

          {(newCaixinhaInstituicao || newCaixinhaName.trim()) && (
            <AskMuvoInline
              label="Perguntar ao Muvo se essa taxa está boa"
              question="Essa aplicação que estou cadastrando tem uma boa taxa? Compare com os outros bancos e diga se paga Imposto de Renda."
              resetKey={`${newCaixinhaTipo}|${newCaixinhaInstituicao}|${newCaixinhaName}|${newCaixinhaCdiMask}|${newCaixinhaRate.index}|${newCaixinhaRate.value}`}
            />
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

      {/* ── Excluir caixinha ──────────────────────────────────────── */}
      <LiveSheet
        open={!!deleteAccount}
        onOpenChange={(o) => { if (!o) setDeleteAccount(null); }}
        dismissible={!deleteSubmitting}
        title={deleteAccount ? `Excluir "${deleteAccount.nome}"?` : "Excluir caixinha"}
        description={
          deleteAccount && deleteAccount.valor > 0
            ? `O saldo de ${formatCurrency(deleteAccount.valor)} e todo o histórico desta caixinha serão apagados. Para manter o dinheiro, retire antes para o saldo em conta.`
            : "A caixinha e o histórico dela serão apagados. Esta ação não pode ser desfeita."
        }
      >
        <div className="space-y-2">
          <button type="button" onClick={() => void confirmDeleteAccount()} disabled={deleteSubmitting} className={BTN_DANGER}>
            {deleteSubmitting ? "Excluindo…" : "Excluir caixinha"}
          </button>
          <button type="button" onClick={() => setDeleteAccount(null)} disabled={deleteSubmitting} className={BTN_SECONDARY}>
            Cancelar
          </button>
        </div>
      </LiveSheet>

      {/* ── Saldo em conta ────────────────────────────────────────── */}
      <LiveSheet
        open={cashSheetOpen}
        onOpenChange={setCashSheetOpen}
        dismissible={!cashSaving}
        title="Saldo em conta"
        description="Informe quanto você tem hoje disponível para investir. A diferença é registrada como um lançamento de ajuste."
      >
        <form onSubmit={(e) => { e.preventDefault(); void saveCash(); }} className="space-y-4">
          <div>
            <label htmlFor="live-cash-desktop" className={`${LABEL} block mb-2`}>Saldo atual</label>
            <div className={INPUT_BOX}>
              <span className="text-muted-foreground text-sm shrink-0">R$</span>
              <input
                id="live-cash-desktop"
                type="text"
                inputMode="numeric"
                autoFocus
                value={cashMask}
                onChange={(e) => setCashMask(formatBRLMask(e.target.value.replace(/\D/g, "")))}
                placeholder="0,00"
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base font-semibold tabular-nums"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 tabular-nums" aria-live="polite">
              {cashChanged
                ? `Ajuste de ${cashDelta > 0 ? "+" : "−"}${formatCurrency(Math.abs(cashDelta))} em relação ao saldo registrado.`
                : "Sem alteração."}
            </p>
          </div>
          <button type="submit" disabled={!cashChanged || cashSaving} className={BTN_PRIMARY}>
            {cashSaving ? "Salvando…" : "Salvar saldo"}
          </button>
          <PlanLeftoverOffer open={cashSheetOpen} done={actions.leftoverDone} disabled={cashSaving} onUse={takeLeftover} />
        </form>
      </LiveSheet>
    </div>
  );
}
