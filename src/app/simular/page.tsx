"use client";

import { PageHeader, PageShell, PageBody } from "@/components/mobile";
import { IncomeSimulator } from "@/components/simular/income-simulator";

export default function SimularPage() {
  return (
    <PageShell>
      <PageHeader
        title="Simular"
        description="Veja quanto seu dinheiro vira com o tempo, ou quanto aportar para viver de renda"
      />
      <PageBody width="wide">
        <IncomeSimulator />
      </PageBody>
    </PageShell>
  );
}
