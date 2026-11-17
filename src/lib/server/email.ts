import { Resend } from "resend";

export type EmailEnvio = {
  para: string | string[];
  assunto: string;
  texto: string;
  html?: string;
  /** Evita reenvio do mesmo alerta se a API repetir a chamada. */
  idempotencyKey?: string;
};

let cliente: Resend | null | undefined;

function resend(): Resend | null {
  if (cliente !== undefined) return cliente;
  const chave = process.env.RESEND_API_KEY?.trim();
  if (!chave) {
    cliente = null;
    return null;
  }
  cliente = new Resend(chave);
  return cliente;
}

/** Remetente: use um endereço do domínio verificado no Resend (ex.: MUVO <seguranca@muvo.dev.br>). */
export function emailRemetente(): string {
  return process.env.EMAIL_FROM?.trim() || "MUVO <seguranca@muvo.dev.br>";
}

/** Sem chave, não envia (dev/local). Em produção, configure RESEND_API_KEY. */
export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Envia um e-mail transacional pelo Resend.
 * Devolve false se não estiver configurado ou se a API recusar — nunca propaga erro ao fluxo de login.
 */
export async function enviarEmail(envio: EmailEnvio): Promise<boolean> {
  const api = resend();
  if (!api) return false;

  const para = (Array.isArray(envio.para) ? envio.para : [envio.para])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (para.length === 0) return false;

  const { error } = await api.emails.send({
    from: emailRemetente(),
    to: para,
    subject: envio.assunto,
    text: envio.texto,
    html: envio.html ?? `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(envio.texto)}</pre>`,
    ...(envio.idempotencyKey ? { idempotencyKey: envio.idempotencyKey.slice(0, 256) } : {}),
  });

  if (error) {
    console.error("[email]", error.message ?? error);
    return false;
  }
  return true;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
