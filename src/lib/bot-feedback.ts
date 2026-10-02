/** "genio": pedido que o MUVO Gênio do Planejamento não entendeu. */
export type FeedbackKind = "up" | "down" | "sem_resposta" | "genio";

export const FEEDBACK_KINDS: FeedbackKind[] = ["up", "down", "sem_resposta"];

const MAX_TEXT = 2000;

/** Normaliza o texto salvo: sem espaços extras e com tamanho limitado. */
export function feedbackText(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) : "";
}

const UNANSWERED = [
  /n[aã]o (tenho|encontrei|consigo|sei|possuo|h[aá]) (essa|esta|essas|estas|a|as|informa|dados|como)/i,
  /n[aã]o (tenho|possuo) acesso/i,
  /(falta|faltam|sem) (essa |esses |os |a )?(informa[cç](ão|ões)|dados)/i,
  /fora (do|dos) (meu|meus) (escopo|dados)/i,
];

/** A resposta da IA admite que não sabe responder: vale registrar a pergunta para ensinar o bot. */
export function looksUnanswered(reply: string): boolean {
  const head = reply.slice(0, 400);
  return UNANSWERED.some((re) => re.test(head));
}
