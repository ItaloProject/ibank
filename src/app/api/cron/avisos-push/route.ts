import { NextResponse } from "next/server";
import { getCachedSnapshot } from "@/lib/server/portfolio-snapshot";
import {
  buildPushPayload,
  filterUndelivered,
  isPushPriceAlert,
  listUsersWithPush,
  markDelivered,
  sendPushToUser,
} from "@/lib/user-push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Todo dia útil às 18:30 de Brasília (21:30 UTC): manda push com avisos de queda
 * da bolsa / papéis em carteira que ainda não foram enviados.
 * A Vercel envia "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET ?? "";
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const users = await listUsersWithPush();
  let enviados = 0;
  let usuariosComAviso = 0;
  let removidos = 0;

  for (const userId of users) {
    try {
      const snap = await getCachedSnapshot(userId, true);
      const price = snap.alerts.filter(isPushPriceAlert);
      const novos = await filterUndelivered(userId, price);
      const payload = buildPushPayload(novos);
      if (!payload) continue;

      const r = await sendPushToUser(userId, payload);
      removidos += r.removidos;
      if (r.enviados > 0) {
        await markDelivered(userId, novos.map((a) => a.id));
        enviados += r.enviados;
        usuariosComAviso++;
      }
    } catch (err) {
      console.error("[cron/avisos-push]", userId, err);
    }
  }

  return NextResponse.json({
    ok: true,
    usuarios: users.length,
    usuariosComAviso,
    enviados,
    removidos,
  });
}
