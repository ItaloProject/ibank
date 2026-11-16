import { describe, expect, it } from "vitest";
import { segundosAteReiniciar } from "./rate-limit";

describe("limite por janela de tempo", () => {
  const inicio = new Date("2026-11-16T12:00:00Z");

  it("conta os segundos que faltam para a janela reiniciar", () => {
    expect(segundosAteReiniciar(inicio, 60, new Date("2026-11-16T12:00:10Z"))).toBe(50);
    expect(segundosAteReiniciar(inicio, 60, new Date("2026-11-16T12:00:59.5Z"))).toBe(1);
  });

  it("nunca devolve menos de 1 segundo", () => {
    expect(segundosAteReiniciar(inicio, 60, new Date("2026-11-16T12:05:00Z"))).toBe(1);
  });
});
