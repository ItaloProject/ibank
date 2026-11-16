import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/*
 * Verificação do ID token do Google ("Entrar com o Google").
 * O app (Android) ou o site recebe o token do Google e o manda para cá; só confiamos nele depois de
 * conferir a assinatura com as chaves públicas do Google, o emissor, a validade e se foi emitido para o NOSSO app.
 */

const JWKS_GOOGLE = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const EMISSORES = ["https://accounts.google.com", "accounts.google.com"];

export type PerfilGoogle = {
  /** Identificador estável da conta Google (não muda mesmo se a pessoa trocar o e-mail). */
  sub: string;
  email: string;
  nome: string;
};

/** IDs de cliente OAuth aceitos (web e Android), separados por vírgula em GOOGLE_CLIENT_IDS. */
export function idsDeClienteGoogle(env: string | undefined = process.env.GOOGLE_CLIENT_IDS): string[] {
  return (env ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Perfil do token, ou null se o token for inválido, vencido, de outro app ou de e-mail não verificado. */
export async function verificarIdTokenGoogle(
  idToken: string,
  clientIds: string[],
  chaves: JWTVerifyGetKey = JWKS_GOOGLE,
): Promise<PerfilGoogle | null> {
  if (clientIds.length === 0 || !idToken || idToken.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(idToken, chaves, {
      issuer: EMISSORES,
      audience: clientIds,
      clockTolerance: 5,
    });
    // O Google manda true (booleano) ou "true" (texto), conforme o fluxo.
    const emailVerificado = payload.email_verified === true || payload.email_verified === "true";
    if (!emailVerificado) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (typeof payload.email !== "string" || !payload.email) return null;
    const email = payload.email.trim().toLowerCase();
    const nome = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email.split("@")[0];
    return { sub: payload.sub, email, nome: nome.slice(0, 100) };
  } catch {
    return null;
  }
}

/** Nome de usuário interno a partir do e-mail: só letras e números, mais um sufixo aleatório. */
export function usuarioInternoDe(email: string, sufixo: string): string {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "usuario";
  return `${base}-${sufixo}`;
}
