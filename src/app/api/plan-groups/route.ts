import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import sql from "@/lib/db";

export async function GET() {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const rows = await sql`SELECT * FROM plan_groups WHERE user_id = ${userId} ORDER BY created_at`;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/plan-groups]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if (auth instanceof NextResponse) return auth;
    const { userId } = auth;
    const { name, color } = await request.json();
    const rows = await sql`
      INSERT INTO plan_groups (user_id, name, color)
      VALUES (${userId}, ${name}, ${color})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/plan-groups]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
