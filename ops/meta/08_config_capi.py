"""
08 — Configura as credenciais da Conversions API no Convex.

    python ops/meta/08_config_capi.py

O token vai do .env.meta direto pro `convex env set`, sem passar por
lugar nenhum no meio e sem ser impresso na tela.

Nota: aqui reusamos o token do system user (tem ads_management, que basta
pra CAPI). Se quiser reduzir o escopo depois, dá pra gerar um token
dedicado no Events Manager > Configurações > Gerar token de acesso e
trocar só o valor desta variável.
"""
import subprocess

from _common import carregar_env

env = carregar_env()
KANBAN = r"D:\aplicadev-kanban"

variaveis = [
    ("META_CAPI_TOKEN", env["META_ACCESS_TOKEN"]),
    ("META_PIXEL_ID", env["META_PIXEL_ID"]),
]

for nome, valor in variaveis:
    r = subprocess.run(
        ["npx", "convex", "env", "set", nome, valor],
        cwd=KANBAN, shell=True, capture_output=True, text=True,
    )
    # nunca ecoar o valor — nem em erro
    saida = (r.stdout + r.stderr).replace(valor, "<oculto>")
    status = "OK" if r.returncode == 0 else f"FALHOU ({r.returncode})"
    print(f"[{status}] {nome}")
    for linha in saida.strip().splitlines()[-2:]:
        if linha.strip():
            print(f"    {linha.strip()}")

print("\nConferindo o que ficou gravado (so os nomes):")
r = subprocess.run(["npx", "convex", "env", "list"], cwd=KANBAN, shell=True,
                   capture_output=True, text=True)
for linha in (r.stdout or "").splitlines():
    nome = linha.split("=")[0].strip()
    if nome:
        print(f"    {nome}")
