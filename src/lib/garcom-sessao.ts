import { jwtVerify, SignJWT } from "jose";
import { getJwtSecret } from "@/lib/auth";

/** Sessão do garçom: vale 12 horas e só serve para o painel da pizzaria dele */
export const HORAS_SESSAO_GARCOM = 12;

export type SessaoGarcom = { kind: "garcom"; garcomId: string; slug: string; nome: string };

export async function assinarSessaoGarcom(sessao: Omit<SessaoGarcom, "kind">): Promise<string> {
  return new SignJWT({ ...sessao, kind: "garcom" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${HORAS_SESSAO_GARCOM}h`)
    .sign(getJwtSecret());
}

/** Devolve a sessão do garçom, ou null se o token for inválido, expirado ou de outro tipo */
export async function lerSessaoGarcom(token: string): Promise<SessaoGarcom | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.kind !== "garcom" || typeof payload.garcomId !== "string" || typeof payload.slug !== "string") return null;
    return { kind: "garcom", garcomId: payload.garcomId, slug: payload.slug, nome: String(payload.nome ?? "") };
  } catch {
    return null;
  }
}
