"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/user-context";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Trash2, Power, ShieldCheck, Eye, EyeOff, KeyRound } from "lucide-react";

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

  useEffect(() => {
    if (!isAdmin) { router.replace("/"); return; }
    loadUsers();
  }, [isAdmin]);

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
    else { setResetUser(null); setResetPass(""); }
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
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie o acesso ao IBANK</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-all"
        >
          <UserPlus className="h-4 w-4" />
          Novo usuário
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: users.length, icon: Users, color: "text-foreground" },
          { label: "Ativos", value: active, icon: Power, color: "text-green-500" },
          { label: "Inativos", value: inactive, icon: Power, color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Formulário novo usuário */}
      {showForm && (
        <form onSubmit={createUser} className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <p className="font-semibold text-sm">Novo usuário</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nome</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome completo" required
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Usuário</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="login" required autoCapitalize="none"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Senha</label>
            <div className="relative">
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                type={showPass ? "text" : "password"} placeholder="••••••••" required
                className="w-full rounded-xl border border-border bg-background px-3 py-2 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              <button type="button" onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1">
              <label className="text-xs text-muted-foreground">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                    className={`h-7 w-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : ""}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={form.is_admin} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
                className="rounded" />
              <ShieldCheck className="h-4 w-4 text-primary" />
              Admin
            </label>
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-all">
              {saving ? "Criando..." : "Criar usuário"}
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className={`flex items-center gap-4 px-5 py-4 ${!u.is_active ? "opacity-50" : ""}`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: u.color }}>
                  {u.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{u.name}</p>
                    {u.is_admin && <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                    {u.is_active ? "Ativo" : "Inativo"}
                  </span>
                  <button onClick={() => { setResetUser(u); setResetPass(""); setResetError(""); setShowResetPass(false); }} title="Redefinir senha"
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => toggleActive(u)} title={u.is_active ? "Desativar" : "Ativar"}
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground">
                    <Power className="h-3.5 w-3.5" />
                  </button>
                  {!u.is_admin && (
                    <button onClick={() => deleteUser(u)} title="Excluir"
                      className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-destructive/10 transition-all text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Modal reset de senha */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <form onSubmit={resetPassword} className="w-full max-w-sm bg-background border rounded-2xl p-6 shadow-2xl space-y-4">
            <div>
              <h2 className="font-bold text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                Redefinir senha
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {resetUser.name} <span className="text-xs">(@{resetUser.username})</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Nova senha</label>
              <div className="relative">
                <input
                  type={showResetPass ? "text" : "password"}
                  value={resetPass}
                  onChange={(e) => setResetPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                  className="w-full rounded-xl border bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button type="button" onClick={() => setShowResetPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground">
                  {showResetPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {resetError && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{resetError}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setResetUser(null)}
                className="flex-1 rounded-xl border py-2.5 text-sm text-muted-foreground hover:bg-muted transition-all">
                Cancelar
              </button>
              <button type="submit" disabled={resetSaving || !resetPass.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition-all">
                {resetSaving ? "Salvando..." : "Redefinir"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
