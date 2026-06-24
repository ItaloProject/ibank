import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: Request) {
  try {
    const user = new URL(request.url).searchParams.get("user") ?? "italo";
    const rows = await sql`SELECT * FROM plan_groups WHERE user_id = ${user} ORDER BY created_at`;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/plan-groups]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user_id = "italo", name, color } = await request.json();
    const rows = await sql`
      INSERT INTO plan_groups (user_id, name, color)
      VALUES (${user_id}, ${name}, ${color})
      RETURNING *
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("[POST /api/plan-groups]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
