import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import sql from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
    }

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

    const token = await signToken({
      userId: user.user_id,
      name: user.name,
      color: user.color,
      isAdmin: user.is_admin ?? false,
      investmentProfile: user.investment_profile ?? undefined,
    });

    const response = NextResponse.json({
      ok: true,
      user: { id: user.user_id, name: user.name, color: user.color, isAdmin: user.is_admin ?? false, investmentProfile: user.investment_profile ?? null },
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
