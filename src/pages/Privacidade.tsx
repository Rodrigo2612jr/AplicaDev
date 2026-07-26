import { Link } from 'react-router-dom'

/**
 * Política de Privacidade.
 *
 * Existe por dois motivos: a Meta exige URL de política de privacidade pra
 * publicar o app da Marketing API, e o site coleta nome/empresa/WhatsApp —
 * o que a LGPD trata como dado pessoal.
 *
 * O texto descreve exatamente o que o código faz hoje: formulário do
 * /diagnostico -> Supabase, notificação -> Kanban, e o pixel da Meta.
 * Se o fluxo mudar, este texto precisa mudar junto.
 */
export default function Privacidade() {
  const atualizado = '26 de julho de 2026'

  return (
    <div className="legal">
      <div className="legal__wrap">
        <Link to="/" className="legal__back">← Voltar ao site</Link>

        <h1 className="legal__title">Política de Privacidade</h1>
        <p className="legal__meta">Última atualização: {atualizado}</p>

        <p className="legal__intro">
          Esta política explica quais dados a AplicaDev coleta, por que coleta, com quem
          compartilha e o que você pode exigir a respeito deles. Escrevemos em português
          direto, sem juridiquês desnecessário.
        </p>

        <h2>1. Quem somos</h2>
        <p>
          AplicaDev: desenvolvimento de sites, aplicativos e sistemas sob medida.
          Contato para qualquer assunto de privacidade:{' '}
          <a href="mailto:support.aplicadev@gmail.com">support.aplicadev@gmail.com</a>.
        </p>

        <h2>2. Quais dados coletamos</h2>
        <p><strong>a) Dados que você nos entrega.</strong> No formulário de diagnóstico:</p>
        <ul>
          <li>nome;</li>
          <li>nome da empresa;</li>
          <li>número de WhatsApp;</li>
          <li>
            respostas sobre seu negócio (segmento, faturamento aproximado, o que você já
            tem hoje, prazo e orçamento pretendidos).
          </li>
        </ul>

        <p><strong>b) Dados coletados automaticamente.</strong> Quando você navega:</p>
        <ul>
          <li>
            origem da visita (de qual anúncio, campanha, conjunto e criativo você veio,
            os chamados parâmetros UTM);
          </li>
          <li>
            identificadores de anúncio da Meta (<code>fbclid</code>, cookies{' '}
            <code>_fbc</code> e <code>_fbp</code>), usados para medir quais anúncios geram
            contato;
          </li>
          <li>página de origem (referrer) e endereço da página de entrada.</li>
        </ul>

        <p>
          <strong>Não coletamos</strong> CPF, RG, dados bancários, cartão de crédito nem
          dados sensíveis (saúde, biometria, religião, opinião política, orientação sexual).
          Não pedimos senha em nenhum momento.
        </p>

        <h2>3. Por que coletamos</h2>
        <ul>
          <li>
            <strong>Para responder você.</strong> O WhatsApp e o nome existem para que a
            gente entre em contato sobre o orçamento que você pediu.
          </li>
          <li>
            <strong>Para montar a proposta.</strong> As respostas do diagnóstico servem
            para dimensionar escopo, prazo e preço sem precisar de reunião prévia.
          </li>
          <li>
            <strong>Para medir anúncios.</strong> Os dados de origem nos dizem qual anúncio
            trouxe qual contato, para não gastar verba no que não funciona.
          </li>
        </ul>
        <p>
          Base legal (LGPD, art. 7º): execução de procedimentos preliminares a contrato, a
          seu pedido (inciso V), e legítimo interesse para medição de publicidade (inciso IX).
        </p>

        <h2>4. Com quem compartilhamos</h2>
        <p>Só com quem é necessário para o serviço funcionar:</p>
        <ul>
          <li><strong>Supabase</strong>: banco de dados onde os envios ficam armazenados;</li>
          <li><strong>Vercel</strong>: hospedagem do site;</li>
          <li>
            <strong>Meta (Facebook/Instagram)</strong>: recebe eventos de conversão para
            medir e otimizar anúncios. Quando enviamos dados de contato para essa
            finalidade, eles vão <em>criptografados por hash</em>, não em texto legível;
          </li>
          <li>
            <strong>Ferramenta interna de atendimento</strong>: para que sua solicitação
            chegue a quem vai responder.
          </li>
        </ul>
        <p>
          <strong>Não vendemos seus dados.</strong> Não cedemos sua lista de contato para
          terceiros nem enviamos spam de parceiros.
        </p>

        <h2>5. Cookies e pixel</h2>
        <p>
          Usamos o Pixel da Meta para saber se um anúncio gerou contato. Ele grava cookies
          no seu navegador. Você pode bloquear cookies nas configurações do navegador ou
          usar navegação anônima. O site continua funcionando, só perdemos a medição.
        </p>
        <p>
          Para ajustar o que a Meta usa para te mostrar anúncios:{' '}
          <a href="https://www.facebook.com/adpreferences" target="_blank" rel="noopener noreferrer">
            facebook.com/adpreferences
          </a>.
        </p>

        <h2>6. Por quanto tempo guardamos</h2>
        <ul>
          <li>
            <strong>Contatos que viraram cliente:</strong> pelo tempo da relação comercial
            e mais 5 anos, prazo prescricional do Código Civil.
          </li>
          <li>
            <strong>Contatos que não viraram negócio:</strong> até 24 meses, depois são
            apagados ou anonimizados.
          </li>
          <li>
            <strong>A qualquer momento:</strong> se você pedir exclusão, apagamos antes
            desses prazos, salvo o que a lei nos obrigue a manter.
          </li>
        </ul>

        <h2>7. Seus direitos</h2>
        <p>Pela LGPD (art. 18), você pode exigir a qualquer momento:</p>
        <ul>
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dado incompleto ou errado;</li>
          <li>anonimização, bloqueio ou <strong>eliminação</strong>;</li>
          <li>portabilidade a outro fornecedor;</li>
          <li>informação sobre com quem compartilhamos;</li>
          <li>revogação do consentimento.</li>
        </ul>
        <p>
          Escreva para{' '}
          <a href="mailto:support.aplicadev@gmail.com">support.aplicadev@gmail.com</a> com o
          número de WhatsApp usado no formulário. Respondemos em até 15 dias. Não cobramos
          por isso.
        </p>

        <h2>8. Segurança</h2>
        <p>
          O site trafega em HTTPS, o banco exige autenticação e o acesso administrativo é
          restrito. Ainda assim, nenhum sistema é 100% invulnerável. Se acontecer um
          incidente que possa te afetar, avisaremos você e a ANPD, como a lei determina.
        </p>

        <h2>9. Menores de idade</h2>
        <p>
          O serviço é dirigido a empresas e profissionais. Não coletamos intencionalmente
          dados de menores de 18 anos.
        </p>

        <h2>10. Mudanças nesta política</h2>
        <p>
          Se mudarmos algo relevante, atualizamos a data no topo. Mudanças que ampliem o
          uso dos seus dados serão comunicadas antes de valer.
        </p>

        <div className="legal__box">
          <strong>Resumo honesto:</strong> pedimos seu contato para responder seu orçamento,
          guardamos suas respostas para montar a proposta e medimos de qual anúncio você
          veio. Não vendemos nada disso. Pediu pra apagar, apagamos.
        </div>

        <Link to="/" className="legal__back">← Voltar ao site</Link>
      </div>
    </div>
  )
}
