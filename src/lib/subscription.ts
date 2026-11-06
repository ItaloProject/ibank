import sql from "@/lib/db";
import { missingColumns, runDdl } from "@/lib/schema-check";

let ensured = false;

const SUB_COLUMNS = ["bot_enabled", "paid_until", "plan"] as const;

/** Colunas comerciais. Só faz ALTER se faltar algo — evita fila de locks no login. */
export async function ensureSubscriptionColumns() {
  if (ensured) return;
  const missing = await missingColumns("app_users", [...SUB_COLUMNS]);
  if (missing.length > 0) {
    await runDdl(async (tx) => {
      if (missing.includes("bot_enabled")) await tx`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN DEFAULT false`;
      if (missing.includes("paid_until")) await tx`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS paid_until DATE DEFAULT NULL`;
      if (missing.includes("plan")) await tx`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS plan VARCHAR(30) DEFAULT 'assinante'`;
    });
    // Contas já existentes (fundadores) não ficam bloqueadas após o deploy das colunas
    await sql`
      UPDATE app_users
      SET
        paid_until = COALESCE(paid_until, (CURRENT_DATE + INTERVAL '365 days')::date),
        bot_enabled = CASE WHEN is_admin THEN true ELSE COALESCE(bot_enabled, false) END
      WHERE paid_until IS NULL AND (is_admin = true OR user_id IN ('italo', 'natalia'))
    `;
  }
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
