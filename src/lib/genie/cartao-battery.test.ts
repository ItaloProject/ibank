import { describe, expect, it } from "vitest";
import { findGroup, parseGenie } from "./parse";

/** Grupos reais do planejamento do Italo. */
const G = ["PAGAMENTO", "CARTAO", "VIAGEM", "MAE"];
const p = (s: string) => parseGenie(s, G, 14.9);

describe("Gênio: vários itens no cartão", () => {
  it("adiciona um item no CARTAO de jeitos diferentes", () => {
    // "cartão" com acento vem literal; findGroup resolve para CARTAO na aplicação
    expect(p("adicionar Netflix 55 no cartão")).toMatchObject({
      kind: "addItems",
      group: "cartão",
      items: [{ name: "Netflix", value: 55 }],
    });
    expect(p("coloca no CARTAO spotify 21,90")).toMatchObject({
      kind: "addItems",
      group: "CARTAO",
      items: [{ name: "Spotify", value: 21.9 }],
    });
    expect(p("netflix 20,90 em cartao")).toMatchObject({
      kind: "addItems",
      group: "cartao",
      items: [{ name: "Netflix", value: 20.9 }],
    });
  });

  it("adiciona vários itens de uma vez no cartão", () => {
    expect(p("adicionar no cartão youtube 21,90, totalpass 69,90 e ifood 7,95")).toMatchObject({
      kind: "addItems",
      group: "cartão",
      items: [
        { name: "Youtube", value: 21.9 },
        { name: "Totalpass", value: 69.9 },
        { name: "Ifood", value: 7.95 },
      ],
    });
    expect(p("coloca no CARTAO: disney 27,90 e hbo 34,90")).toMatchObject({
      kind: "addItems",
      group: "CARTAO",
      items: [
        { name: "Disney", value: 27.9 },
        { name: "Hbo", value: 34.9 },
      ],
    });
  });

  it("foca no cartão e lança como real", () => {
    expect(p("considerar próximos itens no cartão")).toMatchObject({ kind: "focus", group: "CARTAO" });
    expect(p("adicionar no cartão uber 45 como gasto real")).toMatchObject({
      kind: "addItems",
      paid: true,
      items: [{ name: "Uber", value: 45 }],
    });
  });

  it("findGroup liga cartão com acento ao CARTAO real", () => {
    expect(findGroup("cartão", G)).toBe("CARTAO");
    expect(findGroup("cartao", G)).toBe("CARTAO");
    expect(findGroup("CARTAO", G)).toBe("CARTAO");
  });

  it("resolve conta no valor do item do cartão", () => {
    expect(p("adicionar no cartão railway 1,19 + 34,01")).toMatchObject({
      kind: "addItems",
      items: [{ name: "Railway", value: 35.2 }],
    });
  });
});
