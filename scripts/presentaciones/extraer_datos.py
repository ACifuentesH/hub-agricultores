"""Extrae de Supabase los datos de un agricultor para su presentación de cierre de ciclo.

Uso:
    python scripts/presentaciones/extraer_datos.py B01 > datos_B01.json

Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del entorno. El espejo `saturno.*`
no está expuesto por PostgREST, así que se lee con la RPC `saturno_debug_sample`
(solo service_role) y se filtra aquí por unidad de producción.

Todo lo que NO está en la base (liquidación de mecanización, flujo de caja,
polígonos de los lotes) sale como `None` y el generador lo marca PENDIENTE.
"""

import json
import os
import re
import statistics
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime

CICLO_ID = "742cb71b"  # ciclo 2026 en Saturno
META_T_HA = 5.0  # meta de rendimiento del programa (268 t = 53,6 ha × 5 en la plantilla)

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


def _req(path, body=None):
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers=HEADERS,
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def rest(tabla, **filtros):
    q = urllib.parse.urlencode({"select": "*", **filtros})
    return _req(f"{tabla}?{q}")


def saturno(tabla):
    return _req("rpc/saturno_debug_sample", {"p_tabla": tabla, "p_limit": 200000})


def fecha_saturno(s):
    """Saturno guarda MM/DD/YYYY."""
    if not s:
        return None
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", s)
    return date(int(m[3]), int(m[1]), int(m[2])) if m else None


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- incidencias
# Reglas para leer los comentarios de campo. Si un comentario no encaja en
# ninguna, no se muestra como incidencia (las labores rutinarias no lo son).
RETOS = [
    ("mazorca", "MAZORCA AL CIERRE", re.compile(r"agobio|mazorcas? con da", re.I)),
    ("plagas", "PLAGAS (GUSANO COGOLLERO / LARVAS)", re.compile(r"larva|gusano|cogollero|plaga|insect|barre", re.I)),
    ("maleza", "MALEZAS", re.compile(r"maleza", re.I)),
]

ETIQUETAS = [
    (re.compile(r"agobio", re.I), "Agobio en mazorcas"),
    (re.compile(r"mazorcas? con da", re.I), "Mazorcas con daño"),
    (re.compile(r"bordes.*larva|larva.*bordes", re.I), "Larvas en bordes"),
    (re.compile(r"larva", re.I), "Larvas L1–L2"),
    (re.compile(r"barre", re.I), "Re-control de plagas"),
    (re.compile(r"control de cierre", re.I), "Control de cierre"),
    (re.compile(r"maleza", re.I), "Control de malezas"),
    (re.compile(r"sello", re.I), "Gusano cogollero"),
]


def clasificar(texto):
    for clave, _, rx in RETOS:
        if rx.search(texto or ""):
            return clave
    return None


def etiqueta(texto, por_defecto):
    for rx, et in ETIQUETAS:
        if rx.search(texto or ""):
            return et
    return por_defecto


def main(codigo_up):
    up_id = f"{codigo_up}-{CICLO_ID}"

    up = next(u for u in saturno("unidades_de_produccion") if u.get("unidad_produccion_id") == up_id)
    nombre = up["nombrerepresentante"].strip()
    agr = rest("agricultores", id_saturno=f"eq.{up_id}")[0]

    # ------------------------------------------------------------ lotes
    sat_lotes = [l for l in saturno("lotes") if l["lote_id"].endswith(up_id) and num(l.get("numero_ha"))]
    costos = {c["lote_id"]: c for c in rest("v_costos_lote", unidad_produccion_id=f"eq.{up_id}")}
    lotes = []
    for l in sorted(sat_lotes, key=lambda l: l["lote_id"]):
        c = costos.get(l["lote_id"], {})
        lotes.append({
            "lote_id": l["lote_id"],
            "nombre": l["nombre_lote"].strip(),
            "ha": num(l["numero_ha"]),
            "ha_sembradas": num(l.get("ha_sembradas")) or 0,
            "ha_cosechadas": num(c.get("ha_cosechadas")) or 0,
            "toneladas": num(c.get("toneladas")) or 0,
            "rend_t_ha": num(c.get("rendimiento_t_ha")),
            "fecha_siembra": str(fecha_saturno(l.get("fecha_inicio_siembra_real") or l.get("fecha_inicio_siembra")) or ""),
            "tiene_poligono": bool(l.get("poligonos_wkt")),
        })
    nombres = {l["lote_id"]: l["nombre"] for l in lotes}
    ha_lote = {l["lote_id"]: l["ha"] for l in lotes}

    # ------------------------------------------------------------ labores
    LABORES = {
        "Pase de rastra": "rastra", "Enmienda": "enmienda", "Semillas de Maíz": "siembra",
        "Agroq. /Bio. /Mej.": "controles", "Fertilizante Reabono 1": "reabono1",
        "Fertilizante Reabono 2": "reabono2",
    }
    lab = defaultdict(lambda: defaultdict(float))
    for m in saturno("mecanizacion_registro"):
        if m.get("lote_id") not in ha_lote:
            continue
        act = m.get("actividadv") or ""
        clave = LABORES.get(act) or ("enmienda" if "encalad" in (m.get("mecanizacion") or "").lower() else None)
        if clave:
            lab[m["lote_id"]][clave] += num(m.get("ha_aplicada")) or 0
    for l in lotes:
        # Varias pasadas suman más que el lote: la labor cubre como mucho el lote.
        l["labores"] = {k: round(min(lab[l["lote_id"]].get(k, 0), l["ha"]), 2)
                        for k in ["rastra", "enmienda", "siembra", "controles", "reabono1", "reabono2"]}
        l["labores"]["cosecha"] = round(min(l["ha_cosechadas"], l["ha"]), 2)

    # ------------------------------------------------------------ suelo
    suelo_rows = rest("analisis_suelo", productor_homologo=f"eq.{agr['nombre']}", ano="eq.2026")
    def norm(s):
        return re.sub(r"[^a-z0-9]", "", (s or "").lower().replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u"))
    suelo = {}
    for l in lotes:
        n = norm(l["nombre"])
        # "Pelo e Mula" casa con "Pelo e Mula 1" y "Pelo e Mula 2": se promedian.
        muestras = [r for r in suelo_rows if num(r.get("ph_susp_1_2_edafofinca"))
                    and (norm(r.get("equivalencia_lotes")) == n
                         or re.fullmatch(re.escape(n) + r"\d", norm(r.get("equivalencia_lotes"))))]
        if not muestras:
            continue
        prom = lambda k: statistics.mean(num(r[k]) for r in muestras)
        ca, mg, k = prom("ca_me_100g"), prom("mg_me_100g"), prom("k_me_100g")
        suelo[l["lote_id"]] = {
            "n_muestras": len(muestras), "ph": round(prom("ph_susp_1_2_edafofinca"), 2),
            "ca": ca, "mg": mg, "k": k, "ca_mg": round(ca / mg, 1), "ca_k": round(ca / k, 1),
            "dosis_cal_kg_ha": max(num(r.get("dosis_de_cal")) or 0 for r in muestras),
            "laboratorio": muestras[0].get("laboratorio"),
        }
    municipio = up.get("municipio") or next((r["municipio"] for r in suelo_rows if r.get("municipio")), "")

    # ------------------------------------------------------------ prescripción
    detalle = rest("costos_lote_detalle", unidad_produccion_id=f"eq.{up_id}", ciclo="eq.2026")
    enmiendas = defaultdict(lambda: defaultdict(float))
    dosis = {}
    for d in detalle:
        if d["tipo_costo"] == "insumo" and d.get("concepto") in ("KMAG", "MagniPlus", "Cal", "Cal agrícola") \
                and d.get("lote_id") in ha_lote:
            enmiendas[d["concepto"]][d["lote_id"]] += d.get("cantidad_total") or 0
            dosis[d["concepto"]] = d.get("cantidad_por_ha") or dosis.get(d["concepto"])
    prescripcion = [{"producto": p, "dosis_sacos_ha": dosis[p],
                     "por_lote": {nombres[k]: round(v, 2) for k, v in por.items()}}
                    for p, por in enmiendas.items()]

    # ------------------------------------------------------------ incidencias
    fen = {f["estado_fenologico_id"]: f["nombre"] for f in saturno("estado_fenologico")}
    siembra = {l["lote_id"]: l["fecha_siembra"] for l in lotes}
    incid = []
    for s in saturno("seguimiento"):
        if s.get("lote_id") in ha_lote:
            txt = s.get("observaciones") or ""
            plaga = (s.get("plaga_predominante") or "").split(" ", 1)[-1]
            incid.append({"fecha": str(fecha_saturno(s["fecha_seguimiento"])), "lote_id": s["lote_id"],
                          "fase": s.get("expestadofenologico") or fen.get(s.get("estado_fenologico_id")),
                          "reto": clasificar(txt + " " + plaga) or "plagas",
                          "etiqueta": etiqueta(txt, plaga or "Seguimiento"), "texto": txt, "origen": "seguimiento"})
    for a in saturno("actividades_registro"):
        if a.get("lote_id") in ha_lote and a.get("comentarios_actividad"):
            txt = a["comentarios_actividad"]
            reto = clasificar(txt)
            if reto and not re.search(r"reabono|siembra", txt, re.I):
                incid.append({"fecha": str(fecha_saturno(a["fecha_inicio"])), "lote_id": a["lote_id"], "fase": None,
                              "reto": reto, "etiqueta": etiqueta(txt, reto), "texto": txt, "origen": "actividad"})
    vistos = set()
    incidencias = []
    for i in sorted(incid, key=lambda i: i["fecha"]):
        clave = (i["fecha"], i["lote_id"], i["etiqueta"])
        if clave in vistos:
            continue
        vistos.add(clave)
        fs = siembra.get(i["lote_id"])
        i["dds"] = (datetime.fromisoformat(i["fecha"]).date() - date.fromisoformat(fs)).days if fs else None
        i["lote"] = nombres[i["lote_id"]]
        incidencias.append(i)

    # ------------------------------------------------------------ clima
    lotes_clima = rest("lotes", agricultor_id=f"eq.{agr['id']}")
    est_cod = next((l["codigo_estacion"] for l in lotes_clima if l.get("codigo_estacion")), None)
    estacion = rest("estaciones", codigo_estacion=f"eq.{est_cod}")[0] if est_cod else None
    mensual = rest("vista_lluvia_mensual_estacion", codigo_estacion=f"eq.{est_cod}", anio="eq.2026", order="mes") if est_cod else []
    zona = (estacion or {}).get("zona") or "Occidente"
    pron = rest("vista_lluvia_mensual_pronostico", zona=f"eq.{zona}", anio="eq.2026", order="mes")
    seg_lluvia = rest("vista_seguimiento_lluvia", agricultor_id=f"eq.{agr['id']}")
    clima_ciclo = rest("v_lote_suelo_clima", agricultor=f"eq.{agr['nombre']}")
    clima = {
        "estacion": (estacion or {}).get("station_name"),
        "mensual": [{"mes": m["mes"], "mm": num(m["mm"]), "cobertura": num(m["cobertura"])} for m in mensual],
        "pronostico": [{"mes": p["mes"], "mm": num(p["mm_esperado"]), "fuente": p["fuente"]} for p in pron],
        "floracion": [{"lote": s["lote"], "desde": s["fecha_inicio_rango"], "hasta": s["fecha_fin_rango"],
                       "mm": num(s["lluvia_acumulada_mm"]), "meta_mm": num(s["meta_lluvia_mm"]),
                       "racha_max_dias_secos": s["racha_maxima_dias_secos"]} for s in seg_lluvia],
        "lluvia_ciclo_mm": max((num(c["lluvia_mm_ciclo_estacion"]) or 0 for c in clima_ciclo), default=None),
    }

    ha_plan = sum(l["ha"] for l in lotes)
    toneladas = sum(l["toneladas"] for l in lotes)
    ha_cos = sum(l["ha_cosechadas"] for l in lotes)
    datos = {
        "codigo_up": codigo_up,
        "agricultor": nombre,
        "finca": up["nombre"].strip(),
        "estado": up.get("estado") or "",
        "municipio": municipio,
        "lat": num(up.get("latitud")) / 10000 if num(up.get("latitud")) else None,
        "lng": num(up.get("longitud")) / 10000 if num(up.get("longitud")) else None,
        "lotes": lotes,
        "suelo": suelo,
        "prescripcion": prescripcion,
        "incidencias": incidencias,
        "clima": clima,
        "pl": {
            "ha_plan": round(ha_plan, 2), "ha_cosechadas": round(ha_cos, 2), "toneladas": round(toneladas, 1),
            "rend_t_ha": round(toneladas / ha_cos, 2) if ha_cos else None,
            "ton_plan": round(ha_plan * META_T_HA, 1), "meta_t_ha": META_T_HA,
        },
        # No están en la base: vienen de la liquidación de APC / banco.
        "mecanizacion_pagos": None,
        "flujo_caja": None,
    }
    json.dump(datos, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
