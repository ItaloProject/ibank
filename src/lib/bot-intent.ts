export type Intent = "visao" | "rebal" | "fiis" | "meta" | "whatsapp" | "perfil" | "pdf" | "avisos" | "help";

function normalize(raw: string): string {
  return raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Assunto indicado por palavra-chave, sem olhar se é pergunta ou pedido. */
export function keywordIntent(raw: string): Intent | null {
  const t = normalize(raw);
  if (/quanto falta|minha meta|quando chego|que ano|prazo da meta|ritmo atual/.test(t)) return "meta";
  if (/whats|zap|relator/.test(t)) return "whatsapp";
  if (/pdf|baixar|download|imprim/.test(t)) return "pdf";
  if (/perfil|conservador|moderado|arrojado/.test(t)) return "perfil";
  if (/aviso|alerta/.test(t)) return "avisos";
  if (/rebalanc|equilibr|onde aportar|aloca/.test(t)) return "rebal";
  if (/^(visao|resumo|diagnostico|score|minha carteira)/.test(t)) return "visao";
  return null;
}

const QUESTION = /\?\s*$|^(o que|oque|como|por ?que|pq|qual|quais|quanto|quando|onde|devo|vale|posso|sera|e se|explica|me explica|me fala|diferenca)\b/;

/** Perguntas que as respostas prontas respondem melhor que a IA (números já calculados). */
const TEMPLATE_QUESTION = /quanto falta|quando chego|que ano chego|onde aportar|tenho (algum )?aviso/;

/**
 * Atalhos para pedidos curtos e diretos ("rebalancear", "meu PDF"); perguntas e mensagens longas vão para a IA ("help").
 */
export function detectIntent(raw: string): Intent {
  const t = normalize(raw);
  if (t.split(/\s+/).length > 7) return "help";
  if (QUESTION.test(t) && !TEMPLATE_QUESTION.test(t)) return "help";
  return keywordIntent(t) ?? "help";
}
