import sql from "@/lib/db";

/**
 * Apaga a conta e todos os dados do usuário: todas as tabelas com coluna user_id, numa transação só,
 * e por último a própria conta. Nunca apaga administradores. Devolve true se a conta existia e foi apagada.
 * Usada pela exclusão pedida pela pessoa (DELETE /api/account) e pela limpeza automática de contas de teste.
 */
export async function excluirContaDoUsuario(userId: string): Promise<boolean> {
  const tabelas = (
    await sql`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'user_id'
      ORDER BY table_name
    `
  )
    .map((r) => String(r.table_name))
    .filter((t) => /^[a-z_][a-z0-9_]*$/.test(t) && t !== "app_users");

  return sql.begin(async (tx) => {
    for (const tabela of tabelas) {
      await tx`DELETE FROM ${tx(tabela)} WHERE user_id = ${userId}`;
    }
    const apagadas = await tx`DELETE FROM app_users WHERE user_id = ${userId} AND is_admin = false RETURNING 1`;
    return apagadas.length > 0;
  });
}
