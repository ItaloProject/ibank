/** O token de sessão vale 7 dias e é renovado quando passa de 1 dia (veja /api/auth/me). */
export const VALIDADE_TOKEN_SEG = 7 * 24 * 60 * 60;
const RENOVAR_APOS_SEG = 24 * 60 * 60;

/**
 * O token tem mais de um dia (ou é antigo e não tem data)? Então vale renovar:
 * quem abre o app pelo menos uma vez por semana não é deslogado de repente, e um token roubado ainda expira.
 */
export function tokenPrecisaRenovar(iat: number | undefined, agoraMs: number = Date.now()): boolean {
  if (!iat) return true;
  return agoraMs / 1000 - iat > RENOVAR_APOS_SEG;
}
