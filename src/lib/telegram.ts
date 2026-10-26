/**
 * Bot do Telegram que avisa o dono a cada pedido novo.
 * Usa a API oficial do Telegram: sem risco de banimento de número.
 */
export function telegramToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export function telegramBotUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") || null;
}

/** Segredo que o Telegram envia em cada chamada ao webhook (header X-Telegram-Bot-Api-Secret-Token) */
export function telegramSegredo(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
}

export type TelegramResultado = "ok" | "bloqueado" | "erro";

/** Envia texto simples. Retorna "bloqueado" quando o dono apagou ou bloqueou o bot. */
export async function enviarTelegram(chatId: number | string, texto: string): Promise<TelegramResultado> {
  const token = telegramToken();
  if (!token) return "erro";
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: texto, disable_web_page_preview: true }),
    cache: "no-store",
  });
  if (r.ok) return "ok";
  if (r.status === 403 || r.status === 400) return "bloqueado";
  return "erro";
}
