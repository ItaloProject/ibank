// Paleta semântica MUVO — categoria de investimento
// Regra: cor só existe quando carrega informação (categoria, estado)
// Verde=ganho/positivo, Vermelho=perda/negativo, restantes=distinção de categoria
export const INVESTMENT_TYPE_COLORS: Record<string, string> = {
  TURBO:                 "#f5c425",  // amber   — produto premium/atenção
  FII:                   "#14b8a6",  // teal    — renda imobiliária
  FIIs:                  "#14b8a6",  // teal
  "RENDA FIXA":          "#38bdf8",  // sky     — renda fixa/segura
  "Renda Fixa":          "#38bdf8",  // sky
  AÇÃO:                  "#10b981",  // emerald — crescimento/positivo
  "Dividendos de ações": "#10b981",  // emerald
  ETF:                   "#f97316",  // orange  — diversificado/misto
  BDR:                   "#94a3b8",  // slate   — internacional/neutro
};
