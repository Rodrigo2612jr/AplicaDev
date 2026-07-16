import { supabase } from './supabase'

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
export type Rec = 'site' | 'sistema' | 'app'
export type Temperatura = 'QUENTE' | 'MORNO' | 'FRIO'
export type LeadStatus = 'parcial' | 'completo'

export interface LeadDados {
  // intenção (palpite opcional)
  serviceChoice: string
  // negócio
  empresaTipo: string
  nicho: string
  // porte (motor do cálculo de R$)
  clientesMes: string
  ticketMedio: string
  // aquisição
  canais: string[]
  googleResultado: string
  // agenda
  agendaMetodo: string
  lembreteAuto: string
  // gestão / dinheiro
  visibilidadeFinanceira: string
  baseClientes: string[]
  // recorrência
  recorrencia: string
  reativacao: string
  // gargalo / tempo do dono
  donoGargalo: string
  horasWhatsapp: string
  // filtro comercial
  orcamento: string
  decisor: string
  urgencia: string
  perdaRecente: string

  // ── LEGADOS: leads antigos ainda têm estes campos; o novo funil não os coleta.
  //    Mantidos opcionais p/ o painel exibir leads antigos sem quebrar. ──
  escala?: string
  faturamento?: string
  temSite?: string
  investiuAntes?: string
  orgClientes?: string
  controlePedidos?: string
  temEquipe?: string
  tamanhoEquipe?: string
  dificuldade?: string
  siteObjetivo?: string
  appPlataforma?: string
  appDescricao?: string
  sistemaDescricao?: string
}

export interface UtmDados {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  fbclid?: string
  gclid?: string
}

export interface Lead {
  id: string
  nome: string
  whatsapp: string
  nome_empresa: string
  rec: Rec
  dados: LeadDados
  status: LeadStatus
  temperatura: Temperatura | null
  score: number | null
  utm: UtmDados | null
  created_at: string
}

/** Payload de escrita — mesmo shape pro parcial (contato) e pro completo (fim). */
export interface LeadUpsert {
  id: string
  nome: string
  whatsapp: string
  nome_empresa: string
  rec: Rec
  dados: LeadDados
  status: LeadStatus
  temperatura?: Temperatura | null
  score?: number | null
  utm?: UtmDados
}

/* ═══════════════════════════════════════════════════════════
   INPUT SANITIZATION
═══════════════════════════════════════════════════════════ */
function s(val: unknown): string {
  return typeof val === 'string' ? val.trim().slice(0, 500) : ''
}

function sArr(val: unknown): string[] {
  return Array.isArray(val) ? val.map(s).filter(Boolean).slice(0, 12) : []
}

function sPhone(val: unknown): string {
  return typeof val === 'string' ? val.replace(/[^\d\s\-()+]/g, '').trim().slice(0, 20) : ''
}

function sanitizeDados(d: LeadDados): LeadDados {
  return {
    serviceChoice: s(d.serviceChoice),
    empresaTipo: s(d.empresaTipo),
    nicho: s(d.nicho),
    clientesMes: s(d.clientesMes),
    ticketMedio: s(d.ticketMedio),
    canais: sArr(d.canais),
    googleResultado: s(d.googleResultado),
    agendaMetodo: s(d.agendaMetodo),
    lembreteAuto: s(d.lembreteAuto),
    visibilidadeFinanceira: s(d.visibilidadeFinanceira),
    baseClientes: sArr(d.baseClientes),
    recorrencia: s(d.recorrencia),
    reativacao: s(d.reativacao),
    donoGargalo: s(d.donoGargalo),
    horasWhatsapp: s(d.horasWhatsapp),
    orcamento: s(d.orcamento),
    decisor: s(d.decisor),
    urgencia: s(d.urgencia),
    perdaRecente: s(d.perdaRecente),
    // legados (só persiste se presentes)
    ...(d.escala !== undefined && { escala: s(d.escala) }),
    ...(d.faturamento !== undefined && { faturamento: s(d.faturamento) }),
    ...(d.temSite !== undefined && { temSite: s(d.temSite) }),
    ...(d.investiuAntes !== undefined && { investiuAntes: s(d.investiuAntes) }),
    ...(d.orgClientes !== undefined && { orgClientes: s(d.orgClientes) }),
    ...(d.controlePedidos !== undefined && { controlePedidos: s(d.controlePedidos) }),
    ...(d.temEquipe !== undefined && { temEquipe: s(d.temEquipe) }),
    ...(d.tamanhoEquipe !== undefined && { tamanhoEquipe: s(d.tamanhoEquipe) }),
    ...(d.dificuldade !== undefined && { dificuldade: s(d.dificuldade) }),
    ...(d.siteObjetivo !== undefined && { siteObjetivo: s(d.siteObjetivo) }),
    ...(d.appPlataforma !== undefined && { appPlataforma: s(d.appPlataforma) }),
    ...(d.appDescricao !== undefined && { appDescricao: s(d.appDescricao) }),
    ...(d.sistemaDescricao !== undefined && { sistemaDescricao: s(d.sistemaDescricao) }),
  }
}

function sanitizeUtm(u?: UtmDados): UtmDados {
  if (!u) return {}
  const out: UtmDados = {}
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'] as const) {
    if (u[k]) out[k] = s(u[k])
  }
  return out
}

export function sanitizeLead(input: LeadUpsert): LeadUpsert {
  return {
    id: s(input.id),
    nome: s(input.nome),
    whatsapp: sPhone(input.whatsapp),
    nome_empresa: s(input.nome_empresa),
    rec: input.rec,
    dados: sanitizeDados(input.dados),
    status: input.status,
    temperatura: input.temperatura ?? null,
    score: typeof input.score === 'number' ? input.score : null,
    utm: sanitizeUtm(input.utm),
  }
}

/* ═══════════════════════════════════════════════════════════
   DB HELPERS
═══════════════════════════════════════════════════════════ */

/**
 * Grava/atualiza o lead por id (upsert idempotente).
 * - No passo de contato: chamar com status='parcial' (rede de segurança:
 *   se abandonar no filtro, contato + sintomas já ficaram salvos).
 * - No passo final: chamar de novo com status='completo' + temperatura/score.
 * A policy `anon_update_parcial` só deixa o anon atualizar linhas ainda 'parcial'.
 */
export async function upsertLead(input: LeadUpsert): Promise<{ error: string | null }> {
  const clean = sanitizeLead(input)
  const { error } = await supabase.from('leads').upsert(clean, { onConflict: 'id' })
  if (error) {
    console.error('[db] upsertLead error:', error.message)
    return { error: error.message }
  }
  return { error: null }
}

export async function fetchLeads(): Promise<{ data: Lead[]; error: string | null }> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[db] fetchLeads error:', error.message)
    return { data: [], error: error.message }
  }
  return { data: (data as Lead[]) ?? [], error: null }
}

export async function deleteLead(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return { error: error.message }
  return { error: null }
}
