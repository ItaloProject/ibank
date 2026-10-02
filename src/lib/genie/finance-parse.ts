import { NUMBER_RE, parseNumber } from "./calc";
import type { Product } from "@/lib/finance-calc";

export type FinanceCommand =
  /** "quanto rendem 10 mil no CDB a 110% do CDI em 2 anos": rendimento já sem Imposto de Renda. */
  | { kind: "netYield"; amount: number; product: Product; pct: number | null; rateYear: number | null; months: number }
  /** "LCI a 90% ou CDB a 110%?" */
  | { kind: "compareYield"; options: { product: Product; pct: number }[]; months: number | null }
  /** "LCI a 90% equivale a quanto em CDB?" */
  | { kind: "equivalent"; product: Product; pct: number; months: number | null }
  /** Percentuais ao ano, como 12 e 4,5. */
  | { kind: "realReturn"; nominal: number; inflation: number | null }
  | { kind: "freedom"; monthly: number | null }
  | { kind: "budgetRule" }
  | { kind: "debt"; type: "rotativo" | "cheque"; amount: number | null; rateMonth: number | null }
  | { kind: "payOrInvest"; rateMonth: number | null }
  | { kind: "amortization"; principal: number; months: number; rateMonth: number };

const N = NUMBER_RE;
/** Impede que "110%" vire o número 11 seguido de "0%". */
const LONE = String.raw`(?![\d.,])`;
const PRODUCT = String.raw`(?:cdbs?|lcis?|lcas?|lc|rdbs?|tesouro selic|tesouro|poupanca|debentures?)`;

function product(word: string): Product {
  const w = word.replace(/s$/, "");
  if (w.startsWith("tesouro")) return "tesouro";
  if (w.startsWith("debenture")) return "debenture";
  return w as Product;
}

function monthsIn(t: string): number | null {
  const m = t.match(/(\d+)\s*(meses|mes|anos|ano)\b/);
  return m ? Number(m[1]) * (m[2].startsWith("ano") ? 12 : 1) : null;
}

/** Taxa ao mês citada ("8% ao mês", "200% ao ano"), já em fração. */
function rateMonthIn(t: string): number | null {
  const m = t.match(new RegExp(String.raw`(${N})\s*%\s*(ao mes|a\.?m\.?|mensal|por mes|ao ano|a\.?a\.?|anual|por ano)?`));
  if (!m) return null;
  const r = parseNumber(m[1]);
  if (r === null) return null;
  return /ano|a\.?a|anual/.test(m[2] ?? "") ? Math.pow(1 + r / 100, 1 / 12) - 1 : r / 100;
}

/** Produtos citados com o percentual do CDI: "lci a 90%", "110% do cdi no cdb", "cdb 110". */
function offers(t: string): { product: Product; pct: number }[] {
  const found: { product: Product; pct: number; at: number }[] = [];
  const after = new RegExp(String.raw`\b(${PRODUCT})\s+(?:a|de|com|rendendo|pagando|que paga|que rende)?\s*(${N})${LONE}(?!\s*(?:meses|mes|anos|ano|mil|k|reais)\b)\s*%?(?:\s*do\s*cdi)?`, "g");
  const before = new RegExp(String.raw`(${N})\s*%\s*(?:do\s*cdi\s*)?(?:em|na|no|numa|num|de)\s+(?:uma\s+|um\s+)?(${PRODUCT})\b`, "g");
  for (const m of t.matchAll(after)) {
    const pct = parseNumber(m[2]);
    if (pct !== null && pct > 0 && pct <= 300) found.push({ product: product(m[1]), pct, at: m.index! });
  }
  for (const m of t.matchAll(before)) {
    const pct = parseNumber(m[1]);
    if (pct !== null && pct > 0 && pct <= 300 && !found.some((f) => Math.abs(f.at - m.index!) < 25 && f.pct === pct)) {
      found.push({ product: product(m[2]), pct, at: m.index! });
    }
  }
  return found.sort((a, b) => a.at - b.at).map(({ product: p, pct }) => ({ product: p, pct }));
}

const SKIP = /^(?:adicion|add|coloc|lanc|gastei|gastamos|paguei|pagamos|inclu|bot|cria|apag|exclu|remov|delet|muda|alter|atualiz|recebi|ganhei|comprei)/;

/** Contas de investimento e dívidas; null quando a frase é outro tipo de pedido. */
export function parseFinance(t: string): FinanceCommand | null {
  if (SKIP.test(t)) return null;

  if (/\b50\s*[/ -]\s*30\s*[/ -]\s*20\b|\bregra (?:do |dos )?50\b/.test(t)) return { kind: "budgetRule" };

  if (/\b(?:independencia financeira|liberdade financeira|viver de renda|viver (?:dos|de) (?:meus )?(?:investimentos|juros|rendimentos)|(?:me |para )aposentar|parar de trabalhar)\b/.test(t)) {
    const m = t.match(new RegExp(String.raw`(${N})\s*(?:reais\s*)?(?:por mes|ao mes|mensais|todo mes|de renda)`));
    return { kind: "freedom", monthly: m ? parseNumber(m[1]) : null };
  }

  if (/\b(?:sac|price)\b/.test(t) && /\d/.test(t)) {
    const months = t.match(/(\d+)\s*(?:x|vezes|parcelas|meses)\b/)?.[1] ?? null;
    const years = t.match(/(\d+)\s*anos?\b/)?.[1] ?? null;
    const n = months ? Number(months) : years ? Number(years) * 12 : null;
    const rate = rateMonthIn(t);
    const principal = [...t.matchAll(new RegExp(String.raw`(${N})${LONE}(?!\s*(?:%|x\b|vezes|parcelas|meses|anos?\b))`, "g"))]
      .map((m) => parseNumber(m[1]))
      .find((v): v is number => v !== null && v >= 500);
    if (principal && n && rate !== null) return { kind: "amortization", principal, months: n, rateMonth: rate };
  }

  if (/\brotativo\b/.test(t) || /\bcheque especial\b/.test(t)) {
    const amount = t.match(new RegExp(String.raw`(${N})${LONE}(?!\s*%)`))?.[1];
    return {
      kind: "debt",
      type: /\brotativo\b/.test(t) ? "rotativo" : "cheque",
      amount: amount ? parseNumber(amount) : null,
      rateMonth: rateMonthIn(t),
    };
  }

  if (/\b(?:quitar|pagar|amortizar|abater|liquidar)\b.*\b(?:ou|vs|versus)\b.*\b(?:investir|aplicar|guardar)\b|\b(?:investir|aplicar|guardar)\b.*\b(?:ou|vs|versus)\b.*\b(?:quitar|pagar|amortizar|abater|liquidar)\b/.test(t)) {
    return { kind: "payOrInvest", rateMonth: rateMonthIn(t) };
  }

  if (/\b(?:rentabilidade|rendimento|ganho|juro) real\b|\bacima da inflacao\b|\bdescontando a inflacao\b/.test(t)) {
    const pcts = [...t.matchAll(new RegExp(String.raw`(${N})\s*%`, "g"))].map((m) => m[1]);
    if (pcts.length) {
      const infl = t.match(new RegExp(String.raw`(?:inflacao|ipca)\s*(?:de|em|a|=|for|foi|for de)?\s*(${N})\s*%|(${N})\s*%\s*(?:de\s+)?(?:inflacao|ipca)`));
      const inflRaw = infl ? infl[1] ?? infl[2] : pcts.length >= 2 ? pcts[1] : null;
      const nominalRaw = pcts.find((p) => p !== inflRaw) ?? (inflRaw ? null : pcts[0]);
      const nominal = nominalRaw ? parseNumber(nominalRaw) : null;
      if (nominal !== null) return { kind: "realReturn", nominal, inflation: inflRaw ? parseNumber(inflRaw) : null };
    }
  }

  const list = offers(t);
  if (list.length >= 2) return { kind: "compareYield", options: list.slice(0, 3), months: monthsIn(t) };
  if (list.length === 1 && /\b(?:equivale|equivalente|corresponde|igual a|empata)\b/.test(t)) {
    return { kind: "equivalent", product: list[0].product, pct: list[0].pct, months: monthsIn(t) };
  }

  const prod = t.match(new RegExp(String.raw`\b(${PRODUCT})\b`));
  const pctCdi = t.match(new RegExp(String.raw`(${N})\s*%\s*do\s*cdi`));
  const months = monthsIn(t);
  if (prod && months && /\b(?:rend\w*|ganh\w*|quanto|vira|fica|da|dao|aplic\w*|invest\w*|colocar|deixar)\b/.test(t)) {
    const rateYearM = t.match(new RegExp(String.raw`(${N})\s*%\s*(?:ao ano|a\.?a\.?|anual|por ano)`));
    const used = new Set([pctCdi?.[1], rateYearM?.[1]].filter(Boolean));
    const amountM = [...t.matchAll(new RegExp(String.raw`(${N})${LONE}(?!\s*%)(?!\s*(?:meses|mes|anos|ano)\b)`, "g"))].find((m) => !used.has(m[1]));
    const amount = amountM ? parseNumber(amountM[1]) : null;
    if (amount && amount > 0) {
      const p = product(prod[1]);
      const pct = pctCdi ? parseNumber(pctCdi[1]) : list[0]?.pct ?? null;
      return { kind: "netYield", amount, product: p, pct, rateYear: rateYearM ? parseNumber(rateYearM[1]) : null, months };
    }
  }
  return null;
}
