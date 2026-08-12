"""
18 — Corta as copys que não convertem. Concentra na que traz lead.

    python ops/meta/18_corta_copys.py            -> simula
    python ops/meta/18_corta_copys.py --executar

DADOS DE 4 DIAS (27 a 30/07), por anúncio:

  copy_dependencia   R$65,49   4 leads   CPL R$16,37   <- unica que converte
  copy_indicacao     ~R$50     0 leads
  copy_tempo         ~R$38     0 leads

O detalhe que importa: copy_indicacao tem o MAIOR CTR do teste (7,6%, 8,3%,
chegou a 12,5%) e ZERO conversao. Ela desperta curiosidade, a pessoa clica e
nao preenche nada. Quem otimizasse por clique teria escalado justamente ela.

copy_dependencia ("Estoque na planilha, preco na cabeca, pedido no WhatsApp /
O sistema da sua empresa e voce") nao e a mais clicada, mas fala com quem tem
o problema doendo agora — e e a unica que faz alguem completar um formulario
de 11 passos.

Com caixa curto, R$88 em copy que nao converte e dinheiro que faz falta.
"""
import sys

from _common import brl, carregar_env, chamar

env = carregar_env()
V2 = "120253640982840667"
MANTER = "copy_dependencia"
EXECUTAR = "--executar" in sys.argv

alvo = []
for a in chamar("GET", f"/{V2}/adsets", env,
                {"fields": "id,name,status,daily_budget", "limit": 30}).get("data", []):
    if a["status"] != "ACTIVE":
        continue
    for ad in chamar("GET", f"/{a['id']}/ads", env,
                     {"fields": "id,name,status", "limit": 20}).get("data", []):
        alvo.append({"adset": a["name"], "orc": a.get("daily_budget", 0),
                     "id": ad["id"], "nome": ad["name"], "status": ad["status"]})

print("plano:\n")
for x in alvo:
    acao = "MANTER" if x["nome"] == MANTER else "pausar"
    print(f"  [{acao:<6}] {x['adset']:<20} {x['nome']}")

mantidos = [x for x in alvo if x["nome"] == MANTER]
print(f"\ndepois: {len(mantidos)} anuncio(s) ativo(s), "
      f"{brl(sum(int(x['orc']) for x in mantidos))}/dia concentrado neles")

if not EXECUTAR:
    print("\n--- SIMULACAO ---")
    print("aplicar: python ops/meta/18_corta_copys.py --executar")
    raise SystemExit(0)

print("\naplicando...")
for x in alvo:
    if x["nome"] == MANTER:
        if x["status"] != "ACTIVE":
            chamar("POST", f"/{x['id']}", env, dados={"status": "ACTIVE"})
            print(f"  [reativado] {x['adset']} / {x['nome']}")
        continue
    if x["status"] == "ACTIVE":
        chamar("POST", f"/{x['id']}", env, dados={"status": "PAUSED"})
        print(f"  [pausado] {x['adset']} / {x['nome']}")

print("\n--- estado final ---")
for a in chamar("GET", f"/{V2}/adsets", env,
                {"fields": "id,name,status,daily_budget", "limit": 30}).get("data", []):
    if a["status"] != "ACTIVE":
        continue
    print(f"\n  {a['name']}: {brl(a.get('daily_budget',0))}/dia")
    for ad in chamar("GET", f"/{a['id']}/ads", env,
                     {"fields": "name,status", "limit": 20}).get("data", []):
        marca = "<<<" if ad["status"] == "ACTIVE" else ""
        print(f"     [{ad['status']:<7}] {ad['name']} {marca}")
