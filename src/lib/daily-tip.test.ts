import { describe, expect, it } from "vitest";
import { DAILY_TIPS, tipOfTheDay } from "./daily-tip";

describe("tipOfTheDay", () => {
  it("é a mesma dica durante o mesmo dia", () => {
    const manha = new Date(2026, 10, 17, 7, 0);
    const noite = new Date(2026, 10, 17, 23, 59);
    expect(tipOfTheDay(manha)).toBe(tipOfTheDay(noite));
  });

  it("muda de um dia para o outro", () => {
    const hoje = new Date(2026, 10, 17);
    const amanha = new Date(2026, 10, 18);
    expect(tipOfTheDay(hoje)).not.toBe(tipOfTheDay(amanha));
  });

  it("percorre a lista toda sem repetir até dar a volta", () => {
    const vistas = new Set<string>();
    for (let i = 0; i < DAILY_TIPS.length; i++) {
      vistas.add(tipOfTheDay(new Date(2026, 0, 1 + i)));
    }
    expect(vistas.size).toBe(DAILY_TIPS.length);
  });

  it("não tem dicas repetidas nem vazias", () => {
    expect(new Set(DAILY_TIPS).size).toBe(DAILY_TIPS.length);
    expect(DAILY_TIPS.every((t) => t.trim().length > 0)).toBe(true);
  });
});
