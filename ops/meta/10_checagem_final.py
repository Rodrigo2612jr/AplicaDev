"""
10 — Checagem final antes do lançamento. SOMENTE LEITURA.

    python ops/meta/10_checagem_final.py

Confere de uma vez o que precisa estar certo às 00h: teto, agendamento,
status de cada nível, e se o texto de cada anúncio está acentuado (os
primeiros criativos subiram sem acento).
"""
from _common import brl, carregar_env, chamar

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]
CAMPANHA = "AD_LEADS_ESTRUTURA_BR_v1"

problemas = []

conta = chamar("GET", f"/{ACT}", env, {"fields": "spend_cap,amount_spent,account_status"})
cap = int(conta["spend_cap"]) if conta.get("spend_cap") else 0
print(f"teto {brl(cap) if cap else 'SEM TETO'} | gasto {brl(conta.get('amount_spent', 0))}")
if not cap:
    problemas.append("conta sem teto de gasto")

camps = [c for c in chamar("GET", f"/{ACT}/campaigns", env,
                           {"fields": "id,name,status,daily_budget", "limit": 50}).get("data", [])
         if c["name"] == CAMPANHA]
if not camps:
    raise SystemExit("campanha nao encontrada")
c = camps[0]
print(f"\ncampanha: [{c['status']}] {c['name']} | CBO {brl(c.get('daily_budget', 0))}/dia")
if c["status"] != "ACTIVE":
    problemas.append(f"campanha esta {c['status']}, deveria ser ACTIVE")

ACENTOS = "áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ"
total = 0
for a in chamar("GET", f"/{c['id']}/adsets", env,
                {"fields": "id,name,status,start_time,end_time", "limit": 20}).get("data", []):
    print(f"\n  [{a['status']}] {a['name']}")
    print(f"     {a.get('start_time')} -> {a.get('end_time')}")
    if a["status"] != "ACTIVE":
        problemas.append(f"conjunto {a['name']} esta {a['status']}")
    if not a.get("start_time") or not a.get("end_time"):
        problemas.append(f"conjunto {a['name']} sem janela definida")

    for ad in chamar("GET", f"/{a['id']}/ads", env,
                     {"fields": "id,name,status,creative{object_story_spec}",
                      "limit": 20}).get("data", []):
        total += 1
        vd = ((ad.get("creative") or {}).get("object_story_spec") or {}).get("video_data") or {}
        msg = vd.get("message") or ""
        primeira = msg.split("\n")[0]
        ok_acento = any(ch in msg for ch in ACENTOS)
        print(f"     [{ad['status']}] {ad['name']:<18} {'ok' if ok_acento else 'SEM ACENTO'} | "
              f"1a linha {len(primeira)} chars")
        if not ok_acento:
            problemas.append(f"anuncio {a['name']}/{ad['name']} sem acentuacao")
        if len(primeira) > 125:
            problemas.append(f"anuncio {a['name']}/{ad['name']}: 1a linha corta no 'ver mais'")
        if ad["status"] != "ACTIVE":
            problemas.append(f"anuncio {a['name']}/{ad['name']} esta {ad['status']}")

print(f"\ntotal: {total} anuncios")
if total != 9:
    problemas.append(f"esperado 9 anuncios, encontrado {total}")

ins = chamar("GET", f"/{c['id']}/insights", env, {"fields": "impressions,spend"}).get("data", [])
print(f"entrega ate agora: {'NENHUMA (correto antes de 27/07)' if not ins else ins[0]}")

print("\n" + "=" * 60)
if problemas:
    print("PROBLEMAS:")
    for p in problemas:
        print(f"  !! {p}")
else:
    print("Tudo certo. Sobe as 00h e encerra sozinha em 30/07.")
