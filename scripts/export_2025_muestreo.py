"""
Estudio de muestreo estratificado — data 2025 (Proyecto Saturno).

Genera un Excel para diseñar un muestreo estratificado (por estado) de cara a
estimar un modelo de rendimiento POR LOTE en ciclos futuros, y para juzgar si
la data supervisada disponible alcanza.

Hojas:
  1. LEEME            — diccionario, completitud, caveats y veredicto
  2. agricultor_2025  — dataset etiquetado (rendimiento real por agricultor/UP)
  3. lote_2025        — 161 lotes con las features que SÍ existen
  4. resumen_estado   — N, media, desviación, varianza, CV, pesos por estrato
  5. muestreo         — asignación proporcional vs Neyman + n requerido por margen
  6. completitud_lote — % de llenado por columna del lote (qué features faltan)

Uso:  python scripts/export_2025_muestreo.py
Output: C:\\Users\\perez\\OneDrive\\Escritorio\\Polar_2025_Muestreo_<fecha>.xlsx
"""
from __future__ import annotations
import json, math, urllib.request, urllib.parse
from datetime import datetime
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".env.local"
Z = 1.96  # 95%

def load_env(p: Path) -> dict:
    e = {}
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            e[k.strip()] = v.strip().strip('"').strip("'")
    return e

def fetch(env, table, select="*", filters=None, page=1000):
    base = (env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL")).rstrip("/")
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    rows, off = [], 0
    while True:
        params = [("select", select)]
        if filters:
            params += list(filters.items())
        url = f"{base}/rest/v1/{table}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(url, headers={
            "apikey": key, "Authorization": f"Bearer {key}",
            "Range-Unit": "items", "Range": f"{off}-{off+page-1}"})
        with urllib.request.urlopen(req, timeout=60) as r:
            chunk = json.loads(r.read())
        rows += chunk
        if len(chunk) < page:
            break
        off += page
    return rows

def num(v):
    if v is None or v == "":
        return None
    try:
        return float(str(v).replace(".", "").replace(",", ".")) if str(v).count(",") and str(v).count(".") else float(str(v).replace(",", "."))
    except Exception:
        return None

# ---- styling ----
HFILL = PatternFill("solid", fgColor="1A6E2C"); HFONT = Font(bold=True, color="FFFFFF")
HAL = Alignment(horizontal="center", vertical="center", wrap_text=True)
T = Side(style="thin", color="DDDDDD"); BD = Border(left=T, right=T, top=T, bottom=T)
SUB = PatternFill("solid", fgColor="E8F2EA")

def sheet(ws, headers, rows, numfmt="#,##0.00"):
    for c, h in enumerate(headers, 1):
        x = ws.cell(1, c, h); x.fill = HFILL; x.font = HFONT; x.alignment = HAL; x.border = BD
    for r, row in enumerate(rows, 2):
        for c, v in enumerate(row, 1):
            x = ws.cell(r, c, v); x.border = BD
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                x.number_format = numfmt; x.alignment = Alignment(horizontal="right")
    for c in range(1, len(headers)+1):
        w = len(str(headers[c-1]))
        for r in range(2, min(len(rows)+2, 300)):
            v = ws.cell(r, c).value
            if v is not None:
                w = max(w, min(len(str(v)), 48))
        ws.column_dimensions[get_column_letter(c)].width = max(10, min(w+2, 48))
    ws.row_dimensions[1].height = 30; ws.freeze_panes = "A2"

def main():
    env = load_env(ENV)
    print("Conectando…")
    agro = fetch(env, "agropecuaria", "AgricultorKey,nombre_agropecuaria,agropecuaria_id,ciclo")
    up25 = fetch(env, "unidad_produccion", "*", {"ciclo": "eq.2025"})
    lot25 = fetch(env, "lote", "*", {"ciclo": "eq.2025"})
    rend = fetch(env, "Rendimiento", "AgricultorKey,agricultor,hectareas_totales,rendimiento,ciclo", {"ciclo": "eq.2025"})
    print(f"  {len(up25)} UP · {len(lot25)} lotes · {len(rend)} rendimientos")

    id2estado = {u["codigo_up"]: u.get("estado") for u in up25}
    aid2estado = {}
    for u in up25:
        if u.get("agropecuaria_id"):
            aid2estado.setdefault(u["agropecuaria_id"], u.get("estado"))
    key2aid = {a["AgricultorKey"]: a.get("agropecuaria_id") for a in agro}
    key2name = {a["AgricultorKey"]: a.get("nombre_agropecuaria") for a in agro}
    def estado_of_key(k):
        return aid2estado.get(key2aid.get(k))

    # ---------- agricultor_2025 (dataset etiquetado) ----------
    lotes_por_key = {}
    for l in lot25:
        lotes_por_key[l.get("AgricultorKey")] = lotes_por_key.get(l.get("AgricultorKey"), 0) + 1
    ag_rows, ag_data = [], []
    for r in sorted(rend, key=lambda x: (estado_of_key(x["AgricultorKey"]) or "ZZ", -(r_:=x.get("rendimiento") or 0))):
        k = r["AgricultorKey"]; est = estado_of_key(k) or "(sin estado)"
        y = r.get("rendimiento"); ha = r.get("hectareas_totales")
        ag_rows.append([k, key2name.get(k) or r.get("agricultor"), est, ha,
                        round(y, 3) if y is not None else None, lotes_por_key.get(k, 0)])
        if y is not None:
            ag_data.append((est, y, ha or 0))

    # ---------- resumen por estado ----------
    estados = {}
    for est, y, ha in ag_data:
        estados.setdefault(est, {"y": [], "ha": 0.0})
        estados[est]["y"].append(y); estados[est]["ha"] += ha
    lotes_estado = {}
    for l in lot25:
        e = id2estado.get(l.get("unidad_produccion_id")) or "(sin estado)"
        lotes_estado[e] = lotes_estado.get(e, 0) + 1
    N_lotes = sum(lotes_estado.values())
    all_y = [y for _, y, _ in ag_data]
    overall_mean = sum(all_y)/len(all_y)
    overall_sd = (sum((v-overall_mean)**2 for v in all_y)/(len(all_y)-1))**0.5

    res_rows = []
    strata = []
    for est in sorted(estados, key=lambda e: -len(estados[e]["y"])):
        ys = estados[est]["y"]; n = len(ys); m = sum(ys)/n
        sd = (sum((v-m)**2 for v in ys)/(n-1))**0.5 if n > 1 else None
        Nh = lotes_estado.get(est, 0)
        sd_use = sd if sd is not None else overall_sd  # fallback para n<2
        strata.append({"est": est, "Nh": Nh, "n_lab": n, "mean": m, "sd": sd, "sd_use": sd_use, "ha": estados[est]["ha"]})
        res_rows.append([est, Nh, n, round(estados[est]["ha"], 1), round(m, 3),
                         round(sd, 3) if sd is not None else None,
                         round((sd/m), 3) if sd is not None else None,
                         round(Nh/N_lotes, 3) if N_lotes else None,
                         "sd insuficiente (n<2) → usa SD global" if sd is None else
                         ("SD poco fiable (n=2)" if n == 2 else "ok")])
    res_rows.append(["TOTAL / global", N_lotes, len(all_y), round(sum(s['ha'] for s in strata), 1),
                     round(overall_mean, 3), round(overall_sd, 3), round(overall_sd/overall_mean, 3), 1.0, ""])

    # ---------- muestreo estratificado ----------
    SumNhSh = sum(s["Nh"]*s["sd_use"] for s in strata)
    SumWhSh2 = sum((s["Nh"]/N_lotes)*s["sd_use"]**2 for s in strata)   # varianza within (proporcional)
    mu_rows = []
    for n_target in (20, 30, 40, 50, 60):
        for s in strata:
            prop = n_target * s["Nh"]/N_lotes
            ney = n_target * (s["Nh"]*s["sd_use"])/SumNhSh if SumNhSh else 0
            mu_rows.append([n_target, s["est"], s["Nh"], round(s["sd_use"], 3),
                            round(prop, 1), int(round(prop)), round(ney, 1), int(round(ney))])
        mu_rows.append([n_target, "—TOTAL—", N_lotes, "",
                        n_target, n_target, n_target, n_target])

    # n requerido por margen de error (proporcional, con fpc)
    req_rows = []
    for E in (0.3, 0.4, 0.5, 0.7):
        n0 = (Z**2 * SumWhSh2) / (E**2)
        n_fpc = n0/(1 + n0/N_lotes)
        n0_srs = (Z*overall_sd/E)**2
        n_srs = n0_srs/(1+n0_srs/N_lotes)
        req_rows.append([E, round(n0, 1), int(math.ceil(n_fpc)), int(math.ceil(n_srs)),
                         f"{round(100*(1-n_fpc/n_srs))}% menos que SRS" if n_srs else ""])

    # ---------- completitud lote ----------
    cols = ["rendimiento_real","ha_sembradas","ha_cosechadas","ha_perdidas","poligono_geom",
            "poligonos_wkt","pendientes","compactacion","condicion_drenaje","drenajes_internos",
            "depresiones","elevaciones","fecha_inicio_siembra_real","edo_gral_cultivo_v","tipo_lote"]
    comp_rows = []
    for c in cols:
        full = sum(1 for l in lot25 if (l.get(c) not in (None, "")))
        comp_rows.append([c, full, len(lot25), round(100*full/len(lot25), 1)])

    # ============ build workbook ============
    wb = Workbook()

    ws = wb.active; ws.title = "LEEME"
    notes = [
     ["ESTUDIO DE MUESTREO ESTRATIFICADO — DATA 2025", ""],
     ["Generado", datetime.now().strftime("%Y-%m-%d %H:%M")],
     ["", ""],
     ["OBJETIVO", "Diseñar muestreo estratificado por estado para estimar un modelo de rendimiento POR LOTE en ciclos futuros, y juzgar suficiencia de datos."],
     ["", ""],
     ["QUÉ HAY (etiquetado, ciclo 2025)", ""],
     ["Rendimiento real", f"{len(all_y)} agricultores (nivel Unidad de Producción), media {overall_mean:.2f} t/ha, SD {overall_sd:.2f}, CV {overall_sd/overall_mean:.0%}"],
     ["Estados representados", f"{len([s for s in strata])}: " + ", ".join(f"{s['est']}({s['n_lab']})" for s in strata)],
     ["Lotes 2025 (frame)", f"{N_lotes} lotes con estado asignado"],
     ["", ""],
     ["LIMITACIÓN CRÍTICA (para modelo POR LOTE)", ""],
     ["Rendimiento por LOTE", "Solo 4 de 161 lotes tienen rendimiento_real → NO hay etiqueta a nivel lote internamente."],
     ["Geometría por lote", "0 de 161 cargada en BD (existe verificada, fuera de Supabase)."],
     ["Features agronómicas por lote", "pendientes/compactación/drenaje: 0% llenas (ver hoja completitud_lote)."],
     ["Unidad de la etiqueta", "El rendimiento real está a nivel AGRICULTOR/UP, no por lote. La varianza por estado es entre-agricultor, NO entre-lote (la de lote suele ser MAYOR)."],
     ["", ""],
     ["VEREDICTO — ¿alcanza para un modelo propio por lote?", ""],
     ["Con la data interna sola", "NO. Faltan etiquetas por lote, geometría y features de lote."],
     ["Con la data supervisada del proveedor", "Depende de que incluya: (1) rendimiento real POR LOTE (etiqueta), (2) features por lote (geometría/área efectiva, suelo, pendiente, drenaje), (3) tamaño de muestra por estrato según hoja 'muestreo'."],
     ["Uso de esta data 2025", "Sirve para (a) fijar la estructura de estratos y la varianza a-priori, (b) dimensionar cuántos lotes etiquetar por estado, (c) baseline de rendimiento. NO para entrenar el modelo por lote todavía."],
     ["Sesgo a vigilar", "n minúsculo: Cojedes n=2 y Aragua n=1 → su varianza no es fiable; el muestreo usa SD global como respaldo en esos estratos (ver notas en 'resumen_estado')."],
     ["Recomendación", "Pedir al proveedor un PILOTO que mida varianza DENTRO de finca (entre lotes) en 2-3 fincas por estado; con eso se recalcula n por estrato con la varianza correcta (lote, no agricultor)."],
    ]
    for r, (a, b) in enumerate(notes, 1):
        ca = ws.cell(r, 1, a); cb = ws.cell(r, 2, b)
        ca.font = Font(bold=True, color=("1A6E2C" if (b == "" and a) else "000000"))
        cb.alignment = Alignment(wrap_text=True, vertical="top")
    ws.column_dimensions["A"].width = 42; ws.column_dimensions["B"].width = 95

    sheet(wb.create_sheet("agricultor_2025"),
          ["AgricultorKey","Nombre","Estado","Hectáreas","Rendimiento real (t/ha)","# Lotes"], ag_rows)

    lt_rows = []
    for l in sorted(lot25, key=lambda x: (id2estado.get(x.get("unidad_produccion_id")) or "ZZ", x.get("codigo_lote") or "")):
        lt_rows.append([
            key2name.get(l.get("AgricultorKey")) or l.get("nombre_productor_v"),
            id2estado.get(l.get("unidad_produccion_id")) or "(sin estado)",
            l.get("codigo_lote"), l.get("nombre_lote"), l.get("unidad_produccion_v"),
            num(l.get("ha_sembradas")), num(l.get("ha_cosechadas")), num(l.get("ha_perdidas")),
            num(l.get("rendimiento_real")), l.get("fecha_inicio_siembra_real"),
            l.get("edo_gral_cultivo_v"), l.get("tipo_lote")])
    sheet(wb.create_sheet("lote_2025"),
          ["Agricultor","Estado","Código lote","Nombre lote","Unidad","Ha sembradas","Ha cosechadas",
           "Ha perdidas","Rend. real lote (t/ha)","Fecha siembra real","Estado cultivo","Tipo lote"], lt_rows)

    sheet(wb.create_sheet("resumen_estado"),
          ["Estado","N lotes (frame)","n agric. etiquetados","Ha (rend.)","Media t/ha","SD t/ha","CV","Peso Wh (lotes)","Nota"], res_rows)

    ws = wb.create_sheet("muestreo")
    sheet(ws, ["n total objetivo","Estado","N lotes","SD usada","Asig. proporcional","→ n","Asig. Neyman","→ n"], mu_rows)
    base = len(mu_rows)+4
    ws.cell(base, 1, "n REQUERIDO por margen de error (95%, estimación de la media de rendimiento)").font = Font(bold=True, color="1A6E2C")
    hdr = ["Margen ±E (t/ha)","n0 (sin fpc)","n estratificado (prop.)","n SRS (sin estratos)","Ganancia"]
    for c, h in enumerate(hdr, 1):
        x = ws.cell(base+1, c, h); x.fill = HFILL; x.font = HFONT; x.alignment = HAL; x.border = BD
    for r, row in enumerate(req_rows, base+2):
        for c, v in enumerate(row, 1):
            x = ws.cell(r, c, v); x.border = BD
            if isinstance(v, (int, float)): x.number_format = "#,##0.0"; x.alignment = Alignment(horizontal="right")

    sheet(wb.create_sheet("completitud_lote"),
          ["Columna (feature de lote)","Llenas","Total lotes","% llenado"], comp_rows)

    out = Path("C:/Users/perez/OneDrive/Escritorio") / f"Polar_2025_Muestreo_{datetime.now():%Y-%m-%d}.xlsx"
    wb.save(out)
    print(f"\nOK -> {out}  ({out.stat().st_size/1024:.0f} KB)")
    # consola
    print("\nResumen por estado (rendimiento real 2025):")
    for s in strata:
        print(f"  {s['est']:<12} Nlotes={s['Nh']:>3}  n={s['n_lab']:>2}  media={s['mean']:.2f}  sd={('%.2f'%s['sd']) if s['sd'] else 'NA':>4}")
    print(f"  GLOBAL        media={overall_mean:.2f}  sd={overall_sd:.2f}  CV={overall_sd/overall_mean:.0%}")
    print("\nn requerido (prop. estratificado, fpc):")
    for E, n0, nf, ns, g in req_rows:
        print(f"  ±{E} t/ha -> {nf} lotes (vs {ns} SRS)")

if __name__ == "__main__":
    main()
