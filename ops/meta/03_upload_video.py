"""
03 — Sobe o criativo (video + thumbnail) para a conta de anuncios.

    python ops/meta/03_upload_video.py <video.mp4> <thumb.jpg>

Nao gasta dinheiro: so envia os ativos pra biblioteca da conta.

Duas armadilhas tratadas aqui:
  1. O AdCreative de video EXIGE thumbnail na pratica (a doc marca como
     opcional, mas sem image_hash/image_url da erro 100 "Please specify an
     image to run with this ad"). Por isso subimos as duas coisas.
  2. So da pra usar o video no criativo depois que status.video_status
     virar 'ready' — antes disso o criativo e rejeitado ou sai sem capa.
"""
import sys
import time

from _common import carregar_env, chamar, salvar_env

env = carregar_env()
ACT = env["META_AD_ACCOUNT_ID"]

video = sys.argv[1] if len(sys.argv) > 1 else r"D:\_claude_tmp\criativo_v1.mp4"
thumb = sys.argv[2] if len(sys.argv) > 2 else r"D:\_claude_tmp\thumb_aplicadev.jpg"

# ── 1) video ───────────────────────────────────────────────────────────────
print(f"Subindo video: {video}")
r = chamar("POST", f"/{ACT}/advideos", env,
           dados={"name": "AplicaDev - criativo v1 (56s 9x16)"},
           arquivo=("source", video),
           host="https://graph-video.facebook.com")
video_id = r.get("id")
if not video_id:
    raise SystemExit(f"resposta inesperada: {r}")
print(f"  video_id: {video_id}")

# ── 2) esperar processar ───────────────────────────────────────────────────
print("Aguardando processamento...")
for tentativa in range(60):
    st = chamar("GET", f"/{video_id}", env, {"fields": "status"}).get("status", {})
    fase = st.get("video_status", "?")
    prog = st.get("processing_progress")
    print(f"  [{tentativa * 5:>3}s] {fase}" + (f" ({prog}%)" if prog is not None else ""))
    if fase == "ready":
        break
    if fase in ("error", "expired"):
        raise SystemExit(f"falha terminal no processamento: {st}")
    time.sleep(5)
else:
    raise SystemExit("timeout: video nao ficou 'ready' em 5 min")

salvar_env("META_VIDEO_ID", video_id)

# ── 3) thumbnail ───────────────────────────────────────────────────────────
# Sobe pra biblioteca de imagens da conta e usa image_hash. Nao usar a uri
# das thumbs auto-geradas: sao URL de CDN do Facebook, que a propria doc
# manda NAO usar em image_url.
print(f"\nSubindo thumbnail: {thumb}")
r = chamar("POST", f"/{ACT}/adimages", env, arquivo=("filename", thumb))
imgs = r.get("images", {})
if not imgs:
    raise SystemExit(f"resposta inesperada: {r}")
primeira = next(iter(imgs.values()))
img_hash = primeira.get("hash")
print(f"  image_hash: {img_hash}")
print(f"  {primeira.get('width')}x{primeira.get('height')}")
salvar_env("META_IMAGE_HASH", img_hash)

print("\nPronto. Ativos na conta, nada gasto.")
