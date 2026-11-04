/**
 * Regras do resumo da carteira por WhatsApp, pensadas para um único número enviando
 * pelo Baileys (Evolution API): poucas mensagens, diferentes entre si, espalhadas no
 * tempo e só para quem aceitou. Nada aqui acessa banco ou rede.
 */
import type { BotAlert } from "@/lib/alerts";
import { brDay } from "@/lib/market-quotes";

export type Frequency = "weekly" | "daily";

/** Janela de envio no horário de Brasília: segunda a sexta, das 9h às 19h. */
export const SEND_WINDOW = { fromHour: 9, toHour: 19 };
/** Mensagens por dia do número, depois do aquecimento. */
export const STEADY_DAILY_CAP = 150;
/** Aquecimento do chip: limite do dia 1 ao dia 7 desde o primeiro envio. */
const RAMP = [20, 30, 40, 60, 80, 100, 120];
/** Pausa aleatória entre duas mensagens, em segundos. */
export const GAP_SECONDS = { min: 30, max: 120 };
/** Falhas seguidas que pausam o envio, e por quantas horas. */
export const BREAKER = { failures: 3, pauseHours: 2 };
export const MAX_ALERTS_IN_DIGEST = 3;

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const brClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  hour: "numeric",
  hourCycle: "h23",
  weekday: "short",
});

/** Hora (0-23) e dia da semana (1 = segunda ... 7 = domingo) em Brasília. */
export function brClockParts(date: Date): { hour: number; weekday: number } {
  const parts = brClock.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const weekday = WEEKDAYS[parts.find((p) => p.type === "weekday")?.value ?? "Mon"] ?? 1;
  return { hour, weekday };
}

export function isSendWindow(now: Date): boolean {
  const { hour, weekday } = brClockParts(now);
  return weekday <= 5 && hour >= SEND_WINDOW.fromHour && hour < SEND_WINDOW.toHour;
}

/** Limite de envios do dia: cresce nos primeiros 7 dias e depois fica fixo. */
export function dailyCap(daysSinceFirstSend: number | null): number {
  if (daysSinceFirstSend === null || daysSinceFirstSend < 0) return RAMP[0];
  return daysSinceFirstSend < RAMP.length ? RAMP[daysSinceFirstSend] : STEADY_DAILY_CAP;
}

export function nextGapSeconds(random = Math.random()): number {
  return Math.round(GAP_SECONDS.min + random * (GAP_SECONDS.max - GAP_SECONDS.min));
}

function hash(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Dia útil fixo de cada usuário para o resumo semanal: distribui a base de segunda a sexta. */
export function weeklyWeekday(userId: string): number {
  return 1 + (hash(userId) % 5);
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * Semanal: no dia fixo do usuário, ou depois dele na mesma semana se o dia anterior não coube
 * no limite de envios. Diário: todo dia útil. `lastDigestDay` é o último dia com resumo (AAAA-MM-DD).
 */
export function isDigestDue(input: { frequency: Frequency; userId: string; now: Date; lastDigestDay: string | null }): boolean {
  const { weekday } = brClockParts(input.now);
  if (weekday > 5) return false;
  const today = brDay(input.now.getTime());
  if (input.lastDigestDay === today) return false;
  if (input.frequency === "daily") return true;
  if (weekday < weeklyWeekday(input.userId)) return false;
  return input.lastDigestDay === null || daysBetween(input.lastDigestDay, today) >= 6;
}

export type Reply = "sim" | "sair" | "avisos" | "semanal";

const REPLIES: Record<Reply, string[]> = {
  sim: ["sim", "quero", "aceito", "pode enviar", "pode mandar"],
  sair: ["sair", "parar", "pare", "stop", "cancelar", "descadastrar", "nao", "nao quero"],
  avisos: ["avisos", "aviso", "diario"],
  semanal: ["semanal", "semana"],
};

/** Resposta curta do usuário (SIM, SAIR, AVISOS, SEMANAL), sem diferenciar acento, caixa ou pontuação. */
export function parseReply(text: string): Reply | null {
  const clean = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  for (const [reply, words] of Object.entries(REPLIES) as [Reply, string[]][]) {
    if (words.includes(clean)) return reply;
  }
  return null;
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).replace(/ /g, " ");
const pct = (n: number) => `${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const pick = <T>(options: T[], seed: string): T => options[hash(seed) % options.length];

const saudacao = (nome: string) => (nome ? `, ${nome}` : "");

export function composeOptin(nome: string, seed: string): string {
  const abertura = pick(
    [
      `Oi${saudacao(nome)}! Aqui é o Muvo.`,
      `Olá${saudacao(nome)}! Aqui é o Muvo, do seu app de investimentos.`,
    ],
    seed,
  );
  return `${abertura} Posso te mandar por aqui um resumo semanal da sua carteira? Responda *SIM* para aceitar. Se não quiser, responda *SAIR*.`;
}

export function composeConfirmation(reply: Reply, nome: string): string {
  switch (reply) {
    case "sim":
    case "semanal":
      return `Combinado${saudacao(nome)}! Você vai receber um resumo por semana. Para parar, responda *SAIR*; para receber só quando algo importante acontecer, responda *AVISOS*.`;
    case "avisos":
      return `Certo${saudacao(nome)}! Só aviso quando algo importante acontecer na sua carteira. Para voltar ao resumo semanal, responda *SEMANAL*; para parar, *SAIR*.`;
    case "sair":
      return `Tudo bem${saudacao(nome)}, não vou mais enviar mensagens. Se mudar de ideia, é só responder *SIM*.`;
  }
}

export type DigestInput = {
  nome: string;
  frequency: Frequency;
  alerts: BotAlert[];
  /** Ações e fundos em carteira; null quando o usuário não tem posições. */
  bolsa: { valorAtual: number; investido: number } | null;
  /** Muda a frase de abertura de uma mensagem para outra. */
  seed: string;
};

/**
 * Texto do resumo, ou null quando não há nada a dizer. O semanal sempre leva o panorama da
 * bolsa; o diário só sai quando existe aviso. Só os títulos dos avisos vão na mensagem; os
 * detalhes ficam no assistente do app, e não há links.
 */
export function composeDigest(input: DigestInput): string | null {
  const alerts = [...input.alerts]
    .sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "alta" ? -1 : 1))
    .slice(0, MAX_ALERTS_IN_DIGEST);
  const daily = input.frequency === "daily";
  if (daily && alerts.length === 0) return null;
  if (!daily && alerts.length === 0 && !input.bolsa) return null;

  const nome = input.nome;
  const abertura = daily
    ? pick([`Oi${saudacao(nome)}! Algo mudou na sua carteira:`, `${nome || "Oi"}, um aviso sobre a sua carteira:`], input.seed)
    : pick(
        [
          `Oi${saudacao(nome)}! Seu resumo da semana no Muvo:`,
          `${nome || "Olá"}, passando para mostrar como está a sua carteira:`,
          `Olá${saudacao(nome)}! Resumo rápido da sua carteira:`,
        ],
        input.seed,
      );

  const linhas = [abertura];
  if (input.bolsa && !daily) {
    const resultado = input.bolsa.valorAtual - input.bolsa.investido;
    const sinal = resultado < 0 ? "−" : "+";
    const sobre = input.bolsa.investido > 0 ? `, ${sinal}${pct((resultado / input.bolsa.investido) * 100)} sobre o que você investiu` : "";
    linhas.push(`• Ações e fundos: ${brl(input.bolsa.valorAtual)} (${sinal}${brl(Math.abs(resultado))}${sobre})`);
  }
  for (const a of alerts) linhas.push(`• ${a.titulo}`);
  if (alerts.length > 0) linhas.push("Os detalhes estão no assistente do Muvo, no app.");
  linhas.push(
    daily
      ? "Para parar, responda *SAIR*; para um resumo por semana, *SEMANAL*."
      : "Para parar, responda *SAIR*; para receber só quando algo importante acontecer, *AVISOS*.",
  );
  return linhas.join("\n");
}
