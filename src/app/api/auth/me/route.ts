import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import sql from "@/lib/db";
import {
  ensureSubscriptionColumns,
  hasBotAccess,
  isSubscriptionActive,
} from "@/lib/subscription";

export async function GET() {
  const payload = await getSession();
  if (!payload) return NextResponse.json({ user: null }, { status: 401 });

  try {
    await ensureSubscriptionColumns();
    const rows = await sql`
      SELECT user_id, name, color, is_admin, is_active, investment_profile,
             bot_enabled, paid_until, plan
      FROM app_users WHERE user_id = ${payload.userId}
    `;
    const user = rows[0];
    if (!user || user.is_active === false) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.user_id,
        name: user.name,
        color: user.color,
        isAdmin: user.is_admin ?? false,
        investmentProfile: user.investment_profile ?? null,
        botEnabled: hasBotAccess(user),
        subscriptionActive: isSubscriptionActive(user),
        paidUntil: user.paid_until ? String(user.paid_until).slice(0, 10) : null,
        plan: user.plan ?? "assinante",
      },
    });
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json({
      user: {
        id: payload.userId,
        name: payload.name,
        color: payload.color,
        isAdmin: payload.isAdmin ?? false,
        investmentProfile: payload.investmentProfile ?? null,
        botEnabled: payload.botEnabled ?? false,
        subscriptionActive: true,
        paidUntil: null,
        plan: "assinante",
      },
    });
  }
}
