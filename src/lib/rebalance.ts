/**
 * Rebalanceamento da carteira por perfil de risco.
 *
 * - A reserva de emergência é dimensionada em meses de gastos e pode ser coberta
 *   por contas de reserva e, na falta delas, por pós-fixados com liquidez.
 * - O restante é comparado com a alocação-alvo do perfil.
 * - O plano de aporte só usa dinheiro novo: completa a reserva e depois reforça as
 *   classes abaixo do alvo, proporcionalmente ao que falta. Vender só é sugerido
 *   em desvios grandes, porque gera imposto.
 */
import type { PortfolioRow } from "@/lib/portfolio-return";

export type RiskProfile = "conservador" | "moderado" | "arrojado";
export type InvestBucket = "pos" | "inflacao" | "prefixado" | "fiis" | "acoes";
export type Bucket = "reserva" | InvestBucket | "caixa";

export const RISK_PROFILES: Record<RiskProfile, { label: string; descricao: string; reservaMeses: number; alvo: Record<InvestBucket, number> }> = {
  conservador: {
    label: "Conservador",
    descricao: "Prioriza segurança; pouca oscilação.",
    reservaMeses: 12,
    alvo: { pos: 0.5, inflacao: 0.25, prefixado: 0.1, fiis: 0.1, acoes: 0.05 },
  },
  moderado: {
    label: "Moderado",
    descricao: "Equilíbrio entre segurança e crescimento.",
    reservaMeses: 6,
    alvo: { pos: 0.3, inflacao: 0.25, prefixado: 0.1, fiis: 0.15, acoes: 0.2 },
  },
  arrojado: {
    label: "Arrojado",
    descricao: "Busca crescimento; aceita oscilação.",
    reservaMeses: 6,
    alvo: { pos: 0.15, inflacao: 0.2, prefixado: 0.05, fiis: 0.2, acoes: 0.4 },
  },
};

export const BUCKET_LABEL: Record<Bucket, string> = {
  reserva: "Reserva de emergência",
  pos: "Pós-fixado (CDI/Selic)",
  inflacao: "Inflação (IPCA+)",
  prefixado: "Prefixado",
  fiis: "Fundos imobiliários",
  acoes: "Ações",
  caixa: "Saldo parado",
};

const INVEST_BUCKETS: InvestBucket[] = ["pos", "inflacao", "prefixado", "fiis", "acoes"];
/** Reserva mínima quando não há gastos cadastrados. */
export const MIN_RESERVE = 3000;

export function isRiskProfile(v: unknown): v is RiskProfile {
  return v === "conservador" || v === "moderado" || v === "arrojado";
}

export type Holding = { ticker: string; kind: "fii" | "acao"; valor: number };
export type TurboCap = { nome: string; saldo: number; teto: number };

export type RebalanceInput = {
  rows: PortfolioRow[];
  profile: RiskProfile;
  /** Aporte mensal a distribuir. */
  aporte: number;
  /** Gasto mensal médio; null quando não cadastrado. */
  gastoMensal: number | null;
  holdings?: Holding[];
  turbos?: TurboCap[];
  today?: Date;
};

export type BucketView = {
  id: InvestBucket;
  label: string;
  valor: number;
  /** % da parte investida (sem reserva e saldo parado). */
  pct: number;
  alvoPct: number;
  /** Quanto falta (positivo) ou sobra (negativo) para o alvo, em R$. */
  diff: number;
};

export type Allocation = { bucket: Bucket; label: string; valor: number };

export type Suggestion = {
  id: string;
  prioridade: "alta" | "media" | "baixa";
  titulo: string;
  detalhe: string;
};

export type RebalancePlan = {
  profile: RiskProfile;
  total: number;
  caixa: number;
  reserva: { atual: number; alvo: number; meses: number; baseadaEmGastos: boolean };
  buckets: BucketView[];
  /** Metade da soma dos desvios, em pontos percentuais: quanto da carteira está fora do alvo. */
  desvio: number;
  aporte: number;
  plano: Allocation[];
  sugestoes: Suggestion[];
  /** Rentabilidade esperada nos próximos 12 meses, líquida de IR (% a.a.). */
  retorno12m: number;
};

export function bucketOf(row: PortfolioRow): Bucket {
  switch (row.classe) {
    case "caixa": return "caixa";
    case "emergencia": return "reserva";
    case "turbo": return "pos";
    case "fiis": return "fiis";
    case "acoes": return "acoes";
    case "renda_fixa":
      if (row.rate?.rate_index === "ipca") return "inflacao";
      if (row.rate?.rate_index === "pre") return "prefixado";
      return "pos";
  }
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pp = (n: number) => `${Math.round(n)} p.p.`;

function roundAllocations(items: Allocation[], total: number): Allocation[] {
  const step = total >= 500 ? 10 : 1;
  const rounded = items.map((a) => ({ ...a, valor: Math.floor(a.valor / step) * step }));
  const resto = Math.round((total - rounded.reduce((s, a) => s + a.valor, 0)) * 100) / 100;
  if (rounded.length > 0 && resto > 0) {
    const maior = rounded.reduce((a, b) => (b.valor > a.valor ? b : a));
    maior.valor = Math.round((maior.valor + resto) * 100) / 100;
  }
  return rounded.filter((a) => a.valor >= 1).sort((a, b) => b.valor - a.valor);
}

export function buildRebalancePlan(input: RebalanceInput): RebalancePlan {
  const { rows, profile } = input;
  const cfg = RISK_PROFILES[profile];
  const aporte = Math.max(0, input.aporte || 0);
  const today = input.today ?? new Date();

  const valor: Record<Bucket, number> = { reserva: 0, pos: 0, inflacao: 0, prefixado: 0, fiis: 0, acoes: 0, caixa: 0 };
  for (const r of rows) valor[bucketOf(r)] += r.valor;
  const total = rows.reduce((s, r) => s + r.valor, 0);

  const baseadaEmGastos = input.gastoMensal != null && input.gastoMensal > 0;
  const reservaAlvo = baseadaEmGastos ? input.gastoMensal! * cfg.reservaMeses : MIN_RESERVE;
  const liquidez = valor.reserva + valor.pos;
  const reservaAtual = Math.min(reservaAlvo, liquidez);

  const inv: Record<InvestBucket, number> = {
    pos: liquidez - reservaAtual,
    inflacao: valor.inflacao,
    prefixado: valor.prefixado,
    fiis: valor.fiis,
    acoes: valor.acoes,
  };
  const investido = INVEST_BUCKETS.reduce((s, b) => s + inv[b], 0);

  const buckets: BucketView[] = INVEST_BUCKETS.map((b) => ({
    id: b,
    label: BUCKET_LABEL[b],
    valor: inv[b],
    pct: investido > 0 ? (inv[b] / investido) * 100 : 0,
    alvoPct: cfg.alvo[b] * 100,
    diff: cfg.alvo[b] * investido - inv[b],
  }));
  const desvio = investido > 0 ? buckets.reduce((s, b) => s + Math.abs(b.pct - b.alvoPct), 0) / 2 : 0;

  // Plano de aporte
  const plano: Allocation[] = [];
  let resto = aporte;
  const faltaReserva = Math.max(0, reservaAlvo - liquidez);
  if (faltaReserva > 0 && resto > 0) {
    const v = Math.min(resto, faltaReserva);
    plano.push({ bucket: "reserva", label: BUCKET_LABEL.reserva, valor: v });
    resto -= v;
  }
  if (resto > 0) {
    const alvoTotal = investido + resto;
    const deficits = INVEST_BUCKETS.map((b) => Math.max(0, cfg.alvo[b] * alvoTotal - inv[b]));
    const soma = deficits.reduce((s, d) => s + d, 0);
    INVEST_BUCKETS.forEach((b, i) => {
      const v = soma >= resto ? (resto * deficits[i]) / soma : deficits[i] + (resto - soma) * cfg.alvo[b];
      if (v > 0) plano.push({ bucket: b, label: BUCKET_LABEL[b], valor: v });
    });
  }

  // Sugestões
  const sugestoes: Suggestion[] = [];
  if (faltaReserva > 0) {
    sugestoes.push({
      id: "reserva",
      prioridade: "alta",
      titulo: "Complete a reserva de emergência",
      detalhe: baseadaEmGastos
        ? `Faltam ${brl(faltaReserva)} para ${cfg.reservaMeses} meses dos seus gastos (${brl(input.gastoMensal!)}/mês). Use aplicação com liquidez diária, como Tesouro Selic ou CDB 100% do CDI.`
        : `Faltam ${brl(faltaReserva)} para a reserva mínima de ${brl(MIN_RESERVE)}. Cadastre seus gastos no Planejamento para calcular o valor ideal.`,
    });
  }
  if (valor.caixa >= 500 && valor.caixa >= total * 0.05) {
    sugestoes.push({
      id: "caixa",
      prioridade: "alta",
      titulo: `Invista os ${brl(valor.caixa)} parados`,
      detalhe: faltaReserva > 0
        ? "Saldo em conta não rende. Leve para a reserva de emergência, com liquidez diária."
        : "Saldo em conta não rende. Leve para um CDB com liquidez diária ou siga o plano de aporte abaixo.",
    });
  }
  for (const t of input.turbos ?? []) {
    const excedente = t.saldo - t.teto;
    if (t.teto > 0 && excedente >= 100) {
      sugestoes.push({
        id: `turbo-${t.nome}`,
        prioridade: "media",
        titulo: `${t.nome} passou do teto em ${brl(excedente)}`,
        detalhe: "O que passa do teto rende só 100% do CDI. Mova o excedente para um CDB acima de 100% do CDI ou para o Tesouro.",
      });
    }
  }
  for (const r of rows) {
    const venc = r.rate?.maturity;
    if (!venc) continue;
    const meses = (new Date(`${venc}T12:00:00`).getTime() - today.getTime()) / (30.44 * 24 * 3600 * 1000);
    if (meses >= 0 && meses <= 6) {
      sugestoes.push({
        id: `venc-${r.id}`,
        prioridade: "media",
        titulo: `${r.nome} vence em ${Math.max(1, Math.round(meses))} ${Math.round(meses) <= 1 ? "mês" : "meses"}`,
        detalhe: `Planeje onde reaplicar ${brl(r.valor)}; hoje, a classe mais abaixo do alvo é ${BUCKET_LABEL[[...buckets].sort((a, b) => b.diff - a.diff)[0].id].toLowerCase()}.`,
      });
    }
  }
  for (const b of buckets) {
    const acima = b.pct - b.alvoPct;
    if (investido < 1000 || acima < 10) continue;
    sugestoes.push({
      id: `acima-${b.id}`,
      prioridade: acima >= 20 ? "media" : "baixa",
      titulo: `${b.label}: ${pp(acima)} acima do alvo`,
      detalhe: acima >= 20
        ? `Pare de aportar aqui. Se quiser acelerar, realoque até ${brl(-b.diff)}, mas considere o IR da venda antes.`
        : "Pare de aportar aqui até os novos aportes equilibrarem a carteira.",
    });
  }
  const holdings = input.holdings ?? [];
  for (const kind of ["acao", "fii"] as const) {
    const lista = holdings.filter((h) => h.kind === kind);
    const soma = lista.reduce((s, h) => s + h.valor, 0);
    if (lista.length === 0 || soma < 2000) continue;
    const maior = lista.reduce((a, h) => (h.valor > a.valor ? h : a));
    const peso = maior.valor / soma;
    if (lista.length === 1 || peso > 0.3) {
      sugestoes.push({
        id: `conc-${kind}`,
        prioridade: "media",
        titulo: `${maior.ticker} é ${Math.round(peso * 100)}% ${kind === "acao" ? "das suas ações" : "dos seus FIIs"}`,
        detalhe: kind === "acao"
          ? "Concentração alta em um só ativo. Nos próximos aportes em ações, diversifique entre setores."
          : "Concentração alta em um só fundo. Nos próximos aportes em FIIs, diversifique entre tipos (tijolo, papel, logística).",
      });
    }
  }
  const empresas = new Map<string, string[]>();
  for (const h of holdings.filter((x) => x.kind === "acao")) {
    const base = h.ticker.replace(/\d+$/, "");
    empresas.set(base, [...(empresas.get(base) ?? []), h.ticker]);
  }
  for (const tickers of empresas.values()) {
    if (tickers.length > 1) {
      sugestoes.push({
        id: `dup-${tickers[0]}`,
        prioridade: "baixa",
        titulo: `${tickers.join(" e ")} são da mesma empresa`,
        detalhe: "Ter duas classes da mesma empresa não diversifica. Concentre em uma delas nos próximos aportes.",
      });
    }
  }
  const semTaxa = rows.filter((r) => r.accountId && (r.origem === "estimada" || r.origem === "nome"));
  if (semTaxa.length > 0) {
    sugestoes.push({
      id: "taxas",
      prioridade: "baixa",
      titulo: "Cadastre a rentabilidade das contas",
      detalhe: `${semTaxa.map((r) => r.nome).join(", ")}: ${semTaxa.length === 1 ? "taxa estimada" : "taxas estimadas"}. Com a taxa certa, a análise fica exata.`,
    });
  }
  const ordem = { alta: 0, media: 1, baixa: 2 };
  sugestoes.sort((a, b) => ordem[a.prioridade] - ordem[b.prioridade]);

  const retorno12m = total > 0 ? rows.reduce((s, r) => s + r.peso * r.taxa12m * (1 - r.irLongo), 0) : 0;

  return {
    profile,
    total,
    caixa: valor.caixa,
    reserva: { atual: reservaAtual, alvo: reservaAlvo, meses: cfg.reservaMeses, baseadaEmGastos },
    buckets,
    desvio,
    aporte,
    plano: roundAllocations(plano, aporte),
    sugestoes,
    retorno12m,
  };
}
