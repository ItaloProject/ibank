import postgres from "postgres";

// Banco do painel-admin (projeto Supabase "Painel-Admin"), onde fica a lista Acessos.
// Conexão criada só na primeira vez que é usada, para a falta da variável não derrubar as outras rotas.
let instancia: ReturnType<typeof postgres> | undefined;

export default function painelAdminSql(): ReturnType<typeof postgres> {
  if (!instancia) {
    const url = process.env.PAINEL_ADMIN_DATABASE_URL;
    if (!url) throw new Error("PAINEL_ADMIN_DATABASE_URL não configurada");
    instancia = postgres(url, { ssl: "require", prepare: false, max: 3, idle_timeout: 20, onnotice: () => {} });
  }
  return instancia;
}
