import sql from "@/lib/db";

let ensured = false;

/** Adds commercial subscription columns once per process. */
export async function ensureSubscriptionColumns() {
  if (ensured) return;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS paid_until DATE DEFAULT NULL`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS plan VARCHAR(30) DEFAULT 'assinante'`;
  // Contas já existentes (fundadores) não ficam bloqueadas após o deploy
  await sql`
    UPDATE app_users
    SET
      paid_until = COALESCE(paid_until, (CURRENT_DATE + INTERVAL '365 days')::date),
      bot_enabled = CASE WHEN is_admin THEN true ELSE COALESCE(bot_enabled, false) END
    WHERE paid_until IS NULL AND (is_admin = true OR user_id IN ('italo', 'natalia'))
  `;
  ensured = true;
}

export function isSubscriptionActive(row: {
  is_admin?: boolean | null;
  is_active?: boolean | null;
  paid_until?: string | Date | null;
}): boolean {
  if (row.is_admin) return true;
  if (row.is_active === false) return false;
  if (!row.paid_until) return false;
  const until = String(row.paid_until).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return until >= today;
}

export function hasBotAccess(row: {
  is_admin?: boolean | null;
  bot_enabled?: boolean | null;
}): boolean {
  if (row.is_admin) return true;
  return Boolean(row.bot_enabled);
}

export function addDaysISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
