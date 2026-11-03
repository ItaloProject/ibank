import { describe, expect, it } from "vitest";
import { buildPushPayload, isPushPriceAlert } from "./user-push";
import type { BotAlert } from "./alerts";

const alerta = (parcial: Partial<BotAlert> & Pick<BotAlert, "id" | "titulo">): BotAlert => ({
  nivel: "media",
  detalhe: "Detalhe do aviso para o teste do push.",
  ...parcial,
});

describe("isPushPriceAlert", () => {
  it("reconhece avisos de bolsa e ignora o resto", () => {
    expect(isPushPriceAlert({ id: "queda-ITUB4-2026-11-03" })).toBe(true);
    expect(isPushPriceAlert({ id: "mercado-2026-11-03" })).toBe(true);
    expect(isPushPriceAlert({ id: "semana-VALE3-3000" })).toBe(true);
    expect(isPushPriceAlert({ id: "abaixo-custo-PETR4-2026-11" })).toBe(true);
    expect(isPushPriceAlert({ id: "parado-2026-10-01" })).toBe(false);
    expect(isPushPriceAlert({ id: "teto-abc" })).toBe(false);
  });
});

describe("buildPushPayload", () => {
  it("usa o aviso de nível alta como título", () => {
    const payload = buildPushPayload([
      alerta({ id: "queda-ITUB4-2026-11-03", titulo: "ITUB4 caiu 5,3% hoje", nivel: "media" }),
      alerta({ id: "mercado-2026-11-03", titulo: "Ibovespa caiu 3,6% hoje", nivel: "alta", detalhe: "Impacto na carteira." }),
    ]);
    expect(payload?.title).toBe("Ibovespa caiu 3,6% hoje");
    expect(payload?.body).toContain("+1 aviso");
    expect(payload?.url).toBe("/");
  });

  it("devolve null sem avisos", () => {
    expect(buildPushPayload([])).toBeNull();
  });
});
