import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import sql from "@/lib/db";
import { getSession, signToken } from "@/lib/auth";
import { describeDevice, ensureSessionColumns, isSessionAlive } from "@/lib/session";
import {
  ensureSubscriptionColumns,
  hasBotAccess,
  isSubscriptionActive,
} from "@/lib/subscription";
import { ensureOnboardingColumns, hasSeenCarteira, needsRiskQuiz } from "@/lib/onboarding";

export async function POST(request: Request) {
  try {
    const { username, password, force } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
    }

    await ensureSubscriptionColumns();
    await ensureOnboardingColumns();
    await ensureSessionColumns();

    const rows = await sql`
      SELECT * FROM app_users WHERE username = ${username.toLowerCase().trim()}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Usuário ou senha incorretos" }, { status: 401 });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return NextResponse.json({ error: "Usuário ou senha incorretos" }, { status: 401 });
    }

    if (user.is_active === false) {
      return NextResponse.json({ error: "Conta desativada. Fale conosco no WhatsApp." }, { status: 403 });
    }

    // Só vale um login por conta. Se já existe outro, pergunta antes de desconectá-lo;
    // entrar de novo no mesmo aparelho (cookie com a sessão atual) não pergunta nada.
    const currentCookieSid = (await getSession())?.sid;
    const otherSession =
      user.active_session_id &&
      user.active_session_id !== currentCookieSid &&
      isSessionAlive(user.session_started_at);
    if (otherSession && force !== true) {
      return NextResponse.json(
        {
          code: "SESSION_ACTIVE",
          error: "Esta conta já está conectada em outro dispositivo.",
          device: user.session_device ?? "outro dispositivo",
          since: new Date(user.session_started_at).toISOString(),
        },
        { status: 409 },
      );
    }

    const sid = crypto.randomUUID();
    await sql`
      UPDATE app_users
      SET active_session_id = ${sid},
          session_device = ${describeDevice(request.headers.get("user-agent"))},
          session_started_at = NOW()
      WHERE user_id = ${user.user_id}
    `;

    const subscriptionActive = isSubscriptionActive(user);
    const botEnabled = hasBotAccess(user);

    const token = await signToken({
      sid,
      userId: user.user_id,
      name: user.name,
      color: user.color,
      isAdmin: user.is_admin ?? false,
      investmentProfile: user.investment_profile ?? undefined,
      botEnabled,
    });

    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.user_id,
        name: user.name,
        color: user.color,
        isAdmin: user.is_admin ?? false,
        investmentProfile: user.investment_profile ?? null,
        carteiraVista: hasSeenCarteira(user),
        needsRiskQuiz: needsRiskQuiz(user),
        botEnabled,
        subscriptionActive,
        paidUntil: user.paid_until ? String(user.paid_until).slice(0, 10) : null,
        plan: user.plan ?? "assinante",
      },
    });

    response.cookies.set("ibank_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
