import type { Investment, StockTrade } from "@/types/database";

export function accountBalance(investments: Investment[], accountId: string) {
  return investments
    .filter((i) => i.account_id === accountId)
    .reduce((s, inv) => (inv.type === "retirada" ? s - inv.amount : s + inv.amount), 0);
}

// FIIs conhecidos (sufixo 11 que são fundos imobiliários, não ações ou ETFs)
export const FII_SET = new Set([
  "MXRF11","HGLG11","XPML11","BCFF11","KNRI11","HSML11","BTLG11","IRDM11",
  "RBRF11","VGIP11","VISC11","BRCO11","CPTS11","KNCR11","PVBI11","RBRP11",
  "HGRU11","ALZR11","XPLG11","RECT11","MGFF11","HABT11","RBRR11","TGAR11",
  "HGRE11","VILG11","PATL11","BBFI11B","JSAF11","RZAK11","BPFF11","VRTA11",
  "VINO11","HGPO11","FVPQ11","DEVA11","SNAG11","GGRC11","BCRI11","AFHI11",
  "MCCI11","RCRB11","ARRI11","HCTR11","OUJP11","SARE11","RBVA11","CVBI11",
  "RBRD11","BARI11","RNDP11","VGHF11","TRXF11","XPCI11","FIGS11","HGBS11",
  "FLMA11","HFOF11","TPFT11","BRCR11","CSHG11","SPTW11","GTWR11","MALL11",
  "ABCP11","PQDP11","WPLZ11","DOMC11","SHPH11","FMOF11","EDGA11","CBOP11",
  "IGTI11","BRML3",
]);

// ETFs conhecidos (sufixo 11 que são ETFs de índice)
export const ETF_SET = new Set([
  "BOVA11","SMAL11","IVVB11","SPXI11","DIVO11","FIND11","GOVE11","MATB11",
  "ECOO11","ISUS11","TECK11","GOLD11","HASH11","BIT11","ETHE11","NFTF11",
  "ACWI11","NASD11","EURO11","JPUS11","ASIA11","INFR11","AGRI11",
]);

// Setor por ticker — ações brasileiras
export const SECTOR_MAP: Record<string, string> = {
  // Bancos / Financeiro
  BBAS3: "Financeiro", BBDC3: "Financeiro", BBDC4: "Financeiro", ITUB3: "Financeiro",
  ITUB4: "Financeiro", SANB11: "Financeiro", SANB3: "Financeiro", SANB4: "Financeiro",
  BPAC11: "Financeiro", BPAC3: "Financeiro", BPAC5: "Financeiro", BRSR6: "Financeiro",
  BMGB4: "Financeiro", IRBR3: "Financeiro", SULA11: "Financeiro", PSSA3: "Financeiro",
  B3SA3: "Financeiro", CIEL3: "Financeiro", WIZC3: "Financeiro", AXIA3: "Financeiro",
  // Energia elétrica
  ELET3: "Energia", ELET6: "Energia", CMIG3: "Energia", CMIG4: "Energia",
  CPFE3: "Energia", ENGI11: "Energia", ENGI3: "Energia", ENGI4: "Energia",
  ENEV3: "Energia", EGIE3: "Energia", TAEE11: "Energia", TAEE3: "Energia",
  TAEE4: "Energia", TRPL4: "Energia", TRPL3: "Energia", COCE5: "Energia",
  EQTL3: "Energia", CESP6: "Energia", AURE3: "Energia", AESB3: "Energia",
  RNEW11: "Energia",
  // Petróleo / Gás
  PETR3: "Petróleo & Gás", PETR4: "Petróleo & Gás", PTR3: "Petróleo & Gás",
  PTR4: "Petróleo & Gás", PRIO3: "Petróleo & Gás", RECV3: "Petróleo & Gás",
  CSAN3: "Petróleo & Gás", RRRP3: "Petróleo & Gás", VBBR3: "Petróleo & Gás",
  // Mineração / Siderurgia
  VALE3: "Mineração", CSNA3: "Siderurgia", GGBR3: "Siderurgia", GGBR4: "Siderurgia",
  GOAU3: "Siderurgia", GOAU4: "Siderurgia", USIM3: "Siderurgia", USIM5: "Siderurgia",
  CMIN3: "Mineração", FESA4: "Mineração",
  // Varejo
  MGLU3: "Varejo", VIIA3: "Varejo", LREN3: "Varejo", AMER3: "Varejo",
  SOMA3: "Varejo", ALPA4: "Varejo", HGTX3: "Varejo", AMAR3: "Varejo", TFCO4: "Varejo",
  // Alimentos & Bebidas / Agro
  ABEV3: "Alimentos & Bebidas", JBSS3: "Alimentos & Bebidas", MRFG3: "Alimentos & Bebidas",
  BEEF3: "Alimentos & Bebidas", BRFS3: "Alimentos & Bebidas",
  SLCE3: "Agronegócio", AGRO3: "Agronegócio", TTEN3: "Agronegócio", SMTO3: "Agronegócio",
  CAML3: "Agronegócio",
  // Papel & Celulose
  SUZB3: "Papel & Celulose", KLBN11: "Papel & Celulose", KLBN3: "Papel & Celulose", KLBN4: "Papel & Celulose",
  // Saúde
  RDOR3: "Saúde", HAPV3: "Saúde", FLRY3: "Saúde", DASA3: "Saúde",
  QUAL3: "Saúde", HYPE3: "Saúde", PGMN3: "Saúde", BLAU3: "Saúde",
  // Telecom / Tecnologia
  VIVT3: "Telecom", TIMS3: "Telecom", OIBR3: "Telecom",
  POSI3: "Tecnologia", LWSA3: "Tecnologia", CASH3: "Tecnologia", TOTVS3: "Tecnologia",
  // Construção Civil
  MRVE3: "Construção Civil", CYRE3: "Construção Civil", TEND3: "Construção Civil",
  DIRR3: "Construção Civil", EVEN3: "Construção Civil", EZTC3: "Construção Civil", PLPL3: "Construção Civil",
  // Logística / Transporte
  RAIL3: "Logística", TGMA3: "Logística", CCRO3: "Logística", ECOR3: "Logística",
  AZUL4: "Aviação", GOLL4: "Aviação", EMBR3: "Aeroespacial",
  // Saneamento
  SBSP3: "Saneamento", CSMG3: "Saneamento",
};

export const SECTOR_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#a855f7", "#64748b",
];

export type AssetType = "FII" | "ETF" | "BDR" | "Ação";

export function detectAssetType(ticker: string): AssetType {
  const upper = ticker.toUpperCase().replace(/\s/g, "");
  if (FII_SET.has(upper)) return "FII";
  if (ETF_SET.has(upper)) return "ETF";
  if (upper.endsWith("34") || upper.endsWith("35")) return "BDR";
  // sufixo 11 desconhecido → assume FII (mais comum)
  if (upper.endsWith("11") && !SECTOR_MAP[upper]) return "FII";
  return "Ação";
}

export function detectSector(ticker: string): string {
  const upper = ticker.toUpperCase().replace(/\s/g, "");
  const type = detectAssetType(upper);
  if (type === "FII") return "Fundo Imobiliário";
  if (type === "ETF") return "ETF";
  if (type === "BDR") return "BDR";
  if (SECTOR_MAP[upper]) return SECTOR_MAP[upper];
  return "Outros";
}

export function computeStockPositions(trades: StockTrade[]) {
  const map = new Map<string, { qty: number; invested: number }>();
  for (const t of trades) {
    const cur = map.get(t.ticker) ?? { qty: 0, invested: 0 };
    if (t.type === "compra") {
      cur.qty += t.quantity;
      cur.invested += t.total_amount;
    } else {
      cur.qty -= t.quantity;
      cur.invested -= t.total_amount;
    }
    map.set(t.ticker, cur);
  }
  return [...map.entries()]
    .filter(([, v]) => v.qty > 0.0001)
    .map(([ticker, v]) => ({
      ticker,
      quantity: v.qty,
      totalInvested: Math.max(0, v.invested),
      avgPrice: v.qty > 0 ? v.invested / v.qty : 0,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}
