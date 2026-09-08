"use client";

import { formatCurrency } from "@/lib/utils";
import type { InvestmentAccount } from "@/types/database";

type StockPosition = {
  ticker: string;
  quantity: number;
  totalInvested: number;
  avgPrice: number;
};

export type TotalTabProps = {
  grandTotal: number;
  totalFixedIncome: number;
  totalStocks: number;
  accounts: InvestmentAccount[];
  stockPositions: StockPosition[];
  accountBalances: { account: InvestmentAccount; balance: number }[];
  totalRendaMensal: number;
  setActiveTab: (tab: string) => void;
};

export function TotalTab({
  grandTotal,
  totalFixedIncome,
  totalStocks,
  accounts,
  stockPositions,
  accountBalances,
  totalRendaMensal,
  setActiveTab,
}: TotalTabProps) {
  return (
    <>
      {/* Resumo — grade 2x2 no mobile, 4 colunas no desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b">
        <div className="px-4 py-3 border-r border-b sm:border-b-0">
          <p className="text-xs text-muted-foreground">Patrimônio total</p>
          <p className="text-base font-bold text-primary tabular-nums">{formatCurrency(grandTotal)}</p>
          <p className="text-xs text-muted-foreground">renda fixa + ações</p>
        </div>
        <div className="px-4 py-3 border-b sm:border-b-0 sm:border-r">
          <p className="text-xs text-muted-foreground">Renda fixa</p>
          <p className="text-base font-bold text-green-600 tabular-nums">{formatCurrency(totalFixedIncome)}</p>
          <p className="text-xs text-muted-foreground">{accounts.length} conta{accounts.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="px-4 py-3 border-r">
          <p className="text-xs text-muted-foreground">Ações</p>
          <p className="text-base font-bold text-blue-600 tabular-nums">{formatCurrency(totalStocks)}</p>
          <p className="text-xs text-muted-foreground">{stockPositions.length} ativo{stockPositions.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">Renda / mês</p>
          <p className="text-base font-bold text-emerald-500 tabular-nums">{formatCurrency(totalRendaMensal)}</p>
          <p className="text-xs text-muted-foreground">fontes de renda</p>
        </div>
      </div>

      {/* Contas de renda fixa — flat lista divide-y */}
      <div className="border-b">
        <div className="px-4 py-3 border-b bg-muted/30">
          <p className="text-sm font-semibold">Contas de renda fixa</p>
        </div>
        {accountBalances.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 px-4">Nenhuma conta cadastrada.</p>
        ) : (
          <div className="divide-y">
            {accountBalances.map(({ account, balance }) => (
              <div key={account.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-muted/40 cursor-pointer"
                onClick={() => setActiveTab(account.id)}>
                <div className="min-w-0 mr-4">
                  <p className="font-medium text-sm">{account.name}</p>
                  {account.institution && (
                    <p className="text-xs text-muted-foreground">{account.institution}</p>
                  )}
                </div>
                <p className="font-semibold text-green-600 tabular-nums shrink-0">{formatCurrency(balance)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Carteira de ações — flat lista divide-y */}
      <div>
        <div className="px-4 py-3 border-b bg-muted/30">
          <p className="text-sm font-semibold">Carteira de ações</p>
        </div>
        {stockPositions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 px-4">Nenhuma ação registrada.</p>
        ) : (
          <div className="divide-y">
            {stockPositions.map((p) => (
              <div key={p.ticker}
                className="px-4 py-3 flex items-center justify-between hover:bg-muted/40 cursor-pointer"
                onClick={() => setActiveTab("acoes")}>
                <div className="min-w-0 mr-4">
                  <p className="font-bold text-sm">{p.ticker}</p>
                  <p className="text-xs text-muted-foreground">{p.quantity} ações · média {formatCurrency(p.avgPrice)}</p>
                </div>
                <p className="font-semibold text-blue-600 tabular-nums shrink-0">{formatCurrency(p.totalInvested)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
