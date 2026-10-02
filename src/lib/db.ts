import postgres from "postgres";

// prepare: false porque o pooler do Supabase em modo transação não guarda comandos preparados entre conexões.
// onnotice silencia os avisos de "já existe" dos CREATE TABLE IF NOT EXISTS.
const create = () =>
  postgres(process.env.DATABASE_URL!, { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {} });

const cache = globalThis as unknown as { __sql?: ReturnType<typeof create> };
const sql = cache.__sql ?? create();
if (process.env.NODE_ENV !== "production") cache.__sql = sql;

export default sql;
