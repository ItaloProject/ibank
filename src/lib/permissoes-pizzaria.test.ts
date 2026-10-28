import { describe, expect, it } from "vitest";
import { pizzariasDoAcesso } from "@/lib/permissoes-pizzaria";

describe("pizzariasDoAcesso", () => {
  it("admin global vê todas as pizzarias", () => {
    expect(pizzariasDoAcesso([{ papel: "admin", pizzaria_slug: null }])).toBe("todas");
  });

  it("dono vê só a pizzaria liberada", () => {
    expect(pizzariasDoAcesso([{ papel: "dono", pizzaria_slug: "bella-massa" }])).toEqual(["bella-massa"]);
  });

  it("sem nenhuma linha, não vê nenhuma pizzaria", () => {
    expect(pizzariasDoAcesso([])).toEqual([]);
  });

  it("dono sem pizzaria não libera nada", () => {
    expect(pizzariasDoAcesso([{ papel: "dono", pizzaria_slug: null }])).toEqual([]);
  });
});
