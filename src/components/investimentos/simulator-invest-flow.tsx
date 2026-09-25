"use client";

import { useMemo, useState, type ElementType, type FormEvent } from "react";
import { ChevronRight, Landmark, TrendingUp, Zap, Shield, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  FOCUS, LABEL, MONEY, BTN_PRIMARY, BTN_SECONDARY, ROW, INPUT_BOX, LOSS, ATTENTION,
  LiveSheet, BackLink,
} from "@/components/investimentos/live-ui";

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
  | { kind: "custom" }
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
  onBuyStock: (ticker: string, name: string, price: number, amount: number) => Promise<void> | void;
  onBuyTesouro: (product: TesouroProduct, amount: number) => Promise<void> | void;
  onAporte: (accountId: string, amount: number) => Promise<void> | void;
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
  disabled,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`min-h-11 rounded-lg border px-3.5 text-xs font-bold tabular-nums transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS} ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-foreground/80 hover:bg-muted hover:text-foreground"
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
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: ElementType;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`${ROW} min-h-16 p-3.5 flex items-center gap-3`}>
      <span className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-foreground/70" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-foreground">{title}</span>
        <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
    </button>
  );
}

function AccountButton({
  title,
  subtitle,
  value,
  onClick,
}: {
  title: string;
  subtitle: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`${ROW} min-h-14 p-3.5 flex items-center justify-between gap-3`}>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-foreground truncate">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
      <span className={`${MONEY} text-sm shrink-0`}>{formatCurrency(value)}</span>
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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customTicker, setCustomTicker] = useState("");
  const [customPriceMask, setCustomPriceMask] = useState("");
  const [customQtyMask, setCustomQtyMask] = useState("");

  const amount = parseBRLMask(amountMask);
  const isCustom = buyTarget?.kind === "custom";
  const customPrice = parseBRLMask(customPriceMask);
  const customQty = (() => {
    const n = parseInt(customQtyMask.replace(/\D/g, "") || "0", 10);
    return Number.isFinite(n) ? n : 0;
  })();
  const customTotal = customPrice > 0 && customQty > 0 ? customPrice * customQty : 0;
  const customTickerClean = customTicker.trim().toUpperCase();

  const canConfirmCustom =
    isCustom &&
    customTickerClean.length >= 2 &&
    customPrice > 0 &&
    customQty > 0 &&
    customTotal <= cash + 0.001 &&
    !submitting;

  const canConfirmPreset =
    !isCustom && amount > 0 && amount <= cash + 0.001 && !submitting &&
    (buyTarget?.kind !== "stock" || amount >= buyTarget.asset.price);

  const canConfirm = isCustom ? canConfirmCustom : canConfirmPreset;

  const stockPreviewQty = useMemo(() => {
    if (!buyTarget || buyTarget.kind !== "stock") return 0;
    if (buyTarget.asset.price <= 0) return 0;
    return Math.floor(amount / buyTarget.asset.price);
  }, [buyTarget, amount]);

  function resetCustomFields() {
    setCustomTicker("");
    setCustomPriceMask("");
    setCustomQtyMask("");
  }

  function openBuy(target: BuyTarget) {
    setBuyTarget(target);
    setAmountMask("");
    setSubmitError(null);
    resetCustomFields();
  }

  function setQuick(value: number) {
    const capped = Math.min(value, cash);
    setAmountMask(formatBRLMask(String(Math.round(Math.max(0, capped) * 100))));
  }

  async function confirm(e?: FormEvent) {
    e?.preventDefault();
    if (!buyTarget || !canConfirm) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (buyTarget.kind === "custom") {
        await onBuyStock(customTickerClean, customTickerClean, customPrice, customTotal);
      } else if (buyTarget.kind === "stock") {
        await onBuyStock(buyTarget.asset.ticker, buyTarget.asset.name, buyTarget.asset.price, amount);
      } else if (buyTarget.kind === "tesouro") {
        await onBuyTesouro(buyTarget.product, amount);
      } else {
        await onAporte(buyTarget.account.id, amount);
      }
      setBuyTarget(null);
      setAmountMask("");
      resetCustomFields();
    } catch (err) {
      console.error("Erro ao confirmar investimento:", err);
      setSubmitError(err instanceof Error ? err.message : "Não foi possível concluir. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const sectionTitle =
    section === "acoes"
      ? "Ações e FIIs"
      : section === "tesouro"
        ? "Tesouro Direto"
        : section === "turbo"
          ? "Caixinha Turbo"
          : section === "eme"
            ? "Caixinha Emergência"
            : "Aplicar saldo";

  const presetTitle =
    buyTarget?.kind === "stock"
      ? `Comprar ${buyTarget.asset.ticker}`
      : buyTarget?.kind === "tesouro"
        ? `Comprar ${buyTarget.product.nome}`
        : buyTarget?.kind === "aporte"
          ? `Aportar em ${buyTarget.account.nome}`
          : "Investir";

  const presetDescription =
    buyTarget?.kind === "stock"
      ? `${buyTarget.asset.name} · ${formatCurrency(buyTarget.asset.price)} por ação`
      : buyTarget?.kind === "tesouro"
        ? `${buyTarget.product.taxa} · ${buyTarget.product.descricao}`
        : buyTarget?.kind === "aporte"
          ? buyTarget.group === "turbo"
            ? "Caixinha Turbo"
            : "Caixinha Emergência"
          : undefined;

  const cashLine = (
    <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3 mb-4 flex items-center justify-between">
      <span className="text-xs text-muted-foreground">Saldo em conta</span>
      <span className={`${MONEY} text-sm`}>{formatCurrency(cash)}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      <BackLink
        label={section === "hub" ? "Voltar" : "Aplicar saldo"}
        onClick={() => {
          if (section === "hub") onClose();
          else onSectionChange("hub");
        }}
      />

      <div className="rounded-xl border border-border bg-card p-4">
        <p className={LABEL}>Saldo em conta</p>
        <p className={`${MONEY} text-2xl mt-1.5 leading-none tracking-tight`}>{formatCurrency(cash)}</p>
        <p className="text-[11px] text-muted-foreground mt-2">
          {cash > 0
            ? "Valor disponível na sua conta para investir."
            : "Sem saldo em conta. Ajuste o saldo no Início para investir."}
        </p>
      </div>

      {section === "hub" && (
        <div className="space-y-2.5">
          <h2 className={LABEL}>Para onde investir?</h2>
          <DestCard
            title="Ações e FIIs"
            subtitle="Compre papéis da bolsa com o saldo em conta"
            icon={TrendingUp}
            onClick={() => onSectionChange("acoes")}
          />
          <DestCard
            title="Tesouro Direto"
            subtitle="Selic, Prefixado e IPCA+ com aporte flexível"
            icon={Landmark}
            onClick={() => onSectionChange("tesouro")}
          />
          <DestCard
            title="Caixinha Turbo"
            subtitle="Aporte nas contas de alta liquidez"
            icon={Zap}
            onClick={() => onSectionChange("turbo")}
          />
          <DestCard
            title="Caixinha Emergência"
            subtitle="Reforce a reserva de emergência"
            icon={Shield}
            onClick={() => onSectionChange("eme")}
          />
        </div>
      )}

      {section !== "hub" && (
        <div className="space-y-2">
          <h2 className={`${LABEL} mb-1`}>{sectionTitle}</h2>

          {section === "acoes" && (
            <>
              {catalog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum ativo disponível.</p>
              ) : (
                catalog.map((asset) => (
                  <button
                    key={asset.ticker}
                    type="button"
                    onClick={() => openBuy({ kind: "stock", asset })}
                    className={`${ROW} min-h-14 p-3.5 flex items-center justify-between gap-3`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-foreground truncate">{asset.ticker}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">
                        {asset.name} · {asset.category}
                      </span>
                    </span>
                    <span className={`${MONEY} text-sm shrink-0`}>{formatCurrency(asset.price)}</span>
                  </button>
                ))
              )}

              <button
                type="button"
                onClick={() => openBuy({ kind: "custom" })}
                className={`w-full min-h-14 rounded-xl border border-dashed border-border p-3.5 text-left flex items-center gap-2.5 hover:bg-muted/60 hover:border-foreground/30 transition-colors ${FOCUS}`}
              >
                <span className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Plus className="h-4 w-4 text-foreground/70" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground">Outra ação ou FII</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Digite ticker, cotação e quantidade
                  </span>
                </span>
              </button>
            </>
          )}

          {section === "tesouro" &&
            tesouroProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => openBuy({ kind: "tesouro", product })}
                className={`${ROW} min-h-14 p-3.5 flex items-start justify-between gap-3`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground">{product.nome}</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">{product.descricao}</span>
                </span>
                <span className="text-xs font-bold tabular-nums text-foreground shrink-0">{product.taxa}</span>
              </button>
            ))}

          {section === "turbo" &&
            (turboAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conta Turbo para aportar.</p>
            ) : (
              turboAccounts.map((account) => (
                <AccountButton
                  key={account.id}
                  title={account.nome}
                  subtitle={
                    account.cdiPercent != null
                      ? `${account.cdiPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% do CDI`
                      : account.instituicao || "Turbo"
                  }
                  value={account.valor}
                  onClick={() => openBuy({ kind: "aporte", account, group: "turbo" })}
                />
              ))
            ))}

          {section === "eme" &&
            (emergenciaAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma conta de emergência para aportar.
              </p>
            ) : (
              emergenciaAccounts.map((account) => (
                <AccountButton
                  key={account.id}
                  title={account.nome}
                  subtitle={account.instituicao || "Emergência"}
                  value={account.valor}
                  onClick={() => openBuy({ kind: "aporte", account, group: "eme" })}
                />
              ))
            ))}
        </div>
      )}

      {/* Compra personalizada */}
      <LiveSheet
        open={buyTarget?.kind === "custom"}
        onOpenChange={(o) => !o && setBuyTarget(null)}
        dismissible={!submitting}
        title={customTickerClean ? `Comprar ${customTickerClean}` : "Outra ação ou FII"}
        description="Informe ticker, cotação atual e quantidade."
      >
        <form onSubmit={confirm}>
          {cashLine}

          <label htmlFor="flow-ticker" className={LABEL}>Ticker</label>
          <div className={`${INPUT_BOX} mt-1.5 mb-3`}>
            <input
              id="flow-ticker"
              autoFocus
              type="text"
              autoCapitalize="characters"
              value={customTicker}
              onChange={(e) =>
                setCustomTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12))
              }
              placeholder="Ex: PETR4"
              className="flex-1 min-w-0 bg-transparent font-display text-xl font-black tracking-wide text-foreground placeholder:text-muted-foreground/50 focus:outline-none uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label htmlFor="flow-price" className={LABEL}>Cotação atual</label>
              <div className={`${INPUT_BOX} mt-1.5`}>
                <span className="text-xs font-bold text-muted-foreground">R$</span>
                <input
                  id="flow-price"
                  type="text"
                  inputMode="numeric"
                  value={customPriceMask}
                  onChange={(e) => setCustomPriceMask(formatBRLMask(e.target.value.replace(/\D/g, "")))}
                  placeholder="0,00"
                  className="flex-1 min-w-0 bg-transparent text-base font-bold tabular-nums text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="flow-qty" className={LABEL}>Quantidade</label>
              <div className={`${INPUT_BOX} mt-1.5`}>
                <input
                  id="flow-qty"
                  type="text"
                  inputMode="numeric"
                  value={customQtyMask}
                  onChange={(e) => setCustomQtyMask(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="0"
                  className="flex-1 min-w-0 bg-transparent text-base font-bold tabular-nums text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
                <span className="text-xs font-semibold text-muted-foreground">un.</span>
              </div>
            </div>
          </div>

          <div aria-live="polite">
            {customTotal > 0 && (
              <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-3 mb-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className={`${MONEY} text-base`}>{formatCurrency(customTotal)}</span>
              </div>
            )}
            {customTotal > cash + 0.001 && (
              <p className={`text-xs mb-3 ${LOSS}`}>Saldo em conta insuficiente para esse total.</p>
            )}
            {submitError && <p className={`text-xs mb-3 ${LOSS}`} role="alert">{submitError}</p>}
          </div>

          <div className="space-y-2">
            <button type="submit" disabled={!canConfirm} className={BTN_PRIMARY}>
              {submitting
                ? "Processando…"
                : customTotal > 0
                  ? `Confirmar compra · ${formatCurrency(customTotal)}`
                  : "Confirmar compra"}
            </button>
            <button type="button" disabled={submitting} onClick={() => setBuyTarget(null)} className={BTN_SECONDARY}>
              Cancelar
            </button>
          </div>
        </form>
      </LiveSheet>

      {/* Compra de ativo do catálogo, Tesouro ou aporte em caixinha */}
      <LiveSheet
        open={!!buyTarget && buyTarget.kind !== "custom"}
        onOpenChange={(o) => !o && setBuyTarget(null)}
        dismissible={!submitting}
        title={presetTitle}
        description={presetDescription}
      >
        {buyTarget && buyTarget.kind !== "custom" && (
          <form onSubmit={confirm}>
            {cashLine}

            <label htmlFor="flow-amount" className={LABEL}>Valor</label>
            <div className={`${INPUT_BOX} mt-1.5 mb-3`}>
              <span className="text-sm font-bold text-muted-foreground">R$</span>
              <input
                id="flow-amount"
                autoFocus
                type="text"
                inputMode="numeric"
                value={amountMask}
                onChange={(e) => setAmountMask(formatBRLMask(e.target.value.replace(/\D/g, "")))}
                placeholder="0,00"
                aria-describedby="flow-amount-feedback"
                className="flex-1 min-w-0 bg-transparent font-display text-xl font-black tabular-nums text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {[100, 250, 500, 1000].map((v) => (
                <QuickAmount
                  key={v}
                  label={formatCurrency(v)}
                  active={Math.abs(amount - v) < 0.001}
                  disabled={cash <= 0}
                  onClick={() => setQuick(v)}
                />
              ))}
              <QuickAmount
                label="Tudo"
                active={cash > 0 && Math.abs(amount - cash) < 0.01}
                disabled={cash <= 0}
                onClick={() => setQuick(cash)}
              />
            </div>

            <div id="flow-amount-feedback" aria-live="polite">
              {buyTarget.kind === "stock" && amount > 0 && (
                <p className="text-xs text-muted-foreground mb-4">
                  {stockPreviewQty > 0 ? (
                    <>
                      Você leva <span className="font-bold text-foreground">{stockPreviewQty} un.</span> de{" "}
                      {buyTarget.asset.ticker} por{" "}
                      <span className="font-bold text-foreground tabular-nums">
                        {formatCurrency(stockPreviewQty * buyTarget.asset.price)}
                      </span>
                      .
                    </>
                  ) : (
                    <span className={ATTENTION}>
                      Valor insuficiente para 1 ação ({formatCurrency(buyTarget.asset.price)}).
                    </span>
                  )}
                </p>
              )}
              {amount > cash + 0.001 && (
                <p className={`text-xs mb-3 ${LOSS}`}>Saldo em conta insuficiente para esse valor.</p>
              )}
              {submitError && <p className={`text-xs mb-3 ${LOSS}`} role="alert">{submitError}</p>}
            </div>

            <div className="space-y-2">
              <button type="submit" disabled={!canConfirm} className={BTN_PRIMARY}>
                {submitting
                  ? "Processando…"
                  : buyTarget.kind === "aporte"
                    ? "Confirmar aporte"
                    : "Confirmar compra"}
              </button>
              <button type="button" disabled={submitting} onClick={() => setBuyTarget(null)} className={BTN_SECONDARY}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </LiveSheet>
    </div>
  );
}
