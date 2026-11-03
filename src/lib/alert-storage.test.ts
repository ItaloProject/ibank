import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  clear: () => store.clear(),
  removeItem: (k: string) => { store.delete(k); },
};

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", {
  localStorage: localStorageMock,
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

const {
  ALERTS_CHANGED_EVENT,
  loadAlertPrefs,
  saveAlertChoices,
  saveSeenAlerts,
  STORAGE_ALERT_CHOICES,
  STORAGE_SEEN_ALERTS,
} = await import("./alert-storage");

describe("alert-storage", () => {
  beforeEach(() => {
    store.clear();
    vi.mocked(window.dispatchEvent).mockClear();
  });

  afterEach(() => {
    store.clear();
  });

  it("grava e lê avisos vistos e escolhas", () => {
    saveSeenAlerts(new Set(["queda-ITUB4-2026-11-03"]));
    saveAlertChoices({ "teto-1": { kind: "dismiss" } });
    const prefs = loadAlertPrefs();
    expect([...prefs.seen]).toEqual(["queda-ITUB4-2026-11-03"]);
    expect(prefs.choices["teto-1"]).toEqual({ kind: "dismiss" });
    expect(localStorage.getItem(STORAGE_SEEN_ALERTS)).toContain("queda-ITUB4");
    expect(localStorage.getItem(STORAGE_ALERT_CHOICES)).toContain("teto-1");
  });

  it("avisa os outros componentes ao gravar", () => {
    saveSeenAlerts(new Set(["a"]));
    saveAlertChoices({});
    expect(window.dispatchEvent).toHaveBeenCalledTimes(2);
    const events = vi.mocked(window.dispatchEvent).mock.calls.map(([e]) => (e as Event).type);
    expect(events).toEqual([ALERTS_CHANGED_EVENT, ALERTS_CHANGED_EVENT]);
  });
});
