import type { InvestmentAccount } from "@/types/database";

export type AccountGroupId = "turbo" | "emergencia" | "investimentos";

/** Nome da conta real usada como "carteira"/saldo disponível do Simulador Live. */
export const CASH_ACCOUNT_NAME = "Saldo em Conta";

export function isCashAccountName(name: string) {
  return name.trim().toLowerCase() === CASH_ACCOUNT_NAME.toLowerCase();
}

export function isEmergencyAccountName(name: string) {
  const n = name.toLowerCase();
  return n.includes("eme") || n.includes("emergên") || n.includes("emergencia") ||
    n.includes("reserva") || n.includes("caixinha");
}

export function categorizeAccount(a: InvestmentAccount): AccountGroupId {
  if (a.is_turbo) return "turbo";
  if (isEmergencyAccountName(a.name)) return "emergencia";
  return "investimentos";
}
