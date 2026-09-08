import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import sql from "@/lib/db";

// Rota de setup único — cria tabela e usuários iniciais
// Acesse GET /api/auth/setup uma vez após o deploy
export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) UNIQUE NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        color VARCHAR(20) DEFAULT '#3b82f6',
        is_active BOOLEAN DEFAULT true,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS investment_profile VARCHAR(50) DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS goal_target DECIMAL(12,2) DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS goal_deadline_year INT DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS goal_monthly_contribution DECIMAL(12,2) DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS paid_until DATE DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS plan VARCHAR(30) DEFAULT 'assinante'`;
    // Alocação-alvo personalizada (null = usa o preset do perfil)
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS target_renda_fixa SMALLINT DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS target_acoes SMALLINT DEFAULT NULL`;
    await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS target_fii SMALLINT DEFAULT NULL`;

    const existing = await sql`SELECT id FROM app_users LIMIT 1`;
    if (existing.length > 0) {
      const admin = await requireAdmin();
      if (admin instanceof NextResponse) {
        return NextResponse.json({ error: "Setup já executado" }, { status: 403 });
      }
      await sql`UPDATE app_users SET is_admin = true WHERE user_id = 'italo'`;
      return NextResponse.json({
        ok: true,
        message: "Setup já executado. Schema atualizado.",
      });
    }

    const defaultPassword = process.env.DEFAULT_PASSWORD ?? "ibank2026";
    const hash = await bcrypt.hash(defaultPassword, 12);

    await sql`
      INSERT INTO app_users (user_id, username, name, password_hash, color, is_admin)
      VALUES
        ('italo',   'italo',   'Italo',   ${hash}, '#3b82f6', true),
        ('natalia', 'natalia', 'Natalia', ${hash}, '#ec4899', false)
      ON CONFLICT (user_id) DO NOTHING
    `;

    return NextResponse.json({
      ok: true,
      message: "Tabela criada e usuários iniciais configurados. Use DEFAULT_PASSWORD from env para login.",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
