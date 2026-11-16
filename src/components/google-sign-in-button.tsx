"use client";

import { useEffect, useRef, useState } from "react";

/** Mínimo do que usamos do Google Identity Services (a biblioteca é carregada de accounts.google.com). */
type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
      renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const SCRIPT_URL = "https://accounts.google.com/gsi/client";

function carregarScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google) return resolve();
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    if (existente) {
      existente.addEventListener("load", () => resolve());
      existente.addEventListener("error", () => reject(new Error("falha ao carregar o Google")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("falha ao carregar o Google"));
    document.head.appendChild(s);
  });
}

/**
 * Botão "Entrar com o Google" do site. Só aparece se NEXT_PUBLIC_GOOGLE_CLIENT_ID estiver configurado.
 * Entrega o ID token a quem chamou; quem chamou fala com o servidor (/api/auth/google).
 */
export function GoogleSignInButton({ onToken, disabled }: { onToken: (idToken: string) => void; disabled?: boolean }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const alvo = useRef<HTMLDivElement>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const aoReceber = useRef(onToken);
  useEffect(() => {
    aoReceber.current = onToken;
  });

  useEffect(() => {
    if (!clientId) return;
    let ativo = true;
    carregarScript()
      .then(() => {
        if (!ativo || !window.google || !alvo.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => aoReceber.current(r.credential),
          ux_mode: "popup",
        });
        window.google.accounts.id.renderButton(alvo.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          shape: "pill",
          locale: "pt-BR",
          width: 280,
        });
      })
      .catch(() => setIndisponivel(true));
    return () => {
      ativo = false;
    };
  }, [clientId]);

  if (!clientId || indisponivel) return null;
  return (
    <div className={disabled ? "pointer-events-none opacity-60" : undefined} aria-label="Entrar com o Google">
      <div ref={alvo} className="flex justify-center min-h-[44px]" />
    </div>
  );
}
