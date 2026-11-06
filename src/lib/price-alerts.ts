/**
 * Avisos de queda de preço dos papéis em carteira: queda no dia, queda geral do mercado
 * (Ibovespa) e posição bem abaixo do preço médio pago.
 *
 * Os limites seguem a oscilação normal de cada tipo de papel (~2 desvios padrão de um dia):
 * ações costumam variar ~1,5% a 2% ao dia, fundos imobiliários e o Ibovespa bem menos.
 * Um limite único (por exemplo 3%) dispararia toda semana em ação volátil e nunca em FII.
 */
import type { BotAlert } from "@/lib/alerts";
import { brDay, type DayMove } from "@/lib/market-quotes";

type Limite = { media: number; alta: number };

/** Queda no dia, em %, que gera aviso. */
export const LIMITE_DIA_ACAO: Limite = { media: 5, alta: 8 };
export const LIMITE_DIA_FUNDO: Limite = { media: 2.5, alta: 4 };
/** Queda do Ibovespa no dia. */
export const LIMITE_MERCADO: Limite = { media: 2, alta: 3.5 };
/** Com o mercado em queda, só avisa do papel que caiu esta quantidade de pontos a mais que o Ibovespa. */
export const LIMITE_ALEM_DO_MERCADO = 3;
/** Queda acumulada em 5 pregões, em %: pega a descida lenta em que nenhum dia isolado passa do limite diário. */
export const LIMITE_SEMANA_ACAO: Limite = { media: 9, alta: 14 };
export const LIMITE_SEMANA_FUNDO: Limite = { media: 4, alta: 6 };
export const LIMITE_MERCADO_SEMANA: Limite = { media: 5, alta: 8 };
/** Com o mercado em queda na semana, só avisa do papel que caiu esta quantidade de pontos a mais que o Ibovespa. */
export const LIMITE_ALEM_DO_MERCADO_SEMANA = 5;
/** Posição abaixo do preço médio pago, em %, e perda mínima em R$ para não avisar de valores irrisórios. */
export const LIMITE_CUSTO = { media: 15, alta: 25, perdaMinima: 50 };

export type PositionMove = {
  ticker: string;
  tipo: string;
  quantidade: number;
  precoMedio: number;
  /** Último preço conhecido; null quando não há cotação. */
  preco: number | null;
  move: DayMove | null;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function limiteDia(tipo: string): Limite {
  return tipo === "FII" || tipo === "ETF" ? LIMITE_DIA_FUNDO : LIMITE_DIA_ACAO;
}

function limiteSemana(tipo: string): Limite {
  return tipo === "FII" || tipo === "ETF" ? LIMITE_SEMANA_FUNDO : LIMITE_SEMANA_ACAO;
}

/** Janela de 7 dias: o mesmo aviso semanal não volta todo dia enquanto a queda continua. */
const janela = (dia: string) => Math.floor(Date.parse(dia) / (7 * 24 * 3600 * 1000));

/** Queda grave de um papel: passa do limite "alta" do dia ou dos 5 pregões. */
export function isSevereMove(tipo: string, move: DayMove | null): boolean {
  if (!move) return false;
  return (
    move.changePct <= -limiteDia(tipo).alta ||
    (move.weekChangePct !== null && move.weekChangePct <= -limiteSemana(tipo).alta)
  );
}

/** Queda grave do Ibovespa, no dia ou nos 5 pregões. */
export function isSevereIndex(index: DayMove | null): boolean {
  if (!index) return false;
  return (
    index.changePct <= -LIMITE_MERCADO.alta ||
    (index.weekChangePct !== null && index.weekChangePct <= -LIMITE_MERCADO_SEMANA.alta)
  );
}

/** Avisos de preço de nível alta: os únicos que valem uma mensagem na hora, sem esperar o resumo. */
export function urgentPriceAlerts(alerts: BotAlert[]): BotAlert[] {
  return alerts.filter((a) => a.nivel === "alta" && /^(queda|semana|mercado)-/.test(a.id));
}

export function buildPriceAlerts(input: { positions: PositionMove[]; index: DayMove | null; today?: Date }): BotAlert[] {
  const now = input.today ?? new Date();
  const hojeBr = brDay(now.getTime());
  const rotulo = (ms: number) => (brDay(ms) === hojeBr ? "hoje" : "no último pregão");
  const alerts: BotAlert[] = [];

  const comMovimento = input.positions.filter((p): p is PositionMove & { move: DayMove } => p.move !== null && p.quantidade > 0);
  const indice = input.index?.changePct ?? null;
  const mercadoEmQueda = indice !== null && indice <= -LIMITE_MERCADO.media;
  const comAviso = new Set<string>();

  if (input.index && mercadoEmQueda && comMovimento.length > 0) {
    const impacto = comMovimento.reduce((s, p) => s + p.quantidade * (p.move.price - p.move.previousClose), 0);
    const base = comMovimento.reduce((s, p) => s + p.quantidade * p.move.previousClose, 0);
    const piores = comMovimento
      .filter((p) => p.move.changePct < 0)
      .sort((a, b) => a.move.changePct - b.move.changePct)
      .slice(0, 3)
      .map((p) => `${p.ticker} −${pct(p.move.changePct)}`);
    const quando = rotulo(input.index.time);
    alerts.push({
      id: `mercado-${brDay(input.index.time)}`,
      nivel: indice! <= -LIMITE_MERCADO.alta ? "alta" : "media",
      titulo: `Ibovespa caiu ${pct(indice!)} ${quando}`,
      detalhe:
        `Sua carteira de ações e fundos variou ${impacto < 0 ? "−" : "+"}${brl(Math.abs(impacto))} (${impacto < 0 ? "−" : "+"}${pct(base > 0 ? (impacto / base) * 100 : 0)}) ${quando}.` +
        (piores.length ? ` Maiores quedas: ${piores.join(", ")}.` : "") +
        " Quando o mercado inteiro cai, quase todos os papéis caem juntos; decidir no impulso costuma custar caro.",
    });
  }

  for (const p of comMovimento) {
    const lim = limiteDia(p.tipo);
    const queda = p.move.changePct;
    if (queda > -lim.media) continue;
    // Com o mercado em queda geral, o aviso do mercado já cobre quem caiu junto com ele.
    if (mercadoEmQueda && queda > indice! - LIMITE_ALEM_DO_MERCADO) continue;
    const quando = rotulo(p.move.time);
    const porCota = p.move.price - p.move.previousClose;
    const contexto =
      indice === null
        ? ""
        : mercadoEmQueda
          ? ` O Ibovespa caiu ${pct(indice)}, mas este papel caiu bem mais.`
          : ` O Ibovespa variou ${indice < 0 ? "−" : "+"}${pct(indice)} no mesmo dia, então a queda é específica deste papel.`;
    alerts.push({
      id: `queda-${p.ticker}-${brDay(p.move.time)}`,
      nivel: queda <= -lim.alta ? "alta" : "media",
      titulo: `${p.ticker} caiu ${pct(queda)} ${quando}`,
      detalhe: `De ${brl(p.move.previousClose)} para ${brl(p.move.price)} (${brl(Math.abs(porCota))} a menos por cota, ${brl(Math.abs(porCota * p.quantidade))} nas suas ${p.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} cotas).${contexto}`,
    });
    comAviso.add(p.ticker);
  }

  const indiceSemana = input.index?.weekChangePct ?? null;
  const mercadoSemanaEmQueda = indiceSemana !== null && indiceSemana <= -LIMITE_MERCADO_SEMANA.media;
  const semanaDe = (p: PositionMove & { move: DayMove }) =>
    p.move.weekChangePct === null ? null : { pct: p.move.weekChangePct, ref: p.move.price / (1 + p.move.weekChangePct / 100) };

  if (input.index && mercadoSemanaEmQueda && !mercadoEmQueda && comMovimento.length > 0) {
    const itens = comMovimento.flatMap((p) => {
      const s = semanaDe(p);
      return s ? [{ p, s }] : [];
    });
    const impacto = itens.reduce((acc, { p, s }) => acc + p.quantidade * (p.move.price - s.ref), 0);
    const base = itens.reduce((acc, { p, s }) => acc + p.quantidade * s.ref, 0);
    const piores = itens
      .filter(({ s }) => s.pct < 0)
      .sort((a, b) => a.s.pct - b.s.pct)
      .slice(0, 3)
      .map(({ p, s }) => `${p.ticker} −${pct(s.pct)}`);
    alerts.push({
      id: `mercado-semana-${janela(brDay(input.index.time))}`,
      nivel: indiceSemana! <= -LIMITE_MERCADO_SEMANA.alta ? "alta" : "media",
      titulo: `Ibovespa acumula queda de ${pct(indiceSemana!)} em 5 pregões`,
      detalhe:
        `Nenhum dia foi muito ruim sozinho, mas a queda se acumulou. Sua carteira de ações e fundos variou ${impacto < 0 ? "−" : "+"}${brl(Math.abs(impacto))} (${impacto < 0 ? "−" : "+"}${pct(base > 0 ? (impacto / base) * 100 : 0)}) nesse período.` +
        (piores.length ? ` Maiores quedas: ${piores.join(", ")}.` : "") +
        " Oscilar assim faz parte do mercado; antes de vender, vale conferir se o seu plano mudou.",
    });
  }

  for (const p of comMovimento) {
    const s = semanaDe(p);
    if (!s || comAviso.has(p.ticker)) continue;
    const lim = limiteSemana(p.tipo);
    if (s.pct > -lim.media) continue;
    // O aviso do mercado já cobre quem caiu junto com ele.
    if (mercadoSemanaEmQueda && s.pct > indiceSemana! - LIMITE_ALEM_DO_MERCADO_SEMANA) continue;
    const contexto =
      indiceSemana === null
        ? ""
        : ` O Ibovespa variou ${indiceSemana < 0 ? "−" : "+"}${pct(indiceSemana)} no mesmo período.`;
    alerts.push({
      id: `semana-${p.ticker}-${janela(brDay(p.move.time))}`,
      nivel: s.pct <= -lim.alta ? "alta" : "media",
      titulo: `${p.ticker} acumula queda de ${pct(s.pct)} em 5 pregões`,
      detalhe: `De ${brl(s.ref)} para ${brl(p.move.price)} (${brl(Math.abs(p.move.price - s.ref) * p.quantidade)} a menos nas suas ${p.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} cotas).${contexto}`,
    });
    comAviso.add(p.ticker);
  }

  const mes = hojeBr.slice(0, 7);
  for (const p of input.positions) {
    if (comAviso.has(p.ticker) || p.preco === null || !(p.preco > 0) || !(p.precoMedio > 0) || p.quantidade <= 0) continue;
    const variacao = (p.preco / p.precoMedio - 1) * 100;
    const perda = p.quantidade * (p.precoMedio - p.preco);
    if (variacao > -LIMITE_CUSTO.media || perda < LIMITE_CUSTO.perdaMinima) continue;
    alerts.push({
      id: `abaixo-custo-${p.ticker}-${mes}`,
      nivel: variacao <= -LIMITE_CUSTO.alta ? "alta" : "media",
      titulo: `${p.ticker} está ${pct(variacao)} abaixo do que você pagou`,
      detalhe: `Preço médio ${brl(p.precoMedio)}, hoje ${brl(p.preco)}: ${brl(perda)} a menos nesta posição. A perda só se concretiza se você vender. Vale rever se o motivo da compra continua valendo.`,
    });
  }

  return alerts;
}
