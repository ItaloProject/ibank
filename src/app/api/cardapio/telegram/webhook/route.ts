import { timingSafeEqual } from "node:crypto";
import cardapioSql from "@/lib/cardapio-db";
import { json } from "@/lib/cardapio-acesso";
import { enviarTelegram, telegramSegredo } from "@/lib/telegram";

function segredoValido(recebido: string | null): boolean {
  const esperado = telegramSegredo();
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Recebe as mensagens do bot. "/start <código>" vincula o chat do dono à pizzaria. */
export async function POST(request: Request) {
  if (!segredoValido(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return json({ error: "Não autorizado" }, 401);
  }

  const update = (await request.json().catch(() => null)) as {
    message?: { text?: string; chat?: { id?: number }; from?: { first_name?: string } };
  } | null;
  const chatId = update?.message?.chat?.id;
  const texto = update?.message?.text?.trim() ?? "";
  if (!chatId) return json({ ok: true });

  const achado = texto.match(/^\/start\s+([0-9a-f]{12})$/i);
  if (!achado) {
    await enviarTelegram(chatId, "Para receber os alertas de pedido, abra o painel do cardápio, toque em Conectar Telegram e siga o link.");
    return json({ ok: true });
  }

  const [codigo] = await cardapioSql`
    UPDATE public.telegram_codigos SET usado = true
    WHERE codigo = ${achado[1].toLowerCase()} AND usado = false AND expira_em > now()
    RETURNING pizzaria_slug`;
  if (!codigo) {
    await enviarTelegram(chatId, "Este código expirou ou já foi usado. Gere um novo no painel.");
    return json({ ok: true });
  }

  const nome = update?.message?.from?.first_name ?? "";
  await cardapioSql`
    INSERT INTO public.telegram_destinos (pizzaria_slug, chat_id, nome)
    VALUES (${codigo.pizzaria_slug}, ${chatId}, ${nome})
    ON CONFLICT (pizzaria_slug, chat_id) DO UPDATE SET nome = EXCLUDED.nome`;
  await enviarTelegram(chatId, "Pronto! Você vai receber um aviso aqui a cada pedido novo.");
  return json({ ok: true });
}
