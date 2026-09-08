"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, TrendingUp, Landmark, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alocacao {
  categoria: string;
  percentual: number;
  cor: string;
  ativos: string[];
  descricao: string;
}

const carteiras: Record<string, { titulo: string; subtitulo: string; icon: typeof Landmark; cor: string; alocacoes: Alocacao[] }> = {
  aposentadoria: {
    titulo: "Carteira de Aposentadoria",
    subtitulo: "Focada em crescimento de longo prazo com diversificação",
    icon: Landmark,
    cor: "text-blue-500",
    alocacoes: [
      {
        categoria: "Ações de Crescimento",
        percentual: 40,
        cor: "bg-blue-500",
        ativos: ["PETR4", "VALE3", "WEGE3", "BBAS3"],
        descricao: "Alta valorização no longo prazo",
      },
      {
        categoria: "FIIs Diversificados",
        percentual: 25,
        cor: "bg-blue-400",
        ativos: ["MXRF11", "HGLG11", "KNRI11"],
        descricao: "Renda + valorização de imóveis",
      },
      {
        categoria: "Tesouro IPCA+",
        percentual: 20,
        cor: "bg-blue-300",
        ativos: ["IPCA+ 2035", "IPCA+ 2045"],
        descricao: "Proteção contra inflação",
      },
      {
        categoria: "Renda Fixa",
        percentual: 15,
        cor: "bg-blue-200",
        ativos: ["CDB", "LCI", "LCA"],
        descricao: "Segurança e liquidez",
      },
    ],
  },
  renda_mensal: {
    titulo: "Carteira de Renda Mensal",
    subtitulo: "Focada em gerar proventos constantes todo mês",
    icon: TrendingUp,
    cor: "text-emerald-500",
    alocacoes: [
      {
        categoria: "FIIs de Renda",
        percentual: 40,
        cor: "bg-emerald-500",
        ativos: ["MXRF11", "HCTR11", "XPML11"],
        descricao: "Rendimentos mensais garantidos",
      },
      {
        categoria: "Ações com Dividendos",
        percentual: 35,
        cor: "bg-emerald-400",
        ativos: ["BBAS3", "ITUB4", "TAEE11"],
        descricao: "Dividendos recorrentes",
      },
      {
        categoria: "CDB / LCI / LCA",
        percentual: 20,
        cor: "bg-emerald-300",
        ativos: ["CDB", "LCI", "LCA"],
        descricao: "Rendimento previsível",
      },
      {
        categoria: "Tesouro Selic",
        percentual: 5,
        cor: "bg-emerald-200",
        ativos: ["Selic 2027"],
        descricao: "Reserva de liquidez",
      },
    ],
  },
};

interface Props {
  profile: string;
  onContinuar: () => void;
}

export function CarteiraSugeridaScreen({ profile, onContinuar }: Props) {
  const carteira = carteiras[profile];
  if (!carteira) return null;

  const Icon = carteira.icon;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className={cn("mb-3", carteira.cor)}>
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="text-xl font-bold text-center">{carteira.titulo}</h1>
          <p className="text-sm text-muted-foreground text-center mt-1">{carteira.subtitulo}</p>
        </div>

        {/* Barra de alocação visual */}
        <div className="flex rounded-full overflow-hidden h-3 mb-6 gap-0.5">
          {carteira.alocacoes.map((a) => (
            <div
              key={a.categoria}
              className={a.cor}
              style={{ width: `${a.percentual}%` }}
            />
          ))}
        </div>

        {/* Cards de alocação */}
        <div className="flex flex-col divide-y border rounded-xl overflow-hidden mb-6">
          {carteira.alocacoes.map((a) => (
            <div key={a.categoria} className="flex items-center gap-3 px-4 py-3 bg-card">
              <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", a.cor)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{a.categoria}</span>
                  <span className="text-sm font-bold shrink-0">{a.percentual}%</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {a.ativos.map((ativo) => (
                    <span key={ativo} className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
                      {ativo}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mb-5">
          Esta é uma sugestão de alocação. Você pode ajustar conforme seu perfil de risco e objetivos pessoais.
        </p>

        {/* Botão continuar */}
        <button
          type="button"
          onClick={onContinuar}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background font-semibold text-sm hover:opacity-90 active:opacity-80 transition-opacity"
        >
          Montar minha carteira
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
