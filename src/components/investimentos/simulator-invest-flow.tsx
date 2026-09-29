"use client";

import { useState, type ElementType } from "react";
import { Building2, ChevronRight, Landmark, TrendingUp, Zap, Shield, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { AccountRate } from "@/lib/account-rate";
import { FOCUS, LABEL, MONEY, ROW, BackLink } from "@/components/investimentos/live-ui";
import { AmountSheet, StockOrderSheet, type StockOrder } from "@/components/investimentos/live-money-sheets";
import type { MoneySource } from "@/components/investimentos/live-actions";
import { CatalogPicker } from "@/components/investimentos/catalog-picker";

export type TesouroProduct = {
  id: string;
  nome: string;
  taxa: string;
  descricao: string;
  color: string;
  rate: AccountRate;
};

export type AporteAccount = {
  id: string;
  nome: string;
  instituicao: string;
  valor: number;
  isTurbo: boolean;
  cdiPercent: number | null;
};

export type MarketSection = "hub" | "acoes" | "fiis" | "tesouro" | "turbo" | "eme";

type AmountTarget =
  | { kind: "tesouro"; product: TesouroProduct }
  | { kind: "aporte"; account: AporteAccount; group: string };

type Props = {
  cash: number;
  /** Cotações já conhecidas da carteira, usadas enquanto a de mercado não chega. */
  knownPrices?: Map<string, number>;
  tesouroProducts: TesouroProduct[];
  turboAccounts: AporteAccount[];
  emergenciaAccounts: AporteAccount[];
  /** Caixinhas de renda fixa que já existem (Tesouro, CDB, prefixado…), para aportar de novo. */
  rendaFixaAccounts?: AporteAccount[];
  section: MarketSection;
  onSectionChange: (section: MarketSection) => void;
  onClose: () => void;
  onBuyStock: (ticker: string, price: number, quantity: number, source: MoneySource) => Promise<void>;
  onBuyTesouro: (product: TesouroProduct, amount: number, source: MoneySource) => Promise<void>;
  onAporte: (accountId: string, amount: number, source: MoneySource) => Promise<void>;
  onCreateAccount?: (tipo: "turbo" | "emergencia" | "investimentos") => void;
  onAdjustCash?: () => void;
};

function CreateAccountButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full min-h-14 rounded-xl border border-dashed border-border p-3.5 text-left flex items-center gap-2.5 hover:bg-muted/60 hover:border-foreground/30 transition-colors ${FOCUS}`}
    >
      <span className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Plus className="h-4 w-4 text-foreground/70" aria-hidden="true" />
      </span>
      <span className="text-sm font-bold text-foreground">{label}</span>
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
    descricao: "Pode resgatar a qualquer dia · bom para reserva",
    color: "#3b82f6",
    rate: { rate_index: "selic", rate_value: 0.0463, maturity: "2029-03-01", tax_exempt: false },
  },
  {
    id: "prefix-2029",
    nome: "Tesouro Prefixado 2029",
    taxa: "13,85% ao ano",
    descricao: "Taxa travada até o vencimento",
    color: "#10b981",
    rate: { rate_index: "pre", rate_value: 13.85, maturity: "2029-01-01", tax_exempt: false },
  },
  {
    id: "ipca-2035",
    nome: "Tesouro IPCA+ 2035",
    taxa: "Inflação + 6,92%",
    descricao: "Protege contra a inflação",
    color: "#8b5cf6",
    rate: { rate_index: "ipca", rate_value: 6.92, maturity: "2035-05-15", tax_exempt: false },
  },
];

const SECTION_TITLE: Record<Exclude<MarketSection, "hub">, string> = {
  acoes: "Ações",
  fiis: "Fundos imobiliários",
  tesouro: "Tesouro Direto e renda fixa",
  turbo: "Caixinha Turbo",
  eme: "Reserva de emergência",
};

export function SimulatorInvestFlow({
  cash,
  knownPrices,
  tesouroProducts,
  turboAccounts,
  emergenciaAccounts,
  rendaFixaAccounts = [],
  section,
  onSectionChange,
  onClose,
  onBuyStock,
  onBuyTesouro,
  onAporte,
  onCreateAccount,
  onAdjustCash,
}: Props) {
  const [order, setOrder] = useState<StockOrder | null>(null);
  const [amountTarget, setAmountTarget] = useState<AmountTarget | null>(null);

  const amountTitle =
    amountTarget?.kind === "tesouro"
      ? `Comprar ${amountTarget.product.nome}`
      : amountTarget
        ? `Aplicar em ${amountTarget.account.nome}`
        : "";
  const amountDescription =
    amountTarget?.kind === "tesouro"
      ? `${amountTarget.product.taxa} · ${amountTarget.product.descricao}`
      : amountTarget?.group;

  return (
    <div className="space-y-5">
      <BackLink
        label={section === "hub" ? "Voltar" : "Outras opções"}
        onClick={() => {
          if (section === "hub") onClose();
          else onSectionChange("hub");
        }}
      />

      <div className="rounded-xl border border-border bg-card p-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={LABEL}>Saldo em conta</p>
          <p className={`${MONEY} text-2xl mt-1.5 leading-none tracking-tight`}>{formatCurrency(cash)}</p>
          <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
            {cash > 0
              ? "Use o saldo ou dinheiro de fora. Você escolhe na hora de confirmar."
              : "Sem saldo em conta. Você pode investir com dinheiro de fora e escolher isso na hora de confirmar."}
          </p>
        </div>
        {onAdjustCash && (
          <button
            type="button"
            onClick={onAdjustCash}
            className={`shrink-0 inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-xs font-bold text-foreground hover:bg-muted transition-colors ${FOCUS}`}
          >
            {cash > 0 ? "Ajustar saldo" : "Informar saldo"}
          </button>
        )}
      </div>

      {section === "hub" && (
        <div className="space-y-2.5">
          <h2 className={LABEL}>Onde você quer investir?</h2>
          <DestCard
            title="Ações"
            subtitle="Empresas da bolsa, como Petrobras, Itaú, Vale e WEG"
            icon={TrendingUp}
            onClick={() => onSectionChange("acoes")}
          />
          <DestCard
            title="Fundos imobiliários"
            subtitle="Renda mensal de aluguéis de galpões, shoppings, escritórios e recebíveis"
            icon={Building2}
            onClick={() => onSectionChange("fiis")}
          />
          <DestCard
            title="Tesouro Direto e renda fixa"
            subtitle="Títulos do Tesouro e suas caixinhas de renda fixa"
            icon={Landmark}
            onClick={() => onSectionChange("tesouro")}
          />
          <DestCard
            title="Caixinha Turbo"
            subtitle="Contas que rendem acima do CDI até um teto"
            icon={Zap}
            onClick={() => onSectionChange("turbo")}
          />
          <DestCard
            title="Reserva de emergência"
            subtitle="Dinheiro guardado para imprevistos"
            icon={Shield}
            onClick={() => onSectionChange("eme")}
          />
        </div>
      )}

      {section !== "hub" && (
        <div className="space-y-2">
          <h2 className={`${LABEL} mb-1`}>{SECTION_TITLE[section]}</h2>

          {(section === "acoes" || section === "fiis") && (
            <CatalogPicker
              key={section}
              kind={section === "acoes" ? "acao" : "fii"}
              knownPrices={knownPrices}
              onPick={(a) => setOrder(a.ticker ? { mode: "compra", ticker: a.ticker, name: a.name, price: a.price } : { mode: "compra" })}
            />
          )}

          {section === "tesouro" && (
            <>
              {rendaFixaAccounts.length > 0 && (
                <>
                  <p className={`${LABEL} pt-1`}>Suas caixinhas</p>
                  {rendaFixaAccounts.map((account) => (
                    <AccountButton
                      key={account.id}
                      title={account.nome}
                      subtitle={account.instituicao || "Renda fixa"}
                      value={account.valor}
                      onClick={() => setAmountTarget({ kind: "aporte", account, group: "Renda fixa" })}
                    />
                  ))}
                  <p className={`${LABEL} pt-3`}>Novo título do Tesouro</p>
                </>
              )}
              {tesouroProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setAmountTarget({ kind: "tesouro", product })}
                  className={`${ROW} min-h-14 p-3.5 flex items-start justify-between gap-3`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-foreground">{product.nome}</span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">{product.descricao}</span>
                  </span>
                  <span className="text-xs font-bold tabular-nums text-foreground shrink-0">{product.taxa}</span>
                </button>
              ))}
              {onCreateAccount && (
                <CreateAccountButton label="Outra renda fixa (CDB, LCI, prefixado…)" onClick={() => onCreateAccount("investimentos")} />
              )}
            </>
          )}

          {section === "turbo" && turboAccounts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Você ainda não tem caixinha Turbo. Crie uma para poder aplicar.
            </p>
          )}
          {section === "turbo" &&
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
                onClick={() => setAmountTarget({ kind: "aporte", account, group: "Caixinha Turbo" })}
              />
            ))}
          {section === "turbo" && onCreateAccount && (
            <CreateAccountButton label="Criar caixinha Turbo" onClick={() => onCreateAccount("turbo")} />
          )}

          {section === "eme" && emergenciaAccounts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Você ainda não tem reserva de emergência. Crie uma para poder aplicar.
            </p>
          )}
          {section === "eme" &&
            emergenciaAccounts.map((account) => (
              <AccountButton
                key={account.id}
                title={account.nome}
                subtitle={account.instituicao || "Reserva de emergência"}
                value={account.valor}
                onClick={() => setAmountTarget({ kind: "aporte", account, group: "Reserva de emergência" })}
              />
            ))}
          {section === "eme" && onCreateAccount && (
            <CreateAccountButton label="Criar reserva de emergência" onClick={() => onCreateAccount("emergencia")} />
          )}
        </div>
      )}

      <StockOrderSheet
        order={order}
        onClose={() => setOrder(null)}
        cash={cash}
        onBuy={onBuyStock}
        onSell={async () => {}}
      />

      <AmountSheet
        open={!!amountTarget}
        onOpenChange={(o) => !o && setAmountTarget(null)}
        title={amountTitle}
        description={amountDescription}
        cash={cash}
        verb={amountTarget?.kind === "tesouro" ? "Comprar" : "Aplicar"}
        onConfirm={async (amount, source) => {
          if (!amountTarget) return;
          if (amountTarget.kind === "tesouro") await onBuyTesouro(amountTarget.product, amount, source);
          else await onAporte(amountTarget.account.id, amount, source);
        }}
      />
    </div>
  );
}
