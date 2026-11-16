import { describe, expect, it } from "vitest";
import { tokenPrecisaRenovar, VALIDADE_TOKEN_SEG } from "./token-renovacao";

describe("renovação do token de sessão", () => {
  const agora = new Date("2026-11-16T12:00:00Z").getTime();
  const iat = (horasAtras: number) => Math.floor(agora / 1000) - horasAtras * 3600;

  it("não renova um token de poucas horas", () => {
    expect(tokenPrecisaRenovar(iat(2), agora)).toBe(false);
    expect(tokenPrecisaRenovar(iat(23), agora)).toBe(false);
  });

  it("renova depois de um dia", () => {
    expect(tokenPrecisaRenovar(iat(25), agora)).toBe(true);
    expect(tokenPrecisaRenovar(iat(24 * 5), agora)).toBe(true);
  });

  it("token antigo, sem data de emissão, é renovado uma vez", () => {
    expect(tokenPrecisaRenovar(undefined, agora)).toBe(true);
  });

  it("a validade continua sendo 7 dias", () => {
    expect(VALIDADE_TOKEN_SEG).toBe(604800);
  });
});
