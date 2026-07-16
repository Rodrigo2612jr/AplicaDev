-- ═══════════════════════════════════════════════════════════════════
-- Migração v2 — Diagnóstico estratégico (funil de dor inconsciente)
-- Rodar UMA VEZ no SQL Editor do Supabase. É idempotente (IF NOT EXISTS /
-- DROP POLICY IF EXISTS), então pode rodar de novo sem quebrar nada.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Colunas novas de qualificação e rastreio de campanha ---------------
--    As RESPOSTAS de sintoma continuam dentro de `dados` (jsonb), sem migração.
--    Estas colunas são as que o painel filtra/ordena e a policy referencia.
alter table leads add column if not exists status      text  not null default 'completo'; -- 'parcial' | 'completo'
alter table leads add column if not exists temperatura text;                              -- 'QUENTE' | 'MORNO' | 'FRIO'
alter table leads add column if not exists score       int;                               -- 0-15 (B+A+T+F+N)
alter table leads add column if not exists utm         jsonb not null default '{}';        -- utm_source/medium/campaign/content/term + fbclid/gclid

-- 2) Policy anon_update RESTRITA ---------------------------------------
--    O visitante salva o lead como 'parcial' no passo de contato e o
--    completa no fim. Precisa poder dar UPDATE — mas SÓ em linhas ainda
--    'parcial'. Depois de virar 'completo', nenhum anon consegue mexer.
--    (O id é um uuid aleatório não-enumerável → superfície de ataque baixa.)
drop policy if exists "anon_update_parcial" on leads;
create policy "anon_update_parcial" on leads
  for update to anon
  using (status = 'parcial')
  with check (true);

-- 3) Índices pra ordenar/filtrar no painel -----------------------------
create index if not exists leads_temperatura_idx on leads (temperatura);
create index if not exists leads_status_idx      on leads (status);
create index if not exists leads_created_idx      on leads (created_at desc);
