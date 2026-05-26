import { useState } from 'react'
import { Link } from 'react-router-dom'
import logoIcon from '../assets/logo-icon-clean.png'
import { insertLead } from '../lib/db'
import type { LeadDados } from '../lib/db'

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
type ServiceChoice = 'site' | 'app' | 'sistema' | 'nao-sei'
type Rec = 'site' | 'sistema' | 'app'
type StepKey =
  | 'contact' | 'service-choice' | 'about-biz' | 'goals'
  | 'ctx-site' | 'ctx-sistema' | 'ctx-app'
  | 'ctx-discover-digital' | 'ctx-discover-processes'
  | 'done'

interface FD {
  nome: string; whatsapp: string; nomeEmpresa: string
  serviceChoice: ServiceChoice | ''
  // about-biz
  empresaTipo: string; nicho: string; clientesMes: string; escala: string; faturamento: string
  // digital
  temSite: string; canais: string[]; investiuAntes: string
  // processes
  orgClientes: string; controlePedidos: string; temEquipe: string; tamanhoEquipe: string
  // goals
  dificuldade: string; urgencia: string
  // specific questions
  siteObjetivo: string
  appPlataforma: string; appDescricao: string
  sistemaDescricao: string
}

const INIT: FD = {
  nome: '', whatsapp: '', nomeEmpresa: '',
  serviceChoice: '',
  empresaTipo: '', nicho: '', clientesMes: '', escala: '', faturamento: '',
  temSite: '', canais: [], investiuAntes: '',
  orgClientes: '', controlePedidos: '', temEquipe: '', tamanhoEquipe: '',
  dificuldade: '', urgencia: '',
  siteObjetivo: '',
  appPlataforma: '', appDescricao: '',
  sistemaDescricao: '',
}

/* ═══════════════════════════════════════════════════════════════
   RECOMMENDATION ENGINE (internal — lead never sees this)
═══════════════════════════════════════════════════════════════ */
function recommend(d: FD): Rec {
  // Direct intent from serviceChoice overrides scoring
  if (d.serviceChoice === 'site') return 'site'
  if (d.serviceChoice === 'sistema') return 'sistema'
  if (d.serviceChoice === 'app') return 'app'

  let site = 0, sistema = 0, app = 0

  if (d.temSite === 'nao') site += 3
  if (d.dificuldade === 'clientes') site += 2
  if (d.dificuldade === 'profissionalizar') site += 2
  if (d.escala === 'local') site += 1
  if (d.canais.includes('instagram') || d.canais.includes('whatsapp')) site += 1
  if (d.clientesMes === '0-20') site += 1

  if (d.orgClientes === 'planilha' || d.orgClientes === 'whatsapp') sistema += 2
  if (d.controlePedidos === 'manual' || d.controlePedidos === 'planilha') sistema += 2
  if (d.temEquipe === 'sim') sistema += 3
  if (d.clientesMes === '50-100' || d.clientesMes === '100+') sistema += 2
  if (d.dificuldade === 'automatizar' || d.dificuldade === 'organizar') sistema += 2
  // Higher revenue signals more complex needs
  if (d.faturamento === '15-50k' || d.faturamento === '50k+') sistema += 2

  const appKw = ['academia', 'clinica', 'clínica', 'restaurante', 'escola', 'fitness',
    'barbearia', 'salão', 'salao', 'pet', 'saúde', 'saude', 'farmácia', 'farmacia', 'estetica', 'estética']
  if (appKw.some(k => d.nicho.toLowerCase().includes(k))) app += 4
  if (d.empresaTipo === 'prestador') app += 1
  if (d.clientesMes === '100+') app += 1

  // Urgency as tiebreaker: urgent leads lean toward simpler solutions (site)
  if (sistema > site && sistema >= app) return 'sistema'
  if (app > site && app > sistema) return 'app'
  if (site === sistema && d.urgencia === 'ontem') return 'site'
  return 'site'
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION — contextual per service choice
═══════════════════════════════════════════════════════════════ */
function getSteps(choice: ServiceChoice | ''): StepKey[] {
  const base: StepKey[] = ['contact', 'service-choice', 'about-biz']
  if (choice === 'site')    return [...base, 'ctx-site', 'goals', 'done']
  if (choice === 'sistema') return [...base, 'ctx-sistema', 'goals', 'done']
  if (choice === 'app')     return [...base, 'ctx-app', 'goals', 'done']
  // "nao-sei" → broader questions
  return [...base, 'ctx-discover-digital', 'ctx-discover-processes', 'goals', 'done']
}

function getNext(step: StepKey, d: FD): StepKey {
  const steps = getSteps(d.serviceChoice as ServiceChoice)
  const i = steps.indexOf(step)
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : 'done'
}

function getPrev(step: StepKey, d: FD): StepKey {
  const steps = getSteps(d.serviceChoice as ServiceChoice)
  const i = steps.indexOf(step)
  return i > 0 ? steps[i - 1] : 'contact'
}

function progress(step: StepKey, d: FD): { cur: number; tot: number } {
  const steps = getSteps(d.serviceChoice as ServiceChoice)
  const i = steps.indexOf(step)
  return { cur: Math.max(i + 1, 1), tot: steps.length }
}

function canAdvance(step: StepKey, d: FD): boolean {
  if (step === 'contact') return d.nome.trim().length > 1 && d.whatsapp.replace(/\D/g, '').length >= 10
  if (step === 'service-choice') return d.serviceChoice !== ''
  if (step === 'about-biz') return d.empresaTipo !== '' && d.clientesMes !== ''
  if (step === 'goals') return d.dificuldade !== '' && d.urgencia !== ''
  if (step === 'ctx-site') return d.temSite !== '' && d.siteObjetivo !== ''
  if (step === 'ctx-sistema') return d.orgClientes !== '' && d.temEquipe !== ''
  if (step === 'ctx-app') return d.appPlataforma !== ''
  if (step === 'ctx-discover-digital') return d.temSite !== ''
  if (step === 'ctx-discover-processes') return d.orgClientes !== '' && d.temEquipe !== ''
  return true
}

/* ═══════════════════════════════════════════════════════════════
   WHATSAPP
═══════════════════════════════════════════════════════════════ */
const WA_NUMBER = '5588998030247'

function buildLeadMsg(d: FD): string {
  const lines = [
    `Olá! Me chamo *${d.nome}*${d.nomeEmpresa ? ` da empresa *${d.nomeEmpresa}*` : ''}.`,
    ``,
    `Acabei de completar o diagnóstico gratuito no site da AplicaDev.`,
    ``,
    `Gostaria de receber a análise completa do meu negócio e entender quais soluções fazem sentido pra mim.`,
    ``,
    `Fico no aguardo! 🙏`,
  ]
  return encodeURIComponent(lines.join('\n'))
}

/* ═══════════════════════════════════════════════════════════════
   UI COMPONENTS
═══════════════════════════════════════════════════════════════ */
function Opt({ label, icon, desc, selected, onClick }: {
  label: string; icon?: string; desc?: string; selected: boolean; onClick: () => void
}) {
  return (
    <button type="button" className={`diag-opt${selected ? ' selected' : ''}`} onClick={onClick}>
      {icon && <span className="diag-opt__icon">{icon}</span>}
      <span className="diag-opt__body">
        <span className="diag-opt__label">{label}</span>
        {desc && <span className="diag-opt__desc">{desc}</span>}
      </span>
      <span className="diag-opt__check" />
    </button>
  )
}

function Multi({ label, icon, selected, onClick }: {
  label: string; icon?: string; selected: boolean; onClick: () => void
}) {
  return (
    <button type="button" className={`diag-opt multi${selected ? ' selected' : ''}`} onClick={onClick}>
      <span className={`diag-opt__cb${selected ? ' checked' : ''}`} />
      {icon && <span className="diag-opt__icon-sm">{icon}</span>}
      <span className="diag-opt__label">{label}</span>
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Diagnostico() {
  const [step, setStep] = useState<StepKey>('contact')
  const [data, setData] = useState<FD>(INIT)
  const [animKey, setAnimKey] = useState(0)
  const [animBwd, setAnimBwd] = useState(false)
  const [shake, setShake] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = (f: keyof FD, v: unknown) => setData(d => ({ ...d, [f]: v }))
  const toggle = (canal: string) => setData(d => ({
    ...d,
    canais: d.canais.includes(canal) ? d.canais.filter(c => c !== canal) : [...d.canais, canal],
  }))

  const goNext = async () => {
    if (!canAdvance(step, data)) {
      setShake(true); setTimeout(() => setShake(false), 500); return
    }
    const next = getNext(step, data)
    if (next === 'done') {
      // Calcula recomendação internamente e salva no Supabase
      const finalRec = data.serviceChoice !== 'nao-sei' && data.serviceChoice
        ? (data.serviceChoice as Rec)
        : recommend(data)

      const dados: LeadDados = {
        serviceChoice: data.serviceChoice,
        empresaTipo: data.empresaTipo, nicho: data.nicho,
        clientesMes: data.clientesMes, escala: data.escala, faturamento: data.faturamento,
        temSite: data.temSite, canais: data.canais, investiuAntes: data.investiuAntes,
        orgClientes: data.orgClientes, controlePedidos: data.controlePedidos,
        temEquipe: data.temEquipe, tamanhoEquipe: data.tamanhoEquipe,
        dificuldade: data.dificuldade, urgencia: data.urgencia,
        siteObjetivo: data.siteObjetivo,
        appPlataforma: data.appPlataforma, appDescricao: data.appDescricao,
        sistemaDescricao: data.sistemaDescricao,
      }

      setSaving(true)
      const { error } = await insertLead({ nome: data.nome, whatsapp: data.whatsapp, nome_empresa: data.nomeEmpresa, rec: finalRec, dados })
      if (error) console.error('[Diagnostico] Erro ao salvar lead:', error)
      setSaving(false)
    }
    setAnimBwd(false); setAnimKey(k => k + 1); setStep(next)
  }

  const goBack = () => {
    setAnimBwd(true); setAnimKey(k => k + 1); setStep(getPrev(step, data))
  }

  const { cur, tot } = progress(step, data)
  const pct = step === 'done' ? 100 : Math.round((cur / tot) * 100)
  const waUrl = `https://wa.me/${WA_NUMBER}?text=${buildLeadMsg(data)}`

  const nextLabel = (() => {
    if (step === 'contact') return 'Iniciar diagnóstico →'
    if (step === 'goals') return 'Finalizar →'
    return 'Continuar →'
  })()

  return (
    <div className="diag-page">
      <header className="diag-header">
        <Link to="/" className="diag-logo">
          <img src={logoIcon} alt="AplicaDev" />
          <span>Aplica<strong>Dev</strong></span>
        </Link>
        <div className="diag-pbar">
          <div className="diag-pbar__fill" style={{ width: `${pct}%` }} />
        </div>
        <Link to="/" className="diag-back-link">← Voltar ao site</Link>
      </header>

      <main className="diag-main">
        <div
          key={animKey}
          className={`diag-card${shake ? ' shake' : ''}`}
          style={{ animation: animBwd ? 'diagBwd .35s cubic-bezier(.22,1,.36,1) both' : 'diagFwd .35s cubic-bezier(.22,1,.36,1) both' }}
        >

          {/* ── STEP: contact ──────────────── */}
          {step === 'contact' && (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">👋</span>
                <h1 className="diag-step__title">Diagnóstico gratuito</h1>
                <p className="diag-step__sub">Em menos de 3 minutos, vamos entender o seu negócio e preparar uma análise personalizada.</p>
              </div>
              <div className="diag-fields">
                <div className="diag-field">
                  <label className="diag-label">Seu nome completo</label>
                  <input className="diag-input" type="text" placeholder="Como podemos te chamar?" value={data.nome} onChange={e => set('nome', e.target.value)} autoFocus />
                </div>
                <div className="diag-field">
                  <label className="diag-label">Seu WhatsApp</label>
                  <input className="diag-input" type="tel" placeholder="(88) 9 9999-9999" value={data.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
                </div>
                <div className="diag-field">
                  <label className="diag-label">Nome da empresa <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
                  <input className="diag-input" type="text" placeholder="Sua empresa ou marca" value={data.nomeEmpresa} onChange={e => set('nomeEmpresa', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: service-choice ────────── */}
          {step === 'service-choice' && (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">🎯</span>
                <h1 className="diag-step__title">O que você está buscando?</h1>
                <p className="diag-step__sub">Selecione o que melhor descreve sua necessidade</p>
              </div>
              <div className="diag-service-grid">
                <Opt icon="🌐" label="Quero um Site" desc="Landing page, portal ou e-commerce" selected={data.serviceChoice === 'site'} onClick={() => set('serviceChoice', 'site')} />
                <Opt icon="📱" label="Quero um Aplicativo" desc="iOS, Android ou PWA" selected={data.serviceChoice === 'app'} onClick={() => set('serviceChoice', 'app')} />
                <Opt icon="⚙️" label="Quero um Sistema" desc="ERP, CRM ou automação interna" selected={data.serviceChoice === 'sistema'} onClick={() => set('serviceChoice', 'sistema')} />
                <Opt icon="🤔" label="Ainda não sei" desc="Me ajudem a descobrir" selected={data.serviceChoice === 'nao-sei'} onClick={() => set('serviceChoice', 'nao-sei')} />
              </div>
            </div>
          )}

          {/* ── STEP 1: Sobre o Negócio ────── */}
          {step === 'about-biz' && (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">🏢</span>
                <h1 className="diag-step__title">Sobre o seu negócio</h1>
                <p className="diag-step__sub">Nos ajude a entender melhor a sua empresa</p>
              </div>
              <div className="diag-section">
                <div className="diag-q">
                  <div className="diag-q__label">Qual o tipo da sua empresa?</div>
                  <div className="diag-opts-col">
                    <Opt label="Prestador de serviço" selected={data.empresaTipo === 'prestador'} onClick={() => set('empresaTipo', 'prestador')} />
                    <Opt label="Loja física" selected={data.empresaTipo === 'loja-fisica'} onClick={() => set('empresaTipo', 'loja-fisica')} />
                    <Opt label="Loja online" selected={data.empresaTipo === 'loja-online'} onClick={() => set('empresaTipo', 'loja-online')} />
                    <Opt label="Empresa B2B" selected={data.empresaTipo === 'b2b'} onClick={() => set('empresaTipo', 'b2b')} />
                    <Opt label="Outro" selected={data.empresaTipo === 'outro'} onClick={() => set('empresaTipo', 'outro')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Qual o nicho do seu negócio?</div>
                  <input className="diag-input" type="text" placeholder="Ex: barbearia, clínica, restaurante, escola..." value={data.nicho} onChange={e => set('nicho', e.target.value)} />
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Quantos clientes você atende por mês?</div>
                  <div className="diag-opts-row">
                    <Opt label="0 - 20" selected={data.clientesMes === '0-20'} onClick={() => set('clientesMes', '0-20')} />
                    <Opt label="20 - 50" selected={data.clientesMes === '20-50'} onClick={() => set('clientesMes', '20-50')} />
                    <Opt label="50 - 100" selected={data.clientesMes === '50-100'} onClick={() => set('clientesMes', '50-100')} />
                    <Opt label="100+" selected={data.clientesMes === '100+'} onClick={() => set('clientesMes', '100+')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Sua empresa é:</div>
                  <div className="diag-opts-row">
                    <Opt label="Local" selected={data.escala === 'local'} onClick={() => set('escala', 'local')} />
                    <Opt label="Regional" selected={data.escala === 'regional'} onClick={() => set('escala', 'regional')} />
                    <Opt label="Nacional" selected={data.escala === 'nacional'} onClick={() => set('escala', 'nacional')} />
                    <Opt label="Online" selected={data.escala === 'online'} onClick={() => set('escala', 'online')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Qual o faturamento mensal aproximado?</div>
                  <div className="diag-opts-col">
                    <Opt label="Até R$5 mil" selected={data.faturamento === 'ate-5k'} onClick={() => set('faturamento', 'ate-5k')} />
                    <Opt label="R$5 mil - R$15 mil" selected={data.faturamento === '5-15k'} onClick={() => set('faturamento', '5-15k')} />
                    <Opt label="R$15 mil - R$50 mil" selected={data.faturamento === '15-50k'} onClick={() => set('faturamento', '15-50k')} />
                    <Opt label="Acima de R$50 mil" selected={data.faturamento === '50k+'} onClick={() => set('faturamento', '50k+')} />
                    <Opt label="Prefiro não informar" selected={data.faturamento === 'nao-informar'} onClick={() => set('faturamento', 'nao-informar')} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── CTX-SITE: Perguntas pra quem quer site ── */}
          {step === 'ctx-site' && (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">🌐</span>
                <h1 className="diag-step__title">Sobre o seu site</h1>
                <p className="diag-step__sub">Vamos entender o que você precisa</p>
              </div>
              <div className="diag-section">
                <div className="diag-q">
                  <div className="diag-q__label">Você já possui algum site hoje?</div>
                  <div className="diag-opts-row">
                    <Opt label="Sim, tenho" selected={data.temSite === 'sim'} onClick={() => set('temSite', 'sim')} />
                    <Opt label="Não tenho" selected={data.temSite === 'nao'} onClick={() => set('temSite', 'nao')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Qual o principal objetivo do site?</div>
                  <div className="diag-opts-col">
                    <Opt label="Gerar mais vendas e leads" selected={data.siteObjetivo === 'vendas'} onClick={() => set('siteObjetivo', 'vendas')} />
                    <Opt label="Apresentar minha empresa" selected={data.siteObjetivo === 'institucional'} onClick={() => set('siteObjetivo', 'institucional')} />
                    <Opt label="Vender produtos online (e-commerce)" selected={data.siteObjetivo === 'ecommerce'} onClick={() => set('siteObjetivo', 'ecommerce')} />
                    <Opt label="Portfólio ou blog" selected={data.siteObjetivo === 'portfolio'} onClick={() => set('siteObjetivo', 'portfolio')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Como seus clientes te encontram hoje?</div>
                  <div className="diag-opts-multi">
                    <Multi icon="💬" label="WhatsApp" selected={data.canais.includes('whatsapp')} onClick={() => toggle('whatsapp')} />
                    <Multi icon="📸" label="Instagram" selected={data.canais.includes('instagram')} onClick={() => toggle('instagram')} />
                    <Multi icon="📞" label="Indicação" selected={data.canais.includes('indicacao')} onClick={() => toggle('indicacao')} />
                    <Multi icon="🔍" label="Google" selected={data.canais.includes('google')} onClick={() => toggle('google')} />
                    <Multi icon="📧" label="Outro" selected={data.canais.includes('outro')} onClick={() => toggle('outro')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Já investiu em site ou marketing digital antes?</div>
                  <div className="diag-opts-col">
                    <Opt label="Sim, e deu certo" selected={data.investiuAntes === 'sim-certo'} onClick={() => set('investiuAntes', 'sim-certo')} />
                    <Opt label="Sim, mas não funcionou" selected={data.investiuAntes === 'sim-falhou'} onClick={() => set('investiuAntes', 'sim-falhou')} />
                    <Opt label="Nunca investi" selected={data.investiuAntes === 'nunca'} onClick={() => set('investiuAntes', 'nunca')} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── CTX-SISTEMA: Perguntas pra quem quer sistema ── */}
          {step === 'ctx-sistema' && (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">⚙️</span>
                <h1 className="diag-step__title">Sobre a operação do seu negócio</h1>
                <p className="diag-step__sub">Vamos entender como funciona hoje pra criar o sistema certo</p>
              </div>
              <div className="diag-section">
                <div className="diag-q">
                  <div className="diag-q__label">Como você organiza seus clientes hoje?</div>
                  <div className="diag-opts-col">
                    <Opt label="Planilha (Excel/Google Sheets)" selected={data.orgClientes === 'planilha'} onClick={() => set('orgClientes', 'planilha')} />
                    <Opt label="WhatsApp / anotações" selected={data.orgClientes === 'whatsapp'} onClick={() => set('orgClientes', 'whatsapp')} />
                    <Opt label="Já uso algum sistema" selected={data.orgClientes === 'sistema'} onClick={() => set('orgClientes', 'sistema')} />
                    <Opt label="Não organizo" selected={data.orgClientes === 'nao-organizo'} onClick={() => set('orgClientes', 'nao-organizo')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Como controla pedidos e serviços?</div>
                  <div className="diag-opts-col">
                    <Opt label="Tudo manual / caderno" selected={data.controlePedidos === 'manual'} onClick={() => set('controlePedidos', 'manual')} />
                    <Opt label="Planilha" selected={data.controlePedidos === 'planilha'} onClick={() => set('controlePedidos', 'planilha')} />
                    <Opt label="Já uso sistema" selected={data.controlePedidos === 'sistema'} onClick={() => set('controlePedidos', 'sistema')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Possui equipe que vai usar o sistema?</div>
                  <div className="diag-opts-row">
                    <Opt label="Sim" selected={data.temEquipe === 'sim'} onClick={() => set('temEquipe', 'sim')} />
                    <Opt label="Só eu" selected={data.temEquipe === 'nao'} onClick={() => set('temEquipe', 'nao')} />
                  </div>
                </div>
                {data.temEquipe === 'sim' && (
                  <div className="diag-q">
                    <div className="diag-q__label">Quantas pessoas vão usar?</div>
                    <div className="diag-opts-row">
                      <Opt label="1 - 3" selected={data.tamanhoEquipe === '1-3'} onClick={() => set('tamanhoEquipe', '1-3')} />
                      <Opt label="3 - 10" selected={data.tamanhoEquipe === '3-10'} onClick={() => set('tamanhoEquipe', '3-10')} />
                      <Opt label="10+" selected={data.tamanhoEquipe === '10+'} onClick={() => set('tamanhoEquipe', '10+')} />
                    </div>
                  </div>
                )}
                <div className="diag-q">
                  <div className="diag-q__label">Descreva o que o sistema precisa resolver (opcional)</div>
                  <textarea className="diag-input ta" placeholder="Ex: Controlar pedidos, cadastrar clientes, gerar relatórios, gerenciar estoque..." value={data.sistemaDescricao} onChange={e => set('sistemaDescricao', e.target.value)} rows={3} />
                </div>
              </div>
            </div>
          )}

          {/* ── CTX-APP: Perguntas pra quem quer app ── */}
          {step === 'ctx-app' && (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">📱</span>
                <h1 className="diag-step__title">Sobre o seu aplicativo</h1>
                <p className="diag-step__sub">Vamos definir o escopo ideal</p>
              </div>
              <div className="diag-section">
                <div className="diag-q">
                  <div className="diag-q__label">Para qual plataforma?</div>
                  <div className="diag-opts-col">
                    <Opt label="iOS e Android" selected={data.appPlataforma === 'ambos'} onClick={() => set('appPlataforma', 'ambos')} />
                    <Opt label="Só Android" selected={data.appPlataforma === 'android'} onClick={() => set('appPlataforma', 'android')} />
                    <Opt label="Só iOS (iPhone)" selected={data.appPlataforma === 'ios'} onClick={() => set('appPlataforma', 'ios')} />
                    <Opt label="Web App (acessado pelo navegador)" selected={data.appPlataforma === 'web'} onClick={() => set('appPlataforma', 'web')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Quem vai usar o app?</div>
                  <div className="diag-opts-multi">
                    <Multi label="Meus clientes" selected={data.canais.includes('clientes-app')} onClick={() => toggle('clientes-app')} />
                    <Multi label="Minha equipe" selected={data.canais.includes('equipe-app')} onClick={() => toggle('equipe-app')} />
                    <Multi label="Ambos" selected={data.canais.includes('ambos-app')} onClick={() => toggle('ambos-app')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Descreva o que o app precisa fazer</div>
                  <textarea className="diag-input ta" placeholder="Ex: App de agendamento para academia com pagamento integrado, perfil de aluno e notificações..." value={data.appDescricao} onChange={e => set('appDescricao', e.target.value)} rows={3} />
                </div>
              </div>
            </div>
          )}

          {/* ── CTX-DISCOVER: Digital (só pra "não sei") ── */}
          {step === 'ctx-discover-digital' && (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">🔍</span>
                <h1 className="diag-step__title">Presença digital atual</h1>
                <p className="diag-step__sub">Vamos entender como seu negócio está hoje</p>
              </div>
              <div className="diag-section">
                <div className="diag-q">
                  <div className="diag-q__label">Você possui site?</div>
                  <div className="diag-opts-row">
                    <Opt label="Sim" selected={data.temSite === 'sim'} onClick={() => set('temSite', 'sim')} />
                    <Opt label="Não" selected={data.temSite === 'nao'} onClick={() => set('temSite', 'nao')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Como seus clientes te encontram?</div>
                  <div className="diag-opts-multi">
                    <Multi icon="💬" label="WhatsApp" selected={data.canais.includes('whatsapp')} onClick={() => toggle('whatsapp')} />
                    <Multi icon="📸" label="Instagram" selected={data.canais.includes('instagram')} onClick={() => toggle('instagram')} />
                    <Multi icon="📞" label="Indicação" selected={data.canais.includes('indicacao')} onClick={() => toggle('indicacao')} />
                    <Multi icon="🔍" label="Google" selected={data.canais.includes('google')} onClick={() => toggle('google')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Já investiu em tecnologia antes?</div>
                  <div className="diag-opts-col">
                    <Opt label="Sim, e deu certo" selected={data.investiuAntes === 'sim-certo'} onClick={() => set('investiuAntes', 'sim-certo')} />
                    <Opt label="Sim, mas não funcionou" selected={data.investiuAntes === 'sim-falhou'} onClick={() => set('investiuAntes', 'sim-falhou')} />
                    <Opt label="Nunca investi" selected={data.investiuAntes === 'nunca'} onClick={() => set('investiuAntes', 'nunca')} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── CTX-DISCOVER: Processos (só pra "não sei") ── */}
          {step === 'ctx-discover-processes' && (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">📋</span>
                <h1 className="diag-step__title">Processos do negócio</h1>
                <p className="diag-step__sub">Como funciona a operação hoje?</p>
              </div>
              <div className="diag-section">
                <div className="diag-q">
                  <div className="diag-q__label">Como organiza seus clientes?</div>
                  <div className="diag-opts-col">
                    <Opt label="Planilha" selected={data.orgClientes === 'planilha'} onClick={() => set('orgClientes', 'planilha')} />
                    <Opt label="WhatsApp / anotações" selected={data.orgClientes === 'whatsapp'} onClick={() => set('orgClientes', 'whatsapp')} />
                    <Opt label="Já uso sistema" selected={data.orgClientes === 'sistema'} onClick={() => set('orgClientes', 'sistema')} />
                    <Opt label="Não organizo" selected={data.orgClientes === 'nao-organizo'} onClick={() => set('orgClientes', 'nao-organizo')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Controle de pedidos/serviços:</div>
                  <div className="diag-opts-col">
                    <Opt label="Manual / caderno" selected={data.controlePedidos === 'manual'} onClick={() => set('controlePedidos', 'manual')} />
                    <Opt label="Planilha" selected={data.controlePedidos === 'planilha'} onClick={() => set('controlePedidos', 'planilha')} />
                    <Opt label="Já uso sistema" selected={data.controlePedidos === 'sistema'} onClick={() => set('controlePedidos', 'sistema')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Possui equipe?</div>
                  <div className="diag-opts-row">
                    <Opt label="Sim" selected={data.temEquipe === 'sim'} onClick={() => set('temEquipe', 'sim')} />
                    <Opt label="Não" selected={data.temEquipe === 'nao'} onClick={() => set('temEquipe', 'nao')} />
                  </div>
                </div>
                {data.temEquipe === 'sim' && (
                  <div className="diag-q">
                    <div className="diag-q__label">Quantas pessoas?</div>
                    <div className="diag-opts-row">
                      <Opt label="1 - 3" selected={data.tamanhoEquipe === '1-3'} onClick={() => set('tamanhoEquipe', '1-3')} />
                      <Opt label="3 - 10" selected={data.tamanhoEquipe === '3-10'} onClick={() => set('tamanhoEquipe', '3-10')} />
                      <Opt label="10+" selected={data.tamanhoEquipe === '10+'} onClick={() => set('tamanhoEquipe', '10+')} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 4: Desafios e Objetivos ── */}
          {step === 'goals' && (
            <div className="diag-step">
              <div className="diag-step__head">
                <span className="diag-step__emoji">🚀</span>
                <h1 className="diag-step__title">Desafios e objetivos</h1>
                <p className="diag-step__sub">{data.serviceChoice === 'nao-sei' ? 'Última etapa!' : 'Quase lá! Falta pouco.'}</p>
              </div>
              <div className="diag-section">
                <div className="diag-q">
                  <div className="diag-q__label">Qual o maior problema do seu negócio HOJE?</div>
                  <div className="diag-opts-col">
                    <Opt label="Poucos clientes/vendas" selected={data.dificuldade === 'clientes'} onClick={() => set('dificuldade', 'clientes')} />
                    <Opt label="Perco tempo com processos manuais" selected={data.dificuldade === 'automatizar'} onClick={() => set('dificuldade', 'automatizar')} />
                    <Opt label="Não consigo organizar clientes/pedidos" selected={data.dificuldade === 'organizar'} onClick={() => set('dificuldade', 'organizar')} />
                    <Opt label="Preciso me profissionalizar digitalmente" selected={data.dificuldade === 'profissionalizar'} onClick={() => set('dificuldade', 'profissionalizar')} />
                    <Opt label="Quero escalar mas não consigo" selected={data.dificuldade === 'escalar'} onClick={() => set('dificuldade', 'escalar')} />
                  </div>
                </div>
                <div className="diag-q">
                  <div className="diag-q__label">Qual a urgência dessa solução?</div>
                  <div className="diag-opts-col">
                    <Opt label="Preciso pra ontem" selected={data.urgencia === 'ontem'} onClick={() => set('urgencia', 'ontem')} />
                    <Opt label="Próximas semanas" selected={data.urgencia === 'semanas'} onClick={() => set('urgencia', 'semanas')} />
                    <Opt label="Próximos meses" selected={data.urgencia === 'meses'} onClick={() => set('urgencia', 'meses')} />
                    <Opt label="Estou pesquisando" selected={data.urgencia === 'pesquisando'} onClick={() => set('urgencia', 'pesquisando')} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DONE: Thank you ────────────── */}
          {step === 'done' && (
            <div className="diag-result">
              <div className="diag-result__top">
                <div className="diag-result__icon" style={{ background: 'rgba(26,183,171,.12)', borderColor: 'rgba(26,183,171,.25)' }}>
                  ✅
                </div>
                <h1 className="diag-result__title">Diagnóstico concluído!</h1>
                <p className="diag-result__desc">
                  <strong>{data.nome}</strong>, suas respostas foram registradas com sucesso.
                  Nossa equipe vai analisar o perfil do seu negócio e preparar um diagnóstico completo com as melhores soluções pra você.
                </p>
              </div>

              <div className="diag-result__box" style={{ borderColor: 'rgba(26,183,171,.2)', background: 'rgba(26,183,171,.04)' }}>
                <div className="diag-result__service-name">Próximos passos</div>
                <ul className="diag-result__points">
                  <li><span className="diag-result__check" style={{ color: '#1ab7ab' }}>1</span>Clique no botão abaixo pra falar com a gente pelo WhatsApp</li>
                  <li><span className="diag-result__check" style={{ color: '#1ab7ab' }}>2</span>Nosso time vai analisar suas respostas e preparar o diagnóstico</li>
                  <li><span className="diag-result__check" style={{ color: '#1ab7ab' }}>3</span>Em até 24h você recebe uma proposta personalizada</li>
                </ul>
              </div>

              <div className="diag-result__actions">
                <a href={waUrl} target="_blank" rel="noopener noreferrer" className="diag-cta-wa">
                  💬 Falar com a equipe pelo WhatsApp
                </a>
                <Link to="/" className="diag-cta-back">← Voltar ao site</Link>
              </div>

              <div className="diag-result__note">
                Ao clicar no botão, você será direcionado ao WhatsApp da nossa equipe. Fique tranquilo, é rápido e sem compromisso.
              </div>
            </div>
          )}

          {/* ── Navigation ─────────────────── */}
          {step !== 'done' && (
            <div className="diag-nav">
              {step !== 'contact'
                ? <button type="button" className="diag-nav__back" onClick={goBack} disabled={saving}>← Voltar</button>
                : <span />}
              <button type="button" className="diag-nav__next" onClick={goNext} disabled={saving}>
                {saving ? 'Salvando...' : nextLabel}
              </button>
            </div>
          )}
        </div>

        {/* ── Progress dots ────────────────── */}
        {step !== 'done' && (
          <div className="diag-dots">
            {Array.from({ length: tot }).map((_, i) => (
              <span key={i} className={`diag-dot${i < cur ? ' done' : ''}${i === cur - 1 ? ' current' : ''}`} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
