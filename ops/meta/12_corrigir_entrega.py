"""
12 — Corrige a entrega: tira o Audience Network e concentra a verba
     onde o CTR é bom.

    python ops/meta/12_corrigir_entrega.py            -> simula
    python ops/meta/12_corrigir_entrega.py --executar -> aplica

O QUE OS DADOS DO DIA 1 MOSTRARAM (27/07, ~18h, R$9,67 gastos):

  plataforma          gasto   impressoes   CTR
  audience_network   R$2,76      250 (68%)  2,40%   <- inventario barato
  instagram          R$4,12       60 (16%)  5,00%
  facebook           R$2,78       56 (15%)  7,14%

  conjunto            gasto   CTR
  br_amplo_adv       R$6,94   2,32%   <- 72% da verba, PIOR CTR
  br_donos_negocio   R$2,24   5,26%
  br_interesses_pme  R$0,95  14,29%

Duas causas, uma raiz: posicionamento automatico + Advantage+ deixam a
Meta escolher onde entregar, e com verba curta ela escolhe o mais barato.
Barato aqui e "rewarded_video": anuncio dentro de jogo, onde a pessoa
assiste pra ganhar moeda virtual. Nao e quem compra sistema de R$999.

O QUE ESTE SCRIPT FAZ:
  1. Restringe a Facebook + Instagram, so posicionamentos de qualidade.
     Sem Audience Network, sem Messenger.
  2. Pausa o br_amplo_adv: consome a maior parte da verba entregando pior.
     Os R$50/dia passam a se dividir entre os dois conjuntos segmentados.
  3. Mantem a otimizacao por LEAD. O objetivo continua sendo lead que
     fecha, nao clique barato.

Editar targeting reinicia o aprendizado — mas com 366 impressoes nao ha
aprendizado a perder.
"""
import sys

from _common import brl, carregar_env, chamar

env = carregar_env()
CAMP = "120253599173060667"
EXECUTAR = "--executar" in sys.argv

# Só onde o dono de negócio consome conteúdo. Fora: audience_network
# (apps de terceiros/jogos) e messenger (contexto de conversa privada,
# performance ruim pra este tipo de oferta).
PLATAFORMAS = ["facebook", "instagram"]
POS_FACEBOOK = ["feed", "facebook_reels", "story"]
# Atencao: no TARGETING o Reels do Instagram e "reels". O nome
# "instagram_reels" so existe nos RELATORIOS. Mandar o nome do relatorio
# aqui devolve subcode 1815508 "Posicao do Instagram invalida".
POS_INSTAGRAM = ["stream", "reels", "story", "explore"]

PAUSAR = ["br_amplo_adv"]

adsets = chamar("GET", f"/{CAMP}/adsets", env,
                {"fields": "id,name,status,targeting", "limit": 10}).get("data", [])

print("plano:\n")
for a in adsets:
    if a["name"] in PAUSAR:
        print(f"  {a['name']}: PAUSAR (72% da verba, CTR 2,32%)")
    else:
        print(f"  {a['name']}: restringir a Facebook + Instagram")
        print(f"     facebook:  {', '.join(POS_FACEBOOK)}")
        print(f"     instagram: {', '.join(POS_INSTAGRAM)}")

if not EXECUTAR:
    print("\n--- SIMULACAO. nada foi alterado ---")
    print("para aplicar: python ops/meta/12_corrigir_entrega.py --executar")
    raise SystemExit(0)

print("\naplicando...\n")
for a in adsets:
    if a["name"] in PAUSAR:
        chamar("POST", f"/{a['id']}", env, dados={"status": "PAUSED"})
        print(f"  [pausado] {a['name']}")
        continue

    # preserva o targeting existente e só troca o que precisa
    t = dict(a.get("targeting") or {})
    t["publisher_platforms"] = PLATAFORMAS
    t["facebook_positions"] = POS_FACEBOOK
    t["instagram_positions"] = POS_INSTAGRAM
    chamar("POST", f"/{a['id']}", env, dados={"targeting": t})
    print(f"  [ajustado] {a['name']}")

print("\n--- conferindo ---")
for a in chamar("GET", f"/{CAMP}/adsets", env,
                {"fields": "name,status,effective_status,targeting", "limit": 10}).get("data", []):
    t = a.get("targeting") or {}
    print(f"\n  [{a.get('effective_status')}] {a['name']}")
    print(f"     plataformas: {t.get('publisher_platforms', '(automatico)')}")
    if t.get("instagram_positions"):
        print(f"     instagram: {t['instagram_positions']}")
    if t.get("facebook_positions"):
        print(f"     facebook:  {t['facebook_positions']}")

c = chamar("GET", f"/{CAMP}", env, {"fields": "daily_budget"})
ativos = [a for a in chamar("GET", f"/{CAMP}/adsets", env,
          {"fields": "name,status", "limit": 10}).get("data", []) if a["status"] == "ACTIVE"]
diario = int(c.get("daily_budget", 0))
print(f"\n{brl(diario)}/dia agora se divide entre {len(ativos)} conjunto(s):")
for a in ativos:
    print(f"   ~{brl(diario // max(len(ativos), 1))}/dia  {a['name']}")
