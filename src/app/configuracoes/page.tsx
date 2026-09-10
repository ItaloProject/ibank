"use client";

import { useState } from "react";
import { useUser } from "@/context/user-context";
import {
  Eye, EyeOff, CheckCircle2, User, Lock, LayoutList, Home,
  Landmark, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALWAYS_VISIBLE_HREFS,
  SYSTEM_NAV_ITEMS,
  flattenNavItems,
  getHideableNavItems,
  readHiddenPages,
  HIDDEN_PAGES_KEY,
} from "@/lib/nav";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";

const HIDEABLE_PAGES = getHideableNavItems();

const ALWAYS_VISIBLE = (() => {
  const byHref = new Map(
    [
      { href: "/", label: "Dashboard", icon: Home },
      ...flattenNavItems(),
      ...SYSTEM_NAV_ITEMS,
    ].map((item) => [item.href, item] as const)
  );
  return [...ALWAYS_VISIBLE_HREFS]
    .map((href) => byHref.get(href))
    .filter((item): item is NonNullable<typeof item> => !!item);
})();

function readHidden(): Set<string> {
  return readHiddenPages();
}

function saveHidden(set: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_PAGES_KEY, JSON.stringify([...set]));
    window.dispatchEvent(new Event("ibank_hidden_pages_changed"));
  } catch {}
}

export default function ConfiguracoesPage() {
  const { user, investmentProfile, setProfile } = useUser();

  // Senha
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [senhaLoading, setSenhaLoading] = useState(false);
  const [senhaMsg, setSenhaMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // Visibilidade
  const [hiddenPages, setHiddenPages] = useState<Set<string>>(() => readHidden());

  function togglePage(href: string) {
    const next = new Set(hiddenPages);
    if (next.has(href)) next.delete(href);
    else next.add(href);
    setHiddenPages(next);
    saveHidden(next);
  }

  // Perfil
  const [perfilLoading, setPerfilLoading] = useState(false);
  const [perfilMsg, setPerfilMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function handleSenha(e: React.FormEvent) {
    e.preventDefault();
    setSenhaMsg(null);
    if (novaSenha !== confirmar) {
      setSenhaMsg({ tipo: "erro", texto: "As senhas não coincidem" });
      return;
    }
    setSenhaLoading(true);
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senhaAtual, novaSenha }),
    });
    const data = await res.json();
    setSenhaLoading(false);
    if (res.ok) {
      setSenhaMsg({ tipo: "ok", texto: "Senha alterada com sucesso!" });
      setSenhaAtual(""); setNovaSenha(""); setConfirmar("");
    } else {
      setSenhaMsg({ tipo: "erro", texto: data.error ?? "Erro ao alterar senha" });
    }
  }

  async function handlePerfil(p: string) {
    if (p === investmentProfile) return;
    setPerfilLoading(true);
    setPerfilMsg(null);
    await setProfile(p);
    // Reset carteira vista para mostrar a nova carteira sugerida
    try { localStorage.removeItem("ibank_carteira_vista"); } catch {}
    setPerfilLoading(false);
    setPerfilMsg({ tipo: "ok", texto: "Perfil atualizado! Você verá sua nova carteira sugerida." });
  }

  const perfis = [
    { id: "aposentadoria", label: "Aposentadoria", tagline: "Crescimento de longo prazo", icon: Landmark, cor: "border-blue-500 bg-blue-50 dark:bg-blue-950/30" },
    { id: "renda_mensal", label: "Renda Mensal", tagline: "Proventos todo mês", icon: TrendingUp, cor: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" },
  ];

  return (
    <PageShell>
      <PageHeader title="Configurações" description="Gerencie seu perfil e segurança" />
      <PageBody width="narrow">
      {/* Info do usuário */}
      <div className="flex items-center gap-3 border rounded-xl px-4 py-3">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: user?.color ?? "#3b82f6" }}
        >
          {user?.name?.[0] ?? "?"}
        </div>
        <div>
          <p className="font-medium text-sm">{user?.name}</p>
          <p className="text-xs text-muted-foreground">{user?.isAdmin ? "Administrador" : "Usuário"}</p>
        </div>
      </div>

      {/* Perfil de investimento */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Perfil de Investimento</h2>
        </div>
        <div className="flex flex-col gap-2">
          {perfis.map((p) => {
            const Icon = p.icon;
            const ativo = investmentProfile === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={perfilLoading}
                onClick={() => handlePerfil(p.id)}
                className={cn(
                  "flex items-center gap-3 border rounded-xl px-4 py-3 text-left transition-all",
                  ativo ? p.cor : "border-border bg-card hover:bg-muted/50",
                  "disabled:opacity-60",
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", ativo ? (p.id === "aposentadoria" ? "text-blue-500" : "text-emerald-500") : "text-muted-foreground")} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="text-xs text-muted-foreground">{p.tagline}</div>
                </div>
                {ativo && <CheckCircle2 className={cn("h-4 w-4 shrink-0", p.id === "aposentadoria" ? "text-blue-500" : "text-emerald-500")} />}
              </button>
            );
          })}
        </div>
        {perfilMsg && (
          <p className={cn("text-xs mt-2", perfilMsg.tipo === "ok" ? "text-emerald-600" : "text-destructive")}>
            {perfilMsg.texto}
          </p>
        )}
      </section>

      {/* Visibilidade do menu */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <LayoutList className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Visibilidade do Menu</h2>
        </div>
        <div className="border rounded-xl overflow-hidden divide-y">
          {/* Sempre visíveis */}
          {ALWAYS_VISIBLE.map(({ href, label, icon: Icon }) => (
            <div key={href} className="flex items-center gap-3 px-4 py-3 opacity-50">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">{label}</span>
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">sempre visível</span>
            </div>
          ))}
          {/* Páginas oculháveis */}
          {HIDEABLE_PAGES.map(({ href, label, icon: Icon }) => {
            const hidden = hiddenPages.has(href);
            return (
              <div key={href} className={cn("flex items-center gap-3 px-4 py-3 transition-colors", hidden ? "opacity-50" : "")}>
                <Icon className={cn("h-4 w-4 shrink-0", hidden ? "text-muted-foreground" : "text-foreground")} />
                <span className={cn("text-sm flex-1", hidden ? "text-muted-foreground line-through" : "")}>{label}</span>
                <button
                  type="button"
                  onClick={() => togglePage(href)}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none",
                    hidden ? "bg-muted-foreground/20" : "bg-primary",
                  )}
                  aria-label={hidden ? `Mostrar ${label}` : `Ocultar ${label}`}
                >
                  <span className={cn(
                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-150",
                    hidden ? "translate-x-0.5" : "translate-x-[18px]",
                  )} />
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">As páginas ocultas somem do menu. Dashboard, Investimentos e Configurações são sempre visíveis.</p>
      </section>

      {/* Alterar senha */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Alterar Senha</h2>
        </div>
        <form onSubmit={handleSenha} className="flex flex-col gap-3">
          {/* Senha atual */}
          <div className="relative">
            <input
              type={showAtual ? "text" : "password"}
              placeholder="Senha atual"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              required
              className="w-full border rounded-xl px-4 py-3 text-sm bg-background pr-11 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button type="button" onClick={() => setShowAtual(!showAtual)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {/* Nova senha */}
          <div className="relative">
            <input
              type={showNova ? "text" : "password"}
              placeholder="Nova senha (mín. 6 caracteres)"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
              minLength={6}
              className="w-full border rounded-xl px-4 py-3 text-sm bg-background pr-11 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button type="button" onClick={() => setShowNova(!showNova)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {/* Confirmar */}
          <input
            type="password"
            placeholder="Confirmar nova senha"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
            className="w-full border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {senhaMsg && (
            <p className={cn("text-xs", senhaMsg.tipo === "ok" ? "text-emerald-600" : "text-destructive")}>
              {senhaMsg.texto}
            </p>
          )}
          <button
            type="submit"
            disabled={senhaLoading}
            className="w-full py-3 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
          >
            {senhaLoading ? "Salvando..." : "Alterar Senha"}
          </button>
        </form>
      </section>
      </PageBody>
    </PageShell>
  );
}
