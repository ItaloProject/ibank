import { createHash } from "node:crypto";

/** Quantos envios de pedido uma mesma origem pode fazer dentro da janela */
export const LIMITE_ENVIOS = 8;
export const JANELA_MINUTOS = 10;

/** IP de quem fez a chamada (a Vercel informa no cabeçalho). Sem IP, usa um valor genérico. */
export function extrairIp(cabecalhos: Headers): string {
  const encaminhado = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || cabecalhos.get("x-real-ip")?.trim() || "desconhecido";
}

/** Guarda só o hash do IP, nunca o IP */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`pedido:${ip}`).digest("hex");
}
