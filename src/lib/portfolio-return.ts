/**
 * Converte a carteira real do usuário em posições para o motor de projeção.
 *
 * Taxa de cada conta, por ordem de confiança: campos cadastrados (rate_index…),
 * regra lida no nome/instituição (contas antigas), média dos rendimentos
 * registrados e, por último, 100% do CDI sinalizado como estimativa.
 * Custo e idade (para o IR) vêm das datas reais de aportes e compras.
 */
import type { Investment, InvestmentAccount, StockTrade } from "@/types/database";
import { computeStockPositions, detectAssetType } from "@/lib/stock-utils";
import { isCashAccountName, isEmergencyAccountName } from "@/lib/account-groups";
import { accountRateFromText, describeRate, type AccountRate } from "@/lib/account-rate";
import type { Curve } from "@/lib/market-curve";
import { longTermRate, ruleAnnual, type Position, type Rule, type TaxMode } from "@/lib/projection";

/** Retorno real de longo prazo assumido para ações (% a.a. acima do IPCA). */
export const EQUITY_REAL_RETURN = 7;
/** DY usado para FIIs sem dado de mercado: ~0,85% ao mês. */
export const FII_DEFAULT_DY = (Math.pow(1.0085, 12) - 1) * 100;

export type AssetClass = "turbo" | "emergencia" | "renda_fixa" | "acoes" | "fiis" | "caixa";
export type RateOrigin = "cadastrada" | "nome" | "media" | "estimada" | "mercado";

export type PortfolioRow = {
  id: string;
  /** Conta editável (id da investment_account) ou null para ações/FIIs agregados. */
  accountId: string | null;
  nome: string;
  classe: AssetClass;
  valor: number;
  peso: number;
  /** Taxa bruta esperada nos próximos 12 meses (% a.a.). */
  taxa12m: number;
  /** Alíquota de longo prazo aplicada na visão líquida (0–1). */
  irLongo: number;
  fonte: string;
  origem: RateOrigin;
  rate: AccountRate | null;
};

export type Portfolio = {
  total: number;
  caixa: number;
  rows: PortfolioRow[];
  positions: Position[];
};

type Quote = { ticker: string; current_price: number };

const MONTH_MS = (365.25 / 12) * 24 * 3600 * 1000;

function monthsBetween(fromIso: string, to: Date): number {
  const d = new Date(`${fromIso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? 0 : Math.max(0, (to.getTime() - d.getTime()) / MONTH_MS);
}

function fmtPct(n: number, digits = 2): string {
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;
}

function ruleFromRate(r: AccountRate): Rule {
  switch (r.rate_index) {
    case "cdi": return { k: "cdi", pct: r.rate_value };
    case "selic": return { k: "selic", spread: r.rate_value };
    case "ipca": return { k: "ipca", spread: r.rate_value };
    case "pre": return { k: "pre", taxa: r.rate_value };
    case "poupanca": return { k: "poupanca" };
  }
}

function maturityMonths(iso: string | null, start: Date): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.ceil((d.getTime() - start.getTime()) / MONTH_MS));
}

/** Custo (aportes líquidos) e idade média ponderada dos aportes de uma conta. */
function costAndAge(investments: Investment[], accountId: string, valor: number, createdAt: string, start: Date) {
  let custo = 0;
  let pesoIdade = 0;
  let somaIdade = 0;
  for (const i of investments) {
    if (i.account_id !== accountId) continue;
    if (i.type === "deposito") {
      custo += i.amount;
      somaIdade += i.amount * monthsBetween(i.date, start);
      pesoIdade += i.amount;
    } else if (i.type === "retirada") {
      custo -= i.amount;
    }
  }
  const idade = pesoIdade > 0 ? somaIdade / pesoIdade : createdAt ? monthsBetween(createdAt, start) : 0;
  return { custo: Math.min(Math.max(0, custo), valor) || valor, idade };
}

function avgRendimentoRate(investments: Investment[], accountId: string, valor: number): { taxa: number; meses: number } | null {
  const byMonth = new Map<string, number>();
  for (const r of investments) {
    if (r.account_id !== accountId || r.type !== "rendimento") continue;
    const k = r.date.slice(0, 7);
    byMonth.set(k, (byMonth.get(k) ?? 0) + r.amount);
  }
  if (byMonth.size < 2) return null;
  const avg = [...byMonth.values()].reduce((s, v) => s + v, 0) / byMonth.size;
  const taxa = (Math.pow(1 + avg / valor, 12) - 1) * 100;
  return Number.isFinite(taxa) && taxa > 0 && taxa < 40 ? { taxa, meses: byMonth.size } : null;
}

function balanceOf(investments: Investment[], accountId: string): number {
  let s = 0;
  for (const i of investments) if (i.account_id === accountId) s += i.type === "retirada" ? -i.amount : i.amount;
  return s;
}

export function buildPortfolio(
  accounts: InvestmentAccount[],
  investments: Investment[],
  trades: StockTrade[],
  quotes: Quote[],
  curve: Curve,
  fiiDy: Record<string, number> = {},
  start: Date = new Date(),
): Portfolio | null {
  type Draft = Omit<PortfolioRow, "peso" | "taxa12m" | "irLongo"> & { pos: Omit<Position, "pesoAporte"> };
  const drafts: Draft[] = [];

  for (const a of accounts) {
    const valor = a.is_turbo ? a.current_balance : balanceOf(investments, a.id);
    if (!(valor > 0.005)) continue;
    const { custo, idade } = costAndAge(investments, a.id, valor, a.created_at, start);
    const base = { id: a.id, valor, custo, idadeMeses: idade };

    if (isCashAccountName(a.name)) {
      drafts.push({
        id: a.id, accountId: null, nome: a.name, classe: "caixa", valor, fonte: "Parado, sem render", origem: "cadastrada", rate: null,
        pos: { ...base, rule: { k: "fixa", taxa: 0 }, vencimento: null, tax: "isento" },
      });
      continue;
    }
    if (a.is_turbo) {
      const pct = a.cdi_percent ?? 115;
      const teto = a.max_rendimento && a.max_rendimento > 0 ? a.max_rendimento : null;
      const fonte = teto
        ? `${fmtPct(pct, 1)} do CDI até ${teto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}; acima disso, 100%`
        : `${fmtPct(pct, 1)} do CDI`;
      drafts.push({
        id: a.id, accountId: null, nome: a.name, classe: "turbo", valor, fonte, origem: a.cdi_percent == null ? "estimada" : "cadastrada", rate: null,
        pos: { ...base, rule: { k: "cdi", pct }, teto, vencimento: null, tax: "regressivo" },
      });
      continue;
    }

    const classe: AssetClass = isEmergencyAccountName(a.name) ? "emergencia" : "renda_fixa";
    const stored: AccountRate | null = a.rate_index
      ? { rate_index: a.rate_index, rate_value: a.rate_value ?? 0, maturity: a.maturity ?? null, tax_exempt: Boolean(a.tax_exempt) }
      : null;
    const rate = stored ?? accountRateFromText(`${a.name} ${a.institution ?? ""}`);
    if (rate) {
      const tax: TaxMode = rate.tax_exempt || rate.rate_index === "poupanca" ? "isento" : "regressivo";
      drafts.push({
        id: a.id, accountId: a.id, nome: a.name, classe, valor, fonte: describeRate(rate), origem: stored ? "cadastrada" : "nome", rate,
        pos: { ...base, rule: ruleFromRate(rate), vencimento: maturityMonths(rate.maturity, start), tax },
      });
      continue;
    }
    const media = avgRendimentoRate(investments, a.id, valor);
    if (media) {
      drafts.push({
        id: a.id, accountId: a.id, nome: a.name, classe, valor, fonte: `Média dos rendimentos registrados (${media.meses} meses)`, origem: "media", rate: null,
        pos: { ...base, rule: { k: "fixa", taxa: media.taxa }, vencimento: null, tax: "regressivo" },
      });
      continue;
    }
    drafts.push({
      id: a.id, accountId: a.id, nome: a.name, classe, valor, fonte: "100% do CDI (taxa não cadastrada)", origem: "estimada", rate: null,
      pos: { ...base, rule: { k: "cdi", pct: 100 }, vencimento: null, tax: "regressivo" },
    });
  }

  const priceOf = new Map(quotes.map((q) => [q.ticker, q.current_price]));
  const tradeAge = new Map<string, { soma: number; peso: number }>();
  for (const t of trades) {
    if (t.type !== "compra") continue;
    const cur = tradeAge.get(t.ticker) ?? { soma: 0, peso: 0 };
    cur.soma += t.total_amount * monthsBetween(t.date, start);
    cur.peso += t.total_amount;
    tradeAge.set(t.ticker, cur);
  }
  const acc = { acoes: { valor: 0, custo: 0, idade: 0, tickers: [] as string[] }, fiis: { valor: 0, custo: 0, idade: 0, dy: 0, live: 0, tickers: [] as string[] } };
  for (const p of computeStockPositions(trades)) {
    const price = priceOf.get(p.ticker);
    const valor = price != null && price > 0 ? price * p.quantity : p.totalInvested;
    if (!(valor > 0)) continue;
    const age = tradeAge.get(p.ticker);
    const idade = age && age.peso > 0 ? age.soma / age.peso : 0;
    if (detectAssetType(p.ticker) === "FII") {
      const live = fiiDy[p.ticker];
      const dy = live != null && live > 0 ? live : FII_DEFAULT_DY;
      acc.fiis.valor += valor;
      acc.fiis.custo += p.totalInvested;
      acc.fiis.idade += valor * idade;
      acc.fiis.dy += valor * dy;
      if (live != null && live > 0) acc.fiis.live += valor;
      acc.fiis.tickers.push(p.ticker);
    } else {
      acc.acoes.valor += valor;
      acc.acoes.custo += p.totalInvested;
      acc.acoes.idade += valor * idade;
      acc.acoes.tickers.push(p.ticker);
    }
  }
  if (acc.acoes.valor > 0) {
    const a = acc.acoes;
    drafts.push({
      id: "acoes", accountId: null, nome: `Ações · ${a.tickers.join(", ")}`, classe: "acoes", valor: a.valor,
      fonte: `IPCA + ${EQUITY_REAL_RETURN}% (retorno real de longo prazo)`, origem: "mercado", rate: null,
      pos: { id: "acoes", valor: a.valor, custo: a.custo, idadeMeses: a.idade / a.valor, rule: { k: "ipca", spread: EQUITY_REAL_RETURN }, vencimento: null, tax: "acoes" },
    });
  }
  if (acc.fiis.valor > 0) {
    const f = acc.fiis;
    const aoVivo = f.live >= f.valor * 0.5;
    drafts.push({
      id: "fiis", accountId: null, nome: `FIIs · ${f.tickers.join(", ")}`, classe: "fiis", valor: f.valor,
      fonte: aoVivo ? "Dividendos pagos nos últimos 12 meses" : "Dividendos estimados (~0,85% ao mês)", origem: aoVivo ? "mercado" : "estimada", rate: null,
      pos: { id: "fiis", valor: f.valor, custo: f.custo, idadeMeses: f.idade / f.valor, rule: { k: "fixa", taxa: f.dy / f.valor }, vencimento: null, tax: "isento" },
    });
  }

  const total = drafts.reduce((s, d) => s + d.valor, 0);
  if (!(total > 0)) return null;

  const investido = drafts.filter((d) => d.classe !== "caixa").reduce((s, d) => s + d.valor, 0);
  const positions: Position[] = drafts.map((d) => ({
    ...d.pos,
    pesoAporte: d.classe === "caixa" || investido <= 0 ? 0 : d.valor / investido,
  }));
  if (investido <= 0) {
    positions.push({ id: "novos", valor: 0, custo: 0, idadeMeses: 0, rule: { k: "cdi", pct: 100 }, vencimento: null, tax: "regressivo", pesoAporte: 1 });
  }

  const rows: PortfolioRow[] = drafts
    .map((d) => ({
      ...d,
      peso: d.valor / total,
      taxa12m: ruleAnnual(d.pos.rule, curve, 0, d.pos.vencimento),
      irLongo: longTermRate(d.pos.tax),
    }))
    .map(({ pos: _pos, ...row }) => row)
    .sort((a, b) => b.valor - a.valor);

  return { total, caixa: drafts.filter((d) => d.classe === "caixa").reduce((s, d) => s + d.valor, 0), rows, positions };
}

/** Escala as posições para outro valor inicial, mantendo a mesma composição. */
export function scalePositions(positions: Position[], factor: number): Position[] {
  if (factor === 1) return positions;
  return positions.map((p) => ({ ...p, valor: p.valor * factor, custo: p.custo * factor }));
}
