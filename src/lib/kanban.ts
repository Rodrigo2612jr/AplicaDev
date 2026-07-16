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
const CLI: Record<string, string> = {
  'd-ate-5': 'até 5/dia (~80/mês)', 'd-5-15': '5 a 15/dia (~260/mês)', 'd-15-40': '15 a 40/dia (~650/mês)',
  'd-40-100': '40 a 100/dia (~1.700/mês)', 'd-100+': 'mais de 100/dia (~3.900/mês)',
  'ate-20': 'até 20/mês', '20-50': '20 a 50/mês', '50-100': '50 a 100/mês', '100+': 'mais de 100/mês', 'nao-sei': 'não sabe dizer',
}
const TIC: Record<string, string> = { 'ate-50': 'até R$50', '50-150': 'R$50-150', '150-500': 'R$150-500', '500-2k': 'R$500-2mil', '2k+': 'acima de R$2mil' }

function brl(n: number): string { return 'R$' + (Math.round(n / 100) * 100).toLocaleString('pt-BR') }

/* ── Respostas na íntegra: pergunta do form → texto EXATO da opção clicada ──
   Espelha o formulário pergunta a pergunta, na ordem em que o lead viu. */
const RAW: { key: keyof LeadDados; q: string; opts: Record<string, string> }[] = [
  { key: 'empresaTipo', q: 'Que tipo de negócio é o seu?', opts: { prestador: 'Prestador de serviço', 'loja-fisica': 'Loja física', 'loja-online': 'Loja online / e-commerce', restaurante: 'Restaurante / food', clinica: 'Clínica / saúde / estética / beleza', b2b: 'Vendo pra outras empresas (B2B)', outro: 'Outro' } },
  { key: 'nicho', q: 'Qual o ramo?', opts: {} },
  { key: 'serviceChoice', q: 'Você já tem um palpite do que resolveria? (opcional)', opts: { site: 'Acho que é um site', app: 'Acho que é um app', sistema: 'Acho que é um sistema pra organizar tudo', 'nao-sei': 'Não faço ideia, quero que vocês me digam' } },
  { key: 'clientesMes', q: 'Quantos clientes você atende num dia normal?', opts: { 'd-ate-5': 'Até 5 por dia', 'd-5-15': '5 a 15 por dia', 'd-15-40': '15 a 40 por dia', 'd-40-100': '40 a 100 por dia', 'd-100+': 'Mais de 100 por dia', 'nao-sei': 'Não sei dizer', 'ate-20': 'Até 20 (mês)', '20-50': '20 a 50 (mês)', '50-100': '50 a 100 (mês)', '100+': 'Mais de 100 (mês)' } },
  { key: 'ticketMedio', q: 'Quanto um cliente gasta com você, em média?', opts: { 'ate-50': 'Até R$50', '50-150': 'R$50 a R$150', '150-500': 'R$150 a R$500', '500-2k': 'R$500 a R$2 mil', '2k+': 'Acima de R$2 mil' } },
  { key: 'canais', q: 'Como um cliente NOVO costuma te achar hoje?', opts: { indicacao: 'Indicação / boca a boca', instagram: 'Instagram', google: 'Google', ponto: 'Passa na frente / ponto', whatsapp: 'WhatsApp', anuncio: 'Anúncio pago' } },
  { key: 'googleResultado', q: 'Se eu jogar o nome do seu negócio no Google agora, o que aparece?', opts: { site: 'Meu site', 'so-insta': 'Só meu Instagram', 'so-maps': 'Só o Google Maps', nada: 'Não aparece nada', 'nunca-testei': 'Nunca testei' } },
  { key: 'agendaMetodo', q: 'Como você marca um horário ou compromisso com o cliente?', opts: { caderno: 'Caderno / agenda de papel', whatsapp: 'Pelo WhatsApp mesmo', planilha: 'Planilha', app: 'Uso um app/sistema de agendamento', 'nao-agenda': 'Não trabalho com horário marcado' } },
  { key: 'lembreteAuto', q: 'Você manda lembrete pro cliente antes do horário?', opts: { nao: 'Não mando', manual: 'Mando na mão quando lembro', automatico: 'É automático' } },
  { key: 'visibilidadeFinanceira', q: 'Como você sabe quanto vendeu esse mês?', opts: { olho: 'De cabeça / no olho', caderno: 'Anoto num caderno', planilha: 'Tenho uma planilha', sistema: 'Um sistema me mostra' } },
  { key: 'baseClientes', q: 'Onde ficam guardadas as informações dos seus clientes?', opts: { cabeca: 'Na minha cabeça', whatsapp: 'No meu WhatsApp', papel: 'Caderno / papel', planilha: 'Planilha', crm: 'Um sistema / CRM' } },
  { key: 'recorrencia', q: 'Um cliente que compra ou atende uma vez costuma voltar?', opts: { sempre: 'Sempre volta', 'as-vezes': 'Às vezes', 'quase-nunca': 'Quase nunca', 'nao-sei': 'Não sei dizer' } },
  { key: 'reativacao', q: 'Consegue avisar seus clientes antigos quando tem novidade ou promoção?', opts: { lista: 'Sim, tenho a lista organizada', 'posta-torce': 'Posto no Instagram e torço', 'nao-tenho-junto': 'Não tenho os contatos juntos num lugar' } },
  { key: 'donoGargalo', q: 'Se você tirasse 1 semana de férias amanhã, o negócio rodava sozinho?', opts: { tranquilo: 'Rodava tranquilo', capengando: 'Rodava meio capengando', 'metade-para': 'Metade das coisas parava', 'para-tudo': 'Parava quase tudo' } },
  { key: 'horasWhatsapp', q: 'Quanto do seu dia vai em responder cliente no WhatsApp?', opts: { 'menos-1h': 'Menos de 1h', '1-2h': '1 a 2h', '2-4h': '2 a 4h', 'mais-4h': 'Mais de 4h' } },
  { key: 'orcamento', q: 'Quanto faz sentido investir agora?', opts: { 'ate-1k': 'A partir de R$999, quero começar enxuto', '1-3k': 'R$1 mil a R$3 mil', '3-10k': 'R$3 mil a R$10 mil', '10k+': 'Acima de R$10 mil', 'so-entender': 'Só quero entender primeiro' } },
  { key: 'decisor', q: 'Quem bate o martelo numa decisão dessas?', opts: { sozinho: 'Sou eu, decido sozinho', socio: 'Eu e mais um sócio', alinhar: 'Preciso alinhar com sócio/família antes', 'nao-sou-eu': 'Não sou eu, pesquiso pra empresa ou meu chefe' } },
  { key: 'urgencia', q: 'Pra quando você quer isso de pé?', opts: { ontem: 'Pra ontem, já tô perdendo dinheiro', semanas: 'Nas próximas semanas', meses: 'Nos próximos meses', pesquisando: 'Só pesquisando por enquanto' } },
  { key: 'perdaRecente', q: 'Nos últimos 30 dias, perdeu cliente/venda por algum desses motivos?', opts: { sim: 'Sim, e me incomodou', acho: 'Acho que sim', 'nao-percebi': 'Não que eu tenha percebido' } },
]

function buildRawAnswers(dados: LeadDados): KanbanAnswer[] {
  const out: KanbanAnswer[] = []
  for (const { key, q, opts } of RAW) {
    const v = dados[key]
    let texto = ''
    if (Array.isArray(v)) texto = v.map((s) => opts[s] ?? s).join(' · ')
    else if (typeof v === 'string' && v) texto = opts[v] ?? v
    if (texto) out.push({ section: '📝 Respostas na íntegra', key: `raw_${String(key)}`, label: q, value: texto })
  }
  return out
}

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

  // Formulário na íntegra (cada pergunta com a opção exata que o lead clicou)
  answers.push(...buildRawAnswers(dados))

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
