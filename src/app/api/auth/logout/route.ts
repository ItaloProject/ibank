import { NextResponse } from "next/server";
import { opcoesCookieSessaoApagar } from "@/lib/session-cookie";

/**
 * Sai só deste aparelho: apaga o cookie. A sessão da conta continua valendo nos outros aparelhos
 * (celular e computador podem ficar conectados juntos). Trocar a senha invalida todos os aparelhos.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("ibank_session", "", opcoesCookieSessaoApagar());
  return response;
}
