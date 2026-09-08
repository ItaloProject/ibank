"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/user-context";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Trash2, Power, ShieldCheck, Eye, EyeOff, KeyRound, X, Check } from "lucide-react";

interface AppUser {
  id: number;
  user_id: string;
  username: string;
  name: string;
  color: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

const COLORS = ["#3b82f6","#ec4899","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#f97316"];

export default function UsuariosPage() {
  const { isAdmin } = useUser();
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", name: "", password: "", color: COLORS[0], is_admin: false });
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
    else { setShowForm(false); setForm({ username: "", name: "", password: "", color: COLORS[0], is_admin: false }); loadUsers(); }
    setSaving(false);
  }

  const active = users.filter((u) => u.is_active).length;
  const inactive = users.filter((u) => !u.is_active).length;

  if (!isAdmin) return null;

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="border-b px-4 sm:px-6 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Usuários</h1>
              <p className="text-xs text-muted-foreground">Gerencie o acesso ao IBANK</p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(true); setError(""); }}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 active:scale-95 transition-all"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo usuário</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border bg-card px-4 py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold leading-none">{users.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-card px-4 py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              <Power className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-green-500 leading-none">{active}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Ativos</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-card px-4 py-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Power className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xl font-bold text-muted-foreground leading-none">{inactive}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Inativos</p>
            </div>
          </div>
        </div>

        {/* Lista de usuários */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum usuário cadastrado</div>
          ) : (
            <div className="divide-y">
              {users.map((u) => (
                <div key={u.id} className={`flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/30 ${!u.is_active ? "opacity-50" : ""}`}>
                  {/* Avatar */}
                  <div
                    className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-base font-bold text-white shadow-sm"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.name[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm">{u.name}</span>
                      {u.is_admin && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                          <ShieldCheck className="h-3 w-3" /> Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">@{u.username}</p>
                  </div>

                  {/* Status + ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full mr-1 ${u.is_active ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                      {u.is_active ? "Ativo" : "Inativo"}
                    </span>

                    <button
                      onClick={() => { setResetUser(u); setResetPass(""); setResetError(""); setShowResetPass(false); setResetDone(false); }}
                      title="Redefinir senha"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => toggleActive(u)}
                      title={u.is_active ? "Desativar" : "Ativar"}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${u.is_active ? "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10" : "text-muted-foreground hover:text-green-500 hover:bg-green-500/10"}`}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>

                    {!u.is_admin && (
                      <button
                        onClick={() => deleteUser(u)}
                        title="Excluir"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Novo usuário */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <form onSubmit={createUser} className="w-full max-w-md bg-background border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <h2 className="font-bold text-sm">Novo usuário</h2>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nome</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nome completo" required
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Login</label>
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                    placeholder="usuario" required autoCapitalize="none"
                    className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Senha</label>
                <div className="relative">
                  <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    type={showPass ? "text" : "password"} placeholder="••••••••" required
                    className="w-full rounded-xl border bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                  <button type="button" onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Cor do avatar</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                        className={`h-7 w-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "opacity-70 hover:opacity-100 hover:scale-105"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none shrink-0 mt-4">
                  <div className={`h-5 w-5 rounded flex items-center justify-center border-2 transition-colors ${form.is_admin ? "bg-primary border-primary" : "border-border"}`}
                    onClick={() => setForm({ ...form, is_admin: !form.is_admin })}>
                    {form.is_admin && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="font-medium text-xs">Admin</span>
                </label>
              </div>

              {error && <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{error}</p>}
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border py-2.5 text-sm text-muted-foreground hover:bg-muted transition-all">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-all">
                {saving ? "Criando..." : "Criar usuário"}
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
                <KeyRound className="h-4 w-4 text-primary" />
                <h2 className="font-bold text-sm">Redefinir senha</h2>
              </div>
              <button type="button" onClick={() => setResetUser(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Avatar do usuário */}
              <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-3 py-2.5">
                <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: resetUser.color }}>
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
                    className="w-full rounded-xl border bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button type="button" onClick={() => setShowResetPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
                    {showResetPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {resetError && <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">{resetError}</p>}
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button type="button" onClick={() => setResetUser(null)}
                className="flex-1 rounded-xl border py-2.5 text-sm text-muted-foreground hover:bg-muted transition-all">
                Cancelar
              </button>
              <button type="submit" disabled={resetSaving || !resetPass.trim() || resetDone}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all ${resetDone ? "bg-green-500" : "bg-primary hover:bg-primary/90 disabled:opacity-60"}`}>
                {resetDone ? <span className="flex items-center justify-center gap-1.5"><Check className="h-4 w-4" /> Salvo!</span> : resetSaving ? "Salvando..." : "Redefinir senha"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
