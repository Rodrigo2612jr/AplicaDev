"""
04 — Cria a estrutura de teste. TUDO NASCE PAUSADO. Nada e ativado aqui.

    python ops/meta/04_criar_campanha.py --validar   -> so valida, nao cria
    python ops/meta/04_criar_campanha.py             -> cria (pausado)

DESENHO DO TESTE (criativo unico, varia publico e copy):

  CAMPANHA  OUTCOME_LEADS · CBO R$50/dia · PAUSED
    |
    +-- br_amplo_adv        Advantage+ Audience ON  (deixa o algoritmo achar)
    +-- br_interesses_pme   interesses de gestao/PME
    +-- br_donos_negocio    comportamento de dono/admin de pagina
         |
         +-- 3 copys em CADA conjunto = 9 anuncios, mesmo video

Com CBO a verba nao divide igual: a Meta concentra no que responde melhor.
E o comportamento desejado aqui ("gastar no que traz lead"), mas nao e um
teste com significancia estatistica — em 3 dias e ~R$150 le-se SINAL
(CTR, CPC, taxa de inicio do form), nao veredito.

UTM — estrategia dupla, porque o site e SPA com HashRouter:
  1. valores FIXOS e legiveis ANTES do '#'  -> garantem location.search cheio
  2. macros dinamicas em url_tags           -> IDs, best effort
O readUtms() da landing le dos DOIS lugares, entao funciona nos dois casos.
"""
import json
import sys

from _common import brl, carregar_env, chamar

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]
PAGE = env["META_PAGE_ID"]
IG = env.get("META_IG_ACCOUNT_ID") or None
PIXEL = env["META_PIXEL_ID"]
VIDEO = env["META_VIDEO_ID"]
IMG = env["META_IMAGE_HASH"]

VALIDAR = "--validar" in sys.argv
DIARIO = 5000  # CENTAVOS = R$50,00  (atencao: spend_cap e em reais, este e em centavos)
CAMPANHA = "AD_LEADS_ESTRUTURA_BR_v1"
DOMINIO = "aplicadev.com.br"

# ── copys: o que muda entre os anuncios (o video e sempre o mesmo) ─────────
COPYS = [
    {
        "slug": "copy_indicacao",
        "title": "Seu negocio cresce por estrutura ou por sorte?",
        "message": (
            "Se eu te pedir a lista dos seus ultimos 10 clientes, quantos sao conhecido seu?\n\n"
            "A maioria dos donos responde \"quase todos\" e acha que e bom sinal. Nao e. "
            "Quer dizer que o negocio cresce por rede de contato, nao por estrutura. "
            "E rede de contato tem fim.\n\n"
            "Preenche aqui embaixo: a gente entende sua operacao e monta a estrutura sob medida."
        ),
        "descricao": "2 minutos. Sem falar com vendedor.",
    },
    {
        "slug": "copy_dependencia",
        "title": "O sistema da sua empresa e voce",
        "message": (
            "Estoque na planilha, preco na cabeca, pedido no WhatsApp.\n\n"
            "Funciona ate voce tirar ferias, ficar doente, ou querer abrir a segunda unidade. "
            "Ai vira gargalo.\n\n"
            "Conta pra gente como sua operacao funciona hoje e a gente monta a estrutura sob medida."
        ),
        "descricao": "Diagnostico em 2 minutos.",
    },
    {
        "slug": "copy_tempo",
        "title": "Quanto do seu dia vai em responder cliente?",
        "message": (
            "Se sao mais de 2 horas por dia no WhatsApp respondendo a mesma coisa, "
            "voce nao tem um problema de atendimento. Tem um problema de processo.\n\n"
            "Site, sistema e automacao sob medida. A gente entende sua operacao primeiro."
        ),
        "descricao": "2 minutos pra entender seu negocio.",
    },
]


def buscar_interesses(termos):
    """Resolve nomes de interesse -> IDs. A Meta exige o id, nao o nome."""
    achados = []
    for termo in termos:
        try:
            r = chamar("GET", "/search", env,
                       {"type": "adinterest", "q": termo, "locale": "pt_BR", "limit": 3})
            for item in r.get("data", [])[:1]:
                achados.append({"id": item["id"], "name": item["name"]})
                print(f"    interesse '{termo}' -> {item['name']} ({item['id']})")
        except SystemExit as e:
            print(f"    interesse '{termo}' falhou: {str(e)[:80]}")
    return achados


print(f"{'VALIDACAO (nada sera criado)' if VALIDAR else 'CRIACAO (tudo PAUSADO)'}")
print(f"conta {ACT} | pixel {PIXEL} | video {VIDEO}")
print(f"orcamento CBO: {brl(DIARIO)}/dia\n")

print("Resolvendo interesses...")
int_pme = buscar_interesses(["Pequena e media empresa", "Empreendedorismo", "Gestao de negocios"])
int_dono = buscar_interesses(["Proprietario de empresa", "Marketing digital", "Vendas"])

# ── conjuntos ──────────────────────────────────────────────────────────────
# ATENCAO: com advantage_audience=1 nao se pode mandar age_max (fica fixo em
# 65) e age_min so aceita 18-25. Por isso o conjunto 1 nao tem age_max.
CONJUNTOS = [
    {
        "slug": "br_amplo_adv",
        "targeting": {
            "geo_locations": {"countries": ["BR"]},
            "age_min": 25,
            "targeting_automation": {"advantage_audience": 1},
        },
    },
    {
        "slug": "br_interesses_pme",
        "targeting": {
            "geo_locations": {"countries": ["BR"]},
            "age_min": 25, "age_max": 65,
            "flexible_spec": [{"interests": int_pme}] if int_pme else [],
            "targeting_automation": {"advantage_audience": 0},
        },
    },
    {
        "slug": "br_donos_negocio",
        "targeting": {
            "geo_locations": {"countries": ["BR"]},
            "age_min": 25, "age_max": 65,
            "flexible_spec": [{"interests": int_dono}] if int_dono else [],
            "targeting_automation": {"advantage_audience": 0},
        },
    },
]
for c in CONJUNTOS:
    if not c["targeting"].get("flexible_spec"):
        c["targeting"].pop("flexible_spec", None)


def link_de(conjunto_slug, copy_slug):
    """Query ANTES do '#': e o que garante location.search populado na SPA."""
    q = (f"utm_source=meta&utm_medium=paid_social&utm_campaign={CAMPANHA}"
         f"&utm_term={conjunto_slug}&utm_content={copy_slug}")
    return f"https://{DOMINIO}/?{q}#/diagnostico"


# macros dinamicas: redundancia com os IDs. Se a Meta anexar isso depois do
# '#', o readUtms le do hash do mesmo jeito.
URL_TAGS = "cid={{campaign.id}}&gid={{adset.id}}&aid={{ad.id}}&plc={{placement}}&src={{site_source_name}}"

if VALIDAR:
    print("\n--- o que seria criado ---")
    print(f"campanha: {CAMPANHA} | OUTCOME_LEADS | CBO {brl(DIARIO)}/dia | PAUSED")
    for c in CONJUNTOS:
        print(f"\nconjunto: {c['slug']}")
        print(f"  targeting: {json.dumps(c['targeting'], ensure_ascii=False)}")
        print(f"  promoted_object: pixel {PIXEL} / LEAD | OFFSITE_CONVERSIONS")
        for cp in COPYS:
            print(f"  anuncio: {cp['slug']}")
            print(f"    link: {link_de(c['slug'], cp['slug'])}")
    print(f"\nurl_tags: {URL_TAGS}")
    print(f"\ntotal: 1 campanha, {len(CONJUNTOS)} conjuntos, {len(CONJUNTOS) * len(COPYS)} anuncios")
    raise SystemExit(0)

# ── 1) campanha ────────────────────────────────────────────────────────────
print("\n[1] campanha")
r = chamar("POST", f"/{ACT}/campaigns", env, dados={
    "name": CAMPANHA,
    "objective": "OUTCOME_LEADS",
    "status": "PAUSED",
    "special_ad_categories": [],
    "daily_budget": DIARIO,                      # CBO: orcamento na campanha
    "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
})
camp_id = r["id"]
print(f"    {camp_id}")

# ── 2) conjuntos ───────────────────────────────────────────────────────────
criados = []
for c in CONJUNTOS:
    print(f"\n[2] conjunto {c['slug']}")
    r = chamar("POST", f"/{ACT}/adsets", env, dados={
        "name": c["slug"],
        "campaign_id": camp_id,
        "status": "PAUSED",
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "OFFSITE_CONVERSIONS",
        "destination_type": "WEBSITE",
        "promoted_object": {"pixel_id": PIXEL, "custom_event_type": "LEAD"},
        "attribution_spec": [
            {"event_type": "CLICK_THROUGH", "window_days": 7},
            {"event_type": "VIEW_THROUGH", "window_days": 1},
        ],
        "targeting": c["targeting"],
        # sem daily_budget aqui: com CBO o orcamento e da campanha
    })
    print(f"    {r['id']}")
    criados.append((c["slug"], r["id"]))

# ── 3) criativos + anuncios ───────────────────────────────────────────────
total = 0
for conj_slug, adset_id in criados:
    for cp in COPYS:
        video_data = {
            "video_id": VIDEO,
            "image_hash": IMG,                    # thumbnail: obrigatoria na pratica
            "message": cp["message"],
            "title": cp["title"],
            "link_description": cp["descricao"],
            # o link vive AQUI. video_data nao tem campo 'link'.
            "call_to_action": {
                "type": "LEARN_MORE",
                "value": {"link": link_de(conj_slug, cp["slug"])},
            },
        }
        story = {"page_id": PAGE, "video_data": video_data}
        if IG:
            story["instagram_user_id"] = IG

        r = chamar("POST", f"/{ACT}/adcreatives", env, dados={
            "name": f"{conj_slug}__{cp['slug']}",
            "object_story_spec": story,
            "url_tags": URL_TAGS,
            # Advantage+ Creative SELETIVO: nada de video_auto_crop/uncrop —
            # o video e 9:16 nativo com legenda queimada, recorte come o texto.
            "degrees_of_freedom_spec": {"creative_features_spec": {
                "text_optimizations": {"enroll_status": "OPT_IN"},
                "enhance_cta": {"enroll_status": "OPT_IN"},
                "inline_comment": {"enroll_status": "OPT_IN"},
            }},
        })
        creative_id = r["id"]

        r = chamar("POST", f"/{ACT}/ads", env, dados={
            "name": cp["slug"],
            "adset_id": adset_id,
            "creative": {"creative_id": creative_id},
            "status": "PAUSED",
            "conversion_domain": DOMINIO,     # so dominio, sem https/path
        })
        total += 1
        print(f"[3] anuncio {conj_slug} / {cp['slug']} -> {r['id']}")

print(f"\n{'=' * 60}")
print(f"campanha {camp_id} | {len(criados)} conjuntos | {total} anuncios")
print("TUDO PAUSADO. Nada esta veiculando, nada foi gasto.")
print("Revise no Gerenciador e ative quando quiser.")
