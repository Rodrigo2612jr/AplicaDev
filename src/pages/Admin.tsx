import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logoIcon from '../assets/logo-icon-clean.png'
import { supabase } from '../lib/supabase'
import { fetchLeads, deleteLead } from '../lib/db'
import type { Lead, Rec } from '../lib/db'

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const REC_INFO: Record<Rec, { icon: string; title: string; color: string }> = {
  site: { icon: '🌐', title: 'Site de Alta Conversão', color: '#1ab7ab' },
  sistema: { icon: '⚙️', title: 'Sistema sob Medida', color: '#7c3aed' },
  app: { icon: '📱', title: 'Aplicativo Mobile', color: '#f59e0b' },
}


interface Diagnosis {
  situacao: string[]
  problemas: string[]
  oportunidades: string[]
  proposta: { servico: string; escopo: string[]; prazo: string; valor: string; upsell: string[] }
  abordagem: string[]
  urgenciaScore: number // 1-5
}

function generateDiagnosis(lead: Lead): Diagnosis {
  const d = lead.dados
  const r = lead.rec
  const situacao: string[] = []
  const problemas: string[] = []
  const oportunidades: string[] = []
  const abordagem: string[] = []
  const escopo: string[] = []
  const upsell: string[] = []

  // ── Análise da situação atual ──
  const tipoLabel: Record<string, string> = { prestador: 'prestador de serviço', 'loja-fisica': 'loja física', 'loja-online': 'loja online', b2b: 'empresa B2B', outro: 'outro tipo' }
  situacao.push(`${lead.nome_empresa || lead.nome} é ${tipoLabel[d.empresaTipo] || d.empresaTipo}${d.nicho ? ` no nicho de ${d.nicho}` : ''}, atendendo ${d.clientesMes || '?'} clientes/mês em escala ${d.escala || '?'}`)

  if (d.faturamento && d.faturamento !== 'nao-informar') {
    const fatLabel: Record<string, string> = { 'ate-5k': 'até R$5 mil', '5-15k': 'R$5-15 mil', '15-50k': 'R$15-50 mil', '50k+': 'acima de R$50 mil' }
    situacao.push(`Faturamento mensal: ${fatLabel[d.faturamento] || d.faturamento}`)
  }

  if (d.temSite === 'nao') situacao.push('Não possui presença digital com site próprio')
  else situacao.push('Já possui site (avaliar qualidade e performance)')

  if (d.temEquipe === 'sim') situacao.push(`Tem equipe de ${d.tamanhoEquipe || '?'} pessoas`)
  else situacao.push('Trabalha sozinho(a) ou sem equipe definida')

  const canaisLabel = d.canais?.length ? `Canais de contato: ${d.canais.join(', ')}` : 'Sem canais definidos'
  situacao.push(canaisLabel)

  if (d.investiuAntes === 'sim-certo') situacao.push('Já investiu em tecnologia e teve bons resultados (lead educado)')
  else if (d.investiuAntes === 'sim-falhou') situacao.push('Já investiu antes mas não funcionou (pode ter resistência, precisa mostrar diferencial)')
  else situacao.push('Nunca investiu em tecnologia digital (primeiro contato, educar sobre valor)')

  // ── Problemas identificados ──
  const diffMap: Record<string, string> = {
    clientes: 'Tem dificuldade em conseguir novos clientes e gerar vendas',
    automatizar: 'Perde tempo com processos manuais e repetitivos',
    organizar: 'Não consegue organizar clientes e pedidos de forma eficiente',
    profissionalizar: 'Precisa se profissionalizar digitalmente pra competir',
    escalar: 'Quer escalar mas está limitado pela operação atual',
  }
  if (d.dificuldade) problemas.push(diffMap[d.dificuldade] || d.dificuldade)

  if (d.orgClientes === 'planilha') problemas.push('Organiza clientes em planilha (risco de perda de dados, sem automação)')
  if (d.orgClientes === 'whatsapp') problemas.push('Organiza clientes pelo WhatsApp (caótico, sem histórico, difícil escalar)')
  if (d.orgClientes === 'nao-organizo') problemas.push('Não organiza clientes de nenhuma forma (perda de oportunidades garantida)')
  if (d.controlePedidos === 'manual') problemas.push('Controle de pedidos é 100% manual (erros, atrasos, retrabalho)')
  if (d.controlePedidos === 'planilha') problemas.push('Controle de pedidos em planilha (limitado, não escala)')
  if (d.temSite === 'nao' && d.dificuldade === 'clientes') problemas.push('Sem site = invisível no Google. Perde clientes que pesquisam online')
  if (d.temEquipe === 'sim' && (d.orgClientes !== 'sistema')) problemas.push('Tem equipe mas sem sistema, gestão centralizada é impossível')
  if (d.clientesMes === '100+' && d.controlePedidos !== 'sistema') problemas.push('Mais de 100 clientes/mês sem sistema é gargalo operacional')
  if (d.investiuAntes === 'sim-falhou') problemas.push('Investimento anterior falhou (entender o que deu errado pra não repetir)')

  // ── Oportunidades (focadas nos serviços AplicaDev: sites, sistemas e apps) ──
  if (d.temSite === 'nao') oportunidades.push('Podemos criar um site profissional que já começa a captar clientes pelo Google')
  if (d.canais?.includes('instagram') && d.temSite === 'nao') oportunidades.push('Já tem presença no Instagram — um site nosso pode converter esses seguidores em clientes reais')
  if (d.orgClientes !== 'sistema' && d.clientesMes !== '0-20') oportunidades.push('Podemos desenvolver um sistema de gestão de clientes sob medida pra substituir planilhas/WhatsApp')
  if (d.controlePedidos !== 'sistema' && d.temEquipe === 'sim') oportunidades.push('Um sistema de pedidos que a gente desenvolve pode liberar horas da equipe pra focar em vendas')
  if (d.faturamento === '50k+') oportunidades.push('Faturamento alto: podemos propor uma solução mais completa (site + sistema ou site + app)')
  if (d.faturamento === 'ate-5k') oportunidades.push('Negócio em crescimento: um site nosso de alta conversão pode multiplicar o faturamento rápido')
  if (d.escala === 'local' && d.temSite === 'nao') oportunidades.push('Podemos criar um site otimizado pra busca local — aparecer no Google quando alguém pesquisar na região')
  if (d.nicho) {
    const appNiches = ['academia', 'clinica', 'clínica', 'restaurante', 'barbearia', 'salao', 'salão', 'pet', 'estetica', 'estética', 'escola']
    if (appNiches.some(n => d.nicho.toLowerCase().includes(n))) {
      oportunidades.push(`Nicho ${d.nicho}: podemos criar um app de agendamento/fidelização que é o padrão do setor`)
    }
  }
  if (d.temEquipe === 'sim' && d.orgClientes !== 'sistema') oportunidades.push('Com equipe e sem sistema, podemos criar um painel onde todos gerenciam clientes e pedidos em um só lugar')
  if (r !== 'site' && d.temSite === 'nao') oportunidades.push('Oportunidade de combo: além do(a) ' + (r === 'sistema' ? 'sistema' : 'app') + ', podemos incluir um site institucional')
  if (r !== 'app' && d.nicho) {
    const appNiches2 = ['academia', 'clinica', 'restaurante', 'barbearia', 'salao', 'pet', 'estetica', 'escola']
    if (appNiches2.some(n => d.nicho.toLowerCase().includes(n))) {
      oportunidades.push('Possível upsell futuro: app mobile pro nicho (agendamento, fidelização)')
    }
  }

  // ── Proposta detalhada (serviços AplicaDev: sites, sistemas, apps) ──
  let servico = '', prazo = '', valor = ''

  if (r === 'site') {
    servico = 'Site de Alta Conversão — AplicaDev'
    if (d.siteObjetivo === 'ecommerce') {
      escopo.push('Loja virtual completa desenvolvida pela AplicaDev (catálogo, carrinho, checkout)')
      escopo.push('Painel admin próprio pra gerenciar produtos, estoque e pedidos')
      escopo.push('Integração de pagamento (Mercado Pago, Pix, cartão)')
      escopo.push('Design responsivo premium com identidade da marca')
      prazo = '10 dias úteis'; valor = 'R$2.500 - R$5.000'
      upsell.push('Sistema de gestão de pedidos (combo site + sistema AplicaDev)')
      upsell.push('App mobile da loja pra clientes (desenvolvido pela AplicaDev)')
    } else if (d.siteObjetivo === 'vendas') {
      escopo.push('Landing page de alta conversão desenvolvida pela AplicaDev')
      escopo.push('Copy estratégica focada em geração de leads')
      escopo.push('Formulário de captação integrado com WhatsApp')
      escopo.push('Design premium responsivo + otimização de velocidade')
      prazo = '7 dias úteis'; valor = 'A partir de R$999,90'
      upsell.push('Sistema de CRM pra gerenciar os leads captados (AplicaDev)')
      upsell.push('Páginas adicionais (portfólio, sobre, blog)')
    } else if (d.siteObjetivo === 'institucional') {
      escopo.push('Site institucional multi-páginas desenvolvido pela AplicaDev')
      escopo.push('Design premium alinhado à identidade visual da marca')
      escopo.push('Páginas: Home, Sobre, Serviços, Contato, Portfólio')
      escopo.push('Otimizado pra busca local + integração WhatsApp')
      prazo = '8 dias úteis'; valor = 'R$999,90 - R$2.500'
      upsell.push('Sistema de agendamento/orçamento online (AplicaDev)')
      upsell.push('Blog integrado pra conteúdo e SEO')
    } else {
      escopo.push('Site profissional responsivo desenvolvido pela AplicaDev')
      escopo.push('Design premium + formulário de contato + WhatsApp')
      escopo.push('Otimização de velocidade e SEO técnico')
      prazo = '7 dias úteis'; valor = 'A partir de R$999,90'
    }
  }

  if (r === 'sistema') {
    servico = 'Sistema sob Medida — AplicaDev'
    escopo.push('Sistema web personalizado desenvolvido pela AplicaDev')
    if (d.orgClientes !== 'sistema') escopo.push('Módulo de gestão de clientes (CRM próprio)')
    if (d.controlePedidos !== 'sistema') escopo.push('Módulo de controle de pedidos/serviços com status e histórico')
    if (d.temEquipe === 'sim') escopo.push(`Acesso multi-usuário com permissões (${d.tamanhoEquipe || '?'} pessoas)`)
    escopo.push('Dashboard com métricas e relatórios em tempo real')
    escopo.push('Painel administrativo completo com interface intuitiva')
    if (d.sistemaDescricao) escopo.push(`Funcionalidade específica: "${d.sistemaDescricao}"`)
    prazo = '10 dias úteis'
    if (d.faturamento === '50k+' || d.clientesMes === '100+') valor = 'R$5.000 - R$12.000'
    else if (d.faturamento === '15-50k') valor = 'R$3.000 - R$7.000'
    else valor = 'R$2.000 - R$5.000'
    upsell.push('App mobile complementar pro sistema (AplicaDev)')
    upsell.push('Site institucional da empresa (combo com desconto)')
    upsell.push('Automações extras (notificações, relatórios por email)')
  }

  if (r === 'app') {
    servico = 'Aplicativo Mobile — AplicaDev'
    if (d.appPlataforma === 'ambos') escopo.push('App multiplataforma iOS + Android desenvolvido pela AplicaDev')
    else if (d.appPlataforma === 'web') escopo.push('Web App progressivo (PWA) desenvolvido pela AplicaDev')
    else escopo.push(`App para ${d.appPlataforma === 'ios' ? 'iOS' : 'Android'} desenvolvido pela AplicaDev`)
    escopo.push('Design UX/UI personalizado e intuitivo')
    escopo.push('Backend cloud escalável com banco de dados')
    escopo.push('Publicação nas lojas (App Store / Play Store)')
    if (d.appDescricao) escopo.push(`Funcionalidade principal: "${d.appDescricao}"`)
    prazo = '10 dias úteis (MVP)'
    valor = 'R$5.000 - R$15.000'
    upsell.push('Painel admin web pra gerenciar o app (AplicaDev)')
    upsell.push('Site/LP de divulgação do app (combo)')
    upsell.push('Sistema de gestão integrado com o app')
  }

  // ── Abordagem de venda (como apresentar os serviços AplicaDev) ──
  if (d.urgencia === 'ontem') {
    abordagem.push('🔴 URGENTE — contatar agora. Destacar que a AplicaDev entrega em até 10 dias úteis')
    abordagem.push('Oferecer reunião rápida pelo WhatsApp/videocall pra alinhar escopo hoje mesmo')
  } else if (d.urgencia === 'semanas') {
    abordagem.push('🟠 QUENTE — contatar hoje. Enviar proposta detalhada com escopo e prazo')
  } else if (d.urgencia === 'meses') {
    abordagem.push('🟡 MORNO — enviar proposta + follow-up semanal. Manter relacionamento')
    abordagem.push('Compartilhar cases de clientes similares pra manter o interesse')
  } else {
    abordagem.push('🔵 FRIO — enviar portfólio da AplicaDev e manter contato leve')
    abordagem.push('Não pressionar. Quando estiver pronto, vai lembrar da AplicaDev')
  }

  if (d.investiuAntes === 'sim-falhou') {
    abordagem.push('⚠️ Já teve experiência negativa com outra empresa. Precisa de confiança')
    abordagem.push('Mostrar nosso portfólio real, processo de trabalho e garantia de entrega')
    abordagem.push('Perguntar o que deu errado antes e explicar nosso diferencial')
  }
  if (d.investiuAntes === 'nunca') {
    abordagem.push('Primeiro investimento em tecnologia — usar linguagem simples, sem termos técnicos')
    abordagem.push('Mostrar antes/depois de projetos da AplicaDev pra tangibilizar o resultado')
  }

  if (d.faturamento === 'ate-5k') {
    abordagem.push('Oferecer parcelamento e destacar o ROI: "Esse site vai se pagar em X meses"')
    abordagem.push('Começar com solução enxuta (a partir de R$999,90) e evoluir depois')
  } else if (d.faturamento === '50k+') {
    abordagem.push('Pode investir mais — apresentar solução completa e possível combo (site + sistema)')
    abordagem.push('Destacar valor premium, suporte dedicado e exclusividade')
  }

  if (d.empresaTipo === 'b2b') abordagem.push('Cliente B2B: focar em profissionalismo, processos e retorno sobre investimento')
  if (d.escala === 'local') abordagem.push('Negócio local: mostrar como nosso site pode aparecer no Google da região dele')

  if (d.empresaTipo === 'b2b') abordagem.push('B2B: foco em profissionalismo, credibilidade e processos')
  if (d.escala === 'local') abordagem.push('Negócio local: enfatizar SEO local, Google Maps, captar clientes da região')

  // ── Score de urgência ──
  let urgenciaScore = 2
  if (d.urgencia === 'ontem') urgenciaScore = 5
  else if (d.urgencia === 'semanas') urgenciaScore = 4
  else if (d.urgencia === 'meses') urgenciaScore = 2
  else urgenciaScore = 1
  if (d.faturamento === '50k+') urgenciaScore = Math.min(5, urgenciaScore + 1)
  if (d.clientesMes === '100+') urgenciaScore = Math.min(5, urgenciaScore + 1)

  return {
    situacao, problemas, oportunidades,
    proposta: { servico, escopo, prazo, valor, upsell },
    abordagem, urgenciaScore,
  }
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN PANEL
═══════════════════════════════════════════════════════════════ */
export default function Admin() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<Rec | 'all'>('all')
  const [loadError, setLoadError] = useState('')
  const [authChecked, setAuthChecked] = useState(false)

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate('/login', { replace: true })
      } else {
        setAuthChecked(true)
      }
    })
  }, [navigate])

  // Load leads after auth confirmed
  useEffect(() => {
    if (!authChecked) return
    fetchLeads().then(({ data, error }) => {
      if (error) setLoadError(error)
      else setLeads(data)
    })
  }, [authChecked])

  const filtered = filter === 'all' ? leads : leads.filter(l => l.rec === filter)

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este lead?')) return
    const { error } = await deleteLead(id)
    if (!error) setLeads(prev => prev.filter(l => l.id !== id))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (!authChecked) return null // loading / redirect

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
            <button
              key={f}
              className={`admin-filter${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Todos' : REC_INFO[f].icon + ' ' + REC_INFO[f].title}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="admin-error">Erro ao carregar leads: {loadError}</div>
      )}

      {filtered.length === 0 && !loadError ? (
        <div className="admin-empty">
          <span className="admin-empty__icon">📋</span>
          <p>Nenhum lead ainda.</p>
          <p className="admin-empty__sub">Quando alguém completar o diagnóstico, aparecerá aqui.</p>
        </div>
      ) : (
        <div className="admin-list">
          {filtered.map((lead) => {
            const ri = REC_INFO[lead.rec]
            const diag = generateDiagnosis(lead)
            const isOpen = expanded === lead.id
            const date = new Date(lead.created_at)
            const dateStr = date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

            const waMsg = [
              `Olá ${lead.nome}! Aqui é da AplicaDev.`,
              ``,
              `Analisamos seu diagnóstico e preparamos uma proposta personalizada de *${ri.title}* para o seu negócio.`,
              ``,
              `Podemos conversar agora?`,
            ].join('\n')
            const waContact = `https://wa.me/${lead.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`

            const urgLabel = ['', 'Frio', 'Morno', 'Interesse', 'Quente', 'Urgente']
            const urgColor = ['', '#6b7280', '#f59e0b', '#f59e0b', '#ef4444', '#ef4444']

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
                  </div>
                  <div className="admin-card__right">
                    <span className="admin-card__urgency" style={{ color: urgColor[diag.urgenciaScore], borderColor: urgColor[diag.urgenciaScore] + '40' }}>
                      {'🔥'.repeat(Math.min(diag.urgenciaScore, 3))} {urgLabel[diag.urgenciaScore]}
                    </span>
                    <span className="admin-card__date">{dateStr}</span>
                    <span className="admin-card__chevron">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="admin-card__body">
                    {/* Situação Atual */}
                    <div className="admin-diag-section">
                      <h3>📊 Situação Atual</h3>
                      <ul className="admin-diag-list">{diag.situacao.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>

                    {/* Problemas + Oportunidades */}
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

                    {/* Proposta */}
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

                    {/* Abordagem */}
                    <div className="admin-diag-section approach">
                      <h3>🎯 Como Abordar</h3>
                      <ul className="admin-diag-list">{diag.abordagem.map((a, i) => <li key={i}>{a}</li>)}</ul>
                    </div>

                    <div className="admin-card__actions">
                      <a href={waContact} target="_blank" rel="noopener noreferrer" className="admin-btn-wa">
                        💬 Contatar {lead.nome} pelo WhatsApp
                      </a>
                      <a href={`tel:${lead.whatsapp.replace(/\D/g, '')}`} className="admin-btn-phone">
                        📞 Ligar
                      </a>
                      <button className="admin-btn-delete" onClick={() => handleDelete(lead.id)}>
                        🗑 Remover
                      </button>
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
