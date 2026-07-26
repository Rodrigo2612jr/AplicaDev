"""
11 — Leitura do teste. Rodar em 30/07, depois da campanha encerrar.

    python ops/meta/11_analise.py

Cruza o que a Meta cobrou com o que chegou no banco, e responde a pergunta
que decide a verba:

    NÃO "qual anúncio traz lead barato"
    MAS "qual anúncio traz lead que FECHA"

São coisas diferentes. Um criativo pode entregar lead a R$8 e nenhum virar
cliente; outro a R$25 com metade fechando. Quem escala pelo custo por lead
escala o errado.

SOMENTE LEITURA. Não altera campanha nem banco.
"""
import json
import os
import urllib.request

from _common import brl, carregar_env, chamar

env = carregar_env()
CAMP = "120253599173060667"

# ── cortes de decisão ─────────────────────────────────────────────────────
# Não são leis: são linhas de corte pra evitar decidir "no achismo" com
# volume baixo. Com R$150 de teste, qualquer conclusão é indicativa.
CTR_RUIM = 0.8          # % — abaixo disso o criativo não segura atenção
CPL_ALVO = 25.0         # R$ — referência de custo por lead pra este ticket
MIN_LEADS_DECIDIR = 3   # abaixo disso, não dá pra concluir nada de um criativo


def pegar_leads():
    """Lê os leads direto do PostgREST. Precisa de service role pra ver tudo;
    com a anon key o RLS devolve vazio (o que é proposital, ver db.ts)."""
    url = None
    chave = None
    caminho = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    try:
        with open(caminho, encoding="utf-8") as f:
            for linha in f:
                if linha.startswith("VITE_SUPABASE_URL="):
                    url = linha.split("=", 1)[1].strip().strip('"')
                if linha.startswith("SUPABASE_SERVICE_ROLE="):
                    chave = linha.split("=", 1)[1].strip().strip('"')
    except OSError:
        return None
    if not url or not chave:
        return None
    req = urllib.request.Request(
        f"{url}/rest/v1/leads?select=id,nome,status,temperatura,utm,created_at",
        headers={"apikey": chave, "Authorization": f"Bearer {chave}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  (nao consegui ler o banco: {e})")
        return None


# ── 1) o que a Meta cobrou, por anúncio ───────────────────────────────────
print("=" * 72)
print("GASTO E ENTREGA POR ANUNCIO")
print("=" * 72)

ins = chamar("GET", f"/{CAMP}/insights", env, {
    "fields": "spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type",
    "level": "ad",
    "breakdowns": "",
    "time_range": json.dumps({"since": "2026-07-27", "until": "2026-07-30"}),
    "limit": 50,
}).get("data", [])

nomes = {}
for a in chamar("GET", f"/{CAMP}/ads", env,
                {"fields": "id,name,adset{name}", "limit": 50}).get("data", []):
    nomes[a["id"]] = (a["name"], (a.get("adset") or {}).get("name", "-"))

def leads_do_insight(row):
    for act in (row.get("actions") or []):
        if act.get("action_type") in ("lead", "offsite_conversion.fb_pixel_lead"):
            return int(float(act["value"]))
    return 0

linhas = []
gasto_total = 0.0
for row in ins:
    ad_id = row.get("ad_id", "")
    nome, conjunto = nomes.get(ad_id, (ad_id, "-"))
    gasto = float(row.get("spend", 0))
    gasto_total += gasto
    lds = leads_do_insight(row)
    linhas.append({
        "criativo": nome, "conjunto": conjunto, "gasto": gasto,
        "impr": int(row.get("impressions", 0)),
        "cliques": int(row.get("clicks", 0)),
        "ctr": float(row.get("ctr", 0)),
        "leads_meta": lds,
        "cpl": gasto / lds if lds else None,
    })

if not linhas:
    print("\nNenhum dado de entrega ainda. A campanha ja rodou?")
else:
    linhas.sort(key=lambda x: -x["gasto"])
    print(f"\n{'criativo':<18}{'conjunto':<20}{'gasto':>9}{'CTR':>7}{'leads':>7}{'CPL':>9}")
    print("-" * 72)
    for l in linhas:
        cpl = brl(l["cpl"] * 100) if l["cpl"] else "-"
        print(f"{l['criativo']:<18}{l['conjunto']:<20}{brl(l['gasto']*100):>9}"
              f"{l['ctr']:>6.2f}%{l['leads_meta']:>7}{cpl:>9}")
    print("-" * 72)
    print(f"{'TOTAL':<38}{brl(gasto_total*100):>9}")

# ── 2) o que chegou no banco (qualidade, não quantidade) ──────────────────
print("\n" + "=" * 72)
print("QUALIDADE DO LEAD POR CRIATIVO (do banco)")
print("=" * 72)

leads = pegar_leads()
if leads is None:
    print("\nSem SUPABASE_SERVICE_ROLE no .env — pulei esta parte.")
    print("A anon key nao serve: o RLS esconde tudo dela de proposito.")
    print("Alternativa: abrir /admin no site, ou a view leads_por_criativo.")
else:
    porc = {}
    for ld in leads:
        u = ld.get("utm") or {}
        crit = u.get("utm_content") or "(organico/direto)"
        d = porc.setdefault(crit, {"total": 0, "completos": 0, "quentes": 0})
        d["total"] += 1
        if ld.get("status") == "completo":
            d["completos"] += 1
        if ld.get("temperatura") == "QUENTE":
            d["quentes"] += 1

    print(f"\n{'criativo':<24}{'leads':>7}{'completos':>11}{'quentes':>9}{'%quente':>9}")
    print("-" * 72)
    for crit, d in sorted(porc.items(), key=lambda x: -x[1]["quentes"]):
        pct = 100.0 * d["quentes"] / d["total"] if d["total"] else 0
        print(f"{crit:<24}{d['total']:>7}{d['completos']:>11}{d['quentes']:>9}{pct:>8.0f}%")

# ── 3) leitura ────────────────────────────────────────────────────────────
print("\n" + "=" * 72)
print("LEITURA")
print("=" * 72)

if linhas:
    for l in linhas:
        aviso = []
        if l["ctr"] < CTR_RUIM and l["impr"] > 500:
            aviso.append(f"CTR {l['ctr']:.2f}% (abaixo de {CTR_RUIM}%): o criativo nao segura atencao")
        if l["cpl"] and l["cpl"] > CPL_ALVO:
            aviso.append(f"CPL {brl(l['cpl']*100)} acima da referencia {brl(CPL_ALVO*100)}")
        if l["leads_meta"] < MIN_LEADS_DECIDIR and l["gasto"] > 20:
            aviso.append(f"so {l['leads_meta']} lead(s) com {brl(l['gasto']*100)} gasto")
        if aviso:
            print(f"\n  {l['criativo']} / {l['conjunto']}")
            for a in aviso:
                print(f"     - {a}")

print(f"""
COMO DECIDIR (com {brl(gasto_total*100)} de teste, tudo aqui e indicativo):

  1. Olhe QUALIDADE antes de custo. Criativo com CPL alto mas alto %quente
     vale mais que o barato que so traz curioso.
  2. Criativo com menos de {MIN_LEADS_DECIDIR} leads NAO tem amostra. Nao mate nem escale:
     deixe rodar mais, ou aceite que o teste nao respondeu.
  3. CTR abaixo de {CTR_RUIM}% com impressao relevante = problema de criativo.
     CTR bom + poucos leads = problema de landing, nao de anuncio.
  4. Pra escalar: suba no maximo 20% do orcamento a cada 3 dias. Salto maior
     joga o conjunto de volta pro aprendizado.
  5. NAO edite anuncio que esta indo bem. Editar reinicia o aprendizado.
     Pra testar variacao, crie anuncio NOVO ao lado.
""")
