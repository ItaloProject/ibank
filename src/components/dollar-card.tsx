"use client";

import { ArrowDown, ArrowUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { useDollar } from "@/lib/use-dollar";
import { formatCurrency } from "@/lib/utils";

/** Cotação do dólar em reais, com seta de alta/baixa do dia. O rato fica na borda superior direita. */
export function DollarCard() {
  const { bid, change, loading } = useDollar();
  const up = change > 0;
  const down = change < 0;

  return (
    <Card className="relative overflow-visible">
      {/* Mascote metade dentro, metade fora da borda (mesmo desenho do assistente) */}
      <span
        className="absolute -top-4 -right-3 z-10 block h-12 w-12 overflow-hidden rounded-full border-2 border-background bg-white shadow-md"
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bot/muvo-bot.webp" alt="" width={96} height={96} draggable={false}
          className="h-full w-full select-none object-cover" />
      </span>

      <CardHeader className="flex flex-row items-center justify-between pb-2 pr-12">
        <CardDescription>Dólar hoje</CardDescription>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold tabular-nums">
            {loading ? "…" : bid === null ? "—" : formatCurrency(bid)}
          </p>
          {bid !== null && up && (
            <ArrowUp className="h-6 w-6 text-emerald-500" aria-label="Subiu no dia" />
          )}
          {bid !== null && down && (
            <ArrowDown className="h-6 w-6 text-destructive" aria-label="Caiu no dia" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
