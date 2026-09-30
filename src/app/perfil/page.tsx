"use client";

import { useRouter } from "next/navigation";
import { RiskQuiz } from "@/components/onboarding/risk-quiz";
import { useUser } from "@/context/user-context";

/** Refazer o questionário de perfil de investidor. */
export default function PerfilPage() {
  const router = useRouter();
  const { user, finishRiskQuiz } = useUser();
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
      <RiskQuiz
        mode="retake"
        name={user?.name}
        onDone={(r) => {
          finishRiskQuiz(r?.objetivo);
          router.push("/configuracoes");
        }}
      />
    </div>
  );
}
