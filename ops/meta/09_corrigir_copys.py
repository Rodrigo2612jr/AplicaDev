"""
09 — Corrige o texto dos anúncios e limpa criativos órfãos.

    python ops/meta/09_corrigir_copys.py --validar
    python ops/meta/09_corrigir_copys.py --executar

O que muda:
  1. ACENTUAÇÃO. Os textos subiram sem acento ("preco na cabeca", "ferias").
     Anúncio em português sem acento parece amador e derruba credibilidade —
     e a AplicaDev vende serviço técnico.
  2. CONCORDÂNCIA em copy_indicacao: "quantos são conhecido seu" -> reescrito.
  3. ABERTURA de copy_tempo. O feed mobile trunca em ~125 caracteres com
     "ver mais". A primeira frase tinha 118 e a virada ("problema de
     processo") ficava ESCONDIDA atrás do corte. Agora a virada aparece antes.

Criativo da Meta é imutável: não dá pra editar o texto. O caminho é criar um
criativo novo e apontar o anúncio pra ele — o anúncio mantém id, nome,
histórico e agendamento. Como nada veiculou ainda, não há aprendizado a perder.
"""
import sys

from _common import carregar_env, chamar

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]
PAGE = env["META_PAGE_ID"]
IG = env.get("META_IG_ACCOUNT_ID") or None
VIDEO = env["META_VIDEO_ID"]
IMG = env["META_IMAGE_HASH"]
DOMINIO = "aplicadev.com.br"
CAMPANHA = "AD_LEADS_ESTRUTURA_BR_v1"

VALIDAR = "--validar" in sys.argv
EXECUTAR = "--executar" in sys.argv

COPYS = {
    "copy_indicacao": {
        "title": "Seu negócio cresce por estrutura ou por sorte?",
        "message": (
            "Se eu te pedir a lista dos seus últimos 10 clientes, quantos você já conhecia?\n\n"
            "A maioria dos donos responde \"quase todos\" e acha que é bom sinal. Não é. "
            "Quer dizer que o negócio cresce por rede de contato, não por estrutura. "
            "E rede de contato tem fim.\n\n"
            "Preenche aqui embaixo: a gente entende sua operação e monta a estrutura sob medida."
        ),
        "descricao": "2 minutos. Sem falar com vendedor.",
    },
    "copy_dependencia": {
        "title": "O sistema da sua empresa é você",
        "message": (
            "Estoque na planilha, preço na cabeça, pedido no WhatsApp.\n\n"
            "Funciona até você tirar férias, ficar doente, ou querer abrir a segunda "
            "unidade. Aí vira gargalo.\n\n"
            "Conta pra gente como sua operação funciona hoje e a gente monta a "
            "estrutura sob medida."
        ),
        "descricao": "Diagnóstico em 2 minutos.",
    },
    "copy_tempo": {
        "title": "Quanto do seu dia vai em responder cliente?",
        # abertura curta de propósito: a virada tem que caber antes do "ver mais"
        "message": (
            "2 horas por dia no WhatsApp respondendo a mesma coisa?\n\n"
            "Isso não é problema de atendimento. É problema de processo.\n\n"
            "Site, sistema e automação sob medida. A gente entende sua operação primeiro."
        ),
        "descricao": "2 minutos pra entender seu negócio.",
    },
}


def link_de(conjunto, copy_slug):
    q = (f"utm_source=meta&utm_medium=paid_social&utm_campaign={CAMPANHA}"
         f"&utm_term={conjunto}&utm_content={copy_slug}")
    return f"https://{DOMINIO}/?{q}#/diagnostico"


URL_TAGS = "cid={{campaign.id}}&gid={{adset.id}}&aid={{ad.id}}&plc={{placement}}&src={{site_source_name}}"

# ── mapeia os anúncios existentes ─────────────────────────────────────────
camps = [c for c in chamar("GET", f"/{ACT}/campaigns", env,
                           {"fields": "id,name", "limit": 50}).get("data", [])
         if c["name"] == CAMPANHA]
if not camps:
    raise SystemExit("campanha nao encontrada")

anuncios = []
for a in chamar("GET", f"/{camps[0]['id']}/adsets", env,
                {"fields": "id,name", "limit": 50}).get("data", []):
    for ad in chamar("GET", f"/{a['id']}/ads", env,
                     {"fields": "id,name,status,creative{id}", "limit": 50}).get("data", []):
        anuncios.append({"ad_id": ad["id"], "ad_nome": ad["name"], "conjunto": a["name"],
                         "creative_atual": (ad.get("creative") or {}).get("id")})

print(f"{len(anuncios)} anuncios encontrados\n")

if VALIDAR or not EXECUTAR:
    for slug, c in COPYS.items():
        primeira = c["message"].split("\n")[0]
        print(f"--- {slug} ---")
        print(f"  1a linha ({len(primeira)} chars, corta em ~125): {primeira}")
        print(f"  titulo: {c['title']}")
    print("\npara aplicar: python ops/meta/09_corrigir_copys.py --executar")
    raise SystemExit(0)

# ── cria criativo novo e reaponta cada anúncio ────────────────────────────
usados = set()
for x in anuncios:
    slug = x["ad_nome"]
    if slug not in COPYS:
        print(f"[pula] {x['ad_nome']} (copy desconhecida)")
        continue
    cp = COPYS[slug]

    video_data = {
        "video_id": VIDEO,
        "image_hash": IMG,
        "message": cp["message"],
        "title": cp["title"],
        "link_description": cp["descricao"],
        "call_to_action": {"type": "LEARN_MORE",
                           "value": {"link": link_de(x["conjunto"], slug)}},
    }
    story = {"page_id": PAGE, "video_data": video_data}
    if IG:
        story["instagram_user_id"] = IG

    novo = chamar("POST", f"/{ACT}/adcreatives", env, dados={
        "name": f"v2__{x['conjunto']}__{slug}",
        "object_story_spec": story,
        "url_tags": URL_TAGS,
        "degrees_of_freedom_spec": {"creative_features_spec": {
            "text_optimizations": {"enroll_status": "OPT_IN"},
            "enhance_cta": {"enroll_status": "OPT_IN"},
            "inline_comment": {"enroll_status": "OPT_IN"},
        }},
    })
    chamar("POST", f"/{x['ad_id']}", env, dados={
        "creative": {"creative_id": novo["id"]},
        "conversion_domain": DOMINIO,
    })
    usados.add(novo["id"])
    print(f"[ok] {x['conjunto']} / {slug} -> criativo {novo['id']}")

# ── limpa criativos órfãos ────────────────────────────────────────────────
print("\nlimpando criativos orfaos...")
em_uso = set(usados)
for a in chamar("GET", f"/{camps[0]['id']}/adsets", env, {"fields": "id", "limit": 50}).get("data", []):
    for ad in chamar("GET", f"/{a['id']}/ads", env, {"fields": "creative{id}", "limit": 50}).get("data", []):
        cid = (ad.get("creative") or {}).get("id")
        if cid:
            em_uso.add(cid)

removidos = 0
for c in chamar("GET", f"/{ACT}/adcreatives", env, {"fields": "id,name", "limit": 100}).get("data", []):
    if c["id"] in em_uso:
        continue
    try:
        # DELETE de criativo nao usado: nao afeta anuncio nenhum
        chamar("POST", f"/{c['id']}", env, dados={"status": "DELETED"})
        removidos += 1
    except SystemExit as e:
        print(f"  nao removeu {c['id']}: {str(e)[:80]}")

print(f"  {removidos} criativos orfaos removidos, {len(em_uso)} em uso mantidos")
print("\nAnuncios mantiveram id, nome e agendamento. Nada veiculou ainda.")
