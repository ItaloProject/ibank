"use client";

import { useEffect, useState } from "react";
import { Store, Check } from "lucide-react";
import { PageHeader, PageShell, PageBody } from "@/components/mobile";

interface UsuarioAcesso {
  userId: string;
  username: string;
  name: string;
  ativo: boolean;
  admin: boolean;
  pizzarias: string[];
}

interface Resposta {
  usuarios: UsuarioAcesso[];
  pizzarias: string[];
}

// Controle de quem edita cada pizzaria do cardápio. Fica no mesmo lugar em que você gerencia os usuários.
export default function CardapiosPage() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);

  async function carregar() {
    const r = await fetch("/api/cardapio/acessos");
    const corpo = await r.json();
    if (!r.ok) return setErro(corpo.error ?? "Não foi possível carregar");
    setDados(corpo);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function alternar(u: UsuarioAcesso, pizzaria: string) {
    const liberar = !u.pizzarias.includes(pizzaria);
    const chave = `${u.userId}:${pizzaria}`;
    setSalvando(chave);
    setErro("");
    const r = await fetch("/api/cardapio/acessos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: u.userId, pizzaria, liberar }),
    });
    setSalvando(null);
    if (!r.ok) return setErro((await r.json()).error ?? "Falha ao salvar");
    await carregar();
  }

  return (
    <PageShell>
      <PageHeader title="Cardápios" description="Escolha quais usuários podem editar cada pizzaria." />
      <PageBody>
        {erro && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{erro}</p>}
        {!dados && !erro && <p className="text-sm text-zinc-500">Carregando…</p>}
        {dados && (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  {dados.pizzarias.map((p) => (
                    <th key={p} className="px-4 py-3 text-center">
                      <Store className="mx-auto mb-1 size-4" />
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.usuarios.map((u) => (
                  <tr key={u.userId} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-xs text-zinc-500">
                        @{u.username}
                        {u.admin && " · administrador (vê todas)"}
                        {!u.ativo && " · inativo"}
                      </p>
                    </td>
                    {dados.pizzarias.map((p) => {
                      const marcado = u.admin || u.pizzarias.includes(p);
                      const chave = `${u.userId}:${p}`;
                      return (
                        <td key={p} className="px-4 py-3 text-center">
                          <button
                            type="button"
                            disabled={u.admin || salvando === chave}
                            onClick={() => alternar(u, p)}
                            aria-label={`${marcado ? "Retirar" : "Liberar"} ${p} para ${u.name}`}
                            className={`grid size-7 mx-auto place-items-center rounded-md border ${
                              marcado ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-300 bg-white"
                            } disabled:opacity-40`}
                          >
                            {marcado && <Check className="size-4" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
    </PageShell>
  );
}
