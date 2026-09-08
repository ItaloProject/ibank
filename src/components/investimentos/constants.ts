"use client";

import { ArrowUpCircle, ArrowDownCircle, Sparkles, TrendingUp } from "lucide-react";
import type { InvestmentType } from "@/types/database";

export const TYPE_CONFIG: Record<InvestmentType, {
  label: string; icon: typeof TrendingUp; color: string; badgeClass: string
}> = {
  deposito: { label: "Depósito", icon: ArrowUpCircle, color: "text-green-600", badgeClass: "bg-green-100 text-green-800" },
  retirada: { label: "Retirada", icon: ArrowDownCircle, color: "text-red-600", badgeClass: "bg-red-100 text-red-800" },
  rendimento: { label: "Rendimento", icon: Sparkles, color: "text-blue-600", badgeClass: "bg-blue-100 text-blue-800" },
};
