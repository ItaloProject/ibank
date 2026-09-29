import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { ensureBotSchema } from "@/lib/bot-schema";
import { firstName } from "@/lib/report/report-text";
import { sendFullReport } from "@/lib/server/send-report";
import { SESSION_WINDOW_MS, phoneVariants, sendText, verifySignature, whatsappConfig, type WhatsappConfig } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/** Verificação do webhook pela Meta. */
export async function GET(request: Request) {
  const cfg = whatsappConfig();
  const p = new URL(request.url).searchParams;
  if (cfg?.verifyToken && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === cfg.verifyToken) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type InboundMessage = { from: string; type: string; text?: { body?: string }; button?: { text?: string } };
type WebhookBody = { entry?: { changes?: { value?: { messages?: InboundMessage[] } }[] }[] };

async function handleMessage(cfg: WhatsappConfig, msg: InboundMessage) {
  const from = msg.from.replace(/\D/g, "");
  if (!from) return;

  const users = await sql`
    SELECT user_id, name, whatsapp_last_inbound_at, whatsapp_pending_report_at
    FROM app_users WHERE whatsapp_phone = ANY(${phoneVariants(from)})
  `;
  const user = users[0];
  if (!user) return;
  await sql`
    UPDATE app_users SET whatsapp_last_inbound_at = NOW(), whatsapp_verified_at = COALESCE(whatsapp_verified_at, NOW())
    WHERE user_id = ${user.user_id}
  `;
  const pending = user.whatsapp_pending_report_at ? new Date(user.whatsapp_pending_report_at).getTime() : 0;
  if (pending && Date.now() - pending < 3 * SESSION_WINDOW_MS) {
    await sendFullReport(cfg, String(user.user_id), from);
    return;
  }
  const last = user.whatsapp_last_inbound_at ? new Date(user.whatsapp_last_inbound_at).getTime() : 0;
  if (Date.now() - last > SESSION_WINDOW_MS / 2) {
    const nome = firstName(String(user.name ?? ""));
    await sendText(cfg, from, `Oi${nome ? `, ${nome}` : ""}! Para receber o relatório da sua carteira, abra o assistente Muvo no app e toque em *Enviar para meu WhatsApp*.`);
  }
}

export async function POST(request: Request) {
  const cfg = whatsappConfig();
  if (!cfg) return new NextResponse("Not configured", { status: 503 });
  const raw = await request.text();
  if (cfg.appSecret) {
    if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), cfg.appSecret)) {
      return new NextResponse("Invalid signature", { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return new NextResponse("WHATSAPP_APP_SECRET missing", { status: 503 });
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  await ensureBotSchema();
  const messages = (body.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.messages ?? []));
  for (const msg of messages) {
    try {
      await handleMessage(cfg, msg);
    } catch (err) {
      console.error("[whatsapp webhook]", err);
    }
  }
  return NextResponse.json({ ok: true });
}
