import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ default: vi.fn() }));

import { describeDevice, isSessionAlive, sessionMatches } from "@/lib/session";

describe("sessionMatches", () => {
  it("aceita qualquer token quando o banco não tem sessão registrada", () => {
    expect(sessionMatches(null, undefined)).toBe(true);
    expect(sessionMatches(null, "abc")).toBe(true);
  });

  it("aceita só o token da sessão ativa", () => {
    expect(sessionMatches("abc", "abc")).toBe(true);
    expect(sessionMatches("abc", "outra")).toBe(false);
  });

  it("derruba token antigo, sem sid, quando já existe uma sessão registrada", () => {
    expect(sessionMatches("abc", undefined)).toBe(false);
  });
});

describe("isSessionAlive", () => {
  it("considera viva uma sessão iniciada há pouco", () => {
    expect(isSessionAlive(new Date().toISOString())).toBe(true);
  });

  it("considera expirada uma sessão com mais de 7 dias", () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isSessionAlive(old)).toBe(false);
  });

  it("trata ausência de data como sem sessão", () => {
    expect(isSessionAlive(null)).toBe(false);
  });
});

describe("describeDevice", () => {
  it("identifica Chrome no Windows", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
    expect(describeDevice(ua)).toBe("Chrome em Windows");
  });

  it("identifica Safari no iPhone", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(describeDevice(ua)).toBe("Safari em iPhone/iPad");
  });

  it("identifica Chrome no Android", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
    expect(describeDevice(ua)).toBe("Chrome em Android");
  });

  it("usa texto genérico sem user-agent", () => {
    expect(describeDevice(null)).toBe("Navegador em outro aparelho");
  });
});
