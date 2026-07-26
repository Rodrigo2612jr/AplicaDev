"""
Remove os conjuntos da campanha de teste (e os anuncios dentro deles).

Necessario porque a Meta nao deixa editar start_time depois que o conjunto
"iniciou" — a unica saida e recriar ja nascendo agendado.

So roda se o conjunto nunca gastou nada. Se gastou, aborta.
"""
import sys

from _common import brl, carregar_env, chamar

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]
CAMPANHA = "AD_LEADS_ESTRUTURA_BR_v1"
EXECUTAR = "--executar" in sys.argv

camps = [c for c in chamar("GET", f"/{ACT}/campaigns", env,
                           {"fields": "id,name", "limit": 50}).get("data", [])
         if c["name"] == CAMPANHA]
if not camps:
    raise SystemExit("campanha nao encontrada")
camp = camps[0]

adsets = chamar("GET", f"/{camp['id']}/adsets", env,
                {"fields": "id,name,status,start_time", "limit": 50}).get("data", [])

total_gasto = 0
for a in adsets:
    ins = chamar("GET", f"/{a['id']}/insights", env, {"fields": "spend"}).get("data", [])
    gasto = float(ins[0]["spend"]) if ins else 0.0
    total_gasto += gasto
    print(f"  {a['name']} ({a['id']}) — {a['status']} — gasto R$ {gasto:.2f}")

if total_gasto > 0:
    raise SystemExit(f"\nABORTADO: ja houve gasto (R$ {total_gasto:.2f}). Nao vou apagar historico.")

print(f"\nnenhum gasto registrado — seguro remover {len(adsets)} conjuntos")
if not EXECUTAR:
    print("para aplicar: python ops/meta/_limpar_adsets.py --executar")
    raise SystemExit(0)

for a in adsets:
    chamar("POST", f"/{a['id']}", env, dados={"status": "DELETED"})
    print(f"  removido: {a['name']}")

conta = chamar("GET", f"/{ACT}", env, {"fields": "amount_spent"})
print(f"\ngasto da conta: {brl(conta.get('amount_spent', 0))}")
