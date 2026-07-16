import type { Lead, LeadDados, Rec, Temperatura } from './db'

/* ═══════════════════════════════════════════════════════════════════
   DIAGNÓSTICO — cérebro compartilhado entre o formulário e o Admin.

   Filosofia: o lead entrega SINTOMAS-FATO; aqui a gente infere a dor
   oculta, estima o custo em R$ (ticket × volume) e recomenda a solução.
═══════════════════════════════════════════════════════════════════ */

/* ── Midpoints pra transformar faixa → número estimado ──────────────── */
const CLIENTES_MID: Record<string, number> = {
  'ate-20': 12, '20-50': 35, '50-100': 75, '100+': 140, 'nao-sei': 0,
}
const TICKET_MID: Record<string, number> = {
  'ate-50': 35, '50-150': 100, '150-500': 300, '500-2k': 1000, '2k+': 3000,
}

/** Faturamento mensal estimado (0 = não dá pra estimar). */
export function estimarFaturamentoMensal(d: LeadDados): number {
  const c = CLIENTES_MID[d.clientesMes] ?? 0
  const t = TICKET_MID[d.ticketMedio] ?? 0
  return c * t
}

/** Arredonda pra centena e formata em R$ pt-BR. */
function brl(n: number): string {
  const r = Math.round(n / 100) * 100
  return 'R$' + r.toLocaleString('pt-BR')
}

const isAgendaManual = (d: LeadDados) => d.agendaMetodo === 'caderno' || d.agendaMetodo === 'whatsapp'
const isBaseFragil = (d: LeadDados) =>
  (d.baseClientes?.length ?? 0) > 0 &&
  d.baseClientes.every(b => b === 'cabeca' || b === 'whatsapp' || b === 'papel')
const isRecorrenciaFraca = (d: LeadDados) => d.recorrencia === 'quase-nunca' || d.recorrencia === 'nao-sei'
const isFinanceiroCego = (d: LeadDados) => d.visibilidadeFinanceira === 'olho' || d.visibilidadeFinanceira === 'caderno'
const isDonoGargalo = (d: LeadDados) => d.donoGargalo === 'metade-para' || d.donoGargalo === 'para-tudo'
const isInvisivelGoogle = (d: LeadDados) =>
  d.googleResultado === 'nada' || d.googleResultado === 'so-insta' || d.googleResultado === 'nunca-testei' ||
  d.temSite === 'nao' // fallback legado

/* ═══════════════════════════════════════════════════════════════════
   RECOMMEND — infere site / sistema / app (o lead nunca vê isso)
═══════════════════════════════════════════════════════════════════ */
const APP_NICHES = ['academia', 'clinica', 'clínica', 'restaurante', 'escola', 'fitness',
  'barbearia', 'salão', 'salao', 'pet', 'saúde', 'saude', 'farmácia', 'farmacia',
  'estetica', 'estética', 'odonto', 'dentista', 'spa', 'manicure']

export function recommend(d: LeadDados): Rec {
  // Palpite explícito do lead manda
  if (d.serviceChoice === 'site') return 'site'
  if (d.serviceChoice === 'sistema') return 'sistema'
  if (d.serviceChoice === 'app') return 'app'

  let site = 0, sistema = 0, app = 0

  // Site: invisibilidade / aquisição frágil
  if (isInvisivelGoogle(d)) site += 3
  if (d.canais?.length === 1 && d.canais[0] === 'indicacao') site += 2
  if (d.googleResultado === 'so-insta') site += 1

  // Sistema: cegueira financeira, base frágil, gargalo, volume
  if (isFinanceiroCego(d)) sistema += 2
  if (isBaseFragil(d)) sistema += 2
  if (isRecorrenciaFraca(d)) sistema += 1
  if (isDonoGargalo(d)) sistema += 2
  if (d.clientesMes === '50-100' || d.clientesMes === '100+') sistema += 2
  if (estimarFaturamentoMensal(d) >= 15000) sistema += 1

  // App: nichos de agendamento/fidelização
  const nicho = (d.nicho || '').toLowerCase()
  if (APP_NICHES.some(k => nicho.includes(k))) app += 4
  if (isAgendaManual(d) && (d.clientesMes === '100+' || d.clientesMes === '50-100')) app += 2
  if (d.empresaTipo === 'prestador' || d.empresaTipo === 'clinica') app += 1

  if (sistema >= site && sistema >= app && sistema > 0) return 'sistema'
  if (app > site && app >= sistema) return 'app'
  return 'site'
}

/* ═══════════════════════════════════════════════════════════════════
   CLASSIFICAÇÃO COMERCIAL — QUENTE / MORNO / FRIO (score B+A+T+F+N)
═══════════════════════════════════════════════════════════════════ */
export interface Classificacao {
  temperatura: Temperatura
  score: number            // 0-15
  breakdown: { B: number; A: number; T: number; F: number; N: number }
  sinais: string[]         // resumo curto pro vendedor
}

export function classifyLead(d: LeadDados): Classificacao {
  // B — orçamento (poder de investir)
  const B = d.orcamento === '10k+' ? 3 : d.orcamento === '3-10k' ? 3
    : d.orcamento === '1-3k' ? 2 : d.orcamento === 'ate-1k' ? 1 : 0
  // A — decisor (autoridade)
  const A = d.decisor === 'sozinho' ? 3 : d.decisor === 'socio' ? 2
    : d.decisor === 'alinhar' ? 1 : 0
  // T — timing (urgência real + dor ativa)
  const T = (d.urgencia === 'ontem' || d.perdaRecente === 'sim') ? 3
    : d.urgencia === 'semanas' ? 2 : d.urgencia === 'meses' ? 1 : 0
  // F — faturamento estimado (ticket × volume)
  const fat = estimarFaturamentoMensal(d)
  const F = fat >= 50000 ? 3 : fat >= 15000 ? 2 : fat >= 5000 ? 1 : 0
  // N — gravidade dos sintomas (cap 3)
  let N = 0
  if (isAgendaManual(d) && d.lembreteAuto === 'nao') N++
  if (isFinanceiroCego(d)) N++
  if (isRecorrenciaFraca(d) || isBaseFragil(d)) N++
  if (isDonoGargalo(d)) N++
  N = Math.min(N, 3)

  const score = B + A + T + F + N

  // Gates (o lead nunca vê)
  const gateSemPoder = d.decisor === 'nao-sou-eu'
  const gateFrio = d.urgencia === 'pesquisando' && d.orcamento === 'so-entender'

  let temperatura: Temperatura
  if (gateFrio || score < 5) temperatura = 'FRIO'
  else if (score >= 10 && A >= 2 && B >= 2 && !gateSemPoder) temperatura = 'QUENTE'
  else temperatura = 'MORNO'

  const sinais: string[] = []
  if (d.orcamento && d.orcamento !== 'so-entender') sinais.push(`Orçamento: ${ORC_LABEL[d.orcamento] ?? d.orcamento}`)
  if (gateSemPoder) sinais.push('⚠️ Não é o decisor (multi-thread)')
  if (d.urgencia === 'ontem') sinais.push('Urgência máxima (casa com os 10 dias)')
  if (d.perdaRecente === 'sim') sinais.push('Perdeu cliente nos últimos 30 dias')
  if (fat > 0) sinais.push(`Fat. estimado ~${brl(fat)}/mês`)

  return { temperatura, score, breakdown: { B, A, T, F, N }, sinais }
}

/* ═══════════════════════════════════════════════════════════════════
   TRAVAS — pro mini-diagnóstico da tela final (SÓ nomeia a dor,
   sem entregar solução nem a conta em R$: isso é isca pro WhatsApp)
═══════════════════════════════════════════════════════════════════ */
export interface Trava { titulo: string; detalhe: string }

export function generateTravas(d: LeadDados): Trava[] {
  const t: Trava[] = []
  const agendaOnde = d.agendaMetodo === 'caderno' ? 'no caderno' : 'pelo WhatsApp'

  if (isAgendaManual(d)) t.push({
    titulo: `Você controla seus horários ${agendaOnde}`,
    detalhe: 'Sem confirmação automática, todo horário furado é uma vaga que ninguém preenche.',
  })
  if (isFinanceiroCego(d)) t.push({
    titulo: 'Você sabe quanto vendeu "no olho"',
    detalhe: 'Sem número na mão, decisão de preço, compra e estoque vira aposta.',
  })
  if (isRecorrenciaFraca(d)) t.push({
    titulo: 'Cliente compra uma vez e você perde o rastro',
    detalhe: 'O dinheiro mais fácil (quem já te conhece) está escapando sem você ver.',
  })
  if (isBaseFragil(d)) t.push({
    titulo: 'Sua carteira de clientes vive no seu celular',
    detalhe: 'Perdeu o aparelho, perdeu anos de relacionamento — é seu ativo mais valioso solto.',
  })
  if (isInvisivelGoogle(d)) t.push({
    titulo: 'Quem te procura no Google não te encontra',
    detalhe: 'A demanda mais quente — quem já quer comprar — está indo pro concorrente que aparece.',
  })
  if (isDonoGargalo(d)) t.push({
    titulo: 'Se você para, o negócio para junto',
    detalhe: 'Enquanto tudo depende de você, esse é o teto do seu faturamento.',
  })
  if (d.canais?.length === 1 && d.canais[0] === 'indicacao') t.push({
    titulo: 'Cliente novo só chega por indicação',
    detalhe: 'Crescer virou uma questão de sorte, não de estratégia.',
  })
  if (d.horasWhatsapp === '2-4h' || d.horasWhatsapp === 'mais-4h') t.push({
    titulo: 'Boa parte do seu dia vai embora no WhatsApp',
    detalhe: 'São horas suas respondendo o que um site ou atendimento automático resolveria sozinho.',
  })

  // fallback neutro quando faltam sinais
  if (t.length === 0) t.push({
    titulo: 'Dá pra profissionalizar bastante a sua operação',
    detalhe: 'Pelas suas respostas, tem espaço claro pra organizar e crescer com tecnologia.',
  })

  return t.slice(0, 3)
}

/* ═══════════════════════════════════════════════════════════════════
   DIAGNÓSTICO COMPLETO — pro painel Admin (dor + custo em R$ + proposta)
═══════════════════════════════════════════════════════════════════ */
const TIPO_LABEL: Record<string, string> = {
  prestador: 'prestador de serviço', 'loja-fisica': 'loja física', 'loja-online': 'loja online / e-commerce',
  restaurante: 'restaurante / food', clinica: 'clínica / saúde / beleza', b2b: 'empresa B2B', outro: 'negócio',
}
const CLIENTES_LABEL: Record<string, string> = {
  'ate-20': 'até 20', '20-50': '20-50', '50-100': '50-100', '100+': '100+', 'nao-sei': '? (não sabe)',
}
const TICKET_LABEL: Record<string, string> = {
  'ate-50': 'até R$50', '50-150': 'R$50-150', '150-500': 'R$150-500', '500-2k': 'R$500-2mil', '2k+': 'acima de R$2mil',
}
const ORC_LABEL: Record<string, string> = {
  'ate-1k': 'a partir de R$999', '1-3k': 'R$1-3 mil', '3-10k': 'R$3-10 mil', '10k+': 'acima de R$10 mil', 'so-entender': 'só quer entender',
}
const DECISOR_LABEL: Record<string, string> = {
  sozinho: 'decide sozinho', socio: 'decide com sócio', alinhar: 'precisa alinhar com sócio/família', 'nao-sou-eu': 'NÃO é o decisor',
}

export interface Diagnosis {
  temperatura: Temperatura
  score: number
  breakdown: Classificacao['breakdown']
  situacao: string[]
  problemas: string[]
  custos: string[]          // frases de impacto com R$ (a cola de venda)
  oportunidades: string[]
  proposta: { servico: string; escopo: string[]; prazo: string; valor: string; upsell: string[] }
  abordagem: string[]
}

export function generateDiagnosis(lead: Lead): Diagnosis {
  const d = lead.dados
  const r = lead.rec
  const cls = classifyLead(d)
  const situacao: string[] = []
  const problemas: string[] = []
  const custos: string[] = []
  const oportunidades: string[] = []
  const abordagem: string[] = []
  const escopo: string[] = []
  const upsell: string[] = []

  const fat = estimarFaturamentoMensal(d)
  const cMid = CLIENTES_MID[d.clientesMes] ?? 0
  const tMid = TICKET_MID[d.ticketMedio] ?? 0

  /* ── Situação ── */
  situacao.push(`${lead.nome_empresa || lead.nome} — ${TIPO_LABEL[d.empresaTipo] || d.empresaTipo || 'negócio'}${d.nicho ? ` (${d.nicho})` : ''}, ${CLIENTES_LABEL[d.clientesMes] ?? '?'} clientes/mês, ticket ${TICKET_LABEL[d.ticketMedio] ?? '?'}`)
  if (fat > 0) situacao.push(`Faturamento estimado: ~${brl(fat)}/mês (ticket × volume)`)
  if (d.canais?.length) situacao.push(`Aquisição: ${d.canais.join(', ')}`)
  if (d.googleResultado) situacao.push(`No Google aparece: ${GOOGLE_LABEL[d.googleResultado] ?? d.googleResultado}`)
  if (d.decisor) situacao.push(`Decisão de compra: ${DECISOR_LABEL[d.decisor] ?? d.decisor}`)

  /* ── Problemas + Custos (dor nomeada + R$) ── */
  if (isAgendaManual(d)) {
    problemas.push(`Agendamento manual (${d.agendaMetodo === 'caderno' ? 'caderno' : 'WhatsApp'})${d.lembreteAuto === 'nao' ? ', sem lembrete automático' : ''}`)
    if (d.lembreteAuto === 'nao' && cMid && tMid) {
      const perda = cMid * 0.15 * tMid
      custos.push(`No-show: ~${cMid} atend./mês × ~15% de furo × ${brl(tMid)} ≈ ${brl(perda)}/mês em cadeira vazia que ninguém revende.`)
    }
  }
  if (isFinanceiroCego(d)) problemas.push('Cegueira financeira: sabe quanto vendeu "no olho/caderno", decide no achismo')
  if (isBaseFragil(d)) problemas.push('Base de clientes frágil e fragmentada (cabeça/WhatsApp/papel) — sem histórico, sem backup')
  if (isRecorrenciaFraca(d)) {
    problemas.push('Recompra não medida — LTV largado na mesa')
    if (cMid && tMid) {
      const recompra = 8 * tMid // ~2 clientes/semana
      custos.push(`Recompra: trazer só 2 clientes antigos por semana no seu ticket já é ~${brl(recompra)}/mês sem gastar R$1 em anúncio.`)
    }
  }
  if (isInvisivelGoogle(d)) {
    problemas.push('Invisível pra quem procura ativamente no Google')
    if (tMid) custos.push(`Google: se só 1 cliente/semana te procura e não acha ≈ ${brl(4 * tMid)}/mês indo pro concorrente que aparece.`)
  }
  if (isDonoGargalo(d)) problemas.push('O dono é o ponto único de falha — o negócio não roda sem ele (teto de crescimento)')
  if (d.horasWhatsapp === '2-4h' || d.horasWhatsapp === 'mais-4h') {
    const horasMes = (d.horasWhatsapp === 'mais-4h' ? 4 : 3) * 26
    custos.push(`Tempo: ~${horasMes}h/mês no WhatsApp respondendo o que um site/bot resolve — equivale a meio funcionário só do seu tempo.`)
  }
  if (d.canais?.length === 1 && d.canais[0] === 'indicacao') problemas.push('Só indicação/boca a boca — zero previsibilidade de aquisição')

  /* ── Oportunidades (o que a AplicaDev entrega) ── */
  if (isInvisivelGoogle(d)) oportunidades.push('Site de alta conversão + SEO local pra capturar a demanda que já procura no Google')
  if (isAgendaManual(d)) oportunidades.push('Sistema/app de agendamento com confirmação e lembrete automático (mata o no-show)')
  if (isFinanceiroCego(d)) oportunidades.push('Painel de vendas/financeiro em tempo real — parar de decidir no escuro')
  if (isRecorrenciaFraca(d) || isBaseFragil(d)) oportunidades.push('CRM próprio + automação de reativação da base (ativar o LTV parado)')
  if (isDonoGargalo(d)) oportunidades.push('Sistema que tira o processo da cabeça do dono — a equipe roda sem depender dele')
  if (fat >= 50000 || d.clientesMes === '100+') oportunidades.push('Volume/faturamento alto: cabe solução completa (combo site + sistema/app), ROI rápido')

  /* ── Proposta ── */
  let servico = '', prazo = '', valor = ''
  if (r === 'site') {
    servico = 'Site de Alta Conversão — AplicaDev'
    escopo.push('Site/LP responsivo de alta conversão', 'Copy estratégica + integração WhatsApp', 'SEO local pra aparecer no Google', 'Design premium + performance')
    prazo = '7 dias úteis'; valor = fat >= 15000 ? 'R$999,90 - R$2.500' : 'A partir de R$999,90'
    upsell.push('CRM pra gerenciar os leads captados', 'Sistema de agendamento online')
  } else if (r === 'sistema') {
    servico = 'Sistema sob Medida — AplicaDev'
    escopo.push('Sistema web personalizado')
    if (isBaseFragil(d) || isRecorrenciaFraca(d)) escopo.push('CRM: base de clientes + histórico + reativação')
    if (isFinanceiroCego(d)) escopo.push('Dashboard de vendas/financeiro em tempo real')
    if (isAgendaManual(d)) escopo.push('Módulo de agendamento com lembrete automático')
    escopo.push('Painel administrativo intuitivo')
    prazo = '10 dias úteis'
    valor = fat >= 50000 ? 'R$5.000 - R$12.000' : fat >= 15000 ? 'R$3.000 - R$7.000' : 'R$2.000 - R$5.000'
    upsell.push('App mobile complementar', 'Site institucional (combo)')
  } else {
    servico = 'Aplicativo Mobile — AplicaDev'
    escopo.push('App multiplataforma (iOS + Android) ou PWA', 'UX/UI personalizado', 'Backend cloud escalável', 'Publicação nas lojas')
    if (isAgendaManual(d)) escopo.push('Agendamento + fidelização (padrão do setor)')
    prazo = '10 dias úteis (MVP)'; valor = 'R$5.000 - R$15.000'
    upsell.push('Painel admin web', 'Site/LP de divulgação (combo)')
  }

  /* ── Abordagem ── */
  const tempMap: Record<Temperatura, string> = {
    QUENTE: '🔴 QUENTE — atender AGORA. Fura fila, casa com a entrega em 10 dias. Abrir com o prejuízo revelado.',
    MORNO: '🟡 MORNO — enviar proposta + follow-up. Nutrir com case do mesmo nicho.',
    FRIO: '🔵 FRIO — portfólio e contato leve, sem pressão. Quando amadurecer, lembra da gente.',
  }
  abordagem.push(tempMap[cls.temperatura])
  if (d.decisor === 'nao-sou-eu') abordagem.push('⚠️ Não é o decisor: pedir pra incluir quem bate o martelo na conversa (multi-thread)')
  if (d.decisor === 'alinhar') abordagem.push('Precisa alinhar com sócio/família: dar material pra ele defender a compra internamente')
  if (d.perdaRecente === 'sim') abordagem.push('Perdeu cliente há pouco e admitiu — dor ativa, abrir por aí')
  if (cls.sinais.length) abordagem.push('Sinais: ' + cls.sinais.join(' · '))

  return {
    temperatura: cls.temperatura,
    score: cls.score,
    breakdown: cls.breakdown,
    situacao, problemas, custos, oportunidades,
    proposta: { servico, escopo, prazo, valor, upsell },
    abordagem,
  }
}

const GOOGLE_LABEL: Record<string, string> = {
  site: 'meu site', 'so-insta': 'só Instagram', 'so-maps': 'só Google Maps', nada: 'nada', 'nunca-testei': 'nunca testou',
}
