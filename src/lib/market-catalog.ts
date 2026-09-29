/**
 * Catálogo de ativos da B3 oferecidos na tela de investir.
 * Seleção feita a partir dos rankings de volume da B3 (DataWise+, 2026),
 * da composição do Ibovespa e do IFIX, e dos rankings de liquidez e
 * patrimônio dos fundos imobiliários, diversificada por setor e segmento.
 * Os preços não ficam aqui: vêm da cotação de mercado na hora.
 */

export type CatalogKind = "acao" | "fii";

export type CatalogEntry = {
  ticker: string;
  name: string;
  /** Setor (ações) ou segmento (fundos imobiliários). */
  group: string;
  /** Entre os mais negociados: aparece primeiro em "Mais negociados". */
  top?: boolean;
};

export const STOCK_GROUPS = [
  "Bancos e seguros",
  "Petróleo e gás",
  "Mineração e siderurgia",
  "Energia elétrica",
  "Saneamento",
  "Indústria",
  "Varejo e consumo",
  "Alimentos e agronegócio",
  "Saúde",
  "Telecomunicações e tecnologia",
  "Educação",
  "Construção e imóveis",
  "Transporte e logística",
  "Papel e celulose",
] as const;

export const FII_GROUPS = [
  "Recebíveis (papel)",
  "Logística e galpões",
  "Shoppings",
  "Escritórios",
  "Renda urbana e híbridos",
  "Fundos de fundos",
] as const;

export const STOCK_CATALOG: CatalogEntry[] = [
  { ticker: "ITUB4", name: "Itaú Unibanco", group: "Bancos e seguros", top: true },
  { ticker: "BBDC4", name: "Bradesco", group: "Bancos e seguros", top: true },
  { ticker: "BBAS3", name: "Banco do Brasil", group: "Bancos e seguros", top: true },
  { ticker: "BPAC11", name: "BTG Pactual", group: "Bancos e seguros", top: true },
  { ticker: "SANB11", name: "Santander Brasil", group: "Bancos e seguros" },
  { ticker: "ITSA4", name: "Itaúsa", group: "Bancos e seguros", top: true },
  { ticker: "B3SA3", name: "B3", group: "Bancos e seguros", top: true },
  { ticker: "BBSE3", name: "BB Seguridade", group: "Bancos e seguros" },
  { ticker: "CXSE3", name: "Caixa Seguridade", group: "Bancos e seguros" },
  { ticker: "PSSA3", name: "Porto Seguro", group: "Bancos e seguros" },
  { ticker: "BBDC3", name: "Bradesco (ordinária)", group: "Bancos e seguros" },

  { ticker: "PETR4", name: "Petrobras", group: "Petróleo e gás", top: true },
  { ticker: "PETR3", name: "Petrobras (ordinária)", group: "Petróleo e gás", top: true },
  { ticker: "PRIO3", name: "PRIO", group: "Petróleo e gás", top: true },
  { ticker: "UGPA3", name: "Ultrapar", group: "Petróleo e gás" },
  { ticker: "VBBR3", name: "Vibra Energia", group: "Petróleo e gás" },
  { ticker: "CSAN3", name: "Cosan", group: "Petróleo e gás" },
  { ticker: "BRAV3", name: "Brava Energia", group: "Petróleo e gás" },
  { ticker: "RECV3", name: "PetroReconcavo", group: "Petróleo e gás" },

  { ticker: "VALE3", name: "Vale", group: "Mineração e siderurgia", top: true },
  { ticker: "CMIN3", name: "CSN Mineração", group: "Mineração e siderurgia" },
  { ticker: "GGBR4", name: "Gerdau", group: "Mineração e siderurgia" },
  { ticker: "GOAU4", name: "Metalúrgica Gerdau", group: "Mineração e siderurgia" },
  { ticker: "CSNA3", name: "CSN", group: "Mineração e siderurgia" },
  { ticker: "USIM5", name: "Usiminas", group: "Mineração e siderurgia" },
  { ticker: "BRAP4", name: "Bradespar", group: "Mineração e siderurgia" },

  { ticker: "AXIA3", name: "Axia Energia (antiga Eletrobras)", group: "Energia elétrica", top: true },
  { ticker: "EGIE3", name: "Engie Brasil", group: "Energia elétrica" },
  { ticker: "TAEE11", name: "Taesa", group: "Energia elétrica" },
  { ticker: "CMIG4", name: "Cemig", group: "Energia elétrica" },
  { ticker: "CPLE3", name: "Copel", group: "Energia elétrica" },
  { ticker: "EQTL3", name: "Equatorial", group: "Energia elétrica" },
  { ticker: "ISAE4", name: "ISA Energia", group: "Energia elétrica" },
  { ticker: "ALUP11", name: "Alupar", group: "Energia elétrica" },
  { ticker: "ENGI11", name: "Energisa", group: "Energia elétrica" },
  { ticker: "CPFE3", name: "CPFL Energia", group: "Energia elétrica" },
  { ticker: "AURE3", name: "Auren Energia", group: "Energia elétrica" },

  { ticker: "SBSP3", name: "Sabesp", group: "Saneamento", top: true },
  { ticker: "SAPR11", name: "Sanepar", group: "Saneamento" },
  { ticker: "CSMG3", name: "Copasa", group: "Saneamento" },

  { ticker: "WEGE3", name: "WEG", group: "Indústria", top: true },
  { ticker: "EMBJ3", name: "Embraer", group: "Indústria", top: true },
  { ticker: "RAPT4", name: "Randoncorp", group: "Indústria" },
  { ticker: "POMO4", name: "Marcopolo", group: "Indústria" },
  { ticker: "TUPY3", name: "Tupy", group: "Indústria" },

  { ticker: "ABEV3", name: "Ambev", group: "Varejo e consumo", top: true },
  { ticker: "LREN3", name: "Lojas Renner", group: "Varejo e consumo" },
  { ticker: "MGLU3", name: "Magazine Luiza", group: "Varejo e consumo", top: true },
  { ticker: "ASAI3", name: "Assaí", group: "Varejo e consumo" },
  { ticker: "GMAT3", name: "Grupo Mateus", group: "Varejo e consumo" },
  { ticker: "NATU3", name: "Natura", group: "Varejo e consumo" },
  { ticker: "VIVA3", name: "Vivara", group: "Varejo e consumo" },
  { ticker: "CEAB3", name: "C&A", group: "Varejo e consumo" },
  { ticker: "AZZA3", name: "Azzas 2154", group: "Varejo e consumo" },

  { ticker: "MBRF3", name: "MBRF (BRF e Marfrig)", group: "Alimentos e agronegócio" },
  { ticker: "BEEF3", name: "Minerva", group: "Alimentos e agronegócio" },
  { ticker: "SLCE3", name: "SLC Agrícola", group: "Alimentos e agronegócio" },
  { ticker: "SMTO3", name: "São Martinho", group: "Alimentos e agronegócio" },
  { ticker: "RAIZ4", name: "Raízen", group: "Alimentos e agronegócio" },

  { ticker: "RDOR3", name: "Rede D'Or", group: "Saúde" },
  { ticker: "HAPV3", name: "Hapvida", group: "Saúde" },
  { ticker: "RADL3", name: "Raia Drogasil", group: "Saúde" },
  { ticker: "FLRY3", name: "Fleury", group: "Saúde" },
  { ticker: "HYPE3", name: "Hypera", group: "Saúde" },

  { ticker: "VIVT3", name: "Vivo (Telefônica Brasil)", group: "Telecomunicações e tecnologia" },
  { ticker: "TIMS3", name: "TIM", group: "Telecomunicações e tecnologia" },
  { ticker: "TOTS3", name: "Totvs", group: "Telecomunicações e tecnologia" },
  { ticker: "INTB3", name: "Intelbras", group: "Telecomunicações e tecnologia" },

  { ticker: "COGN3", name: "Cogna", group: "Educação" },
  { ticker: "YDUQ3", name: "Yduqs", group: "Educação" },

  { ticker: "CYRE3", name: "Cyrela", group: "Construção e imóveis" },
  { ticker: "CURY3", name: "Cury", group: "Construção e imóveis" },
  { ticker: "DIRR3", name: "Direcional", group: "Construção e imóveis" },
  { ticker: "MRVE3", name: "MRV", group: "Construção e imóveis" },
  { ticker: "TEND3", name: "Tenda", group: "Construção e imóveis" },
  { ticker: "MULT3", name: "Multiplan", group: "Construção e imóveis" },
  { ticker: "ALOS3", name: "Allos", group: "Construção e imóveis" },

  { ticker: "RENT3", name: "Localiza", group: "Transporte e logística" },
  { ticker: "RAIL3", name: "Rumo", group: "Transporte e logística" },
  { ticker: "MOTV3", name: "Motiva (antiga CCR)", group: "Transporte e logística" },
  { ticker: "ECOR3", name: "EcoRodovias", group: "Transporte e logística" },
  { ticker: "SIMH3", name: "Simpar", group: "Transporte e logística" },

  { ticker: "SUZB3", name: "Suzano", group: "Papel e celulose" },
  { ticker: "KLBN11", name: "Klabin", group: "Papel e celulose" },
];

export const FII_CATALOG: CatalogEntry[] = [
  { ticker: "KNCR11", name: "Kinea Rendimentos Imobiliários", group: "Recebíveis (papel)", top: true },
  { ticker: "MXRF11", name: "Maxi Renda", group: "Recebíveis (papel)", top: true },
  { ticker: "CPTS11", name: "Capitania Securities II", group: "Recebíveis (papel)", top: true },
  { ticker: "KNIP11", name: "Kinea Índices de Preços", group: "Recebíveis (papel)" },
  { ticker: "KNSC11", name: "Kinea Securities", group: "Recebíveis (papel)" },
  { ticker: "IRDM11", name: "Iridium Recebíveis", group: "Recebíveis (papel)" },
  { ticker: "RBRR11", name: "RBR Rendimento High Grade", group: "Recebíveis (papel)" },
  { ticker: "RECR11", name: "REC Recebíveis", group: "Recebíveis (papel)" },
  { ticker: "VGIR11", name: "Valora Recebíveis", group: "Recebíveis (papel)" },
  { ticker: "MCCI11", name: "Mauá Capital Recebíveis", group: "Recebíveis (papel)" },
  { ticker: "BTCI11", name: "BTG Pactual Crédito Imobiliário", group: "Recebíveis (papel)" },
  { ticker: "VRTA11", name: "Fator Verità", group: "Recebíveis (papel)" },
  { ticker: "MCRE11", name: "Mauá Capital Real Estate", group: "Recebíveis (papel)" },

  { ticker: "HGLG11", name: "Pátria Log", group: "Logística e galpões", top: true },
  { ticker: "BTLG11", name: "BTG Pactual Logística", group: "Logística e galpões", top: true },
  { ticker: "XPLG11", name: "XP Log", group: "Logística e galpões", top: true },
  { ticker: "GGRC11", name: "Zagros Renda Imobiliária", group: "Logística e galpões", top: true },
  { ticker: "VILG11", name: "Vinci Logística", group: "Logística e galpões" },
  { ticker: "BRCO11", name: "Bresco Logística", group: "Logística e galpões" },
  { ticker: "LVBI11", name: "VBI Logístico", group: "Logística e galpões" },
  { ticker: "TRBL11", name: "Tellus Rio Bravo Renda Logística", group: "Logística e galpões" },

  { ticker: "XPML11", name: "XP Malls", group: "Shoppings", top: true },
  { ticker: "VISC11", name: "Vinci Shopping Centers", group: "Shoppings" },
  { ticker: "HSML11", name: "HSI Malls", group: "Shoppings" },
  { ticker: "CPSH11", name: "Capitania Shoppings", group: "Shoppings" },
  { ticker: "HGBS11", name: "Hedge Brasil Shopping", group: "Shoppings" },

  { ticker: "PVBI11", name: "VBI Prime Properties", group: "Escritórios" },
  { ticker: "JSRE11", name: "JS Real Estate Multigestão", group: "Escritórios" },
  { ticker: "RCRB11", name: "Rio Bravo Renda Corporativa", group: "Escritórios" },
  { ticker: "BRCR11", name: "BTG Pactual Corporate Office", group: "Escritórios" },
  { ticker: "TEPP11", name: "Tellus Properties", group: "Escritórios", top: true },

  { ticker: "TRXF11", name: "TRX Real Estate", group: "Renda urbana e híbridos", top: true },
  { ticker: "GARE11", name: "Guardian Real Estate", group: "Renda urbana e híbridos", top: true },
  { ticker: "KNRI11", name: "Kinea Renda Imobiliária", group: "Renda urbana e híbridos", top: true },
  { ticker: "HGRU11", name: "Pátria Renda Urbana", group: "Renda urbana e híbridos" },
  { ticker: "ALZR11", name: "Alianza Trust Renda Imobiliária", group: "Renda urbana e híbridos" },
  { ticker: "RBVA11", name: "Rio Bravo Renda Varejo", group: "Renda urbana e híbridos" },
  { ticker: "TGAR11", name: "TG Ativo Real", group: "Renda urbana e híbridos" },

  { ticker: "RBRF11", name: "RBR Alpha Multiestratégia", group: "Fundos de fundos" },
  { ticker: "HFOF11", name: "Hedge Top Fundo de Fundos", group: "Fundos de fundos" },
  { ticker: "KFOF11", name: "Kinea Fundo de Fundos", group: "Fundos de fundos" },
];

const STOCK_TICKERS = new Set(STOCK_CATALOG.map((a) => a.ticker));
const FII_TICKERS = new Set(FII_CATALOG.map((a) => a.ticker));
const NAME_BY_TICKER = new Map([...STOCK_CATALOG, ...FII_CATALOG].map((a) => [a.ticker, a.name]));

export function isCatalogStock(ticker: string): boolean {
  return STOCK_TICKERS.has(ticker);
}

export function isCatalogFii(ticker: string): boolean {
  return FII_TICKERS.has(ticker);
}

export function catalogName(ticker: string): string | undefined {
  return NAME_BY_TICKER.get(ticker);
}
