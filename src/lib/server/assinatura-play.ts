import sql from "@/lib/db";
import {
  consultarAssinatura,
  confirmarAssinatura,
  diaDoFimDoAcesso,
  hashDoToken,
  identificadorDeConta,
  interpretarAssinatura,
  planoDoProduto,
  type SituacaoDaAssinatura,
} from "@/lib/server/play-billing";

let tabelaPronta = false;
async function garantirTabela() {
  if (tabelaPronta) return;
  await sql`
    CREATE TABLE IF NOT EXISTS play_purchases (
      token_hash TEXT PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      product_id TEXT NOT NULL,
      state TEXT NOT NULL,
      expiry_time TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS play_purchases_user_idx ON play_purchases (user_id)`;
  tabelaPronta = true;
}

export type ResultadoCompra =
  | { ok: true; plano: string; pagoAte: string | null; estado: string }
  | { ok: false; status: number; codigo: string; erro: string };

/** De quem é essa compra, se já foi registrada. */
async function donoDoToken(tokenHash: string): Promise<string | null> {
  const rows = await sql`SELECT user_id FROM play_purchases WHERE token_hash = ${tokenHash}`;
  return rows.length > 0 ? String(rows[0].user_id) : null;
}

/** Grava a compra e libera (ou não) o acesso conforme a situação lida no Google. */
async function aplicar(userId: string, tokenHash: string, s: SituacaoDaAssinatura): Promise<{ plano: string; pagoAte: string | null } | null> {
  const produto = s.productId ? planoDoProduto(s.productId) : null;
  if (!produto || !s.productId) return null;
  await sql`
    INSERT INTO play_purchases (token_hash, user_id, product_id, state, expiry_time, updated_at)
    VALUES (${tokenHash}, ${userId}, ${s.productId}, ${s.estado}, ${s.acessoAte?.toISOString() ?? null}, NOW())
    ON CONFLICT (token_hash) DO UPDATE SET
      product_id = EXCLUDED.product_id, state = EXCLUDED.state, expiry_time = EXCLUDED.expiry_time, updated_at = NOW()
  `;
  if (!s.acessoAte) return { plano: produto.plano, pagoAte: null };
  const dia = diaDoFimDoAcesso(s.acessoAte);
  // Mantém o maior prazo (quem também pagou por fora não perde dias) e nunca mexe em conta de administração.
  const rows = await sql`
    UPDATE app_users
    SET plan = ${produto.plano},
        bot_enabled = ${produto.bot},
        paid_until = GREATEST(COALESCE(paid_until, ${dia}::date), ${dia}::date)
    WHERE user_id = ${userId} AND is_admin = false
    RETURNING paid_until
  `;
  const pagoAte = rows[0]?.paid_until ? String(rows[0].paid_until).slice(0, 10) : dia;
  return { plano: produto.plano, pagoAte };
}

/** Compra feita no app: o usuário manda o token, conferimos no Google e liberamos. */
export async function registrarCompraDoApp(userId: string, purchaseToken: string, productIdInformado: string): Promise<ResultadoCompra> {
  await garantirTabela();
  const hash = hashDoToken(purchaseToken);

  const dono = await donoDoToken(hash);
  if (dono && dono !== userId) {
    return { ok: false, status: 409, codigo: "COMPRA_DE_OUTRA_CONTA", erro: "Esta compra já está ligada a outra conta." };
  }

  const bruta = await consultarAssinatura(purchaseToken);
  if (!bruta) return { ok: false, status: 400, codigo: "COMPRA_INVALIDA", erro: "Não encontramos essa compra na Google Play." };
  const situacao = interpretarAssinatura(bruta);

  // A compra precisa ter sido feita com o identificador da conta que está pedindo.
  if (situacao.contaId !== identificadorDeConta(userId)) {
    return { ok: false, status: 403, codigo: "COMPRA_DE_OUTRA_CONTA", erro: "Esta compra pertence a outra conta." };
  }
  if (!situacao.productId || !planoDoProduto(situacao.productId) || situacao.productId !== productIdInformado) {
    return { ok: false, status: 400, codigo: "PRODUTO_INVALIDO", erro: "Produto desconhecido." };
  }

  const aplicado = await aplicar(userId, hash, situacao);
  if (!aplicado) return { ok: false, status: 400, codigo: "PRODUTO_INVALIDO", erro: "Produto desconhecido." };
  if (situacao.confirmar && situacao.acessoAte) await confirmarAssinatura(situacao.productId, purchaseToken);

  return { ok: true, plano: aplicado.plano, pagoAte: aplicado.pagoAte, estado: situacao.estado };
}

/** Aviso do Google (renovou, cancelou, expirou...): relê a assinatura e atualiza a conta dona do token. */
export async function atualizarPorNotificacao(purchaseToken: string): Promise<"atualizada" | "desconhecida"> {
  await garantirTabela();
  const hash = hashDoToken(purchaseToken);
  const dono = await donoDoToken(hash);
  // Ainda não registramos essa compra (o app pode não ter avisado): o Google reenvia depois e o app registra ao abrir.
  if (!dono) return "desconhecida";
  const bruta = await consultarAssinatura(purchaseToken);
  if (!bruta) return "desconhecida";
  const situacao = interpretarAssinatura(bruta);
  await aplicar(dono, hash, situacao);
  if (situacao.confirmar && situacao.acessoAte && situacao.productId) await confirmarAssinatura(situacao.productId, purchaseToken);
  return "atualizada";
}
