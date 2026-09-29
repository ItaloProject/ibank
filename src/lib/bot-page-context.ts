"use client";

import { useEffect } from "react";

/**
 * O que o usuário está vendo agora (aba, janela aberta, valores do simulador),
 * publicado pelas telas e enviado ao assistente junto com a pergunta.
 * Chaves terminadas em ":desktop" ou ":mobile" só valem no tamanho de tela
 * correspondente, porque as duas versões do LIVE ficam montadas ao mesmo tempo.
 */
const store = new Map<string, unknown>();

export function useBotPageContext(key: string, value: unknown) {
  const json = JSON.stringify(value ?? null);
  useEffect(() => {
    store.set(key, JSON.parse(json));
  }, [key, json]);
  useEffect(() => () => { store.delete(key); }, [key]);
}

export function readBotPageContext(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  const desktop = window.matchMedia("(min-width: 768px)").matches;
  const out: Record<string, unknown> = {};
  for (const [key, value] of store) {
    if (value == null) continue;
    if (key.endsWith(":desktop") && !desktop) continue;
    if (key.endsWith(":mobile") && desktop) continue;
    out[key.replace(/:(desktop|mobile)$/, "")] = value;
  }
  return Object.keys(out).length ? { endereco: window.location.pathname, ...out } : null;
}
