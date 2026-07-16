import type { LeadDados, Lead, Rec, UtmDados } from './db'
import { generateDiagnosis, classifyLead, estimarFaturamentoMensal } from './diagnosis'

/* ═══════════════════════════════════════════════════════════════════
   PONTE COM O SISTEMA (Kanban / Convex)
   Espelha o lead do /diagnostico (V1) no inbox de briefings do Kanban,
   já com a inteligência de venda (temperatura, custos em R$, proposta).
   Fire-and-forget: NUNCA quebra o fluxo do formulário se falhar.
═══════════════════════════════════════════════════════════════════ */
const INGEST_URL = import.meta.env.VITE_KANBAN_INGEST_URL as string | undefined

export interface KanbanAnswer { section: string; key: string; label: string; value: string }
export interface KanbanPayload { formType: string; contactName?: string; softwareName?: string; answers: KanbanAnswer[] }

/* labels legíveis pros valores em faixa/slug (o inbox mostra texto, não código) */
const ORC: Record<string, string> = { 'ate-1k': 'a partir de R$999', '1-3k': 'R$1-3 mil', '3-10k': 'R$3-10 mil', '10k+': 'acima de R$10 mil', 'so-entender': 'só quer entender primeiro' }
const DEC: Record<string, string> = { sozinho: 'decide sozinho', socio: 'decide com sócio', alinhar: 'precisa alinhar com sócio/família', 'nao-sou-eu': '⚠️ NÃO é o decisor' }
const URG: Record<string, string> = { ontem: 'pra ontem (já perde dinheiro)', semanas: 'próximas semanas', meses: 'próximos meses', pesquisando: 'só pesquisando' }
const CLI: Record<string, string> = { 'ate-20': 'até 20', '20-50': '20 a 50', '50-100': '50 a 100', '100+': 'mais de 100', 'nao-sei': 'não sabe dizer' }
const TIC: Record<string, string> = { 'ate-50': 'até R$50', '50-150': 'R$50-150', '150-500': 'R$150-500', '500-2k': 'R$500-2mil', '2k+': 'acima de R$2mil' }

function brl(n: number): string { return 'R$' + (Math.round(n / 100) * 100).toLocaleString('pt-BR') }

export function buildKanbanPayload(input: {
  nome: string; whatsapp: string; nomeEmpresa: string
  dados: LeadDados; rec: Rec; utm: UtmDados
}): KanbanPayload {
  const { nome, whatsapp, nomeEmpresa, dados, rec, utm } = input
  const company = nomeEmpresa?.trim() || `${nome?.trim() || 'Lead'} (empresa não informada)`

  // Lead sintético pra reaproveitar o mesmo diagnóstico do painel /admin
  const lead: Lead = {
    id: '', nome, whatsapp, nome_empresa: nomeEmpresa, rec, dados,
    status: 'completo', temperatura: null, score: null, utm, created_at: '',
  }
  const diag = generateDiagnosis(lead)
  const cls = classifyLead(dados)
  const recLabel = rec === 'site' ? 'Site' : rec === 'sistema' ? 'Sistema sob medida' : 'Aplicativo'
  const fat = estimarFaturamentoMensal(dados)

  const answers: KanbanAnswer[] = []
  const add = (section: string, key: string, label: string, value: string) => {
    if (value && value.trim()) answers.push({ section, key, label, value })
  }

  // Contato — companyName é OBRIGATÓRIO no submitBriefing
  add('Contato', 'companyName', 'Empresa', company)
  add('Contato', 'contactName', 'Nome', nome)
  add('Contato', 'whatsapp', 'WhatsApp', whatsapp)

  // Qualificação (o filtro forte)
  add('Qualificação', 'temperatura', 'Temperatura', `${cls.temperatura} · score ${cls.score}/15`)
  add('Qualificação', 'recomendacao', 'Melhor solução', recLabel)
  add('Qualificação', 'orcamento', 'Orçamento', ORC[dados.orcamento] ?? dados.orcamento)
  add('Qualificação', 'decisor', 'Decisor', DEC[dados.decisor] ?? dados.decisor)
  add('Qualificação', 'urgencia', 'Prazo', URG[dados.urgencia] ?? dados.urgencia)
  if (dados.perdaRecente === 'sim') add('Qualificação', 'perdaRecente', 'Perdeu cliente (30d)', 'Sim, e se incomodou')

  // Negócio
  add('Negócio', 'ramo', 'Ramo / nicho', dados.nicho)
  add('Negócio', 'clientesMes', 'Clientes/mês', CLI[dados.clientesMes] ?? dados.clientesMes)
  add('Negócio', 'ticketMedio', 'Ticket médio', TIC[dados.ticketMedio] ?? dados.ticketMedio)
  if (fat) add('Negócio', 'faturamentoEstimado', 'Faturamento estimado', `~${brl(fat)}/mês`)

  // Custo da dor (R$) — a cola de venda
  diag.custos.forEach((c, i) => add('💸 Custo da dor', `custo${i}`, `Estimativa ${i + 1}`, c))

  // Diagnóstico
  if (diag.problemas.length) add('Diagnóstico', 'problemas', 'Problemas identificados', diag.problemas.join(' · '))
  add('Diagnóstico', 'proposta', 'Proposta sugerida', `${diag.proposta.servico} — ${diag.proposta.prazo} — ${diag.proposta.valor}`)
  if (diag.abordagem.length) add('Diagnóstico', 'abordagem', 'Como abordar', diag.abordagem.join(' · '))

  // Origem
  const origem = [utm.utm_source, utm.utm_campaign, utm.utm_content].filter(Boolean).join(' · ')
  add('Origem', 'origem', 'Origem (anúncio)', origem)

  return { formType: 'diagnostico-v1', contactName: nome?.trim() || undefined, answers }
}

/** POST defensivo pro Convex do Kanban. No-op silencioso se a URL não estiver setada. */
export async function pushLeadToKanban(payload: KanbanPayload): Promise<{ ok: boolean }> {
  if (!INGEST_URL) return { ok: false }
  try {
    const res = await fetch(INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) console.error('[kanban] push HTTP', res.status)
    return { ok: res.ok }
  } catch (e) {
    console.error('[kanban] push falhou:', e)
    return { ok: false }
  }
}
