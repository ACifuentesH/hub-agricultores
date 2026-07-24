---
title: "Proyecto Saturno"
date: "13 de mayo de 2026"
geometry: "margin=1.5cm"
---

# Proyecto Saturno — Status

**App productiva:** `agri-platform-omega.vercel.app`

---

## Donde vamos

Plataforma operativa con **53 agricultores** (24 del ciclo 2025 + 35 del 2026), **496 lotes**, **99 PDFs de análisis de suelo** y **5 estaciones meteorológicas** sincronizando en tiempo real. App instalable como aplicación nativa en celular, con soporte offline y atención al cliente vía WhatsApp integrada.

**Cobertura del ciclo 2026: ~85% operativa.**

---

## Qué ya funciona

| Módulo | Estado |
|---|---|
| Dashboard ejecutivo + KPIs por agricultor | Operativo |
| Cultivo: línea de tiempo del maíz por lote | Operativo |
| Clima: lecturas Davis + pronóstico + alertas | Operativo |
| Suelo: análisis + insumos aplicados + PDFs | Operativo |
| Vista Master: comparativo de los 53 agricultores | Operativo |
| App instalable (PWA) con modo offline | Operativo |
| Soporte por WhatsApp con identificación automática | Operativo |
| 37 usuarios farmer + 1 master autenticados | Operativo |

---

## Próximos pasos

**1. Capa satelital** — tenemos muestra de poligonales del ciclo 2025; faltan las del 2026 (en manos de **Angel**).

**2. Integración con Saturno** — la data productiva pasará a alimentarse desde Saturno vía API.
*Antes de codear* hay que habilitar el plugin de **Google Cloud Platform** en Supabase, definir el contrato de datos (esquema, frecuencia, validaciones), y acordar política de fallback ante caídas de la API.

**3. Validación funcional con el equipo** — sesión con **Mavi** para validar lo que ya está construido antes de seguir agregando capas.

---

## Fuera de alcance (decisión)

- API de **Gemini** (asistente IA): **no por ahora**
- **NDVI** / análisis satelital procesado: **no por ahora**

---

## Pendientes externos (no bloquean MVP, limitan cobertura)

| Pendiente | Quien lo entrega |
|---|---|
| Mapeo de estaciones para 28 agricultores 2026 | Equipo agronómico |
| Poligonales ciclo 2026 | Angel |
| Contrato de datos Saturno + setup GCP | Equipo IT Polar |
| Validación funcional de lo construido | Mavi |
