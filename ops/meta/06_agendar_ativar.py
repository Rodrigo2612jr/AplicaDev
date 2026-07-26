"""
06 — Agenda a janela de teste e ATIVA a estrutura.

    python ops/meta/06_agendar_ativar.py            -> mostra o plano, nao altera
    python ops/meta/06_agendar_ativar.py --executar -> aplica

ESTE E O UNICO SCRIPT QUE FAZ DINHEIRO SAIR. Por isso:
  - a janela e fechada: comeca 27/07 00:00 e ENCERRA 30/07 00:00 (72h)
  - o fim e cravado na propria Meta (end_time), nao depende de alguem
    lembrar de pausar. Se ninguem tocar em nada, gasta ~R$150 e para.
  - o teto de conta (R$1.000) continua valendo por cima disso.

Fuso da conta: America/Sao_Paulo (GMT-3). Datas vao com offset explicito,
senao a Meta agenda em outro horario.
"""
import sys

from _common import brl, carregar_env, chamar

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]
EXECUTAR = "--executar" in sys.argv

INICIO = "2026-07-27T00:00:00-0300"   # segunda 00h
FIM = "2026-07-30T00:00:00-0300"      # quinta 00h — 72h exatas
CAMPANHA = "AD_LEADS_ESTRUTURA_BR_v1"

camps = [c for c in chamar("GET", f"/{ACT}/campaigns", env,
                           {"fields": "id,name,status,daily_budget", "limit": 50}).get("data", [])
         if c["name"] == CAMPANHA]
if not camps:
    raise SystemExit(f"campanha {CAMPANHA} nao encontrada")
camp = camps[0]
diario = int(camp.get("daily_budget", 0))

adsets = chamar("GET", f"/{camp['id']}/adsets", env,
                {"fields": "id,name,status,start_time,end_time", "limit": 50}).get("data", [])

print(f"campanha {camp['name']} ({camp['id']})")
print(f"orcamento CBO: {brl(diario)}/dia")
print(f"janela: {INICIO}  ->  {FIM}   (72h)")
print(f"gasto previsto no periodo: {brl(diario * 3)}")
print(f"conjuntos: {len(adsets)}")

if not EXECUTAR:
    print("\n--- SIMULACAO (nada foi alterado) ---")
    for a in adsets:
        print(f"  {a['name']}: {a['status']} -> ACTIVE, agendado")
    print("\npara aplicar: python ops/meta/06_agendar_ativar.py --executar")
    raise SystemExit(0)

# ── 1) anuncios primeiro ───────────────────────────────────────────────────
# Ordem proposital: anuncio -> conjunto -> campanha. Assim, em qualquer ponto
# que der erro, o nivel de cima ainda esta pausado e nada veicula.
print("\n[1] ativando anuncios")
n_ads = 0
for a in adsets:
    ads = chamar("GET", f"/{a['id']}/ads", env, {"fields": "id,name,status", "limit": 50}).get("data", [])
    for ad in ads:
        chamar("POST", f"/{ad['id']}", env, dados={"status": "ACTIVE"})
        n_ads += 1
        print(f"    {a['name']} / {ad['name']}")

# ── 2) conjuntos: so ativa ────────────────────────────────────────────────
# A janela JA vem da criacao (04). Nao tentar editar start_time aqui: depois
# que o conjunto "inicia", a Meta recusa com subcode 1487057.
print("\n[2] ativando conjuntos (janela ja definida na criacao)")
for a in adsets:
    if not a.get("start_time"):
        raise SystemExit(f"{a['name']} sem start_time — recrie com o 04 antes de ativar")
    chamar("POST", f"/{a['id']}", env, dados={"status": "ACTIVE"})
    print(f"    {a['name']}: {a.get('start_time')} -> {a.get('end_time')}")

# ── 3) campanha por ultimo ────────────────────────────────────────────────
print("\n[3] ativando campanha")
chamar("POST", f"/{camp['id']}", env, dados={"status": "ACTIVE"})
print(f"    {camp['name']}")

# ── conferencia ────────────────────────────────────────────────────────────
print("\n--- conferindo ---")
for a in chamar("GET", f"/{camp['id']}/adsets", env,
                {"fields": "name,status,effective_status,start_time,end_time", "limit": 50}).get("data", []):
    print(f"  {a['name']}: {a['status']} / efetivo {a.get('effective_status')}")
    print(f"     inicio {a.get('start_time')} | fim {a.get('end_time')}")

conta = chamar("GET", f"/{ACT}", env, {"fields": "amount_spent,spend_cap"})
print(f"\ngasto ate agora: {brl(conta.get('amount_spent', 0))}")
print(f"teto da conta:   {brl(conta.get('spend_cap', 0))}")
print(f"\n{n_ads} anuncios ativos, AGENDADOS. Nada veicula antes de {INICIO}.")
