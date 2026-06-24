// Cálculo de rentabilidade por produto do Nubank.
// Taxas-base (Selic / CDI) vêm em tempo real da API do Banco Central (SGS).

export interface MarketRates {
  selicAnual: number; // % a.a.
  cdiAnual: number;   // % a.a.
  updatedAt: string;
  source: "bcb" | "fallback";
}

export type RateCategory = "poupanca" | "selic" | "cdb" | "lci_lca";

// Nubank não oferece poupança tradicional.
// NuConta, CDB e RDB rendem % do CDI.
// Tesouro Selic é oferecido via NuInvest.
export const CATEGORY_META: Record<RateCategory, {
  label: string;       // nome exibido
  nubank: string;      // nome do produto Nubank
  isento: boolean;     // isento de IR?
  defaultPctCdi: number; // % do CDI padrão (0 = usa fórmula própria)
  description: string;
}> = {
  poupanca: {
    label: "NuConta",
    nubank: "Conta Nubank",
    isento: false,
    defaultPctCdi: 100,
    description: "Rende 100% do CDI com liquidez diária",
  },
  selic: {
    label: "Tesouro Selic",
    nubank: "NuInvest",
    isento: false,
    defaultPctCdi: 0,
    description: "Segue a meta Selic — via NuInvest",
  },
  cdb: {
    label: "CDB / RDB",
    nubank: "Nubank",
    isento: false,
    defaultPctCdi: 100,
    description: "Certificado de Depósito Bancário — sujeito a IR regressivo",
  },
  lci_lca: {
    label: "LCI / LCA",
    nubank: "NuInvest",
    isento: true,
    defaultPctCdi: 90,
    description: "Isento de IR — disponível via NuInvest (produtos de parceiros)",
  },
};

// Detecta a categoria pelo nome da conta (ignora acentos).
export function detectCategory(name: string): RateCategory | null {
  const n = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (n.includes("poup") || n.includes("nuconta") || n.includes("conta")) return "poupanca";
  if (n.includes("lci") || n.includes("lca")) return "lci_lca";
  if (n.includes("cdb") || n.includes("rdb")) return "cdb";
  if (n.includes("selic") || n.includes("tesouro")) return "selic";
  return null;
}

// Taxa anual (%) estimada para o produto.
export function annualRate(
  cat: RateCategory,
  rates: MarketRates,
  pctCdi?: number,
): number {
  switch (cat) {
    case "poupanca":
      // NuConta = 100% CDI (não usa fórmula de poupança tradicional)
      return rates.cdiAnual * ((pctCdi ?? CATEGORY_META.poupanca.defaultPctCdi) / 100);
    case "selic":
      return rates.selicAnual;
    case "cdb":
      return rates.cdiAnual * ((pctCdi ?? CATEGORY_META.cdb.defaultPctCdi) / 100);
    case "lci_lca":
      return rates.cdiAnual * ((pctCdi ?? CATEGORY_META.lci_lca.defaultPctCdi) / 100);
  }
}

// Converte taxa anual (%) em taxa mensal equivalente (%).
export function toMonthly(annualPercent: number): number {
  return (Math.pow(1 + annualPercent / 100, 1 / 12) - 1) * 100;
}

export function formatPct(v: number, digits = 2): string {
  return `${v.toFixed(digits).replace(".", ",")}%`;
}
