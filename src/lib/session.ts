import sql from "@/lib/db";

let ensured = false;

/** Cria as colunas que guardam a sessão ativa de cada usuário, uma vez por processo. */
export async function ensureSessionColumns() {
  if (ensured) return;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS active_session_id VARCHAR(64) DEFAULT NULL`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS session_device VARCHAR(120) DEFAULT NULL`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ DEFAULT NULL`;
  ensured = true;
}

/** Sem sessão registrada no banco (conta antiga ou após sair), qualquer token válido continua valendo. */
export function sessionMatches(dbSessionId: string | null | undefined, tokenSessionId: string | undefined): boolean {
  if (!dbSessionId) return true;
  return dbSessionId === tokenSessionId;
}

/** A sessão dura 7 dias (validade do token); depois disso ela já expirou sozinha e não conta como "outro local". */
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function isSessionAlive(startedAt: unknown): boolean {
  if (!startedAt) return false;
  const t = new Date(startedAt as string).getTime();
  return Number.isFinite(t) && Date.now() - t < SESSION_LIFETIME_MS;
}

export function describeDevice(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iPhone/iPad"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Macintosh|Mac OS X/i.test(ua)
          ? "Mac"
          : /Linux/i.test(ua)
            ? "Linux"
            : "outro aparelho";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Chrome|CriOS/.test(ua)
        ? "Chrome"
        : /Firefox|FxiOS/.test(ua)
          ? "Firefox"
          : /Safari/.test(ua)
            ? "Safari"
            : "Navegador";
  return `${browser} em ${os}`;
}
