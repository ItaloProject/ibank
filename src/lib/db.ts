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
    max_lifetime: 60 * 30,
    onnotice: () => {},
  });

const cache = globalThis as unknown as { __sql?: ReturnType<typeof create> };
const sql = cache.__sql ?? create();
if (process.env.NODE_ENV !== "production") cache.__sql = sql;

export default sql;
