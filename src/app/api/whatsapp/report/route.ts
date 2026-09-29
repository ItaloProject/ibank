import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { consumeDailyQuota, ensureBotSchema } from "@/lib/bot-schema";
import { requireBotUser } from "@/lib/server/bot-auth";
import { evolutionConfig } from "@/lib/evolution";
import { sendFullReport, sendReportViaEvolution, sendTemplateReport } from "@/lib/server/send-report";
import { WhatsappError, isWindowOpen, maskPhone, normalizePhone, whatsappConfig } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_LIMIT = 5;

/**
 * Envia o relatório ao WhatsApp do usuário. Com `phone` + `consent` no corpo, salva
 * o número antes (fluxo "digite seu número"); sem corpo, usa o número já salvo.
 */
export async function POST(request: Request) {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  const evo = evolutionConfig();
  const cfg = evo ? null : whatsappConfig();
  if (!evo && !cfg) return NextResponse.json({ error: "O envio automático pelo WhatsApp ainda não foi ativado." }, { status: 503 });
  await ensureBotSchema();

  const body = (await request.json().catch(() => null)) as { phone?: unknown; consent?: unknown } | null;
  if (body?.phone !== undefined) {
    const phone = normalizePhone(String(body.phone));
    if (!phone) return NextResponse.json({ error: "Número inválido. Use DDD + número, ex.: (11) 98765-4321." }, { status: 400 });
    if (body.consent !== true) return NextResponse.json({ error: "Marque a autorização para receber mensagens do MUVO." }, { status: 400 });
    const taken = await sql`SELECT 1 FROM app_users WHERE whatsapp_phone = ${phone} AND user_id <> ${auth.userId}`;
    if (taken.length > 0) return NextResponse.json({ error: "Este número já está cadastrado em outra conta." }, { status: 409 });
    await sql`
      UPDATE app_users
      SET whatsapp_phone = ${phone}, whatsapp_consent_at = NOW(), whatsapp_verified_at = NULL,
          whatsapp_last_inbound_at = CASE WHEN whatsapp_phone = ${phone} THEN whatsapp_last_inbound_at ELSE NULL END
      WHERE user_id = ${auth.userId}
    `;
  }

  const rows = await sql`SELECT whatsapp_phone, whatsapp_last_inbound_at FROM app_users WHERE user_id = ${auth.userId}`;
  const phone: string | null = rows[0]?.whatsapp_phone ?? null;
  if (!phone) return NextResponse.json({ error: "Informe seu número de WhatsApp.", code: "not_connected" }, { status: 409 });

  const windowOpen = isWindowOpen(rows[0]?.whatsapp_last_inbound_at);
  if (cfg && !windowOpen && !cfg.reportTemplate) {
    return NextResponse.json({
      error: "O envio automático ainda não está liberado. Use “Compartilhar no WhatsApp”.",
      code: "template_missing",
    }, { status: 409 });
  }
  if (!(await consumeDailyQuota(auth.userId, "whatsapp", DAILY_LIMIT))) {
    return NextResponse.json({ error: `Limite de ${DAILY_LIMIT} envios por dia atingido. Tente amanhã.` }, { status: 429 });
  }

  try {
    if (evo) {
      await sendReportViaEvolution(evo, auth.userId, phone);
      return NextResponse.json({ sent: true, mode: "full", phone: maskPhone(phone) });
    }
    if (!cfg) throw new Error("WhatsApp não configurado");
    if (windowOpen) await sendFullReport(cfg, auth.userId, phone);
    else await sendTemplateReport(cfg, auth.userId, phone);
    return NextResponse.json({ sent: true, mode: windowOpen ? "full" : "template", phone: maskPhone(phone) });
  } catch (err) {
    console.error("[POST /api/whatsapp/report]", err);
    const msg = err instanceof WhatsappError
      ? `Não foi possível entregar: ${err.message}. Confira se o número tem WhatsApp.`
      : "Não foi possível enviar o relatório agora.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
