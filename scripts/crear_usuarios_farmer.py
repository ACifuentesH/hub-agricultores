"""
Crea usuarios farmer en Supabase Auth para los 35 agricultores del ciclo 2026.

Cada agricultor obtiene:
  - email:   <agricultor_key_lowercase>@agripolar.test
  - password: PolarFarmer2026#
  - role:    farmer
  - agricultor_key: su clave canónica

NO toca al master existente (admin@agriplatform.com).
Idempotente: si el usuario ya existe (email duplicado), saltea y reporta.

Uso:
  PYTHONIOENCODING=utf-8 python scripts/crear_usuarios_farmer.py
"""
from __future__ import annotations
import json, urllib.request, urllib.error, urllib.parse, csv
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
ENV = {}
for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.startswith("#"):
        k, _, v = line.partition("=")
        ENV[k.strip()] = v.strip().strip('"').strip("'")

BASE = ENV["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SVC  = ENV["SUPABASE_SERVICE_ROLE_KEY"]

PASSWORD = "PolarFarmer2026#"
EMAIL_DOMAIN = "agripolar.test"

ADMIN_USERS_URL = f"{BASE}/auth/v1/admin/users"
REST_HEADERS = {
    "apikey": SVC,
    "Authorization": f"Bearer {SVC}",
    "Content-Type": "application/json",
}


def http_post(url: str, body: dict) -> tuple[int, dict]:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers=REST_HEADERS,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.getcode(), json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {"error": str(e)}


def http_patch(url: str, body: dict) -> tuple[int, dict]:
    req = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"),
        method="PATCH", headers=REST_HEADERS,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.getcode(), json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {"error": str(e)}


def http_get(url: str) -> tuple[int, list | dict]:
    req = urllib.request.Request(url, headers=REST_HEADERS, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.getcode(), json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, {"error": str(e)}


def fetch_2026_agricultores() -> list[dict]:
    """Trae los agricultores cuyo perfil 2026 existe (35 esperados)."""
    url = (f"{BASE}/rest/v1/agropecuaria"
           "?select=AgricultorKey,nombre_agropecuaria,ciclo"
           "&order=nombre_agropecuaria")
    code, data = http_get(url)
    if code != 200 or not isinstance(data, list):
        raise RuntimeError(f"Error trayendo agricultores: {code} {data}")
    # Filtrar los que tienen 2026 en su ciclo
    return [a for a in data if "2026" in (a.get("ciclo") or "")]


def main():
    agricultores = fetch_2026_agricultores()
    print(f"Procesando {len(agricultores)} agricultores 2026...\n")

    rows: list[dict] = []
    for i, a in enumerate(agricultores, 1):
        key = a["AgricultorKey"]
        nombre = a["nombre_agropecuaria"] or key
        email = f"{key.lower()}@{EMAIL_DOMAIN}"

        # 1) Crear usuario en auth (email_confirm=true para no enviar mail)
        code, resp = http_post(ADMIN_USERS_URL, {
            "email": email,
            "password": PASSWORD,
            "email_confirm": True,
            "user_metadata": {"agricultor_key": key, "agricultor_nombre": nombre},
        })

        if code in (200, 201):
            user_id = resp.get("id")
            status = "✓ creado"
        elif code == 422 or "already" in str(resp).lower() or "registered" in str(resp).lower():
            # Ya existe — buscar su user_id por email
            qcode, qresp = http_get(f"{ADMIN_USERS_URL}?email={urllib.parse.quote(email)}")
            users = qresp.get("users") if isinstance(qresp, dict) else []
            user_id = users[0]["id"] if users else None
            status = "⏸ ya existía"
        else:
            user_id = None
            status = f"✗ ERROR {code}: {str(resp)[:80]}"

        # 2) Insertar/actualizar user_profiles vía PostgREST upsert
        if user_id:
            up_url = f"{BASE}/rest/v1/user_profiles?on_conflict=user_id"
            up_headers = {**REST_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"}
            req = urllib.request.Request(up_url,
                data=json.dumps({
                    "user_id": user_id,
                    "role": "farmer",
                    "agricultor_key": key,
                }).encode("utf-8"),
                method="POST", headers=up_headers,
            )
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    pass
            except urllib.error.HTTPError as e:
                status += f" (profile err: {e.code})"

        rows.append({
            "n": i, "agricultor": nombre, "AgricultorKey": key,
            "email": email, "password": PASSWORD, "status": status,
        })
        print(f"  [{i:2}/{len(agricultores)}] {status:<15} {nombre}")

    # Reporte final
    out = ROOT.parent.parent / "Polar_Usuarios_Farmer_2026.csv"
    with out.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["n", "agricultor", "AgricultorKey", "email", "password", "status"])
        w.writeheader()
        for r in rows:
            w.writerow(r)

    creados = sum(1 for r in rows if "creado" in r["status"])
    existian = sum(1 for r in rows if "existía" in r["status"])
    errores = sum(1 for r in rows if "ERROR" in r["status"])

    print(f"\nResumen: {creados} creados · {existian} ya existían · {errores} errores")
    print(f"CSV con todas las credenciales: {out}")


if __name__ == "__main__":
    main()
