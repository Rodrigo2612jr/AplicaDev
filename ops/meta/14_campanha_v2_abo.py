"""
14 — Campanha v2: ABO, sem Audience Network, R$25/dia por conjunto.

    python ops/meta/14_campanha_v2_abo.py            -> simula
    python ops/meta/14_campanha_v2_abo.py --executar -> cria (PAUSADA)
    python ops/meta/14_campanha_v2_abo.py --executar --ativar

POR QUE CAMPANHA NOVA: nao existe caminho de API pra migrar CBO -> ABO numa
campanha existente. Zerar o orcamento da campanha e recusado (subcode 1885650,
"orcamento minimo R$10,24") e definir nos dois niveis tambem (subcode 1885621).
A unica saida e uma campanha que ja nasce sem CBO.

O QUE MUDA EM RELACAO A v1:
  ABO             cada conjunto com R$25/dia FIXO. No dia 1, o CBO mandou 72%
                  da verba pro conjunto de PIOR CTR — com ABO isso nao acontece.
  posicionamento  so Facebook e Instagram. Fora o Audience Network, que levou
                  68% das impressoes a 2,4% de CTR, incluindo 91 impressoes
                  em video premiado dentro de jogo.
  sem Advantage+  o conjunto amplo com publico automatico foi o que teve pior
                  CTR e comeu a verba. Fica so o que e segmentado.

MANTIDO: otimizacao por LEAD (o objetivo e lead que fecha), os criativos ja
corrigidos (acentuacao, concordancia, abertura), e as UTMs por conjunto/copy.

Reaproveita os criativos existentes: nao recria video nem texto.
"""
import json
import sys

from _common import brl, carregar_env, chamar

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]
PIXEL = env["META_PIXEL_ID"]
V1 = "120253599173060667"
NOME = "AD_LEADS_ESTRUTURA_BR_v2"
POR_CONJUNTO = 2500          # CENTAVOS = R$25,00/dia
FIM = "2026-07-30T00:00:00-0300"

EXECUTAR = "--executar" in sys.argv
ATIVAR = "--ativar" in sys.argv

# Só onde o dono de negócio consome conteúdo.
PLATAFORMAS = ["facebook", "instagram"]
POS_FB = ["feed", "facebook_reels", "story"]
POS_IG = ["stream", "reels", "story", "explore"]   # no targeting é "reels"

# ── lê da v1 o que já está pronto ─────────────────────────────────────────
QUERO = {"br_donos_negocio", "br_interesses_pme"}
origem = []
for a in chamar("GET", f"/{V1}/adsets", env,
                {"fields": "id,name,targeting,promoted_object", "limit": 10}).get("data", []):
    if a["name"] not in QUERO:
        continue
    ads = chamar("GET", f"/{a['id']}/ads", env,
                 {"fields": "name,creative{id}", "limit": 10}).get("data", [])
    origem.append({
        "nome": a["name"],
        "targeting": a.get("targeting") or {},
        "anuncios": [(ad["name"], (ad.get("creative") or {}).get("id")) for ad in ads],
    })

print(f"conjuntos a recriar: {len(origem)}")
for o in origem:
    print(f"  {o['nome']}: {len(o['anuncios'])} anuncios | {brl(POR_CONJUNTO)}/dia")
    for n, cid in o["anuncios"]:
        print(f"     {n} (criativo {cid})")

total = POR_CONJUNTO * len(origem)
print(f"\ntotal: {brl(total)}/dia | encerra {FIM}")

if not EXECUTAR:
    print("\n--- SIMULACAO. nada criado ---")
    print("aplicar: python ops/meta/14_campanha_v2_abo.py --executar")
    raise SystemExit(0)

# ── campanha SEM daily_budget: é isso que faz nascer ABO ──────────────────
existentes = [c for c in chamar("GET", f"/{ACT}/campaigns", env,
                                {"fields": "id,name", "limit": 50}).get("data", [])
              if c["name"] == NOME]
if existentes:
    camp_id = existentes[0]["id"]
    print(f"\n[1] campanha ja existe: {camp_id}")
else:
    r = chamar("POST", f"/{ACT}/campaigns", env, dados={
        "name": NOME,
        "objective": "OUTCOME_LEADS",
        "status": "PAUSED",
        "special_ad_categories": json.dumps([]),
        # sem daily_budget aqui = orçamento vive nos conjuntos (ABO)
        # A Meta exige declarar isso quando não há CBO (subcode 4834011).
        # False de propósito: com True ela pode remanejar 20% entre conjuntos,
        # que é exatamente o comportamento que causou o problema no dia 1 —
        # a verba escorreu toda pro conjunto de pior CTR. Aqui cada um fica
        # travado nos seus R$25/dia, e o teste fica justo.
        "is_adset_budget_sharing_enabled": "false",
    })
    camp_id = r["id"]
    print(f"\n[1] campanha criada (ABO): {camp_id}")

# ── conjuntos com orçamento próprio ───────────────────────────────────────
ja = {a["name"]: a["id"] for a in chamar("GET", f"/{camp_id}/adsets", env,
      {"fields": "id,name", "limit": 20}).get("data", [])}

for o in origem:
    if o["nome"] in ja:
        print(f"\n[2] conjunto {o['nome']} ja existe: {ja[o['nome']]}")
        adset_id = ja[o["nome"]]
    else:
        t = dict(o["targeting"])
        t["publisher_platforms"] = PLATAFORMAS
        t["facebook_positions"] = POS_FB
        t["instagram_positions"] = POS_IG
        # sem Advantage+ audience: no dia 1 foi o que teve pior CTR
        t.pop("targeting_automation", None)

        # criar ad set é em /act_<conta>/adsets com campaign_id no corpo.
        # /<campanha>/adsets só serve pra LEITURA — POST ali devolve
        # "Object does not exist ... does not support this operation".
        r = chamar("POST", f"/{ACT}/adsets", env, dados={
            "campaign_id": camp_id,
            "name": o["nome"],
            "status": "PAUSED",
            "daily_budget": POR_CONJUNTO,          # <- ABO
            # Sem CBO, a estratégia de lance tem que vir aqui. LOWEST_COST_
            # WITHOUT_CAP = "menor custo, sem teto de lance": a Meta busca o
            # resultado mais barato sem eu chutar um valor de lance. Qualquer
            # estratégia com teto exigiria bid_amount (subcode 2490487).
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
        print(f"\n[2] conjunto {o['nome']} criado: {adset_id} ({brl(POR_CONJUNTO)}/dia)")

    # ── anúncios reaproveitando os criativos já corrigidos ────────────────
    tem = {ad["name"] for ad in chamar("GET", f"/{adset_id}/ads", env,
           {"fields": "name", "limit": 20}).get("data", [])}
    for nome_ad, cid in o["anuncios"]:
        if nome_ad in tem:
            print(f"     {nome_ad} ja existe, pulando")
            continue
        r = chamar("POST", f"/{ACT}/ads", env, dados={
            "name": nome_ad,
            "adset_id": adset_id,
            "creative": {"creative_id": cid},
            "status": "PAUSED",
            "conversion_domain": "aplicadev.com.br",
        })
        print(f"     {nome_ad} -> {r['id']}")

if not ATIVAR:
    print("\n--- CRIADA E PAUSADA ---")
    print("revise e ative: python ops/meta/14_campanha_v2_abo.py --executar --ativar")
    raise SystemExit(0)

# ── ativação: anúncio -> conjunto -> campanha ─────────────────────────────
print("\n[3] ativando")
for a in chamar("GET", f"/{camp_id}/adsets", env, {"fields": "id,name", "limit": 20}).get("data", []):
    for ad in chamar("GET", f"/{a['id']}/ads", env, {"fields": "id,name", "limit": 20}).get("data", []):
        chamar("POST", f"/{ad['id']}", env, dados={"status": "ACTIVE"})
    chamar("POST", f"/{a['id']}", env, dados={"status": "ACTIVE"})
    print(f"     {a['name']}")
chamar("POST", f"/{camp_id}", env, dados={"status": "ACTIVE"})
print(f"     campanha {NOME}")

# ── pausa a v1 pra nao competir consigo mesma ─────────────────────────────
chamar("POST", f"/{V1}", env, dados={"status": "PAUSED"})
print("\n[4] campanha v1 PAUSADA (nao competir no mesmo leilao)")

print("\n--- estado final ---")
for a in chamar("GET", f"/{camp_id}/adsets", env,
                {"fields": "name,effective_status,daily_budget,end_time", "limit": 20}).get("data", []):
    print(f"  [{a.get('effective_status')}] {a['name']}: {brl(a.get('daily_budget', 0))}/dia -> {a.get('end_time')}")
conta = chamar("GET", f"/{ACT}", env, {"fields": "amount_spent,spend_cap"})
print(f"\ngasto ate agora: {brl(conta.get('amount_spent', 0))} | teto {brl(conta.get('spend_cap', 0))}")
