import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db";
import { addDaysISO, ensureSubscriptionColumns } from "@/lib/subscription";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  await ensureSubscriptionColumns();

  const rows = await sql`
    SELECT id, user_id, username, name, color, is_active, is_admin, created_at,
           bot_enabled, paid_until, plan
    FROM app_users ORDER BY created_at ASC
  `;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  await ensureSubscriptionColumns();

  const body = await request.json();
  const {
    username, name, password, color, is_admin,
    bot_enabled = false,
    plan = "assinante",
    paid_days = 30,
    paid_until,
  } = body;

  if (!username || !name || !password) {
    return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  const user_id = username.toLowerCase().trim().replace(/\s+/g, "_");
  const until = paid_until
    ? String(paid_until).slice(0, 10)
    : addDaysISO(Number(paid_days) || 30);
  const withBot = Boolean(bot_enabled) || plan === "completo";
  const planValue = withBot ? "completo" : (plan === "completo" ? "completo" : "assinante");

  try {
    const [user] = await sql`
      INSERT INTO app_users (
        user_id, username, name, password_hash, color, is_admin,
        bot_enabled, paid_until, plan, is_active
      )
      VALUES (
        ${user_id}, ${username.toLowerCase().trim()}, ${name}, ${hash},
        ${color ?? "#3b82f6"}, ${is_admin ?? false},
        ${withBot}, ${until}, ${planValue}, true
      )
      RETURNING id, user_id, username, name, color, is_active, is_admin, created_at,
                bot_enabled, paid_until, plan
    `;
    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Usuário já existe" }, { status: 409 });
  }
}
