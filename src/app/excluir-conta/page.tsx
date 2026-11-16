import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Excluir conta",
  description: "Como excluir sua conta e os seus dados no MUVO.",
};

function whatsappUrl() {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP ?? "";
  const phone = raw.replace(/\D/g, "");
  if (!phone) return null;
  const texto = encodeURIComponent("Olá! Quero excluir minha conta do MUVO e os meus dados.");
  return `https://wa.me/${phone}?text=${texto}`;
}

/** Página pública exigida pela Google Play: explica como pedir a exclusão da conta sem precisar abrir o app. */
export default function ExcluirContaPage() {
  const whatsapp = whatsappUrl();
  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-5 py-10 md:py-16">
        <Link href="/politica-privacidade" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-8">
          <ChevronLeft className="h-4 w-4" /> Política de Privacidade
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold mb-2">Excluir conta do MUVO</h1>
        <p className="text-sm text-zinc-500 mb-10">Aplicativo MUVO — Gestão Financeira Inteligente</p>

        <div className="space-y-8 text-sm text-zinc-300 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-white mb-2">Pelo aplicativo</h2>
            <p>
              Abra o MUVO, entre na sua conta, vá em <strong>Mais → Configurações → Excluir minha conta</strong> e
              confirme. A exclusão é imediata.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Sem acesso ao aplicativo</h2>
            <p>
              Se você não consegue entrar ou já desinstalou o app, peça a exclusão por aqui. Informe o e-mail da conta
              (o mesmo do Google, se você entrou com o Google) e responderemos em até 7 dias.
            </p>
            {whatsapp ? (
              <p className="mt-3">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline underline-offset-2">
                  Pedir a exclusão pelo WhatsApp
                </a>
              </p>
            ) : null}
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">Contas de teste sem assinatura</h2>
            <p>
              Quem faz o teste grátis e não assina tem os dados guardados por 10 dias depois do fim do teste. Depois disso, a
              conta e todos os dados são apagados automaticamente, sem precisar pedir.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">O que é apagado</h2>
            <p>
              Ao excluir a conta, apagamos o seu cadastro (nome, e-mail, ligação com o Google) e todos os dados que você
              registrou: planejamento, investimentos, operações, metas, proventos, parcelamentos, histórico e
              preferências de notificação.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">O que pode ficar</h2>
            <p>
              Registros mínimos de segurança e de obrigações legais podem ser mantidos pelo prazo que a lei exigir, sem
              ligação com o seu conteúdo financeiro. Cópias de segurança do provedor do banco de dados podem manter os dados por um período limitado até serem sobrescritas.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
