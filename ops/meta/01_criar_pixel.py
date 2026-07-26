"""
01 — Cria o Pixel da AplicaDev.

Uma conta de anuncios so pode ter UM pixel (erro 6200 se ja existir), entao
este script LISTA ANTES e so cria se nao houver. Idempotente: rodar de novo
nao duplica nada.

    python ops/meta/01_criar_pixel.py
"""
from _common import carregar_env, chamar, salvar_env

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]
NOME = "Pixel AplicaDev"

# 1) ja existe? -------------------------------------------------------------
# Esta edge nao aceita parametro nenhum alem de fields.
r = chamar("GET", f"/{ACT}/adspixels", env, {"fields": "id,name,creation_time,last_fired_time"})
existentes = r.get("data", [])

if existentes:
    p = existentes[0]
    print(f"Ja existe pixel nesta conta — nada foi criado.")
    print(f"  nome: {p.get('name')}")
    print(f"  id:   {p['id']}")
    print(f"  ultimo disparo: {p.get('last_fired_time', 'nunca')}")
    salvar_env("META_PIXEL_ID", p["id"])
    raise SystemExit(0)

# 2) criar ------------------------------------------------------------------
# Unico parametro documentado em Creating: name.
print(f"Nenhum pixel na conta. Criando '{NOME}'...")
novo = chamar("POST", f"/{ACT}/adspixels", env, dados={"name": NOME})
pixel_id = novo.get("id")
if not pixel_id:
    raise SystemExit(f"resposta inesperada: {novo}")

print(f"  criado: {pixel_id}")
salvar_env("META_PIXEL_ID", pixel_id)

# 3) confirmar (read-after-write) ------------------------------------------
conf = chamar("GET", f"/{pixel_id}", env, {"fields": "id,name,creation_time,owner_business"})
dono = (conf.get("owner_business") or {}).get("id", "?")
print(f"  confirmado: {conf.get('name')} | criado em {conf.get('creation_time')} | owner_business {dono}")

print(f"\nProximo passo: plugar {pixel_id} no index.html e fazer deploy.")
