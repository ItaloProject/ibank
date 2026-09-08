"use client";

import { useState } from "react";
import { CheckCircle2, TrendingUp, Landmark, ChevronRight, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alocacao {
  categoria: string;
  percentual: number;
  cor: string;
  dotCor: string;
  ativos: string[];
}

const carteiras: Record<string, {
  titulo: string;
  subtitulo: string;
  icon: typeof Landmark;
  cor: string;
  alocacoes: Alocacao[];
}> = {
  aposentadoria: {
    titulo: "Carteira de Aposentadoria",
    subtitulo: "Crescimento de longo prazo com diversificação",
    icon: Landmark,
    cor: "text-blue-500",
    alocacoes: [
      { categoria: "Ações de Crescimento", percentual: 40, cor: "bg-blue-500", dotCor: "bg-blue-500", ativos: ["PETR4", "VALE3", "WEGE3", "BBAS3"] },
      { categoria: "FIIs Diversificados",   percentual: 25, cor: "bg-blue-400", dotCor: "bg-blue-400", ativos: ["MXRF11", "HGLG11", "KNRI11"] },
      { categoria: "Tesouro IPCA+",         percentual: 20, cor: "bg-blue-300", dotCor: "bg-blue-300", ativos: ["IPCA+ 2035", "IPCA+ 2045"] },
      { categoria: "Renda Fixa",            percentual: 15, cor: "bg-blue-200", dotCor: "bg-blue-200", ativos: ["CDB", "LCI", "LCA"] },
    ],
  },
  renda_mensal: {
    titulo: "Carteira de Renda Mensal",
    subtitulo: "Proventos constantes todo mês",
    icon: TrendingUp,
    cor: "text-emerald-500",
    alocacoes: [
      { categoria: "FIIs de Renda",             percentual: 40, cor: "bg-emerald-500", dotCor: "bg-emerald-500", ativos: ["MXRF11", "HCTR11", "XPML11"] },
      { categoria: "Ações com Dividendos",       percentual: 35, cor: "bg-emerald-400", dotCor: "bg-emerald-400", ativos: ["BBAS3", "ITUB4", "TAEE11"] },
      { categoria: "CDB / LCI / LCA",            percentual: 20, cor: "bg-emerald-300", dotCor: "bg-emerald-300", ativos: ["CDB", "LCI", "LCA"] },
      { categoria: "Tesouro Selic",              percentual:  5, cor: "bg-emerald-200", dotCor: "bg-emerald-200", ativos: ["Selic 2027"] },
    ],
  },
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface Props {
  profile: string;
  onContinuar: (aporteValue: number) => void;
}

export function CarteiraSugeridaScreen({ profile, onContinuar }: Props) {
  const carteira = carteiras[profile];
  const [aporte, setAporte] = useState("");
  const [loading, setLoading] = useState(false);

  if (!carteira) return null;

  const Icon = carteira.icon;
  const aporteNum = Number(aporte.replace(/\D/g, "")) || 0;
  const temAporte = aporteNum > 0;

  async function handleContinuar() {
    setLoading(true);
    if (aporteNum > 0) {
      await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal_monthly_contribution: aporteNum }),
      });
    }
    onContinuar(aporteNum);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-5">

        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className={cn("mb-3", carteira.cor)}>
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="text-xl font-bold">{carteira.titulo}</h1>
          <p className="text-sm text-muted-foreground mt-1">{carteira.subtitulo}</p>
        </div>

        {/* Input de aporte mensal */}
        <div className="border rounded-xl px-4 py-4 space-y-2 bg-card">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Qual é o seu aporte mensal?</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Informe quanto você pretende investir todo mês. O sistema vai dividir automaticamente.
          </p>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={aporte}
              onChange={(e) => setAporte(e.target.value)}
              className="w-full border rounded-lg pl-9 pr-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 tabular-nums"
            />
          </div>
          {temAporte && (
            <p className="text-xs text-muted-foreground">
              Distribuindo <span className="font-semibold text-foreground">{fmtBRL(aporteNum)}</span>/mês nas categorias abaixo
            </p>
          )}
        </div>

        {/* Barra visual de alocação */}
        <div className="flex rounded-full overflow-hidden h-2.5 gap-px">
          {carteira.alocacoes.map((a) => (
            <div key={a.categoria} className={a.cor} style={{ width: `${a.percentual}%` }} />
          ))}
        </div>

        {/* Lista de alocações */}
        <div className="divide-y border rounded-xl overflow-hidden">
          {carteira.alocacoes.map((a) => {
            const valor = (aporteNum * a.percentual) / 100;
            return (
              <div key={a.categoria} className="px-4 py-3 bg-card">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", a.dotCor)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{a.categoria}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {temAporte && (
                          <span className="text-sm font-bold tabular-nums">{fmtBRL(valor)}</span>
                        )}
                        <span className={cn(
                          "text-xs font-semibold px-1.5 py-0.5 rounded",
                          temAporte ? "text-muted-foreground" : "text-foreground",
                        )}>
                          {a.percentual}%
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {a.ativos.map((ativo) => (
                        <span key={ativo} className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
                          {ativo}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Total */}
          {temAporte && (
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
              <span className="text-sm font-semibold">Total mensal</span>
              <span className="text-sm font-bold tabular-nums">{fmtBRL(aporteNum)}</span>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Sugestão baseada no seu perfil. Ajuste livremente em <strong>Investimentos</strong>.
        </p>

        {/* Botão */}
        <button
          type="button"
          disabled={loading}
          onClick={handleContinuar}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background font-semibold text-sm hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
        >
          {loading ? "Salvando..." : "Montar minha carteira"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
