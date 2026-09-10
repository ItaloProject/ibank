"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Signal, Wifi, BatteryFull, Zap, Shield, Landmark, Calculator,
  ArrowUpRight, ArrowDownRight, Check, ChevronLeft, Pencil,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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
  { ticker: "PETR4", name: "Petrobras PN",       category: "Ação",       price: 38.5,  variation: 0.021,  color: "#22c55e" },
  { ticker: "VALE3", name: "Vale ON",             category: "Ação",       price: 61.2,  variation: -0.014, color: "#f97316" },
  { ticker: "ITUB4", name: "Itaú Unibanco PN",    category: "Ação",       price: 34.1,  variation: 0.008,  color: "#f59e0b" },
  { ticker: "MXRF11", name: "Maxi Renda",         category: "FII",       price: 10.15, variation: 0.012,  color: "#a855f7" },
  { ticker: "HGLG11", name: "CSHG Logística",     category: "FII",       price: 165.4, variation: 0.019,  color: "#8b5cf6" },
  { ticker: "SELIC29", name: "Tesouro Selic 2029", category: "Renda Fixa", price: 100.0, variation: 0.009,  color: "#3b82f6" },
];

const INITIAL_CASH = 10000;

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
          onClick={() => onSelect(item)}
          className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.07] hover:border-white/20 transition-colors"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{item.nome}</p>
            {item.instituicao && <p className="text-[10px] text-white/40 truncate">{item.instituicao}</p>}
          </div>
          <p className="text-sm font-extrabold tabular-nums text-white shrink-0">{formatCurrency(item.valor)}</p>
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
  onClose: () => void;
};

export function InvestorLiveView({
  grandTotal,
  turboAccountsReal,
  emergenciaAccountsReal,
  investimentosAccountsReal,
  stockPositions,
  quoteMap,
  onClose,
}: InvestorLiveViewProps) {
  const [tab, setTab] = useState<"turbo" | "emergencia" | "investimentos" | "simular">("turbo");
  const [cash, setCash] = useState(INITIAL_CASH);
  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const [holdings, setHoldings] = useState<Holding[]>(() =>
    stockPositions
      .filter((p) => p.quantity > 0)
      .map((p) => ({ ticker: p.ticker, quantity: p.quantity, avgPrice: p.avgPrice }))
  );
  const [buyAsset, setBuyAsset] = useState<Asset | null>(null);
  const [buyAmount, setBuyAmount] = useState("");
  const [confirmedFlash, setConfirmedFlash] = useState(false);
  const [selectedFixedIncome, setSelectedFixedIncome] = useState<RealAccountItem | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const ownedTickers = useMemo(() => new Set(stockPositions.map((p) => p.ticker)), [stockPositions]);

  const liveAssets = useMemo(() => {
    const knownTickers = new Set(ASSETS.map((a) => a.ticker));
    const extraColors = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4"];
    const base: Asset[] = ASSETS.map((a) => {
      const realPrice = quoteMap.get(a.ticker);
      return realPrice !== undefined ? { ...a, price: realPrice, variation: 0, isReal: true } : { ...a, isReal: false };
    });
    const extra: Asset[] = stockPositions
      .filter((p) => !knownTickers.has(p.ticker))
      .map((p, i) => ({
        ticker: p.ticker,
        name: p.ticker,
        category: "Ação" as const,
        price: quoteMap.get(p.ticker) ?? p.avgPrice,
        variation: 0,
        color: extraColors[i % extraColors.length],
        isReal: quoteMap.has(p.ticker),
      }));
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

  const turboTotal = useMemo(() => turboAccountsReal.reduce((s, x) => s + x.valor, 0), [turboAccountsReal]);
  const emergenciaTotal = useMemo(() => emergenciaAccountsReal.reduce((s, x) => s + x.valor, 0), [emergenciaAccountsReal]);
  const investimentosFixedTotal = useMemo(
    () => investimentosAccountsReal.reduce((s, x) => s + x.valor, 0),
    [investimentosAccountsReal]
  );
  const investimentosTotal = investimentosFixedTotal + investedValue + cash;

  const animatedCash = useCountUp(cash);

  function startEditCash() {
    setCashInput(String(Math.round(cash)));
    setEditingCash(true);
  }

  function commitEditCash() {
    const v = parseFloat(cashInput.replace(/\./g, "").replace(",", "."));
    if (!isNaN(v) && v >= 0) setCash(v);
    setEditingCash(false);
  }

  function openBuy(asset: Asset) {
    setBuyAsset(asset);
    setBuyAmount("");
  }

  function confirmBuy() {
    if (!buyAsset) return;
    const amount = parseFloat(buyAmount.replace(",", "."));
    if (!amount || amount <= 0 || amount > cash) return;
    const qty = amount / buyAsset.price;
    setHoldings((prev) => {
      const existing = prev.find((h) => h.ticker === buyAsset.ticker);
      if (existing) {
        const totalQty = existing.quantity + qty;
        const totalCost = existing.quantity * existing.avgPrice + amount;
        return prev.map((h) =>
          h.ticker === buyAsset.ticker ? { ...h, quantity: totalQty, avgPrice: totalCost / totalQty } : h
        );
      }
      return [...prev, { ticker: buyAsset.ticker, quantity: qty, avgPrice: buyAsset.price }];
    });
    setCash((prev) => prev - amount);
    setBuyAsset(null);
    setConfirmedFlash(true);
    setTimeout(() => setConfirmedFlash(false), 1600);
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
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">IBANK · Simulador</span>
            </div>
            <button
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Conteúdo scrollável */}
          <div className="flex-1 overflow-y-auto scrollbar-thin-dark px-5 pb-4">
            {tab === "turbo" && (
              <div className="space-y-4">
                <CaixinhaHeader label="Caixinha Turbo" total={turboTotal} />
                {turboAccountsReal.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-8">Nenhuma conta turbo registrada.</p>
                ) : (
                  <RealAccountList items={turboAccountsReal} onSelect={setSelectedFixedIncome} />
                )}
              </div>
            )}

            {tab === "emergencia" && (
              <div className="space-y-4">
                <CaixinhaHeader label="Caixinha Emergência" total={emergenciaTotal} />
                {emergenciaAccountsReal.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-8">Nenhuma reserva de emergência registrada.</p>
                ) : (
                  <RealAccountList items={emergenciaAccountsReal} onSelect={setSelectedFixedIncome} />
                )}
              </div>
            )}

            {tab === "investimentos" && !buyAsset && (
              <div className="space-y-6">
                <CaixinhaHeader label="Investimentos" total={investimentosTotal} />

                {investedCost > 0 && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Investido</p>
                      <p className="text-base font-extrabold tabular-nums text-white mt-1">{formatCurrency(investedCost)}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">líquido em ações/FIIs</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Rendimento</p>
                      <p className={`text-base font-extrabold tabular-nums mt-1 inline-flex items-center gap-1 ${totalGain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {totalGain >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                        {formatCurrency(Math.abs(totalGain))}
                      </p>
                      <p className="text-[10px] text-white/30 mt-0.5">{totalGainPct >= 0 ? "+" : ""}{totalGainPct.toFixed(1)}% desde a compra</p>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Saldo disponível</p>
                    {editingCash ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-sm font-bold text-white/50">R$</span>
                        <input
                          autoFocus
                          type="text"
                          inputMode="decimal"
                          value={cashInput}
                          onChange={(e) => setCashInput(e.target.value.replace(/[^0-9,]/g, ""))}
                          onKeyDown={(e) => { if (e.key === "Enter") commitEditCash(); if (e.key === "Escape") setEditingCash(false); }}
                          onBlur={commitEditCash}
                          className="w-32 bg-transparent border-b border-violet-400 text-lg font-extrabold tabular-nums text-white focus:outline-none"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={startEditCash}
                        className="flex items-center gap-1.5 text-lg font-extrabold tabular-nums text-white mt-0.5 hover:text-violet-300 transition-colors"
                      >
                        <span>{formatCurrency(animatedCash)}</span>
                        <Pencil className="h-3 w-3 text-white/30 shrink-0" />
                      </button>
                    )}
                  </div>
                </div>

                {investimentosAccountsReal.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 mb-3">Renda fixa</p>
                    <RealAccountList items={investimentosAccountsReal} onSelect={setSelectedFixedIncome} />
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 mb-3">Ações &amp; FIIs</p>
                  {holdings.length === 0 ? (
                    <p className="text-sm text-white/40 text-center py-6">Você ainda não tem posições. Explore os ativos abaixo.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {holdings.map((h) => {
                        const asset = liveAssets.find((a) => a.ticker === h.ticker)!;
                        const value = h.quantity * asset.price * (1 + asset.variation);
                        const gain = value - h.quantity * h.avgPrice;
                        return (
                          <button
                            key={h.ticker}
                            onClick={() => setSelectedTicker(h.ticker)}
                            className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 hover:bg-white/[0.07] hover:border-white/20 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: asset.color }} />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-white truncate">{asset.ticker}</p>
                                  <p className="text-[11px] text-white/40 truncate">{formatQty(h.quantity)} un · {asset.category}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-extrabold tabular-nums text-white">{formatCurrency(value)}</p>
                                <p className={`text-[11px] font-semibold ${gain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {gain >= 0 ? "+" : ""}{formatCurrency(gain)}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40 mb-1">Explorar ativos</p>
                  <p className="text-xs text-white/40 mb-3">Cotação real quando o ativo já está na sua carteira.</p>
                  <div className="space-y-3">
                    {liveAssets.map((asset) => (
                      <button
                        key={asset.ticker}
                        onClick={() => openBuy(asset)}
                        className="w-full text-left rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 flex items-start justify-between gap-3 hover:bg-white/[0.07] hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0 mt-1" style={{ background: asset.color }} />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white">{asset.ticker}</p>
                            <p className="text-[11px] text-white/40 truncate">{asset.name} · {asset.category}</p>
                            {(asset.isReal || ownedTickers.has(asset.ticker)) && (
                              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                {asset.isReal && (
                                  <span className="text-[8px] font-bold uppercase tracking-wide text-emerald-400 border border-emerald-500/30 rounded px-1 py-[1px] shrink-0">
                                    cotação real
                                  </span>
                                )}
                                {ownedTickers.has(asset.ticker) && (
                                  <span className="text-[8px] font-bold uppercase tracking-wide text-white/40 shrink-0">você já tem</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-extrabold tabular-nums text-white">{formatCurrency(asset.price)}</p>
                          {!asset.isReal && (
                            <p className={`text-[11px] font-semibold ${asset.variation >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {asset.variation >= 0 ? "+" : ""}{(asset.variation * 100).toFixed(1)}%
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === "investimentos" && buyAsset && (
              <div className="pt-2">
                <button
                  onClick={() => setBuyAsset(null)}
                  className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 mb-4"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Voltar
                </button>

                <div className="flex items-center gap-3 mb-6">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: buyAsset.color }} />
                  <div>
                    <p className="text-lg font-bold text-white">{buyAsset.ticker}</p>
                    <p className="text-xs text-white/40">{buyAsset.name} · cota {formatCurrency(buyAsset.price)}</p>
                  </div>
                </div>

                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">Quanto deseja investir?</p>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-white/50">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value.replace(/[^0-9,]/g, ""))}
                      className="flex-1 bg-transparent text-2xl font-black text-white placeholder:text-white/20 focus:outline-none tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mb-6">
                  {[100, 500, 1000].map((v) => (
                    <button
                      key={v}
                      onClick={() => setBuyAmount(String(v))}
                      className="flex-1 rounded-full border border-white/10 bg-white/[0.04] py-1.5 text-xs font-semibold text-white/70 hover:bg-white/[0.08]"
                    >
                      +{v}
                    </button>
                  ))}
                  <button
                    onClick={() => setBuyAmount(String(Math.floor(cash)))}
                    className="flex-1 rounded-full border border-white/10 bg-white/[0.04] py-1.5 text-xs font-semibold text-white/70 hover:bg-white/[0.08]"
                  >
                    Máx.
                  </button>
                </div>

                {(() => {
                  const amount = parseFloat(buyAmount.replace(",", ".")) || 0;
                  const qty = amount > 0 ? amount / buyAsset.price : 0;
                  const insufficient = amount > cash;
                  return (
                    <>
                      <div className="flex justify-between text-xs text-white/40 mb-4 px-1">
                        <span>≈ {formatQty(qty)} unidades</span>
                        <span>Saldo: {formatCurrency(cash)}</span>
                      </div>
                      {insufficient && (
                        <p className="text-xs text-red-400 mb-3 text-center">Saldo insuficiente para esse valor.</p>
                      )}
                      <button
                        onClick={confirmBuy}
                        disabled={!amount || amount <= 0 || insufficient}
                        className="w-full rounded-full bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:text-white/30 py-3 text-sm font-bold text-white transition-colors"
                      >
                        Confirmar compra
                      </button>
                    </>
                  );
                })()}
              </div>
            )}

            {tab === "simular" && (
              <div className="space-y-5 pt-2">
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
              { id: "turbo" as const, label: "Turbo", icon: Zap },
              { id: "emergencia" as const, label: "Emergência", icon: Shield },
              { id: "investimentos" as const, label: "Investir", icon: Landmark },
              { id: "simular" as const, label: "Simular", icon: Calculator },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); if (t.id !== "investimentos") setBuyAsset(null); }}
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
                  <span className={`h-3 w-3 rounded-full shrink-0 mt-1.5 ${selectedFixedIncome.isTurbo ? "bg-amber-400" : "bg-blue-400"}`} />
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-white leading-snug">{selectedFixedIncome.nome}</p>
                    {selectedFixedIncome.instituicao && (
                      <p className="text-xs text-white/40 mt-0.5">{selectedFixedIncome.instituicao}</p>
                    )}
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
                    <p className="text-xs text-white/40 mt-0.5">{selectedHolding.asset.name} · {selectedHolding.asset.category}</p>
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
