import { BLOQUEIO_MIN } from "@/lib/login-limit";
import { emailConfigurado, enviarEmail } from "@/lib/server/email";

export type AlertaBloqueio = {
  /** E-mail da conta (se houver). */
  email?: string | null;
  /** Nome ou usuário só para o texto — nunca IP. */
  quem: string;
  motivo: "login" | "senha";
  /** Chave do bloqueio: serve de idempotência junto com a janela. */
  chaveBloqueio: string;
};

/**
 * Avisa o dono da conta (e o admin, se EMAIL_ALERTA_ADMIN) quando o login ou a troca de senha é bloqueada.
 * Fire-and-forget: falha de e-mail não atrasa a resposta 429.
 */
export function avisarBloqueioLogin(alerta: AlertaBloqueio): void {
  if (!emailConfigurado()) return;

  const destinos = new Set<string>();
  const emailConta = alerta.email?.trim().toLowerCase();
  if (emailConta) destinos.add(emailConta);
  const admin = process.env.EMAIL_ALERTA_ADMIN?.trim().toLowerCase();
  if (admin) destinos.add(admin);
  if (destinos.size === 0) return;

  const acao = alerta.motivo === "senha" ? "troca de senha" : "entrada na conta";
  const assunto = `MUVO: bloqueio temporário (${alerta.quem})`;
  const texto = [
    `Olá,`,
    ``,
    `Detectamos várias tentativas falhas de ${acao} na conta "${alerta.quem}".`,
    `Por segurança, novas tentativas ficam bloqueadas por cerca de ${BLOQUEIO_MIN} minutos.`,
    ``,
    `Se foi você, espere o tempo passar e tente de novo (ou use "Esqueci a senha" / Google, se tiver).`,
    `Se não foi você, troque a senha assim que puder entrar e fale conosco.`,
    ``,
    `— MUVO`,
  ].join("\n");

  const chaveDia = new Date().toISOString().slice(0, 13); // 1 e-mail por hora por chave
  void enviarEmail({
    para: [...destinos],
    assunto,
    texto,
    idempotencyKey: `bloqueio/${alerta.motivo}/${alerta.chaveBloqueio}/${chaveDia}`,
  }).catch((err) => console.error("[alerta-login]", err));
}
