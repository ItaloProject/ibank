import { describe, expect, it } from "vitest";
import { normalizarEmail } from "@/lib/email-usuario";

describe("normalizarEmail", () => {
  it("aceita e deixa em minúsculas", () => {
    expect(normalizarEmail("  Garcom@Exemplo.com ")).toBe("garcom@exemplo.com");
  });

  it("vazio vira null (remover o e-mail)", () => {
    expect(normalizarEmail("")).toBeNull();
    expect(normalizarEmail("   ")).toBeNull();
    expect(normalizarEmail(undefined)).toBeNull();
  });

  it("recusa formato inválido", () => {
    expect(normalizarEmail("sem-arroba")).toBe(false);
    expect(normalizarEmail("a@b")).toBe(false);
    expect(normalizarEmail("a b@c.com")).toBe(false);
  });
});
