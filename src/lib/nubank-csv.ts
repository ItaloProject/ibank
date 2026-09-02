import type { TransactionCategory } from "@/types/database";

export interface NubankRow {
  date: string;
  description: string;
  amount: number; // negative = pagamento recebido / estorno / crédito
  category: TransactionCategory;
  installments: number;
  installment_current: number;
  isCredit: boolean; // true when amount < 0
}

const CATEGORY_KEYWORDS: Record<TransactionCategory, string[]> = {
  alimentacao: [
    "mercado", "supermercado", "restaurante", "lanche", "pizza", "sushi",
    "ifood", "rappi", "uber eats", "ubereats", "padaria", "açougue", "acougue",
    "hortifruti", "burguer", "burger", "mc donalds", "mcdonalds", "subway",
    "bk ", "bob's", "giraffas", "outback", "spoleto", "coxinha", "empada",
    "sorveteria", "sorvete", "acai", "açaí", "pão", "pao de acucar",
    "carrefour", "extra ", "bistek", "condor", "angeloni", "atacadão",
    "atacado", "oba hortifruti", "santa clara", "churrascaria", "delivery",
    "cantinho", "temperos", "galeteria", "bistro", "magazine",
  ],
  transporte: [
    "uber", "99 ", "taxi", "táxi", "ônibus", "metro ", "metrô", "combustível",
    "posto ", "shell", "petrobras", "ipiranga", "estacionamento", "sem parar",
    "veloe", "move mais", "bilhete único", "bilhete unico", "rodoviaria",
    "passagem", "brt", "trem", "latam", "gol ", "azul ", "tap ", "wamos",
    "localiza", "movida", "unidas", "hertz", "avis", "petrollima",
  ],
  saude: [
    "farmácia", "farmacia", "drogaria", "drogasil", "ultrafarma", "panvel",
    "hospital", "clínica", "clinica", "médico", "medico", "dentista",
    "psicólogo", "psicologo", "laboratório", "laboratorio", "exame",
    "consulta", "plano de saude", "unimed", "amil", "bradesco saude",
    "sulamerica", "hapvida", "notredame", "optica", "óptica", "skyfit", "suhai",
  ],
  lazer: [
    "netflix", "spotify", "amazon prime", "disney", "hbo", "globoplay",
    "paramount", "apple tv", "deezer", "youtube premium", "steam",
    "playstation", "xbox", "cinema", "cine", "kinoplex", "shopping",
    "viagem", "hotel", "airbnb", "booking", "trivago", "decolar",
    "jogo", "game ", "clube", "academia", "smartfit", "bluefit",
    "ticket", "ingresso", "show", "teatro", "parque", "zoo",
    "arena", "sunset beach", "elevenlabs", "gamers",
  ],
  educacao: [
    "escola", "faculdade", "universidade", "curso", "udemy", "coursera",
    "alura", "dio ", "rocketseat", "livro", "amazon livro", "livraria",
    "saraiva", "cultura livro", "pearson", "blackboard", "moodle",
    "inglês", "ingles", "espanhol", "idioma", "colegio",
  ],
  moradia: [
    "aluguel", "condominio", "condomínio", "copasa", "sabesp", "sanepar",
    "cemig", "light ", "enel ", "enel energia", "energisa", "cpfl",
    "gás", "gas natural", "comgas", "claro ", "vivo ", "oi ", "tim ",
    "net ", "internet", "sky ", "direct tv", "portão", "portao",
    "imobiliaria", "imobiliária", "corretor", "lavanderi",
  ],
  vestuario: [
    "roupa", "sapato", "calçado", "calcado", "renner", "c&a", "zara",
    "h&m", "shein", "hering", "lupo", "riachuelo", "marisa", "leader",
    "centauro", "netshoes", "dafiti", "kanui", "tênis", "tenis",
    "moda", "fashion", "lojas", "magazine luiza", "casas bahia",
  ],
  outros: [],
};

function detectCategory(description: string): TransactionCategory {
  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [TransactionCategory, string[]][]) {
    if (category === "outros") continue;
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "outros";
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/"/g, "").trim();
  const isNegative = cleaned.startsWith("-");
  let num = cleaned.replace(/^-\s*/, "");
  if (num.includes(",")) num = num.replace(/\./g, "").replace(",", ".");
  const value = parseFloat(num);
  if (isNaN(value) || value === 0) return 0;
  return isNegative ? -value : value;
}

function parseDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  const parts = raw.trim().split("/");
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  return raw.trim();
}

export interface ParseNubankResult {
  rows: NubankRow[];
  /** "Valor pendente do mês anterior" found in the CSV — positive = you owe, negative = credit */
  saldoAnterior: number | null;
}

export function parseNubankCSV(content: string): ParseNubankResult {
  const lines = content.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], saldoAnterior: null };

  const headerCols = parseCSVLine(lines[0]).map((c) => c.toLowerCase());
  const dateIdx   = headerCols.findIndex((c) => c === "date"   || c === "data");
  const titleIdx  = headerCols.findIndex((c) => c === "title"  || c === "descrição" || c === "descricao" || c === "description");
  const amountIdx = headerCols.findIndex((c) => c === "amount" || c === "valor"     || c === "value");

  if (dateIdx === -1 || titleIdx === -1 || amountIdx === -1) {
    throw new Error(`Formato de CSV não reconhecido. Colunas encontradas: ${headerCols.join(", ")}`);
  }

  const rows: NubankRow[] = [];
  let saldoAnterior: number | null = null;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const rawAmount = cols[amountIdx];
    if (!rawAmount) continue;

    const amount = parseAmount(rawAmount);
    if (amount === 0) continue;

    const rawDescription = cols[titleIdx];
    if (!rawDescription) continue;

    // Skip PIX delay fees
    if (/^(multa|iof|juros) de atraso do pix/i.test(rawDescription)) continue;

    // Capture "Valor pendente do mês anterior" as saldo anterior instead of skipping
    if (/valor pendente do m[eê]s anterior/i.test(rawDescription)) {
      saldoAnterior = amount; // positive = you owe from previous invoice
      continue;
    }

    // Skip invoice payments — these are payments OF a previous invoice.
    if (/^pagamento\s+recebido/i.test(rawDescription)) continue;

    const date = parseDate(cols[dateIdx]);
    const isCredit = amount < 0;

    const installmentMatch = rawDescription.match(/[Pp]arcela\s+(\d+)\/(\d+)/);
    const installment_current = installmentMatch ? parseInt(installmentMatch[1]) : 1;
    const installments        = installmentMatch ? parseInt(installmentMatch[2]) : 1;

    rows.push({
      date,
      description: rawDescription,
      amount,
      category: isCredit ? "outros" : detectCategory(rawDescription),
      installments,
      installment_current,
      isCredit,
    });
  }

  return { rows, saldoAnterior };
}
