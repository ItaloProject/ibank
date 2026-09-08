import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db";
import { ensureSubscriptionColumns } from "@/lib/subscription";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  await ensureSubscriptionColumns();

  const { id } = await params;
  const body = await request.json();

  if (typeof body.is_active === "boolean") {
    await sql`UPDATE app_users SET is_active = ${body.is_active} WHERE id = ${id}`;
  }
  if (body.password) {
    const hash = await bcrypt.hash(body.password, 12);
    await sql`UPDATE app_users SET password_hash = ${hash} WHERE id = ${id}`;
  }
  if (body.name) {
    await sql`UPDATE app_users SET name = ${body.name} WHERE id = ${id}`;
  }
  if (body.color) {
    await sql`UPDATE app_users SET color = ${body.color} WHERE id = ${id}`;
  }
  if (typeof body.bot_enabled === "boolean") {
    await sql`UPDATE app_users SET bot_enabled = ${body.bot_enabled} WHERE id = ${id}`;
    if (body.bot_enabled) {
      await sql`UPDATE app_users SET plan = 'completo' WHERE id = ${id}`;
    } else {
      await sql`UPDATE app_users SET plan = 'assinante' WHERE id = ${id}`;
    }
  }
  if (body.paid_until !== undefined) {
    const until = body.paid_until ? String(body.paid_until).slice(0, 10) : null;
    await sql`UPDATE app_users SET paid_until = ${until} WHERE id = ${id}`;
  }
  if (body.plan === "assinante" || body.plan === "completo") {
    const withBot = body.plan === "completo";
    await sql`
      UPDATE app_users
      SET plan = ${body.plan}, bot_enabled = ${withBot}
      WHERE id = ${id}
    `;
  }
  if (typeof body.extend_days === "number" && body.extend_days > 0) {
    await sql`
      UPDATE app_users
      SET paid_until = (
        GREATEST(COALESCE(paid_until, CURRENT_DATE), CURRENT_DATE)
        + (${body.extend_days}::int)
      )
      WHERE id = ${id}
    `;
  }

  const [user] = await sql`
    SELECT id, user_id, username, name, color, is_active, is_admin, created_at,
           bot_enabled, paid_until, plan
    FROM app_users WHERE id = ${id}
  `;
  return NextResponse.json(user);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  await sql`DELETE FROM app_users WHERE id = ${id} AND is_admin = false`;
  return NextResponse.json({ ok: true });
}
