import { VALIDADE_TOKEN_SEG } from "@/lib/token-renovacao";

/** Opções do cookie `ibank_session`: httpOnly, Secure em produção, SameSite=Lax. */
export function opcoesCookieSessao(maxAge: number = VALIDADE_TOKEN_SEG) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

/** Apaga o cookie de sessão. */
export function opcoesCookieSessaoApagar() {
  return opcoesCookieSessao(0);
}
