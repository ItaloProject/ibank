"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { CASH_ACCOUNT_NAME } from "@/lib/account-groups";
import {
  createStockTrade,
  createInvestment,
  updateAccountBalance,
  createInvestmentAccount,
  deleteStockTrade,
  deleteInvestment,
  deleteInvestmentAccount,
} from "@/lib/api";
import type { Investment, StockTrade } from "@/types/database";
import type { AccountRate } from "@/lib/account-rate";
import { leftoverDescription, leftoverMonthOf, monthName } from "@/lib/plan-leftover";

export type LiveAccount = {
  id: string;
  nome: string;
  instituicao: string;
  valor: number;
  isTurbo: boolean;
  cdiPercent: number | null;
  maxRendimento: number | null;
};

/** De onde sai o dinheiro de uma compra ou aporte. */
export type MoneySource = "saldo" | "fora";

/** Título do Tesouro ou aplicação de renda fixa, com a taxa contratada. */
export type FixedIncomeProduct = {
  nome: string;
  /** Taxa em texto ("Inflação + 7,65%"); vira a instituição quando ela não é informada. */
  taxa: string;
  instituicao?: string;
  rate: AccountRate;
};

export type LiveMovementKind = "compra" | "venda" | "aporte" | "retirada" | "rendimento" | "ajuste-valor" | "ajuste-saldo";

export type LiveMovement = {
  id: string;
  kind: LiveMovementKind;
  title: string;
  subtitle: string;
  amount: number;
  /** +1 entrou dinheiro no investimento/saldo, -1 saiu. */
  direction: 1 | -1;
  date: string;
};

export const CASH_ADJUST_DESC = "Ajuste de saldo via Live";
const VALUE_UPDATE_DESC = "Atualização de valor";

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function safeDelete(action: () => Promise<unknown>, label: string) {
  try {
    await action();
  } catch (err) {
    console.error(`Falha ao reverter ${label}:`, err);
  }
}

export function formatQty(n: number) {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

type Deps = {
  cashAccountId: string | null;
  cashBalance: number;
  turboAccounts: LiveAccount[];
  emergenciaAccounts: LiveAccount[];
  investimentosAccounts: LiveAccount[];
  stockTrades: StockTrade[];
  investments: Investment[];
  onRefresh: () => Promise<void> | void;
};

/**
 * Todas as operações do MUVO Live num lugar só, para celular e desktop
 * se comportarem igual. Cada operação grava as etapas em ordem e tenta
 * desfazer o que já foi gravado se uma etapa seguinte falhar.
 */
export function useLiveActions(d: Deps) {
  const allAccounts = useMemo(
    () => [...d.turboAccounts, ...d.emergenciaAccounts, ...d.investimentosAccounts],
    [d.turboAccounts, d.emergenciaAccounts, d.investimentosAccounts],
  );

  async function ensureCashAccount(): Promise<string> {
    if (d.cashAccountId) return d.cashAccountId;
    const acc = await createInvestmentAccount({ name: CASH_ACCOUNT_NAME, institution: "Carteira" });
    return acc.id;
  }

  function assertFunds(amount: number, source: MoneySource) {
    if (source === "saldo" && amount > d.cashBalance + 0.001) {
      throw new Error(`Saldo em conta insuficiente: você tem ${formatCurrency(d.cashBalance)}.`);
    }
  }

  /** Debita o saldo em conta quando a compra é paga com ele. Devolve o id do lançamento para reverter. */
  async function debitCash(amount: number, description: string, source: MoneySource): Promise<string | null> {
    if (source !== "saldo") return null;
    const cid = await ensureCashAccount();
    const rec = await createInvestment({ account_id: cid, type: "retirada", amount, description, date: today() });
    return rec.id;
  }

  async function creditCash(amount: number, description: string): Promise<string> {
    const cid = await ensureCashAccount();
    const rec = await createInvestment({ account_id: cid, type: "deposito", amount, description, date: today() });
    return rec.id;
  }

  async function buyStock(ticker: string, price: number, quantity: number, source: MoneySource) {
    const total = Math.round(price * quantity * 100) / 100;
    if (!ticker || price <= 0 || quantity <= 0) throw new Error("Informe o ticker, o preço e a quantidade.");
    assertFunds(total, source);
    const cashId = await debitCash(total, `Compra ${ticker}`, source);
    try {
      await createStockTrade({ ticker, type: "compra", quantity, price_per_share: price, total_amount: total, date: today() });
    } catch (err) {
      if (cashId) await safeDelete(() => deleteInvestment(cashId), "débito da compra");
      throw err;
    }
    await d.onRefresh();
    toast.success(`Compra de ${formatQty(quantity)} ${ticker} registrada`);
  }

  async function sellStock(ticker: string, price: number, quantity: number) {
    const total = Math.round(price * quantity * 100) / 100;
    if (price <= 0 || quantity <= 0) throw new Error("Informe o preço e a quantidade.");
    const cashId = await creditCash(total, `Venda ${ticker}`);
    try {
      await createStockTrade({ ticker, type: "venda", quantity, price_per_share: price, total_amount: total, date: today() });
    } catch (err) {
      await safeDelete(() => deleteInvestment(cashId), "crédito da venda");
      throw err;
    }
    await d.onRefresh();
    toast.success(`Venda de ${formatQty(quantity)} ${ticker} registrada. ${formatCurrency(total)} no saldo em conta.`);
  }

  async function depositInto(acc: LiveAccount, amount: number, description: string, source: MoneySource) {
    assertFunds(amount, source);
    const cashId = await debitCash(amount, `Aporte · ${acc.nome}`, source);
    let depId: string | null = null;
    try {
      const dep = await createInvestment({ account_id: acc.id, type: "deposito", amount, description, date: today() });
      depId = dep.id;
      await updateAccountBalance(acc.id, acc.valor + amount);
    } catch (err) {
      if (depId) await safeDelete(() => deleteInvestment(depId!), "depósito");
      if (cashId) await safeDelete(() => deleteInvestment(cashId), "débito do aporte");
      throw err;
    }
  }

  async function aporte(accountId: string, amount: number, source: MoneySource) {
    const acc = allAccounts.find((a) => a.id === accountId);
    if (!acc || amount <= 0) throw new Error("Informe um valor maior que zero.");
    await depositInto(acc, amount, `Aporte · ${acc.nome}`, source);
    await d.onRefresh();
    toast.success(`${formatCurrency(amount)} aplicados em ${acc.nome}`);
  }

  async function buyFixedIncome(product: FixedIncomeProduct, amount: number, source: MoneySource) {
    if (amount <= 0) throw new Error("Informe um valor maior que zero.");
    assertFunds(amount, source);
    const institution = product.instituicao ?? product.taxa;
    const existing = d.investimentosAccounts.find((a) => a.nome === product.nome);
    if (existing) {
      await depositInto(existing, amount, `Compra ${product.nome}`, source);
    } else {
      const created = await createInvestmentAccount({ name: product.nome, institution, ...product.rate });
      try {
        await depositInto(
          { id: created.id, nome: product.nome, instituicao: institution, valor: 0, isTurbo: false, cdiPercent: null, maxRendimento: null },
          amount,
          `Compra ${product.nome}`,
          source,
        );
      } catch (err) {
        await safeDelete(() => deleteInvestmentAccount(created.id), "aplicação de renda fixa criada");
        throw err;
      }
    }
    await d.onRefresh();
    toast.success(`Compra de ${product.nome} registrada`);
  }

  async function withdraw(accountId: string, amount: number) {
    const acc = allAccounts.find((a) => a.id === accountId);
    if (!acc || amount <= 0) throw new Error("Informe um valor maior que zero.");
    if (amount > acc.valor + 0.001) throw new Error(`Valor maior que o disponível (${formatCurrency(acc.valor)}).`);
    const rec = await createInvestment({ account_id: acc.id, type: "retirada", amount, description: `Retirada · ${acc.nome}`, date: today() });
    try {
      await updateAccountBalance(acc.id, acc.valor - amount);
      await creditCash(amount, `Retirada de ${acc.nome}`);
    } catch (err) {
      await safeDelete(() => updateAccountBalance(acc.id, acc.valor), "saldo da caixinha");
      await safeDelete(() => deleteInvestment(rec.id), "retirada");
      throw err;
    }
    await d.onRefresh();
    toast.success(`${formatCurrency(amount)} retirados de ${acc.nome} para o saldo em conta`);
  }

  /** Corrige o valor de uma caixinha (rendimento ou valor mostrado pelo banco) sem mexer no saldo em conta. */
  async function updateValue(accountId: string, newValue: number) {
    const acc = allAccounts.find((a) => a.id === accountId);
    if (!acc || newValue < 0) throw new Error("Informe um valor válido.");
    const delta = Math.round((newValue - acc.valor) * 100) / 100;
    if (Math.abs(delta) < 0.005) return;
    const rec = await createInvestment({
      account_id: acc.id,
      type: delta > 0 ? "rendimento" : "retirada",
      amount: Math.abs(delta),
      description: VALUE_UPDATE_DESC,
      date: today(),
    });
    try {
      await updateAccountBalance(acc.id, newValue);
    } catch (err) {
      await safeDelete(() => deleteInvestment(rec.id), "atualização de valor");
      throw err;
    }
    await d.onRefresh();
    toast.success(`${acc.nome} atualizada para ${formatCurrency(newValue)}`);
  }

  async function setCash(newValue: number) {
    const delta = Math.round((newValue - d.cashBalance) * 100) / 100;
    if (Math.abs(delta) < 0.005) return;
    const cid = await ensureCashAccount();
    await createInvestment({
      account_id: cid,
      type: delta > 0 ? "deposito" : "retirada",
      amount: Math.abs(delta),
      description: CASH_ADJUST_DESC,
      date: today(),
    });
    await d.onRefresh();
    toast.success("Saldo em conta atualizado");
  }

  /** Soma a sobra do mês do Planejamento ao saldo em conta, uma vez por mês. */
  async function addLeftover(month: string, amount: number) {
    if (!(amount > 0) || leftoverDone.has(month)) return;
    const cid = await ensureCashAccount();
    await createInvestment({
      account_id: cid,
      type: "deposito",
      amount: Math.round(amount * 100) / 100,
      description: leftoverDescription(month),
      date: today(),
    });
    await d.onRefresh();
    toast.success(`Sobra de ${monthName(month)} somada ao saldo em conta`);
  }

  const leftoverDone = useMemo(() => {
    const done = new Set<string>();
    for (const inv of d.investments) {
      const m = inv.account_id === d.cashAccountId ? leftoverMonthOf(inv.description) : null;
      if (m) done.add(m);
    }
    return done;
  }, [d.investments, d.cashAccountId]);

  const movements = useMemo((): LiveMovement[] => {
    const items: LiveMovement[] = [];
    const byId = new Map(allAccounts.map((a) => [a.id, a]));
    const groupOf = (acc: LiveAccount) =>
      acc.isTurbo ? "Turbo" : d.emergenciaAccounts.some((e) => e.id === acc.id) ? "Emergência" : "Renda fixa";

    for (const t of d.stockTrades) {
      const venda = t.type === "venda";
      items.push({
        id: `stock-${t.id}`,
        kind: venda ? "venda" : "compra",
        title: `${venda ? "Venda" : "Compra"} ${t.ticker}`,
        subtitle: `${formatQty(t.quantity)} × ${formatCurrency(t.price_per_share)}`,
        amount: t.total_amount,
        direction: venda ? -1 : 1,
        date: t.date,
      });
    }

    for (const inv of d.investments) {
      if (inv.account_id === d.cashAccountId) {
        const sobraDe = leftoverMonthOf(inv.description);
        if (sobraDe) {
          items.push({
            id: `inv-${inv.id}`,
            kind: "ajuste-saldo",
            title: `Sobra de ${monthName(sobraDe)}`,
            subtitle: "Do Planejamento para o saldo em conta",
            amount: inv.amount,
            direction: 1,
            date: inv.date,
          });
        } else if (inv.description === CASH_ADJUST_DESC) {
          items.push({
            id: `inv-${inv.id}`,
            kind: "ajuste-saldo",
            title: "Saldo em conta ajustado",
            subtitle: inv.type === "retirada" ? "Saldo diminuído" : "Saldo aumentado",
            amount: inv.amount,
            direction: inv.type === "retirada" ? -1 : 1,
            date: inv.date,
          });
        }
        continue;
      }
      const acc = byId.get(inv.account_id);
      if (!acc) continue;
      const isUpdate = inv.description === VALUE_UPDATE_DESC;
      if (inv.type === "deposito") {
        items.push({ id: `inv-${inv.id}`, kind: "aporte", title: `Aporte · ${acc.nome}`, subtitle: groupOf(acc), amount: inv.amount, direction: 1, date: inv.date });
      } else if (inv.type === "retirada") {
        items.push({
          id: `inv-${inv.id}`,
          kind: isUpdate ? "ajuste-valor" : "retirada",
          title: isUpdate ? `Valor corrigido · ${acc.nome}` : `Retirada · ${acc.nome}`,
          subtitle: isUpdate ? "Desvalorização" : `${groupOf(acc)} → saldo em conta`,
          amount: inv.amount,
          direction: -1,
          date: inv.date,
        });
      } else {
        items.push({
          id: `inv-${inv.id}`,
          kind: isUpdate ? "ajuste-valor" : "rendimento",
          title: isUpdate ? `Valor corrigido · ${acc.nome}` : `Rendimento · ${acc.nome}`,
          subtitle: isUpdate ? "Rendimento" : groupOf(acc),
          amount: inv.amount,
          direction: 1,
          date: inv.date,
        });
      }
    }
    return items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));
  }, [allAccounts, d.stockTrades, d.investments, d.cashAccountId, d.emergenciaAccounts]);

  /** Lançamento do saldo em conta criado junto com a operação (mesmo valor, tipo oposto, mesmo ativo). */
  function findCashPair(type: "deposito" | "retirada", amount: number, token: string, date: string) {
    if (!d.cashAccountId) return undefined;
    const candidates = d.investments.filter(
      (i) =>
        i.account_id === d.cashAccountId &&
        i.type === type &&
        i.description !== CASH_ADJUST_DESC &&
        Math.abs(i.amount - amount) < 0.01 &&
        i.description.includes(token),
    );
    return candidates.find((i) => i.date === date) ?? candidates[0];
  }

  /** Desfaz uma movimentação e o lançamento correspondente no saldo em conta, quando houver. */
  async function undo(mov: LiveMovement): Promise<void> {
    let cashNote = "";
    if (mov.id.startsWith("stock-")) {
      const trade = d.stockTrades.find((t) => `stock-${t.id}` === mov.id);
      if (!trade) return;
      await deleteStockTrade(trade.id);
      if (trade.type === "compra") {
        const pair = findCashPair("retirada", trade.total_amount, trade.ticker, trade.date);
        if (pair) {
          await safeDelete(() => deleteInvestment(pair.id), "débito da compra");
          cashNote = " O valor voltou para o saldo em conta.";
        }
      } else {
        const pair = findCashPair("deposito", trade.total_amount, trade.ticker, trade.date);
        if (pair) {
          await safeDelete(() => deleteInvestment(pair.id), "crédito da venda");
          cashNote = " O valor saiu do saldo em conta.";
        }
      }
    } else {
      const inv = d.investments.find((i) => `inv-${i.id}` === mov.id);
      if (!inv) return;
      const acc = allAccounts.find((a) => a.id === inv.account_id);
      await deleteInvestment(inv.id);
      if (acc) {
        const back = inv.type === "retirada" ? inv.amount : -inv.amount;
        await safeDelete(() => updateAccountBalance(acc.id, acc.valor + back), "saldo da caixinha");
        if (mov.kind === "aporte") {
          const pair = findCashPair("retirada", inv.amount, acc.nome, inv.date);
          if (pair) {
            await safeDelete(() => deleteInvestment(pair.id), "débito do aporte");
            cashNote = " O valor voltou para o saldo em conta.";
          }
        } else if (mov.kind === "retirada") {
          const pair = findCashPair("deposito", inv.amount, acc.nome, inv.date);
          if (pair) {
            await safeDelete(() => deleteInvestment(pair.id), "crédito da retirada");
            cashNote = " O valor saiu do saldo em conta e voltou para a caixinha.";
          }
        }
      }
    }
    await d.onRefresh();
    toast.success(`Desfeito: ${mov.title}.${cashNote}`);
  }

  return { buyStock, sellStock, aporte, buyFixedIncome, withdraw, updateValue, setCash, addLeftover, leftoverDone, undo, movements };
}

export type LiveActions = ReturnType<typeof useLiveActions>;
