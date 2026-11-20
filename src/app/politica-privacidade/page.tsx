"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-5 py-10 md:py-16">
        <Link href="/comecar" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-8">
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-zinc-500 mb-10">Última atualização: 20 de novembro de 2026</p>

        <div className="space-y-8 text-sm text-zinc-300 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-white mb-2">1. Quais dados coletamos</h2>
            <p>
              Quando você preenche o formulário de contato no MUVO, coletamos: nome, número de WhatsApp,
              objetivo financeiro informado e faixa de aporte mensal informada. Ao criar uma conta (inclusive
              com o Google), guardamos seu nome, seu e-mail e o nome de usuário. Ao usar o app, também
              armazenamos os dados financeiros que você mesmo cadastra (transações, investimentos, metas),
              sempre vinculados à sua conta individual. Veja também a seção 8, sobre a origem do cadastro.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">2. Para que usamos esses dados</h2>
            <p>
              Usamos nome e WhatsApp exclusivamente para entrar em contato com você sobre o MUVO — liberar
              seu período de teste, tirar dúvidas e dar suporte. Objetivo e aporte nos ajudam a personalizar
              a proposta que te enviamos. Não usamos esses dados para nenhuma outra finalidade.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">3. Com quem compartilhamos</h2>
            <p>
              Não vendemos, alugamos ou compartilhamos seus dados com terceiros para fins de marketing.
              Os dados ficam armazenados em banco de dados próprio, hospedado em infraestrutura de nuvem
              (Vercel/Supabase), com acesso restrito.
            </p>
            <p className="mt-3">
              Usamos prestadores apenas para fazer o serviço funcionar: o Google, para entrar com a sua conta
              Google; um serviço de envio de e-mail, para avisos de segurança da conta (por exemplo, tentativas
              de login bloqueadas); e, se você ativar o assistente por mensagem, o WhatsApp ou o Telegram, por
              onde as mensagens passam. Eles recebem só o necessário para essa função e não usam seus
              dados para anunciar para você pelo MUVO.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">4. Seus direitos (LGPD)</h2>
            <p>
              Você pode solicitar a qualquer momento a correção, exportação ou exclusão dos seus dados
              pessoais, incluindo os dados enviados no formulário de contato. Basta enviar uma mensagem pelo
              WhatsApp para o número informado no site pedindo a alteração ou remoção — atendemos em até
              5 dias úteis.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">5. Segurança</h2>
            <p>
              Contas de usuário são protegidas por login individual com senha. Não integramos diretamente
              com corretoras ou instituições financeiras — os dados financeiros no app são inseridos
              manualmente por você e visíveis apenas na sua própria conta.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">6. Contato</h2>
            <p>
              Dúvidas sobre esta política ou sobre o tratamento dos seus dados podem ser enviadas pelo
              WhatsApp de suporte do MUVO.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">7. Entrar com o Google, teste grátis e exclusão</h2>
            <p>
              Você pode criar a conta com o Google. Recebemos do Google apenas o seu nome, o seu e-mail e um
              identificador da conta Google; não recebemos a sua senha do Google nem acesso a outros dados dela.
              Usamos esses dados só para criar e identificar a sua conta, nunca para publicidade e nunca os
              repassamos a terceiros. Contas novas têm 3 dias de teste grátis. Quem não assina até o fim do teste mantém os dados guardados
              por mais 10 dias e, depois disso, a conta e todos os dados são apagados automaticamente.
            </p>
            <p className="mt-3">
              Você pode excluir a conta e todos os dados a qualquer momento, no app (Mais → Configurações → Excluir
              minha conta) ou pelas instruções em{" "}
              <Link href="/excluir-conta" className="text-emerald-400 underline underline-offset-2">
                excluir conta
              </Link>
              . Registros mínimos exigidos por lei e cópias de segurança do provedor do banco de dados podem
              permanecer por um período limitado.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2">8. Origem do cadastro e cookies</h2>
            <p>
              Se você chegar ao MUVO por um link de divulgação (por exemplo, de um anúncio ou de uma publicação
              nas redes sociais), guardamos no seu navegador um cookie próprio chamado <code>muvo_atrib</code>,
              por até 30 dias, com apenas as etiquetas do link (origem, tipo de mídia, campanha e anúncio). Se
              você criar uma conta ou preencher o formulário de contato nesse período, essas etiquetas ficam
              registradas junto ao cadastro, para sabermos de onde vieram as pessoas e melhorarmos a divulgação.
              Elas não identificam você por si só e não são usadas para criar perfis.
            </p>
            <p className="mt-3">
              Você pode apagar esse cookie nas configurações do navegador a qualquer momento, e o MUVO continua
              funcionando normalmente. O MUVO não usa pixel de anúncios, Google Analytics nem outra ferramenta
              de análise de terceiros. Se você clicar em um anúncio do Instagram ou do Facebook, a Meta registra
              esse clique de acordo com a política dela, fora do nosso site. Se isso mudar, atualizaremos esta
              política antes.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
