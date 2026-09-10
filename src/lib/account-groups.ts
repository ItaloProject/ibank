import type { InvestmentAccount } from "@/types/database";

export type AccountGroupId = "turbo" | "emergencia" | "investimentos";

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
