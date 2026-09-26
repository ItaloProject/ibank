import sql from "@/lib/db";

let ensured: Promise<void> | null = null;

/** Colunas e tabelas do bot (perfil de risco, WhatsApp, limites de uso), criadas uma vez por processo. */
export function ensureBotSchema(): Promise<void> {
  ensured ??= (async () => {
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS risk_profile VARCHAR(20) DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(20) DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS whatsapp_last_inbound_at TIMESTAMPTZ DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS whatsapp_link_code VARCHAR(12) DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS whatsapp_link_expires TIMESTAMPTZ DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS whatsapp_pending_report_at TIMESTAMPTZ DEFAULT NULL`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS app_users_whatsapp_phone_key ON app_users (whatsapp_phone) WHERE whatsapp_phone IS NOT NULL`;
    await sql`
      CREATE TABLE IF NOT EXISTS bot_usage (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        kind VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS bot_usage_user_kind_idx ON bot_usage (user_id, kind, created_at)`;
  })().catch((err) => {
    ensured = null;
    throw err;
  });
  return ensured;
}

/** Registra um uso e diz se ainda está dentro do limite diário. */
export async function consumeDailyQuota(userId: string, kind: "chat" | "whatsapp", limit: number): Promise<boolean> {
  await ensureBotSchema();
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM bot_usage
    WHERE user_id = ${userId} AND kind = ${kind} AND created_at > NOW() - INTERVAL '24 hours'
  `;
  if (Number(rows[0]?.n ?? 0) >= limit) return false;
  await sql`INSERT INTO bot_usage (user_id, kind) VALUES (${userId}, ${kind})`;
  return true;
}
