"""
Helpers da Meta Marketing API — AplicaDev.

Regras desta pasta:
  - NENHUM segredo aqui dentro. O token mora em D:\\_ops\\aplicadev\\.env.meta,
    fora do repo, e e lido via ambiente.
  - Nada que gasta dinheiro sobe ATIVO. Campanha/conjunto/anuncio nascem PAUSED.
  - Nenhuma funcao imprime o token, nem em erro.
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request

ENV_PATH = r"D:\_ops\aplicadev\.env.meta"
# v25.0 = versao corrente (lancada 18/02/2026). NUNCA chamar sem versao na URL:
# sem versao a Meta roteia pra versao default do App, que muda comportamento em silencio.
API_VERSION = os.environ.get("META_API_VERSION", "v25.0")
BASE = "https://graph.facebook.com"

# Estados de conta de anuncios (lista COMPLETA — faltavam 8/100/201/202)
ACCOUNT_STATUS = {
    1: "ACTIVE",
    2: "DISABLED",
    3: "UNSETTLED",
    7: "PENDING_RISK_REVIEW",
    8: "PENDING_SETTLEMENT",
    9: "IN_GRACE_PERIOD",
    100: "PENDING_CLOSURE",
    101: "CLOSED",
    201: "(filtro ANY_ACTIVE)",
    202: "(filtro ANY_CLOSED)",
}


def carregar_env(path: str = ENV_PATH) -> dict:
    """Le o .env.meta para um dict. Nao loga valores."""
    if not os.path.exists(path):
        raise SystemExit(f"ERRO: nao achei {path}. Crie o arquivo e cole o token.")
    env = {}
    with open(path, encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            k, _, v = linha.partition("=")
            env[k.strip()] = v.strip()
    if not env.get("META_ACCESS_TOKEN"):
        raise SystemExit(
            "ERRO: META_ACCESS_TOKEN esta vazio no .env.meta.\n"
            "Cole o token do system user na linha 'META_ACCESS_TOKEN=' e salve."
        )
    return env


def _mascara(texto: str, token: str) -> str:
    """Garante que o token nunca aparece numa mensagem de erro."""
    return texto.replace(token, "<TOKEN>") if token else texto


def chamar(metodo: str, caminho: str, env: dict, params=None, dados=None, arquivo=None, host=None):
    """
    Faz uma chamada na Graph API.
      metodo : 'GET' | 'POST'
      caminho: ex '/me' ou '/act_123/campaigns'  (sem a versao)
      params : querystring (GET) — o token entra aqui automaticamente
      dados  : dict do corpo (POST urlencoded)
      arquivo: (nome_campo, caminho_arquivo) para upload multipart
    """
    token = env["META_ACCESS_TOKEN"]
    params = dict(params or {})
    params["access_token"] = token
    # upload de video tem host proprio; o graph.facebook.com derruba a conexao
    # (EOF in violation of protocol) em arquivo grande
    url = f"{host or BASE}/{API_VERSION}{caminho}"

    if metodo == "GET":
        url = f"{url}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, method="GET")
    elif arquivo:
        campo, caminho_arq = arquivo
        body, content_type = _multipart({**params, **(dados or {})}, campo, caminho_arq)
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Content-Type", content_type)
    else:
        corpo = {**params, **(dados or {})}
        # a API aceita objetos aninhados como JSON string
        corpo = {k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in corpo.items()}
        req = urllib.request.Request(
            url, data=urllib.parse.urlencode(corpo).encode(), method="POST"
        )

    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        detalhe = _mascara(e.read().decode(errors="replace"), token)
        raise SystemExit(f"ERRO HTTP {e.code} em {metodo} {caminho}\n{detalhe}")
    except urllib.error.URLError as e:
        raise SystemExit(f"ERRO de rede em {metodo} {caminho}: {e.reason}")


def _multipart(campos: dict, nome_campo: str, caminho_arquivo: str):
    """Monta um corpo multipart/form-data com um arquivo."""
    limite = "----AplicaDevBoundary7MA4YWxkTrZu0gW"
    linhas = []
    for k, v in campos.items():
        linhas.append(f"--{limite}\r\n".encode())
        linhas.append(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode())
        linhas.append(f"{v}\r\n".encode())
    nome = os.path.basename(caminho_arquivo)
    linhas.append(f"--{limite}\r\n".encode())
    linhas.append(
        f'Content-Disposition: form-data; name="{nome_campo}"; filename="{nome}"\r\n'.encode()
    )
    linhas.append(b"Content-Type: video/mp4\r\n\r\n")
    with open(caminho_arquivo, "rb") as f:
        linhas.append(f.read())
    linhas.append(f"\r\n--{limite}--\r\n".encode())
    return b"".join(linhas), f"multipart/form-data; boundary={limite}"


def salvar_env(chave: str, valor: str, path: str = ENV_PATH) -> None:
    """Grava/atualiza uma chave no .env.meta preservando o resto do arquivo."""
    with open(path, encoding="utf-8") as f:
        linhas = f.readlines()
    achou = False
    for i, linha in enumerate(linhas):
        if linha.strip().startswith(f"{chave}="):
            linhas[i] = f"{chave}={valor}\n"
            achou = True
            break
    if not achou:
        linhas.append(f"{chave}={valor}\n")
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(linhas)
    print(f"  -> {chave} salvo no .env.meta")


def brl(centavos) -> str:
    return f"R$ {int(centavos) / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
