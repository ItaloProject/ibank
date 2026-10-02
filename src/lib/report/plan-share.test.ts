import { describe, expect, it } from "vitest";
import { groupTotals, groupWhatsAppText, itemStatus, slug } from "./plan-share";

const cartao = {
  name: "Cartão",
  color: "#3b82f6",
  items: [
    { name: "Noroeste", type: "fixo" as const, planned: 98.95, actual: 98.95 },
    { name: "Railway", type: "variavel" as const, planned: 35.2, actual: 0 },
    { name: "Mercado *top*", type: "variavel" as const, planned: 500, actual: 520 },
    { name: "Uber", type: "variavel" as const, planned: 100, actual: 60 },
  ],
};

describe("plan share", () => {
  it("classifica cada item", () => {
    expect(cartao.items.map(itemStatus)).toEqual(["pago", "pendente", "acima", "pago"]);
  });

  it("soma o grupo", () => {
    const t = groupTotals(cartao.items);
    expect(t.planned).toBeCloseTo(734.15);
    expect(t.actual).toBeCloseTo(678.95);
    expect(t.paid).toBe(3);
    expect(t.over).toBe(1);
  });

  it("monta a mensagem do WhatsApp", () => {
    const text = groupWhatsAppText(cartao, "outubro 2026");
    expect(text.split("\n")[0]).toBe("*CARTÃO* · Outubro 2026");
    expect(text).toContain("✅ Noroeste · *R$ 98,95*\n");
    expect(text).toContain("⏳ Railway · R$ 35,20 planejado");
    expect(text).toContain("⚠️ Mercado top · *R$ 520,00* (R$ 20,00 acima do planejado)");
    expect(text).toContain("✅ Uber · *R$ 60,00* de R$ 100,00");
    expect(text).toContain("✨ *Sobra do planejado:* R$ 55,20");
    expect(text).toContain("3 de 4 itens pagos");
    expect(text.endsWith("_Organizado no Muvo_")).toBe(true);
  });

  it("avisa quando o grupo passa do planejado", () => {
    const text = groupWhatsAppText({ ...cartao, items: [{ name: "Luz", type: "fixo", planned: 100, actual: 150 }] }, "outubro 2026");
    expect(text).toContain("🔺 *Acima do planejado:* R$ 50,00");
    expect(text).toContain("1 de 1 item pago");
  });

  it("encurta a legenda de grupos grandes sem perder os totais", () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ name: `Compra número ${i + 1} do mês`, type: "variavel" as const, planned: 50, actual: 50 }));
    const text = groupWhatsAppText({ ...cartao, items }, "outubro 2026", 1000);
    expect(text.length).toBeLessThanOrEqual(1000);
    expect(text).toMatch(/_… e mais \d+ itens na imagem_/);
    expect(text).toContain("💰 *Gasto real:* R$ 2.000,00");
    expect(text).toContain("40 de 40 itens pagos");
    expect(groupWhatsAppText({ ...cartao, items }, "outubro 2026")).not.toContain("e mais");
  });

  it("gera nome de arquivo sem acento", () => {
    expect(slug("Alimentação & Casa")).toBe("alimentacao-casa");
  });
});
