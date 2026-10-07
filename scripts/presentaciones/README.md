# Presentaciones de cierre de ciclo por agricultor

Recrea la presentación de Lorena Orlando (`docs/presentaciones/plantilla_agricultores.pptx`)
con los datos de cualquier agricultor del ciclo 2026.

```bash
pip install python-pptx matplotlib pillow
python scripts/presentaciones/extraer_datos.py B01 > datos_B01.json    # código de unidad de producción
python scripts/presentaciones/generar_presentacion.py datos_B01.json Julio_Colmenarez.pptx
```

Necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el entorno, y salida a internet
para la imagen satelital (Esri World Imagery).

## Qué cambia y de dónde sale

| Lámina | Contenido | Fuente |
|---|---|---|
| 2 · Agricultor | nombre + estado | `saturno.unidades_de_produccion` |
| 3 · Radiografía | mapa satelital, tabla de lotes, pH por lote, cal | `analisis_suelo` (2026), coordenadas de la UP |
| 4 · Resultados | Ca/Mg, Ca/K por lote, prescripción | `analisis_suelo`, `costos_lote_detalle` (KMAG / MagniPlus / Cal) |
| 6 · Labores | ha por labor y lote | `saturno.mecanizacion_registro`, `v_costos_lote` (cosecha) |
| 7 · Incidencias | línea de tiempo y 3 retos | `saturno.seguimiento` + comentarios de `saturno.actividades_registro` (reglas en `RETOS`) |
| 8 · Clima | lluvia mensual real + estimada, siembra, floración | `vista_lluvia_mensual_estacion`, `vista_lluvia_mensual_pronostico`, `vista_seguimiento_lluvia` |
| 15 · P&L | ha y toneladas cosechadas, rendimiento vs meta 5 t/ha | `v_costos_lote` |

Se quedan igual: portada, plan agronómico (5), formaciones (9), I+D (10–13).

## Lo que NO está en la base

Sale como `—` y con el aviso `PENDIENTE` en el subtítulo (`markitdown salida.pptx | grep PENDIENTE`):

- **Lámina 14 · Mecanización, pago por pago** (pagos 1–3, tasa, comisiones, ajustes): liquidación de APC/banco.
- **Lámina 16 · Flujo de caja** (facturación Polar, notas de crédito, reconocimiento): liquidación.
- **Linderos de los lotes**: `saturno.lotes.poligonos_wkt` está vacío, así que el mapa muestra la finca sin
  delimitar los lotes. La imagen de la plantilla se hizo a mano en un SIG.

Las toneladas de la lámina 15 son las de cosecha en Saturno (peso de campo). En la plantilla de
Lorena eran 322,7 t frente a 336,4 t en la base: si la cifra oficial es la facturada, hay que
cargarla aparte.
