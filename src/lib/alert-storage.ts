/**
 * Preferências de avisos no aparelho: o sininho e o assistente Muvo leem e
 * gravam as mesmas chaves para o selo e o adiar/desconsiderar ficarem iguais.
 */
import {
  parseAlertChoices,
  trimAlertChoices,
  type AlertChoices,
} from "@/lib/alert-choices";

export const STORAGE_SEEN_ALERTS = "muvo_bot_alerts_seen";
export const STORAGE_ALERT_CHOICES = "muvo_bot_alert_choices";
export const ALERTS_CHANGED_EVENT = "muvo-alerts-changed";

export type AlertPrefs = {
  seen: Set<string>;
  choices: AlertChoices;
};

export function loadAlertPrefs(): AlertPrefs {
  if (typeof window === "undefined") return { seen: new Set(), choices: {} };
  try {
    const seenRaw: unknown = JSON.parse(localStorage.getItem(STORAGE_SEEN_ALERTS) ?? "[]");
    const seen = new Set(Array.isArray(seenRaw) ? seenRaw.filter((s): s is string => typeof s === "string") : []);
    const choices = parseAlertChoices(JSON.parse(localStorage.getItem(STORAGE_ALERT_CHOICES) ?? "{}"));
    return { seen, choices };
  } catch {
    return { seen: new Set(), choices: {} };
  }
}

export function saveSeenAlerts(seen: Set<string>) {
  try {
    localStorage.setItem(STORAGE_SEEN_ALERTS, JSON.stringify([...seen]));
    window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));
  } catch { /* armazenamento cheio */ }
}

export function saveAlertChoices(choices: AlertChoices) {
  try {
    localStorage.setItem(STORAGE_ALERT_CHOICES, JSON.stringify(trimAlertChoices(choices)));
    window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));
  } catch { /* armazenamento cheio */ }
}
