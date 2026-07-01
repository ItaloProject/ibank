import { NextResponse } from "next/server";
import sql from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user") ?? "italo";
    const month = searchParams.get("month");
    if (!month) return NextResponse.json({ salary: 0 });

    const rows = await sql`
      SELECT salary FROM plan_salary WHERE user_id = ${user} AND month = ${month}
    `;
    return NextResponse.json({ salary: rows[0] ? Number(rows[0].salary) : 0 });
  } catch (err) {
    console.error("[GET /api/plan-salary]", err);
    return NextResponse.json({ salary: 0 });
  }
}

export async function PUT(request: Request) {
  try {
    const { user_id = "italo", month, salary } = await request.json();
    await sql`
      INSERT INTO plan_salary (user_id, month, salary)
      VALUES (${user_id}, ${month}, ${salary})
      ON CONFLICT (user_id, month) DO UPDATE SET salary = ${salary}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/plan-salary]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
