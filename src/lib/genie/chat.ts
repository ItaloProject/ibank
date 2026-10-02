import { normalize } from "./calc";
import type { GenieAnswer } from "./answer";

export type ChatTopic = "greet" | "howAreYou" | "thanks" | "ack" | "praise" | "complaint" | "who" | "bye" | "laugh" | "test";

const TOPICS: [ChatTopic, RegExp][] = [
  ["who", /\b(?:quem (?:e|es) (?:voce|vc|tu)|o que (?:e|es) (?:voce|vc)|qual (?:e )?(?:o )?seu nome|como (?:voce|vc) se chama|(?:voce|vc) e (?:um |uma )?(?:robo|ia|humano|pessoa|inteligencia artificial|bot))\b/],
  ["howAreYou", /\b(?:tudo (?:bem|bom|certo|joia|tranquilo)|como (?:voce|vc) (?:esta|ta|vai)|como vai|como (?:esta|ta) (?:voce|vc))\b/],
  ["complaint", /\b(?:burro|inutil|horrivel|pessimo|nao gostei|nao entende nada|nao serve|nao funciona|que droga|ruim demais)\b/],
  ["praise", /^(?:(?:voce|vc) e (?:muito |demais de )?(?:bom|boa|otimo|otima|incrivel|demais|top|fera|genial)|gostei(?: muito)?|adorei|amei|parabens|muito bom|excelente|sensacional|que incrivel)$/],
  ["thanks", /^(?:muito |muitissimo )?(?:obrigad[oa]|brigad[oa]|obg|valeu|vlw|agradeco|thanks|grato|grata)(?: (?:genio|muvo|demais|mesmo|pela ajuda|viu))*$/],
  ["bye", /^(?:tchau|ate mais|ate logo|ate amanha|ate depois|flw|falou|fui|bye|boa noite e ate amanha)$/],
  ["test", /^(?:teste+|testando|testar|test|testing|so (?:um )?teste|(?:e )?(?:um )?teste|alguem ai|tem alguem ai|(?:voce|vc) (?:esta|ta) (?:ai|funcionando|on|online)|funciona|ta funcionando|esta funcionando)$/],
  ["laugh", /^(?:k{3,}|(?:ha){2,}h?|(?:he){2,}h?|(?:rs)+|kk+k*)$/],
  ["greet", /^(?:oi+|ola|opa|e ai|eai|eae|salve|hey|hello|hi|bom dia|boa tarde|boa noite|fala|alo)(?: (?:genio|muvo|muvo genio|tudo|pessoal))?$/],
  ["ack", /^(?:ok|okay|certo|entendi|entendido|beleza|blz|show|top|legal|massa|interessante|bacana|otimo|otima|perfeito|joia|tranquilo|de boa|faz sentido|uau|nossa|caramba|que legal|que bom|boa|hum+|hm+|ah+|aham|ata|ah ta|saquei|ta bom|ta|ta certo|sim|nao|pode ser|isso|exato|verdade|imagino|serio|que interessante|muito interessante|bem interessante|show de bola|maravilha|massa demais)$/],
];

/** Conversa simples ("oi", "interessante", "obrigado"), respondida no próprio aparelho. */
export function chatTopic(input: string): ChatTopic | null {
  const t = normalize(input)
    .replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, " ")
    .replace(/[?!.,;:…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || /\d/.test(t) || t.split(" ").length > 7) return null;
  return TOPICS.find(([, re]) => re.test(t))?.[0] ?? null;
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

const IDEAS = ["dicas para economizar", "quanto posso gastar por dia?", "resumo do mês"];

export function chatReply(topic: ChatTopic): GenieAnswer {
  switch (topic) {
    case "greet":
      return { title: pick(["Oi! Eu sou o Muvo Gênio.", "Olá! Que bom te ver por aqui."]), note: "Faço contas, organizo seu mês e dou dicas com os seus números. Por onde começamos?", chips: IDEAS };
    case "howAreYou":
      return { title: "Tudo ótimo por aqui, pronto para cuidar do seu mês.", note: "E você? Se quiser, vejo como o seu planejamento está indo.", chips: ["resumo do mês", "dicas para economizar"] };
    case "thanks":
      return { title: pick(["Por nada! Conte comigo.", "Imagina! Estou aqui quando precisar."]), chips: IDEAS };
    case "ack":
      return { title: pick(["Que bom que ajudou!", "Combinado!", "Certo!"]), note: "Quer ir além? Posso dar dicas com base nos seus números.", chips: ["dicas para economizar", "o que faço com a sobra?", "quanto posso gastar por dia?"] };
    case "praise":
      return { title: "Obrigado! Fico feliz em ajudar.", chips: IDEAS };
    case "complaint":
      return { title: "Desculpe, ainda estou aprendendo.", note: "Escreva de outro jeito ou toque em um exemplo. Se eu entender a nova frase, aprendo para a próxima vez.", chips: ["ajuda", "resumo do mês"] };
    case "who":
      return {
        title: "Sou o Muvo Gênio, o assistente do seu planejamento.",
        note: "Faço contas, lanço itens e gastos, simulo investimentos e dou dicas com os seus números, sem enviar seus valores para fora do Muvo. Perguntas gerais sobre dinheiro eu pesquiso na web e aprendo a resposta para as próximas vezes.",
        chips: ["ajuda", ...IDEAS.slice(0, 2)],
      };
    case "bye":
      return { title: "Até mais! Seu planejamento fica salvo aqui." };
    case "test":
      return { title: "Estou funcionando! Pode mandar.", note: "Peça uma conta, lance um gasto ou pergunte sobre o seu mês.", chips: ["ajuda", ...IDEAS.slice(0, 2)] };
    case "laugh":
      return { title: pick(["Bom te ver de bom humor!", "Dinheiro organizado deixa qualquer um mais leve."]), chips: IDEAS };
  }
}

/** A mesma conversa curta no assistente de investimentos, voltada para a carteira. */
export function investorChatText(topic: ChatTopic): string {
  switch (topic) {
    case "greet": return "Oi! Sou o assistente de investimentos do Muvo. Posso explicar termos, fazer contas de rendimento e analisar a sua carteira.";
    case "howAreYou": return "Tudo ótimo por aqui! Quer que eu dê uma olhada em como a sua carteira está?";
    case "thanks": return "Por nada! Estou aqui quando precisar.";
    case "ack": return "Combinado! Se quiser, explico um termo ou comparo dois investimentos para você.";
    case "praise": return "Obrigado! Fico feliz em ajudar.";
    case "complaint": return "Desculpe, ainda estou aprendendo. Escreva de outro jeito ou toque em uma das sugestões abaixo.";
    case "who": return "Sou o assistente de investimentos do Muvo. Explico termos, faço contas de rendimento e de dívidas e analiso a sua carteira com os seus números.";
    case "bye": return "Até mais! Sua carteira fica salva aqui.";
    case "laugh": return "Bom te ver de bom humor!";
    case "test": return "Estou funcionando! Pergunte sobre a sua carteira, um termo como CDB ou uma conta de rendimento.";
  }
}

/** Perguntas sobre o próprio Muvo ficam na ajuda, não vão para a web. */
const ABOUT_APP = /\b(?:muvo|genio|planejamento|meu mes|minha sobra|meus gastos|minha renda|grupos?|itens?|adicion\w*|lanc\w*|apag\w*|exclu\w*|cadastr\w*|desfaz\w*)\b/;
const QUESTION_START = /^(?:o que|oque|que|qual|quais|quanto|quantos|quantas|como|por que|porque|pq|quando|onde|quem|vale a pena|e verdade|e melhor|e bom|e seguro|e possivel|compensa|devo|deveria|existe|diferenca entre|explica|explique|me explica|me explique|me fala|fale sobre|significado|defina|define|pesquis\w*|busc\w*|procur\w*)\b/;

/** Pergunta geral, boa para a Visão geral da web; pedidos curtos ou sobre o app ficam de fora. */
export function looksLikeWebQuestion(input: string): boolean {
  const n = normalize(input);
  const t = n.replace(/[?!.,;:…]+/g, " ").replace(/\s+/g, " ").trim();
  const words = t ? t.split(" ") : [];
  if (words.length < 2 || ABOUT_APP.test(t)) return false;
  return (n.endsWith("?") && words.length >= 2) || (QUESTION_START.test(t) && words.length >= 3);
}

const FOLLOW_UP = /^(?:e|mas|entao|e se|e no|e na|e para|e pra|e o|e a|e os|e as)\b|\b(?:isso|disso|nisso|esse|essa|dele|dela|nele|nela)\b/;

/** Texto enviado à busca: a pergunta limpa e, se ela continua a anterior ("e no caso de imóveis?"), a anterior junto. */
export function buildSearchQuery(text: string, context: string | null): string {
  const clean = (s: string) => s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:(?:muvo\s+)?g[eê]nio\s*[,:]?\s+)/i, "")
    .replace(/^(?:pesquis[ae]r?|busc[ae]r?|procur[ae]r?)\s+(?:na web\s+|na internet\s+|no google\s+)?(?:sobre\s+|por\s+)?/i, "")
    .slice(0, 300)
    .trim();
  const q = clean(text);
  if (!q) return "";
  const prev = context ? clean(context) : "";
  if (prev && FOLLOW_UP.test(normalize(q))) return `${prev} ${q}`.slice(0, 400);
  return q;
}
