import { describe, expect, it } from "vitest";
import { followUp, type GenieMemory } from "./context";
import { distance, fixTypos, similar } from "./fuzzy";
import { parseGenie } from "./parse";
import { findItem, type PlanItem } from "./answer";
import { suggest } from "./suggest";

const MEM: GenieMemory = { item: "Netflix", group: "ASSINATURAS", last: "addItems" };

describe("gasto real junto do planejado", () => {
  const G = ["CASA", "CARTAO"];
  it("no mesmo pedido", () => {
    expect(parseGenie("adicionar luz 180 em casa como gasto real", G, 10)).toMatchObject({ kind: "addItems", paid: true, items: [{ name: "Luz", value: 180 }], group: "casa" });
    expect(parseGenie("adicionar em cartao netflix 55, coloque como real", G, 10)).toMatchObject({ kind: "addItems", paid: true, items: [{ name: "Netflix", value: 55 }] });
    expect(parseGenie("adicionar aluguel 1800 em casa como planejado e real", G, 10)).toMatchObject({ paid: true, items: [{ name: "Aluguel", value: 1800 }] });
    expect(parseGenie("adicionar mercado 300 em casa ja paguei", G, 10)).toMatchObject({ paid: true, items: [{ name: "Mercado", value: 300 }] });
    expect(parseGenie("adicionar luz 180 em casa", G, 10)).not.toHaveProperty("paid");
    expect(parseGenie("adicionar pao 1 real em casa", G, 10)).not.toHaveProperty("paid");
  });
  it("logo depois de adicionar", () => {
    for (const s of ["coloque como real", "gasto real", "coloca como gasto real", "como real", "marca como planejado e real", "já paguei", "foi pago", "coloca eles como real"]) {
      expect(followUp(s, MEM), s).toEqual({ kind: "paid" });
    }
    expect(followUp("gasto real", { item: null, group: null, last: null })).toBeNull();
  });
});

describe("memória da conversa", () => {
  it("correção do último valor", () => {
    expect(followUp("na verdade é 110", MEM)).toEqual({ kind: "correct", value: 110 });
    expect(followUp("opa, era 59,90", MEM)).toEqual({ kind: "correct", value: 59.9 });
    expect(followUp("não, 45", MEM)).toEqual({ kind: "correct", value: 45 });
    expect(followUp("foi 80", MEM)).toEqual({ kind: "correct", value: 80 });
    expect(followUp("na verdade é 110", { ...MEM, last: null })).toBeNull();
  });

  it("somar no último item", () => {
    expect(followUp("mais 20", MEM)).toEqual({ kind: "more", value: 20 });
    expect(followUp("coloca mais 20 nele", MEM)).toEqual({ kind: "more", value: 20 });
    expect(followUp("soma 15 nele", MEM)).toEqual({ kind: "more", value: 15 });
  });

  it("também e pronomes", () => {
    expect(followUp("e o Spotify 22", MEM)).toEqual({ kind: "text", text: "adicionar Spotify 22 em ASSINATURAS" });
    expect(followUp("Disney 40 também", MEM)).toEqual({ kind: "text", text: "adicionar Disney 40 em ASSINATURAS" });
    expect(followUp("e a padaria 30", { item: "mercado", group: null, last: "spend" })).toEqual({ kind: "text", text: "gastei padaria 30" });
    expect(followUp("adicionar HBO 35 no mesmo grupo", MEM)).toEqual({ kind: "text", text: "adicionar HBO 35 em ASSINATURAS" });
    expect(followUp("gastei 50 nele", MEM)).toEqual({ kind: "text", text: "gastei 50 em Netflix" });
    expect(followUp("quanto sobra?", MEM)).toBeNull();
  });

  it("as frases reescritas o Gênio entende", () => {
    const groups = ["ASSINATURAS"];
    expect(parseGenie("adicionar Spotify 22 em ASSINATURAS", groups, 14)).toMatchObject({ kind: "addItems", group: "ASSINATURAS" });
    expect(parseGenie("gastei padaria 30", groups, 14)).toMatchObject({ kind: "spend", name: "padaria", value: 30 });
    expect(parseGenie("gastei 50 em Netflix", groups, 14)).toMatchObject({ kind: "spend", name: "Netflix", value: 50 });
  });
});

describe("sugestões enquanto digita", () => {
  const names = ["Mercado", "Netflix", "Mercado Livre", "ALIMENTAÇÃO", "CASA"];
  it("começo do pedido e nomes", () => {
    expect(suggest("gas", names).map((s) => s.value)).toEqual(["gastei "]);
    expect(suggest("gastei 50 no mer", names)).toEqual([
      { label: "Mercado", value: "gastei 50 no Mercado " },
      { label: "Mercado Livre", value: "gastei 50 no Mercado Livre " },
    ]);
    expect(suggest("adicionar Uber 40 em ali", names)[0]).toEqual({ label: "ALIMENTAÇÃO", value: "adicionar Uber 40 em ALIMENTAÇÃO " });
    expect(suggest("gastei 50", names)).toEqual([]);
    expect(suggest("", names)).toEqual([]);
  });
});

describe("erros de digitação", () => {
  it("distância e semelhança", () => {
    expect(distance("grpo", "grupo")).toBe(1);
    expect(distance("cirar", "criar")).toBe(1);
    expect(similar("mercdo", "mercado")).toBe(true);
    expect(similar("casa", "cama")).toBe(true);
    expect(similar("uber", "luz")).toBe(false);
  });

  it("corrige só os comandos do começo", () => {
    expect(fixTypos("adcionar netflix 55")).toBe("adicionar netflix 55");
    expect(fixTypos("cirar grpo lazer")).toBe("criar grupo lazer");
    expect(fixTypos("adicionar sobre 5")).toBe("adicionar sobre 5");
  });

  it("pedidos com erro funcionam", () => {
    const groups = ["ALIMENTAÇÃO", "CASA"];
    expect(parseGenie("adcionar Netflix 55 em casa", groups, 14)).toMatchObject({ kind: "addItems", group: "casa" });
    expect(parseGenie("criar grpo Lazer", groups, 14)).toEqual({ kind: "createGroups", names: ["Lazer"] });
    expect(parseGenie("gatei 50 no mercado", groups, 14)).toMatchObject({ kind: "spend", value: 50 });
    expect(parseGenie("novo gurpo", groups, 14)).toEqual({ kind: "createGroups", names: [] });
    const items: PlanItem[] = [{ id: "m", name: "Mercado", groupId: "g", type: "variavel", planned: 900, actual: 0 }];
    expect(findItem("mercdo", items)?.id).toBe("m");
  });
});
