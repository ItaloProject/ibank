"use client";

import { Suspense } from "react";
import { InvestimentosApp } from "@/components/investimentos/investimentos-app";
import { SplashScreen } from "@/components/splash-screen";

export default function InvestimentosPage() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <InvestimentosApp section="hub" />
    </Suspense>
  );
}
