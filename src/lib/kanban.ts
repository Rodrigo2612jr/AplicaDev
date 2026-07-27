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
export interface KanbanPayload {
  formType: string
  contactName?: string
  softwareName?: string
  phone?: string
  answers: KanbanAnswer[]
  /** Atribuição crua — o Convex usa pra disparar a Conversions API server-side.
   *  Não é exibido no card; quem é exibido é a seção "Origem" dentro de answers. */
  attrib?: UtmDados
}

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
  { key: 'empresaTipo', q: 'Que tipo de negócio é o seu?', opts: { prestador: 'Prestador de serviço', 'loja-fisica': 'Loja física', 'loja-online': 'Loja online ou e-commerce', restaurante: 'Restaurante, lanchonete ou delivery', clinica: 'Clínica, saúde, estética ou beleza', b2b: 'Vendo pra outras empresas (B2B)', outro: 'Outro' } },
  { key: 'nicho', q: 'Qual o ramo?', opts: {} },
  { key: 'serviceChoice', q: 'O que o seu negócio mais precisa resolver agora? (opcional)', opts: { site: 'Ser encontrado e passar mais confiança', app: 'Estar na mão do cliente, pra ele resolver sozinho', sistema: 'Organizar a operação e parar de perder informação', 'nao-sei': 'Sei onde aperta, quero saber por onde começar' } },
  { key: 'clientesMes', q: 'Num dia normal, quantos clientes você atende?', opts: { 'd-ate-5': 'Até 5', 'd-5-15': '5 a 15', 'd-15-40': '15 a 40', 'd-40-100': '40 a 100', 'd-100+': 'Mais de 100', 'nao-sei': 'Não tenho como medir isso hoje', 'ate-20': 'Até 20 (mês)', '20-50': '20 a 50 (mês)', '50-100': '50 a 100 (mês)', '100+': 'Mais de 100 (mês)' } },
  { key: 'ticketMedio', q: 'Em média, quanto entra por cliente atendido?', opts: { 'ate-50': 'Até R$50', '50-150': 'R$50 a R$150', '150-500': 'R$150 a R$500', '500-2k': 'R$500 a R$2 mil', '2k+': 'Acima de R$2 mil' } },
  { key: 'canais', q: 'Por onde chega um cliente novo hoje? (pode marcar mais de um)', opts: { indicacao: 'Indicação, boca a boca', instagram: 'Instagram', google: 'Busca no Google', ponto: 'Passou na frente', whatsapp: 'WhatsApp', anuncio: 'Anúncio pago' } },
  { key: 'googleResultado', q: 'Se um cliente buscar o nome do seu negócio no Busca no Google agora, o que aparece?', opts: { site: 'Meu site', 'so-insta': 'Só o meu Instagram', 'so-maps': 'Só o Busca no Google Maps', nada: 'Pouca coisa, ou nada', 'nunca-testei': 'Nunca parei pra olhar' } },
  { key: 'agendaMetodo', q: 'Quando um cliente quer marcar com você, como isso acontece hoje?', opts: { caderno: 'Agenda de papel', whatsapp: 'Direto na conversa do WhatsApp', planilha: 'Planilha', app: 'Um app ou sistema de agendamento', 'nao-agenda': 'Por ordem de chegada, sem hora marcada' } },
  { key: 'lembreteAuto', q: 'E o lembrete antes do horário, como funciona?', opts: { nao: 'Não trabalho com lembrete', manual: 'Mando na mão, quando dá tempo', automatico: 'Sai automático, sem eu precisar lembrar' } },
  { key: 'visibilidadeFinanceira', q: 'Como você acompanha quanto o negócio já vendeu esse mês?', opts: { olho: 'Acompanho de cabeça, tenho boa noção', caderno: 'Anoto no caderno', planilha: 'Tenho uma planilha', sistema: 'Um sistema me mostra na hora' } },
  { key: 'baseClientes', q: 'O contato e o histórico dos seus clientes ficam onde hoje?', opts: { cabeca: 'Comigo, eu que lembro de cada um', whatsapp: 'Espalhado no WhatsApp', papel: 'Caderno ou ficha de papel', planilha: 'Planilha', crm: 'Um sistema ou CRM' } },
  { key: 'recorrencia', q: 'Cliente que veio uma vez costuma voltar?', opts: { sempre: 'Sempre volta', 'as-vezes': 'Uma parte volta, outra some', 'quase-nunca': 'A maioria vem uma vez só', 'nao-sei': 'Não tenho como medir isso hoje' } },
  { key: 'reativacao', q: 'Quando você tem uma novidade ou promoção, dá pra avisar quem já comprou?', opts: { lista: 'Sim, tenho os contatos organizados num lugar só', 'posta-torce': 'Posto nas redes, alcança quem estiver por lá', 'nao-tenho-junto': 'Os contatos existem, mas estão espalhados' } },
  { key: 'donoGargalo', q: 'Se você tirasse 1 semana de férias amanhã, o negócio rodava sozinho?', opts: { tranquilo: 'Rodava normal, sem mim', capengando: 'Rodava, mas capengando', 'metade-para': 'Metade das coisas parava', 'para-tudo': 'Parava quase tudo, sou eu que seguro' } },
  { key: 'horasWhatsapp', q: 'Num dia normal, quanto tempo vai no WhatsApp respondendo cliente (preço, horário, endereço, se tem vaga)?', opts: { 'menos-1h': 'Menos de 1h', '1-2h': '1 a 2h', '2-4h': '2 a 4h', 'mais-4h': 'Mais de 4h' } },
  { key: 'orcamento', q: 'Quanto faz sentido investir agora?', opts: { 'ate-1k': 'A partir de R$999, quero começar enxuto', '1-3k': 'R$1 mil a R$3 mil', '3-10k': 'R$3 mil a R$10 mil', '10k+': 'Acima de R$10 mil', 'so-entender': 'Só quero entender primeiro' } },
  { key: 'decisor', q: 'Quem bate o martelo numa decisão dessas?', opts: { sozinho: 'Sou eu, decido sozinho', socio: 'Eu e mais um sócio', alinhar: 'Preciso alinhar com sócio ou família antes', 'nao-sou-eu': 'Levo pra quem decide na empresa' } },
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
  add('Diagnóstico', 'proposta', 'Proposta sugerida', `${diag.proposta.servico} · ${diag.proposta.prazo} · ${diag.proposta.valor}`)
  if (diag.abordagem.length) add('Diagnóstico', 'abordagem', 'Como abordar', diag.abordagem.join(' · '))

  // Origem — granular, pra saber QUAL criativo e QUAL conjunto trouxe o lead
  const temAnuncio = Boolean(utm.utm_source || utm.utm_content)
  if (temAnuncio) {
    add('Origem', 'criativo', '🎬 Criativo (anúncio)', utm.utm_content ?? '')
    add('Origem', 'conjunto', '🎯 Conjunto', utm.utm_term ?? '')
    add('Origem', 'campanha', '📣 Campanha', utm.utm_campaign ?? '')
    add('Origem', 'canal', '📱 Canal', [utm.utm_source, utm.src, utm.plc].filter(Boolean).join(' · '))
    add('Origem', 'ids', '🔖 IDs (campanha/conjunto/anúncio)', [utm.cid, utm.gid, utm.aid].filter(Boolean).join(' / '))
  } else {
    add('Origem', 'origem', 'Origem', utm.referrer ? `orgânico · veio de ${utm.referrer}` : 'direto / orgânico')
  }

  // Formulário na íntegra (cada pergunta com a opção exata que o lead clicou)
  answers.push(...buildRawAnswers(dados))

  // phone: liga o lead ao WhatsApp do sistema (contato nasce pré-qualificado,
  // pula o bot e não duplica card no funil quando ele chamar)
  return {
    formType: 'diagnostico-v1',
    contactName: nome?.trim() || undefined,
    phone: whatsapp?.trim() || undefined,
    answers,
    attrib: utm,
  }
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
