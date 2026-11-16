import { describe, expect, it } from "vitest";
import {
  BLOQUEIO_MIN,
  chavesDeLogin,
  chaveTrocaSenha,
  LIMITE_POR_IP,
  LIMITE_POR_USUARIO,
  mensagemBloqueio,
  segundosRestantes,
} from "./login-limit";

describe("limite de tentativas de entrada", () => {
  it("a chave do usuário ignora maiúsculas e espaços", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4" });
    expect(chavesDeLogin("  Italo ", h)[0].chave).toBe(chavesDeLogin("italo", h)[0].chave);
  });

  it("usuário e origem têm limites diferentes e a chave não guarda o texto original", () => {
    const [usuario, ip] = chavesDeLogin("italo", new Headers({ "x-forwarded-for": "9.9.9.9" }));
    expect(usuario.limite).toBe(LIMITE_POR_USUARIO);
    expect(ip.limite).toBe(LIMITE_POR_IP);
    expect(usuario.chave).not.toContain("italo");
    expect(ip.chave).not.toContain("9.9.9.9");
  });

  it("origens diferentes geram chaves diferentes", () => {
    const a = chavesDeLogin("italo", new Headers({ "x-forwarded-for": "1.1.1.1" }))[1].chave;
    const b = chavesDeLogin("italo", new Headers({ "x-forwarded-for": "2.2.2.2" }))[1].chave;
    expect(a).not.toBe(b);
  });

  it("a troca de senha tem a própria chave", () => {
    expect(chaveTrocaSenha("italo").chave.startsWith("pw:")).toBe(true);
  });

  it("conta os segundos que faltam, sem passar de zero", () => {
    const agora = new Date("2026-11-16T12:00:00Z");
    expect(segundosRestantes(null, agora)).toBe(0);
    expect(segundosRestantes(new Date("2026-11-16T11:59:00Z"), agora)).toBe(0);
    expect(segundosRestantes(new Date("2026-11-16T12:05:00Z"), agora)).toBe(300);
  });

  it("a mensagem fala em minutos, no singular quando é um", () => {
    expect(mensagemBloqueio(20)).toBe("Muitas tentativas. Tente de novo em 1 minuto.");
    expect(mensagemBloqueio(BLOQUEIO_MIN * 60)).toBe("Muitas tentativas. Tente de novo em 15 minutos.");
  });
});
