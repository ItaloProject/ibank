import sql from "@/lib/db";
import { configurarPush, webpush } from "@/lib/push";
import type { BotAlert } from "@/lib/alerts";

let ensured = false;

export async function ensureUserPushSchema() {
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS user_push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS user_push_subscriptions_user_idx ON user_push_subscriptions (user_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS push_alert_deliveries (
      user_id TEXT NOT NULL,
      alert_id TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, alert_id)
    )
  `;
  ensured = true;
}

/** Avisos de preço/bolsa que o cron manda por push. */
export function isPushPriceAlert(alert: Pick<BotAlert, "id">): boolean {
  return /^(queda-|mercado-|semana-|abaixo-custo-)/.test(alert.id);
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

/** Uma notificação por rodada: o aviso mais urgente e, se houver mais, o total. */
export function buildPushPayload(alerts: BotAlert[]): PushPayload | null {
  if (!alerts.length) return null;
  const ranked = [...alerts].sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "alta" ? -1 : 1));
  const top = ranked[0];
  const body =
    ranked.length === 1
      ? top.detalhe.slice(0, 160)
      : `${top.detalhe.slice(0, 100)} · +${ranked.length - 1} ${ranked.length === 2 ? "aviso" : "avisos"}`;
  return {
    title: top.titulo,
    body,
    url: "/",
    tag: `muvo-${top.id}`,
  };
}

export async function upsertUserPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  await ensureUserPushSchema();
  await sql`
    INSERT INTO user_push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (${input.userId}, ${input.endpoint}, ${input.p256dh}, ${input.auth})
    ON CONFLICT (endpoint) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      updated_at = NOW()
  `;
}

export async function deleteUserPushSubscription(userId: string, endpoint: string) {
  await ensureUserPushSchema();
  await sql`
    DELETE FROM user_push_subscriptions
    WHERE user_id = ${userId} AND endpoint = ${endpoint}
  `;
}

export async function listUsersWithPush(): Promise<string[]> {
  await ensureUserPushSchema();
  const rows = await sql`SELECT DISTINCT user_id FROM user_push_subscriptions`;
  return rows.map((r) => String(r.user_id));
}

export async function listSubscriptionsForUser(userId: string) {
  await ensureUserPushSchema();
  return sql`
    SELECT id, endpoint, p256dh, auth
    FROM user_push_subscriptions
    WHERE user_id = ${userId}
  ` as Promise<{ id: string; endpoint: string; p256dh: string; auth: string }[]>;
}

export async function filterUndelivered(userId: string, alerts: BotAlert[]): Promise<BotAlert[]> {
  if (!alerts.length) return [];
  await ensureUserPushSchema();
  const ids = alerts.map((a) => a.id);
  const rows = await sql`
    SELECT alert_id FROM push_alert_deliveries
    WHERE user_id = ${userId} AND alert_id = ANY(${ids})
  `;
  const sent = new Set(rows.map((r) => String(r.alert_id)));
  return alerts.filter((a) => !sent.has(a.id));
}

export async function markDelivered(userId: string, alertIds: string[]) {
  if (!alertIds.length) return;
  await ensureUserPushSchema();
  for (const alertId of alertIds) {
    await sql`
      INSERT INTO push_alert_deliveries (user_id, alert_id)
      VALUES (${userId}, ${alertId})
      ON CONFLICT DO NOTHING
    `;
  }
}

/** Envia para os aparelhos do usuário; remove inscrição morta (410/404). */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ enviados: number; removidos: number }> {
  if (!configurarPush()) return { enviados: 0, removidos: 0 };
  const aparelhos = await listSubscriptionsForUser(userId);
  let enviados = 0;
  let removidos = 0;
  const corpo = JSON.stringify(payload);
  for (const a of aparelhos) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        corpo,
        { TTL: 60 * 60 * 12, urgency: "normal" },
      );
      enviados++;
    } catch (err) {
      const status = Number((err as { statusCode?: number })?.statusCode ?? 0);
      if (status === 404 || status === 410) {
        await sql`DELETE FROM user_push_subscriptions WHERE id = ${a.id}`;
        removidos++;
      } else {
        console.error("[push] falha ao enviar", userId, status || err);
      }
    }
  }
  return { enviados, removidos };
}
