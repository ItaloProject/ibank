import { describe, expect, it } from "vitest";
import { dataDeExclusao, diasDeTesteRestantes, fimDoTeste, prazoDeGuardaVencido, RETENCAO_DIAS, TESTE_HORAS, testeAtivo } from "./trial";

describe("teste grátis de 3 dias", () => {
  const agora = new Date("2026-11-16T12:00:00Z");

  it("termina 72 horas depois do cadastro", () => {
    expect(fimDoTeste(agora).toISOString()).toBe("2026-11-19T12:00:00.000Z");
    expect(TESTE_HORAS).toBe(72);
  });

  it("vale até o instante do fim, e não depois", () => {
    const fim = fimDoTeste(agora);
    expect(testeAtivo(fim, agora)).toBe(true);
    expect(testeAtivo(fim, new Date(fim.getTime() - 1))).toBe(true);
    expect(testeAtivo(fim, fim)).toBe(false);
    expect(testeAtivo(fim, new Date(fim.getTime() + 1000))).toBe(false);
  });

  it("sem data de fim, não há teste", () => {
    expect(testeAtivo(null, agora)).toBe(false);
    expect(testeAtivo(undefined, agora)).toBe(false);
    expect(testeAtivo("lixo", agora)).toBe(false);
  });

  it("conta os dias que faltam arredondando para cima", () => {
    const fim = fimDoTeste(agora);
    expect(diasDeTesteRestantes(fim, agora)).toBe(3);
    expect(diasDeTesteRestantes(fim, new Date(agora.getTime() + 25 * 3600 * 1000))).toBe(2);
    expect(diasDeTesteRestantes(fim, new Date(fim.getTime() - 3600 * 1000))).toBe(1);
    expect(diasDeTesteRestantes(fim, fim)).toBe(0);
  });
});

describe("guarda dos dados depois do teste", () => {
  const fim = new Date("2026-11-19T12:00:00Z");

  it("apaga 10 dias depois do fim do teste", () => {
    expect(RETENCAO_DIAS).toBe(10);
    expect(dataDeExclusao(fim)?.toISOString()).toBe("2026-11-29T12:00:00.000Z");
    expect(dataDeExclusao(null)).toBeNull();
    expect(dataDeExclusao("lixo")).toBeNull();
  });

  it("o prazo só vence no instante certo", () => {
    expect(prazoDeGuardaVencido(fim, new Date("2026-11-29T11:59:59Z"))).toBe(false);
    expect(prazoDeGuardaVencido(fim, new Date("2026-11-29T12:00:00Z"))).toBe(true);
    expect(prazoDeGuardaVencido(null)).toBe(false);
  });
});
