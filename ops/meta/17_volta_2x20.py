"""
17 — Volta pra 2 conjuntos x R$20/dia. Caixa curto, foco em converter.

    python ops/meta/17_volta_2x20.py            -> simula
    python ops/meta/17_volta_2x20.py --executar

O QUE OS DADOS MOSTRARAM:

  29/07  2 conjuntos x R$25   R$70,00    847 impr   4 leads   CPL R$17,50
  30/07  6 conjuntos x R$10   R$79,50   1067 impr   0 leads   ---

Gastou MAIS, entregou MAIS impressao e nao trouxe lead nenhum. Fragmentar em
R$10 deixa cada conjunto sem volume pro algoritmo aprender quem converte:
seis pedacos pequenos, seis algoritmos cegos.

REATIVA OS ORIGINAIS em vez de criar novos — de proposito. Eles ja carregam o
historico que produziu os 4 leads; conjunto novo comeca do zero de novo, e o
aprendizado ja foi reiniciado duas vezes em tres dias.

R$20 fica perto dos R$25 que funcionaram, nao dos R$10 que falharam.
As 3 copys ficam dentro de cada conjunto competindo entre si: a Meta empurra
a melhor, e o desempenho de cada uma continua visivel no relatorio.
"""
import sys

from _common import brl, carregar_env, chamar

env = carregar_env()
V2 = "120253640982840667"
NOVO = 2000  # CENTAVOS = R$20,00/dia
ORIGINAIS = {"br_donos_negocio", "br_interesses_pme"}
EXECUTAR = "--executar" in sys.argv

adsets = chamar("GET", f"/{V2}/adsets", env,
                {"fields": "id,name,status,daily_budget", "limit": 30}).get("data", [])

voltam = [a for a in adsets if a["name"] in ORIGINAIS]
saem = [a for a in adsets if a["name"] not in ORIGINAIS and a["status"] == "ACTIVE"]

print("REATIVAR (ja tem historico de conversao):")
for a in voltam:
    print(f"  {a['name']}: {brl(a.get('daily_budget',0))} -> {brl(NOVO)}/dia")
print(f"\nPAUSAR (fragmentados, 0 leads em R$79,50):")
for a in saem:
    print(f"  {a['name']}")
print(f"\ntotal depois: {brl(NOVO * len(voltam))}/dia")

if not EXECUTAR:
    print("\n--- SIMULACAO ---")
    print("aplicar: python ops/meta/17_volta_2x20.py --executar")
    raise SystemExit(0)

print("\naplicando...")
# orçamento primeiro, depois ativa: evita um instante rodando com o valor antigo
for a in voltam:
    chamar("POST", f"/{a['id']}", env, dados={"daily_budget": NOVO, "status": "ACTIVE"})
    print(f"  [ativo] {a['name']} {brl(NOVO)}/dia")

for a in saem:
    chamar("POST", f"/{a['id']}", env, dados={"status": "PAUSED"})
    print(f"  [pausado] {a['name']}")

print("\n--- estado final ---")
total = 0
for a in chamar("GET", f"/{V2}/adsets", env,
                {"fields": "name,status,effective_status,daily_budget", "limit": 30}).get("data", []):
    if a["status"] == "ACTIVE":
        total += int(a.get("daily_budget") or 0)
        print(f"  [{a.get('effective_status'):<12}] {a['name']:<22} {brl(a.get('daily_budget',0))}/dia")
print(f"\nTOTAL/DIA: {brl(total)}")
c = chamar("GET", f"/{env['META_AD_ACCOUNT_ID']}", env, {"fields": "amount_spent,spend_cap"})
print(f"gasto {brl(c.get('amount_spent',0))} | teto {brl(c.get('spend_cap',0))}")
