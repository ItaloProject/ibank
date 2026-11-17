import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";
import { ensurePlanGroupSchema } from "@/lib/plan-groups";
import { enforcePlanLimit } from "@/lib/plan-limits";

export async function GET() {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    await ensurePlanGroupSchema();
    const rows = await sql`SELECT * FROM plan_groups WHERE user_id = ${userId} ORDER BY created_at`;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/plan-groups]", err);
    return NextResponse.json({ error: "Erro interno. Tente novamente em instantes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { name, color } = await request.json();
    const existentes = await sql`SELECT COUNT(*)::int AS n FROM plan_groups WHERE user_id = ${userId}`;
    const bloqueio = await enforcePlanLimit(userId, "planGroups", Number(existentes[0]?.n ?? 0));
    if (bloqueio) return bloqueio;
    const rows = await sql`
      INSERT INTO plan_groups (user_id, name, color)
      VALUES (${userId}, ${name}, ${color})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/plan-groups]", err);
    return NextResponse.json({ error: "Erro interno. Tente novamente em instantes." }, { status: 500 });
  }
}
