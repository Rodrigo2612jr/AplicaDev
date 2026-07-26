"""
05 — Raio-x da conta. SOMENTE LEITURA.

    python ops/meta/05_status.py

Mostra a arvore campanha > conjunto > anuncio com status e gasto, e confere
o que mais importa antes de ativar: nada veiculando sem querer, evento de
otimizacao certo, e o link de destino de cada anuncio.
"""
from _common import brl, carregar_env, chamar

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]

conta = chamar("GET", f"/{ACT}", env,
               {"fields": "name,spend_cap,amount_spent,currency,account_status"})
cap = int(conta["spend_cap"]) if conta.get("spend_cap") else 0
print(f"conta {conta.get('name')} | teto {brl(cap) if cap else 'SEM TETO'} | "
      f"gasto {brl(conta.get('amount_spent', 0))}")
print("=" * 68)

ativos = []
camps = chamar("GET", f"/{ACT}/campaigns", env,
               {"fields": "id,name,status,effective_status,objective,daily_budget,bid_strategy",
                "limit": 50}).get("data", [])

for c in camps:
    orc = f" | CBO {brl(c['daily_budget'])}/dia" if c.get("daily_budget") else ""
    print(f"\n[{c['status']}] {c['name']}  ({c.get('objective')}){orc}")
    print(f"        id {c['id']} | efetivo: {c.get('effective_status')}")
    if c["status"] == "ACTIVE":
        ativos.append(f"campanha {c['name']}")

    adsets = chamar("GET", f"/{c['id']}/adsets", env,
                    {"fields": "id,name,status,effective_status,optimization_goal,"
                               "promoted_object,targeting,daily_budget", "limit": 50}).get("data", [])
    for a in adsets:
        po = a.get("promoted_object") or {}
        evento = po.get("custom_event_type", "-")
        tg = a.get("targeting") or {}
        paises = (tg.get("geo_locations") or {}).get("countries", [])
        idade = f"{tg.get('age_min', '?')}-{tg.get('age_max', 'auto')}"
        adv = (tg.get("targeting_automation") or {}).get("advantage_audience")
        print(f"\n   [{a['status']}] {a['name']}")
        print(f"        {a.get('optimization_goal')} / evento {evento} | "
              f"{','.join(paises)} {idade} | Advantage+ {'ON' if adv else 'off'}")
        if a["status"] == "ACTIVE":
            ativos.append(f"conjunto {a['name']}")

        ads = chamar("GET", f"/{a['id']}/ads", env,
                     {"fields": "id,name,status,effective_status,creative{id,object_story_spec}",
                      "limit": 50}).get("data", [])
        for ad in ads:
            spec = ((ad.get("creative") or {}).get("object_story_spec") or {})
            cta = ((spec.get("video_data") or {}).get("call_to_action") or {})
            link = (cta.get("value") or {}).get("link", "-")
            marca = "" if ad["status"] == "PAUSED" else "  <<< ATIVO"
            print(f"        [{ad['status']}] {ad['name']}{marca}")
            print(f"              {link}")
            if ad["status"] == "ACTIVE":
                ativos.append(f"anuncio {ad['name']}")

print("\n" + "=" * 68)
if ativos:
    print(f"ATENCAO — {len(ativos)} objeto(s) ATIVO(S):")
    for x in ativos:
        print(f"  !! {x}")
else:
    print("Nada ativo. Nenhum centavo sai daqui sem alguem clicar em ativar.")
