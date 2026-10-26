import { timingSafeEqual } from "node:crypto";
import cardapioSql from "@/lib/cardapio-db";
import { json } from "@/lib/cardapio-acesso";
import { configurarPush, webpush } from "@/lib/push";
import { normalizePhone, sendTemplate, templateParam, whatsappConfig } from "@/lib/whatsapp";

const PAINEL = process.env.PAINEL_URL?.trim() || "https://painel-cardapio.pages.dev";

const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function segredoValido(recebido: string | null): boolean {
  const esperado = process.env.NOTIFICAR_SEGREDO ?? "";
  if (!recebido || !esperado) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Chamado pelo banco a cada pedido novo (gatilho pedidos_avisar).
 * Manda push para os aparelhos da pizzaria e, se configurado, o alerta por WhatsApp.
 */
export async function POST(request: Request) {
  if (!segredoValido(request.headers.get("x-segredo"))) return json({ error: "Não autorizado" }, 401);

  const pedido = (await request.json().catch(() => null)) as {
    slug?: string;
    numero?: number;
    total?: number | string;
    pagamento?: string;
  } | null;
  if (!pedido?.slug || pedido.numero === undefined) return json({ error: "Pedido inválido" }, 400);

  const total = Number(pedido.total ?? 0);
  const titulo = `Novo pedido #${pedido.numero}`;
  const corpo = `${pedido.pagamento ?? "Pedido"} · ${moeda(total)}`;

  let enviados = 0;
  if (configurarPush()) {
    const aparelhos = await cardapioSql`SELECT id, endpoint, p256dh, auth FROM public.push_inscricoes WHERE pizzaria_slug = ${pedido.slug}`;
    const payload = JSON.stringify({ title: titulo, body: corpo, url: PAINEL });
    for (const a of aparelhos) {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload, { TTL: 3600 });
        enviados += 1;
      } catch (e) {
        // Aparelho que não aceita mais notificações (expirou ou foi revogado): remove a inscrição
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await cardapioSql`DELETE FROM public.push_inscricoes WHERE id = ${a.id}`;
        }
      }
    }
  }

  // Alerta por WhatsApp: precisa da conta da Meta e de um modelo aprovado (WHATSAPP_TEMPLATE_PEDIDO)
  let whatsapp: "enviado" | "desligado" | "sem-numero" = "desligado";
  const cfg = whatsappConfig();
  const modelo = process.env.WHATSAPP_TEMPLATE_PEDIDO?.trim();
  if (cfg && modelo) {
    const [linha] = await cardapioSql`SELECT pizzaria FROM public.pizzarias WHERE slug = ${pedido.slug}`;
    const numero = normalizePhone(String(linha?.pizzaria?.pedidos?.avisoWhatsapp ?? ""));
    if (!numero) {
      whatsapp = "sem-numero";
    } else {
      await sendTemplate(cfg, numero, modelo, [
        {
          type: "body",
          parameters: [templateParam(String(pedido.numero)), templateParam(moeda(total)), templateParam(pedido.pagamento ?? "")],
        },
      ]);
      whatsapp = "enviado";
    }
  }

  return json({ ok: true, push: enviados, whatsapp });
}
