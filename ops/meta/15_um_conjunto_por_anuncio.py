"""
15 — Um conjunto por anúncio: 6 conjuntos x R$10/dia = R$60/dia.

    python ops/meta/15_um_conjunto_por_anuncio.py            -> simula
    python ops/meta/15_um_conjunto_por_anuncio.py --executar --ativar

PEDIDO DO RODRIGO: R$10 em cada anúncio pra poder comparar um por um.
A Meta não tem orçamento no nível do anúncio (só campanha ou conjunto),
então o jeito de isolar é 1 conjunto por anúncio.

RESSALVA JÁ FEITA E REAFIRMADA POR ELE: com CPM de ~R$93, R$10/dia compra
~107 impressões/dia por conjunto. Otimização por conversão pede perto de 50
conversões/semana POR CONJUNTO pra sair do aprendizado. É provável que
vários conjuntos entreguem pouco ou nada. Em troca, a comparação entre
anúncios fica limpa: verba igual, sem a Meta remanejando.

Se depois de 1 dia algum conjunto não entregar, o certo é consolidar.

ATRIBUIÇÃO: os criativos existentes já servem sem alteração. Cada par
(público, copy) é único — utm_term diz o público e utm_content diz a copy —
então cada anúncio é identificável. As url_tags ainda mandam gid/aid com os
IDs reais de conjunto e anúncio.
"""
import sys

from _common import brl, carregar_env, chamar

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]
PIXEL = env["META_PIXEL_ID"]
V2 = "120253640982840667"
POR_CONJUNTO = 1000  # CENTAVOS = R$10,00/dia
FIM = "2026-07-30T00:00:00-0300"

EXECUTAR = "--executar" in sys.argv
ATIVAR = "--ativar" in sys.argv

PLATAFORMAS = ["facebook", "instagram"]
POS_FB = ["feed", "facebook_reels", "story"]
POS_IG = ["stream", "reels", "story", "explore"]

# ── lê os conjuntos atuais (2) e seus anúncios (3 cada) ───────────────────
atuais = []
for a in chamar("GET", f"/{V2}/adsets", env,
                {"fields": "id,name,status,targeting", "limit": 20}).get("data", []):
    ads = chamar("GET", f"/{a['id']}/ads", env,
                 {"fields": "name,creative{id}", "limit": 20}).get("data", [])
    atuais.append({"id": a["id"], "nome": a["name"], "status": a["status"],
                   "targeting": a.get("targeting") or {},
                   "anuncios": [(ad["name"], (ad.get("creative") or {}).get("id")) for ad in ads]})

# nome curto do público, pra não gerar nome de conjunto quilométrico
def curto(n):
    return n.replace("br_", "").replace("_negocio", "").replace("interesses_", "")

plano = []
for a in atuais:
    for nome_ad, cid in a["anuncios"]:
        plano.append({
            "conjunto": f"{curto(a['nome'])}__{nome_ad.replace('copy_', '')}",
            "targeting": a["targeting"],
            "anuncio": nome_ad,
            "creative": cid,
            "pai": a["nome"],
        })

print(f"{len(plano)} conjuntos de {brl(POR_CONJUNTO)}/dia = {brl(POR_CONJUNTO * len(plano))}/dia\n")
for p in plano:
    print(f"  {p['conjunto']:<24} 1 anuncio ({p['anuncio']}) | vem de {p['pai']}")

print(f"\nos 2 conjuntos atuais serao PAUSADOS:")
for a in atuais:
    print(f"  {a['nome']} ({a['status']})")

if not EXECUTAR:
    print("\n--- SIMULACAO. nada criado ---")
    print("aplicar: python ops/meta/15_um_conjunto_por_anuncio.py --executar --ativar")
    raise SystemExit(0)

ja = {a["name"]: a["id"] for a in chamar("GET", f"/{V2}/adsets", env,
      {"fields": "id,name", "limit": 30}).get("data", [])}

print("\ncriando...\n")
criados = []
for p in plano:
    if p["conjunto"] in ja:
        print(f"  [existe] {p['conjunto']}")
        criados.append(ja[p["conjunto"]])
        continue

    t = dict(p["targeting"])
    t["publisher_platforms"] = PLATAFORMAS
    t["facebook_positions"] = POS_FB
    t["instagram_positions"] = POS_IG

    r = chamar("POST", f"/{ACT}/adsets", env, dados={
        "campaign_id": V2,
        "name": p["conjunto"],
        "status": "PAUSED",
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
        "end_time": FIM,
    })
    adset_id = r["id"]
    criados.append(adset_id)
    print(f"  [conjunto] {p['conjunto']} -> {adset_id} ({brl(POR_CONJUNTO)}/dia)")

    ad = chamar("POST", f"/{ACT}/ads", env, dados={
        "name": p["anuncio"],
        "adset_id": adset_id,
        "creative": {"creative_id": p["creative"]},
        "status": "PAUSED",
        "conversion_domain": "aplicadev.com.br",
    })
    print(f"     anuncio {p['anuncio']} -> {ad['id']}")

if not ATIVAR:
    print("\n--- CRIADOS E PAUSADOS ---")
    raise SystemExit(0)

# ── ativa os novos e pausa os dois antigos ───────────────────────────────
print("\nativando os novos...")
for adset_id in criados:
    for ad in chamar("GET", f"/{adset_id}/ads", env, {"fields": "id", "limit": 5}).get("data", []):
        chamar("POST", f"/{ad['id']}", env, dados={"status": "ACTIVE"})
    chamar("POST", f"/{adset_id}", env, dados={"status": "ACTIVE"})
print(f"  {len(criados)} conjuntos ativos")

print("\npausando os dois antigos (senao a verba dobra)...")
for a in atuais:
    chamar("POST", f"/{a['id']}", env, dados={"status": "PAUSED"})
    print(f"  [pausado] {a['nome']}")

print("\n--- estado final ---")
total = 0
for a in chamar("GET", f"/{V2}/adsets", env,
                {"fields": "name,status,effective_status,daily_budget", "limit": 30}).get("data", []):
    if a["status"] == "ACTIVE":
        total += int(a.get("daily_budget", 0))
        print(f"  [{a.get('effective_status')}] {a['name']}: {brl(a.get('daily_budget',0))}/dia")
    else:
        print(f"  [{a['status']}] {a['name']}")
print(f"\nTOTAL/DIA: {brl(total)}")
