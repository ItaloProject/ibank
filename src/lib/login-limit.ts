import { createHash } from "node:crypto";
import sql from "@/lib/db";
import { extrairIp } from "@/lib/limite-envios";

/*
 * Limite de tentativas de entrada: quem erra a senha várias vezes fica bloqueado por um tempo.
 * O estado fica no banco (não em memória) porque a Vercel roda várias instâncias.
 * Guarda só o hash do IP, nunca o IP.
 */

/** Janela em que as falhas são contadas, e tempo de bloqueio quando o limite estoura. */
export const JANELA_MIN = 15;
export const BLOQUEIO_MIN = 15;
/** Falhas permitidas por usuário e por origem (IP) dentro da janela. */
export const LIMITE_POR_USUARIO = 5;
export const LIMITE_POR_IP = 20;

export type ChaveLimite = { chave: string; limite: number };

function hashDe(prefixo: string, valor: string): string {
  return createHash("sha256").update(`${prefixo}:${valor}`).digest("hex");
}

/** As chaves de uma tentativa de entrada: uma por usuário e outra por origem. */
export function chavesDeLogin(username: string, cabecalhos: Headers): ChaveLimite[] {
  const usuario = username.toLowerCase().trim().slice(0, 80);
  return [
    { chave: `u:${hashDe("login-u", usuario)}`, limite: LIMITE_POR_USUARIO },
    { chave: `ip:${hashDe("login-ip", extrairIp(cabecalhos))}`, limite: LIMITE_POR_IP },
  ];
}

/** Chave da troca de senha de uma conta logada. */
export function chaveTrocaSenha(userId: string): ChaveLimite {
  return { chave: `pw:${hashDe("troca-senha", userId)}`, limite: LIMITE_POR_USUARIO };
}

/** Segundos que faltam para o bloqueio acabar (0 se não há bloqueio). */
export function segundosRestantes(bloqueadoAte: Date | null, agora: Date): number {
  if (!bloqueadoAte) return 0;
  return Math.max(0, Math.ceil((bloqueadoAte.getTime() - agora.getTime()) / 1000));
}

export function mensagemBloqueio(segundos: number): string {
  const minutos = Math.max(1, Math.ceil(segundos / 60));
  return `Muitas tentativas. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`;
}

let tabelaPronta = false;
async function garantirTabela() {
  if (tabelaPronta) return;
  await sql`
    CREATE TABLE IF NOT EXISTS login_attempts (
      chave TEXT PRIMARY KEY,
      falhas INTEGER NOT NULL DEFAULT 0,
      primeira_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      bloqueado_ate TIMESTAMPTZ
    )
  `;
  tabelaPronta = true;
}

/** Se alguma das chaves está bloqueada, devolve os segundos até liberar. Senão, 0. */
export async function bloqueioAtivo(chaves: ChaveLimite[]): Promise<number> {
  await garantirTabela();
  const lista = chaves.map((c) => c.chave);
  const rows = await sql`
    SELECT MAX(bloqueado_ate) AS ate FROM login_attempts
    WHERE chave IN ${sql(lista)} AND bloqueado_ate > NOW()
  `;
  const ate = rows[0]?.ate ? new Date(rows[0].ate as string) : null;
  return segundosRestantes(ate, new Date());
}

/**
 * Soma uma falha em cada chave; ao passar do limite, bloqueia.
 * Devolve as chaves que acabaram de ser bloqueadas nesta chamada (para disparar alerta uma vez).
 */
export async function registrarFalha(chaves: ChaveLimite[]): Promise<string[]> {
  await garantirTabela();
  const bloqueadas: string[] = [];
  for (const { chave, limite } of chaves) {
    await sql`
      INSERT INTO login_attempts (chave, falhas, primeira_em)
      VALUES (${chave}, 1, NOW())
      ON CONFLICT (chave) DO UPDATE SET
        falhas = CASE WHEN login_attempts.primeira_em < NOW() - (${JANELA_MIN}::int * interval '1 minute') THEN 1 ELSE login_attempts.falhas + 1 END,
        primeira_em = CASE WHEN login_attempts.primeira_em < NOW() - (${JANELA_MIN}::int * interval '1 minute') THEN NOW() ELSE login_attempts.primeira_em END
    `;
    // Só “novo” bloqueio: se já estava bloqueado, não dispara outro alerta.
    const rows = await sql`
      UPDATE login_attempts
      SET bloqueado_ate = NOW() + (${BLOQUEIO_MIN}::int * interval '1 minute')
      WHERE chave = ${chave}
        AND falhas >= ${limite}::int
        AND (bloqueado_ate IS NULL OR bloqueado_ate <= NOW())
      RETURNING chave
    `;
    if (rows[0]?.chave) bloqueadas.push(String(rows[0].chave));
  }
  // Limpeza ocasional de linhas antigas.
  if (Math.random() < 0.02) {
    await sql`
      DELETE FROM login_attempts
      WHERE primeira_em < NOW() - interval '1 day' AND (bloqueado_ate IS NULL OR bloqueado_ate < NOW())
    `;
  }
  return bloqueadas;
}

/** Zera as falhas das chaves (entrada com sucesso). */
export async function limparFalhas(chaves: ChaveLimite[]): Promise<void> {
  await garantirTabela();
  const lista = chaves.map((c) => c.chave);
  await sql`DELETE FROM login_attempts WHERE chave IN ${sql(lista)}`;
}
