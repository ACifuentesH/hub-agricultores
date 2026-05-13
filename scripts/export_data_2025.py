"""
Genera un Excel con TODA la data disponible del ciclo 2025.

Hojas:
  1. Resumen ejecutivo
  2. Agricultores (perfil + rendimiento agregado)
  3. Unidades de Producción (P&L)
  4. Lotes (siembra, cosecha, rendimiento, suelo)
  5. Insumos aplicados (productos por lote)

Uso:
    python scripts/export_data_2025.py

Output: C:\\Users\\perez\\OneDrive\\Escritorio\\Polar_2025_Reporte_<fecha>.xlsx
"""
from __future__ import annotations
import os
import sys
import urllib.request
import urllib.parse
import json
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.local"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def supabase_query(env: dict[str, str], sql: str) -> list[dict]:
    """Ejecuta SQL via PostgREST RPC `pg_meta_query` no — usamos la PostgREST
    estándar con la llave service_role."""
    # PostgREST no acepta SQL crudo. Usamos el endpoint /rest/v1/ con select.
    # Como queremos joins complejos, mejor usar una vista o la API REST.
    raise NotImplementedError("Usa fetch_table en su lugar")


def fetch_table(env: dict[str, str], table: str, select: str = "*",
                filters: dict | None = None, order: str | None = None,
                page_size: int = 1000) -> list[dict]:
    """Pagina automáticamente — PostgREST limita a 1000 por respuesta."""
    base = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    all_rows: list[dict] = []
    offset = 0
    while True:
        params: list[tuple[str, str]] = [("select", select)]
        if filters:
            for k, v in filters.items():
                params.append((k, v))
        if order:
            params.append(("order", order))
        qs = urllib.parse.urlencode(params)
        url = f"{base}/rest/v1/{table}?{qs}"
        req = urllib.request.Request(
            url,
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Accept": "application/json",
                "Range-Unit": "items",
                "Range": f"{offset}-{offset + page_size - 1}",
            },
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            chunk = json.loads(r.read())
        if not chunk:
            break
        all_rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    return all_rows


def fmt_num(v):
    if v is None or v == "":
        return None
    try:
        s = str(v).replace(",", ".")
        return float(s)
    except Exception:
        return v


# -------------------------------- styling helpers ---------------------------

HEADER_FILL = PatternFill("solid", fgColor="1A6E2C")  # Polar green
HEADER_FONT = Font(bold=True, color="FFFFFF", size=11)
HEADER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=True)
THIN = Side(style="thin", color="DDDDDD")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def write_sheet(ws, headers: list[str], rows: list[list]):
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=c, value=h)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = HEADER_ALIGN
        cell.border = BORDER
    for r, row in enumerate(rows, 2):
        for c, val in enumerate(row, 1):
            cell = ws.cell(row=r, column=c, value=val)
            cell.border = BORDER
            if isinstance(val, (int, float)):
                cell.number_format = "#,##0.00"
                cell.alignment = Alignment(horizontal="right")
    # Auto-anchos
    for c in range(1, len(headers) + 1):
        col = get_column_letter(c)
        max_len = len(str(headers[c - 1]))
        for r in range(2, min(len(rows) + 2, 200)):
            v = ws.cell(row=r, column=c).value
            if v is not None:
                max_len = max(max_len, min(len(str(v)), 50))
        ws.column_dimensions[col].width = max(10, min(max_len + 2, 50))
    ws.row_dimensions[1].height = 32
    ws.freeze_panes = "A2"


# ---------------------------- main ------------------------------------------

def main():
    env = load_env(ENV_FILE)
    print("Conectando a Supabase…")

    # Pull all relevant tables (filter by ciclo='2025' or cycle includes 2025)
    print("→ agropecuaria"); ag = fetch_table(env, "agropecuaria",
        select="AgricultorKey,nombre_agropecuaria,cedula,correo_electronico,ciclo")
    ag = [a for a in ag if "2025" in (a.get("ciclo") or "")]

    print("→ unidad_produccion"); up = fetch_table(env, "unidad_produccion",
        select="*", filters={"ciclo": "eq.2025"})

    print("→ lote"); lt = fetch_table(env, "lote",
        select="*", filters={"ciclo": "eq.2025"})

    print("→ Rendimiento"); rd = fetch_table(env, "Rendimiento",
        select="AgricultorKey,agricultor,hectareas_totales,rendimiento,ciclo",
        filters={"ciclo": "eq.2025"})
    rd_by_key = {r["AgricultorKey"]: r for r in rd}

    print("→ producto_registro"); pr = fetch_table(env, "producto_registro",
        select="lote_v,nombre_producto,categoria_producto,dosis_real_ha,dosis_recomendada_v,ha_aplicadas,fecha_registro,ciclo",
        filters={"ciclo": "eq.2025"})

    print(f"  · {len(ag)} agricultores · {len(up)} unidades · {len(lt)} lotes "
          f"· {len(rd)} rendimientos · {len(pr)} insumos")

    wb = Workbook()

    # ------------------- Hoja 1: Resumen ----------------------------------
    ws = wb.active
    ws.title = "Resumen"
    total_ha_sembradas = sum(fmt_num(l.get("ha_sembradas")) or 0 for l in lt)
    total_ha_perdidas = sum(fmt_num(l.get("ha_perdidas")) or 0 for l in lt)
    total_ha_cosechadas = sum(fmt_num(l.get("ha_cosechadas")) or 0 for l in lt)
    total_costos = sum(fmt_num(u.get("costo_total")) or 0 for u in up)
    total_ingreso = sum(fmt_num(u.get("ingreso_venta")) or 0 for u in up)
    total_utilidad = sum(fmt_num(u.get("utilidad_total")) or 0 for u in up)
    rend_promedio = (sum(r["rendimiento"] for r in rd if r.get("rendimiento")) /
                     max(1, sum(1 for r in rd if r.get("rendimiento"))))

    summary_rows = [
        ["Métrica", "Valor"],
        ["Ciclo agrícola", "2025"],
        ["Agricultores en programa", len(ag)],
        ["Unidades de producción", len(up)],
        ["Lotes registrados", len(lt)],
        ["Hectáreas sembradas (total)", round(total_ha_sembradas, 2)],
        ["Hectáreas perdidas (total)", round(total_ha_perdidas, 2)],
        ["Hectáreas cosechadas (total)", round(total_ha_cosechadas, 2)],
        ["Rendimiento promedio (t/ha)", round(rend_promedio, 2)],
        ["Costo total programa (USD)", round(total_costos, 2)],
        ["Ingreso por venta (USD)", round(total_ingreso, 2)],
        ["Utilidad total (USD)", round(total_utilidad, 2)],
        ["Insumos aplicados (registros)", len(pr)],
        ["Reporte generado", datetime.now().strftime("%Y-%m-%d %H:%M")],
    ]
    for r, row in enumerate(summary_rows, 1):
        for c, val in enumerate(row, 1):
            cell = ws.cell(row=r, column=c, value=val)
            if r == 1:
                cell.fill = HEADER_FILL; cell.font = HEADER_FONT
                cell.alignment = HEADER_ALIGN
            else:
                cell.font = Font(bold=(c == 1))
            cell.border = BORDER
    ws.column_dimensions["A"].width = 36
    ws.column_dimensions["B"].width = 24
    ws.row_dimensions[1].height = 28

    # ------------------- Hoja 2: Agricultores ------------------------------
    ws = wb.create_sheet("Agricultores")
    headers = ["AgricultorKey", "Nombre", "Cédula/RIF", "Correo",
               "Lotes registrados", "Hectáreas totales", "Rendimiento (t/ha)"]
    rows = []
    lotes_by_key: dict[str, int] = {}
    for l in lt:
        k = l.get("AgricultorKey")
        lotes_by_key[k] = lotes_by_key.get(k, 0) + 1
    for a in sorted(ag, key=lambda x: x["nombre_agropecuaria"] or ""):
        k = a["AgricultorKey"]
        r = rd_by_key.get(k)
        rows.append([
            k,
            a.get("nombre_agropecuaria"),
            a.get("cedula"),
            a.get("correo_electronico"),
            lotes_by_key.get(k, 0),
            r.get("hectareas_totales") if r else None,
            round(r["rendimiento"], 2) if r and r.get("rendimiento") else None,
        ])
    write_sheet(ws, headers, rows)

    # ------------------- Hoja 3: Unidades de Producción --------------------
    ws = wb.create_sheet("Unidades de Producción")
    ag_by_id = {a["AgricultorKey"]: a for a in ag}
    # need to map agropecuaria_id → AgricultorKey (need full load of agropecuaria)
    print("→ agropecuaria full mapping…")
    ag_full = fetch_table(env, "agropecuaria",
        select="AgricultorKey,nombre_agropecuaria,agropecuaria_id,ciclo")
    ag_id_to_name: dict[str, str] = {}
    for a in ag_full:
        if a.get("agropecuaria_id"):
            ag_id_to_name[a["agropecuaria_id"]] = a["nombre_agropecuaria"] or ""

    headers = [
        "Código UP", "Nombre Unidad", "Estado", "Municipio", "Agricultor",
        "Ha unidad", "Ha Polar efectiva", "Rendimiento real (t/ha)",
        "Meta rendimiento", "Precio maíz USD/ton", "Costo total (USD)",
        "Ingreso venta (USD)", "Utilidad total (USD)", "Utilidad agricultor",
        "Ha perdidas",
        "Costo semillas", "Costo agroquímicos", "Costo fertilizantes",
        "Costo enmienda", "Costo mecanización", "Costo operaciones",
        "Costo financiamiento",
    ]
    rows = []
    for u in sorted(up, key=lambda x: (ag_id_to_name.get(x.get("agropecuaria_id") or "", "ZZZ"),
                                       x.get("codigo_up") or "")):
        rows.append([
            u.get("codigo_up"),
            u.get("nombre"),
            u.get("estado"),
            u.get("municipio"),
            ag_id_to_name.get(u.get("agropecuaria_id") or "", ""),
            fmt_num(u.get("numero_total_ha_unidad")),
            fmt_num(u.get("numero_ha_polar_efec")),
            fmt_num(u.get("rendimiento_ha")),
            fmt_num(u.get("valor_meta_rend_ha")),
            fmt_num(u.get("precio_maiz_usd_ton")),
            fmt_num(u.get("costo_total")),
            fmt_num(u.get("ingreso_venta")),
            fmt_num(u.get("utilidad_total")),
            fmt_num(u.get("utilidad_agricultor")),
            fmt_num(u.get("ha_perdidas_acumuladas")),
            fmt_num(u.get("costo_total_semillas")),
            fmt_num(u.get("costo_total_agroquimicos")),
            fmt_num(u.get("costo_total_fertilizantes")),
            fmt_num(u.get("costo_total_enmienda")),
            fmt_num(u.get("costo_total_mecanizacion")),
            fmt_num(u.get("costo_total_operaciones")),
            fmt_num(u.get("costo_total_financiamiento")),
        ])
    write_sheet(ws, headers, rows)

    # ------------------- Hoja 4: Lotes -------------------------------------
    ws = wb.create_sheet("Lotes")
    headers = [
        "Agricultor", "Código lote", "Nombre lote", "Unidad",
        "Ha sembradas", "Ha perdidas", "Ha cosechadas", "Rendimiento real (t/ha)",
        "Fecha siembra plan.", "Fecha siembra real",
        "Estado cultivo", "Textura suelo", "Compactación",
        "Drenaje", "Drenajes internos",
    ]
    rows = []
    ag_key_to_name = {a["AgricultorKey"]: a["nombre_agropecuaria"] for a in ag_full}
    for l in sorted(lt, key=lambda x: (ag_key_to_name.get(x.get("AgricultorKey") or "", "ZZZ"),
                                        x.get("codigo_lote") or "")):
        rows.append([
            ag_key_to_name.get(l.get("AgricultorKey") or "", ""),
            l.get("codigo_lote"),
            l.get("nombre_lote"),
            l.get("unidad_produccion_v"),
            fmt_num(l.get("ha_sembradas")),
            fmt_num(l.get("ha_perdidas")),
            fmt_num(l.get("ha_cosechadas")),
            fmt_num(l.get("rendimiento_real")),
            l.get("fecha_inicio_siembra"),
            l.get("fecha_inicio_siembra_real"),
            l.get("edo_gral_cultivo_v"),
            l.get("segmentacion_particulas"),
            l.get("compactacion"),
            l.get("condicion_drenaje"),
            l.get("drenajes_internos"),
        ])
    write_sheet(ws, headers, rows)

    # ------------------- Hoja 5: Insumos aplicados -------------------------
    ws = wb.create_sheet("Insumos aplicados")
    headers = ["Lote", "Producto", "Categoría", "Dosis real/ha",
               "Dosis recomendada", "Ha aplicadas", "Fecha"]
    rows = []
    for p in sorted(pr, key=lambda x: (x.get("lote_v") or "", x.get("nombre_producto") or "")):
        rows.append([
            p.get("lote_v"),
            p.get("nombre_producto"),
            p.get("categoria_producto"),
            fmt_num(p.get("dosis_real_ha")),
            fmt_num(p.get("dosis_recomendada_v")),
            fmt_num(p.get("ha_aplicadas")),
            p.get("fecha_registro"),
        ])
    write_sheet(ws, headers, rows)

    # ------------------- Save ----------------------------------------------
    out = Path("C:/Users/perez/OneDrive/Escritorio") / f"Polar_2025_Reporte_{datetime.now():%Y-%m-%d}.xlsx"
    wb.save(out)
    print(f"\n✓ Excel generado: {out}")
    print(f"  Tamaño: {out.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
