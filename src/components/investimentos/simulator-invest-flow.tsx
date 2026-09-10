"use client";

import { useMemo, useState, type ElementType } from "react";
import {
  ChevronLeft,
  Landmark,
  TrendingUp,
  Zap,
  Shield,
  Check,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export type SimHolding = {
  ticker: string;
  quantity: number;
  avgPrice: number;
};

export type SimTesouroBuy = {
  id: string;
  nome: string;
  valor: number;
  taxa: string;
};

export type SimInvestState = {
  holdings: SimHolding[];
  aportes: Record<string, number>;
  tesouro: SimTesouroBuy[];
};

export const SIM_INVEST_STORAGE_KEY = "ibank_live_sim_invest";

export function readSimInvestState(): SimInvestState {
  try {
    const raw = localStorage.getItem(SIM_INVEST_STORAGE_KEY);
    if (!raw) return { holdings: [], aportes: {}, tesouro: [] };
    const parsed = JSON.parse(raw) as Partial<SimInvestState>;
    return {
      holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
      aportes:
        parsed.aportes && typeof parsed.aportes === "object" ? parsed.aportes : {},
      tesouro: Array.isArray(parsed.tesouro) ? parsed.tesouro : [],
    };
  } catch {
    return { holdings: [], aportes: {}, tesouro: [] };
  }
}

export function writeSimInvestState(state: SimInvestState) {
  try {
    localStorage.setItem(SIM_INVEST_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export type MarketCatalogAsset = {
  ticker: string;
  name: string;
  category: "Ação" | "FII" | "ETF";
  price: number;
  variation: number;
  color: string;
};

export type TesouroProduct = {
  id: string;
  nome: string;
  taxa: string;
  descricao: string;
  color: string;
};

export type AporteAccount = {
  id: string;
  nome: string;
  instituicao: string;
  valor: number;
  isTurbo: boolean;
  cdiPercent: number | null;
};

export type MarketSection = "hub" | "acoes" | "tesouro" | "turbo" | "eme";

type BuyTarget =
  | { kind: "stock"; asset: MarketCatalogAsset }
  | { kind: "tesouro"; product: TesouroProduct }
  | { kind: "aporte"; account: AporteAccount; group: "turbo" | "eme" };

type Props = {
  cash: number;
  catalog: MarketCatalogAsset[];
  tesouroProducts: TesouroProduct[];
  turboAccounts: AporteAccount[];
  emergenciaAccounts: AporteAccount[];
  section: MarketSection;
  onSectionChange: (section: MarketSection) => void;
  onClose: () => void;
  onBuyStock: (ticker: string, name: string, price: number, amount: number) => void;
  onBuyTesouro: (product: TesouroProduct, amount: number) => void;
  onAporte: (accountId: string, amount: number) => void;
};

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

function QuickAmount({
  label,
  onClick,
  active,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-xs font-bold tabular-nums transition-colors ${
        active
          ? "border-violet-400/60 bg-violet-500 text-white"
          : "border-white/15 bg-white/[0.06] text-white/80 hover:bg-white/[0.12] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function DestCard({
  title,
  subtitle,
  icon: Icon,
  tone,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: ElementType;
  tone: "violet" | "emerald" | "amber" | "blue";
  onClick: () => void;
}) {
  const tones = {
    violet: {
      border: "border-violet-500/30",
      bg: "bg-violet-500/[0.08] hover:bg-violet-500/[0.14]",
      icon: "text-violet-300",
      iconBg: "bg-violet-500/20",
    },
    emerald: {
      border: "border-emerald-500/30",
      bg: "bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14]",
      icon: "text-emerald-300",
      iconBg: "bg-emerald-500/20",
    },
    amber: {
      border: "border-amber-500/30",
      bg: "bg-amber-500/[0.08] hover:bg-amber-500/[0.14]",
      icon: "text-amber-300",
      iconBg: "bg-amber-500/20",
    },
    blue: {
      border: "border-blue-500/30",
      bg: "bg-blue-500/[0.08] hover:bg-blue-500/[0.14]",
      icon: "text-blue-300",
      iconBg: "bg-blue-500/20",
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border ${tones.border} ${tones.bg} p-4 text-left transition-colors`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-11 w-11 rounded-full ${tones.iconBg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${tones.icon}`} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-[11px] text-white/45 mt-0.5 leading-snug">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}

export const DEFAULT_TESOURO_PRODUCTS: TesouroProduct[] = [
  {
    id: "selic-2029",
    nome: "Tesouro Selic 2029",
    taxa: "Selic + 0,0463%",
    descricao: "Liquidez diária · ideal para reserva",
    color: "#3b82f6",
  },
  {
    id: "prefix-2029",
    nome: "Tesouro Prefixado 2029",
    taxa: "13,85% a.a.",
    descricao: "Taxa travada até o vencimento",
    color: "#10b981",
  },
  {
    id: "ipca-2035",
    nome: "Tesouro IPCA+ 2035",
    taxa: "IPCA + 6,92%",
    descricao: "Proteção contra inflação",
    color: "#8b5cf6",
  },
];

export function SimulatorInvestFlow({
  cash,
  catalog,
  tesouroProducts,
  turboAccounts,
  emergenciaAccounts,
  section,
  onSectionChange,
  onClose,
  onBuyStock,
  onBuyTesouro,
  onAporte,
}: Props) {
  const [buyTarget, setBuyTarget] = useState<BuyTarget | null>(null);
  const [amountMask, setAmountMask] = useState("");
  const [justBought, setJustBought] = useState(false);

  const amount = parseBRLMask(amountMask);
  const canConfirm = amount > 0 && amount <= cash + 0.001 && !justBought;

  const stockPreviewQty = useMemo(() => {
    if (!buyTarget || buyTarget.kind !== "stock") return 0;
    if (buyTarget.asset.price <= 0) return 0;
    return amount / buyTarget.asset.price;
  }, [buyTarget, amount]);

  function openBuy(target: BuyTarget) {
    setBuyTarget(target);
    setAmountMask("");
    setJustBought(false);
  }

  function setQuick(value: number) {
    const capped = Math.min(value, cash);
    setAmountMask(
      formatBRLMask(String(Math.round(Math.max(0, capped) * 100)))
    );
  }

  function confirm() {
    if (!buyTarget || !canConfirm) return;
    if (buyTarget.kind === "stock") {
      onBuyStock(
        buyTarget.asset.ticker,
        buyTarget.asset.name,
        buyTarget.asset.price,
        amount
      );
    } else if (buyTarget.kind === "tesouro") {
      onBuyTesouro(buyTarget.product, amount);
    } else {
      onAporte(buyTarget.account.id, amount);
    }
    setJustBought(true);
    setTimeout(() => {
      setBuyTarget(null);
      setJustBought(false);
      setAmountMask("");
    }, 1100);
  }

  const sectionTitle =
    section === "acoes"
      ? "Ações & FIIs"
      : section === "tesouro"
        ? "Tesouro Direto"
        : section === "turbo"
          ? "Caixinha Turbo"
          : section === "eme"
            ? "Caixinha EME"
            : "Aplicar saldo";

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => {
          if (section === "hub") onClose();
          else onSectionChange("hub");
        }}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/55 hover:text-white/80"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {section === "hub" ? "Voltar" : "Mercado"}
      </button>

      <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-white/[0.03] to-violet-500/10 p-4">
        <div className="flex items-center gap-2 text-emerald-300/80 mb-1">
          <Wallet className="h-3.5 w-3.5" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
            Saldo disponível
          </p>
        </div>
        <p className="text-2xl font-black tabular-nums text-white">
          {formatCurrency(cash)}
        </p>
        <p className="text-[11px] text-white/40 mt-1">
          Use esse valor para comprar ativos no simulador.
        </p>
      </div>

      {section === "hub" && (
        <div className="space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40">
            Para onde investir?
          </p>
          <DestCard
            title="Ações & FIIs"
            subtitle="Compre papéis da bolsa com cotação ao vivo"
            icon={TrendingUp}
            tone="violet"
            onClick={() => onSectionChange("acoes")}
          />
          <DestCard
            title="Tesouro Direto"
            subtitle="Selic, Prefixado e IPCA+ com aporte mínimo flexível"
            icon={Landmark}
            tone="emerald"
            onClick={() => onSectionChange("tesouro")}
          />
          <DestCard
            title="Caixinha Turbo"
            subtitle="Aporte nas contas de alta liquidez"
            icon={Zap}
            tone="amber"
            onClick={() => onSectionChange("turbo")}
          />
          <DestCard
            title="Caixinha EME"
            subtitle="Reforce a reserva de emergência"
            icon={Shield}
            tone="blue"
            onClick={() => onSectionChange("eme")}
          />
        </div>
      )}

      {section !== "hub" && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/40">
            {sectionTitle}
          </p>

          {section === "acoes" &&
            (catalog.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-8">
                Nenhum ativo disponível.
              </p>
            ) : (
              catalog.map((asset) => (
                <button
                  key={asset.ticker}
                  type="button"
                  onClick={() => openBuy({ kind: "stock", asset })}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left hover:bg-white/[0.07] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: asset.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {asset.ticker}
                        </p>
                        <p className="text-[10px] text-white/40 truncate">
                          {asset.name} · {asset.category}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-extrabold tabular-nums text-white">
                        {formatCurrency(asset.price)}
                      </p>
                      <p
                        className={`text-[10px] font-semibold ${
                          asset.variation >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {asset.variation >= 0 ? "+" : ""}
                        {(asset.variation * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </button>
              ))
            ))}

          {section === "tesouro" &&
            tesouroProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => openBuy({ kind: "tesouro", product })}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-left hover:bg-white/[0.07] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">{product.nome}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      {product.descricao}
                    </p>
                  </div>
                  <p
                    className="text-xs font-bold shrink-0"
                    style={{ color: product.color }}
                  >
                    {product.taxa}
                  </p>
                </div>
              </button>
            ))}

          {section === "turbo" &&
            (turboAccounts.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-8">
                Nenhuma conta turbo para aportar.
              </p>
            ) : (
              turboAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => openBuy({ kind: "aporte", account, group: "turbo" })}
                  className="w-full rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5 text-left hover:bg-amber-500/[0.1] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {account.nome}
                      </p>
                      <p className="text-[10px] text-white/40">
                        {account.cdiPercent != null
                          ? `${account.cdiPercent}% do CDI`
                          : account.instituicao || "Turbo"}
                      </p>
                    </div>
                    <p className="text-sm font-extrabold tabular-nums text-white shrink-0">
                      {formatCurrency(account.valor)}
                    </p>
                  </div>
                </button>
              ))
            ))}

          {section === "eme" &&
            (emergenciaAccounts.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-8">
                Nenhuma conta de emergência para aportar.
              </p>
            ) : (
              emergenciaAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => openBuy({ kind: "aporte", account, group: "eme" })}
                  className="w-full rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-3.5 text-left hover:bg-blue-500/[0.1] transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {account.nome}
                      </p>
                      <p className="text-[10px] text-white/40">
                        {account.instituicao || "Emergência"}
                      </p>
                    </div>
                    <p className="text-sm font-extrabold tabular-nums text-white shrink-0">
                      {formatCurrency(account.valor)}
                    </p>
                  </div>
                </button>
              ))
            ))}
        </div>
      )}

      {buyTarget && (
        <div
          className="absolute inset-0 z-40 bg-black/65 backdrop-blur-sm flex items-end"
          onClick={() => !justBought && setBuyTarget(null)}
        >
          <div
            className="w-full rounded-t-3xl bg-[#0a0a12] border-t border-white/10 px-5 pt-3 pb-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-5">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {justBought ? (
              <div className="py-8 text-center space-y-3">
                <span className="mx-auto h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="h-7 w-7 text-emerald-400" />
                </span>
                <p className="text-lg font-bold text-white">Investimento feito!</p>
                <p className="text-sm text-white/50">
                  {formatCurrency(amount)} aplicados com sucesso.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1.5">
                    Comprar
                  </p>
                  <p className="text-xl font-bold text-white leading-tight">
                    {buyTarget.kind === "stock"
                      ? buyTarget.asset.ticker
                      : buyTarget.kind === "tesouro"
                        ? buyTarget.product.nome
                        : buyTarget.account.nome}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    {buyTarget.kind === "stock"
                      ? `${buyTarget.asset.name} · ${formatCurrency(buyTarget.asset.price)}`
                      : buyTarget.kind === "tesouro"
                        ? buyTarget.product.taxa
                        : buyTarget.group === "turbo"
                          ? "Aporte Turbo"
                          : "Aporte Emergência"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 mb-4 flex items-center justify-between">
                  <span className="text-[11px] text-white/45">Saldo</span>
                  <span className="text-sm font-bold tabular-nums text-white">
                    {formatCurrency(cash)}
                  </span>
                </div>

                <label className="block mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Valor
                  </span>
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/[0.06] px-3.5 py-3.5">
                    <span className="text-sm font-bold text-white/50">R$</span>
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      value={amountMask}
                      onChange={(e) =>
                        setAmountMask(formatBRLMask(e.target.value.replace(/\D/g, "")))
                      }
                      placeholder="0,00"
                      className="flex-1 bg-transparent text-xl font-black tabular-nums text-white focus:outline-none"
                    />
                  </div>
                </label>

                <div className="flex flex-wrap gap-2 mb-5">
                  {[100, 250, 500, 1000].map((v) => (
                    <QuickAmount
                      key={v}
                      label={formatCurrency(v)}
                      active={Math.abs(amount - v) < 0.001}
                      onClick={() => setQuick(v)}
                    />
                  ))}
                  <QuickAmount
                    label="Tudo"
                    active={cash > 0 && Math.abs(amount - cash) < 0.01}
                    onClick={() => setQuick(cash)}
                  />
                </div>

                {buyTarget.kind === "stock" && amount > 0 && (
                  <p className="text-xs text-white/45 mb-4">
                    Você leva ≈{" "}
                    <span className="font-bold text-white">
                      {stockPreviewQty.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}{" "}
                      un.
                    </span>{" "}
                    de {buyTarget.asset.ticker}
                  </p>
                )}

                {amount > cash + 0.001 && (
                  <p className="text-xs text-red-400 mb-3">
                    Saldo insuficiente para esse valor.
                  </p>
                )}

                <button
                  type="button"
                  disabled={!canConfirm}
                  onClick={confirm}
                  className="w-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 py-3.5 text-sm font-bold text-white disabled:opacity-35 disabled:cursor-not-allowed transition-opacity"
                >
                  Confirmar investimento
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
