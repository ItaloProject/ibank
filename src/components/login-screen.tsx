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
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-10">
        <div className="h-20 w-20 rounded-2xl overflow-hidden">
          <Image
            src="/logo.png"
            alt="IBANK"
            width={400}
            height={400}
            className="h-full w-full object-cover"
            style={{ objectPosition: "50% 48%" }}
            priority
          />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">IBANK</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão Financeira Inteligente</p>
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <p className="text-center text-base font-semibold text-foreground mb-6">
            Entrar na sua conta
          </p>
        </div>

        {/* Usuário */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80" htmlFor="username">
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
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Senha */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/80" htmlFor="password">
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
              className="w-full rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
              tabIndex={-1}
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
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {loading ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="mt-10 text-xs text-muted-foreground/40 text-center">
        Seus dados são privados e armazenados com segurança.
      </p>
    </div>
  );
}
