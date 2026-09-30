import { describe, expect, it } from "vitest";
import { alertStatus, parseAlertChoices, snoozeChoice } from "./alert-choices";

const now = Date.UTC(2026, 8, 30);

describe("alert choices", () => {
  it("adiado some por 3 dias e volta depois", () => {
    const c = snoozeChoice(now);
    expect(alertStatus(c, now + 2 * 86_400_000)).toBe("snoozed");
    expect(alertStatus(c, now + 3 * 86_400_000 + 1)).toBeNull();
  });

  it("desconsiderado não volta", () => {
    expect(alertStatus({ kind: "dismiss" }, now + 365 * 86_400_000)).toBe("dismissed");
    expect(alertStatus(undefined, now)).toBeNull();
  });

  it("lê o armazenamento com segurança", () => {
    const parsed = parseAlertChoices({ a: { kind: "dismiss" }, b: { kind: "snooze", until: now - 1 }, c: { kind: "x" }, d: { kind: "snooze", until: now + 5 } }, now);
    expect(parsed).toEqual({ a: { kind: "dismiss" }, d: { kind: "snooze", until: now + 5 } });
    expect(parseAlertChoices("lixo")).toEqual({});
  });
});
