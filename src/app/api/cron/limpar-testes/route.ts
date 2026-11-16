import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { excluirContaDoUsuario } from "@/lib/conta";
import { ensureSubscriptionColumns } from "@/lib/subscription";
import { RETENCAO_DIAS } from "@/lib/trial";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** No máximo tantas contas por rodada, para a rotina nunca estourar o tempo. */
const LIMITE_POR_RODADA = 50;

/**
 * Limpeza diária: apaga as contas de teste que NÃO assinaram, 10 dias depois do fim do teste.
 * Só pega plano "teste", sem data de assinatura e fora da administração: quem já pagou alguma vez nunca é apagado.
 * A Vercel envia "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET ?? "";
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    await ensureSubscriptionColumns();
    const candidatas = await sql`
      SELECT user_id FROM app_users
      WHERE plan = 'teste'
        AND is_admin = false
        AND paid_until IS NULL
        AND trial_ends_at IS NOT NULL
        AND trial_ends_at < NOW() - (${RETENCAO_DIAS}::int * interval '1 day')
      ORDER BY trial_ends_at
      LIMIT ${LIMITE_POR_RODADA}
    `;
    let apagadas = 0;
    for (const { user_id } of candidatas) {
      if (await excluirContaDoUsuario(String(user_id))) apagadas++;
    }
    // Só a contagem: nada que identifique alguém.
    console.info("[limpeza-testes]", { candidatas: candidatas.length, apagadas });
    return NextResponse.json({ ok: true, candidatas: candidatas.length, apagadas });
  } catch (err) {
    console.error("[GET /api/cron/limpar-testes]", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
