"use client";

import { Suspense } from "react";
import { InvestimentosApp } from "@/components/investimentos/investimentos-app";
import { Loader2 } from "lucide-react";

function Fallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function InvestimentosAcoesPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <InvestimentosApp section="acoes" />
    </Suspense>
  );
}
