"""
00 — Diagnostico da conta. SOMENTE LEITURA: nao cria, nao altera, nao gasta.

Roda antes de tudo. Confirma token, permissoes REAIS sobre os assets, estado
da conta e o que ja existe — pra nao duplicar nem descobrir bloqueio no meio
da criacao da campanha.

    python ops/meta/00_check.py
"""
from _common import ACCOUNT_STATUS, API_VERSION, brl, carregar_env, chamar, salvar_env

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]
BID = env["META_BUSINESS_ID"]
APP = env["META_APP_ID"]
SU = env.get("META_SYSTEM_USER_ID", "")

alertas = []


def ler_tudo(caminho, params):
    """Percorre paging.next ate esgotar. limit=100 NAO garante lista completa."""
    itens, depois = [], None
    for _ in range(20):
        p = dict(params)
        if depois:
            p["after"] = depois
        r = chamar("GET", caminho, env, p)
        itens.extend(r.get("data", []))
        depois = (r.get("paging") or {}).get("cursors", {}).get("after")
        if not depois or not (r.get("paging") or {}).get("next"):
            break
    return itens


print(f"Graph API {API_VERSION}  |  conta {ACT}\n" + "=" * 64)

# 1) identidade -------------------------------------------------------------
eu = chamar("GET", "/me", env, {"fields": "id,name"})
print(f"\n[1] Token")
print(f"    system user: {eu.get('name', '?')}  (id {eu.get('id', '?')})")
if not SU:
    salvar_env("META_SYSTEM_USER_ID", eu.get("id", ""))

# debug_token exige APP ACCESS TOKEN ({app_id}|{app_secret}), nao o proprio token.
# Sem o app_secret isso falha — e tudo bem, o teste que vale e o [2].
if env.get("META_APP_SECRET"):
    try:
        dbg = chamar("GET", "/debug_token", env,
                     {"input_token": env["META_ACCESS_TOKEN"],
                      "access_token": f"{APP}|{env['META_APP_SECRET']}"})
        d = dbg.get("data", {})
        exp = d.get("expires_at", 0)
        print(f"    tipo: {d.get('type')} | valido: {d.get('is_valid')} | expira: {'NUNCA' if not exp else exp}")
        print(f"    escopos: {', '.join(d.get('scopes', []))}")
    except SystemExit as e:
        print(f"    (debug_token falhou: {e})")
else:
    print("    (sem META_APP_SECRET no .env.meta — debug_token pulado, opcional)")

# 2) O TESTE QUE REALMENTE IMPORTA: permitted_tasks ------------------------
# Token valido + conta ativa e o system user so com ANALYZE = todo POST falha.
print(f"\n[2] Nivel de acesso do system user na conta  <-- o teste decisivo")
try:
    atr = ler_tudo(f"/{eu.get('id')}/assigned_ad_accounts",
                   {"fields": "id,name,permitted_tasks,access_type", "limit": 100})
    achou = False
    for a in atr:
        marca = "  <== esta" if a.get("id") in (ACT, ACT.replace("act_", "")) else ""
        tasks = a.get("permitted_tasks", [])
        print(f"    {a.get('name')} ({a.get('id')}) [{a.get('access_type')}] tasks={tasks}{marca}")
        if marca:
            achou = True
            if "MANAGE" not in tasks and "ADVERTISE" not in tasks:
                alertas.append("system user SEM tasks MANAGE/ADVERTISE — POST de campanha vai falhar")
    if not achou:
        alertas.append(f"conta {ACT} NAO aparece nos assets atribuidos ao system user")
except SystemExit as e:
    print(f"    (falhou: {e})")
    if "270" in str(e):
        alertas.append("ERRO 270: o App esta em Development access level — "
                       "peca Standard/Advanced Access de Marketing API no painel do App")

# 3) conta de anuncios ------------------------------------------------------
print(f"\n[3] Conta de anuncios")
campos = ("name,account_status,disable_reason,currency,timezone_name,spend_cap,"
          "amount_spent,min_daily_budget,funding_source_details,is_prepay_account")
c = chamar("GET", f"/{ACT}", env, {"fields": campos})
st = c.get("account_status")
print(f"    nome:   {c.get('name')}")
print(f"    status: {st} = {ACCOUNT_STATUS.get(st, 'DESCONHECIDO')}"
      + (f"  | disable_reason: {c['disable_reason']}" if c.get("disable_reason") else ""))
print(f"    moeda:  {c.get('currency')} | fuso: {c.get('timezone_name')}")
print(f"    orcamento diario minimo: {brl(c.get('min_daily_budget', 0))}")
print(f"    ja gasto (contra o cap): {brl(c.get('amount_spent', 0))}")

# ATENCAO: spend_cap vem AUSENTE (nao 0) quando nao ha limite. E vem em CENTAVOS
# na leitura, mas se ESCREVE em reais. Assimetria documentada da Meta.
if "spend_cap" in c and int(c["spend_cap"]) > 0:
    print(f"    LIMITE DE GASTO: {brl(c['spend_cap'])}")
else:
    print(f"    LIMITE DE GASTO: NAO DEFINIDO")
    alertas.append("sem limite de gasto na conta — rodar 02_spend_cap.py antes de ativar")

fonte = c.get("funding_source_details") or {}
if fonte.get("display_string"):
    print(f"    pagamento: {fonte['display_string']}")
else:
    print(f"    pagamento: NENHUM")
    alertas.append("conta sem forma de pagamento — nao veicula")

# 4) Pagina — promote_pages e a edge DEFINITIVA ----------------------------
# owned_pages lista o que o business tem; promote_pages lista o que ESTA CONTA
# pode promover. Pagina que aparece so em owned_pages faz o AdCreative falhar.
print(f"\n[4] Paginas que ESTA CONTA pode promover")
pgs = []
try:
    pgs = ler_tudo(f"/{ACT}/promote_pages", {"fields": "id,name,username,link", "limit": 100})
    if not pgs:
        alertas.append("nenhuma Pagina promovivel por esta conta — AdCreative vai falhar")
        print("    NENHUMA")
    for p in pgs:
        print(f"    - {p.get('name')} (id {p['id']})" + (f" @{p['username']}" if p.get("username") else ""))
    if len(pgs) == 1:
        salvar_env("META_PAGE_ID", pgs[0]["id"])
except SystemExit as e:
    print(f"    (falhou: {e})")

# 5) Instagram --------------------------------------------------------------
print(f"\n[5] Instagram")
page_id = env.get("META_PAGE_ID") or (pgs[0]["id"] if pgs else "")
ig = None
if page_id:
    try:
        r = chamar("GET", f"/{page_id}", env,
                   {"fields": "instagram_business_account{id,username},connected_instagram_account{id,username}"})
        ig = r.get("instagram_business_account") or r.get("connected_instagram_account")
    except SystemExit as e:
        print(f"    (falhou: {e})")
if ig:
    print(f"    @{ig.get('username', '?')} (id {ig['id']})")
    salvar_env("META_IG_ACCOUNT_ID", ig["id"])
else:
    print("    NENHUM vinculado")
    alertas.append("Instagram nao vinculado — o video 9:16 perde Reels/Stories do IG, "
                   "que e onde ele tem melhor entrega. Vincular no Gerenciador.")

# 6) Pixels -----------------------------------------------------------------
print(f"\n[6] Pixels")
try:
    px = chamar("GET", f"/{ACT}/adspixels", env, {"fields": "id,name,creation_time,last_fired_time"})
    lista = px.get("data", [])
    if not lista:
        print("    NENHUM — criar com 01_criar_pixel.py")
    for p in lista:
        # last_fired_time vem AUSENTE (nao null) quando nunca disparou
        print(f"    - {p.get('name')} (id {p['id']})  ultimo disparo: {p.get('last_fired_time', 'nunca')}")
    if len(lista) == 1:
        salvar_env("META_PIXEL_ID", lista[0]["id"])
except SystemExit as e:
    print(f"    (falhou: {e})")

# 7) o que ja existe --------------------------------------------------------
print(f"\n[7] Campanhas existentes")
camp = ler_tudo(f"/{ACT}/campaigns", {"fields": "id,name,status,objective,daily_budget", "limit": 100})
if not camp:
    print("    nenhuma (conta limpa)")
for x in camp:
    print(f"    - [{x['status']}] {x['name']} ({x.get('objective')}) id {x['id']}")

# resumo --------------------------------------------------------------------
print("\n" + "=" * 64)
if alertas:
    print("PENDENCIAS:")
    for a in alertas:
        print(f"  !! {a}")
else:
    print("Tudo certo pra seguir.")
print("\nSomente leitura: nada foi criado ou alterado.")
