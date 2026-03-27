import { useEffect, useRef, useState, useCallback } from 'react'
import type React from 'react'
import logoIcon from './assets/logo-icon-clean.png'
import logoText from './assets/logo-text-clean.png'

const DIAG_HREF = '#diagnostico'
const WHATSAPP = 'https://wa.me/5500000000000'

/* ── DATA ────────────────────────────────────────────────────── */

const heroWords = ['Sistemas', 'Aplicativos', 'Sites', 'Plataformas']

const marqueeItems = [
  '★ +240% engajamento para EdTech',
  '★ +340% conversão para E-commerce',
  '★ Sistema que pagou em 30 dias',
  '★ 8× mais velocidade operacional',
  '★ +R$450k/mês em receita extra',
  '★ 70% menos erros operacionais',
  '★ NPS de 98% dos clientes',
  '★ +45 projetos entregues',
]

const stats = [
  { raw: 45, suffix: '+', label: 'Projetos Entregues', detail: 'Sistemas, apps e sites' },
  { raw: 98, suffix: '%', label: 'NPS dos Clientes', detail: 'Satisfação comprovada' },
  { raw: 12, suffix: 'M+', label: 'Receita Gerada (R$)', detail: 'Para nossos clientes' },
]

const logos = [
  'TechVentures', 'LogiFlow', 'MedConnect', 'RH Tech',
  'Edu Plus', 'RetailX', 'FinServ', 'CloudOps',
]

const processSteps = [
  {
    num: '01',
    title: 'Diagnóstico Estratégico',
    text: 'Antes de tocar em código, mergulhamos no seu negócio. Mapeamos gargalos, metas, concorrência e maturidade digital para entender onde tecnologia gera mais retorno.',
    highlight: 'Gratuito e sem compromisso',
  },
  {
    num: '02',
    title: 'Arquitetura & Design',
    text: 'Desenhamos a solução ideal para o momento da empresa. Stack certa, UX que converte, arquitetura que escala — sem over-engineering, sem gambiarras.',
    highlight: 'Validação antes de construir',
  },
  {
    num: '03',
    title: 'Build & Entrega Ágil',
    text: 'Sprints curtos com entregas visíveis a cada semana. Você acompanha o progresso em tempo real e valida cada etapa antes de seguir.',
    highlight: 'Até 50% mais rápido',
  },
  {
    num: '04',
    title: 'Evolução Contínua',
    text: 'Entregamos v1 já preparada para crescer. Monitoramos, otimizamos e evoluímos junto com o seu negócio nos próximos ciclos.',
    highlight: 'Base técnica evolutiva',
  },
]

const cases = [
  {
    tag: 'EdTech',
    client: 'Plataforma de Cursos Online',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop',
    challenge: 'Onboarding confuso fazia 70% dos alunos abandonarem antes da primeira aula. A plataforma existia mas não retinha ninguém.',
    solution: 'Redesenhamos toda a jornada do usuário com progresso visual, gamificação inteligente e recomendações personalizadas por IA.',
    metrics: [
      { value: '+240%', label: 'Engajamento' },
      { value: '95%', label: 'Menos abandono' },
      { value: '60 dias', label: 'Para resultado' },
    ],
    quote: 'Em 60 dias a retenção subiu mais do que em 2 anos com outra agência. Não acreditei quando vi os números.',
    author: 'Ana Lima',
    role: 'CPO',
  },
  {
    tag: 'B2B SaaS',
    client: 'Agência de Marketing Digital',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
    challenge: 'Operava com 5 ferramentas diferentes. Relatórios manuais chegavam sempre atrasados. Time sobrecarregado e clientes insatisfeitos.',
    solution: 'Sistema centralizado com automação de relatórios, integração de dados e dashboard real-time para cada cliente.',
    metrics: [
      { value: '+4h', label: 'Por semana/pessoa' },
      { value: '70%', label: 'Menos erros' },
      { value: '3 sem', label: 'Para entrega' },
    ],
    quote: 'Nossos clientes perceberam a diferença antes de a gente comentar. O sistema se pagou no primeiro mês.',
    author: 'Carlos Melo',
    role: 'CEO',
  },
  {
    tag: 'E-commerce',
    client: 'Loja Premium de Moda',
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop',
    challenge: 'Design bonito mas checkout confuso. Conversão travada em 2% há meses. Tráfego pago sendo desperdiçado.',
    solution: 'Checkout redesenhado em 1 clique, recomendações inteligentes no carrinho e recuperação automática de carrinhos abandonados.',
    metrics: [
      { value: '+340%', label: 'Conversão' },
      { value: 'R$450k', label: 'Receita/mês extra' },
      { value: '21 dias', label: 'Para resultado' },
    ],
    quote: 'Não esperava que fosse tão rápido. Em 3 semanas os números já tinham mudado completamente.',
    author: 'Roberto Mendes',
    role: 'Dir. Comercial',
  },
]

const icpCards = [
  {
    icon: '⚡',
    title: 'Empresas em Escala',
    text: 'Cresceram rápido e a operação não acompanhou. Processos manuais, dados fragmentados, time sobrecarregado.',
    fit: 'Precisam de automação e integração',
  },
  {
    icon: '🛒',
    title: 'E-commerces',
    text: 'Tráfego pago rodando forte mas checkout ruim, experiência quebrada e conversão muito abaixo do potencial.',
    fit: 'Precisam de UX que converte',
  },
  {
    icon: '🧠',
    title: 'Startups & SaaS',
    text: 'Validaram o mercado mas precisam de produto técnico robusto, escalável e entregue com velocidade.',
    fit: 'Precisam de execução ágil',
  },
  {
    icon: '🏥',
    title: 'Setores Regulados',
    text: 'Saúde, financeiro, educação — onde qualidade técnica, segurança e compliance são inegociáveis.',
    fit: 'Precisam de qualidade enterprise',
  },
]

const testimonials = [
  {
    text: 'Não foi um site. Foi um sistema de vendas. O mês 1 já pagou o investimento inteiro.',
    author: 'Bruno Silva',
    role: 'CEO, Plataforma de Agendamentos',
    stars: 5,
  },
  {
    text: 'Meu sistema anterior desperdiçava dados válidos. Este aqui monetiza cada interação. ROI absurdo.',
    author: 'Paula Costa',
    role: 'Founder, SaaS de Logística',
    stars: 5,
  },
  {
    text: 'Em 6 anos nunca vi entrega tão limpa. Abriram o código, explicaram cada decisão. Transparência total.',
    author: 'Thiago Faria',
    role: 'CTO, Fintech Curitiba',
    stars: 5,
  },
  {
    text: 'Contratei achando que ia demorar 6 meses. Entregaram em 8 semanas com qualidade que eu nem sabia que existia.',
    author: 'Mariana Torres',
    role: 'COO, HealthTech SP',
    stars: 5,
  },
]

const navLinks = [
  { label: 'Como funciona', href: '#processo' },
  { label: 'Cases', href: '#cases' },
  { label: 'Depoimentos', href: '#depoimentos' },
  { label: 'Quem atendemos', href: '#quem-atendemos' },
]

/* ── COMPONENTS ──────────────────────────────────────────────── */

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const totalSteps = 70
          const inc = target / totalSteps
          let curr = 0
          const timer = setInterval(() => {
            curr += inc
            if (curr >= target) { curr = target; clearInterval(timer) }
            setCount(Math.floor(curr))
          }, 1800 / totalSteps)
        }
      },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [target])

  return <span ref={ref}>{count}{suffix}</span>
}

/* ── APP ─────────────────────────────────────────────────────── */

export default function App() {
  const [navOpen, setNavOpen] = useState(false)
  const [activeCase, setActiveCase] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })

  // scroll-triggered nav style
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // mouse glow on hero (RAF-throttled for smooth 60fps)
  const rafRef = useRef(0)
  const handleHeroMouse = useCallback((e: React.MouseEvent) => {
    cancelAnimationFrame(rafRef.current)
    const clientX = e.clientX, clientY = e.clientY
    rafRef.current = requestAnimationFrame(() => {
      const rect = heroRef.current?.getBoundingClientRect()
      if (!rect) return
      setMousePos({
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100,
      })
    })
  }, [])

  // reveal observer
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target) }
        }),
      { threshold: 0.06, rootMargin: '0px 0px -60px 0px' }
    )
    document.querySelectorAll('[data-reveal]').forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const close = () => setNavOpen(false)

  return (
    <div className="site">

      {/* ▸ NAV */}
      <header className={`nav${scrolled ? ' nav--solid' : ''}`}>
        <div className="nav__inner">
          <a href="#hero" className="nav__logo">
            <img src={logoIcon} alt="" className="nav__logo-icon" />
            <img src={logoText} alt="AplicaDev" className="nav__logo-text" />
          </a>
          <nav className="nav__links">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
          </nav>
          <a href={DIAG_HREF} className="btn btn--primary nav__cta">Diagnóstico gratuito</a>
          <button className="nav__hamburger" onClick={() => setNavOpen(v => !v)} aria-label="Menu" aria-expanded={navOpen}>
            <div className={`hamburger-icon${navOpen ? ' open' : ''}`}>
              <span /><span /><span />
            </div>
          </button>
        </div>
        {navOpen && (
          <div className="nav__mobile">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={close}>{l.label}</a>
            ))}
            <a href={DIAG_HREF} className="btn btn--primary btn--full" onClick={close}>
              Diagnóstico gratuito
            </a>
          </div>
        )}
      </header>

      {/* ▸ HERO */}
      <section
        className="hero"
        id="hero"
        ref={heroRef}
        onMouseMove={handleHeroMouse}
        style={{ '--mx': `${mousePos.x}%`, '--my': `${mousePos.y}%` } as React.CSSProperties}
      >
        <div className="hero__glow" aria-hidden />
        <div className="hero__grid-bg" aria-hidden />
        <div className="hero__noise" aria-hidden />

        <div className="hero__content" data-reveal>
          <div className="hero__badge">
            <span className="hero__badge-dot" />
            Vagas limitadas para Abril/2026
          </div>
          <h1 className="hero__title">
            Transformamos desafios em<br />
            <span className="hero__cycle">
              {heroWords.map((w) => <span key={w}>{w}</span>)}
            </span>
            <br />sob medida
          </h1>
          <p className="hero__subtitle">
            Com <strong>inteligência artificial estratégica</strong> e execução técnica de alto nível,
            entregamos com mais precisão, mais velocidade e menos desperdício.
            <em> Até 50% mais rápido que o mercado.</em>
          </p>
          <div className="hero__actions">
            <a href={DIAG_HREF} className="btn btn--primary btn--lg btn--glow">
              Falar com especialista
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </a>
            <a href="#cases" className="btn btn--ghost btn--lg">Ver resultados reais</a>
          </div>
          <div className="hero__trust">
            <div className="hero__trust-item"><span className="trust-check">✓</span> Diagnóstico gratuito</div>
            <div className="hero__trust-item"><span className="trust-check">✓</span> Sem compromisso</div>
            <div className="hero__trust-item"><span className="trust-check">✓</span> Retorno em 24h</div>
          </div>
        </div>

        <div className="hero__visual" data-reveal="right">
          <div className="hero__card hero__card--main">
            <div className="hc__status"><span className="hc__dot" />Em andamento</div>
            <div className="hc__title">Sistema de Gestão</div>
            <div className="hc__desc">Automação de processos operacionais</div>
            <div className="hc__progress-wrap">
              <div className="hc__bar"><div className="hc__fill" /></div>
              <div className="hc__meta"><span>Sprint 3/4</span><span className="hc__pct">74%</span></div>
            </div>
            <div className="hc__tags">
              <span>React</span><span>Node.js</span><span>IA</span>
            </div>
          </div>
          <div className="hero__minis">
            <div className="hero__card hero__card--mini">
              <div className="hc-mini__label">Operação</div>
              <div className="hc-mini__value">8×</div>
              <div className="hc-mini__sub">mais rápida</div>
            </div>
            <div className="hero__card hero__card--mini hero__card--accent">
              <div className="hc-mini__label">Conversão</div>
              <div className="hc-mini__value">+340%</div>
              <div className="hc-mini__sub">de aumento</div>
            </div>
          </div>
          <div className="hero__card hero__card--notification">
            <span className="notif-icon">🎯</span>
            <div>
              <strong>Novo projeto iniciado</strong>
              <span>App de delivery — Sprint 1</span>
            </div>
          </div>
        </div>
      </section>

      {/* ▸ MARQUEE */}
      <div className="marquee">
        <div className="marquee__track">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span className="marquee__item" key={i}>{item}</span>
          ))}
        </div>
      </div>

      {/* ▸ STATS */}
      <section className="stats">
        <div className="stats__inner">
          {stats.map((s, i) => (
            <div
              key={i}
              className="stats__item"
              data-reveal
              style={{ '--d': `${i * 120}ms` } as React.CSSProperties}
            >
              <div className="stats__number">
                <Counter target={s.raw} suffix={s.suffix} />
              </div>
              <div className="stats__label">{s.label}</div>
              <div className="stats__detail">{s.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ▸ QUEM SOMOS */}
      <section className="about" id="quem-somos-section">
        <div className="about__inner">
          <div className="about__content" data-reveal>
            <span className="tag">Quem somos</span>
            <h2 className="section-title">
              Desenvolvimento com inteligência de <em>negócio</em>, não só de código
            </h2>
            <p className="about__text">
              Somos uma software house especializada em soluções digitais de alto impacto.
              <strong> Não entregamos código — entregamos resultado mensurável.</strong>
            </p>
            <p className="about__text">
              Todo projeto começa com um diagnóstico estratégico profundo. Entendemos o negócio,
              os números e os gargalos antes de propor qualquer solução técnica.
            </p>
            <div className="about__highlight">
              <div className="about__highlight-icon">💡</div>
              <div>
                <strong>Por que somos diferentes?</strong>
                <p>Combinamos IA aplicada + senioridade técnica + visão de negócio. Não é só entregar — é entregar o que dá retorno.</p>
              </div>
            </div>
            <a href={DIAG_HREF} className="btn btn--primary">Agendar diagnóstico gratuito</a>
          </div>
          <div className="about__cards" data-reveal="right">
            <div className="about__card">
              <div className="acard__icon">🎯</div>
              <strong>Strategy First</strong>
              <p>Negócio primeiro, tecnologia depois. Cada decisão técnica tem justificativa de negócio.</p>
            </div>
            <div className="about__card about__card--accent">
              <div className="acard__icon">🤖</div>
              <strong>IA Estratégica</strong>
              <p>Aplicamos inteligência artificial onde ela gera retorno real — não como buzzword.</p>
            </div>
            <div className="about__card">
              <div className="acard__icon">🔄</div>
              <strong>Base Evolutiva</strong>
              <p>v1 pronta pra escalar. Sem reescritas caras 6 meses depois.</p>
            </div>
            <div className="about__card">
              <div className="acard__icon">👥</div>
              <strong>Time Integrado</strong>
              <p>Design, tech, copy e estratégia na mesma mesa. Entrega coerente e rápida.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ▸ LOGOS */}
      <section className="logos">
        <p className="logos__label" data-reveal>Empresas que já confiaram no nosso trabalho</p>
        <div className="logos__track-wrap">
          <div className="logos__track">
            {[...logos, ...logos].map((name, i) => (
              <div className="logos__chip" key={`${name}-${i}`}>
                <div className="logos__avatar">{name.slice(0, 2)}</div>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ▸ PROCESSO */}
      <section className="process" id="processo">
        <div className="process__head" data-reveal>
          <span className="tag">Nosso processo</span>
          <h2 className="section-title">
            Como solucionamos seu problema<br /><em>em até 50% mais rápido</em>
          </h2>
          <p className="section-sub">
            Quatro etapas que eliminam retrabalho, alinham expectativas e entregam resultado real — semana a semana.
          </p>
        </div>
        <div className="process__grid">
          {processSteps.map((s, i) => (
            <div
              className="process__card"
              key={s.num}
              data-reveal
              style={{ '--d': `${i * 100}ms` } as React.CSSProperties}
            >
              <div className="pcard__num">{s.num}</div>
              <h3 className="pcard__title">{s.title}</h3>
              <p className="pcard__text">{s.text}</p>
              <div className="pcard__highlight">{s.highlight}</div>
              {i < processSteps.length - 1 && <div className="pcard__connector" aria-hidden />}
            </div>
          ))}
        </div>
        <div className="process__cta" data-reveal>
          <a href={DIAG_HREF} className="btn btn--primary btn--lg btn--glow">
            Começar pelo diagnóstico gratuito
          </a>
        </div>
      </section>

      {/* ▸ CASES */}
      <section className="cases" id="cases">
        <div className="cases__head" data-reveal>
          <span className="tag">Cases de sucesso</span>
          <h2 className="section-title">
            Resultados reais de empresas reais
          </h2>
          <p className="section-sub">
            Veja como transformamos desafios complexos em resultados mensuráveis.
          </p>
        </div>

        <div className="cases__tabs" data-reveal>
          {cases.map((c, i) => (
            <button
              key={i}
              className={`cases__tab${activeCase === i ? ' active' : ''}`}
              onClick={() => setActiveCase(i)}
            >
              <span className="cases__tab-tag">{c.tag}</span>
              {c.client}
            </button>
          ))}
        </div>

        {cases.map((c, i) => (
          <div key={i} className={`cases__body${activeCase === i ? ' visible' : ''}`}>
            <div className="cases__visual">
              <img src={c.image} alt={c.client} loading="lazy" />
              <div className="cases__metrics">
                {c.metrics.map((m, mi) => (
                  <div className="cases__metric" key={mi}>
                    <strong>{m.value}</strong>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="cases__info">
              <span className="cases__info-tag">{c.tag}</span>
              <h3>{c.client}</h3>
              <div className="cases__block">
                <div className="cases__block-label">O DESAFIO</div>
                <p>{c.challenge}</p>
              </div>
              <div className="cases__block">
                <div className="cases__block-label">A SOLUÇÃO</div>
                <p>{c.solution}</p>
              </div>
              <blockquote className="cases__quote">
                <p>"{c.quote}"</p>
                <footer>
                  <strong>{c.author}</strong>
                  <span>{c.role}</span>
                </footer>
              </blockquote>
              <a href={DIAG_HREF} className="btn btn--primary">Quero resultado assim →</a>
            </div>
          </div>
        ))}
      </section>

      {/* ▸ DEPOIMENTOS */}
      <section className="testimonials" id="depoimentos">
        <div className="testimonials__head" data-reveal>
          <span className="tag">Depoimentos</span>
          <h2 className="section-title">O que nossos clientes dizem</h2>
        </div>
        <div className="testimonials__grid">
          {testimonials.map((t, i) => (
            <div
              className="tcard"
              key={i}
              data-reveal
              style={{ '--d': `${i * 100}ms` } as React.CSSProperties}
            >
              <div className="tcard__stars">{'★'.repeat(t.stars)}</div>
              <p className="tcard__text">"{t.text}"</p>
              <div className="tcard__author">
                <div className="tcard__avatar">{t.author[0]}</div>
                <div>
                  <strong>{t.author}</strong>
                  <span>{t.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ▸ QUEM ATENDEMOS */}
      <section className="icp" id="quem-atendemos">
        <div className="icp__head" data-reveal>
          <span className="tag">Quem atendemos</span>
          <h2 className="section-title">
            Empresas que sabem o valor de uma execução<br /><em>bem feita, ágil, precisa e sem desperdício</em>
          </h2>
        </div>
        <div className="icp__grid">
          {icpCards.map((c, i) => (
            <div
              className="icp__card"
              key={i}
              data-reveal
              style={{ '--d': `${i * 100}ms` } as React.CSSProperties}
            >
              <div className="icp__icon">{c.icon}</div>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
              <div className="icp__fit">{c.fit}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ▸ CTA STRIP */}
      <section className="cta-strip" data-reveal>
        <div className="cta-strip__inner">
          <div className="cta-strip__badge">🔥 Vagas limitadas para Abril/2026</div>
          <h2 className="cta-strip__title">Vamos tirar o excesso do caminho?</h2>
          <p className="cta-strip__text">
            Receba um diagnóstico técnico e estratégico gratuito sobre o seu projeto.<br />
            <strong>Sem compromisso. Sem enrolação. Só o que importa.</strong>
          </p>
          <a href={DIAG_HREF} className="btn btn--primary btn--lg btn--glow">
            Agendar diagnóstico gratuito
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
      </section>

      {/* ▸ FORM */}
      <section className="form-section" id="diagnostico">
        <div className="form-section__inner">
          <div className="form-section__copy" data-reveal>
            <span className="tag">Diagnóstico gratuito</span>
            <h2 className="section-title">
              Receba um diagnóstico<br />do seu negócio
            </h2>
            <p className="form-section__sub">
              Clique no botão e agende com um dos nossos especialistas.<br />
              <strong>Retorno em até 1 dia útil.</strong>
            </p>
            <ul className="form-section__proof">
              <li><span>✓</span> Análise do seu momento digital</li>
              <li><span>✓</span> Identificação dos principais gargalos</li>
              <li><span>✓</span> Direcionamento da melhor solução</li>
              <li><span>✓</span> Diagnóstico antes de qualquer orçamento</li>
            </ul>
            <div className="form-section__guarantee">
              <div className="guarantee-icon">🛡️</div>
              <div>
                <strong>100% sem compromisso</strong>
                <p>Mesmo que decida não seguir, você sai com clareza sobre o próximo passo do seu negócio digital.</p>
              </div>
            </div>
          </div>
          <div className="form-card form-card--cta" data-reveal="right">
            <div className="form-card__head">
              <h3>Agende seu diagnóstico</h3>
              <span className="form-card__badge">GRATUITO</span>
            </div>
            <p className="form-card__intro">Converse com um dos nossos especialistas e receba um plano personalizado para o seu negócio.</p>
            <div className="form-card__perks">
              <div className="form-card__perk"><span>⏱️</span> Duração: ~30 minutos</div>
              <div className="form-card__perk"><span>💬</span> Via Google Meet ou WhatsApp</div>
              <div className="form-card__perk"><span>📋</span> Plano de ação personalizado</div>
              <div className="form-card__perk"><span>🔒</span> 100% gratuito e sem compromisso</div>
            </div>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--full btn--lg btn--glow">
              Agendar pelo WhatsApp
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
            <p className="form-card__disclaimer">⚡ Retorno em até 1 dia útil · Sem spam</p>
          </div>
        </div>
      </section>

      {/* ▸ FOOTER */}
      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__brand">
            <div className="footer__logo">
              <img src={logoIcon} alt="" className="footer__logo-icon" />
              <img src={logoText} alt="AplicaDev" className="footer__logo-text" />
            </div>
            <p>Sistemas, apps e sites com diagnóstico estratégico incluído em todo projeto.</p>
            <div className="footer__social">
              <a href="#" aria-label="Instagram">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a href="#" aria-label="LinkedIn">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              <a href={WHATSAPP} aria-label="WhatsApp">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            </div>
          </div>
          <div className="footer__col">
            <strong>Navegação</strong>
            {navLinks.map((l) => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
          </div>
          <div className="footer__col">
            <strong>Serviços</strong>
            <a href="#processo">Sistemas sob medida</a>
            <a href="#processo">Aplicativos mobile/web</a>
            <a href="#processo">Sites de alta conversão</a>
            <a href="#processo">Consultoria técnica</a>
          </div>
          <div className="footer__col">
            <strong>Contato</strong>
            <a href="mailto:contato@aplicadev.com.br">contato@aplicadev.com.br</a>
            <a href={DIAG_HREF} className="footer__cta">Agendar diagnóstico →</a>
          </div>
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} AplicaDev. Todos os direitos reservados.</span>
          <a href="#hero">Voltar ao topo ↑</a>
        </div>
      </footer>

    </div>
  )
}
