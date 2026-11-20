"use client";

import { useEffect } from "react";
import { atribuicaoDaBusca, cookieDeAtribuicao } from "@/lib/atribuicao";

/**
 * Quando a pessoa chega por um link com utm_* (anúncio ou link da bio), guarda a origem num cookie próprio por
 * 30 dias. Vale a última origem com utm. Sem utm na URL, não mexe em nada. Não carrega nenhum script de terceiro.
 */
export function AtribuicaoCapture() {
  useEffect(() => {
    try {
      const atrib = atribuicaoDaBusca(window.location.search);
      if (!atrib) return;
      document.cookie = cookieDeAtribuicao(atrib, window.location.protocol === "https:");
    } catch {
      // Cookies bloqueados: o cadastro segue normal, só fica sem origem.
    }
  }, []);
  return null;
}
