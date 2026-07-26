-- ═══════════════════════════════════════════════════════════════════
-- Migração v3 — Atribuição de campanha (tráfego pago)
-- Rodar UMA VEZ no SQL Editor do Supabase. Idempotente.
--
-- NÃO adiciona coluna: a `utm` já é jsonb desde a v2, então os campos
-- novos (plc/src/cid/gid/aid/fbc/fbp/event_id/referrer/landing) entram
-- sem migração. O que falta é ÍNDICE, pra agrupar lead por criativo
-- sem varrer a tabela inteira.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Índices de leitura de campanha --------------------------------------
--    utm_content = {{ad.name}}    → o CRIATIVO  (a pergunta principal)
--    utm_term    = {{adset.name}} → o CONJUNTO
create index if not exists leads_utm_content_idx on leads ((utm ->> 'utm_content'));
create index if not exists leads_utm_term_idx    on leads ((utm ->> 'utm_term'));
create index if not exists leads_utm_campaign_idx on leads ((utm ->> 'utm_campaign'));

-- 2) Índice composto p/ a pergunta que decide a verba ---------------------
--    "qual criativo traz lead QUENTE?" — não "qual traz lead barato".
create index if not exists leads_criativo_temp_idx
  on leads ((utm ->> 'utm_content'), temperatura);

-- 3) View de leitura rápida ----------------------------------------------
--    Mesma conta que o /admin faz no cliente, disponível no SQL Editor
--    pra cruzar com o gasto do Gerenciador de Anúncios.
create or replace view leads_por_criativo as
select
  coalesce(nullif(utm ->> 'utm_content', ''), '(organico/direto)') as criativo,
  coalesce(nullif(utm ->> 'utm_term', ''), '-')                    as conjunto,
  count(*)                                                          as leads,
  count(*) filter (where status = 'completo')                       as completos,
  count(*) filter (where temperatura = 'QUENTE')                    as quentes,
  count(*) filter (where temperatura = 'MORNO')                     as mornos,
  count(*) filter (where temperatura = 'FRIO')                      as frios,
  round(
    100.0 * count(*) filter (where temperatura = 'QUENTE') / nullif(count(*), 0)
  , 1)                                                              as pct_quente,
  min(created_at)                                                   as primeiro_lead,
  max(created_at)                                                   as ultimo_lead
from leads
group by 1, 2
order by quentes desc, leads desc;
