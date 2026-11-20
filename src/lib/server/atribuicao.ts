import { missingColumns, runDdl } from "@/lib/schema-check";
import { atribuicaoDoCookie, CAMPOS_UTM, type Atribuicao } from "@/lib/atribuicao";

let userColsEnsured = false;
let leadColsEnsured = false;

/** Colunas de origem nas contas. Só faz ALTER se faltar alguma (mesmo cuidado das outras `ensure*`). */
export async function ensureAtribuicaoColumns() {
  if (userColsEnsured) return;
  if ((await missingColumns("app_users", [...CAMPOS_UTM])).length > 0) {
    await runDdl(async (tx) => {
      await tx`
        ALTER TABLE app_users
          ADD COLUMN IF NOT EXISTS utm_source VARCHAR(60) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(60) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(60) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS utm_content VARCHAR(60) DEFAULT NULL
      `;
    });
  }
  userColsEnsured = true;
}

/** Mesmas colunas na tabela de leads do /comecar (a tabela é criada na primeira chamada da rota). */
export async function ensureLeadsAtribuicaoColumns() {
  if (leadColsEnsured) return;
  if ((await missingColumns("leads", [...CAMPOS_UTM])).length > 0) {
    await runDdl(async (tx) => {
      await tx`
        ALTER TABLE leads
          ADD COLUMN IF NOT EXISTS utm_source VARCHAR(60) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(60) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(60) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS utm_content VARCHAR(60) DEFAULT NULL
      `;
    });
  }
  leadColsEnsured = true;
}

/** Origem guardada no navegador de quem fez a requisição (ou nulos, se não veio de um link com utm). */
export function atribuicaoDaRequisicao(request: Request): Required<Record<keyof Atribuicao, string | null>> {
  const atrib = atribuicaoDoCookie(request.headers.get("cookie"));
  return {
    utm_source: atrib?.utm_source ?? null,
    utm_medium: atrib?.utm_medium ?? null,
    utm_campaign: atrib?.utm_campaign ?? null,
    utm_content: atrib?.utm_content ?? null,
  };
}
