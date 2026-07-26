"""
02 — Trava de gasto da conta. A protecao que vale mais que qualquer cuidado
no codigo: e a Meta que para de veicular ao bater o teto.

    python ops/meta/02_spend_cap.py            -> mostra o estado atual
    python ops/meta/02_spend_cap.py 1000       -> define teto de R$1.000
    python ops/meta/02_spend_cap.py --reset    -> zera o acumulado (usar todo mes)
    python ops/meta/02_spend_cap.py --remover  -> tira o teto

═══ A ARMADILHA (documentada pela Meta, e nada intuitiva) ═══
  ESCRITA: spend_cap vai em REAIS      -> spend_cap=1000    significa R$1.000,00
  LEITURA: spend_cap volta em CENTAVOS -> "100000" (string) significa R$1.000,00
E o teto NAO e mensal: ele e cumulativo contra `amount_spent` desde que voce o
definiu. Para usar como teto MENSAL, rode --reset no primeiro dia de cada mes.
(Comparar: o daily_budget da campanha vai em CENTAVOS. As duas unidades convivem.)
"""
import sys

from _common import brl, carregar_env, chamar

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]
arg = sys.argv[1] if len(sys.argv) > 1 else None


def estado():
    c = chamar("GET", f"/{ACT}", env,
               {"fields": "name,currency,spend_cap,amount_spent,account_status"})
    # ausente (nao 0) quando nao ha cap definido
    cap = int(c["spend_cap"]) if c.get("spend_cap") else 0
    gasto = int(c.get("amount_spent", 0))
    print(f"\n  conta:  {c.get('name')} ({c.get('currency')})")
    print(f"  teto:   {brl(cap) if cap else 'NAO DEFINIDO'}")
    print(f"  gasto:  {brl(gasto)}" + (f"  ({gasto / cap * 100:.1f}% do teto)" if cap else ""))
    if cap and gasto >= cap:
        print(f"  !! TETO ATINGIDO — a Meta ja pausou tudo. Rode --reset pra liberar.")
    elif cap:
        print(f"  resta:  {brl(cap - gasto)}")
    return cap, gasto


if arg is None:
    print("Estado atual (nada foi alterado):")
    estado()
    print("\n  para definir:  python ops/meta/02_spend_cap.py 1000")
    raise SystemExit(0)

if arg == "--reset":
    # spend_cap_action=reset zera amount_spent contra o cap. E assim que se
    # recicla o teto todo mes, e tambem como se destrava conta pausada por cap.
    print("Zerando o gasto acumulado contra o teto...")
    chamar("POST", f"/{ACT}", env, dados={"spend_cap_action": "reset"})
    print("  reset OK")
    estado()
    raise SystemExit(0)

if arg == "--remover":
    # Remover exige spend_cap_action=delete. Mandar spend_cap=0 NAO e o caminho
    # documentado ('0 = sem limite' descreve o estado de leitura, nao a acao).
    resp = input("Remover a trava de gasto desta conta? (digite SIM): ")
    if resp.strip() != "SIM":
        raise SystemExit("cancelado")
    chamar("POST", f"/{ACT}", env, dados={"spend_cap_action": "delete"})
    print("  teto removido")
    estado()
    raise SystemExit(0)

# definir valor -------------------------------------------------------------
try:
    reais = float(arg.replace(",", "."))
except ValueError:
    raise SystemExit(f"valor invalido: {arg}")

if reais <= 0:
    raise SystemExit("use --remover para tirar o teto")

cap_atual, gasto = estado()
print(f"\n  novo teto: {brl(int(round(reais * 100)))}")
if gasto and gasto >= reais * 100:
    print(f"  ATENCAO: o gasto acumulado ({brl(gasto)}) ja e maior que o novo teto.")
    print(f"           a conta vai pausar na hora. Rode --reset depois se for o caso.")

resp = input("  confirma? (digite SIM): ")
if resp.strip() != "SIM":
    raise SystemExit("cancelado")

# ESCRITA EM REAIS (float), nao centavos
chamar("POST", f"/{ACT}", env, dados={"spend_cap": reais})
print("  definido.")
estado()
print("\n  lembrete: rode --reset no dia 1 de cada mes pra reciclar o teto.")
