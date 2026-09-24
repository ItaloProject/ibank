"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useUser } from "@/context/user-context";

export function LoginScreen() {
  const { login } = useUser();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao entrar");
      } else {
        login(data.user);
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 safe-pt safe-pb">

      {/* Logo + marca */}
      <div className="flex flex-col items-center mb-8">
        <Image
          src="/logo.png"
          alt="MUVO"
          width={120}
          height={120}
          className="h-[120px] w-[120px] object-contain"
          priority
        />
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-display -mt-1">
          MUVO
        </h1>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70 mt-1">
          Gestão Financeira Inteligente
        </p>
      </div>

      {/* Card do formulário */}
      <div className="w-full max-w-sm rounded-2xl border border-primary/15 bg-card/60 p-6 shadow-xl shadow-black/30 backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-5 text-center">
          Acesse sua conta
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Usuário */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70" htmlFor="username">
              Usuário
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="seu usuário"
              required
              className="w-full rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Senha */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70" htmlFor="password">
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-border bg-muted/60 px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors touch-manipulation"
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <p className="text-sm text-destructive text-center bg-destructive/10 rounded-lg py-2 px-3">
              {error}
            </p>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 min-h-12 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1 touch-manipulation"
          >
            {loading ? (
              <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>

      <p className="mt-8 text-xs text-muted-foreground/30 text-center">
        Seus dados são privados e armazenados com segurança.
      </p>
    </div>
  );
}
