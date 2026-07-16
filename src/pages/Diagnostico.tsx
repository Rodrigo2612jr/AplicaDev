import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import logoIcon from '../assets/logo-icon-clean.png'
import { upsertLead } from '../lib/db'
import type { LeadDados, UtmDados, Rec } from '../lib/db'
import { recommend, classifyLead, generateTravas } from '../lib/diagnosis'
import { buildKanbanPayload, pushLeadToKanban } from '../lib/kanban'

/* ═══════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════ */
type StepKey =
  | 'intro' | 'negocio' | 'porte' | 'aquisicao' | 'agenda'
  | 'gestao' | 'recorrencia' | 'gargalo' | 'contato' | 'filtro' | 'done'

const STEPS: StepKey[] = [
  'intro', 'negocio', 'porte', 'aquisicao', 'agenda',
  'gestao', 'recorrencia', 'gargalo', 'contato', 'filtro', 'done',
]

interface FD {
  // contato
  nome: string; whatsapp: string; nomeEmpresa: string
  // negócio
  empresaTipo: string; nicho: string; serviceChoice: string
  // porte
  clientesMes: string; ticketMedio: string
  // aquisição
  canais: string[]; googleResultado: string
  // agenda
  agendaMetodo: string; lembreteAuto: string
  // gestão
  visibilidadeFinanceira: string; baseClientes: string[]
  // recorrência
  recorrencia: string; reativacao: string
  // gargalo
  donoGargalo: string; horasWhatsapp: string
  // filtro comercial
  orcamento: string; decisor: string; urgencia: string; perdaRecente: string
}

const INIT: FD = {
  nome: '', whatsapp: '', nomeEmpresa: '',
  empresaTipo: '', nicho: '', serviceChoice: '',
  clientesMes: '', ticketMedio: '',
  canais: [], googleResultado: '',
  agendaMetodo: '', lembreteAuto: '',
  visibilidadeFinanceira: '', baseClientes: [],
  recorrencia: '', reativacao: '',
  donoGargalo: '', horasWhatsapp: '',
  orcamento: '', decisor: '', urgencia: '', perdaRecente: '',
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION / VALIDATION
═══════════════════════════════════════════════════════════════ */
function idx(step: StepKey) { return STEPS.indexOf(step) }
function getNext(step: StepKey): StepKey { return STEPS[Math.min(idx(step) + 1, STEPS.length - 1)] }
function getPrev(step: StepKey): StepKey { return STEPS[Math.max(idx(step) - 1, 0)] }

function canAdvance(step: StepKey, d: FD): boolean {
  switch (step) {
    case 'intro': return true
    case 'negocio': return d.empresaTipo !== '' && d.nicho.trim().length > 1
    case 'porte': return d.clientesMes !== '' && d.ticketMedio !== ''
    case 'aquisicao': return d.canais.length > 0 && d.googleResultado !== ''
    case 'agenda': return d.agendaMetodo !== '' && (d.agendaMetodo === 'nao-agenda' || d.lembreteAuto !== '')
    case 'gestao': return d.visibilidadeFinanceira !== '' && d.baseClientes.length > 0
    case 'recorrencia': return d.recorrencia !== ''
    case 'gargalo': return d.donoGargalo !== ''
    case 'contato': return d.nome.trim().length > 1 && d.whatsapp.replace(/\D/g, '').length >= 10
    case 'filtro': return d.orcamento !== '' && d.decisor !== '' && d.urgencia !== ''
    default: return true
  }
}

function progress(step: StepKey): { cur: number; tot: number } {
  // conta só as telas de conteúdo (fora intro e done)
  const content = STEPS.length - 2
  const i = idx(step)
  const cur = Math.min(Math.max(i, 1), content)
  return { cur, tot: content }
}

/* ═══════════════════════════════════════════════════════════════
   DADOS builder + WhatsApp + tracking
═══════════════════════════════════════════════════════════════ */
function toDados(d: FD): LeadDados {
  return {
    serviceChoice: d.serviceChoice,
    empresaTipo: d.empresaTipo, nicho: d.nicho,
    clientesMes: d.clientesMes, ticketMedio: d.ticketMedio,
    canais: d.canais, googleResultado: d.googleResultado,
    agendaMetodo: d.agendaMetodo, lembreteAuto: d.lembreteAuto,
    visibilidadeFinanceira: d.visibilidadeFinanceira, baseClientes: d.baseClientes,
    recorrencia: d.recorrencia, reativacao: d.reativacao,
    donoGargalo: d.donoGargalo, horasWhatsapp: d.horasWhatsapp,
    orcamento: d.orcamento, decisor: d.decisor, urgencia: d.urgencia, perdaRecente: d.perdaRecente,
  }
}

const WA_NUMBER = '5588998030247'

function buildLeadMsg(d: FD, rec: Rec, temperatura: string): string {
  const recLabel: Record<Rec, string> = { site: 'um Site', sistema: 'um Sistema', app: 'um App' }
  const lines = [
    `Olá! Me chamo *${d.nome}*${d.nomeEmpresa ? ` (*${d.nomeEmpresa}*)` : ''}.`,
    ``,
    `Acabei de fazer o diagnóstico gratuito no site da AplicaDev e quero ver como destravar meu negócio.`,
    ``,
    `— Ramo: ${d.nicho || '-'}`,
    `— Atendo: ${d.clientesMes || '-'} clientes/mês`,
    `— O que faz mais sentido pra mim: ${recLabel[rec]}`,
    ``,
    `Fico no aguardo! 🙏`,
    ``,
    `_[interno ${temperatura}]_`,
  ]
  return encodeURIComponent(lines.join('\n'))
}

/** Dispara evento de conversão de forma DEFENSIVA (não quebra sem pixel). */
function fireEvent(name: string, params: Record<string, unknown>) {
  try {
    const w = window as unknown as {
      fbq?: (...a: unknown[]) => void
      gtag?: (...a: unknown[]) => void
      dataLayer?: unknown[]
    }
    if (typeof w.fbq === 'function') w.fbq('track', name === 'lead' ? 'Lead' : 'ViewContent', params)
    if (name === 'lead' && typeof w.gtag === 'function') w.gtag('event', 'generate_lead', params)
    ;(w.dataLayer = w.dataLayer || []).push({ event: name === 'lead' ? 'lead_diagnostico' : 'view_diagnostico', ...params })
  } catch { /* nunca quebrar o fluxo por causa de tracking */ }
}

function readUtms(): UtmDados {
  const u: UtmDados = {}
  try {
    // App usa HashRouter: a query pode chegar em location.search (?x#/rota)
    // OU dentro do hash (#/rota?x). Lê dos dois pra não perder atribuição.
    const search = new URLSearchParams(window.location.search)
    const hash = window.location.hash
    const hashQuery = new URLSearchParams(hash.includes('?') ? hash.slice(hash.indexOf('?')) : '')
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'] as const) {
      const v = search.get(k) || hashQuery.get(k)
      if (v) u[k] = v
    }
  } catch { /* ignore */ }
  return u
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

function Q({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="diag-q">
      <div className="diag-q__label">{label}</div>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Diagnostico() {
  const [step, setStep] = useState<StepKey>('intro')
  const [data, setData] = useState<FD>(INIT)
  const [animKey, setAnimKey] = useState(0)
  const [animBwd, setAnimBwd] = useState(false)
  const [shake, setShake] = useState(false)
  const [saving, setSaving] = useState(false)

  const leadId = useRef<string>(cryptoId())
  const utm = useRef<UtmDados>({})
  const finalRec = useRef<Rec>('site')
  const finalTemp = useRef<string>('MORNO')
  const doneFired = useRef(false)

  // captura UTMs + evento de início uma vez
  useEffect(() => {
    utm.current = readUtms()
    fireEvent('view', { page: 'diagnostico' })
  }, [])

  // dispara conversão ao chegar no done
  useEffect(() => {
    if (step === 'done' && !doneFired.current) {
      doneFired.current = true
      fireEvent('lead', {
        value: 999.9, // valor-piso do lead pro pixel (ROAS real é calculado na conversão de venda)
        currency: 'BRL',
        rec: finalRec.current,
        temperatura: finalTemp.current,
        orcamento: data.orcamento,
      })
    }
  }, [step, data])

  const set = (f: keyof FD, v: unknown) => setData(d => ({ ...d, [f]: v }))
  const toggle = (field: 'canais' | 'baseClientes', val: string) => setData(d => ({
    ...d,
    [field]: d[field].includes(val) ? d[field].filter(c => c !== val) : [...d[field], val],
  }))

  const persist = async (status: 'parcial' | 'completo') => {
    const dados = toDados(data)
    const rec = recommend(dados)
    finalRec.current = rec
    const payload = {
      id: leadId.current,
      nome: data.nome, whatsapp: data.whatsapp, nome_empresa: data.nomeEmpresa,
      rec, dados, status, utm: utm.current,
    }
    if (status === 'completo') {
      const cls = classifyLead(dados)
      finalTemp.current = cls.temperatura
      const res = await upsertLead({ ...payload, temperatura: cls.temperatura, score: cls.score })
      // espelha no sistema (Kanban) — fire-and-forget, não bloqueia nem quebra o fluxo
      void pushLeadToKanban(buildKanbanPayload({
        nome: data.nome, whatsapp: data.whatsapp, nomeEmpresa: data.nomeEmpresa,
        dados, rec, utm: utm.current,
      }))
      return res
    }
    return upsertLead(payload)
  }

  const goNext = async () => {
    if (!canAdvance(step, data)) {
      setShake(true); setTimeout(() => setShake(false), 500); return
    }
    // salva parcial ao sair do contato (rede de segurança antes do filtro)
    if (step === 'contato') {
      setSaving(true)
      const { error } = await persist('parcial')
      setSaving(false)
      if (error) console.error('[Diagnostico] parcial:', error)
    }
    // salva completo ao sair do filtro
    if (step === 'filtro') {
      setSaving(true)
      const { error } = await persist('completo')
      setSaving(false)
      if (error) console.error('[Diagnostico] completo:', error)
    }
    setAnimBwd(false); setAnimKey(k => k + 1); setStep(getNext(step))
  }

  const goBack = () => {
    setAnimBwd(true); setAnimKey(k => k + 1); setStep(getPrev(step))
  }

  const { cur, tot } = progress(step)
  const pct = step === 'done' ? 100 : step === 'intro' ? 0 : Math.round((cur / tot) * 100)
  const travas = step === 'done' ? generateTravas(toDados(data)) : []
  const waUrl = `https://wa.me/${WA_NUMBER}?text=${buildLeadMsg(data, finalRec.current, finalTemp.current)}`

  const nextLabel = step === 'intro' ? 'Começar meu diagnóstico →'
    : step === 'contato' ? 'Continuar →'
    : step === 'filtro' ? 'Ver meu diagnóstico →'
    : 'Continuar →'

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

          {/* ── INTRO ── */}
          {step === 'intro' && (
            <div className="diag-intro">
              <span className="diag-intro__badge"><span className="dot" /> Diagnóstico gratuito · 90 segundos</span>
              <h1 className="diag-intro__title">
                Seu negócio está deixando <span className="grad">dinheiro na mesa</span> — e você nem percebe
              </h1>
              <p className="diag-intro__sub">
                Responde algumas perguntas rápidas sobre o seu dia a dia e a gente te mostra as travas que estão
                segurando seu crescimento. Site, app ou sistema sob medida, entrega em até <strong>10 dias</strong>,
                a partir de <strong>R$999,90</strong>.
              </p>
              <div className="diag-intro__proof">
                ⚡ Já colocamos dezenas de negócios no ar em até 10 dias — sem enrolação e sem termo técnico.
              </div>
            </div>
          )}

          {/* ── NEGÓCIO ── */}
          {step === 'negocio' && (
            <div className="diag-step">
              <StepHead emoji="🏢" title="Primeiro, me conta do seu negócio" sub="Pra gente falar a sua língua e trazer exemplos do seu setor." />
              <div className="diag-section">
                <Q label="Que tipo de negócio é o seu?">
                  <div className="diag-opts-col">
                    <Opt label="Prestador de serviço" selected={data.empresaTipo === 'prestador'} onClick={() => set('empresaTipo', 'prestador')} />
                    <Opt label="Loja física" selected={data.empresaTipo === 'loja-fisica'} onClick={() => set('empresaTipo', 'loja-fisica')} />
                    <Opt label="Loja online / e-commerce" selected={data.empresaTipo === 'loja-online'} onClick={() => set('empresaTipo', 'loja-online')} />
                    <Opt label="Restaurante / food" selected={data.empresaTipo === 'restaurante'} onClick={() => set('empresaTipo', 'restaurante')} />
                    <Opt label="Clínica / saúde / estética / beleza" selected={data.empresaTipo === 'clinica'} onClick={() => set('empresaTipo', 'clinica')} />
                    <Opt label="Vendo pra outras empresas (B2B)" selected={data.empresaTipo === 'b2b'} onClick={() => set('empresaTipo', 'b2b')} />
                    <Opt label="Outro" selected={data.empresaTipo === 'outro'} onClick={() => set('empresaTipo', 'outro')} />
                  </div>
                </Q>
                <Q label="Qual o ramo? (ex: barbearia, clínica, pet shop, restaurante...)">
                  <input className="diag-input" type="text" placeholder="Escreve aqui o seu ramo" value={data.nicho} onChange={e => set('nicho', e.target.value)} />
                </Q>
                <Q label="Você já tem um palpite do que resolveria? (opcional)">
                  <div className="diag-opts-col">
                    <Opt label="Acho que é um site" selected={data.serviceChoice === 'site'} onClick={() => set('serviceChoice', 'site')} />
                    <Opt label="Acho que é um app" selected={data.serviceChoice === 'app'} onClick={() => set('serviceChoice', 'app')} />
                    <Opt label="Acho que é um sistema pra organizar tudo" selected={data.serviceChoice === 'sistema'} onClick={() => set('serviceChoice', 'sistema')} />
                    <Opt label="Não faço ideia — quero que vocês me digam" selected={data.serviceChoice === 'nao-sei'} onClick={() => set('serviceChoice', 'nao-sei')} />
                  </div>
                </Q>
              </div>
            </div>
          )}

          {/* ── PORTE ── */}
          {step === 'porte' && (
            <div className="diag-step">
              <StepHead emoji="📊" title="Seu negócio em números" sub="Nada de conta difícil — só o que você já sabe de cabeça." />
              <div className="diag-section">
                <Q label="Quantos clientes você atende num mês normal?">
                  <div className="diag-opts-row">
                    <Opt label="Até 20" selected={data.clientesMes === 'ate-20'} onClick={() => set('clientesMes', 'ate-20')} />
                    <Opt label="20 a 50" selected={data.clientesMes === '20-50'} onClick={() => set('clientesMes', '20-50')} />
                    <Opt label="50 a 100" selected={data.clientesMes === '50-100'} onClick={() => set('clientesMes', '50-100')} />
                    <Opt label="Mais de 100" selected={data.clientesMes === '100+'} onClick={() => set('clientesMes', '100+')} />
                    <Opt label="Não sei dizer" selected={data.clientesMes === 'nao-sei'} onClick={() => set('clientesMes', 'nao-sei')} />
                  </div>
                </Q>
                <Q label="Quanto um cliente gasta com você, em média?">
                  <div className="diag-opts-row">
                    <Opt label="Até R$50" selected={data.ticketMedio === 'ate-50'} onClick={() => set('ticketMedio', 'ate-50')} />
                    <Opt label="R$50 a R$150" selected={data.ticketMedio === '50-150'} onClick={() => set('ticketMedio', '50-150')} />
                    <Opt label="R$150 a R$500" selected={data.ticketMedio === '150-500'} onClick={() => set('ticketMedio', '150-500')} />
                    <Opt label="R$500 a R$2 mil" selected={data.ticketMedio === '500-2k'} onClick={() => set('ticketMedio', '500-2k')} />
                    <Opt label="Acima de R$2 mil" selected={data.ticketMedio === '2k+'} onClick={() => set('ticketMedio', '2k+')} />
                  </div>
                </Q>
              </div>
            </div>
          )}

          {/* ── AQUISIÇÃO ── */}
          {step === 'aquisicao' && (
            <div className="diag-step">
              <StepHead emoji="🎯" title="Como um cliente novo chega até você" sub="Pra entender de onde vem (ou não vem) a sua demanda." />
              <div className="diag-section">
                <Q label="Como um cliente NOVO costuma te achar hoje? (marque todos)">
                  <div className="diag-opts-multi">
                    <Multi icon="🗣️" label="Indicação / boca a boca" selected={data.canais.includes('indicacao')} onClick={() => toggle('canais', 'indicacao')} />
                    <Multi icon="📸" label="Instagram" selected={data.canais.includes('instagram')} onClick={() => toggle('canais', 'instagram')} />
                    <Multi icon="🔍" label="Google" selected={data.canais.includes('google')} onClick={() => toggle('canais', 'google')} />
                    <Multi icon="📍" label="Passa na frente / ponto" selected={data.canais.includes('ponto')} onClick={() => toggle('canais', 'ponto')} />
                    <Multi icon="💬" label="WhatsApp" selected={data.canais.includes('whatsapp')} onClick={() => toggle('canais', 'whatsapp')} />
                    <Multi icon="📢" label="Anúncio pago" selected={data.canais.includes('anuncio')} onClick={() => toggle('canais', 'anuncio')} />
                  </div>
                </Q>
                <Q label="Se eu jogar o nome do seu negócio no Google agora, o que aparece?">
                  <div className="diag-opts-col">
                    <Opt label="Meu site" selected={data.googleResultado === 'site'} onClick={() => set('googleResultado', 'site')} />
                    <Opt label="Só meu Instagram" selected={data.googleResultado === 'so-insta'} onClick={() => set('googleResultado', 'so-insta')} />
                    <Opt label="Só o Google Maps" selected={data.googleResultado === 'so-maps'} onClick={() => set('googleResultado', 'so-maps')} />
                    <Opt label="Não aparece nada" selected={data.googleResultado === 'nada'} onClick={() => set('googleResultado', 'nada')} />
                    <Opt label="Nunca testei" selected={data.googleResultado === 'nunca-testei'} onClick={() => set('googleResultado', 'nunca-testei')} />
                  </div>
                </Q>
              </div>
            </div>
          )}

          {/* ── AGENDA ── */}
          {step === 'agenda' && (
            <div className="diag-step">
              <StepHead emoji="🗓️" title="O corre do dia a dia" sub="Como funciona a sua rotina com o cliente." />
              <div className="diag-section">
                <Q label="Como você marca um horário ou compromisso com o cliente?">
                  <div className="diag-opts-col">
                    <Opt label="Caderno / agenda de papel" selected={data.agendaMetodo === 'caderno'} onClick={() => set('agendaMetodo', 'caderno')} />
                    <Opt label="Pelo WhatsApp mesmo" selected={data.agendaMetodo === 'whatsapp'} onClick={() => set('agendaMetodo', 'whatsapp')} />
                    <Opt label="Planilha" selected={data.agendaMetodo === 'planilha'} onClick={() => set('agendaMetodo', 'planilha')} />
                    <Opt label="Uso um app/sistema de agendamento" selected={data.agendaMetodo === 'app'} onClick={() => set('agendaMetodo', 'app')} />
                    <Opt label="Não trabalho com horário marcado" selected={data.agendaMetodo === 'nao-agenda'} onClick={() => set('agendaMetodo', 'nao-agenda')} />
                  </div>
                </Q>
                {data.agendaMetodo !== 'nao-agenda' && (
                  <Q label="Você manda lembrete pro cliente antes do horário?">
                    <div className="diag-opts-col">
                      <Opt label="Não mando" selected={data.lembreteAuto === 'nao'} onClick={() => set('lembreteAuto', 'nao')} />
                      <Opt label="Mando na mão quando lembro" selected={data.lembreteAuto === 'manual'} onClick={() => set('lembreteAuto', 'manual')} />
                      <Opt label="É automático" selected={data.lembreteAuto === 'automatico'} onClick={() => set('lembreteAuto', 'automatico')} />
                    </div>
                  </Q>
                )}
              </div>
            </div>
          )}

          {/* ── GESTÃO ── */}
          {step === 'gestao' && (
            <div className="diag-step">
              <StepHead emoji="💰" title="Controle do dinheiro e das informações" sub="A parte que quase ninguém para pra olhar." />
              <div className="diag-section">
                <Q label="Como você sabe quanto vendeu esse mês?">
                  <div className="diag-opts-col">
                    <Opt label="De cabeça / no olho" selected={data.visibilidadeFinanceira === 'olho'} onClick={() => set('visibilidadeFinanceira', 'olho')} />
                    <Opt label="Anoto num caderno" selected={data.visibilidadeFinanceira === 'caderno'} onClick={() => set('visibilidadeFinanceira', 'caderno')} />
                    <Opt label="Tenho uma planilha" selected={data.visibilidadeFinanceira === 'planilha'} onClick={() => set('visibilidadeFinanceira', 'planilha')} />
                    <Opt label="Um sistema me mostra" selected={data.visibilidadeFinanceira === 'sistema'} onClick={() => set('visibilidadeFinanceira', 'sistema')} />
                  </div>
                </Q>
                <Q label="Onde ficam guardadas as informações dos seus clientes? (marque todos)">
                  <div className="diag-opts-multi">
                    <Multi icon="🧠" label="Na minha cabeça" selected={data.baseClientes.includes('cabeca')} onClick={() => toggle('baseClientes', 'cabeca')} />
                    <Multi icon="💬" label="No meu WhatsApp" selected={data.baseClientes.includes('whatsapp')} onClick={() => toggle('baseClientes', 'whatsapp')} />
                    <Multi icon="📔" label="Caderno / papel" selected={data.baseClientes.includes('papel')} onClick={() => toggle('baseClientes', 'papel')} />
                    <Multi icon="📊" label="Planilha" selected={data.baseClientes.includes('planilha')} onClick={() => toggle('baseClientes', 'planilha')} />
                    <Multi icon="🗂️" label="Um sistema / CRM" selected={data.baseClientes.includes('crm')} onClick={() => toggle('baseClientes', 'crm')} />
                  </div>
                </Q>
              </div>
            </div>
          )}

          {/* ── RECORRÊNCIA ── */}
          {step === 'recorrencia' && (
            <div className="diag-step">
              <StepHead emoji="🔁" title="Depois que o cliente compra a primeira vez" sub="O dinheiro mais barato de todos: quem já te conhece." />
              <div className="diag-section">
                <Q label="Um cliente que compra ou atende uma vez costuma voltar?">
                  <div className="diag-opts-col">
                    <Opt label="Sempre volta" selected={data.recorrencia === 'sempre'} onClick={() => set('recorrencia', 'sempre')} />
                    <Opt label="Às vezes" selected={data.recorrencia === 'as-vezes'} onClick={() => set('recorrencia', 'as-vezes')} />
                    <Opt label="Quase nunca" selected={data.recorrencia === 'quase-nunca'} onClick={() => set('recorrencia', 'quase-nunca')} />
                    <Opt label="Não sei dizer" selected={data.recorrencia === 'nao-sei'} onClick={() => set('recorrencia', 'nao-sei')} />
                  </div>
                </Q>
                <Q label="Consegue avisar seus clientes antigos quando tem novidade ou promoção? (opcional)">
                  <div className="diag-opts-col">
                    <Opt label="Sim, tenho a lista organizada" selected={data.reativacao === 'lista'} onClick={() => set('reativacao', 'lista')} />
                    <Opt label="Posto no Instagram e torço" selected={data.reativacao === 'posta-torce'} onClick={() => set('reativacao', 'posta-torce')} />
                    <Opt label="Não tenho os contatos juntos num lugar" selected={data.reativacao === 'nao-tenho-junto'} onClick={() => set('reativacao', 'nao-tenho-junto')} />
                  </div>
                </Q>
              </div>
            </div>
          )}

          {/* ── GARGALO ── */}
          {step === 'gargalo' && (
            <div className="diag-step">
              <StepHead emoji="🏝️" title="Se você desse uma sumida..." sub="Vamos ver o quanto o negócio depende de você." />
              <div className="diag-section">
                <Q label="Se você tirasse 1 semana de férias amanhã, sem preparar nada, o negócio rodava sozinho?">
                  <div className="diag-opts-col">
                    <Opt label="Rodava tranquilo" selected={data.donoGargalo === 'tranquilo'} onClick={() => set('donoGargalo', 'tranquilo')} />
                    <Opt label="Rodava meio capengando" selected={data.donoGargalo === 'capengando'} onClick={() => set('donoGargalo', 'capengando')} />
                    <Opt label="Metade das coisas parava" selected={data.donoGargalo === 'metade-para'} onClick={() => set('donoGargalo', 'metade-para')} />
                    <Opt label="Parava quase tudo" selected={data.donoGargalo === 'para-tudo'} onClick={() => set('donoGargalo', 'para-tudo')} />
                  </div>
                </Q>
                <Q label="Quanto do seu dia vai em responder cliente no WhatsApp? (opcional)">
                  <div className="diag-opts-row">
                    <Opt label="Menos de 1h" selected={data.horasWhatsapp === 'menos-1h'} onClick={() => set('horasWhatsapp', 'menos-1h')} />
                    <Opt label="1 a 2h" selected={data.horasWhatsapp === '1-2h'} onClick={() => set('horasWhatsapp', '1-2h')} />
                    <Opt label="2 a 4h" selected={data.horasWhatsapp === '2-4h'} onClick={() => set('horasWhatsapp', '2-4h')} />
                    <Opt label="Mais de 4h" selected={data.horasWhatsapp === 'mais-4h'} onClick={() => set('horasWhatsapp', 'mais-4h')} />
                  </div>
                </Q>
              </div>
            </div>
          )}

          {/* ── CONTATO ── */}
          {step === 'contato' && (
            <div className="diag-step">
              <StepHead emoji="✅" title="Boa! Já entendi bastante do seu negócio" sub="Pra onde mando o seu diagnóstico completo?" />
              <div className="diag-fields">
                <div className="diag-field">
                  <label className="diag-label">Como você quer que a gente te chame?</label>
                  <input className="diag-input" type="text" placeholder="Seu nome" value={data.nome} onChange={e => set('nome', e.target.value)} autoFocus />
                </div>
                <div className="diag-field">
                  <label className="diag-label">Seu WhatsApp <span className="diag-hint">(é por onde mandamos o diagnóstico)</span></label>
                  <input className="diag-input" type="tel" placeholder="(88) 9 9999-9999" value={data.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
                </div>
                <div className="diag-field">
                  <label className="diag-label">Nome da empresa <span className="diag-hint">(opcional)</span></label>
                  <input className="diag-input" type="text" placeholder="Sua empresa ou marca" value={data.nomeEmpresa} onChange={e => set('nomeEmpresa', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── FILTRO ── */}
          {step === 'filtro' && (
            <div className="diag-step">
              <StepHead emoji="🎯" title="Última parte: o que separa quem tá curioso de quem quer resolver de verdade" sub="Só pra montar a proposta certa pro seu momento — nossos projetos começam em R$999,90." />
              <div className="diag-section">
                <Q label="Pra entregar a solução completa que resolve isso, quanto faz sentido investir agora?">
                  <div className="diag-opts-col">
                    <Opt label="A partir de R$999 — quero começar enxuto" selected={data.orcamento === 'ate-1k'} onClick={() => set('orcamento', 'ate-1k')} />
                    <Opt label="R$1 mil a R$3 mil" selected={data.orcamento === '1-3k'} onClick={() => set('orcamento', '1-3k')} />
                    <Opt label="R$3 mil a R$10 mil" selected={data.orcamento === '3-10k'} onClick={() => set('orcamento', '3-10k')} />
                    <Opt label="Acima de R$10 mil" selected={data.orcamento === '10k+'} onClick={() => set('orcamento', '10k+')} />
                    <Opt label="Só quero entender primeiro" selected={data.orcamento === 'so-entender'} onClick={() => set('orcamento', 'so-entender')} />
                  </div>
                </Q>
                <Q label="Quem bate o martelo numa decisão dessas no seu negócio?">
                  <div className="diag-opts-col">
                    <Opt label="Sou eu, decido sozinho" selected={data.decisor === 'sozinho'} onClick={() => set('decisor', 'sozinho')} />
                    <Opt label="Eu e mais um sócio" selected={data.decisor === 'socio'} onClick={() => set('decisor', 'socio')} />
                    <Opt label="Preciso alinhar com sócio/família antes" selected={data.decisor === 'alinhar'} onClick={() => set('decisor', 'alinhar')} />
                    <Opt label="Não sou eu — pesquiso pra empresa/meu chefe" selected={data.decisor === 'nao-sou-eu'} onClick={() => set('decisor', 'nao-sou-eu')} />
                  </div>
                </Q>
                <Q label="Pra quando você quer isso de pé?">
                  <div className="diag-opts-col">
                    <Opt label="Pra ontem — já tô perdendo dinheiro" selected={data.urgencia === 'ontem'} onClick={() => set('urgencia', 'ontem')} />
                    <Opt label="Nas próximas semanas" selected={data.urgencia === 'semanas'} onClick={() => set('urgencia', 'semanas')} />
                    <Opt label="Nos próximos meses" selected={data.urgencia === 'meses'} onClick={() => set('urgencia', 'meses')} />
                    <Opt label="Só pesquisando por enquanto" selected={data.urgencia === 'pesquisando'} onClick={() => set('urgencia', 'pesquisando')} />
                  </div>
                </Q>
                <Q label="Nos últimos 30 dias, você perdeu algum cliente ou venda por algum desses motivos? (opcional)">
                  <div className="diag-opts-row">
                    <Opt label="Sim, e me incomodou" selected={data.perdaRecente === 'sim'} onClick={() => set('perdaRecente', 'sim')} />
                    <Opt label="Acho que sim" selected={data.perdaRecente === 'acho'} onClick={() => set('perdaRecente', 'acho')} />
                    <Opt label="Não que eu tenha percebido" selected={data.perdaRecente === 'nao-percebi'} onClick={() => set('perdaRecente', 'nao-percebi')} />
                  </div>
                </Q>
              </div>
            </div>
          )}

          {/* ── DONE — mini-diagnóstico ── */}
          {step === 'done' && (
            <div className="diag-result">
              <div className="diag-result__top">
                <div className="diag-result__icon">🔎</div>
                <h1 className="diag-result__title">Pronto, {data.nome.split(' ')[0] || 'tudo certo'}! Já dá pra ver algumas travas</h1>
                <p className="diag-result__desc">
                  Só com o que você respondeu, identificamos alguns pontos que estão segurando o seu crescimento
                  {data.nomeEmpresa ? ` na ${data.nomeEmpresa}` : ''}:
                </p>
              </div>

              <div className="diag-travas">
                {travas.map((t, i) => (
                  <div key={i} className="diag-trava">
                    <span className="diag-trava__num">{i + 1}</span>
                    <div className="diag-trava__body">
                      <div className="diag-trava__title">{t.titulo}</div>
                      <div className="diag-trava__desc">{t.detalhe}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="diag-result__box">
                <div className="diag-result__service-name">💡 A boa notícia</div>
                <p className="diag-result__cta-copy">
                  Cada uma dessas travas tem solução — e a gente já sabe exatamente como destravar no seu caso.
                  Chama no WhatsApp que eu te mostro o passo a passo (e quanto isso tá te custando por mês).
                </p>
              </div>

              <div className="diag-result__actions">
                <a href={waUrl} target="_blank" rel="noopener noreferrer" className="diag-cta-wa">
                  💬 Quero destravar meu negócio
                </a>
                <Link to="/" className="diag-cta-back">← Voltar ao site</Link>
              </div>

              <div className="diag-result__note">
                Sem compromisso. Você fala direto com quem vai desenvolver — sem call center, sem enrolação.
              </div>
            </div>
          )}

          {/* ── NAV ── */}
          {step !== 'done' && (
            <div className="diag-nav">
              {step !== 'intro'
                ? <button type="button" className="diag-nav__back" onClick={goBack} disabled={saving}>← Voltar</button>
                : <span />}
              <button type="button" className="diag-nav__next" onClick={goNext} disabled={saving}>
                {saving ? 'Salvando...' : nextLabel}
              </button>
            </div>
          )}
        </div>

        {/* dots */}
        {step !== 'done' && step !== 'intro' && (
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

/* ── helpers ── */
function StepHead({ emoji, title, sub }: { emoji: string; title: string; sub: string }) {
  return (
    <div className="diag-step__head">
      <span className="diag-step__emoji">{emoji}</span>
      <h1 className="diag-step__title">{title}</h1>
      <p className="diag-step__sub">{sub}</p>
    </div>
  )
}

function cryptoId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch { /* fallback abaixo */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
