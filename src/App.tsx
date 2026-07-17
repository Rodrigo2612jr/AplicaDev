import { useEffect, useRef, useState, useCallback } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import './styles.css'
import logoIcon from './assets/logo-icon-clean.png'
import heroBg from './assets/hero-bg.png'
import Diagnostico from './pages/Diagnostico'
import Admin from './pages/Admin'
import Login from './pages/Login'

/* ══════════════════════════════════════════════════════════════════
   HOOKS
   ══════════════════════════════════════════════════════════════════ */

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('revealed')
          obs.unobserve(e.target)
        }
      }),
      { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

function useCounter(target: number, duration = 1800) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const start = Date.now()
        const tick = () => {
          const p = Math.min((Date.now() - start) / duration, 1)
          const ease = 1 - Math.pow(1 - p, 3)
          setCount(Math.floor(ease * target))
          if (p < 1) requestAnimationFrame(tick)
          else setCount(target)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [target, duration])

  return { count, ref }
}

/* ══════════════════════════════════════════════════════════════════
   PARTICLE CANVAS
   ══════════════════════════════════════════════════════════════════ */

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let W = canvas.offsetWidth
    let H = canvas.offsetHeight

    const resize = () => {
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width = W
      canvas.height = H
    }
    resize()
    window.addEventListener('resize', resize)

    const N = Math.min(Math.floor((W * H) / 12000), 80)
    type Particle = { x: number; y: number; vx: number; vy: number; r: number; opacity: number }

    const particles: Particle[] = Array.from({ length: N }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - .5) * .4,
      vy: (Math.random() - .5) * .4,
      r: Math.random() * 1.5 + .5,
      opacity: Math.random() * .5 + .2,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = W
        if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H
        if (p.y > H) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(26,183,171,${p.opacity * 0.5})`
        ctx.fill()
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(26,183,171,${(1 - dist / 120) * .08})`
            ctx.lineWidth = .5
            ctx.stroke()
          }
        }
      }

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="hero__canvas" />
}

/* ══════════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════════ */

const HERO_WORDS = ['Site', 'Aplicativo', 'Sistema', 'Produto Digital']

const MARQUEE_ITEMS = [
  '⚡ Entrega garantida em até 10 dias',
  '★ +240% de engajamento para EdTech',
  '★ +340% de conversão para E-commerce',
  '★ Sistema que se pagou em 30 dias',
  '★ 8× mais velocidade operacional',
  '★ +R$450k por mês em receita extra',
  '★ 70% menos erros nos processos',
  '★ 98% de satisfação dos clientes',
  '★ 150+ projetos entregues no prazo',
  '⚡ A partir de R$999,90',
]

const SERVICES = [
  {
    icon: '🌐',
    color: '',
    title: 'Site de Alta Conversão',
    sub: 'Landing pages, portais e e-commerces que vendem de verdade',
    items: [
      'Design premium que transmite autoridade',
      'SEO técnico para ranquear no Google',
      'Copy persuasiva voltada para conversão',
      'Analytics, pixel e integrações inclusos',
    ],
    time: 'A partir de 7 dias',
    highlight: false,
  },
  {
    icon: '📱',
    color: '',
    title: 'Aplicativo Mobile ou Web',
    sub: 'iOS, Android, PWA e produtos SaaS do zero até o deploy',
    items: [
      'UX nativo que o usuário não abandona',
      'Backend robusto e escalável em cloud',
      'Integrações com APIs e serviços externos',
      'Publicação nas lojas App Store e Google Play',
    ],
    time: 'A partir de 10 dias',
    highlight: true,
    badge: 'Mais Popular',
  },
  {
    icon: '⚙️',
    color: '',
    title: 'Sistema sob Medida',
    sub: 'ERPs, CRMs, automações e painéis de gestão internos',
    items: [
      'Mapeamento completo dos gargalos do processo',
      'Painéis e relatórios em tempo real',
      'Integração com sistemas que você já usa',
      'IA embarcada onde faz sentido de negócio',
    ],
    time: 'A partir de 10 dias',
    highlight: false,
  },
]

const STEPS = [
  {
    num: '01',
    icon: '💬',
    title: 'Diagnóstico Gratuito',
    desc: 'Entendemos seu negócio, seus gargalos e o que precisa ser criado para resolver de verdade.',
  },
  {
    num: '02',
    icon: '📐',
    title: 'Proposta e Escopo',
    desc: 'Definimos escopo, prazo e investimento. Sem surpresas, tudo documentado antes de começar.',
  },
  {
    num: '03',
    icon: '🚀',
    title: 'Desenvolvimento Ágil',
    desc: 'Sprints curtos com atualizações frequentes. Você acompanha cada etapa do processo.',
  },
  {
    num: '04',
    icon: '🎯',
    title: 'Entrega e Suporte',
    desc: 'Deploy em produção, treinamento da equipe e suporte pós-lançamento incluídos.',
  },
]

const DIFFERENTIALS = [
  {
    icon: '⚡',
    title: 'Entrega em até 10 dias',
    desc: 'Enquanto agências tradicionais levam meses, entregamos projetos completos em até 10 dias úteis, sem abrir mão da qualidade.',
  },
  {
    icon: '💰',
    title: 'Investimento acessível',
    desc: 'Tecnologia de alto nível a partir de R$999,90. Parcelamento disponível. Você não precisa de um grande orçamento para ter um produto incrível.',
  },
  {
    icon: '🔒',
    title: 'Código limpo e seguro',
    desc: 'Desenvolvemos com as melhores práticas do mercado. Seu produto é escalável, seguro e fácil de manter conforme o negócio cresce.',
  },
  {
    icon: '🤝',
    title: 'Suporte pós-entrega',
    desc: 'Não sumimos depois do deploy. Você conta com suporte técnico contínuo, atualizações e melhorias iterativas após o lançamento.',
  },
]

const TESTIMONIALS = [
  {
    stars: 5,
    text: 'A AplicaDev entregou nosso sistema de gestão em menos de 2 semanas. Economizamos 40h por mês em processos manuais logo na primeira semana de uso.',
    name: 'Carlos Mendes',
    role: 'CEO',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    result: '+40h/mês',
    resultLabel: 'economizadas',
  },
  {
    stars: 5,
    text: 'Nossa landing page dobrou a taxa de conversão em 45 dias. O design é premium e a velocidade de carregamento é incrível. Superou todas as expectativas.',
    name: 'Ana Carvalho',
    role: 'CMO',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    result: '+240%',
    resultLabel: 'de conversão',
  },
  {
    stars: 5,
    text: 'Tinham nos cotado R$18.000 em outra agência pelo mesmo app. A AplicaDev entregou em 10 dias, muito mais rápido e com uma qualidade absurda.',
    name: 'Rafael Sousa',
    role: 'Fundador',
    avatar: 'https://randomuser.me/api/portraits/men/18.jpg',
    result: '10 dias',
    resultLabel: 'entregue',
  },
]

const FAQS = [
  {
    q: 'Vocês realmente entregam em até 10 dias?',
    a: 'Sim. Para a maioria dos projetos, como landing pages, sistemas de gestão básicos e apps de até média complexidade, entregamos em 7 a 10 dias úteis. Projetos mais robustos têm prazo combinado antes de iniciar. Trabalhamos com sprints ágeis e atualizações diárias para garantir isso.',
  },
  {
    q: 'Quanto custa exatamente o meu projeto?',
    a: 'Investimentos a partir de R$999,90 para projetos simples como landing pages. Sistemas completos e apps mobile partem de valores maiores. Após o diagnóstico gratuito, você recebe uma proposta detalhada com valor fixo. Sem surpresas no meio do caminho.',
  },
  {
    q: 'Trabalham com qual tecnologia?',
    a: 'Utilizamos React, React Native, Next.js, Node.js, Python e as melhores ferramentas do mercado de acordo com o projeto. Priorizamos tecnologias modernas, escaláveis e amplamente suportadas para garantir longevidade ao seu produto.',
  },
  {
    q: 'O que acontece depois da entrega?',
    a: 'Oferecemos suporte pós-entrega para correção de bugs e dúvidas. Para evoluções, melhorias e novas funcionalidades, trabalhamos com planos de manutenção mensais ou projetos avulsos. Você escolhe o modelo que faz mais sentido para o seu negócio.',
  },
  {
    q: 'Posso acompanhar o andamento do projeto?',
    a: 'Sim. Você tem acesso a um painel de acompanhamento em tempo real com todas as tarefas, entregas e status do projeto. Fazemos reuniões rápidas de alinhamento semanais e você pode entrar em contato pelo WhatsApp a qualquer momento.',
  },
]

const PRICING_FEATURES = [
  'Diagnóstico gratuito',
  'Design profissional',
  'Responsivo e rápido',
  'SEO otimizado',
  'Integrações incluídas',
  'Suporte pós-entrega',
]

/* ══════════════════════════════════════════════════════════════════
   COMPONENTS
   ══════════════════════════════════════════════════════════════════ */

function Navbar({ onCta }: { onCta: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileOpen(false)
  }

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <div className="navbar__inner">
        <a className="navbar__logo" href="#" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <img src={logoIcon} alt="AplicaDev" />
          <span className="navbar__logo-name">Aplica<span>Dev</span></span>
        </a>

        <div className="navbar__links">
          <a href="#servicos" onClick={e => { e.preventDefault(); scrollTo('servicos') }}>Serviços</a>
          <a href="#diferenciais" onClick={e => { e.preventDefault(); scrollTo('diferenciais') }}>Diferenciais</a>
          <a href="#processo" onClick={e => { e.preventDefault(); scrollTo('processo') }}>Como Funciona</a>
          <a href="#depoimentos" onClick={e => { e.preventDefault(); scrollTo('depoimentos') }}>Depoimentos</a>
          <a href="#faq" onClick={e => { e.preventDefault(); scrollTo('faq') }}>FAQ</a>
        </div>

        <button className="btn-primary" onClick={onCta}>
          Falar com Especialista →
        </button>

        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Menu"
        >
          <span style={mobileOpen ? { transform: 'rotate(45deg) translate(5px,5px)' } : {}} />
          <span style={mobileOpen ? { opacity: 0 } : {}} />
          <span style={mobileOpen ? { transform: 'rotate(-45deg) translate(5px,-5px)' } : {}} />
        </button>
      </div>

      {mobileOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'rgba(4,6,10,.97)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          {['servicos', 'diferenciais', 'processo', 'depoimentos', 'faq'].map(id => (
            <button key={id} onClick={() => scrollTo(id)} style={{
              background: 'none', border: 'none', textAlign: 'left',
              fontFamily: 'var(--font)', fontSize: '16px', fontWeight: '500',
              color: 'var(--text-2)', cursor: 'pointer', padding: '6px 0',
            }}>
              {{ servicos: 'Serviços', diferenciais: 'Diferenciais', processo: 'Como Funciona', depoimentos: 'Depoimentos', faq: 'FAQ' }[id]}
            </button>
          ))}
          <button className="btn-primary" onClick={() => { onCta(); setMobileOpen(false) }} style={{ width: '100%', justifyContent: 'center' }}>
            Falar com Especialista →
          </button>
        </div>
      )}
    </nav>
  )
}

/* ── HERO ──────────────────────────────────────────────────────── */

function Hero({ onCta }: { onCta: () => void }) {
  const [wordIdx, setWordIdx] = useState(0)
  const [key, setKey] = useState(0)

  useEffect(() => {
    const t = setInterval(() => {
      setWordIdx(i => (i + 1) % HERO_WORDS.length)
      setKey(k => k + 1)
    }, 2600)
    return () => clearInterval(t)
  }, [])

  const scrollToServices = () => document.getElementById('servicos')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <section className="hero">
      <div className="hero__bg-photo" style={{ backgroundImage: `url(${heroBg})` }} />
      <ParticleCanvas />
      <div className="hero__bg-mesh" />
      <div className="hero__grid" />

      <div className="hero__content">
        <div className="hero__left">
          <span className="tag hero__tag"><span className="dot" />Tecnologia que transforma negócios</span>

          <h1 className="hero__title">
            Seu negócio merece um{' '}
            <br />
            <span key={key} className="rotating-word">{HERO_WORDS[wordIdx]}</span>
            <br />
            de alto nível
          </h1>

          <p className="hero__sub">
            Desenvolvemos <strong>sites, aplicativos e sistemas</strong> sob medida para empresas que querem crescer.{' '}
            <strong>Entrega em até 10 dias</strong>, a partir de <strong>R$999,90</strong>.
          </p>

          <div className="hero__ctas">
            <button className="btn-primary" onClick={onCta}>
              Falar com Especialista →
            </button>
            <button className="btn-secondary" onClick={scrollToServices}>
              Ver o que fazemos
            </button>
          </div>

          <div className="hero__proof">
            <div className="hero__proof-avatars">
              {[
                'https://randomuser.me/api/portraits/women/65.jpg',
                'https://randomuser.me/api/portraits/men/45.jpg',
                'https://randomuser.me/api/portraits/women/33.jpg',
                'https://randomuser.me/api/portraits/men/22.jpg',
              ].map((src, i) => <img key={i} src={src} alt="" className="hero__proof-avatar" />)}
            </div>
            <div className="hero__proof-text">
              <div className="hero__proof-stars">★★★★★</div>
              <strong>+150 projetos</strong> entregues com sucesso
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}

/* ── STATS STRIP ────────────────────────────────────────────────── */

function StatItem({ target, suffix, label, detail, accent }: {
  target: number; suffix: string; label: string; detail: string; accent?: boolean
}) {
  const { count, ref } = useCounter(target)
  return (
    <div className="stat-item" data-reveal>
      <div className="stat-val">
        <span className="num" ref={ref}>{count}</span>
        <span className={`suffix${accent ? ' accent' : ''}`}>{suffix}</span>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  )
}

function StatsStrip() {
  return (
    <section className="stats-strip">
      <div className="stats-strip__inner">
        <StatItem target={150} suffix="+" label="Projetos entregues" detail="Sites, apps e sistemas" accent />
        <StatItem target={98} suffix="%" label="Satisfação dos clientes" detail="NPS verificado" accent />
        <StatItem target={10} suffix=" dias" label="Prazo de entrega" detail="Do briefing ao ar" />
        <StatItem target={999} suffix=",90" label="A partir de R$" detail="Investimento inicial" accent />
      </div>
    </section>
  )
}

/* ── MARQUEE ────────────────────────────────────────────────────── */

function Marquee() {
  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  return (
    <section className="marquee-section">
      <div className="marquee-track forward">
        {doubled.map((item, i) => (
          <span key={i} className="marquee-item">
            <span className="dot" />
            {item}
          </span>
        ))}
      </div>
    </section>
  )
}

/* ── SERVICES ───────────────────────────────────────────────────── */

function Services({ onCta }: { onCta: () => void }) {
  return (
    <section className="services" id="servicos">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="tag">O que entregamos</span>
          <h2 className="section-title">
            Soluções digitais para cada{' '}
            <span className="gradient-text">necessidade</span>
          </h2>
          <p className="section-sub">
            Do site institucional ao sistema de gestão completo, desenvolvemos o produto certo para o momento certo da sua empresa.
          </p>
        </div>

        <div className="services__grid">
          {SERVICES.map((s, i) => (
            <div
              key={s.title}
              className={`service-card${s.highlight ? ' featured' : ''}`}
              data-reveal
              data-delay={String(i + 1)}
            >
              {s.badge && <span className="service-card__badge">{s.badge}</span>}
              <div className="service-icon">{s.icon}</div>
              <div>
                <div className="service-card__title">{s.title}</div>
                <div className="service-card__sub">{s.sub}</div>
              </div>
              <ul className="service-card__list">
                {s.items.map(item => <li key={item}>{item}</li>)}
              </ul>
              <div className="service-card__footer">
                <span className="service-card__time">{s.time}</span>
                <button className="service-card__arrow" onClick={onCta} aria-label="Saiba mais">→</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── DIFFERENTIALS ──────────────────────────────────────────────── */

function Differentials() {
  return (
    <section className="differentials" id="diferenciais">
      <div className="container">
        <div className="diff-grid">
          <div className="diff-grid__visual" data-reveal="left">
            <div className="diff-screen">
              <div className="diff-screen__bar">
                <div className="diff-screen__dot" />
                <div className="diff-screen__dot" />
                <div className="diff-screen__dot" />
              </div>
              <img
                src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=800&auto=format&fit=crop"
                alt="Desenvolvimento de software profissional"
                loading="lazy"
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
            <div data-reveal="right">
              <span className="tag">Por que a AplicaDev</span>
              <h2 className="section-title" style={{ marginTop: '16px', textAlign: 'left' }}>
                O que nos faz{' '}
                <span className="gradient-text">diferentes</span>
              </h2>
            </div>

            <div className="diff-items">
              {DIFFERENTIALS.map((d, i) => (
                <div key={d.title} className="diff-item" data-reveal="right" data-delay={String(i + 1)}>
                  <div className="diff-item__icon">{d.icon}</div>
                  <div className="diff-item__body">
                    <div className="diff-item__title">{d.title}</div>
                    <div className="diff-item__desc">{d.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── PROCESS ────────────────────────────────────────────────────── */

function Process() {
  return (
    <section className="process" id="processo">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="tag">Como funciona</span>
          <h2 className="section-title">
            Do briefing ao ar em{' '}
            <span className="gradient-text">4 etapas</span>
          </h2>
          <p className="section-sub">
            Um processo transparente e ágil. Você acompanha cada passo e sabe exatamente o que está sendo construído.
          </p>
        </div>

        <div className="process__steps">
          {STEPS.map((step, i) => (
            <div key={step.num} className="process-step" data-reveal data-delay={String(i + 1)}>
              <div className="process-step__num">
                {step.num}
                <span className="process-step__icon">{step.icon}</span>
              </div>
              <div className="process-step__title">{step.title}</div>
              <div className="process-step__desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── TESTIMONIALS ───────────────────────────────────────────────── */

function Testimonials() {
  return (
    <section className="testimonials" id="depoimentos">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="tag">Depoimentos reais</span>
          <h2 className="section-title">
            O que nossos clientes{' '}
            <span className="gradient-text">falam</span>
          </h2>
          <p className="section-sub">
            Resultados concretos para empresas que confiaram na AplicaDev para transformar suas operações digitais.
          </p>
        </div>

        <div className="testimonials__grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={t.name} className="testi-card" data-reveal data-delay={String(i + 1)}>
              <div className="testi-stars">{'★'.repeat(t.stars)}</div>
              <p className="testi-text">{t.text}</p>
              <div className="testi-author">
                <img src={t.avatar} alt={t.name} className="testi-avatar" />
                <div>
                  <div className="testi-name">{t.name}</div>
                  <div className="testi-role">{t.role}</div>
                </div>
                <div className="testi-result">
                  <span className="testi-result-val">{t.result}</span>
                  <span className="testi-result-label">{t.resultLabel}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── PRICING ────────────────────────────────────────────────────── */

function Pricing({ onCta }: { onCta: () => void }) {
  return (
    <section className="pricing" id="investimento">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="tag">Investimento</span>
          <h2 className="section-title">
            Tecnologia premium,{' '}
            <span className="gradient-text">preço acessível</span>
          </h2>
          <p className="section-sub">
            Sem enrolação. Você recebe uma proposta com valor fixo antes de fechar qualquer coisa.
          </p>
        </div>

        <div className="pricing-highlight" data-reveal="scale">
          <div className="pricing-highlight__price">
            <span className="pricing-highlight__currency">R$</span>
            <span className="pricing-highlight__amount">999</span>
            <span style={{ fontSize: '36px', fontFamily: 'var(--font-head)', fontWeight: 700, color: 'var(--brand)' }}>,90</span>
            <span className="pricing-highlight__period">/ projeto</span>
          </div>

          <div className="pricing-highlight__title">Pronto para começar agora mesmo</div>
          <p className="pricing-highlight__desc">
            Diagnóstico gratuito, proposta no mesmo dia, entrega em até 10 dias. Parcelamento disponível. Sem fidelização.
          </p>

          <div className="pricing-features">
            {PRICING_FEATURES.map(f => (
              <div key={f} className="pricing-feat">{f}</div>
            ))}
          </div>

          <div className="pricing-highlight__cta">
            <button className="btn-primary" onClick={onCta}>
              Quero meu diagnóstico gratuito →
            </button>
            <span className="pricing-guarantee">🔒 Sem compromisso · Resposta em até 24h</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── PLANOS DE MENSALIDADE ──────────────────────────────────────── */

const PLANS = [
  {
    emoji: '🎯',
    name: 'Captação',
    who: 'Pra quem tem página de captação no ar',
    monthly: 69.9,
    features: [
      'Hospedagem premium + domínio renovado',
      'Página e formulário vigiados 24/7',
      'Backup e certificado de segurança',
      '1 ajuste de conteúdo por mês incluso',
      'Suporte direto no WhatsApp',
    ],
    badge: null,
  },
  {
    emoji: '🌐',
    name: 'Site',
    who: 'Pra quem tem site completo',
    monthly: 99.9,
    features: [
      'Tudo do Captação',
      'Ajustes em qualquer página (2 por mês)',
      'Presença no Google acompanhada (site + Maps)',
      'Relatório mensal: visitas e contatos gerados',
      'Suporte prioritário no WhatsApp',
    ],
    badge: 'Mais escolhido',
  },
  {
    emoji: '⚙️',
    name: 'Sistema',
    who: 'Pra quem tem um sistema rodando o negócio',
    monthly: 199.9,
    features: [
      'Banco de dados com backup todo dia',
      'Qualquer bug corrigido sem custo extra',
      '45 min de melhorias por mês inclusos',
      'Monitoramento 24/7 com alerta imediato',
      'Suporte prioritário',
    ],
    badge: null,
  },
  {
    emoji: '🤖',
    name: 'Operação',
    who: 'Pra quem quer a operação toda automatizada',
    monthly: 349.9,
    features: [
      'Tudo do Sistema',
      'Bot de WhatsApp atendendo por você',
      '500 mensagens automáticas/mês inclusas',
      'Automações entre seus sistemas (n8n)',
      'Resposta em até 4h úteis',
    ],
    badge: null,
  },
]

const brlPlan = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Plans({ onCta }: { onCta: () => void }) {
  const [yearly, setYearly] = useState(false)

  return (
    <section className="plans" id="planos">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="tag">Mensalidade</span>
          <h2 className="section-title">
            Entregamos e <span className="gradient-text">cuidamos pra sempre</span>
          </h2>
          <p className="section-sub">
            Seu projeto no ar, vigiado 24/7 e evoluindo todo mês. Você cuida do negócio, a gente cuida da tecnologia.
          </p>
        </div>

        <div className="plans-toggle" data-reveal>
          <button
            className={`plans-toggle__opt${!yearly ? ' active' : ''}`}
            onClick={() => setYearly(false)}
          >
            Mensal
          </button>
          <button
            className={`plans-toggle__opt${yearly ? ' active' : ''}`}
            onClick={() => setYearly(true)}
          >
            Anual <span className="plans-toggle__save">2 meses grátis</span>
          </button>
        </div>

        <div className="plans-grid" data-reveal>
          {PLANS.map(p => (
            <div key={p.name} className={`plan-card${p.badge ? ' plan-card--hl' : ''}`}>
              {p.badge && <span className="plan-card__badge">⭐ {p.badge}</span>}
              <div className="plan-card__emoji">{p.emoji}</div>
              <div className="plan-card__name">{p.name}</div>
              <div className="plan-card__who">{p.who}</div>
              <div className="plan-card__price">
                <span className="plan-card__currency">R$</span>
                <span className="plan-card__amount">
                  {brlPlan(yearly ? (p.monthly * 10) / 12 : p.monthly)}
                </span>
                <span className="plan-card__period">/mês</span>
              </div>
              {yearly ? (
                <div className="plan-card__note">
                  R${brlPlan(p.monthly * 10)}/ano · economia de R${brlPlan(p.monthly * 2)}
                </div>
              ) : (
                <div className="plan-card__note">sem fidelidade · cancele quando quiser</div>
              )}
              <ul className="plan-card__feats">
                {p.features.map(f => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
              <button className={p.badge ? 'btn-primary plan-card__cta' : 'btn-ghost plan-card__cta'} onClick={onCta}>
                Começar pelo diagnóstico →
              </button>
            </div>
          ))}
        </div>

        <p className="plans-foot" data-reveal>
          🔒 Preço travado por 12 meses (reajuste só pelo IPCA, uma vez ao ano). Ajustes além do incluso: R$120/h ou upgrade de plano. No anual, o valor equivale a <strong>10 mensalidades</strong>: 2 meses de presente.
        </p>
      </div>
    </section>
  )
}

/* ── FAQ ────────────────────────────────────────────────────────── */

function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="faq" id="faq">
      <div className="container">
        <div className="section-head" data-reveal>
          <span className="tag">Dúvidas frequentes</span>
          <h2 className="section-title">
            Perguntas que todo mundo{' '}
            <span className="gradient-text">faz</span>
          </h2>
        </div>

        <div className="faq__list">
          {FAQS.map((item, i) => (
            <div key={i} className={`faq-item${open === i ? ' open' : ''}`}>
              <button className="faq-question" onClick={() => setOpen(open === i ? null : i)}>
                {item.q}
                <span className="faq-chevron">▼</span>
              </button>
              <div className="faq-answer">
                <div className="faq-answer__inner">{item.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── CTA FINAL ──────────────────────────────────────────────────── */

function CTAFinal({ onCta }: { onCta: () => void }) {
  return (
    <section className="cta-final">
      <div className="cta-final__inner">
        <div className="cta-final__tag" data-reveal><span className="tag">Pronto para começar?</span></div>
        <h2 className="cta-final__title" data-reveal data-delay="1">
          Transforme sua ideia em um{' '}
          <span className="gradient-text">produto real</span>
          {' '}hoje
        </h2>
        <p className="cta-final__sub" data-reveal data-delay="2">
          Diagnóstico gratuito, proposta no mesmo dia e entrega garantida em até 10 dias. Sem burocracia.
        </p>
        <div className="cta-final__actions" data-reveal data-delay="3">
          <button className="btn-primary" onClick={onCta}>
            Falar com Especialista Agora →
          </button>
          <button
            className="btn-secondary"
            onClick={() => document.getElementById('servicos')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Ver nossos serviços
          </button>
        </div>
        <div className="cta-final__trust" data-reveal data-delay="4">
          <span>⚡ Entrega em até 10 dias</span>
          <span>💰 A partir de R$999,90</span>
          <span>🔒 Proposta sem compromisso</span>
          <span>★ 98% de satisfação</span>
        </div>
      </div>
    </section>
  )
}

/* ── FOOTER ─────────────────────────────────────────────────────── */

function Footer({ onCta }: { onCta: () => void }) {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__top">
          <div className="footer__brand">
            <div className="footer__logo">
              <img src={logoIcon} alt="AplicaDev" />
              <span className="footer__logo-name">Aplica<span>Dev</span></span>
            </div>
            <p className="footer__desc">
              Desenvolvimento de sites, aplicativos e sistemas sob medida. Entregamos tecnologia premium em até 10 dias para empresas que querem crescer.
            </p>
            <div className="footer__socials">
              <a href="#" className="footer__social-btn" aria-label="Instagram">📸</a>
              <a href="#" className="footer__social-btn" aria-label="LinkedIn">💼</a>
              <a href="#" className="footer__social-btn" aria-label="WhatsApp">💬</a>
            </div>
          </div>

          <div>
            <div className="footer__col-title">Serviços</div>
            <div className="footer__links">
              <a href="#" onClick={e => { e.preventDefault(); scrollTo('servicos') }}>Sites e Landing Pages</a>
              <a href="#" onClick={e => { e.preventDefault(); scrollTo('servicos') }}>Aplicativos Mobile</a>
              <a href="#" onClick={e => { e.preventDefault(); scrollTo('servicos') }}>Sistemas Web</a>
              <a href="#" onClick={e => { e.preventDefault(); scrollTo('servicos') }}>E-commerce</a>
            </div>
          </div>

          <div>
            <div className="footer__col-title">Empresa</div>
            <div className="footer__links">
              <a href="#" onClick={e => { e.preventDefault(); scrollTo('diferenciais') }}>Por que nós</a>
              <a href="#" onClick={e => { e.preventDefault(); scrollTo('processo') }}>Como funciona</a>
              <a href="#" onClick={e => { e.preventDefault(); scrollTo('depoimentos') }}>Clientes</a>
              <a href="#" onClick={e => { e.preventDefault(); onCta() }}>Contato</a>
            </div>
          </div>

          <div>
            <div className="footer__col-title">Suporte</div>
            <div className="footer__links">
              <a href="#" onClick={e => { e.preventDefault(); scrollTo('faq') }}>FAQ</a>
              <a href="#" onClick={e => { e.preventDefault(); onCta() }}>Diagnóstico gratuito</a>
              <a href="#">Política de privacidade</a>
              <a href="#">Termos de uso</a>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <span className="footer__copy">
            © {new Date().getFullYear()} AplicaDev. Todos os direitos reservados.
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Feito com ❤️ e muito código
          </span>
        </div>
      </div>
    </footer>
  )
}

/* ── SCROLL PROGRESS BAR ────────────────────────────────────────── */

function ScrollProgress() {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const fn = () => {
      const scrolled = window.scrollY
      const total = document.documentElement.scrollHeight - window.innerHeight
      setPct(total > 0 ? (scrolled / total) * 100 : 0)
    }
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return <div className="scroll-progress" style={{ width: `${pct}%` }} />
}

/* ══════════════════════════════════════════════════════════════════
   LANDING PAGE
   ══════════════════════════════════════════════════════════════════ */

function LandingPage() {
  const navigate = useNavigate()
  const handleCta = useCallback(() => navigate('/diagnostico'), [navigate])

  useScrollReveal()

  return (
    <>
      <ScrollProgress />
      <Navbar onCta={handleCta} />
      <main>
        <Hero onCta={handleCta} />
        <StatsStrip />
        <Marquee />
        <Services onCta={handleCta} />
        <Differentials />
        <Process />
        <Testimonials />
        <Pricing onCta={handleCta} />
        <Plans onCta={handleCta} />
        <FAQ />
        <CTAFinal onCta={handleCta} />
      </main>
      <Footer onCta={handleCta} />
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════
   APP ROOT
   ══════════════════════════════════════════════════════════════════ */

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/diagnostico" element={<Diagnostico />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  )
}
