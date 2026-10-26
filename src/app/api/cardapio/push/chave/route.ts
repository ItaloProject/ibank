import { json, opcoes } from "@/lib/cardapio-acesso";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Chave pública usada pelo painel para se inscrever nas notificações */
export async function GET() {
  const chave = process.env.VAPID_PUBLIC_KEY?.trim();
  if (!chave) return json({ error: "Notificações não configuradas" }, 503);
  return json({ publicKey: chave });
}
