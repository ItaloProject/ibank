"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/user-context";
import { useRouter } from "next/navigation";
import {
  Users, UserPlus, Trash2, Power, ShieldCheck, Eye, EyeOff,
  KeyRound, X, Check, Bot, CalendarPlus, AlertCircle,
} from "lucide-react";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";

interface AppUser {
  id: number;
  user_id: string;
  username: string;
  name: string;
  color: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  bot_enabled?: boolean;
  paid_until?: string | null;
  plan?: string | null;
}

const COLORS = ["#3b82f6","#ec4899","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#f97316"];

const emptyForm = {
  username: "",
  name: "",
  password: "",
  color: COLORS[0],
  is_admin: false,
  bot_enabled: false,
  paid_days: 30,
};

function paidStatus(u: AppUser): { label: string; tone: "emerald" | "amber" | "red" | "muted" } | null {
  if (u.is_admin) return null;
  if (!u.paid_until) return { label: "Sem validade", tone: "muted" };
  const until = String(u.paid_until).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (until < today) return { label: "Expirado", tone: "red" };
  const daysLeft = Math.ceil((new Date(until + "T12:00:00").getTime() - Date.now()) / 86400000);
  const d = new Date(until + "T12:00:00");
  const label = `Até ${d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`;
  if (daysLeft <= 7) return { label, tone: "amber" };
  return { label, tone: "emerald" };
}

const toneClasses = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red:     "bg-destructive/10 text-destructive",
  muted:   "bg-muted text-muted-foreground",
};

export default function UsuariosPage() {
  const { isAdmin } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resetUser, setResetUser] = useState<AppUser | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    if (!isAdmin) { router.replace("/"); return; }
    loadUsers();
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  async function toggleActive(user: AppUser) {
    if (user.is_active && !confirm(`Desativar ${user.name}? A sessão dela será encerrada imediatamente.`)) return;
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    loadUsers();
  }

  async function deleteUser(user: AppUser) {
    if (!confirm(`Excluir ${user.name}? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    loadUsers();
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUser || !resetPass.trim()) return;
    setResetSaving(true); setResetError("");
    const res = await fetch(`/api/admin/users/${resetUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPass }),
    });
    if (!res.ok) { setResetError("Erro ao redefinir senha"); }
    else { setResetDone(true); setTimeout(() => { setResetUser(null); setResetPass(""); setResetDone(false); }, 1200); }
    setResetSaving(false);
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Erro ao criar"); }
    else { setShowForm(false); setForm(emptyForm); loadUsers(); }
    setSaving(false);
  }

  async function toggleBot(user: AppUser) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bot_enabled: !user.bot_enabled }),
    });
    loadUsers();
  }

  async function extendMonth(user: AppUser) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extend_days: 30 }),
    });
    loadUsers();
  }

  const active = users.filter((u) => u.is_active).length;
  const inactive = users.filter((u) => !u.is_active).length;

  if (!isAdmin) return null;

  return (
    <PageShell>
      <PageHeader
        title="Usuários"
        description="Gerencie o acesso ao MUVO"
        actions={
          <button
            onClick={() => { setShowForm(true); setError(""); }}
            className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:bg-foreground/90 active:scale-95 transition-all"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo usuário</span>
            <span className="sm:hidden">Novo</span>
          </button>
        }
      />

      <PageBody width="cozy">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: users.length, icon: Users, color: "text-foreground", bg: "bg-muted" },
            { label: "Ativos", value: active, icon: Power, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Inativos", value: inactive, icon: Power, color: "text-muted-foreground", bg: "bg-muted" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl border bg-card px-4 py-3.5 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <p className={`text-xl font-bold leading-none ${color}`}>{loading ? "—" : value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Lista */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          {loading ? (
            <div className="divide-y">
              {[1, 2].map((i) => (
                <div key={i} className="px-4 py-4 flex items-center gap-3 animate-pulse">
                  <div className="h-11 w-11 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-28 rounded bg-muted" />
                    <div className="h-3 w-44 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-14 text-center space-y-2">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado</p>
            </div>
          ) : (
            <div className="divide-y">
              {users.map((u) => {
                const status = paidStatus(u);
                return (
                  <div
                    key={u.id}
                    className={`px-4 py-3.5 transition-colors hover:bg-muted/20 ${!u.is_active ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ring-2 ring-border/30"
                        style={{ backgroundColor: u.color }}
                      >
                        {u.name[0].toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm">{u.name}</span>
                          {u.is_admin && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-foreground/10 text-foreground/70">
                              <ShieldCheck className="h-3 w-3" /> Admin
                            </span>
                          )}
                          {u.bot_enabled && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-500 dark:text-violet-300">
                              <Bot className="h-3 w-3" /> Bot
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">@{u.username}</span>
                          <span className="text-muted-foreground/30 text-xs">·</span>
                          <span className="text-xs text-muted-foreground">
                            {u.plan === "completo" ? "Completo R$45" : "R$30"}
                          </span>
                          {status && (
                            <>
                              <span className="text-muted-foreground/30 text-xs">·</span>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${toneClasses[status.tone]}`}>
                                {status.tone === "red" && <AlertCircle className="h-3 w-3" />}
                                {status.label}
                              </span>
                            </>
                          )}
                          {!u.is_admin && (
                            <>
                              <span className="text-muted-foreground/30 text-xs">·</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${u.is_active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                                {u.is_active ? "Ativo" : "Inativo"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <ActionBtn
                          title="Renovar +30 dias"
                          onClick={() => extendMonth(u)}
                          className="text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                        >
                          <CalendarPlus className="h-4 w-4" />
                        </ActionBtn>
                        <ActionBtn
                          title={u.bot_enabled ? "Remover bot" : "Ativar bot"}
                          onClick={() => toggleBot(u)}
                          className={u.bot_enabled ? "text-violet-500 hover:bg-violet-500/10" : "text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10"}
                        >
                          <Bot className="h-4 w-4" />
                        </ActionBtn>
                        <ActionBtn
                          title="Redefinir senha"
                          onClick={() => { setResetUser(u); setResetPass(""); setResetError(""); setShowResetPass(false); setResetDone(false); }}
                          className="text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <KeyRound className="h-4 w-4" />
                        </ActionBtn>
                        {!u.is_admin && (
                          <>
                            <ActionBtn
                              title={u.is_active ? "Desativar" : "Ativar"}
                              onClick={() => toggleActive(u)}
                              className={u.is_active ? "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10" : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"}
                            >
                              <Power className="h-4 w-4" />
                            </ActionBtn>
                            <ActionBtn
                              title="Excluir"
                              onClick={() => deleteUser(u)}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </ActionBtn>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      {/* Modal: Novo usuário */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <form onSubmit={createUser} className="w-full max-w-md bg-background border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-foreground/10 flex items-center justify-center">
                  <UserPlus className="h-3.5 w-3.5 text-foreground/70" />
                </div>
                <h2 className="font-bold text-sm">Novo usuário</h2>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nome</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nome completo" required
                    className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm outline-none focus:border-foreground/30 focus:bg-background transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Login</label>
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                    placeholder="usuario" required autoCapitalize="none"
                    className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm outline-none focus:border-foreground/30 focus:bg-background transition-all" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Senha</label>
                <div className="relative">
                  <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    type={showPass ? "text" : "password"} placeholder="••••••••" required
                    className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 pr-10 text-sm outline-none focus:border-foreground/30 focus:bg-background transition-all" />
                  <button type="button" onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none rounded-xl border bg-muted/20 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.bot_enabled}
                    onChange={(e) => setForm({ ...form, bot_enabled: e.target.checked })}
                    className="accent-violet-600"
                  />
                  <Bot className="h-4 w-4 text-violet-500" />
                  <span className="text-xs font-medium">Bot (+R$ 15)</span>
                </label>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Validade (dias)</label>
                  <input
                    type="number"
                    min={1}
                    max={730}
                    value={form.paid_days}
                    onChange={(e) => setForm({ ...form, paid_days: Number(e.target.value) || 30 })}
                    className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 text-sm outline-none focus:border-foreground/30 focus:bg-background transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Cor do avatar</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                        className={`h-7 w-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-foreground/50 scale-110" : "opacity-70 hover:opacity-100 hover:scale-105"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none shrink-0 mt-4">
                  <div
                    className={`h-5 w-5 rounded flex items-center justify-center border-2 transition-colors ${form.is_admin ? "bg-foreground border-foreground" : "border-border"}`}
                    onClick={() => setForm({ ...form, is_admin: !form.is_admin })}
                  >
                    {form.is_admin && <Check className="h-3 w-3 text-background" />}
                  </div>
                  <ShieldCheck className="h-4 w-4 text-foreground/60" />
                  <span className="font-medium text-xs">Admin</span>
                </label>
              </div>

              <div className="rounded-xl bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                Plano: <span className="font-semibold text-foreground">{form.bot_enabled ? "Completo — R$ 45" : "Assinante — R$ 30"}</span>
                {" · "}validade: <span className="font-semibold text-foreground">{form.paid_days} dias</span>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border py-2.5 text-sm text-muted-foreground hover:bg-muted transition-all">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 rounded-xl bg-foreground py-2.5 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-60 transition-all">
                {saving ? "Criando…" : "Criar usuário"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Reset de senha */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <form onSubmit={resetPassword} className="w-full max-w-sm bg-background border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-foreground/10 flex items-center justify-center">
                  <KeyRound className="h-3.5 w-3.5 text-foreground/70" />
                </div>
                <h2 className="font-bold text-sm">Redefinir senha</h2>
              </div>
              <button type="button" onClick={() => setResetUser(null)} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-3 py-2.5">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: resetUser.color }}
                >
                  {resetUser.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{resetUser.name}</p>
                  <p className="text-xs text-muted-foreground">@{resetUser.username}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nova senha</label>
                <div className="relative">
                  <input
                    type={showResetPass ? "text" : "password"}
                    value={resetPass}
                    onChange={(e) => setResetPass(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoFocus
                    className="w-full rounded-xl border bg-muted/30 px-3 py-2.5 pr-10 text-sm outline-none focus:border-foreground/30 focus:bg-background transition-all"
                  />
                  <button type="button" onClick={() => setShowResetPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
                    {showResetPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {resetError && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {resetError}
                </div>
              )}
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button type="button" onClick={() => setResetUser(null)}
                className="flex-1 rounded-xl border py-2.5 text-sm text-muted-foreground hover:bg-muted transition-all">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={resetSaving || !resetPass.trim() || resetDone}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                  resetDone
                    ? "bg-emerald-500 text-white"
                    : "bg-foreground text-background hover:bg-foreground/90 disabled:opacity-60"
                }`}
              >
                {resetDone
                  ? <span className="flex items-center justify-center gap-1.5"><Check className="h-4 w-4" /> Salvo!</span>
                  : resetSaving ? "Salvando…" : "Redefinir senha"
                }
              </button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  );
}

function ActionBtn({
  children,
  title,
  onClick,
  className,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors touch-manipulation ${className}`}
    >
      {children}
    </button>
  );
}
