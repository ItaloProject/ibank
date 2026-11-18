"use client";

import { useEffect, useState, type ElementType } from "react";
import { Building2, ChevronRight, Landmark, PiggyBank, TrendingUp, Zap, Shield, Plus } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { isEmergenciaProductName, isTesouroName, type FixedIncomeEntry } from "@/lib/fixed-income-catalog";
import { FOCUS, LABEL, MONEY, ROW, BackLink } from "@/components/investimentos/live-ui";
import { AmountSheet, FixedIncomeSheet, StockOrderSheet, type StockOrder } from "@/components/investimentos/live-money-sheets";
import type { FixedIncomeProduct, MoneySource } from "@/components/investimentos/live-actions";
import { CatalogPicker } from "@/components/investimentos/catalog-picker";
import { FixedIncomePicker } from "@/components/investimentos/fixed-income-picker";

export type AporteAccount = {
  id: string;
  nome: string;
  instituicao: string;
  valor: number;
  isTurbo: boolean;
  cdiPercent: number | null;
};

export type MarketSection = "hub" | "acoes" | "fiis" | "tesouro" | "rendafixa" | "turbo" | "eme";

type AmountTarget = { account: AporteAccount; group: string };

type Props = {
  cash: number;
  /** Cotações já conhecidas da carteira, usadas enquanto a de mercado não chega. */
  knownPrices?: Map<string, number>;
  turboAccounts: AporteAccount[];
  emergenciaAccounts: AporteAccount[];
  /** Caixinhas de renda fixa que já existem (Tesouro, CDB, prefixado…), para aportar de novo. */
  rendaFixaAccounts?: AporteAccount[];
  section: MarketSection;
  onSectionChange: (section: MarketSection) => void;
  onClose: () => void;
  onBuyStock: (ticker: string, price: number, quantity: number, source: MoneySource) => Promise<void>;
  onBuyFixedIncome: (product: FixedIncomeProduct, amount: number, source: MoneySource) => Promise<void>;
  onAporte: (accountId: string, amount: number, source: MoneySource) => Promise<void>;
  onCreateAccount?: (tipo: "turbo" | "emergencia" | "investimentos") => void;
  onAdjustCash?: () => void;
  /** Valor sugerido pelo assistente: preenche o campo de valor; com uma só conta na seção, já abre a aplicação. */
  suggestedAmount?: number;
  /** `desktop` = hub em grade wide; `stack` = lista do celular. */
  variant?: "stack" | "desktop";
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
  desktop,
}: {
  title: string;
  subtitle: string;
  icon: ElementType;
  onClick: () => void;
  desktop?: boolean;
}) {
  if (desktop) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-[132px] flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-muted/30",
          FOCUS,
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-muted text-foreground">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 space-y-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-foreground">{title}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </span>
          <span className="block text-[12px] leading-snug text-muted-foreground">{subtitle}</span>
        </span>
      </button>
    );
  }
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
  badge,
}: {
  title: string;
  subtitle: string;
  value: number;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={`${ROW} min-h-14 p-3.5 flex items-center justify-between gap-3`}>
      <span className="min-w-0">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-foreground truncate">{title}</span>
          {badge && (
            <span className="inline-flex shrink-0 items-center rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              {badge}
            </span>
          )}
        </span>
        <span className="block text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
      <span className={`${MONEY} text-sm shrink-0`}>{formatCurrency(value)}</span>
    </button>
  );
}

const SECTION_TITLE: Record<Exclude<MarketSection, "hub">, string> = {
  acoes: "Ações",
  fiis: "Fundos imobiliários",
  tesouro: "Tesouro Direto",
  rendafixa: "Renda fixa",
  turbo: "Caixinha Turbo",
  eme: "Reserva de emergência",
};

export function SimulatorInvestFlow({
  cash,
  knownPrices,
  turboAccounts,
  emergenciaAccounts,
  rendaFixaAccounts = [],
  section,
  onSectionChange,
  onClose,
  onBuyStock,
  onBuyFixedIncome,
  onAporte,
  onCreateAccount,
  onAdjustCash,
  suggestedAmount,
  variant = "stack",
}: Props) {
  const desktop = variant === "desktop";
  const [order, setOrder] = useState<StockOrder | null>(null);
  const [amountTarget, setAmountTarget] = useState<AmountTarget | null>(null);
  const [fixedEntry, setFixedEntry] = useState<FixedIncomeEntry | null>(null);

  useEffect(() => {
    if (!suggestedAmount) return;
    const only = section === "eme" ? emergenciaAccounts : section === "turbo" ? turboAccounts : [];
    if (only.length === 1) {
      setAmountTarget({ account: only[0], group: section === "eme" ? "Reserva de emergência" : "Caixinha Turbo" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, suggestedAmount]);

  const ownTesouro = rendaFixaAccounts.filter((a) => isTesouroName(a.nome));
  const ownRendaFixa = rendaFixaAccounts.filter((a) => !isTesouroName(a.nome));
  const ownFixed = section === "tesouro" ? ownTesouro : ownRendaFixa;

  const destinations: { section: Exclude<MarketSection, "hub">; title: string; subtitle: string; icon: ElementType }[] = [
    { section: "acoes", title: "Ações", subtitle: "Empresas da bolsa — Petrobras, Itaú, Vale, WEG", icon: TrendingUp },
    { section: "fiis", title: "Fundos imobiliários", subtitle: "Renda mensal de aluguéis e recebíveis", icon: Building2 },
    { section: "tesouro", title: "Tesouro Direto", subtitle: "Selic, prefixado, IPCA+, Renda+ e Educa+", icon: Landmark },
    { section: "rendafixa", title: "Renda fixa", subtitle: "CDB, LCI, LCA, debêntures, CRI e CRA", icon: PiggyBank },
    { section: "turbo", title: "Caixinha Turbo", subtitle: "Rende acima do CDI até um teto", icon: Zap },
    { section: "eme", title: "Reserva de emergência", subtitle: "Tesouro Selic / CDB diário — não poupança", icon: Shield },
  ];

  return (
    <div className={cn("space-y-5", desktop && "space-y-8")}>
      <BackLink
        label={section === "hub" ? "Voltar" : "Outras opções"}
        onClick={() => {
          if (section === "hub") onClose();
          else onSectionChange("hub");
        }}
      />

      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border border-border bg-card",
          desktop ? "px-5 py-3.5" : "px-3 py-2",
        )}
      >
        <div className="flex min-w-0 items-baseline gap-2">
          <span className={LABEL}>Saldo em conta</span>
          <span className={cn(MONEY, desktop ? "text-lg font-bold" : "text-sm font-bold")}>{formatCurrency(cash)}</span>
        </div>
        {onAdjustCash && (
          <button
            type="button"
            onClick={onAdjustCash}
            className={`shrink-0 inline-flex min-h-8 items-center rounded-md px-2 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${FOCUS}`}
          >
            {cash > 0 ? "Ajustar" : "Informar"}
          </button>
        )}
      </div>

      {section === "hub" && (
        <div className={cn(desktop ? "space-y-4" : "space-y-2.5")}>
          <div className={desktop ? "space-y-1" : undefined}>
            <h2 className={desktop ? "font-display text-xl font-semibold tracking-tight text-foreground" : LABEL}>
              Onde você quer investir?
            </h2>
            {desktop ? (
              <p className="text-sm text-muted-foreground">Escolha o tipo de aplicação. O saldo em conta pode financiar o aporte.</p>
            ) : null}
          </div>
          <div className={cn(desktop ? "grid grid-cols-2 gap-3 xl:grid-cols-3" : "space-y-2.5")}>
            {destinations.map((d) => (
              <DestCard
                key={d.section}
                title={d.title}
                subtitle={d.subtitle}
                icon={d.icon}
                desktop={desktop}
                onClick={() => onSectionChange(d.section)}
              />
            ))}
          </div>
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

          {(section === "tesouro" || section === "rendafixa") && (
            <>
              {ownFixed.length > 0 && (
                <>
                  <p className={`${LABEL} pt-1`}>{section === "tesouro" ? "Seus títulos" : "Suas aplicações"}</p>
                  {ownFixed.map((account) => (
                    <AccountButton
                      key={account.id}
                      title={account.nome}
                      subtitle={account.instituicao || SECTION_TITLE[section]}
                      value={account.valor}
                      badge={section === "tesouro" && isEmergenciaProductName(account.nome) ? "Emergência" : undefined}
                      onClick={() => setAmountTarget({ account, group: SECTION_TITLE[section] })}
                    />
                  ))}
                  <p className={`${LABEL} pt-3`}>{section === "tesouro" ? "Comprar outro título" : "Nova aplicação"}</p>
                </>
              )}
              <FixedIncomePicker key={section} kind={section === "tesouro" ? "tesouro" : "privada"} onPick={setFixedEntry} />
              {section === "rendafixa" && onCreateAccount && (
                <CreateAccountButton label="Não achou? Cadastrar outra aplicação" onClick={() => onCreateAccount("investimentos")} />
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
                onClick={() => setAmountTarget({ account, group: "Caixinha Turbo" })}
              />
            ))}
          {section === "turbo" && onCreateAccount && (
            <CreateAccountButton label="Criar caixinha Turbo" onClick={() => onCreateAccount("turbo")} />
          )}

          {section === "eme" && emergenciaAccounts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6 px-2 leading-relaxed">
              Crie a caixinha para registrar a reserva. O dinheiro em si deve estar em Tesouro Selic ou CDB 100% CDI com liquidez diária — não em poupança.
            </p>
          )}
          {section === "eme" &&
            emergenciaAccounts.map((account) => (
              <AccountButton
                key={account.id}
                title={account.nome}
                subtitle={account.instituicao || "Tesouro Selic / CDB diário"}
                value={account.valor}
                onClick={() => setAmountTarget({ account, group: "Reserva de emergência" })}
              />
            ))}
          {section === "eme" && onCreateAccount && (
            <CreateAccountButton label="Criar caixinha Emergência" onClick={() => onCreateAccount("emergencia")} />
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
        title={amountTarget ? `Aplicar em ${amountTarget.account.nome}` : ""}
        description={amountTarget?.group}
        cash={cash}
        initialAmount={suggestedAmount}
        onConfirm={async (amount, source) => {
          if (amountTarget) await onAporte(amountTarget.account.id, amount, source);
        }}
      />

      <FixedIncomeSheet entry={fixedEntry} onClose={() => setFixedEntry(null)} cash={cash} initialAmount={suggestedAmount} onConfirm={onBuyFixedIncome} />
    </div>
  );
}
