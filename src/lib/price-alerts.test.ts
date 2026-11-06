import { describe, expect, it } from "vitest";
import { buildPriceAlerts, isSevereIndex, isSevereMove, urgentPriceAlerts, type PositionMove } from "@/lib/price-alerts";
import { parseDayMove, type DayMove } from "@/lib/market-quotes";

const HOJE = new Date("2026-11-03T18:00:00Z");
const T_HOJE = Date.UTC(2026, 10, 3, 17, 0);
const T_ONTEM = Date.UTC(2026, 10, 2, 17, 0);

const move = (changePct: number, time = T_HOJE, weekChangePct: number | null = null): DayMove => {
  const previousClose = 100;
  return { price: previousClose * (1 + changePct / 100), previousClose, changePct, time, weekChangePct };
};

const pos = (ticker: string, changePct: number | null, extra: Partial<PositionMove> = {}): PositionMove => ({
  ticker,
  tipo: ticker.endsWith("11") ? "FII" : "Ação",
  quantidade: 10,
  precoMedio: 100,
  preco: changePct === null ? null : 100 * (1 + changePct / 100),
  move: changePct === null ? null : move(changePct),
  ...extra,
});

/** Posição com queda de `semana` % em 5 pregões e variação pequena no dia. */
const posSemana = (ticker: string, semana: number, extra: Partial<PositionMove> = {}): PositionMove => ({
  ...pos(ticker, -0.2),
  move: move(-0.2, T_HOJE, semana),
  ...extra,
});

describe("parseDayMove", () => {
  const daily = (closes: (number | null)[], price: number) => ({
    chart: {
      result: [
        {
          meta: { regularMarketPrice: price, regularMarketTime: T_HOJE / 1000 },
          timestamp: [Date.UTC(2026, 9, 30, 13) / 1000, Date.UTC(2026, 10, 3, 13) / 1000],
          indicators: { quote: [{ close: closes }] },
        },
      ],
    },
  });

  it("calcula a variação de 5 pregões quando há histórico", () => {
    const dias = [26, 27, 28, 29, 30].map((d) => Date.UTC(2026, 9, d, 13) / 1000);
    const m = parseDayMove({
      chart: {
        result: [
          {
            meta: { regularMarketPrice: 90, regularMarketTime: T_HOJE / 1000 },
            timestamp: [...dias, Date.UTC(2026, 10, 3, 13) / 1000],
            indicators: { quote: [{ close: [100, 98, 97, 96, 95, null] }] },
          },
        ],
      },
    });
    expect(m?.previousClose).toBe(95);
    expect(m?.weekChangePct).toBeCloseTo(-10, 5);
  });

  it("deixa a variação semanal nula com histórico curto", () => {
    expect(parseDayMove(daily([38, null], 36))?.weekChangePct).toBeNull();
  });

  it("compara com o fechamento do pregão anterior, mesmo quando a barra de hoje vem sem fechamento", () => {
    const m = parseDayMove(daily([38, null], 36));
    expect(m?.previousClose).toBe(38);
    expect(m?.changePct).toBeCloseTo(-5.263, 2);
  });

  it("ignora a barra de hoje mesmo quando ela já traz o preço atual", () => {
    expect(parseDayMove(daily([38, 36.1], 36))?.previousClose).toBe(38);
  });

  it("devolve null sem fechamento anterior ou sem preço", () => {
    expect(parseDayMove(daily([null, 36], 36))).toBeNull();
    expect(parseDayMove({ chart: { result: [{ meta: {} }] } })).toBeNull();
    expect(parseDayMove({})).toBeNull();
  });
});

describe("buildPriceAlerts: queda no dia", () => {
  it("avisa ação que caiu 5% ou mais e diz que o Ibovespa quase não mexeu", () => {
    const alerts = buildPriceAlerts({ positions: [pos("ITUB4", -5.3)], index: move(-0.4), today: HOJE });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ id: "queda-ITUB4-2026-11-03", nivel: "media", titulo: "ITUB4 caiu 5,3% hoje" });
    expect(alerts[0].detalhe).toContain("específica deste papel");
  });

  it("não avisa ação com queda abaixo de 5%", () => {
    expect(buildPriceAlerts({ positions: [pos("ITUB4", -4.9)], index: move(0), today: HOJE })).toEqual([]);
  });

  it("marca como alta a queda de 8% ou mais", () => {
    const [a] = buildPriceAlerts({ positions: [pos("PETR4", -8.5)], index: move(0), today: HOJE });
    expect(a.nivel).toBe("alta");
  });

  it("usa limite menor para fundo imobiliário", () => {
    expect(buildPriceAlerts({ positions: [pos("MXRF11", -2.4)], index: null, today: HOJE })).toEqual([]);
    const [a] = buildPriceAlerts({ positions: [pos("MXRF11", -2.6)], index: null, today: HOJE });
    expect(a.nivel).toBe("media");
    expect(buildPriceAlerts({ positions: [pos("MXRF11", -4.2)], index: null, today: HOJE })[0].nivel).toBe("alta");
  });

  it("fala em 'último pregão' quando a cotação não é de hoje", () => {
    const p = pos("ITUB4", -6);
    p.move = move(-6, T_ONTEM);
    const [a] = buildPriceAlerts({ positions: [p], index: null, today: HOJE });
    expect(a.titulo).toBe("ITUB4 caiu 6,0% no último pregão");
    expect(a.id).toBe("queda-ITUB4-2026-11-02");
  });

  it("não avisa quando o papel subiu ou não tem cotação", () => {
    expect(buildPriceAlerts({ positions: [pos("ITUB4", 3), pos("VALE3", null)], index: move(1), today: HOJE })).toEqual([]);
  });
});

describe("buildPriceAlerts: mercado em queda", () => {
  it("emite um aviso do mercado com o impacto na carteira e as maiores quedas", () => {
    const alerts = buildPriceAlerts({
      positions: [pos("ITUB4", -3.5), pos("VALE3", -2.5), pos("MXRF11", -0.5)],
      index: move(-3),
      today: HOJE,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ id: "mercado-2026-11-03", nivel: "media", titulo: "Ibovespa caiu 3,0% hoje" });
    expect(alerts[0].detalhe).toContain("ITUB4 −3,5%");
    expect(alerts[0].detalhe).toContain("quase todos os papéis caem juntos");
  });

  it("marca como alta o Ibovespa em queda de 3,5% ou mais", () => {
    const [a] = buildPriceAlerts({ positions: [pos("ITUB4", -4)], index: move(-3.6), today: HOJE });
    expect(a.nivel).toBe("alta");
  });

  it("não avisa do mercado com queda menor que 2% ou sem posições", () => {
    expect(buildPriceAlerts({ positions: [pos("ITUB4", -1)], index: move(-1.9), today: HOJE })).toEqual([]);
    expect(buildPriceAlerts({ positions: [], index: move(-4), today: HOJE })).toEqual([]);
  });

  it("separa o papel que caiu 3 pontos ou mais além do mercado", () => {
    const alerts = buildPriceAlerts({ positions: [pos("ITUB4", -3.5), pos("MGLU3", -7)], index: move(-3), today: HOJE });
    expect(alerts.map((a) => a.id)).toEqual(["mercado-2026-11-03", "queda-MGLU3-2026-11-03"]);
    expect(alerts[1].detalhe).toContain("caiu bem mais");
  });
});

describe("buildPriceAlerts: queda acumulada em 5 pregões", () => {
  const ibov = (semana: number, dia = -1) => move(dia, T_HOJE, semana);

  it("avisa o mercado quando o Ibovespa acumula 5% sem nenhum dia ruim", () => {
    const [a] = buildPriceAlerts({ positions: [posSemana("ITUB4", -6)], index: ibov(-5.7), today: HOJE });
    expect(a.titulo).toBe("Ibovespa acumula queda de 5,7% em 5 pregões");
    expect(a.nivel).toBe("media");
    expect(a.id).toMatch(/^mercado-semana-\d+$/);
    expect(a.detalhe).toContain("ITUB4 −6,0%");
  });

  it("marca como alta o Ibovespa em queda de 8% na semana", () => {
    const [a] = buildPriceAlerts({ positions: [posSemana("ITUB4", -6)], index: ibov(-8.2), today: HOJE });
    expect(a.nivel).toBe("alta");
  });

  it("não avisa o mercado abaixo de 5%, e o aviso do dia tem prioridade", () => {
    expect(buildPriceAlerts({ positions: [posSemana("ITUB4", -3)], index: ibov(-4.9), today: HOJE })).toEqual([]);
    const alerts = buildPriceAlerts({ positions: [posSemana("ITUB4", -3)], index: ibov(-6, -2.5), today: HOJE });
    expect(alerts.map((a) => a.id)).toEqual(["mercado-2026-11-03"]);
  });

  it("avisa o papel que caiu 5 pontos além do mercado, mas não o que caiu junto", () => {
    const alerts = buildPriceAlerts({
      positions: [posSemana("ITUB4", -6), posSemana("MGLU3", -12)],
      index: ibov(-5.7),
      today: HOJE,
    });
    expect(alerts.map((a) => a.id.split("-")[0] + "-" + a.id.split("-")[1])).toEqual(["mercado-semana", "semana-MGLU3"]);
  });

  it("usa limites próprios por tipo e o do papel sem mercado em queda", () => {
    expect(buildPriceAlerts({ positions: [posSemana("VALE3", -8.9)], index: ibov(-1), today: HOJE })).toEqual([]);
    expect(buildPriceAlerts({ positions: [posSemana("VALE3", -9.5)], index: ibov(-1), today: HOJE })[0].nivel).toBe("media");
    expect(buildPriceAlerts({ positions: [posSemana("VALE3", -14.5)], index: ibov(-1), today: HOJE })[0].nivel).toBe("alta");
    expect(buildPriceAlerts({ positions: [posSemana("MXRF11", -3.9)], index: ibov(-1), today: HOJE })).toEqual([]);
    expect(buildPriceAlerts({ positions: [posSemana("MXRF11", -4.5)], index: ibov(-1), today: HOJE })[0].nivel).toBe("media");
  });

  it("mantém o mesmo id durante a semana, para o aviso dispensado não voltar todo dia", () => {
    const DIA = 24 * 3600 * 1000;
    const a = buildPriceAlerts({ positions: [posSemana("VALE3", -10)], index: ibov(-1), today: HOJE })[0].id;
    const amanha = { ...posSemana("VALE3", -10), move: move(-0.2, T_HOJE + DIA, -10) };
    const b = buildPriceAlerts({ positions: [amanha], index: move(-1, T_HOJE + DIA, -1), today: new Date(HOJE.getTime() + DIA) })[0].id;
    expect(b).toBe(a);
  });
});

describe("queda grave (aviso imediato)", () => {
  it("papel só é grave a partir do limite alta do dia ou da semana", () => {
    expect(isSevereMove("Ação", move(-7.9))).toBe(false);
    expect(isSevereMove("Ação", move(-8))).toBe(true);
    expect(isSevereMove("FII", move(-3.9))).toBe(false);
    expect(isSevereMove("FII", move(-4))).toBe(true);
    expect(isSevereMove("Ação", move(-1, T_HOJE, -14))).toBe(true);
    expect(isSevereMove("Ação", move(-1, T_HOJE, -13.9))).toBe(false);
    expect(isSevereMove("Ação", null)).toBe(false);
  });

  it("Ibovespa é grave a partir de 3,5% no dia ou 8% na semana", () => {
    expect(isSevereIndex(move(-3.4))).toBe(false);
    expect(isSevereIndex(move(-3.5))).toBe(true);
    expect(isSevereIndex(move(-1, T_HOJE, -8))).toBe(true);
    expect(isSevereIndex(move(-1, T_HOJE, -7.9))).toBe(false);
    expect(isSevereIndex(null)).toBe(false);
  });

  it("só avisos de preço de nível alta saem na hora", () => {
    const base = { detalhe: "d" };
    const lista = [
      { ...base, id: "queda-ITUB4-2026-11-05", nivel: "alta" as const, titulo: "a" },
      { ...base, id: "semana-VALE3-2940", nivel: "alta" as const, titulo: "b" },
      { ...base, id: "mercado-2026-11-05", nivel: "alta" as const, titulo: "c" },
      { ...base, id: "queda-PETR4-2026-11-05", nivel: "media" as const, titulo: "d" },
      { ...base, id: "parado-2026-10-01", nivel: "alta" as const, titulo: "e" },
      { ...base, id: "abaixo-custo-X-2026-11", nivel: "alta" as const, titulo: "f" },
    ];
    expect(urgentPriceAlerts(lista).map((a) => a.titulo)).toEqual(["a", "b", "c"]);
  });
});

describe("buildPriceAlerts: abaixo do preço pago", () => {
  it("avisa posição 15% abaixo do preço médio e marca alta a partir de 25%", () => {
    const [a] = buildPriceAlerts({ positions: [pos("VALE3", null, { preco: 84 })], index: null, today: HOJE });
    expect(a).toMatchObject({ id: "abaixo-custo-VALE3-2026-11", nivel: "media", titulo: "VALE3 está 16,0% abaixo do que você pagou" });
    const [b] = buildPriceAlerts({ positions: [pos("VALE3", null, { preco: 70 })], index: null, today: HOJE });
    expect(b.nivel).toBe("alta");
  });

  it("não avisa abaixo de 15%, nem perda menor que R$ 50", () => {
    expect(buildPriceAlerts({ positions: [pos("VALE3", null, { preco: 86 })], index: null, today: HOJE })).toEqual([]);
    expect(buildPriceAlerts({ positions: [pos("VALE3", null, { preco: 80, quantidade: 2 })], index: null, today: HOJE })).toEqual([]);
  });

  it("não repete o aviso da posição que já tem aviso de queda no dia", () => {
    const p = pos("VALE3", -6, { precoMedio: 120 });
    const alerts = buildPriceAlerts({ positions: [p], index: move(0), today: HOJE });
    expect(alerts.map((a) => a.id)).toEqual(["queda-VALE3-2026-11-03"]);
  });
});
