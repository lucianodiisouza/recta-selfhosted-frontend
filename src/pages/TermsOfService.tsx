import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsOfService = () => {

  return (
    <div className="min-h-screen bg-surface-elevated">
      {/* Navigation */}
      <nav className="bg-surface-elevated border-b border-line-subtle sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link
              to="/"
              className="flex items-center text-content-secondary hover:text-content transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Voltar
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold text-content mb-8">
            Termos de Uso
          </h1>

          <p className="text-content-secondary mb-6">
            <strong>Última atualização:</strong> 26 de janeiro de 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-content mb-4">
              1. Aceitação dos Termos
            </h2>
            <p className="text-content-secondary leading-relaxed">
              Ao acessar e usar o Recta, você concorda em cumprir e estar vinculado aos seguintes termos e condições de uso. 
              Se você não concordar com alguma parte destes termos, não deve usar nosso serviço.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-content mb-4">
              2. Descrição do Serviço
            </h2>
            <p className="text-content-secondary leading-relaxed mb-4">
              O Recta é uma plataforma de gerenciamento financeiro pessoal que permite aos usuários:
            </p>
            <ul className="list-disc list-inside text-content-secondary space-y-2 ml-4">
              <li>Registrar e acompanhar transações financeiras</li>
              <li>Gerenciar contas bancárias e cartões de crédito</li>
              <li>Criar e monitorar orçamentos</li>
              <li>Definir metas de economia</li>
              <li>Visualizar relatórios e análises financeiras</li>
              <li>Colaborar com outros usuários em households compartilhados</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-content mb-4">
              3. Conta de Usuário
            </h2>
            <p className="text-content-secondary leading-relaxed mb-4">
              Para usar o Recta, você precisa criar uma conta. Você é responsável por:
            </p>
            <ul className="list-disc list-inside text-content-secondary space-y-2 ml-4">
              <li>Manter a confidencialidade de suas credenciais de acesso</li>
              <li>Notificar-nos imediatamente sobre qualquer uso não autorizado de sua conta</li>
              <li>Fornecer informações precisas e atualizadas</li>
              <li>Ser responsável por todas as atividades que ocorrem em sua conta</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-content mb-4">
              4. Uso Aceitável
            </h2>
            <p className="text-content-secondary leading-relaxed mb-4">
              Você concorda em não usar o Recta para:
            </p>
            <ul className="list-disc list-inside text-content-secondary space-y-2 ml-4">
              <li>Qualquer propósito ilegal ou não autorizado</li>
              <li>Violar qualquer lei ou regulamento aplicável</li>
              <li>Transmitir vírus, malware ou código malicioso</li>
              <li>Tentar obter acesso não autorizado ao serviço ou sistemas relacionados</li>
              <li>Interferir ou interromper a operação do serviço</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-content mb-4">
              5. Propriedade Intelectual
            </h2>
            <p className="text-content-secondary leading-relaxed">
              Todo o conteúdo do Recta, incluindo design, logotipos, textos, gráficos e software, é propriedade do Recta 
              ou de seus licenciadores e está protegido por leis de direitos autorais e outras leis de propriedade intelectual.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-content mb-4">
              6. Privacidade
            </h2>
            <p className="text-content-secondary leading-relaxed">
              Seu uso do Recta também é regido por nossa Política de Privacidade. 
              Por favor, revise nossa Política de Privacidade para entender nossas práticas de coleta e uso de dados.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-content mb-4">
              7. Limitação de Responsabilidade
            </h2>
            <p className="text-content-secondary leading-relaxed mb-4">
              O Recta é fornecido "como está" e "conforme disponível". Não garantimos que:
            </p>
            <ul className="list-disc list-inside text-content-secondary space-y-2 ml-4">
              <li>O serviço será ininterrupto, seguro ou livre de erros</li>
              <li>Os resultados obtidos do uso do serviço serão precisos ou confiáveis</li>
              <li>Qualquer defeito ou erro será corrigido</li>
            </ul>
            <p className="text-content-secondary leading-relaxed mt-4">
              Em nenhuma circunstância seremos responsáveis por quaisquer danos diretos, indiretos, incidentais ou consequenciais 
              resultantes do uso ou incapacidade de usar o serviço.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-content mb-4">
              8. Modificações do Serviço
            </h2>
            <p className="text-content-secondary leading-relaxed">
              Reservamo-nos o direito de modificar, suspender ou descontinuar qualquer aspecto do serviço a qualquer momento, 
              com ou sem aviso prévio. Não seremos responsáveis perante você ou terceiros por qualquer modificação, suspensão 
              ou descontinuação do serviço.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-content mb-4">
              9. Alterações nos Termos
            </h2>
            <p className="text-content-secondary leading-relaxed">
              Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entrarão em vigor imediatamente 
              após a publicação. Seu uso continuado do serviço após tais modificações constitui sua aceitação dos termos revisados.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-content mb-4">
              10. Rescisão
            </h2>
            <p className="text-content-secondary leading-relaxed">
              Podemos encerrar ou suspender sua conta e acesso ao serviço imediatamente, sem aviso prévio, por qualquer motivo, 
              incluindo se você violar estes Termos de Uso. Após a rescisão, seu direito de usar o serviço cessará imediatamente.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-content mb-4">
              11. Lei Aplicável
            </h2>
            <p className="text-content-secondary leading-relaxed">
              Estes Termos de Uso serão regidos e interpretados de acordo com as leis do Brasil, sem dar efeito a quaisquer 
              princípios de conflitos de leis.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-content mb-4">
              12. Contato
            </h2>
            <p className="text-content-secondary leading-relaxed">
              Se você tiver alguma dúvida sobre estes Termos de Uso, entre em contato conosco através dos canais de suporte 
              disponíveis na plataforma.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-sunken border-t border-line py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-content-secondary">
          <p>© {new Date().getFullYear()} Recta. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfService;
