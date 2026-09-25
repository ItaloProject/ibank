/**
 * Rentabilidade esperada da carteira real do usuário.
 *
 * Cada posição rende pela sua própria regra (% do CDI, Selic + spread, prefixado
 * até o vencimento, IPCA + spread, poupança, dividendos de FII, premissa de ações).
 * Os juros pós-fixados partem do CDI de hoje e convergem ao juro neutro em
 * YEARS_TO_NEUTRAL anos, então a taxa média depende do prazo simulado.
 */
import type { Investment, InvestmentAccount, StockTrade } from "@/types/database";
import { accountBalance, computeStockPositions, detectAssetType } from "@/lib/stock-utils";
import { isCashAccountName, isEmergencyAccountName } from "@/lib/account-groups";

/** Juro real neutro estimado pelo Banco Central (% a.a.). */
export const NEUTRAL_REAL_RATE = 5;
/** Anos até o CDI de hoje convergir ao juro neutro. */
export const YEARS_TO_NEUTRAL = 3;
/** Retorno real de longo prazo assumido para ações (% a.a. acima do IPCA). */
export const EQUITY_REAL_RETURN = 7;
/** DY usado para FIIs sem dado de mercado: ~0,85% ao mês. */
export const FII_DEFAULT_DY = (Math.pow(1.0085, 12) - 1) * 100;
/** Alíquota de IR de longo prazo sobre ganhos (renda fixa > 2 anos e ações). */
export const LONG_TERM_TAX = 0.15;

export type AssetClass = "turbo" | "emergencia" | "renda_fixa" | "acoes" | "fiis" | "caixa";

type Rule =
  | { k: "cdi"; pct: number }
  | { k: "selic"; spread: number }
  | { k: "pre"; taxa: number; ate: number | null }
  | { k: "ipca"; spread: number }
  | { k: "poupanca" }
  | { k: "fixa"; taxa: number };

export type PortfolioRow = {
  id: string;
  nome: string;
  classe: AssetClass;
  valor: number;
  peso: number;
  /** Taxa bruta esperada no primeiro ano (% a.a.). */
  taxaHoje: number;
  /** Alíquota de IR aplicada ao rendimento (0–1). */
  ir: number;
  fonte: string;
  presumida: boolean;
  rule: Rule;
};

export type PortfolioMarket = {
  cdi: number;
  selic: number;
  ipca: number;
  /** DY 12 meses por ticker de FII (%), quando disponível. */
  fiiDy?: Record<string, number>;
};

export type PortfolioReturn = {
  total: number;
  rows: PortfolioRow[];
  /** Taxa bruta ponderada do primeiro ano (% a.a.). */
  hoje: number;
  hojeLiquida: number;
  neutro: number;
  caixa: number;
  /** Taxa média anual equivalente para `anos` (% a.a.). */
  media: (anos: number, liquida: boolean) => number;
};

function num(raw: string): number {
  return raw.includes(",") ? Number(raw.replace(/\./g, "").replace(",", ".")) : Number(raw);
}

function plain(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function fmtPct(n: number, digits = 2): string {
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;
}

/** Lê a regra de rentabilidade no nome/instituição da conta ("IPCA + 6,92%", "110% CDI", "13,85% a.a."…). */
export function parseRule(text: string): { rule: Rule; fonte: string; isento: boolean } | null {
  const t = plain(text);
  const isento = /\b(lci|lca|poup)/.test(t);
  const year = t.match(/\b(20[2-9]\d)\b/);
  const ate = year ? Number(year[1]) : null;

  const ipca = t.match(/ipca\s*\+\s*([\d.,]+)\s*%/);
  if (ipca) {
    const spread = num(ipca[1]);
    return { rule: { k: "ipca", spread }, fonte: `IPCA + ${fmtPct(spread)}`, isento };
  }
  const selicPlus = t.match(/selic\s*\+\s*([\d.,]+)\s*%/);
  if (selicPlus) {
    const spread = num(selicPlus[1]);
    return { rule: { k: "selic", spread }, fonte: `Selic + ${fmtPct(spread, 4)}`, isento };
  }
  const cdi = t.match(/([\d.,]+)\s*%\s*(do\s+)?cdi/);
  if (cdi) {
    const pct = num(cdi[1]);
    return { rule: { k: "cdi", pct }, fonte: `${fmtPct(pct, 1)} do CDI`, isento };
  }
  const pre = t.match(/([\d.,]+)\s*%\s*(a\.?\s*a|ao ano)/);
  if (pre) {
    const taxa = num(pre[1]);
    return {
      rule: { k: "pre", taxa, ate },
      fonte: `Prefixado ${fmtPct(taxa)}${ate ? ` até ${ate}` : ""}`,
      isento,
    };
  }
  if (/selic/.test(t)) return { rule: { k: "selic", spread: 0 }, fonte: "Selic", isento };
  if (/poup/.test(t)) return { rule: { k: "poupanca" }, fonte: "Regra da poupança", isento: true };
  if (/\b(lci|lca)\b/.test(t)) return { rule: { k: "cdi", pct: 90 }, fonte: "90% do CDI (típico de LCI/LCA)", isento: true };
  return null;
}

export function neutralRate(ipca: number): number {
  return ((1 + ipca / 100) * (1 + NEUTRAL_REAL_RATE / 100) - 1) * 100;
}

function cdiAt(m: PortfolioMarket, y: number): number {
  const neutro = neutralRate(m.ipca);
  if (y > YEARS_TO_NEUTRAL) return neutro;
  return m.cdi + ((neutro - m.cdi) * (y - 1)) / YEARS_TO_NEUTRAL;
}

/** Taxa bruta (% a.a.) de uma regra no ano `y` da simulação (1 = próximos 12 meses). */
export function rateAt(rule: Rule, m: PortfolioMarket, y: number, startYear: number): number {
  const cdi = cdiAt(m, y);
  const selic = cdi + (m.selic - m.cdi);
  switch (rule.k) {
    case "cdi":
      return (cdi * rule.pct) / 100;
    case "selic":
      return selic + rule.spread;
    case "pre":
      return rule.ate != null && startYear + y - 1 >= rule.ate ? cdi : rule.taxa;
    case "ipca":
      return ((1 + m.ipca / 100) * (1 + rule.spread / 100) - 1) * 100;
    case "poupanca":
      return selic > 8.5 ? (Math.pow(1.005, 12) - 1) * 100 : selic * 0.7;
    case "fixa":
      return rule.taxa;
  }
}

type Quote = { ticker: string; current_price: number };

export function computePortfolioReturn(
  accounts: InvestmentAccount[],
  investments: Investment[],
  trades: StockTrade[],
  quotes: Quote[],
  market: PortfolioMarket,
  startYear = new Date().getFullYear(),
): PortfolioReturn | null {
  const rows: Omit<PortfolioRow, "peso" | "taxaHoje">[] = [];

  for (const a of accounts) {
    const valor = a.is_turbo ? a.current_balance : accountBalance(investments, a.id);
    if (!(valor > 0.005)) continue;

    if (isCashAccountName(a.name)) {
      rows.push({ id: a.id, nome: a.name, classe: "caixa", valor, ir: 0, fonte: "Parado, sem render", presumida: false, rule: { k: "fixa", taxa: 0 } });
      continue;
    }
    if (a.is_turbo) {
      const pct = a.cdi_percent ?? 115;
      const teto = a.max_rendimento ?? 0;
      const acimaDoTeto = teto > 0 && valor > teto;
      const efetivo = acimaDoTeto ? (teto * pct + (valor - teto) * 100) / valor : pct;
      const fonte = acimaDoTeto
        ? `${fmtPct(pct, 1)} do CDI até ${teto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}; o excedente, 100%`
        : `${fmtPct(pct, 1)} do CDI`;
      rows.push({ id: a.id, nome: a.name, classe: "turbo", valor, ir: LONG_TERM_TAX, fonte, presumida: a.cdi_percent == null, rule: { k: "cdi", pct: efetivo } });
      continue;
    }

    const classe: AssetClass = isEmergencyAccountName(a.name) ? "emergencia" : "renda_fixa";
    const parsed = parseRule(`${a.name} ${a.institution ?? ""}`);
    if (parsed) {
      rows.push({ id: a.id, nome: a.name, classe, valor, ir: parsed.isento ? 0 : LONG_TERM_TAX, fonte: parsed.fonte, presumida: false, rule: parsed.rule });
      continue;
    }

    const rends = investments.filter((i) => i.account_id === a.id && i.type === "rendimento");
    const byMonth = new Map<string, number>();
    for (const r of rends) byMonth.set(r.date.slice(0, 7), (byMonth.get(r.date.slice(0, 7)) ?? 0) + r.amount);
    if (byMonth.size >= 2) {
      const avg = [...byMonth.values()].reduce((s, v) => s + v, 0) / byMonth.size;
      const taxa = (Math.pow(1 + avg / valor, 12) - 1) * 100;
      if (Number.isFinite(taxa) && taxa > 0 && taxa < 40) {
        rows.push({
          id: a.id, nome: a.name, classe, valor, ir: LONG_TERM_TAX,
          fonte: `Média dos rendimentos registrados (${byMonth.size} meses)`,
          presumida: false, rule: { k: "fixa", taxa },
        });
        continue;
      }
    }
    rows.push({ id: a.id, nome: a.name, classe, valor, ir: LONG_TERM_TAX, fonte: "100% do CDI (taxa não informada)", presumida: true, rule: { k: "cdi", pct: 100 } });
  }

  const priceOf = new Map(quotes.map((q) => [q.ticker, q.current_price]));
  let acoes = 0;
  const acoesTickers: string[] = [];
  let fiis = 0;
  let fiiDyWeighted = 0;
  let fiiLive = 0;
  const fiiTickers: string[] = [];
  for (const p of computeStockPositions(trades)) {
    const price = priceOf.get(p.ticker);
    const valor = price != null && price > 0 ? price * p.quantity : p.totalInvested;
    if (!(valor > 0)) continue;
    if (detectAssetType(p.ticker) === "FII") {
      const live = market.fiiDy?.[p.ticker];
      const dy = live != null && live > 0 ? live : FII_DEFAULT_DY;
      if (live != null && live > 0) fiiLive += valor;
      fiis += valor;
      fiiDyWeighted += valor * dy;
      fiiTickers.push(p.ticker);
    } else {
      acoes += valor;
      acoesTickers.push(p.ticker);
    }
  }
  if (acoes > 0) {
    const taxa = ((1 + market.ipca / 100) * (1 + EQUITY_REAL_RETURN / 100) - 1) * 100;
    rows.push({
      id: "acoes", nome: `Ações · ${acoesTickers.join(", ")}`, classe: "acoes", valor: acoes, ir: LONG_TERM_TAX,
      fonte: `IPCA + ${EQUITY_REAL_RETURN}% (longo prazo)`, presumida: false, rule: { k: "fixa", taxa },
    });
  }
  if (fiis > 0) {
    const taxa = fiiDyWeighted / fiis;
    rows.push({
      id: "fiis", nome: `FIIs · ${fiiTickers.join(", ")}`, classe: "fiis", valor: fiis, ir: 0,
      fonte: fiiLive >= fiis * 0.5 ? "Dividendos dos últimos 12 meses" : "Dividendos estimados (~0,85% ao mês)",
      presumida: fiiLive < fiis * 0.5, rule: { k: "fixa", taxa },
    });
  }

  const total = rows.reduce((s, r) => s + r.valor, 0);
  if (!(total > 0)) return null;

  const full: PortfolioRow[] = rows
    .map((r) => ({ ...r, peso: r.valor / total, taxaHoje: rateAt(r.rule, market, 1, startYear) }))
    .sort((a, b) => b.valor - a.valor);

  const yearRate = (y: number, liquida: boolean) =>
    full.reduce((s, r) => s + r.peso * rateAt(r.rule, market, y, startYear) * (liquida ? 1 - r.ir : 1), 0);

  const cache = new Map<string, number>();
  const media = (anos: number, liquida: boolean) => {
    const n = Math.max(1, Math.round(anos));
    const key = `${n}:${liquida}`;
    const hit = cache.get(key);
    if (hit != null) return hit;
    let growth = 1;
    for (let y = 1; y <= n; y++) growth *= 1 + yearRate(y, liquida) / 100;
    const v = (Math.pow(growth, 1 / n) - 1) * 100;
    cache.set(key, v);
    return v;
  };

  return {
    total,
    rows: full,
    hoje: yearRate(1, false),
    hojeLiquida: yearRate(1, true),
    neutro: neutralRate(market.ipca),
    caixa: full.filter((r) => r.classe === "caixa").reduce((s, r) => s + r.valor, 0),
    media,
  };
}
