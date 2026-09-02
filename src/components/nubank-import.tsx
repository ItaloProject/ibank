"use client";

import { useRef, useState } from "react";
import { Upload, FileText, Check, X, AlertCircle, Loader2, Copy, ArrowDownCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { parseNubankCSV, type NubankRow, type ParseNubankResult } from "@/lib/nubank-csv";
import { createTransactions } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CreditCard } from "@/types/database";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCurrentUser } from "@/lib/user";

const CATEGORY_LABELS: Record<string, string> = {
  alimentacao: "Alimentação", transporte: "Transporte", saude: "Saúde",
  lazer: "Lazer", educacao: "Educação", moradia: "Moradia",
  vestuario: "Vestuário", outros: "Outros",
};

const CATEGORY_COLORS: Record<string, string> = {
  alimentacao: "bg-blue-100 text-blue-800", transporte: "bg-green-100 text-green-800",
  saude: "bg-yellow-100 text-yellow-800", lazer: "bg-purple-100 text-purple-800",
  educacao: "bg-cyan-100 text-cyan-800", moradia: "bg-red-100 text-red-800",
  vestuario: "bg-orange-100 text-orange-800", outros: "bg-gray-100 text-gray-800",
};

interface Props {
  cards: CreditCard[];
  onImported: (billingCycle?: string) => void;
}

type Step = "select-file" | "checking" | "preview" | "done";

interface ParsedRow extends NubankRow {
  isDuplicate: boolean;
}

function rowKey(date: string, description: string, amount: number) {
  return `${date}|${description.toLowerCase().trim()}|${Math.round(amount * 100)}`;
}

// Extract "YYYY-MM" from filename like "Nubank_2026-09-07.csv"
function extractCycle(filename: string): string | null {
  const m = filename.match(/(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

export function NubankImport({ cards, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select-file");
  const [selectedCard, setSelectedCard] = useState(cards[0]?.id ?? "");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [billingCycle, setBillingCycle] = useState<string | null>(null);
  const [saldoAnteriorCSV, setSaldoAnteriorCSV] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("select-file");
    setRows([]);
    setExcluded(new Set());
    setError("");
    setLoading(false);
    setBillingCycle(null);
    setSaldoAnteriorCSV(null);
    setImportedCount(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    setOpen(v);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    const cycle = extractCycle(file.name);
    setBillingCycle(cycle);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = ev.target?.result as string;
        const { rows: parsed, saldoAnterior } = parseNubankCSV(content);
        if (parsed.length === 0) {
          setError("Nenhuma transação encontrada no CSV.");
          return;
        }

        setSaldoAnteriorCSV(saldoAnterior);

        setStep("checking");

        // Fetch existing transactions to detect duplicates
        let existingKeys = new Set<string>();
        try {
          const user = getCurrentUser();
          // Fetch by billing_cycle if available, else by date range
          let url = `/api/transactions?user=${user}&card_id=${selectedCard}`;
          if (cycle) {
            url += `&billing_cycle=${cycle}`;
          } else {
            const minDate = parsed.reduce((m, r) => r.date < m ? r.date : m, parsed[0].date);
            const maxDate = parsed.reduce((m, r) => r.date > m ? r.date : m, parsed[0].date);
            url += `&start=${minDate}&end=${maxDate}`;
          }
          const res = await fetch(url);
          if (res.ok) {
            const existing: { date: string; description: string; amount: number }[] = await res.json();
            existingKeys = new Set(existing.map((t) => rowKey(t.date, t.description, Number(t.amount))));
          }
        } catch { /* proceed without dedup */ }

        const parsedRows: ParsedRow[] = parsed.map((r) => ({
          ...r,
          isDuplicate: existingKeys.has(rowKey(r.date, r.description, r.amount)),
        }));

        const preExcluded = new Set<number>();
        parsedRows.forEach((r, i) => { if (r.isDuplicate) preExcluded.add(i); });

        setRows(parsedRows);
        setExcluded(preExcluded);
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao processar o arquivo.");
        setStep("select-file");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function toggleExclude(idx: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  async function handleImport() {
    const toImport = rows.filter((_, i) => !excluded.has(i));
    if (!selectedCard || toImport.length === 0) return;
    setLoading(true);
    try {
      await createTransactions(
        toImport.map((r) => ({
          credit_card_id: selectedCard,
          description: r.description,
          amount: r.amount,
          category: r.category,
          date: r.date,
          installments: r.installments,
          installment_current: r.installment_current,
          billing_cycle: billingCycle,
        }))
      );
      setImportedCount(toImport.length);
      // Auto-save saldo anterior from CSV to localStorage
      if (billingCycle && saldoAnteriorCSV !== null) {
        try {
          localStorage.setItem(`ibank_saldo_ant_${selectedCard}_${billingCycle}`, String(saldoAnteriorCSV));
        } catch { /* ignore */ }
      }
      setStep("done");
      onImported(billingCycle ?? undefined);
    } catch {
      setError("Erro ao salvar as transações. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const credits = rows.filter((r) => r.isCredit);
  const purchases = rows.filter((r) => !r.isCredit);
  const duplicateCount = rows.filter((r) => r.isDuplicate).length;
  const toImportCount = rows.length - excluded.size;
  const cycleLabel = billingCycle
    ? format(new Date(`${billingCycle}-01T12:00:00`), "MMMM yyyy", { locale: ptBR })
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4" />
          Importar CSV Nubank
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Importar extrato do Nubank
          </DialogTitle>
        </DialogHeader>

        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum cartão cadastrado</p>
            <p className="text-sm text-muted-foreground">
              Cadastre um cartão clicando em <strong>Novo cartão</strong>.
            </p>
          </div>
        ) : null}

        {/* select-file */}
        {cards.length > 0 && step === "select-file" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No app do Nubank: <strong>Cartão → Ver fatura → Exportar extrato</strong>.
              Escolha o formato <strong>CSV</strong> e envie abaixo.
            </p>
            <div className="space-y-1.5">
              <Label>Cartão de destino</Label>
              <Select value={selectedCard} onValueChange={setSelectedCard}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cards.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors bg-muted/30 hover:bg-muted/50">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">Clique para selecionar o CSV</span>
              <span className="text-xs text-muted-foreground mt-1">Apenas arquivos .csv</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><p>{error}</p>
              </div>
            )}
          </div>
        )}

        {/* checking */}
        {cards.length > 0 && step === "checking" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Verificando duplicatas...</p>
          </div>
        )}

        {/* preview */}
        {cards.length > 0 && step === "preview" && (
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between shrink-0 flex-wrap gap-1">
              <div>
                {cycleLabel && (
                  <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
                    Fatura {cycleLabel}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {purchases.length} compras · {credits.length} crédito{credits.length !== 1 ? "s" : ""} —{" "}
                  <span className="font-medium text-foreground">{toImportCount} serão importados</span>
                </p>
                {saldoAnteriorCSV !== null && (
                  <p className="text-xs font-medium text-blue-600 mt-0.5">
                    Saldo anterior detectado: {saldoAnteriorCSV > 0
                      ? `R$ ${saldoAnteriorCSV.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (dívida anterior)`
                      : `R$ ${Math.abs(saldoAnteriorCSV).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de crédito`} — será salvo automaticamente
                  </p>
                )}
                {duplicateCount > 0 && (
                  <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                    <Copy className="h-3 w-3" />
                    {duplicateCount} já importado{duplicateCount !== 1 ? "s" : ""} (pré-desmarcado{duplicateCount !== 1 ? "s" : ""})
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>Trocar arquivo</Button>
            </div>

            <div className="overflow-y-auto flex-1 border rounded-lg divide-y">
              {rows.map((row, i) => {
                const isExcluded = excluded.has(i);
                return (
                  <div key={i} className={`flex items-center justify-between px-3 py-2.5 transition-colors ${isExcluded ? "opacity-40 bg-muted/30" : row.isCredit ? "bg-green-50/50 hover:bg-green-50" : "hover:bg-muted/30"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      {row.isCredit && <ArrowDownCircle className="h-4 w-4 text-green-600 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{row.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(row.date)}
                          {row.installments > 1 && (
                            <span className="ml-1 font-medium text-foreground/70">· {row.installment_current}/{row.installments}x</span>
                          )}
                        </p>
                      </div>
                      {row.isCredit ? (
                        <Badge className="shrink-0 bg-green-100 text-green-700 border-green-200">Crédito</Badge>
                      ) : (
                        <Badge className={`shrink-0 ${CATEGORY_COLORS[row.category]}`}>{CATEGORY_LABELS[row.category]}</Badge>
                      )}
                      {row.isDuplicate && (
                        <Badge className="shrink-0 bg-amber-100 text-amber-700 border-amber-200 text-[10px]">já importado</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <p className={`text-sm font-semibold ${row.isCredit ? "text-green-600" : "text-destructive"}`}>
                        {row.isCredit ? "+" : "-"}{formatCurrency(Math.abs(row.amount))}
                      </p>
                      <button onClick={() => toggleExclude(i)}
                        className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${isExcluded ? "bg-muted text-muted-foreground hover:bg-green-100 hover:text-green-700" : "bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"}`}
                        title={isExcluded ? "Incluir" : "Excluir"}>
                        {isExcluded ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3 shrink-0">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><p>{error}</p>
              </div>
            )}

            <Button className="w-full shrink-0" onClick={handleImport} disabled={loading || toImportCount === 0}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Importando...</>
                : toImportCount === 0 ? "Todos já importados"
                : <>Importar {toImportCount} lançamento{toImportCount !== 1 ? "s" : ""}</>}
            </Button>
          </div>
        )}

        {/* done */}
        {cards.length > 0 && step === "done" && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">Importação concluída!</p>
              <p className="text-muted-foreground text-sm mt-1">
                {importedCount} lançamento{importedCount !== 1 ? "s importados" : " importado"} com sucesso.
              </p>
              {cycleLabel && (
                <p className="text-xs text-purple-600 font-medium mt-1">Fatura {cycleLabel}</p>
              )}
            </div>
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
