import webpush from "web-push";

/** Configura o envio de notificações web push (chaves VAPID vindas do ambiente). */
export function configurarPush(): boolean {
  const publica = process.env.VAPID_PUBLIC_KEY?.trim();
  const privada = process.env.VAPID_PRIVATE_KEY?.trim();
  const contato = process.env.VAPID_SUBJECT?.trim();
  if (!publica || !privada || !contato) return false;
  webpush.setVapidDetails(contato, publica, privada);
  return true;
}

export { webpush };
