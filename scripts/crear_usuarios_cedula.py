"""
Aprovisiona usuarios de Supabase Auth para login por cédula (sin contraseña),
uno por cada fila de `public.agricultores` que ya tenga `cedula` cargada.

Cada agricultor obtiene:
  - un usuario en auth.users con email sintético determinístico
    {agricultor_id}@login.saturno.internal (nunca se muestra ni se usa a mano
    — ver lib/cedula-auth.ts, mismo esquema)
  - password aleatoria (no se usa: el login real es vía
    app/api/session/cedula/route.ts, que genera la sesión con
    service_role, no con esta contraseña)
  - una fila en user_profiles (role='farmer')

Requiere que `.env.local` ya apunte al proyecto de la empresa (NO al
personal) y que la columna `agricultores.cedula` ya esté cargada para los
agricultores que quieras aprovisionar.

Idempotente: si el usuario ya existe (mismo email sintético), lo saltea.

Uso:
  PYTHONIOENCODING=utf-8 python scripts/crear_usuarios_cedula.py
"""
from __future__ import annotations
import json, secrets, urllib.request, urllib.error, urllib.parse, csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = {}
for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.startswith("#"):
        k, _, v = line.partition("=")
        ENV[k.strip()] = v.strip().strip('"').strip("'")

BASE = ENV["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SVC  = ENV["SUPABASE_SERVICE_ROLE_KEY"]

EMAIL_DOMAIN = "login.saturno.internal"  # debe matchear lib/cedula-auth.ts

ADMIN_USERS_URL = f"{BASE}/auth/v1/admin/users"
REST_HEADERS = {
    "apikey": SVC,
    "Authorization": f"Bearer {SVC}",
    "Content-Type": "application/json",
}


def http_post(url: str, body: dict) -> tuple[int, dict]:
    req = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"), method="POST", headers=REST_HEADERS,
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


def fetch_agricultores_con_cedula() -> list[dict]:
    url = f"{BASE}/rest/v1/agricultores?select=agricultor_id,nombre,cedula&cedula=not.is.null&order=nombre"
    code, data = http_get(url)
    if code != 200 or not isinstance(data, list):
        raise RuntimeError(f"Error trayendo agricultores: {code} {data}")
    return data


def main():
    agricultores = fetch_agricultores_con_cedula()
    print(f"Procesando {len(agricultores)} agricultores con cédula cargada...\n")

    rows: list[dict] = []
    for i, a in enumerate(agricultores, 1):
        agricultor_id = a["agricultor_id"]
        nombre = a["nombre"] or agricultor_id
        cedula = a["cedula"]
        email = f"{agricultor_id}@{EMAIL_DOMAIN}"

        code, resp = http_post(ADMIN_USERS_URL, {
            "email": email,
            "password": secrets.token_urlsafe(24),  # nunca se usa para iniciar sesión
            "email_confirm": True,
            "user_metadata": {"agricultor_id": agricultor_id, "cedula": cedula, "nombre": nombre},
        })

        if code in (200, 201):
            user_id = resp.get("id")
            status = "creado"
        elif code == 422 or "already" in str(resp).lower() or "registered" in str(resp).lower():
            qcode, qresp = http_get(f"{ADMIN_USERS_URL}?email={urllib.parse.quote(email)}")
            users = qresp.get("users") if isinstance(qresp, dict) else []
            user_id = users[0]["id"] if users else None
            status = "ya existia"
        else:
            user_id = None
            status = f"ERROR {code}: {str(resp)[:80]}"

        if user_id:
            up_url = f"{BASE}/rest/v1/user_profiles?on_conflict=user_id"
            up_headers = {**REST_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"}
            req = urllib.request.Request(up_url,
                data=json.dumps({
                    "user_id": user_id,
                    "role": "farmer",
                    "agricultor_id": agricultor_id,
                }).encode("utf-8"),
                method="POST", headers=up_headers,
            )
            try:
                with urllib.request.urlopen(req, timeout=30):
                    pass
            except urllib.error.HTTPError as e:
                status += f" (profile err: {e.code})"

        rows.append({"n": i, "agricultor": nombre, "cedula": cedula, "agricultor_id": agricultor_id, "status": status})
        print(f"  [{i:2}/{len(agricultores)}] {status:<15} {nombre} (cedula {cedula})")

    out = ROOT / "usuarios_cedula_provisionados.csv"
    with out.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["n", "agricultor", "cedula", "agricultor_id", "status"])
        w.writeheader()
        for r in rows:
            w.writerow(r)

    creados = sum(1 for r in rows if r["status"] == "creado")
    existian = sum(1 for r in rows if r["status"] == "ya existia")
    errores = sum(1 for r in rows if "ERROR" in r["status"])
    print(f"\nResumen: {creados} creados · {existian} ya existian · {errores} errores")
    print(f"CSV: {out}")


if __name__ == "__main__":
    main()
