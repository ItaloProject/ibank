import sql from "@/lib/db";

/**
 * Checagens de esquema que só leem o catálogo. Ao contrário do ALTER TABLE, que pede um bloqueio
 * exclusivo mesmo quando a coluna já existe e faz todas as outras consultas da tabela esperarem na
 * fila, aqui nada trava: o ALTER só roda quando algo realmente falta.
 */
export async function missingColumns(table: string, columns: string[]): Promise<string[]> {
  const rows = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ${table} AND column_name = ANY(${columns})
  `;
  const have = new Set(rows.map((r) => String(r.column_name)));
  return columns.filter((c) => !have.has(c));
}

export async function missingTables(tables: string[]): Promise<string[]> {
  const found = await Promise.all(
    tables.map(async (t) => {
      const rows = await sql`SELECT to_regclass(${t}::text) IS NOT NULL AS ok`;
      return Boolean(rows[0]?.ok);
    }),
  );
  return tables.filter((_, i) => !found[i]);
}

/** Roda alterações de esquema numa transação que desiste em vez de esperar na fila de bloqueios. */
export async function runDdl(work: (tx: typeof sql) => Promise<unknown>): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`SET LOCAL lock_timeout = '5s'`;
    await work(tx as unknown as typeof sql);
  });
}
