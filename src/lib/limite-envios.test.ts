import { describe, expect, it } from "vitest";
import { extrairIp, hashIp, LIMITE_ENVIOS, JANELA_MINUTOS } from "@/lib/limite-envios";

describe("limite de envios", () => {
  it("pega o primeiro IP do x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(extrairIp(h)).toBe("203.0.113.9");
  });

  it("usa x-real-ip quando não há x-forwarded-for, e um valor genérico sem nenhum", () => {
    expect(extrairIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(extrairIp(new Headers())).toBe("desconhecido");
  });

  it("o hash é estável e não revela o IP", () => {
    expect(hashIp("203.0.113.9")).toBe(hashIp("203.0.113.9"));
    expect(hashIp("203.0.113.9")).not.toContain("203.0.113.9");
    expect(hashIp("203.0.113.9")).not.toBe(hashIp("203.0.113.10"));
  });

  it("limite razoável para uma casa com vários pedidos", () => {
    expect(LIMITE_ENVIOS).toBeGreaterThanOrEqual(5);
    expect(JANELA_MINUTOS).toBe(10);
  });
});
