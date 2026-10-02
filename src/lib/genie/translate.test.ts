import { describe, expect, it } from "vitest";
import { parseGenie } from "./parse";
import { guessIntent } from "./translate";

const GROUPS = ["ALIMENTAÇÃO", "CASA", "VEÍCULO", "LAZER"];
const p = (s: string) => parseGenie(s, GROUPS, 14);

describe("gírias e jeitos de falar", () => {
  it("dinheiro em gíria", () => {
    expect(p("bota aí 50 conto do lanche")).toMatchObject({ kind: "addItems", items: [{ name: "Lanche", value: 50 }] });
    expect(p("torrei 80 pila no ifood")).toEqual({ kind: "spend", name: "ifood", value: 80, group: null });
    expect(p("gastei 2 barão no conserto do carro")).toMatchObject({ kind: "spend", value: 2000 });
  });

  it("gastos", () => {
    expect(p("anota aí que gastei 30 na padaria")).toMatchObject({ kind: "spend", name: "padaria", value: 30 });
    expect(p("registra um gasto de 45 no uber")).toMatchObject({ kind: "spend", name: "uber", value: 45 });
    expect(p("saiu 120 no mercado")).toMatchObject({ kind: "spend", name: "mercado", value: 120 });
    expect(p("dei 40 no lava jato")).toMatchObject({ kind: "spend", name: "lava jato", value: 40 });
    expect(p("marca a luz como paga")).toEqual({ kind: "spend", name: "luz", value: null, group: null });
    expect(p("a internet já tá paga")).toMatchObject({ kind: "spend", name: "internet", value: null });
  });

  it("renda", () => {
    expect(p("caiu o salário de 5 mil")).toEqual({ kind: "addIncome", description: "Salário", value: 5000 });
    expect(p("me pagaram 800 do freela")).toEqual({ kind: "addIncome", description: "Freela", value: 800 });
    expect(p("registra uma entrada de 300")).toMatchObject({ kind: "addIncome", value: 300 });
  });

  it("grupos, apagar e valor planejado", () => {
    expect(p("abre uma pasta pra viagem")).toEqual({ kind: "createGroups", names: ["viagem"] });
    expect(p("joga fora a netflix")).toEqual({ kind: "remove", target: "netflix", what: null });
    expect(p("o limite do mercado é 800")).toMatchObject({ kind: "setPlanned", value: 800 });
    expect(p("quero gastar no máximo 300 com lazer")).toMatchObject({ kind: "setPlanned", value: 300 });
    expect(p("netflix subiu pra 60")).toMatchObject({ kind: "setPlanned", name: "Netflix", value: 60 });
  });

  it("consultas", () => {
    expect(p("tô no vermelho?")).toMatchObject({ kind: "query", topic: "sobra" });
    expect(p("quanto ainda tenho livre")).toMatchObject({ kind: "query", topic: "sobra" });
    expect(p("quanto dá pra gastar hoje")).toMatchObject({ kind: "query", topic: "dia" });
    expect(p("como estão minhas finanças")).toMatchObject({ kind: "query", topic: "resumo" });
  });
});

describe("leitura por semelhança", () => {
  it("adivinha o tipo de pedido", () => {
    expect(guessIntent("uma comprinha de 35 na farmacia")).toBe("spend");
    expect(guessIntent("vale a pena trocar de plano de celular")).toBeNull();
  });

  it("monta o pedido com o que sobrou da frase", () => {
    expect(p("uma comprinha de 35 na farmácia")).toMatchObject({ kind: "spend", name: "farmácia", value: 35 });
    expect(p("pix recebido 250 do joão")).toMatchObject({ kind: "addIncome", value: 250 });
    expect(p("onde mais gasto dinheiro")).toMatchObject({ kind: "query", topic: "maiores" });
  });
});
