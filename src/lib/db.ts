import postgres from "postgres";

// prepare: false porque o pooler do Supabase em modo transação não guarda comandos preparados entre conexões.
// onnotice silencia os avisos de "já existe" dos CREATE TABLE IF NOT EXISTS.
const create = () =>
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 8,
    idle_timeout: 20,
    // Sem isso, o pool pode ficar esperando conexão/query sem limite e a splash do app nunca termina.
    connect_timeout: 10,
    // Corta queries presas (DDL/lock) antes do cliente estourar o timeout da splash.
    connection: { statement_timeout: 15_000 },
    max_lifetime: 60 * 30,
    onnotice: () => {},
  });

// Versão sobe quando as opções do pool mudam — evita reusar cliente antigo no hot reload do Next.
const SQL_POOL_VERSION = 3;
const cache = globalThis as unknown as {
  __sql?: ReturnType<typeof create>;
  __sqlPoolVersion?: number;
};
if (process.env.NODE_ENV !== "production") {
  if (cache.__sql && cache.__sqlPoolVersion !== SQL_POOL_VERSION) {
    void cache.__sql.end({ timeout: 1 }).catch(() => {});
    cache.__sql = undefined;
  }
  cache.__sql ??= create();
  cache.__sqlPoolVersion = SQL_POOL_VERSION;
}
const sql = cache.__sql ?? create();

export default sql;
