import postgres from "postgres";

// Banco do cardápio (projeto Supabase "Muvo foods"). Só o servidor do Muvo usa esta conexão.
const create = () => {
  const url = process.env.CARDAPIO_DATABASE_URL;
  if (!url) throw new Error("CARDAPIO_DATABASE_URL não configurada");
  return postgres(url, { ssl: "require", prepare: false, max: 3, idle_timeout: 20, onnotice: () => {} });
};

const cache = globalThis as unknown as { __cardapioSql?: ReturnType<typeof create> };
const cardapioSql = cache.__cardapioSql ?? create();
if (process.env.NODE_ENV !== "production") cache.__cardapioSql = cardapioSql;

export default cardapioSql;

const SLUG = /^[a-z0-9][a-z0-9-]{0,48}$/;
export function slugValido(slug: string) {
  return SLUG.test(slug);
}

export const SUPABASE_URL = process.env.CARDAPIO_SUPABASE_URL ?? "";
