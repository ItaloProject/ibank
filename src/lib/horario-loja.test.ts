import { describe, expect, it } from "vitest";
import { estaAberto, type Horario } from "@/lib/horario-loja";

// Seg a dom, 18:00 às 23:00. Brasília é UTC-3 (sem horário de verão desde 2019).
const noite: Horario[] = [{ dias: [0, 1, 2, 3, 4, 5, 6], abre: "18:00", fecha: "23:00" }];
const brasilia = (dataIso: string) => new Date(dataIso);

describe("estaAberto", () => {
  it("abre no horário e fecha na hora de fechar", () => {
    expect(estaAberto(noite, [], brasilia("2026-10-28T20:59:00-03:00"))).toBe(true); // quarta 20:59
    expect(estaAberto(noite, [], brasilia("2026-10-28T17:59:00-03:00"))).toBe(false);
    expect(estaAberto(noite, [], brasilia("2026-10-28T18:00:00-03:00"))).toBe(true);
    expect(estaAberto(noite, [], brasilia("2026-10-28T23:00:00-03:00"))).toBe(false);
  });

  it("horário que passa da meia-noite", () => {
    const madrugada: Horario[] = [{ dias: [5], abre: "18:00", fecha: "02:00" }];
    expect(estaAberto(madrugada, [], brasilia("2026-10-31T01:30:00-03:00"))).toBe(true); // sábado 01:30
    expect(estaAberto(madrugada, [], brasilia("2026-10-31T02:30:00-03:00"))).toBe(false);
    expect(estaAberto(madrugada, [], brasilia("2026-11-01T01:00:00-03:00"))).toBe(false); // domingo não abre
  });

  it("sem horário cadastrado, a loja está sempre aberta", () => {
    expect(estaAberto([], [], brasilia("2026-10-28T03:00:00-03:00"))).toBe(true);
    expect(estaAberto(undefined, undefined, brasilia("2026-10-28T03:00:00-03:00"))).toBe(true);
  });

  it("data especial fechada fecha o dia", () => {
    const feriado = [{ data: "2026-10-28", fechado: true, motivo: "Manutenção" }];
    expect(estaAberto(noite, feriado, brasilia("2026-10-28T20:00:00-03:00"))).toBe(false);
    expect(estaAberto(noite, feriado, brasilia("2026-10-29T20:00:00-03:00"))).toBe(true);
  });

  it("data especial com horário próprio substitui o horário do dia", () => {
    const tarde = [{ data: "2026-10-28", abre: "12:00", fecha: "15:00" }];
    expect(estaAberto(noite, tarde, brasilia("2026-10-28T13:00:00-03:00"))).toBe(true);
    expect(estaAberto(noite, tarde, brasilia("2026-10-28T20:00:00-03:00"))).toBe(false);
  });
});
