"""
08b — Configura as credenciais da CAPI no deployment de PRODUÇÃO do Convex.

    python ops/meta/08b_config_capi_prod.py

Existe separado do 08 porque a landing de produção NÃO fala com o mesmo
deployment que o .env local aponta:

    .env local  -> grand-bandicoot-117  (dev)
    Vercel      -> bright-buffalo-441   (prod)  <- onde o lead real cai

As variáveis foram para o dev na primeira vez, então a CAPI passou no teste
e mesmo assim não teria funcionado com tráfego real. Este script põe as
credenciais no lugar certo.

Setar a variável é inócuo por si só: sem o código deployado, nada a lê.
O token vai do .env.meta direto pro `convex env set`, sem ser impresso.
"""
import subprocess

from _common import carregar_env

env = carregar_env()
KANBAN = r"D:\aplicadev-kanban"

for nome, valor in [("META_CAPI_TOKEN", env["META_ACCESS_TOKEN"]),
                    ("META_PIXEL_ID", env["META_PIXEL_ID"])]:
    r = subprocess.run(["npx", "convex", "env", "set", "--prod", nome, valor],
                       cwd=KANBAN, shell=True, capture_output=True, text=True)
    saida = (r.stdout + r.stderr).replace(valor, "<oculto>")
    print(f"[{'OK' if r.returncode == 0 else 'FALHOU'}] {nome}")
    for linha in saida.strip().splitlines()[-1:]:
        if linha.strip():
            print(f"    {linha.strip()}")

print("\nvariaveis no deployment de PRODUCAO:")
r = subprocess.run(["npx", "convex", "env", "list", "--prod"], cwd=KANBAN,
                   shell=True, capture_output=True, text=True)
for linha in (r.stdout or "").splitlines():
    nome = linha.split("=")[0].strip()
    if nome.startswith("META_"):
        print(f"    {nome}")
