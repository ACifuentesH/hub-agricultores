"""
Genera un PDF ejecutivo de 1 página para enviar por WhatsApp.
Diseño: limpio, denso pero legible en móvil, paleta Polar verde.
"""
from datetime import datetime
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether,
)

OUT = Path("C:/Users/perez/OneDrive/Escritorio") / f"Polar_Status_{datetime.now():%Y-%m-%d}.pdf"

POLAR_GREEN = HexColor("#1a6e2c")
POLAR_GREEN_SOFT = HexColor("#e8f3eb")
GREY_DARK = HexColor("#1f2937")
GREY = HexColor("#6b7280")
GREY_LIGHT = HexColor("#e5e7eb")
AMBER = HexColor("#d97706")

styles = getSampleStyleSheet()

S_TITLE = ParagraphStyle(
    "title", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=18, textColor=POLAR_GREEN, spaceAfter=2, leading=22,
)
S_SUB = ParagraphStyle(
    "sub", parent=styles["Normal"], fontName="Helvetica",
    fontSize=8.5, textColor=GREY, spaceAfter=8, leading=11,
)
S_H = ParagraphStyle(
    "h2", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=11, textColor=POLAR_GREEN, spaceBefore=10, spaceAfter=4, leading=14,
)
S_BODY = ParagraphStyle(
    "body", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9.5, textColor=GREY_DARK, spaceAfter=4, leading=12,
)
S_BODY_SMALL = ParagraphStyle(
    "body_small", parent=styles["Normal"], fontName="Helvetica",
    fontSize=8.5, textColor=GREY_DARK, spaceAfter=3, leading=11,
)
S_CELL = ParagraphStyle(
    "cell", parent=styles["Normal"], fontName="Helvetica",
    fontSize=8.5, textColor=GREY_DARK, leading=11,
)
S_CELL_HEAD = ParagraphStyle(
    "cell_head", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=8.5, textColor=white, leading=11,
)
S_OUT = ParagraphStyle(
    "out", parent=styles["Normal"], fontName="Helvetica",
    fontSize=8.5, textColor=AMBER, leading=11, spaceAfter=2,
)

# ----------------------- Build PDF -----------------------

doc = SimpleDocTemplate(
    str(OUT), pagesize=A4,
    leftMargin=1.4*cm, rightMargin=1.4*cm,
    topMargin=1.2*cm, bottomMargin=1.2*cm,
)

flow = []

# Header
flow.append(Paragraph("Proyecto Saturno — Status", S_TITLE))
flow.append(Paragraph(
    f"App productiva: <b>agri-platform-omega.vercel.app</b> · "
    f"Reporte: {datetime.now():%d %b %Y}",
    S_SUB,
))

# Resumen
flow.append(Paragraph("Donde vamos", S_H))
flow.append(Paragraph(
    "Plataforma operativa con <b>53 agricultores</b> (24 del ciclo 2025 + 35 del 2026), "
    "<b>496 lotes</b>, <b>99 PDFs de análisis de suelo</b> y <b>5 estaciones meteorológicas</b> "
    "sincronizando. App instalable como aplicación nativa en celular, con soporte offline y "
    "atención al cliente vía WhatsApp integrada. "
    "<b>Cobertura del ciclo 2026: ~85% operativa.</b>",
    S_BODY,
))

# Tabla de módulos
flow.append(Paragraph("Qué ya funciona", S_H))

modules = [
    ["Módulo", "Estado"],
    ["Dashboard ejecutivo + KPIs por agricultor", "Operativo"],
    ["Cultivo: línea de tiempo del maíz por lote", "Operativo"],
    ["Clima: lecturas Davis + pronóstico + alertas", "Operativo"],
    ["Suelo: análisis + insumos + PDFs", "Operativo"],
    ["Finanzas (P&L): costos, ingreso, utilidad", "Operativo"],
    ["Vista Master: comparativo de los 53 agricultores", "Operativo"],
    ["App instalable (PWA) con modo offline", "Operativo"],
    ["Soporte por WhatsApp con auto-identificación", "Operativo"],
    ["37 usuarios farmer + 1 master autenticados", "Operativo"],
]

module_rows = []
for r in modules:
    module_rows.append([Paragraph(r[0], S_CELL_HEAD if r == modules[0] else S_CELL),
                        Paragraph(r[1], S_CELL_HEAD if r == modules[0] else S_CELL)])

t = Table(module_rows, colWidths=[12.5*cm, 4.5*cm])
t.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), POLAR_GREEN),
    ("BACKGROUND", (0, 1), (-1, -1), white),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, POLAR_GREEN_SOFT]),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("LINEBELOW", (0, 0), (-1, 0), 0.5, white),
]))
flow.append(t)

# Próximos pasos
flow.append(Paragraph("Próximos pasos", S_H))
flow.append(Paragraph(
    "<b>1. Refactor visual del P&L</b> — simplificar la vista de finanzas para que sea más "
    "digerible. <i>Prerequisito:</i> validación previa con <b>Mavi</b>.",
    S_BODY_SMALL,
))
flow.append(Paragraph(
    "<b>2. Capa satelital</b> — tenemos muestra de poligonales del ciclo 2025; faltan las del "
    "2026 (en manos de <b>Angel</b>).",
    S_BODY_SMALL,
))
flow.append(Paragraph(
    "<b>3. Integración con Saturno</b> — la data productiva pasará a alimentarse desde "
    "Saturno vía API. Antes de codear hay que habilitar el plugin de <b>Google Cloud "
    "Platform</b> en Supabase, definir el contrato de datos (esquema, frecuencia, "
    "validaciones) y acordar política de fallback ante caídas de la API.",
    S_BODY_SMALL,
))

# Fuera de alcance
flow.append(Paragraph("Fuera de alcance (decisión)", S_H))
flow.append(Paragraph("• API de <b>Gemini</b> (asistente IA): no por ahora", S_OUT))
flow.append(Paragraph("• <b>NDVI</b> / análisis satelital procesado: no por ahora", S_OUT))

# Pendientes externos
flow.append(Paragraph("Pendientes externos", S_H))

pendientes = [
    ["Pendiente", "Quién lo entrega"],
    ["Mapeo de estaciones para 28 agricultores 2026", "Equipo agronómico"],
    ["Poligonales ciclo 2026", "Angel"],
    ["Contrato de datos Saturno + setup GCP", "Equipo IT Polar"],
    ["Validación P&L visual simplificado", "Mavi"],
]
pend_rows = []
for r in pendientes:
    pend_rows.append([Paragraph(r[0], S_CELL_HEAD if r == pendientes[0] else S_CELL),
                      Paragraph(r[1], S_CELL_HEAD if r == pendientes[0] else S_CELL)])

t2 = Table(pend_rows, colWidths=[12*cm, 5*cm])
t2.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), POLAR_GREEN),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, POLAR_GREEN_SOFT]),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
flow.append(t2)

doc.build(flow)
print(f"PDF generado: {OUT}")
print(f"Tamaño: {OUT.stat().st_size / 1024:.1f} KB")
