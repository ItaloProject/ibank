import { NextResponse } from "next/server";
import { evolutionConfig } from "@/lib/evolution";
import { handleInboundReply } from "@/lib/server/whatsapp-outbox";
import { secretMatches } from "@/lib/server/secret-auth";

export const dynamic = "force-dynamic";

type EvolutionMessage = {
  key?: { remoteJid?: string; remoteJidAlt?: string; senderPn?: string; fromMe?: boolean };
  message?: { conversation?: string; extendedTextMessage?: { text?: string } };
};

/**
 * Mensagens recebidas pelo número do Muvo (evento messages.upsert da Evolution API).
 * Configure o webhook da instância com `?token=<EVOLUTION_WEBHOOK_TOKEN>` na URL.
 */
export async function POST(request: Request) {
  const expected = process.env.EVOLUTION_WEBHOOK_TOKEN?.trim();
  const cfg = evolutionConfig();
  if (!expected || !cfg) return new NextResponse("Not configured", { status: 503 });
  if (!secretMatches(new URL(request.url).searchParams.get("token"), expected)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { event?: string; data?: EvolutionMessage | EvolutionMessage[] } | null;
  const event = String(body?.event ?? "").toLowerCase().replace(/_/g, ".");
  if (!body || event !== "messages.upsert") return NextResponse.json({ ok: true, ignored: true });

  const messages = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
  for (const m of messages) {
    if (m.key?.fromMe) continue;
    // Contas novas do WhatsApp podem vir com um identificador "@lid"; o número real vem em outro campo.
    const jid = m.key?.senderPn ?? m.key?.remoteJidAlt ?? m.key?.remoteJid ?? "";
    if (!jid.endsWith("@s.whatsapp.net")) continue;
    const text = m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? "";
    try {
      await handleInboundReply(cfg, jid.split("@")[0], text);
    } catch (err) {
      console.error("[evolution webhook]", err);
    }
  }
  return NextResponse.json({ ok: true });
}
