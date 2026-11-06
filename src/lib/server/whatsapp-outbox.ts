/**
 * Fila de envio do WhatsApp (Baileys, via Evolution API) com um único número.
 *
 * `planOutbox` decide quem recebe o quê e grava na fila; `dispatchNext` envia uma mensagem
 * por chamada, respeitando janela, pausa entre mensagens, limite diário com aquecimento e
 * um freio para falhas seguidas. Um agendador chama os dois a cada minuto (ver a rota dispatch).
 */
import sql from "@/lib/db";
import { ensureBotSchema } from "@/lib/bot-schema";
import { missingColumns, missingTables, runDdl } from "@/lib/schema-check";
import { brDay, fetchDayMove, INDEX_SYMBOL } from "@/lib/market-quotes";
import { isSevereIndex, isSevereMove, urgentPriceAlerts } from "@/lib/price-alerts";
import { detectAssetType } from "@/lib/stock-utils";
import { evoSendText, evolutionConfig, type EvolutionConfig } from "@/lib/evolution";
import { loadUserSnapshot } from "@/lib/server/portfolio-snapshot";
import { firstName } from "@/lib/report/report-text";
import { phoneVariants } from "@/lib/whatsapp";
import {
  BREAKER,
  composeAlert,
  composeConfirmation,
  composeDigest,
  composeOptin,
  dailyCap,
  isDigestDue,
  isSendWindow,
  nextGapSeconds,
  parseReply,
  type Frequency,
  type Reply,
} from "@/lib/whatsapp-digest";

/** Avisos já enviados nos últimos dias não entram de novo no resumo. */
const ALERT_MEMORY_DAYS = 14;

let ensured = false;

const OUTBOX_COLUMNS = ["whatsapp_optin_at", "whatsapp_optout_at", "whatsapp_frequency"];
const OUTBOX_TABLES = ["whatsapp_outbox", "whatsapp_sender_state"];

/** Com colunas e tabelas já criadas, só lê o catálogo: nenhum ALTER, nenhum bloqueio em `app_users`. */
export async function ensureOutboxSchema() {
  if (ensured) return;
  const [columns, tables] = await Promise.all([missingColumns("app_users", OUTBOX_COLUMNS), missingTables(OUTBOX_TABLES)]);
  if (columns.length === 0 && tables.length === 0) {
    ensured = true;
    return;
  }
  await ensureBotSchema();
  await runDdl(async (sql) => {
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS whatsapp_optin_at TIMESTAMPTZ DEFAULT NULL`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS whatsapp_optout_at TIMESTAMPTZ DEFAULT NULL`;
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS whatsapp_frequency VARCHAR(10) NOT NULL DEFAULT 'weekly'`;
  await sql`
    CREATE TABLE IF NOT EXISTS whatsapp_outbox (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind VARCHAR(10) NOT NULL,
      day DATE NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      alert_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      status VARCHAR(12) NOT NULL DEFAULT 'queued',
      attempts INT NOT NULL DEFAULT 0,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      claimed_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      UNIQUE (user_id, kind, day)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS whatsapp_outbox_queue_idx ON whatsapp_outbox (status, created_at)`;
  await sql`
    CREATE TABLE IF NOT EXISTS whatsapp_sender_state (
      id INT PRIMARY KEY,
      last_sent_at TIMESTAMPTZ,
      next_gap_seconds INT NOT NULL DEFAULT 60,
      paused_until TIMESTAMPTZ,
      failures INT NOT NULL DEFAULT 0
    )
  `;
  await sql`INSERT INTO whatsapp_sender_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
  });
  ensured = true;
}

type PlanResult = { reason?: string; invites: number; digests: number; skipped: number; failed: number };

/** Coloca na fila os convites (SIM) e os resumos devidos hoje, no máximo `limit` usuários por chamada. */
export async function planOutbox(limit = 3, now = new Date()): Promise<PlanResult> {
  const result: PlanResult = { invites: 0, digests: 0, skipped: 0, failed: 0 };
  if (!isSendWindow(now)) return { ...result, reason: "outside-window" };
  await ensureOutboxSchema();
  const today = brDay(now.getTime());

  const toInvite = await sql`
    SELECT u.user_id, u.name FROM app_users u
    WHERE u.whatsapp_phone IS NOT NULL AND u.whatsapp_consent_at IS NOT NULL
      AND u.whatsapp_optin_at IS NULL AND u.whatsapp_optout_at IS NULL AND u.is_active IS NOT FALSE
      AND NOT EXISTS (
        SELECT 1 FROM whatsapp_outbox o
        WHERE o.user_id = u.user_id AND o.kind = 'optin' AND o.created_at >= u.whatsapp_consent_at
      )
    ORDER BY u.whatsapp_consent_at
    LIMIT ${limit}
  `;
  for (const u of toInvite) {
    const userId = String(u.user_id);
    await sql`
      INSERT INTO whatsapp_outbox (user_id, kind, day, body)
      VALUES (${userId}, 'optin', ${today}::date, ${composeOptin(firstName(String(u.name ?? "")), `${userId}-${today}`)})
      ON CONFLICT (user_id, kind, day) DO NOTHING
    `;
    result.invites++;
  }

  const candidates = await sql`
    SELECT u.user_id, u.name, u.whatsapp_frequency,
      (SELECT to_char(MAX(o.day), 'YYYY-MM-DD') FROM whatsapp_outbox o WHERE o.user_id = u.user_id AND o.kind = 'digest') AS last_day
    FROM app_users u
    WHERE u.whatsapp_phone IS NOT NULL AND u.whatsapp_optin_at IS NOT NULL
      AND u.whatsapp_optout_at IS NULL AND u.is_active IS NOT FALSE
      AND NOT EXISTS (
        SELECT 1 FROM whatsapp_outbox o
        WHERE o.user_id = u.user_id AND o.day = ${today}::date
          AND (o.kind = 'digest' OR (o.kind = 'alert' AND o.status IN ('queued', 'sending', 'sent')))
      )
    ORDER BY u.user_id
  `;
  let handled = 0;
  for (const c of candidates) {
    if (handled >= limit) break;
    const userId = String(c.user_id);
    const frequency: Frequency = c.whatsapp_frequency === "daily" ? "daily" : "weekly";
    if (!isDigestDue({ frequency, userId, now, lastDigestDay: c.last_day ? String(c.last_day) : null })) continue;
    handled++;
    try {
      const recent = await sql`
        SELECT alert_ids FROM whatsapp_outbox
        WHERE user_id = ${userId} AND kind IN ('digest', 'alert') AND status = 'sent'
          AND day >= (${today}::date - ${ALERT_MEMORY_DAYS}::int)
      `;
      const already = new Set(recent.flatMap((r) => (Array.isArray(r.alert_ids) ? (r.alert_ids as string[]) : [])));
      const snap = await loadUserSnapshot(userId);
      const alerts = snap.alerts.filter((a) => !already.has(a.id));
      const body = composeDigest({
        nome: firstName(String(c.name ?? "")),
        frequency,
        alerts,
        bolsa: snap.stocks.length
          ? {
              valorAtual: snap.stocks.reduce((s, x) => s + x.valorAtual, 0),
              investido: snap.stocks.reduce((s, x) => s + x.investido, 0),
            }
          : null,
        seed: `${userId}-${today}`,
      });
      const sentIds = body ? alerts.slice(0, 3).map((a) => a.id) : [];
      await sql`
        INSERT INTO whatsapp_outbox (user_id, kind, day, body, alert_ids, status)
        VALUES (${userId}, 'digest', ${today}::date, ${body ?? ""}, ${JSON.stringify(sentIds)}::jsonb, ${body ? "queued" : "skipped"})
        ON CONFLICT (user_id, kind, day) DO NOTHING
      `;
      if (body) result.digests++;
      else result.skipped++;
    } catch (err) {
      console.error("[whatsapp plan]", userId, err);
      await sql`
        INSERT INTO whatsapp_outbox (user_id, kind, day, status, error)
        VALUES (${userId}, 'digest', ${today}::date, 'failed', ${String(err).slice(0, 300)})
        ON CONFLICT (user_id, kind, day) DO NOTHING
      `;
      result.failed++;
    }
  }
  return result;
}

type AlertPlanResult = { reason?: string; scanned: number; queued: number; skipped: number };

/**
 * Queda grave: verifica só os papéis que quem tem o resumo ativo possui (e o Ibovespa). Se nenhum
 * estiver em queda grave, não analisa carteira nenhuma. Quando há, enfileira uma mensagem na hora
 * para quem tem esses papéis, no máximo uma por dia por usuário, sem repetir aviso já enviado.
 */
export async function planAlerts(limit = 2, now = new Date()): Promise<AlertPlanResult> {
  const result: AlertPlanResult = { scanned: 0, queued: 0, skipped: 0 };
  if (!isSendWindow(now)) return { ...result, reason: "outside-window" };
  await ensureOutboxSchema();
  const today = brDay(now.getTime());

  const held = await sql`
    SELECT t.user_id, t.ticker
    FROM stock_trades t JOIN app_users u ON u.user_id = t.user_id
    WHERE u.whatsapp_phone IS NOT NULL AND u.whatsapp_optin_at IS NOT NULL
      AND u.whatsapp_optout_at IS NULL AND u.is_active IS NOT FALSE
    GROUP BY t.user_id, t.ticker
    HAVING SUM(CASE WHEN t.type = 'compra' THEN t.quantity ELSE -t.quantity END) > 0.0001
  `;
  if (held.length === 0) return { ...result, reason: "no-holders" };

  const tickers = [...new Set(held.map((r) => String(r.ticker)))].slice(0, 80);
  const [index, moves] = await Promise.all([
    fetchDayMove(INDEX_SYMBOL),
    Promise.all(tickers.map((t) => fetchDayMove(`${t}.SA`))),
  ]);
  const severe = new Set(tickers.filter((t, i) => isSevereMove(detectAssetType(t), moves[i])));
  const marketSevere = isSevereIndex(index);
  if (!marketSevere && severe.size === 0) return { ...result, reason: "calm" };

  const candidates = new Set(held.filter((r) => marketSevere || severe.has(String(r.ticker))).map((r) => String(r.user_id)));
  const done = await sql`
    SELECT DISTINCT user_id FROM whatsapp_outbox WHERE day = ${today}::date AND kind IN ('alert', 'digest')
  `;
  for (const r of done) candidates.delete(String(r.user_id));
  if (candidates.size === 0) return { ...result, reason: "already-handled" };

  const users = await sql`SELECT user_id, name FROM app_users WHERE user_id = ANY(${[...candidates]}) ORDER BY user_id`;
  for (const u of users.slice(0, limit)) {
    const userId = String(u.user_id);
    result.scanned++;
    try {
      const recent = await sql`
        SELECT alert_ids FROM whatsapp_outbox
        WHERE user_id = ${userId} AND kind IN ('digest', 'alert') AND status = 'sent'
          AND day >= (${today}::date - ${ALERT_MEMORY_DAYS}::int)
      `;
      const already = new Set(recent.flatMap((x) => (Array.isArray(x.alert_ids) ? (x.alert_ids as string[]) : [])));
      const snap = await loadUserSnapshot(userId);
      const urgent = urgentPriceAlerts(snap.alerts).filter((a) => !already.has(a.id));
      const body = composeAlert({ nome: firstName(String(u.name ?? "")), alerts: urgent, seed: `${userId}-${today}` });
      const ids = body ? urgent.slice(0, 3).map((a) => a.id) : [];
      await sql`
        INSERT INTO whatsapp_outbox (user_id, kind, day, body, alert_ids, status)
        VALUES (${userId}, 'alert', ${today}::date, ${body ?? ""}, ${JSON.stringify(ids)}::jsonb, ${body ? "queued" : "skipped"})
        ON CONFLICT (user_id, kind, day) DO NOTHING
      `;
      if (body) result.queued++;
      else result.skipped++;
    } catch (err) {
      console.error("[whatsapp alerts]", userId, err);
      await sql`
        INSERT INTO whatsapp_outbox (user_id, kind, day, status, error)
        VALUES (${userId}, 'alert', ${today}::date, 'failed', ${String(err).slice(0, 300)})
        ON CONFLICT (user_id, kind, day) DO NOTHING
      `;
    }
  }
  return result;
}

export type DispatchStatus =
  | "evolution-not-configured"
  | "outside-window"
  | "paused"
  | "waiting"
  | "cap-reached"
  | "empty"
  | "sent"
  | "failed";

/** Envia no máximo uma mensagem da fila, se a janela, a pausa e o limite do dia permitirem. */
export async function dispatchNext(now = new Date(), random = Math.random()): Promise<{ status: DispatchStatus; detail?: string }> {
  const cfg = evolutionConfig();
  if (!cfg) return { status: "evolution-not-configured" };
  if (!isSendWindow(now)) return { status: "outside-window" };
  await ensureOutboxSchema();

  await sql`UPDATE whatsapp_outbox SET status = 'queued' WHERE status = 'sending' AND claimed_at < NOW() - INTERVAL '10 minutes'`;
  await sql`UPDATE whatsapp_outbox SET status = 'expired' WHERE status = 'queued' AND created_at < NOW() - INTERVAL '3 days'`;
  // Aviso de queda perde o sentido horas depois: se não saiu logo, não sai mais.
  await sql`UPDATE whatsapp_outbox SET status = 'expired' WHERE kind = 'alert' AND status = 'queued' AND created_at < NOW() - INTERVAL '6 hours'`;

  const [state] = await sql`SELECT last_sent_at, next_gap_seconds, paused_until FROM whatsapp_sender_state WHERE id = 1`;
  const nowMs = now.getTime();
  if (state?.paused_until && new Date(state.paused_until).getTime() > nowMs) return { status: "paused" };
  if (state?.last_sent_at && nowMs - new Date(state.last_sent_at).getTime() < Number(state.next_gap_seconds) * 1000) {
    return { status: "waiting" };
  }

  const today = brDay(nowMs);
  const [{ first_day: firstDay, sent_today: sentToday }] = await sql`
    SELECT to_char(MIN((sent_at AT TIME ZONE 'America/Sao_Paulo')::date), 'YYYY-MM-DD') AS first_day,
           COUNT(*) FILTER (WHERE (sent_at AT TIME ZONE 'America/Sao_Paulo')::date = ${today}::date)::int AS sent_today
    FROM whatsapp_outbox WHERE status = 'sent'
  `;
  const daysSinceFirst = firstDay ? Math.round((Date.parse(today) - Date.parse(String(firstDay))) / 86_400_000) : null;
  if (Number(sentToday) >= dailyCap(daysSinceFirst)) return { status: "cap-reached" };

  const claimed = await sql`
    UPDATE whatsapp_outbox SET status = 'sending', attempts = attempts + 1, claimed_at = NOW()
    WHERE id = (
      SELECT o.id FROM whatsapp_outbox o JOIN app_users u ON u.user_id = o.user_id
      WHERE o.status = 'queued' AND u.whatsapp_phone IS NOT NULL AND u.whatsapp_optout_at IS NULL
        AND ((o.kind = 'optin' AND u.whatsapp_optin_at IS NULL) OR (o.kind IN ('digest', 'alert') AND u.whatsapp_optin_at IS NOT NULL))
      ORDER BY CASE o.kind WHEN 'alert' THEN 0 WHEN 'digest' THEN 1 ELSE 2 END, o.created_at
      LIMIT 1
      FOR UPDATE OF o SKIP LOCKED
    )
    RETURNING id, user_id, body, attempts
  `;
  const item = claimed[0];
  if (!item) return { status: "empty" };

  const [owner] = await sql`SELECT whatsapp_phone FROM app_users WHERE user_id = ${item.user_id}`;
  try {
    await evoSendText(cfg, String(owner.whatsapp_phone), String(item.body));
    await sql`UPDATE whatsapp_outbox SET status = 'sent', sent_at = NOW(), error = NULL WHERE id = ${item.id}`;
    await sql`
      UPDATE whatsapp_sender_state
      SET last_sent_at = NOW(), next_gap_seconds = ${nextGapSeconds(random)}, failures = 0
      WHERE id = 1
    `;
    return { status: "sent" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Número sem WhatsApp é problema do destinatário, não do chip: não conta para o freio.
    const recipientProblem = /não tem whatsapp/i.test(message);
    const giveUp = recipientProblem || Number(item.attempts) >= 3;
    await sql`
      UPDATE whatsapp_outbox SET status = ${giveUp ? "failed" : "queued"}, error = ${message.slice(0, 300)}
      WHERE id = ${item.id}
    `;
    if (!recipientProblem) {
      const [after] = await sql`
        UPDATE whatsapp_sender_state SET failures = failures + 1 WHERE id = 1 RETURNING failures
      `;
      if (Number(after.failures) >= BREAKER.failures) {
        await sql`
          UPDATE whatsapp_sender_state
          SET paused_until = NOW() + ${BREAKER.pauseHours}::int * INTERVAL '1 hour', failures = 0
          WHERE id = 1
        `;
      }
    }
    return { status: "failed", detail: message };
  }
}

/** Escolha do usuário (no app ou por resposta): semanal, só avisos ou desligado. Desligar cancela o que está na fila. */
export async function applyDigestMode(userId: string, mode: "weekly" | "daily" | "off") {
  await ensureOutboxSchema();
  if (mode === "off") {
    await sql`UPDATE app_users SET whatsapp_optout_at = NOW() WHERE user_id = ${userId}`;
    await sql`UPDATE whatsapp_outbox SET status = 'cancelled' WHERE user_id = ${userId} AND status = 'queued'`;
    return;
  }
  await sql`
    UPDATE app_users
    SET whatsapp_optin_at = COALESCE(whatsapp_optin_at, NOW()), whatsapp_optout_at = NULL,
        whatsapp_frequency = ${mode}::varchar
    WHERE user_id = ${userId}
  `;
}

/** Remove o aceite e a fila quando o número é removido ou trocado. */
export async function resetDigestConsent(userId: string) {
  await ensureOutboxSchema();
  await sql`UPDATE app_users SET whatsapp_optin_at = NULL, whatsapp_optout_at = NULL WHERE user_id = ${userId}`;
  await sql`UPDATE whatsapp_outbox SET status = 'cancelled' WHERE user_id = ${userId} AND status = 'queued'`;
}

export type InboundResult = "unknown-user" | "ignored" | Reply;

/** Resposta do usuário ao número do Muvo: SIM, SAIR, AVISOS ou SEMANAL. Outras mensagens só marcam a conversa como ativa. */
export async function handleInboundReply(cfg: EvolutionConfig, from: string, text: string): Promise<InboundResult> {
  await ensureOutboxSchema();
  const digits = from.replace(/\D/g, "");
  if (!digits) return "unknown-user";
  const users = await sql`
    SELECT user_id, name, whatsapp_phone FROM app_users WHERE whatsapp_phone = ANY(${phoneVariants(digits)})
  `;
  const user = users[0];
  if (!user) return "unknown-user";
  const userId = String(user.user_id);
  await sql`
    UPDATE app_users
    SET whatsapp_last_inbound_at = NOW(), whatsapp_verified_at = COALESCE(whatsapp_verified_at, NOW())
    WHERE user_id = ${userId}
  `;

  const reply = parseReply(text);
  if (!reply) return "ignored";
  if (reply === "sair") {
    await sql`UPDATE app_users SET whatsapp_optout_at = NOW() WHERE user_id = ${userId}`;
    await sql`UPDATE whatsapp_outbox SET status = 'cancelled' WHERE user_id = ${userId} AND status = 'queued'`;
  } else {
    const frequency = reply === "avisos" ? "daily" : reply === "semanal" ? "weekly" : null;
    await sql`
      UPDATE app_users
      SET whatsapp_optin_at = COALESCE(whatsapp_optin_at, NOW()), whatsapp_optout_at = NULL,
          whatsapp_frequency = COALESCE(${frequency}::varchar, whatsapp_frequency)
      WHERE user_id = ${userId}
    `;
  }
  await evoSendText(cfg, String(user.whatsapp_phone), composeConfirmation(reply, firstName(String(user.name ?? ""))));
  return reply;
}
