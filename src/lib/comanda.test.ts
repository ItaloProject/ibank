import { describe, expect, it } from "vitest";
import { mesaValida, totalComanda } from "@/lib/comanda";

describe("mesaValida", () => {
  it("aceita nome curto e tira espaços das pontas", () => {
    expect(mesaValida("  7 ")).toBe("7");
    expect(mesaValida("Varanda 2")).toBe("Varanda 2");
  });

  it("recusa vazio, nome longo e tipo errado", () => {
    expect(mesaValida("   ")).toBeNull();
    expect(mesaValida("x".repeat(21))).toBeNull();
    expect(mesaValida(7)).toBeNull();
    expect(mesaValida(undefined)).toBeNull();
  });
});

describe("totalComanda", () => {
  it("soma as rodadas e ignora as canceladas", () => {
    expect(
      totalComanda([
        { total: 54, status: "recebido" },
        { total: "32.50", status: "concluido" },
        { total: 40, status: "cancelado" },
      ]),
    ).toBe(86.5);
  });

  it("comanda sem rodadas vale zero", () => {
    expect(totalComanda([])).toBe(0);
  });
});
