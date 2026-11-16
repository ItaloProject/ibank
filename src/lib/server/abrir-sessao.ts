import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession, signToken } from "@/lib/auth";
import { describeDevice, isSessionAlive } from "@/lib/session";
import { hasBotAccess, isSubscriptionActive } from "@/lib/subscription";
import { hasSeenCarteira, needsRiskQuiz } from "@/lib/onboarding";
import { dataDeExclusao, diasDeTesteRestantes, testeAtivo } from "@/lib/trial";
import { billingConfigurado, identificadorDeConta } from "@/lib/server/play-billing";

type LinhaUsuario = {
  user_id: string;
  name: string;
  color: string;
  is_admin?: boolean | null;
  is_active?: boolean | null;
  investment_profile?: string | null;
  carteira_vista_profile?: string | null;
  risk_profile?: string | null;
  risk_quiz_at?: unknown;
  bot_enabled?: boolean | null;
  paid_until?: string | Date | null;
  plan?: string | null;
  google_sub?: string | null;
  trial_ends_at?: string | Date | null;
  active_session_id?: string | null;
  session_started_at?: string | Date | null;
  session_device?: string | null;
};

/** O que o app e o site recebem sobre o usuário logado. Igual em /login, /google e /me. */
export function dadosDoUsuario(user: LinhaUsuario) {
  const fimTeste = (user.trial_ends_at as string | Date | null | undefined) ?? null;
  return {
    id: user.user_id,
    name: user.name,
    color: user.color,
    isAdmin: (user.is_admin as boolean | null) ?? false,
    investmentProfile: (user.investment_profile as string | null) ?? null,
    carteiraVista: hasSeenCarteira(user),
    needsRiskQuiz: needsRiskQuiz(user),
    botEnabled: hasBotAccess(user),
    subscriptionActive: isSubscriptionActive(user),
    paidUntil: user.paid_until ? String(user.paid_until).slice(0, 10) : null,
    plan: (user.plan as string | null) ?? "assinante",
    // Entrou com o Google (sem senha): a exclusão de conta confirma sem pedir senha.
    loginGoogle: Boolean(user.google_sub),
    // Compra pela Google Play: o app manda este identificador junto com a compra, e o servidor confere.
    billingAccountId: identificadorDeConta(user.user_id),
    billingDisponivel: billingConfigurado(),
    // Teste grátis: quando acaba e quantos dias faltam (0 se não há teste ou já acabou).
    trialEndsAt: fimTeste ? new Date(fimTeste).toISOString() : null,
    trialActive: testeAtivo(fimTeste),
    trialDaysLeft: diasDeTesteRestantes(fimTeste),
    // Conta de teste que não assinou: dia em que os dados serão apagados (só depois que o teste acabou).
    dataExclusao:
      user.plan === "teste" && !user.paid_until && fimTeste && !testeAtivo(fimTeste)
        ? (dataDeExclusao(fimTeste)?.toISOString() ?? null)
        : null,
  };
}

/**
 * Abre a sessão de um usuário já autenticado (senha ou Google): só vale um login por conta.
 * Se já existe outro aparelho, pergunta antes de desconectá-lo (a menos que `force`);
 * entrar de novo no mesmo aparelho (cookie com a sessão atual) não pergunta nada.
 */
export async function abrirSessao(request: Request, user: LinhaUsuario, force: boolean): Promise<NextResponse> {
  const activeSessionId = user.active_session_id as string | null | undefined;
  const currentCookieSid = (await getSession())?.sid;
  const otherSession =
    activeSessionId &&
    activeSessionId !== currentCookieSid &&
    isSessionAlive(user.session_started_at as string | Date | null);
  if (otherSession && !force) {
    return NextResponse.json(
      {
        code: "SESSION_ACTIVE",
        error: "Esta conta já está conectada em outro dispositivo.",
        device: (user.session_device as string | null) ?? "outro dispositivo",
        since: new Date(user.session_started_at as string | Date).toISOString(),
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

  const dados = dadosDoUsuario(user);
  const token = await signToken({
    sid,
    userId: user.user_id,
    name: user.name,
    color: user.color,
    isAdmin: dados.isAdmin,
    investmentProfile: dados.investmentProfile ?? undefined,
    botEnabled: dados.botEnabled,
  });

  const response = NextResponse.json({ ok: true, user: dados });
  response.cookies.set("ibank_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
  return response;
}
