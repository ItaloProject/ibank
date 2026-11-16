import { beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { idsDeClienteGoogle, usuarioInternoDe, verificarIdTokenGoogle } from "./google-auth";

const CLIENT_ID = "123-abc.apps.googleusercontent.com";

let privada: CryptoKey;
let chaves: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const par = await generateKeyPair("RS256");
  privada = par.privateKey;
  const jwk: JWK = { ...(await exportJWK(par.publicKey)), alg: "RS256", use: "sig", kid: "k1" };
  chaves = createLocalJWKSet({ keys: [jwk] });
});

async function assinar(
  extra: Record<string, unknown> = {},
  opcoes: { aud?: string; iss?: string; exp?: string | number } = {},
) {
  return new SignJWT({
    sub: "109876543210",
    email: "Pessoa@Gmail.com",
    email_verified: true,
    name: "Pessoa Teste",
    ...extra,
  })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opcoes.iss ?? "https://accounts.google.com")
    .setAudience(opcoes.aud ?? CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime(opcoes.exp ?? "1h")
    .sign(privada);
}

describe("verificação do ID token do Google", () => {
  it("aceita um token válido e normaliza o e-mail", async () => {
    const perfil = await verificarIdTokenGoogle(await assinar(), [CLIENT_ID], chaves);
    expect(perfil).toEqual({ sub: "109876543210", email: "pessoa@gmail.com", nome: "Pessoa Teste" });
  });

  it("aceita email_verified como texto", async () => {
    const perfil = await verificarIdTokenGoogle(await assinar({ email_verified: "true" }), [CLIENT_ID], chaves);
    expect(perfil?.email).toBe("pessoa@gmail.com");
  });

  it("recusa token feito para outro aplicativo", async () => {
    const token = await assinar({}, { aud: "outro-app.apps.googleusercontent.com" });
    expect(await verificarIdTokenGoogle(token, [CLIENT_ID], chaves)).toBeNull();
  });

  it("aceita qualquer um dos IDs configurados (web e Android)", async () => {
    const token = await assinar({}, { aud: "android-id" });
    expect(await verificarIdTokenGoogle(token, [CLIENT_ID, "android-id"], chaves)).not.toBeNull();
  });

  it("recusa emissor diferente do Google", async () => {
    const token = await assinar({}, { iss: "https://evil.example.com" });
    expect(await verificarIdTokenGoogle(token, [CLIENT_ID], chaves)).toBeNull();
  });

  it("recusa token vencido", async () => {
    const token = await assinar({}, { exp: Math.floor(Date.now() / 1000) - 3600 });
    expect(await verificarIdTokenGoogle(token, [CLIENT_ID], chaves)).toBeNull();
  });

  it("recusa e-mail não verificado", async () => {
    expect(await verificarIdTokenGoogle(await assinar({ email_verified: false }), [CLIENT_ID], chaves)).toBeNull();
  });

  it("recusa token assinado por outra chave", async () => {
    const outra = await generateKeyPair("RS256");
    const falso = await new SignJWT({ sub: "1", email: "a@b.co", email_verified: true })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer("https://accounts.google.com")
      .setAudience(CLIENT_ID)
      .setExpirationTime("1h")
      .sign(outra.privateKey);
    expect(await verificarIdTokenGoogle(falso, [CLIENT_ID], chaves)).toBeNull();
  });

  it("recusa lixo e configuração vazia", async () => {
    expect(await verificarIdTokenGoogle("isso-nao-e-um-token", [CLIENT_ID], chaves)).toBeNull();
    expect(await verificarIdTokenGoogle(await assinar(), [], chaves)).toBeNull();
    expect(await verificarIdTokenGoogle("", [CLIENT_ID], chaves)).toBeNull();
  });
});

describe("configuração e nome interno", () => {
  it("lê os IDs de cliente separados por vírgula", () => {
    expect(idsDeClienteGoogle(" a , b ,, c ")).toEqual(["a", "b", "c"]);
    expect(idsDeClienteGoogle(undefined)).toEqual([]);
    expect(idsDeClienteGoogle("")).toEqual([]);
  });

  it("monta o nome interno só com letras e números", () => {
    expect(usuarioInternoDe("Maria.Silva+x@gmail.com", "ab12cd")).toBe("mariasilvax-ab12cd");
    expect(usuarioInternoDe("___@x.com", "ab12cd")).toBe("usuario-ab12cd");
  });
});
