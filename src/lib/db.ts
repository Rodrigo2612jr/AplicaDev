import { supabase } from './supabase'

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
export type Rec = 'site' | 'sistema' | 'app'

export interface LeadDados {
  serviceChoice: string
  empresaTipo: string
  nicho: string
  clientesMes: string
  escala: string
  faturamento: string
  temSite: string
  canais: string[]
  investiuAntes: string
  orgClientes: string
  controlePedidos: string
  temEquipe: string
  tamanhoEquipe: string
  dificuldade: string
  urgencia: string
  siteObjetivo: string
  appPlataforma: string
  appDescricao: string
  sistemaDescricao: string
}

export interface Lead {
  id: string
  nome: string
  whatsapp: string
  nome_empresa: string
  rec: Rec
  dados: LeadDados
  created_at: string
}

export interface LeadInsert {
  nome: string
  whatsapp: string
  nome_empresa: string
  rec: Rec
  dados: LeadDados
}

/* ═══════════════════════════════════════════════════════════
   INPUT SANITIZATION
═══════════════════════════════════════════════════════════ */
function sanitize(val: string): string {
  return val.trim().slice(0, 500)
}

function sanitizePhone(val: string): string {
  // Keep only digits and common phone chars
  return val.replace(/[^\d\s\-()+]/g, '').trim().slice(0, 20)
}

export function sanitizeLead(input: LeadInsert): LeadInsert {
  return {
    nome: sanitize(input.nome),
    whatsapp: sanitizePhone(input.whatsapp),
    nome_empresa: sanitize(input.nome_empresa),
    rec: input.rec,
    dados: {
      serviceChoice: sanitize(input.dados.serviceChoice),
      empresaTipo: sanitize(input.dados.empresaTipo),
      nicho: sanitize(input.dados.nicho),
      clientesMes: sanitize(input.dados.clientesMes),
      escala: sanitize(input.dados.escala),
      faturamento: sanitize(input.dados.faturamento),
      temSite: sanitize(input.dados.temSite),
      canais: input.dados.canais.map(c => sanitize(c)).slice(0, 10),
      investiuAntes: sanitize(input.dados.investiuAntes),
      orgClientes: sanitize(input.dados.orgClientes),
      controlePedidos: sanitize(input.dados.controlePedidos),
      temEquipe: sanitize(input.dados.temEquipe),
      tamanhoEquipe: sanitize(input.dados.tamanhoEquipe),
      dificuldade: sanitize(input.dados.dificuldade),
      urgencia: sanitize(input.dados.urgencia),
      siteObjetivo: sanitize(input.dados.siteObjetivo),
      appPlataforma: sanitize(input.dados.appPlataforma),
      appDescricao: sanitize(input.dados.appDescricao),
      sistemaDescricao: sanitize(input.dados.sistemaDescricao),
    },
  }
}

/* ═══════════════════════════════════════════════════════════
   DB HELPERS
═══════════════════════════════════════════════════════════ */
export async function insertLead(input: LeadInsert): Promise<{ error: string | null }> {
  const clean = sanitizeLead(input)
  const { error } = await supabase.from('leads').insert(clean)
  if (error) {
    console.error('[db] insertLead error:', error.message)
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
