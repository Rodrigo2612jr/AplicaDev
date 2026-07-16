-- ═══════════════════════════════════════════════════════════════════
-- Schema completo da tabela `leads` (criação do zero).
-- Para bancos JÁ existentes, rode supabase_migration_v2.sql (incremental).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null,
  nome_empresa text not null default '',
  rec text not null check (rec in ('site','sistema','app')),
  dados jsonb not null default '{}',
  status text not null default 'completo',   -- 'parcial' | 'completo'
  temperatura text,                          -- 'QUENTE' | 'MORNO' | 'FRIO'
  score int,                                 -- 0-15 (B+A+T+F+N)
  utm jsonb not null default '{}',           -- utm_* + fbclid/gclid
  created_at timestamptz not null default now()
);

alter table leads enable row level security;

-- Visitante anônimo cria o lead (parcial no contato, ou direto no fim)
create policy "anon_insert" on leads for insert to anon with check (true);

-- Visitante anônimo só COMPLETA linhas ainda 'parcial' (não mexe em 'completo')
drop policy if exists "anon_update_parcial" on leads;
create policy "anon_update_parcial" on leads
  for update to anon
  using (status = 'parcial')
  with check (true);

-- Painel autenticado
create policy "auth_select" on leads for select to authenticated using (true);
create policy "auth_delete" on leads for delete to authenticated using (true);

create index if not exists leads_temperatura_idx on leads (temperatura);
create index if not exists leads_status_idx      on leads (status);
create index if not exists leads_created_idx      on leads (created_at desc);
