"""
07 — Cria os Publicos Personalizados (Custom Audiences).

    python ops/meta/07_publicos.py --validar   -> mostra o que faria
    python ops/meta/07_publicos.py             -> cria (idempotente)

POR QUE ISSO E URGENTE, mesmo os publicos nascendo VAZIOS:
um Custom Audience so acumula gente A PARTIR do momento em que existe.
Nao da pra "pedir os visitantes da semana passada" depois. Se a campanha
sobe as 00h sem eles, os 3 dias de trafego somem — e retargeting e o
publico mais barato que existe, alem de ser a base do Lookalike.

Nao gasta nada. Nao mexe na campanha (nao reinicia aprendizado).
"""
import sys

from _common import carregar_env, chamar

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]
PIXEL = env["META_PIXEL_ID"]
VALIDAR = "--validar" in sys.argv

RETENCAO = 180                    # dias (maximo p/ publico de site)
SEG = RETENCAO * 24 * 60 * 60


def regra_evento(evento):
    """Quem disparou determinado evento do pixel."""
    return {
        "event_sources": [{"id": PIXEL, "type": "pixel"}],
        "retention_seconds": SEG,
        "filter": {"operator": "and",
                   "filters": [{"field": "event", "operator": "eq", "value": evento}]},
    }


PUBLICOS = [
    {
        "name": "aud_visitou_site_180d",
        "description": "Qualquer PageView na landing nos ultimos 180 dias. Base mais ampla.",
        "rule": {"inclusions": {"operator": "or", "rules": [regra_evento("PageView")]}},
    },
    {
        "name": "aud_iniciou_diagnostico_180d",
        "description": "Disparou DiagStart (saiu da intro do formulario). Interesse demonstrado.",
        "rule": {"inclusions": {"operator": "or", "rules": [regra_evento("DiagStart")]}},
    },
    {
        # O mais valioso pra retargeting: mostrou interesse e nao terminou.
        "name": "aud_abandonou_diagnostico_180d",
        "description": "Comecou o diagnostico mas NAO completou. O publico mais quente pra retargeting.",
        "rule": {
            "inclusions": {"operator": "or", "rules": [regra_evento("DiagStart")]},
            "exclusions": {"operator": "or", "rules": [regra_evento("CompleteRegistration")]},
        },
    },
    {
        "name": "aud_lead_completo_180d",
        "description": "Completou o diagnostico. Serve de semente pro Lookalike e p/ EXCLUIR da prospeccao.",
        "rule": {"inclusions": {"operator": "or", "rules": [regra_evento("CompleteRegistration")]}},
    },
]

print(f"conta {ACT} | pixel {PIXEL} | retencao {RETENCAO} dias\n")

existentes = {a["name"]: a["id"] for a in chamar(
    "GET", f"/{ACT}/customaudiences", env,
    {"fields": "id,name,approximate_count_lower_bound", "limit": 200}).get("data", [])}

if VALIDAR:
    for p in PUBLICOS:
        marca = "JA EXISTE" if p["name"] in existentes else "criaria"
        print(f"[{marca}] {p['name']}")
        print(f"    {p['description']}")
    raise SystemExit(0)

for p in PUBLICOS:
    if p["name"] in existentes:
        print(f"[ja existe] {p['name']} -> {existentes[p['name']]}")
        continue
    # Sem "subtype": na v25.0 a API recusa o parametro (code 2654 / subcode
    # 1870053 "O parametro subtipo nao e aceito na versao atual da API").
    # O proprio `rule` ja define que e publico de site.
    r = chamar("POST", f"/{ACT}/customaudiences", env, dados={
        "name": p["name"],
        "description": p["description"],
        "rule": p["rule"],
        # prefill: aproveita o que o pixel ja registrou desde a instalacao
        "prefill": True,
    })
    print(f"[criado] {p['name']} -> {r.get('id')}")

print("\nPublicos comecam a acumular a partir de agora.")
print("Lookalike so faz sentido com ~100 pessoas na semente — checar em ~30 dias.")
