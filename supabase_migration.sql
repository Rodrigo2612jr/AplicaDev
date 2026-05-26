create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null,
  nome_empresa text not null default '',
  rec text not null check (rec in ('site','sistema','app')),
  dados jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table leads enable row level security;

create policy "anon_insert" on leads for insert to anon with check (true);
create policy "auth_select" on leads for select to authenticated using (true);
create policy "auth_delete" on leads for delete to authenticated using (true);
