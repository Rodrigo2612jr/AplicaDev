"""
13 — Migra de CBO (orçamento na campanha) para ABO (orçamento por conjunto).

    python ops/meta/13_cbo_para_abo.py            -> simula
    python ops/meta/13_cbo_para_abo.py --executar -> aplica

POR QUE: com CBO a Meta decide como dividir. No dia 1 ela mandou 72% da
verba pro conjunto de PIOR CTR (br_amplo_adv, 2,32%), deixando migalhas pros
segmentados que performavam 5,26% e 14,29%. O algoritmo otimiza por custo,
nao por qualidade — e com verba curta isso vira ele comprando o inventario
mais barato que existe.

Com ABO cada conjunto tem R$25/dia garantido. O teste passa a ser justo:
mesmo orcamento, publicos diferentes, e no fim da pra comparar de verdade.

A Meta exige que o orcamento esteja em UM nivel: ou campanha, ou conjuntos.
Nunca nos dois, nunca em nenhum. Por isso a ordem aqui importa.
"""
import sys

from _common import brl, carregar_env, chamar

env = carregar_env()
CAMP = "120253599173060667"
POR_CONJUNTO = 2500  # CENTAVOS = R$25,00/dia em cada
EXECUTAR = "--executar" in sys.argv

c = chamar("GET", f"/{CAMP}", env, {"fields": "name,daily_budget,status"})
adsets = [a for a in chamar("GET", f"/{CAMP}/adsets", env,
                            {"fields": "id,name,status,daily_budget", "limit": 10}).get("data", [])
          if a["status"] == "ACTIVE"]

print(f"campanha: {c['name']}")
print(f"CBO hoje: {brl(c.get('daily_budget', 0))}/dia (a Meta divide como quiser)")
print(f"\nconjuntos ativos: {len(adsets)}")
for a in adsets:
    print(f"  {a['name']}: orcamento proprio {brl(a.get('daily_budget', 0)) if a.get('daily_budget') else '(nenhum, usa o da campanha)'}")

print(f"\ndepois: {brl(POR_CONJUNTO)}/dia FIXO em cada = {brl(POR_CONJUNTO * len(adsets))}/dia total")

if not EXECUTAR:
    print("\n--- SIMULACAO. nada alterado ---")
    print("para aplicar: python ops/meta/13_cbo_para_abo.py --executar")
    raise SystemExit(0)

print("\naplicando...\n")

# A ordem importa: a Meta recusa orcamento nos DOIS niveis ao mesmo tempo
# (subcode 1885621 "Voce so pode definir um orcamento de conjunto de anuncios
# ou um orcamento de campanha"). Entao o CBO tem que sair ANTES de os
# conjuntos ganharem o deles.
chamar("POST", f"/{CAMP}", env, dados={"daily_budget": 0})
print("  [CBO desligado] orcamento saiu da campanha")

for a in adsets:
    chamar("POST", f"/{a['id']}", env, dados={"daily_budget": POR_CONJUNTO})
    print(f"  [orcamento] {a['name']}: {brl(POR_CONJUNTO)}/dia")

print("\n--- conferindo ---")
c2 = chamar("GET", f"/{CAMP}", env, {"fields": "daily_budget,status,effective_status"})
print(f"campanha: CBO {brl(c2.get('daily_budget', 0))} | {c2.get('effective_status')}")
total = 0
for a in chamar("GET", f"/{CAMP}/adsets", env,
                {"fields": "name,status,effective_status,daily_budget", "limit": 10}).get("data", []):
    if a["status"] != "ACTIVE":
        print(f"  [{a['status']}] {a['name']}")
        continue
    total += int(a.get("daily_budget", 0))
    print(f"  [{a.get('effective_status')}] {a['name']}: {brl(a.get('daily_budget', 0))}/dia")
print(f"\ntotal por dia: {brl(total)}")
