export type AlertChoice = { kind: "snooze"; until: number } | { kind: "dismiss" };
export type AlertChoices = Record<string, AlertChoice>;

export const SNOOZE_DAYS = 3;
const DAY_MS = 86_400_000;
const MAX_STORED = 100;

/** Adiado ainda no prazo ou desconsiderado: o aviso fica fora do selo, da abertura do painel e da IA. */
export function alertStatus(choice: AlertChoice | undefined, now = Date.now()): "snoozed" | "dismissed" | null {
  if (!choice) return null;
  if (choice.kind === "dismiss") return "dismissed";
  return choice.until > now ? "snoozed" : null;
}

export function snoozeChoice(now = Date.now()): AlertChoice {
  return { kind: "snooze", until: now + SNOOZE_DAYS * DAY_MS };
}

/** Lê do armazenamento, descartando o que não tem o formato esperado e adiamentos vencidos. */
export function parseAlertChoices(raw: unknown, now = Date.now()): AlertChoices {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: AlertChoices = {};
  for (const [id, c] of Object.entries(raw as Record<string, unknown>)) {
    const v = c as { kind?: unknown; until?: unknown };
    if (v?.kind === "dismiss") out[id] = { kind: "dismiss" };
    else if (v?.kind === "snooze" && typeof v.until === "number" && v.until > now) out[id] = { kind: "snooze", until: v.until };
  }
  return out;
}

export function trimAlertChoices(choices: AlertChoices): AlertChoices {
  const entries = Object.entries(choices);
  return entries.length <= MAX_STORED ? choices : Object.fromEntries(entries.slice(-MAX_STORED));
}
