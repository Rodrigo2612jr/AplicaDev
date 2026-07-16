import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logoIcon from '../assets/logo-icon-clean.png'
import { supabase } from '../lib/supabase'
import { fetchLeads, deleteLead } from '../lib/db'
import type { Lead, Rec, Temperatura } from '../lib/db'
import { generateDiagnosis } from '../lib/diagnosis'

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const REC_INFO: Record<Rec, { icon: string; title: string; color: string }> = {
  site: { icon: '🌐', title: 'Site de Alta Conversão', color: '#1ab7ab' },
  sistema: { icon: '⚙️', title: 'Sistema sob Medida', color: '#7c3aed' },
  app: { icon: '📱', title: 'Aplicativo Mobile', color: '#f59e0b' },
}

const TEMP_INFO: Record<Temperatura, { label: string; color: string; emoji: string }> = {
  QUENTE: { label: 'Quente', color: '#ef4444', emoji: '🔥' },
  MORNO: { label: 'Morno', color: '#f59e0b', emoji: '🌤️' },
  FRIO: { label: 'Frio', color: '#3b82f6', emoji: '❄️' },
}

function utmSummary(lead: Lead): string {
  const u = lead.utm
  if (!u) return ''
  const parts = [u.utm_source, u.utm_campaign, u.utm_content].filter(Boolean)
  return parts.join(' · ')
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN PANEL
═══════════════════════════════════════════════════════════════ */
export default function Admin() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [recFilter, setRecFilter] = useState<Rec | 'all'>('all')
  const [tempFilter, setTempFilter] = useState<Temperatura | 'all'>('all')
  const [loadError, setLoadError] = useState('')
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate('/login', { replace: true })
      else setAuthChecked(true)
    })
  }, [navigate])

  useEffect(() => {
    if (!authChecked) return
    fetchLeads().then(({ data, error }) => {
      if (error) setLoadError(error)
      else setLeads(data)
    })
  }, [authChecked])

  const filtered = leads.filter(l => {
    if (recFilter !== 'all' && l.rec !== recFilter) return false
    if (tempFilter !== 'all') {
      const t = l.temperatura ?? generateDiagnosis(l).temperatura
      if (t !== tempFilter) return false
    }
    return true
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este lead?')) return
    const { error } = await deleteLead(id)
    if (!error) setLeads(prev => prev.filter(l => l.id !== id))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (!authChecked) return null

  const counts = {
    QUENTE: leads.filter(l => (l.temperatura ?? generateDiagnosis(l).temperatura) === 'QUENTE').length,
    MORNO: leads.filter(l => (l.temperatura ?? generateDiagnosis(l).temperatura) === 'MORNO').length,
    FRIO: leads.filter(l => (l.temperatura ?? generateDiagnosis(l).temperatura) === 'FRIO').length,
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link to="/" className="diag-logo">
          <img src={logoIcon} alt="AplicaDev" />
          <span>Aplica<strong>Dev</strong></span>
        </Link>
        <h1 className="admin-title">Painel de Leads</h1>
        <div className="admin-header__right">
          <span className="admin-count">{leads.length} lead{leads.length !== 1 ? 's' : ''}</span>
          <button className="admin-logout" onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <div className="admin-toolbar">
        <div className="admin-filters">
          {(['all', 'site', 'sistema', 'app'] as const).map(f => (
            <button key={f} className={`admin-filter${recFilter === f ? ' active' : ''}`} onClick={() => setRecFilter(f)}>
              {f === 'all' ? 'Todos os tipos' : REC_INFO[f].icon + ' ' + REC_INFO[f].title}
            </button>
          ))}
        </div>
        <div className="admin-filters">
          <button className={`admin-filter${tempFilter === 'all' ? ' active' : ''}`} onClick={() => setTempFilter('all')}>
            Todas as temperaturas
          </button>
          {(['QUENTE', 'MORNO', 'FRIO'] as const).map(t => (
            <button key={t} className={`admin-filter${tempFilter === t ? ' active' : ''}`}
              onClick={() => setTempFilter(t)}
              style={tempFilter === t ? { borderColor: TEMP_INFO[t].color, color: TEMP_INFO[t].color } : {}}>
              {TEMP_INFO[t].emoji} {TEMP_INFO[t].label} ({counts[t]})
            </button>
          ))}
        </div>
      </div>

      {loadError && <div className="admin-error">Erro ao carregar leads: {loadError}</div>}

      {filtered.length === 0 && !loadError ? (
        <div className="admin-empty">
          <span className="admin-empty__icon">📋</span>
          <p>Nenhum lead por aqui.</p>
          <p className="admin-empty__sub">Quando alguém completar o diagnóstico, aparece aqui.</p>
        </div>
      ) : (
        <div className="admin-list">
          {filtered.map((lead) => {
            const ri = REC_INFO[lead.rec]
            const diag = generateDiagnosis(lead)
            const temp = lead.temperatura ?? diag.temperatura
            const ti = TEMP_INFO[temp]
            const isOpen = expanded === lead.id
            const isParcial = lead.status === 'parcial'
            const date = new Date(lead.created_at)
            const dateStr = date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            const origem = utmSummary(lead)

            const waMsg = [
              `Olá ${lead.nome}! Aqui é da AplicaDev.`,
              ``,
              `Analisei seu diagnóstico e preparei uma proposta de *${ri.title}* pro seu negócio.`,
              ``,
              `Podemos conversar agora?`,
            ].join('\n')
            const waContact = `https://wa.me/${lead.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`

            return (
              <div key={lead.id} className={`admin-card${isOpen ? ' open' : ''}`}>
                <button className="admin-card__header" onClick={() => setExpanded(isOpen ? null : lead.id)}>
                  <div className="admin-card__left">
                    <span className="admin-card__rec" style={{ background: `${ri.color}18`, color: ri.color, borderColor: `${ri.color}30` }}>
                      {ri.icon} {ri.title}
                    </span>
                    <strong className="admin-card__name">{lead.nome}</strong>
                    {lead.nome_empresa && <span className="admin-card__empresa">{lead.nome_empresa}</span>}
                    <span className="admin-card__phone">{lead.whatsapp}</span>
                    {isParcial && <span className="admin-card__parcial">⚠ parcial</span>}
                  </div>
                  <div className="admin-card__right">
                    <span className="admin-card__temp" style={{ color: ti.color, borderColor: ti.color + '55', background: ti.color + '14' }}>
                      {ti.emoji} {ti.label} · {lead.score ?? diag.score}/15
                    </span>
                    <span className="admin-card__date">{dateStr}</span>
                    <span className="admin-card__chevron">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="admin-card__body">
                    {origem && <div className="admin-origem">🎯 Origem: {origem}</div>}

                    <div className="admin-diag-section">
                      <h3>📊 Situação Atual</h3>
                      <ul className="admin-diag-list">{diag.situacao.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>

                    {diag.custos.length > 0 && (
                      <div className="admin-diag-section cost">
                        <h3>💸 O que isso tá custando (use na conversa)</h3>
                        <ul className="admin-diag-list">{diag.custos.map((c, i) => <li key={i}>{c}</li>)}</ul>
                      </div>
                    )}

                    <div className="admin-card__grid">
                      <div className="admin-diag-section problem">
                        <h3>⚠️ Problemas Identificados</h3>
                        <ul className="admin-diag-list">{diag.problemas.map((p, i) => <li key={i}>{p}</li>)}</ul>
                      </div>
                      <div className="admin-diag-section opportunity">
                        <h3>💎 Oportunidades</h3>
                        <ul className="admin-diag-list">{diag.oportunidades.map((o, i) => <li key={i}>{o}</li>)}</ul>
                      </div>
                    </div>

                    <div className="admin-diag-section proposal">
                      <h3>📋 Proposta Sugerida: {diag.proposta.servico}</h3>
                      <div className="admin-proposal-meta">
                        <span>⏱ {diag.proposta.prazo}</span>
                        <span>💰 {diag.proposta.valor}</span>
                      </div>
                      <div className="admin-proposal-grid">
                        <div>
                          <h4>Escopo</h4>
                          <ul className="admin-diag-list">{diag.proposta.escopo.map((e, i) => <li key={i}>{e}</li>)}</ul>
                        </div>
                        {diag.proposta.upsell.length > 0 && (
                          <div>
                            <h4>Upsell</h4>
                            <ul className="admin-diag-list upsell">{diag.proposta.upsell.map((u, i) => <li key={i}>{u}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="admin-diag-section approach">
                      <h3>🎯 Como Abordar</h3>
                      <ul className="admin-diag-list">{diag.abordagem.map((a, i) => <li key={i}>{a}</li>)}</ul>
                    </div>

                    <div className="admin-card__actions">
                      <a href={waContact} target="_blank" rel="noopener noreferrer" className="admin-btn-wa">
                        💬 Contatar {lead.nome} pelo WhatsApp
                      </a>
                      <a href={`tel:${lead.whatsapp.replace(/\D/g, '')}`} className="admin-btn-phone">📞 Ligar</a>
                      <button className="admin-btn-delete" onClick={() => handleDelete(lead.id)}>🗑 Remover</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
