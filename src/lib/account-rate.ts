/**
 * Rentabilidade contratada de uma conta de investimento, em campos estruturados
 * (indexador, taxa, vencimento, isenção de IR).
 */

export type RateIndex = "cdi" | "selic" | "ipca" | "pre" | "poupanca";

export type AccountRate = {
  rate_index: RateIndex;
  /** cdi: % do CDI · selic/ipca: spread em % a.a. · pre: taxa % a.a. · poupanca: ignorado. */
  rate_value: number;
  /** "AAAA-MM-DD" ou null quando não há vencimento. */
  maturity: string | null;
  tax_exempt: boolean;
};

export const RATE_INDEXES: { id: RateIndex; label: string; valueLabel: string | null; placeholder: string }[] = [
  { id: "cdi", label: "% do CDI", valueLabel: "Percentual do CDI", placeholder: "100" },
  { id: "selic", label: "Selic +", valueLabel: "Spread ao ano (%)", placeholder: "0,05" },
  { id: "ipca", label: "IPCA +", valueLabel: "Spread ao ano (%)", placeholder: "6,5" },
  { id: "pre", label: "Prefixado", valueLabel: "Taxa ao ano (%)", placeholder: "13,5" },
  { id: "poupanca", label: "Poupança", valueLabel: null, placeholder: "" },
];

export function isRateIndex(v: unknown): v is RateIndex {
  return v === "cdi" || v === "selic" || v === "ipca" || v === "pre" || v === "poupanca";
}

function pctText(n: number, digits = 2): string {
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;
}

export function describeRate(r: AccountRate): string {
  const venc = r.maturity ? ` até ${r.maturity.slice(0, 4)}` : "";
  switch (r.rate_index) {
    case "cdi": return `${pctText(r.rate_value, 1)} do CDI${venc}`;
    case "selic": return r.rate_value > 0 ? `Selic + ${pctText(r.rate_value, 4)}${venc}` : `Selic${venc}`;
    case "ipca": return `IPCA + ${pctText(r.rate_value)}${venc}`;
    case "pre": return `Prefixado ${pctText(r.rate_value)}${venc}`;
    case "poupanca": return "Regra da poupança";
  }
}

/** Valida e normaliza um corpo de requisição. Retorna erro em texto quando inválido. */
export function validateAccountRate(body: Record<string, unknown>): AccountRate | { error: string } {
  if (!isRateIndex(body.rate_index)) return { error: "Indexador inválido" };
  const value = body.rate_index === "poupanca" ? 0 : Number(body.rate_value);
  if (!Number.isFinite(value) || value < 0) return { error: "Taxa inválida" };
  if (body.rate_index === "cdi" && (value <= 0 || value > 300)) return { error: "Percentual do CDI deve ficar entre 0 e 300" };
  if ((body.rate_index === "pre") && (value <= 0 || value > 60)) return { error: "Taxa prefixada deve ficar entre 0 e 60% ao ano" };
  if ((body.rate_index === "ipca" || body.rate_index === "selic") && value > 30) return { error: "Spread deve ficar abaixo de 30% ao ano" };
  let maturity: string | null = null;
  if (body.maturity != null && body.maturity !== "") {
    if (typeof body.maturity !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.maturity)) return { error: "Vencimento inválido" };
    maturity = body.maturity;
  }
  return { rate_index: body.rate_index, rate_value: value, maturity, tax_exempt: Boolean(body.tax_exempt) };
}

function num(raw: string): number {
  return raw.includes(",") ? Number(raw.replace(/\./g, "").replace(",", ".")) : Number(raw);
}

function plain(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Lê a regra no nome/instituição de contas antigas ("IPCA + 6,92%", "110% CDI",
 * "13,85% a.a."). Usado só quando a conta ainda não tem os campos estruturados.
 */
export function accountRateFromText(text: string): AccountRate | null {
  const t = plain(text);
  const tax_exempt = /\b(lci|lca|poup)/.test(t);
  const year = t.match(/\b(20[2-9]\d)\b/);
  const maturity = year ? `${year[1]}-01-01` : null;

  const ipca = t.match(/ipca\s*\+\s*([\d.,]+)\s*%/);
  if (ipca) return { rate_index: "ipca", rate_value: num(ipca[1]), maturity, tax_exempt };
  const selicPlus = t.match(/selic\s*\+\s*([\d.,]+)\s*%/);
  if (selicPlus) return { rate_index: "selic", rate_value: num(selicPlus[1]), maturity, tax_exempt };
  const cdi = t.match(/([\d.,]+)\s*%\s*(do\s+)?cdi/);
  if (cdi) return { rate_index: "cdi", rate_value: num(cdi[1]), maturity, tax_exempt };
  const pre = t.match(/([\d.,]+)\s*%\s*(a\.?\s*a|ao ano)/);
  if (pre) return { rate_index: "pre", rate_value: num(pre[1]), maturity, tax_exempt };
  if (/selic/.test(t)) return { rate_index: "selic", rate_value: 0, maturity, tax_exempt };
  if (/poup/.test(t)) return { rate_index: "poupanca", rate_value: 0, maturity: null, tax_exempt: true };
  if (/\b(lci|lca)\b/.test(t)) return { rate_index: "cdi", rate_value: 90, maturity, tax_exempt: true };
  return null;
}
