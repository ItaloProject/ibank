"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function TermosDeUsoPage() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-5 py-10 md:py-16">
        <Link href="/comecar" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-8">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-sm text-zinc-500 mb-10">Última atualização: setembro de 2026</p>

        <div className="space-y-8 text-sm text-zinc-300 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-white mb-2">1. O que é o MUVO</h2>
            <p>
              O MUVO é uma ferramenta de organização financeira pessoal. Ele permite que você registre
              manualmente suas transações, investimentos e metas para acompanhar sua situação financeira
              em um só lugar. O MUVO não é uma instituição financeira, não realiza operações bancárias ou
              de investimento em seu nome e não tem acesso direto a contas, cartões ou corretoras — todos os
              dados são inseridos por você.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">2. Não somos consultoria de investimentos</h2>
            <p>
              O MUVO não é uma consultoria de valores mobiliários registrada na CVM nem uma corretora.
              Qualquer simulação, sugestão de carteira ou projeção exibida no app tem caráter exclusivamente
              informativo e educacional, não constitui recomendação de investimento, e não deve ser
              interpretada como tal. Decisões financeiras e de investimento são de sua inteira
              responsabilidade.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">3. Cadastro e acesso</h2>
            <p>
              O acesso ao MUVO é individual e ativado manualmente pela equipe após contato via WhatsApp.
              Você é responsável por manter sua senha em sigilo e por toda atividade realizada na sua conta.
              Contas podem ser desativadas em caso de uso indevido, inadimplência ou a pedido do próprio
              usuário.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">4. Pagamento e cancelamento</h2>
            <p>
              O acesso ao MUVO é pago conforme o plano combinado no momento da contratação, via Pix ou outro
              meio informado pela equipe. A ativação e renovação do acesso são feitas manualmente. Você pode
              cancelar a qualquer momento entrando em contato pelo WhatsApp de suporte; o cancelamento
              interrompe a renovação, mas não gera reembolso automático de período já pago, salvo acordo em
              contrário.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">5. Seus dados</h2>
            <p>
              Os dados financeiros que você cadastra pertencem a você. Eles ficam visíveis apenas na sua
              própria conta e não são compartilhados com outros usuários nem vendidos a terceiros. Mais
              detalhes sobre coleta e uso de dados estão na{" "}
              <Link href="/politica-privacidade" className="underline hover:text-zinc-200">
                Política de Privacidade
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">6. Disponibilidade do serviço</h2>
            <p>
              Fazemos o possível para manter o MUVO disponível e funcionando corretamente, mas não
              garantimos operação ininterrupta ou livre de falhas. Eventuais indisponibilidades,
              manutenções ou instabilidades podem ocorrer sem aviso prévio.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">7. Uso aceitável</h2>
            <p>
              O MUVO deve ser usado apenas para fins pessoais e lícitos. Não é permitido tentar acessar
              contas de outros usuários, burlar mecanismos de segurança ou usar o serviço de forma que
              prejudique seu funcionamento.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">8. Limitação de responsabilidade</h2>
            <p>
              O MUVO é uma ferramenta de apoio à organização financeira. Erros de digitação, lançamentos
              incorretos ou decisões tomadas com base nas informações do app são de responsabilidade do
              usuário. Não nos responsabilizamos por perdas financeiras decorrentes de decisões de
              investimento tomadas com base em informações ou simulações exibidas no app.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">9. Alterações nestes termos</h2>
            <p>
              Estes termos podem ser atualizados periodicamente. Alterações relevantes serão comunicadas
              pelo WhatsApp de suporte ou diretamente no app.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">10. Contato</h2>
            <p>
              Dúvidas sobre estes Termos de Uso podem ser enviadas pelo WhatsApp de suporte do MUVO.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
