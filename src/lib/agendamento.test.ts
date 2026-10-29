import { describe, expect, it } from "vitest";
import { validarAgendamento } from "@/lib/agendamento";
import type { Horario } from "@/lib/horario-loja";

const todosOsDias: Horario[] = [{ dias: [0, 1, 2, 3, 4, 5, 6], abre: "18:00", fecha: "23:00" }];
const agora = new Date("2026-10-28T17:00:00-03:00");

describe("validarAgendamento", () => {
  it("aceita um horário aberto, com antecedência e no intervalo de 30 minutos", () => {
    expect(validarAgendamento(agora, new Date("2026-10-28T19:30:00-03:00"), todosOsDias, [])).toBeNull();
  });

  it("recusa horário com menos de 30 minutos de antecedência", () => {
    expect(validarAgendamento(agora, new Date("2026-10-28T17:20:00-03:00"), todosOsDias, [])).toContain("antecedência");
  });

  it("recusa mais de 7 dias à frente", () => {
    expect(validarAgendamento(agora, new Date("2026-11-05T19:00:00-03:00"), todosOsDias, [])).toContain("7 dias");
  });

  it("recusa horário fora do intervalo de 30 minutos", () => {
    expect(validarAgendamento(agora, new Date("2026-10-28T19:10:00-03:00"), todosOsDias, [])).toContain("30 em 30");
  });

  it("recusa horário com a loja fechada", () => {
    expect(validarAgendamento(agora, new Date("2026-10-28T23:30:00-03:00"), todosOsDias, [])).toContain("fechada");
  });

  it("recusa data não válida", () => {
    expect(validarAgendamento(agora, new Date("nao-e-data"), todosOsDias, [])).toContain("inválido");
  });
});
