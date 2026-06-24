"use client";

import { useRef, useState } from "react";
import { Upload, FileText, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { parseNubankCSV, type NubankRow } from "@/lib/nubank-csv";
import { createTransactions } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CreditCard } from "@/types/database";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  onImported: (firstDate?: string) => void;
}

type Step = "select-file" | "preview" | "done";

export function NubankImport({ cards, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select-file");
  const [selectedCard, setSelectedCard] = useState(cards[0]?.id ?? "");
  const [rows, setRows] = useState<NubankRow[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [filenameMonth, setFilenameMonth] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("select-file");
    setRows([]);
    setExcluded(new Set());
    setError("");
    setLoading(false);
    setFilenameMonth(undefined);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    setOpen(v);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    // Extrai YYYY-MM do nome: Nubank_2026-07-07.csv → "2026-07-01"
    const match = file.name.match(/(\d{4})-(\d{2})/);
    if (match) setFilenameMonth(`${match[1]}-${match[2]}-01`);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const parsed = parseNubankCSV(content);
        if (parsed.length === 0) {
          setError("Nenhuma transação encontrada no CSV. Verifique se é um extrato do Nubank.");
          return;
        }
        setRows(parsed);
        setExcluded(new Set());
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao processar o arquivo.");
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function toggleExclude(idx: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
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
        }))
      );
      setImportedCount(toImport.length);
      setStep("done");
      // Prioriza mês do nome do arquivo; fallback para data da primeira transação
      onImported(filenameMonth ?? toImport[0]?.date);
    } catch {
      setError("Erro ao salvar as transações. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const toImportCount = rows.length - excluded.size;

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

        {/* Sem cartão cadastrado */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum cartão cadastrado</p>
            <p className="text-sm text-muted-foreground">
              Antes de importar, cadastre um cartão clicando em{" "}
              <strong>Novo cartão</strong> na página de Cartão de Crédito.
            </p>
          </div>
        ) : null}

        {/* Step: select file */}
        {cards.length > 0 && step === "select-file" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No app do Nubank: <strong>Cartão → Ver fatura → Exportar extrato</strong>.
              Escolha o formato <strong>CSV</strong> e envie o arquivo abaixo.
            </p>

            <div className="space-y-1.5">
              <Label>Cartão de destino</Label>
              <Select value={selectedCard} onValueChange={setSelectedCard}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label
              className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors bg-muted/30 hover:bg-muted/50"
            >
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">Clique para selecionar o CSV</span>
              <span className="text-xs text-muted-foreground mt-1">Apenas arquivos .csv</span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFile}
              />
            </label>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Step: preview */}
        {cards.length > 0 && step === "preview" && (
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between shrink-0 flex-wrap gap-1">
              <div>
                <p className="text-sm text-muted-foreground">
                  {rows.length} transações encontradas —{" "}
                  <span className="font-medium text-foreground">{toImportCount} serão importadas</span>
                  {excluded.size > 0 && `, ${excluded.size} excluídas`}
                </p>
                {filenameMonth && (
                  <p className="text-xs text-blue-600 font-medium mt-0.5">
                    Mês identificado: {format(new Date(filenameMonth + "T12:00:00"), "MMMM yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>Trocar arquivo</Button>
            </div>

            <div className="overflow-y-auto flex-1 border rounded-lg divide-y">
              {rows.map((row, i) => {
                const isExcluded = excluded.has(i);
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2.5 transition-colors ${
                      isExcluded ? "opacity-40 bg-muted/30" : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{row.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(row.date)}
                          {row.installments > 1 && (
                            <span className="ml-1 font-medium text-foreground/70">
                              · {row.installment_current}/{row.installments}x
                            </span>
                          )}
                        </p>
                      </div>
                      <Badge className={`shrink-0 ${CATEGORY_COLORS[row.category]}`}>
                        {CATEGORY_LABELS[row.category]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <p className="text-sm font-semibold text-destructive">
                        -{formatCurrency(row.amount)}
                      </p>
                      <button
                        onClick={() => toggleExclude(i)}
                        className={`h-6 w-6 rounded flex items-center justify-center transition-colors ${
                          isExcluded
                            ? "bg-muted text-muted-foreground hover:bg-green-100 hover:text-green-700"
                            : "bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        }`}
                        title={isExcluded ? "Incluir" : "Excluir"}
                      >
                        {isExcluded ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3 shrink-0">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <Button
              className="w-full shrink-0"
              onClick={handleImport}
              disabled={loading || toImportCount === 0}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Importando...</>
              ) : (
                <>Importar {toImportCount} transação{toImportCount !== 1 ? "ões" : ""}</>
              )}
            </Button>
          </div>
        )}

        {/* Step: done */}
        {cards.length > 0 && step === "done" && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">Importação concluída!</p>
              <p className="text-muted-foreground text-sm mt-1">
                {importedCount} transação{importedCount !== 1 ? "ões importadas" : " importada"} com sucesso.
              </p>
            </div>
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
