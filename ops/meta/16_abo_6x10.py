"""
16 — Estrutura final: 6 conjuntos x R$10/dia (ABO), 1 anúncio em cada.

    python ops/meta/16_abo_6x10.py            -> simula
    python ops/meta/16_abo_6x10.py --executar --ativar

2 públicos (donos_negocio, interesses_pme) x 3 copys = 6 conjuntos.
Cada anúncio com verba própria e travada, pra dar pra comparar um por um.

RESSALVA JÁ FEITA E REAFIRMADA: os dois conjuntos de R$25 levaram 3 dias pra
sair do aprendizado e só então vieram os 4 primeiros leads (CPL ~R$24, CTR
5-6%). Fragmentar em 6 pedaços de R$10 reinicia esse aprendizado. É a decisão
dele, com o dado na mesa.

Também limpa as 2 cópias em rascunho que sobraram da tentativa pela interface
(ficaram com orçamento R$0 e nome repetido, o que confunde o relatório).

ECONOMIA DE CHAMADAS: este script foi escrito pra fazer o mínimo de requests.
O bloqueio da conta de desenvolvedor em 28/07 veio de volume excessivo de
chamadas — muitas eram verificação redundante depois de cada passo.
"""
import sys

from _common import brl, carregar_env, chamar

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]
PIXEL = env["META_PIXEL_ID"]
V2 = "120253640982840667"
POR_CONJUNTO = 1000  # CENTAVOS = R$10,00/dia

EXECUTAR = "--executar" in sys.argv
ATIVAR = "--ativar" in sys.argv

PLATAFORMAS = ["facebook", "instagram"]
POS_FB = ["feed", "facebook_reels", "story"]
POS_IG = ["stream", "reels", "story", "explore"]

# ── 1 chamada: tudo que existe na v2 ──────────────────────────────────────
adsets = chamar("GET", f"/{V2}/adsets", env, {
    "fields": "id,name,status,daily_budget,targeting", "limit": 50,
}).get("data", [])

# os originais de R$25 são a fonte de targeting; as cópias em rascunho têm R$0
origens = [a for a in adsets if int(a.get("daily_budget") or 0) == 2500]
lixo = [a for a in adsets if int(a.get("daily_budget") or 0) == 0]
prontos = [a for a in adsets if int(a.get("daily_budget") or 0) == POR_CONJUNTO]

print(f"origens (R$25):   {[a['name'] for a in origens]}")
print(f"rascunho (R$0):   {[a['name'] for a in lixo]}  -> remover")
print(f"ja em R$10:       {[a['name'] for a in prontos]}")

if len(origens) != 2:
    raise SystemExit(f"esperava 2 conjuntos de R$25, achei {len(origens)}. Abortando.")

# ── 1 chamada por origem: os anúncios dela ────────────────────────────────
plano = []
for a in origens:
    ads = chamar("GET", f"/{a['id']}/ads", env,
                 {"fields": "name,creative{id}", "limit": 10}).get("data", [])
    curto = a["name"].replace("br_", "").replace("_negocio", "").replace("interesses_", "")
    for ad in ads:
        plano.append({
            "conjunto": f"{curto}__{ad['name'].replace('copy_', '')}",
            "targeting": a.get("targeting") or {},
            "anuncio": ad["name"],
            "creative": (ad.get("creative") or {}).get("id"),
        })

print(f"\n{len(plano)} conjuntos de {brl(POR_CONJUNTO)}/dia = {brl(POR_CONJUNTO*len(plano))}/dia")
for p in plano:
    print(f"  {p['conjunto']:<22} <- {p['anuncio']} (criativo {p['creative']})")

if not EXECUTAR:
    print("\n--- SIMULACAO ---")
    print("aplicar: python ops/meta/16_abo_6x10.py --executar --ativar")
    raise SystemExit(0)

# ── limpa o rascunho ──────────────────────────────────────────────────────
print("\nremovendo rascunhos...")
for a in lixo:
    chamar("POST", f"/{a['id']}", env, dados={"status": "DELETED"})
    print(f"  removido {a['name']} ({a['id']})")

# ── cria os 6 ─────────────────────────────────────────────────────────────
existentes = {a["name"] for a in adsets}
print("\ncriando...")
novos = []
for p in plano:
    if p["conjunto"] in existentes:
        print(f"  [existe] {p['conjunto']}")
        continue
    t = dict(p["targeting"])
    t["publisher_platforms"] = PLATAFORMAS
    t["facebook_positions"] = POS_FB
    t["instagram_positions"] = POS_IG
    t.pop("targeting_automation", None)

    r = chamar("POST", f"/{ACT}/adsets", env, dados={
        "campaign_id": V2,
        "name": p["conjunto"],
        "status": "ACTIVE" if ATIVAR else "PAUSED",
        "daily_budget": POR_CONJUNTO,
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "OFFSITE_CONVERSIONS",
        "destination_type": "WEBSITE",
        "promoted_object": {"pixel_id": PIXEL, "custom_event_type": "LEAD"},
        "attribution_spec": [
            {"event_type": "CLICK_THROUGH", "window_days": 7},
            {"event_type": "VIEW_THROUGH", "window_days": 1},
        ],
        "targeting": t,
        # sem end_time: roda até pausar. Teto da conta (R$1.000) protege.
    })
    chamar("POST", f"/{ACT}/ads", env, dados={
        "name": p["anuncio"],
        "adset_id": r["id"],
        "creative": {"creative_id": p["creative"]},
        "status": "ACTIVE" if ATIVAR else "PAUSED",
        "conversion_domain": "aplicadev.com.br",
    })
    novos.append(r["id"])
    print(f"  {p['conjunto']} -> {r['id']}")

# ── pausa os dois de R$25 e liga a campanha ───────────────────────────────
if ATIVAR:
    print("\npausando os de R$25...")
    for a in origens:
        chamar("POST", f"/{a['id']}", env, dados={"status": "PAUSED"})
        print(f"  [pausado] {a['name']}")
    chamar("POST", f"/{V2}", env, dados={"status": "ACTIVE"})
    print("\ncampanha v2 ATIVADA")

# ── 1 chamada final de conferência ────────────────────────────────────────
print("\n--- estado final ---")
total = 0
for a in chamar("GET", f"/{V2}/adsets", env,
                {"fields": "name,status,effective_status,daily_budget", "limit": 50}).get("data", []):
    if a["status"] == "ACTIVE":
        total += int(a.get("daily_budget") or 0)
        print(f"  [{a.get('effective_status'):<16}] {a['name']:<22} {brl(a.get('daily_budget',0))}/dia")
    else:
        print(f"  [{a['status']:<16}] {a['name']}")
print(f"\nTOTAL/DIA: {brl(total)}")
