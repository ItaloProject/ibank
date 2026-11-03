"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BotAlert } from "@/lib/alerts";
import { alertStatus, snoozeChoice, type AlertChoices } from "@/lib/alert-choices";
import {
  ALERTS_CHANGED_EVENT,
  loadAlertPrefs,
  saveAlertChoices,
  saveSeenAlerts,
} from "@/lib/alert-storage";

type AlertsContextValue = {
  alerts: BotAlert[];
  unseen: BotAlert[];
  loading: boolean;
  error: boolean;
  status: (id: string) => "snoozed" | "dismissed" | null;
  markSeen: (ids: string[]) => void;
  choose: (id: string, choice: "snooze" | "dismiss" | "undo") => void;
};

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<BotAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [choices, setChoices] = useState<AlertChoices>({});

  const syncPrefs = useCallback(() => {
    const prefs = loadAlertPrefs();
    setSeen(prefs.seen);
    setChoices(prefs.choices);
  }, []);

  useEffect(() => {
    syncPrefs();
    setHydrated(true);
    const onChange = () => syncPrefs();
    window.addEventListener(ALERTS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(ALERTS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [syncPrefs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch("/api/alerts", { cache: "no-store" });
        if (!res.ok) throw new Error("falha");
        const data = (await res.json()) as { alerts?: BotAlert[] };
        if (!cancelled) setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      } catch {
        if (!cancelled) {
          setAlerts([]);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(
    () => alerts.filter((a) => !alertStatus(choices[a.id])),
    [alerts, choices],
  );
  const unseen = useMemo(
    () => (hydrated ? visible.filter((a) => !seen.has(a.id)) : []),
    [hydrated, visible, seen],
  );

  const markSeen = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setSeen((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      saveSeenAlerts(next);
      return next;
    });
  }, []);

  const choose = useCallback((id: string, choice: "snooze" | "dismiss" | "undo") => {
    setChoices((prev) => {
      const next = { ...prev };
      if (choice === "undo") delete next[id];
      else next[id] = choice === "snooze" ? snoozeChoice() : { kind: "dismiss" };
      saveAlertChoices(next);
      return next;
    });
    if (choice === "snooze") {
      setSeen((prev) => {
        const next = new Set(prev);
        next.delete(id);
        saveSeenAlerts(next);
        return next;
      });
    }
  }, []);

  const value = useMemo<AlertsContextValue>(() => ({
    alerts: visible,
    unseen,
    loading,
    error,
    status: (id) => alertStatus(choices[id]),
    markSeen,
    choose,
  }), [visible, unseen, loading, error, choices, markSeen, choose]);

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts precisa estar dentro de AlertsProvider");
  return ctx;
}
