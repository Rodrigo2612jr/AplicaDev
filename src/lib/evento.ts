import { upsertLead } from './db'
import type { LeadDados, LeadUpsert } from './db'
import { pushLeadToKanban } from './kanban'
import type { KanbanPayload } from './kanban'

/* ═══════════════════════════════════════════════════════════════
   LEAD DE EVENTO (QR impresso: banner, cartão, acrílico da plaquinha)
   Todo QR exposto diz o evento (?e=) e a peça (?de=). A rota dá o
   padrão: /workshop = telão do workshop CFK; /fale = banner e /placa =
   acrílico do stand, os dois da formatura CFK; o cartão usa
   /fale?de=cartao. O cartão é genérico (vale fora de evento), então
   sem ?e= ele vira o "evento" cartao-visita e não a formatura. O slug do evento vira o formType no Kanban (aba
   Eventos: criar lá o evento com o MESMO slug) e a peça vai no card,
   em "Origem".
   Sem pixel/CAPI de propósito: lead de evento não veio de anúncio e
   sujaria o sinal que a campanha usa pra otimizar.
═══════════════════════════════════════════════════════════════ */
const NOMES: Record<string, string> = {
  'workshop-cfk': 'Workshop CFK',
  'formatura-cfk': 'Formatura CFK',
  'cartao-visita': 'Cartão de visita',
}
const PECAS: Record<string, string> = {
  telao: 'Telão da apresentação',
  banner: 'Banner do stand',
  cartao: 'Cartão de visita',
  acrilico: 'Acrílico da plaquinha',
}
export type Origem = { evento: string; nome: string; de: string; peca: string }
const slug = (v: string | null) => (v && /^[a-z0-9-]{1,40}$/.test(v) ? v : null)
export function origemDaUrl(eventoPadrao: string, pecaPadrao: string): Origem {
  let e: string | null = null
  let de: string | null = null
  try {
    const q = new URLSearchParams(window.location.search)
    const h = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    e = slug(q.get('e') ?? h.get('e'))
    de = slug(q.get('de') ?? h.get('de'))
  } catch { /* URL estranha: fica o padrão da rota */ }
  const evento = e ?? (de === 'cartao' ? 'cartao-visita' : eventoPadrao)
  const p = de ?? pecaPadrao
  return { evento, nome: NOMES[evento] ?? evento, de: p, peca: PECAS[p] ?? p }
}

// Reserva quando Kanban e banco falham: número do stand e das peças impressas
export const WA_EVENTO = '5511976450441'
export const waLink = (linhas: string[]) =>
  `https://wa.me/${WA_EVENTO}?text=${encodeURIComponent(linhas.join('\n'))}`

export const digitos = (v: string) => v.replace(/\D/g, '')
export const utmEvento = (o: Origem) => ({ utm_source: o.evento, utm_medium: 'qr', utm_content: o.de })

/** LeadDados do /admin: o form de evento não tem as perguntas do diagnóstico dos anúncios. */
export function dadosEvento(o: Origem, linhas: string[]): LeadDados {
  return {
    serviceChoice: '', empresaTipo: 'clinica', nicho: 'Beleza e estética',
    clientesMes: '', ticketMedio: '', canais: [], googleResultado: '',
    agendaMetodo: '', lembreteAuto: '', visibilidadeFinanceira: '', baseClientes: [],
    recorrencia: '', reativacao: '', donoGargalo: '', horasWhatsapp: '',
    orcamento: '', decisor: '', urgencia: '', perdaRecente: '',
    temSite: '', evento: o.evento, workshop: linhas,
  }
}

/** Card do Kanban. `linhas` são "Rótulo: valor"; o Kanban lê os rótulos
 *  Interesse (temperatura), Soluções, Instagram, Cidade/bairro e Recado. */
export function cardKanban(o: Origem, secao: string, c: { nome: string; whatsapp: string; negocio: string }, linhas: string[]): KanbanPayload {
  const nome = c.nome.trim()
  return {
    formType: o.evento,
    contactName: nome || undefined,
    softwareName: c.negocio.trim() || nome || `Lead ${o.nome}`,
    phone: c.whatsapp.trim() || undefined,
    answers: [
      { section: secao, key: 'origem', label: 'Origem', value: `${o.nome} · ${o.peca} (QR)` },
      // companyName é OBRIGATÓRIO no submitBriefing do Kanban (sem ele: HTTP 400)
      { section: secao, key: 'companyName', label: 'Empresa', value: c.negocio.trim() || `${nome || 'Lead'} (${o.nome})` },
      { section: secao, key: 'contactName', label: 'Nome', value: nome },
      { section: secao, key: 'whatsapp', label: 'WhatsApp', value: c.whatsapp.trim() },
      ...linhas.map((l, i) => {
        const [label, ...resto] = l.split(': ')
        return { section: secao, key: `ev_${i}`, label, value: resto.join(': ') }
      }),
    ].filter(a => a.value),
  }
}

/** Dois destinos em paralelo, basta UM responder: o Kanban é o sistema vivo,
 *  o Supabase alimenta o /admin. Teto de 8s: wifi de evento trava requisição
 *  sem devolver erro. false = nenhum respondeu (a tela manda pelo WhatsApp). */
export async function enviarLeadEvento(lead: LeadUpsert, card: KanbanPayload): Promise<boolean> {
  const teto = <T,>(pr: Promise<T>, falha: T) =>
    Promise.race([pr, new Promise<T>(r => setTimeout(() => r(falha), 8000))])
  const [banco, kanban] = await Promise.all([
    teto(upsertLead(lead), { error: 'timeout' } as { error: string | null }),
    teto(pushLeadToKanban(card), { ok: false }),
  ])
  return !banco.error || kanban.ok
}
