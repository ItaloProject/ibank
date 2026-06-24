import type { TransactionCategory } from "@/types/database";

export interface NubankRow {
  date: string;
  description: string;
  amount: number;
  category: TransactionCategory;
  installments: number;
  installment_current: number;
}

const CATEGORY_KEYWORDS: Record<TransactionCategory, string[]> = {
  alimentacao: [
    "mercado", "supermercado", "restaurante", "lanche", "pizza", "sushi",
    "ifood", "rappi", "uber eats", "ubereats", "padaria", "açougue",
    "hortifruti", "burguer", "burger", "mc donalds", "mcdonalds", "subway",
    "bk ", "bob's", "giraffas", "outback", "spoleto", "coxinha", "empada",
    "sorveteria", "sorvete", "acai", "açaí", "pão", "pao de acucar",
    "carrefour", "extra ", "bistek", "condor", "angeloni", "atacadão",
    "atacado", "oba hortifruti", "santa clara", "churrascaria", "delivery",
  ],
  transporte: [
    "uber", "99 ", "taxi", "táxi", "ônibus", "metro ", "metrô", "combustível",
    "posto ", "shell", "petrobras", "ipiranga", "estacionamento", "sem parar",
    "veloe", "move mais", "bilhete único", "bilhete unico", "rodoviaria",
    "passagem", "brt", "trem", "latam", "gol ", "azul ", "tap ", "wamos",
    "localiza", "movida", "unidas", "hertz", "avis",
  ],
  saude: [
    "farmácia", "farmacia", "drogaria", "drogasil", "ultrafarma", "panvel",
    "hospital", "clínica", "clinica", "médico", "medico", "dentista",
    "psicólogo", "psicologo", "laboratório", "laboratorio", "exame",
    "consulta", "plano de saude", "unimed", "amil", "bradesco saude",
    "sulamerica", "hapvida", "notredame", "optica", "óptica",
  ],
  lazer: [
    "netflix", "spotify", "amazon prime", "disney", "hbo", "globoplay",
    "paramount", "apple tv", "deezer", "youtube premium", "steam",
    "playstation", "xbox", "cinema", "cine", "kinoplex", "shopping",
    "viagem", "hotel", "airbnb", "booking", "trivago", "decolar",
    "jogo", "game ", "clube", "academia", "smartfit", "bluefit",
    "ticket", "ingresso", "show", "teatro", "parque", "zoo",
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
    "imobiliaria", "imobiliária", "corretor",
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

function parseAmount(raw: string): number {
  // Handle both "150.00" and "150,00" and "-150,00"
  return Math.abs(parseFloat(raw.replace(",", ".")));
}

function parseDate(raw: string): string {
  // YYYY-MM-DD → ok; DD/MM/YYYY → convert
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw.trim();
  const parts = raw.trim().split("/");
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  return raw.trim();
}

export function parseNubankCSV(content: string): NubankRow[] {
  const lines = content.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().replace(/"/g, "");
  const columns = header.split(",").map((c) => c.trim());

  // Map column names to indexes (supports pt-BR and en headers)
  const dateIdx = columns.findIndex((c) => c === "date" || c === "data");
  const titleIdx = columns.findIndex(
    (c) => c === "title" || c === "descrição" || c === "descricao" || c === "description"
  );
  const amountIdx = columns.findIndex(
    (c) => c === "amount" || c === "valor" || c === "value"
  );

  if (dateIdx === -1 || titleIdx === -1 || amountIdx === -1) {
    throw new Error(
      `Formato de CSV não reconhecido. Colunas encontradas: ${columns.join(", ")}`
    );
  }

  const rows: NubankRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.replace(/"/g, "").trim());
    if (cols.length < 3) continue;

    const rawAmount = cols[amountIdx];
    if (!rawAmount) continue;

    const amount = parseAmount(rawAmount);
    if (amount <= 0) continue; // skip payments/credits

    const rawDescription = cols[titleIdx];
    const date = parseDate(cols[dateIdx]);

    // Extrai "Parcela X/Y" da descrição (case-insensitive, com ou sem acento)
    const installmentMatch = rawDescription.match(/[Pp]arcela\s+(\d+)\/(\d+)/);
    const installment_current = installmentMatch ? parseInt(installmentMatch[1]) : 1;
    const installments = installmentMatch ? parseInt(installmentMatch[2]) : 1;

    rows.push({
      date,
      description: rawDescription,
      amount,
      category: detectCategory(rawDescription),
      installments,
      installment_current,
    });
  }

  return rows;
}
