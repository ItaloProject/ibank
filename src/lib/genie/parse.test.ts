import { describe, expect, it } from "vitest";
import { evaluate, parseNumber } from "./calc";
import { parseGenie } from "./parse";

const GROUPS = ["VEÍCULO", "PAGAMENTO", "ALIMENTAÇÃO", "CASA"];
const p = (s: string) => parseGenie(s, GROUPS, 14.9);

describe("calculadora", () => {
  it("números no formato brasileiro", () => {
    expect(parseNumber("1.500,50")).toBe(1500.5);
    expect(parseNumber("2.000")).toBe(2000);
    expect(parseNumber("R$ 35")).toBe(35);
    expect(parseNumber("5k")).toBe(5000);
    expect(parseNumber("2 mil")).toBe(2000);
  });

  it("contas, porcentagem e operações por extenso", () => {
    expect(evaluate("1500*12")).toBe(18000);
    expect(evaluate("15% de 3000")).toBe(450);
    expect(evaluate("3000 + 10%")).toBe(3300);
    expect(evaluate("3000 - 10%")).toBe(2700);
    expect(evaluate("(1.500,50 + 500) x 2")).toBe(4001);
    expect(evaluate("200 dividido por 4")).toBe(50);
    expect(evaluate("2 ^ 10")).toBe(1024);
    expect(evaluate("10 / 0")).toBeNull();
    expect(p("quanto é 20% de 5.035?")).toEqual({ kind: "calc", expr: "20% de 5.035", value: 1007 });
    expect(p("1200 em 12x")).toMatchObject({ kind: "calc", value: 100 });
    expect(p("200 com 15% de desconto")).toMatchObject({ kind: "calc", value: 170 });
  });
});

describe("pedidos ao planejamento", () => {
  it("adiciona itens com valor e grupo, mantendo acentos", () => {
    expect(p("adicionar Netflix 55 e Spotify 21,90 em Assinaturas")).toEqual({
      kind: "addItems",
      group: "Assinaturas",
      items: [{ name: "Netflix", value: 55, type: null }, { name: "Spotify", value: 21.9, type: null }],
    });
    expect(p("coloca pão de açúcar 300 na alimentação")).toEqual({
      kind: "addItems",
      group: "alimentação",
      items: [{ name: "Pão de açúcar", value: 300, type: null }],
    });
    expect(p("adiciona aluguel fixo 1.800 em casa")).toMatchObject({ kind: "addItems", items: [{ name: "Aluguel", value: 1800, type: "fixo" }] });
    expect(p('Adicionar ao grupo de pagamento 98,95 referente a "Noroeste"')).toEqual({
      kind: "addItems",
      group: "pagamento",
      items: [{ name: "Noroeste", value: 98.95, type: null }],
    });
    expect(p("coloca no grupo casa aluguel 1800 e luz 200")).toMatchObject({
      group: "casa",
      items: [{ name: "Aluguel", value: 1800 }, { name: "Luz", value: 200 }],
    });
    expect(p("adicionar em Viagem: hotel 900, passagem 1.200")).toMatchObject({
      group: "Viagem",
      items: [{ name: "Hotel", value: 900 }, { name: "Passagem", value: 1200 }],
    });
    expect(p("adiciona academia: 120 na casa")).toMatchObject({ group: "casa", items: [{ name: "Academia", value: 120 }] });
    expect(p("lançar 40 de lava jato")).toMatchObject({ kind: "addItems", group: null, items: [{ name: "Lava jato", value: 40 }] });
  });

  it("gasto real e marcar como pago", () => {
    expect(p("gastei 50 no mercado")).toEqual({ kind: "spend", name: "mercado", value: 50, group: null });
    expect(p("paguei a moto")).toEqual({ kind: "spend", name: "moto", value: null, group: null });
  });

  it("grupos e renda", () => {
    expect(p("criar grupo Lazer e Saúde")).toEqual({ kind: "createGroups", names: ["Lazer", "Saúde"] });
    expect(p("novo grupo assinaturas")).toEqual({ kind: "createGroups", names: ["assinaturas"] });
    expect(p("recebi 800 de freela")).toEqual({ kind: "addIncome", description: "Freela", value: 800 });
  });

  it("consultas e simulações", () => {
    expect(p("quanto sobra?")).toMatchObject({ kind: "query", topic: "sobra" });
    expect(p("quanto posso gastar por dia")).toMatchObject({ kind: "query", topic: "dia" });
    expect(p("quanto gastei em pagamento")).toEqual({ kind: "query", topic: "gasto", target: "pagamento" });
    expect(p("se eu cortar 20% dos variáveis?")).toEqual({ kind: "cut", pct: 20, value: null, target: "variaveis" });
    expect(p("quanto preciso guardar para juntar 10 mil em 12 meses")).toEqual({ kind: "save", total: 10000, months: 12, monthly: null });
    expect(p("em quantos meses consigo juntar 6000 guardando 500")).toEqual({ kind: "save", total: 6000, months: null, monthly: 500 });
  });

  it("juros compostos e financiamento", () => {
    const c = p("investindo 500 por mês a 1% ao mês por 12 meses");
    expect(c).toMatchObject({ kind: "compound", monthly: 500, initial: 0, months: 12 });
    expect(p("quanto rende 10000 a 100% do CDI em 2 anos")).toMatchObject({ kind: "compound", initial: 10000, monthly: 0, months: 24 });
    expect(p("parcela de 10.000 em 12x a 2% ao mês")).toMatchObject({ kind: "installment", principal: 10000, parcelas: 12, rateMonth: 0.02 });
  });

  it("o resto fica para a inteligência artificial", () => {
    expect(p("vale a pena trocar de plano de celular")).toEqual({ kind: "unknown" });
  });
});
