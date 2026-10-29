import { describe, expect, it } from "vitest";
import { papelNaPizzaria, pizzariasDoAcesso } from "@/lib/permissoes-pizzaria";

describe("pizzariasDoAcesso", () => {
  it("admin global vê todas as pizzarias", () => {
    expect(pizzariasDoAcesso([{ papel: "admin", pizzaria_slug: null }])).toBe("todas");
  });

  it("dono e garçom veem só a pizzaria liberada", () => {
    expect(pizzariasDoAcesso([{ papel: "dono", pizzaria_slug: "bella-massa" }])).toEqual(["bella-massa"]);
    expect(pizzariasDoAcesso([{ papel: "garcom", pizzaria_slug: "bella-massa" }])).toEqual(["bella-massa"]);
  });

  it("sem linha, não vê nenhuma pizzaria", () => {
    expect(pizzariasDoAcesso([])).toEqual([]);
  });
});

describe("papelNaPizzaria", () => {
  it("admin global vale em qualquer pizzaria", () => {
    expect(papelNaPizzaria([{ papel: "admin", pizzaria_slug: null }], "bella-massa")).toBe("admin");
  });

  it("devolve o papel da pizzaria certa e ignora as outras", () => {
    const linhas = [
      { papel: "garcom", pizzaria_slug: "bella-massa" },
      { papel: "dono", pizzaria_slug: "pizzaria-teste" },
    ];
    expect(papelNaPizzaria(linhas, "bella-massa")).toBe("garcom");
    expect(papelNaPizzaria(linhas, "pizzaria-teste")).toBe("dono");
    expect(papelNaPizzaria(linhas, "outra")).toBeNull();
  });
});
