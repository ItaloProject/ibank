import { beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import {
  decodificarRtdn,
  diaDoFimDoAcesso,
  hashDoToken,
  identificadorDeConta,
  interpretarAssinatura,
  planoDoProduto,
  verificarChamadaPubSub,
} from "./play-billing";

const AGORA = new Date("2026-11-16T12:00:00Z");
const FIM = "2026-12-16T12:00:00Z";

describe("produtos e identificadores", () => {
  it("mapeia os produtos vendidos e recusa os desconhecidos", () => {
    expect(planoDoProduto("muvo_assinante")).toEqual({ plano: "assinante", bot: false });
    expect(planoDoProduto("muvo_completo")).toEqual({ plano: "completo", bot: true });
    expect(planoDoProduto("outro")).toBeNull();
    expect(planoDoProduto("__proto__")).toBeNull();
  });

  it("o identificador de conta é um hash estável que não revela o usuário", () => {
    const a = identificadorDeConta("italo");
    expect(a).toBe(identificadorDeConta("italo"));
    expect(a).not.toBe(identificadorDeConta("natalia"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("italo");
  });

  it("guarda só o hash do token da compra", () => {
    expect(hashDoToken("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoToken("abc")).not.toContain("abc");
  });
});

describe("estado da assinatura", () => {
  const base = { lineItems: [{ productId: "muvo_assinante", expiryTime: FIM }], externalAccountIdentifiers: { obfuscatedExternalAccountId: "id1" } };

  it("ativa libera até o fim do período e pede confirmação se pendente", () => {
    const r = interpretarAssinatura({ ...base, subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING" }, AGORA);
    expect(r.acessoAte?.toISOString()).toBe("2026-12-16T12:00:00.000Z");
    expect(r.confirmar).toBe(true);
    expect(r.productId).toBe("muvo_assinante");
    expect(r.contaId).toBe("id1");
  });

  it("em carência e cancelada ainda dão acesso até o fim pago", () => {
    for (const estado of ["SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"]) {
      expect(interpretarAssinatura({ ...base, subscriptionState: estado }, AGORA).acessoAte).not.toBeNull();
    }
  });

  it("expirada, em espera, pausada e pendente não dão acesso", () => {
    for (const estado of ["SUBSCRIPTION_STATE_EXPIRED", "SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_PAUSED", "SUBSCRIPTION_STATE_PENDING", "SUBSCRIPTION_STATE_UNSPECIFIED"]) {
      expect(interpretarAssinatura({ ...base, subscriptionState: estado }, AGORA).acessoAte).toBeNull();
    }
  });

  it("período já vencido ou data ruim não dá acesso", () => {
    const vencida = { subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ productId: "muvo_assinante", expiryTime: "2026-11-01T00:00:00Z" }] };
    expect(interpretarAssinatura(vencida, AGORA).acessoAte).toBeNull();
    expect(interpretarAssinatura({ subscriptionState: "SUBSCRIPTION_STATE_ACTIVE", lineItems: [{ expiryTime: "lixo" }] }, AGORA).acessoAte).toBeNull();
    expect(interpretarAssinatura({}, AGORA).acessoAte).toBeNull();
  });

  it("o dia do fim usa o horário de Brasília", () => {
    expect(diaDoFimDoAcesso(new Date("2026-12-16T01:00:00Z"))).toBe("2026-12-15");
    expect(diaDoFimDoAcesso(new Date("2026-12-16T12:00:00Z"))).toBe("2026-12-16");
  });
});

describe("notificações em tempo real (RTDN)", () => {
  const empacotar = (obj: unknown) => ({ message: { data: Buffer.from(JSON.stringify(obj)).toString("base64") } });

  it("lê uma notificação de assinatura", () => {
    const corpo = empacotar({
      packageName: "com.muvo.app",
      subscriptionNotification: { purchaseToken: "tok", subscriptionId: "muvo_assinante", notificationType: 2 },
    });
    expect(decodificarRtdn(corpo, "com.muvo.app")).toEqual({ tipo: "assinatura", purchaseToken: "tok", subscriptionId: "muvo_assinante", notificationType: 2 });
  });

  it("reconhece o teste do Google, ignora o resto e recusa pacote errado ou lixo", () => {
    expect(decodificarRtdn(empacotar({ packageName: "com.muvo.app", testNotification: { version: "1.0" } }), "com.muvo.app")).toEqual({ tipo: "teste" });
    expect(decodificarRtdn(empacotar({ packageName: "com.muvo.app", oneTimeProductNotification: {} }), "com.muvo.app")).toEqual({ tipo: "ignorar" });
    expect(decodificarRtdn(empacotar({ packageName: "com.outro.app", testNotification: {} }), "com.muvo.app")).toEqual({ tipo: "invalida" });
    expect(decodificarRtdn({ message: { data: "!!!" } }, "com.muvo.app")).toEqual({ tipo: "invalida" });
    expect(decodificarRtdn(null, "com.muvo.app")).toEqual({ tipo: "invalida" });
  });
});

describe("autenticação do Pub/Sub", () => {
  const AUD = "https://ibank-rho.vercel.app/api/billing/google-play/rtdn";
  const EMAIL = "pubsub@muvo.iam.gserviceaccount.com";
  let privada: CryptoKey;
  let chaves: ReturnType<typeof createLocalJWKSet>;

  beforeAll(async () => {
    const par = await generateKeyPair("RS256");
    privada = par.privateKey;
    chaves = createLocalJWKSet({ keys: [{ ...(await exportJWK(par.publicKey)), alg: "RS256", use: "sig", kid: "k1" } as JWK] });
  });

  const assinar = (extra: Record<string, unknown> = {}, aud = AUD) =>
    new SignJWT({ email: EMAIL, email_verified: true, ...extra })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer("https://accounts.google.com")
      .setAudience(aud)
      .setExpirationTime("1h")
      .sign(privada);

  it("aceita o token certo", async () => {
    expect(await verificarChamadaPubSub(`Bearer ${await assinar()}`, { audiencia: AUD, email: EMAIL }, chaves)).toBe(true);
  });

  it("recusa outra audiência, outro e-mail, sem cabeçalho e configuração vazia", async () => {
    expect(await verificarChamadaPubSub(`Bearer ${await assinar({}, "https://outro")}`, { audiencia: AUD, email: EMAIL }, chaves)).toBe(false);
    expect(await verificarChamadaPubSub(`Bearer ${await assinar({ email: "x@y.com" })}`, { audiencia: AUD, email: EMAIL }, chaves)).toBe(false);
    expect(await verificarChamadaPubSub(null, { audiencia: AUD, email: EMAIL }, chaves)).toBe(false);
    expect(await verificarChamadaPubSub(`Bearer ${await assinar()}`, { audiencia: "", email: "" }, chaves)).toBe(false);
    expect(await verificarChamadaPubSub("Bearer lixo", { audiencia: AUD, email: EMAIL }, chaves)).toBe(false);
  });
});
