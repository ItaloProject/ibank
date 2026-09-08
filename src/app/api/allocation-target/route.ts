import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

/**
 * Alocação-alvo personalizada do usuário.
 * Ausente (null) significa "use o preset do perfil de investimento".
 */

function readPct(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const rows = await sql`
    SELECT target_renda_fixa, target_acoes, target_fii
    FROM app_users WHERE user_id = ${userId}
  `;
  const r = rows[0];
  if (!r || r.target_renda_fixa === null || r.target_acoes === null || r.target_fii === null) {
    return NextResponse.json({ custom: false });
  }
  return NextResponse.json({
    custom: true,
    renda_fixa: Number(r.target_renda_fixa),
    acoes: Number(r.target_acoes),
    fii: Number(r.target_fii),
  });
}

export async function POST(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await request.json();

  // Enviar reset:true volta a usar o preset do perfil
  if (body?.reset) {
    await sql`
      UPDATE app_users
      SET target_renda_fixa = NULL, target_acoes = NULL, target_fii = NULL
      WHERE user_id = ${userId}
    `;
    return NextResponse.json({ custom: false });
  }

  const rf = readPct(body?.renda_fixa);
  const ac = readPct(body?.acoes);
  const fii = readPct(body?.fii);

  if (rf === null || ac === null || fii === null) {
    return NextResponse.json({ error: "Percentuais inválidos" }, { status: 400 });
  }
  if (rf + ac + fii !== 100) {
    return NextResponse.json(
      { error: `A soma deve ser 100% (recebido ${rf + ac + fii}%)` },
      { status: 400 },
    );
  }

  await sql`
    UPDATE app_users
    SET target_renda_fixa = ${rf}, target_acoes = ${ac}, target_fii = ${fii}
    WHERE user_id = ${userId}
  `;

  return NextResponse.json({ custom: true, renda_fixa: rf, acoes: ac, fii });
}
