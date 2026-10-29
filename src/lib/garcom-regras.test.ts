import { describe, expect, it } from "vitest";
import { loginGarcomValido, nomeGarcomValido, senhaGarcomValida } from "@/lib/garcom-regras";

describe("loginGarcomValido", () => {
  it("aceita e deixa em minúsculas", () => {
    expect(loginGarcomValido(" Joao.Silva ")).toBe("joao.silva");
    expect(loginGarcom("ab")).toBeNull();
  });

  it("recusa espaços, acentos e tamanho fora da faixa", () => {
    expect(loginGarcomValido("joao silva")).toBeNull();
    expect(loginGarcomValido("joão")).toBeNull();
    expect(loginGarcomValido("x".repeat(31))).toBeNull();
    expect(loginGarcomValido(42)).toBeNull();
  });
});

describe("senhaGarcomValida", () => {
  it("exige entre 6 e 72 caracteres", () => {
    expect(senhaGarcomValida("123456")).toBe(true);
    expect(senhaGarcomValida("12345")).toBe(false);
    expect(senhaGarcomValida("x".repeat(73))).toBe(false);
  });
});

describe("nomeGarcomValido", () => {
  it("tira espaços e recusa vazio", () => {
    expect(nomeGarcomValido("  Ana ")).toBe("Ana");
    expect(nomeGarcomValido("   ")).toBeNull();
  });
});

function loginGarcom(valor: string) {
  return loginGarcomValido(valor);
}
